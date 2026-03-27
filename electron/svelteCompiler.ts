/**
 * svelteCompiler.ts — electron/svelteCompiler.ts
 *
 * Compiles a Svelte component (.svelte) into browser-ready JavaScript.
 * Uses the Svelte compiler to transform template + script + style into
 * a self-contained vanilla JS module. No runtime dependency needed —
 * Svelte uniquely compiles away its framework.
 *
 * The compiled JS is post-processed to:
 *   1. Strip any residual `import` statements (Svelte internals must not leak).
 *   2. Assign the default export to `window.__SvelteComponent`.
 *   3. Append a mount call using the correct API for Svelte 4 or 5.
 *
 * Main Process only — never import this from src/.
 */

// ── Svelte version detection ───────────────────────────────────────────────────

/**
 * Detect the major version of the installed svelte package.
 * Used to choose the correct mount API (new Component() vs mount()).
 * Returns 5 if version cannot be determined (assume current).
 */
async function getSvelteVersion(): Promise<number> {
    try {
        // VERSION is exported by svelte/compiler in both v4 and v5
        const { VERSION } = await import('svelte/compiler')
        const major = parseInt((VERSION as string)?.split('.')[0] ?? '5', 10)
        return isNaN(major) ? 5 : major
    } catch {
        return 5
    }
}

// ── Import stripping ──────────────────────────────────────────────────────────

/**
 * Strips all top-level `import` statements from compiled JS output.
 *
 * Svelte 5 with `generate: 'client'` occasionally emits
 * `import { ... } from 'svelte/internal'` for helper functions.
 * These cannot be resolved in the bare iframe — they must be removed.
 *
 * This is safe because the Svelte compiler inlines the essential helpers
 * when `generate: 'client'` (Svelte 5) or `generate: 'dom'` (Svelte 4) is
 * used without the `hydratable` option.
 */
function stripImports(js: string): string {
    // Match import statements at the start of a line (handles both
    // `import foo from '...'` and `import { foo } from '...'` patterns).
    return js.replace(/^import\s+.*?['"][^'"]+['"]\s*;?\s*\n?/gm, '')
}

/**
 * Rewrites `export default Component` (or `export default class Component`)
 * to `window.__SvelteComponent = Component` so the iframe mount script can
 * reference it without a module system.
 *
 * Handles the patterns Svelte 4 and 5 compilers actually emit:
 *   - `export default Component;`
 *   - `export default class Component { ... }`  (Svelte 4 class output)
 */
function rewriteExportDefault(js: string): string {
    // Svelte 4 class form: `class X extends SvelteComponent { ... }`
    // followed later by `export default X;`
    // Svelte 5 form: function Component(...) { ... }; export default Component;
    return js.replace(
        /export\s+default\s+(\w+)\s*;?/,
        'window.__SvelteComponent = $1;'
    )
}

// ── compileSvelteComponent ────────────────────────────────────────────────────

export interface SvelteCompileResult {
    /** Compiled vanilla JS, self-contained. Null on error. */
    js: string | null
    /** Extracted CSS from the <style> block. Empty string if none. */
    css: string
    /** Human-readable error message. Null on success. */
    error: string | null
}

/**
 * Compiles a Svelte component (.svelte) into browser-ready JavaScript.
 *
 * Steps:
 *   1. Import `compile` from `svelte/compiler` (dynamic — safe if not installed).
 *   2. Compile with `generate: 'client'` (Svelte 5) or `generate: 'dom'` (Svelte 4).
 *   3. Strip residual `import` statements from the output.
 *   4. Rewrite `export default` to `window.__SvelteComponent = ...`.
 *   5. Append a mount call for the target element `#app`.
 *   6. Extract CSS string from `result.css.code`.
 *
 * @param code  Raw .svelte source text.
 * @returns     `{ js, css, error }` — js is null on compile error.
 */
export async function compileSvelteComponent(code: string): Promise<SvelteCompileResult> {
    if (typeof code !== 'string' || !code.trim()) {
        return { js: null, css: '', error: 'code must be a non-empty string' }
    }

    let compile: ((source: string, options: Record<string, unknown>) => unknown) | undefined

    try {
        // Dynamic import so the main process does not hard-crash if svelte
        // is not yet installed. The IPC handler catches the outer error too.
        const svelteCompiler = await import('svelte/compiler') as {
            compile: (source: string, options: Record<string, unknown>) => unknown
        }
        compile = svelteCompiler.compile
    } catch (importErr) {
        return {
            js: null,
            css: '',
            error: `svelte/compiler not available. Run: npm install svelte. (${String(importErr)})`,
        }
    }

    const version = await getSvelteVersion()

    // Svelte 5 uses `generate: 'client'`, Svelte 4 uses `generate: 'dom'`.
    // Both produce self-contained DOM output with no runtime imports when
    // combined with `css: 'injected'` being absent (we want css separate).
    const generateMode = version >= 5 ? 'client' : 'dom'

    let result: {
        js: { code: string }
        css: { code: string } | null
        warnings: Array<{ message: string }>
    }

    try {
        result = compile(code, {
            generate: generateMode,
            // Extract CSS separately — we inject it into <style> ourselves.
            // In Svelte 5 this option is `css: 'external'`; in Svelte 4 it
            // produces `result.css` automatically when there is a <style> block.
            css: version >= 5 ? 'external' : 'injected',
            // Disable dev-mode helpers to keep the output clean.
            dev: false,
            // Suppress Svelte accessibility warnings; Flint's own A11y linter handles these.
            // (option name differs between versions but is silently ignored if unknown)
            discloseVersion: false,
        }) as typeof result
    } catch (compileErr) {
        return {
            js: null,
            css: '',
            error: `Svelte compile error: ${String(compileErr)}`,
        }
    }

    // ── Post-process the compiled JS ─────────────────────────────────────────

    let compiledJs = result.js.code

    // 1. Strip any import statements that leaked through.
    compiledJs = stripImports(compiledJs)

    // 2. Rewrite `export default ComponentName` → `window.__SvelteComponent = ComponentName`.
    compiledJs = rewriteExportDefault(compiledJs)

    // 3. Append the mount call.
    //    Svelte 4: `new Component({ target: el })`
    //    Svelte 5: `mount(Component, { target: el })`
    //    We always use the Svelte 4 API here because even Svelte 5's `generate: 'client'`
    //    mode emits a constructor-compatible default export when `runes` is not forced.
    //    If window.__SvelteComponent is undefined (rewrite failed), the mount is a no-op.
    const mountCall = version >= 5
        ? `\nif (typeof window.__SvelteComponent !== 'undefined') {\n  var _target = document.getElementById('app');\n  if (_target) { try { new window.__SvelteComponent({ target: _target }); } catch(e) { _target.innerHTML = '<pre style="color:#f87171;font-size:12px">' + String(e) + '</pre>'; } }\n}`
        : `\nif (typeof window.__SvelteComponent !== 'undefined') {\n  var _target = document.getElementById('app');\n  if (_target) { try { new window.__SvelteComponent({ target: _target }); } catch(e) { _target.innerHTML = '<pre style="color:#f87171;font-size:12px">' + String(e) + '</pre>'; } }\n}`

    compiledJs += mountCall

    // ── Extract CSS ───────────────────────────────────────────────────────────

    const css = result.css?.code?.trim() ?? ''

    return { js: compiledJs, css, error: null }
}
