/**
 * vueCompiler.ts — electron/vueCompiler.ts
 *
 * Compiles a Vue 3 Single File Component (.vue) into browser-ready JavaScript
 * suitable for execution inside a sandboxed srcdoc iframe where Vue 3 is
 * available as a UMD global (`window.Vue`).
 *
 * Uses @vue/compiler-sfc to:
 *   1. Parse the SFC descriptor (<template>, <script>/<script setup>, <style>)
 *   2. Compile the <script>/<script setup> block via compileScript()
 *   3. Compile the <template> block via compileTemplate()
 *   4. Assemble a self-mounting component module
 *   5. Extract <style> block CSS
 *
 * Returns { js, css, error } where:
 *   js    — compiled module ready to execute; null on failure
 *   css   — extracted <style> content; empty string if absent
 *   error — human-readable message on failure; null on success
 *
 * Commandment 9: This file runs ONLY in the Electron main process.
 * Never import from src/.
 */

// Dynamic import guard — the caller uses dynamic import so the app does not
// crash at startup if @vue/compiler-sfc is missing.

export interface VueCompileResult {
    js: string | null
    css: string
    error: string | null
}

/**
 * Strips ES import declarations from a JS string.
 * Vue is provided as a UMD global in the iframe — all import statements must
 * be removed so the code can execute in a plain <script> context.
 */
function stripImports(code: string): string {
    // Remove: import ... from '...'  (with optional semicolon)
    // Remove: import '...'  (side-effect imports)
    return code
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
        .trim()
}

/**
 * Rewrites `export default { ... }` and `export default defineComponent({ ... })`
 * to assign the component definition to `window.__VueComponent`.
 *
 * The output JS is executed via `new Function(code)()` in the iframe, so
 * ES module `export` syntax is not valid — we need a global assignment.
 */
function rewriteExportDefault(code: string): string {
    // Handle: export default { ... } or export default defineComponent({ ... })
    // We replace the export default keyword with a window.__VueComponent = assignment.
    return code.replace(/\bexport\s+default\s+/, 'window.__VueComponent = ')
}

/**
 * Compiles a Vue 3 Single File Component source string into browser-ready JS.
 *
 * @param code  Raw .vue file content (UTF-8 string)
 * @returns     VueCompileResult — { js, css, error }
 */
export async function compileVueSFC(code: string): Promise<VueCompileResult> {
    if (typeof code !== 'string' || code.trim() === '') {
        return { js: null, css: '', error: 'code must be a non-empty string' }
    }

    try {
        // Dynamic import so the application does not crash at startup if the
        // package is not yet installed. The caller catches the module-not-found
        // error and returns a graceful "not available" message.
        const {
            parse,
            compileScript,
            compileTemplate,
        } = await import('@vue/compiler-sfc')

        // ── Step 1: Parse the SFC descriptor ──────────────────────────────────
        const { descriptor, errors: parseErrors } = parse(code)

        if (parseErrors.length > 0) {
            const msg = parseErrors.map((e) => (typeof e === 'string' ? e : e.message)).join('; ')
            return { js: null, css: '', error: `Vue SFC parse error: ${msg}` }
        }

        // ── Step 2: Require a <template> section ──────────────────────────────
        if (!descriptor.template) {
            return { js: null, css: '', error: 'Vue SFC must have a <template> section' }
        }

        // ── Step 3: Compile <script>/<script setup> ───────────────────────────
        const SFC_ID = 'flint-vue-preview'
        let scriptContent = ''

        if (descriptor.script || descriptor.scriptSetup) {
            try {
                const compiledScript = compileScript(descriptor, {
                    id: SFC_ID,
                    // Ensure TypeScript is handled
                    inlineTemplate: false,
                })
                scriptContent = compiledScript.content ?? ''
            } catch (scriptErr) {
                return {
                    js: null,
                    css: '',
                    error: `Vue <script> compilation error: ${String(scriptErr)}`,
                }
            }
        }

        // ── Step 4: Compile <template> to a render function ───────────────────
        let renderFnSource = ''
        try {
            const templateResult = compileTemplate({
                source: descriptor.template.content,
                filename: 'flint-preview.vue',
                id: SFC_ID,
                compilerOptions: {
                    // Optimise for runtime-only (no compiler in iframe)
                    runtimeModuleName: 'vue',
                    // Disable scoped CSS transform (we can't easily apply in iframe)
                    scopeId: undefined,
                },
            })

            if (templateResult.errors && templateResult.errors.length > 0) {
                const msg = templateResult.errors
                    .map((e) => (typeof e === 'string' ? e : e.message))
                    .join('; ')
                return { js: null, css: '', error: `Vue template compile error: ${msg}` }
            }

            renderFnSource = templateResult.code
        } catch (tmplErr) {
            return {
                js: null,
                css: '',
                error: `Vue template compilation error: ${String(tmplErr)}`,
            }
        }

        // ── Step 5: Extract <style> CSS ───────────────────────────────────────
        const css = descriptor.styles
            .map((s) => s.content ?? '')
            .join('\n')
            .trim()

        // ── Step 6: Assemble the final browser-executable module ──────────────
        //
        // The iframe has Vue 3 UMD available as `window.Vue`. We destructure
        // the composition API helpers from `Vue` so that script-setup code
        // (which calls ref(), reactive(), etc.) works without an import map.
        //
        // The template render function is compiled to reference `_Vue` imports
        // that look like: import { createVNode as _createVNode } from "vue"
        // We strip those imports and use the globally destructured helpers.

        // Strip all imports from both the script and render-function code
        const cleanedScript = stripImports(scriptContent)
        const cleanedRender = stripImports(renderFnSource)

        // Rewrite `export default` in the script to assign to __VueComponent
        // For <script setup>, compileScript wraps output in `export default { setup() {...} }`
        const scriptWithExport = rewriteExportDefault(cleanedScript)

        // Build the self-mounting module
        const js = `
(function () {
  'use strict';

  // Destructure the Vue 3 composition API from the UMD global.
  // This satisfies any calls to ref(), reactive(), computed(), watch(), etc.
  // that remain in the compiled script-setup output after import stripping.
  var {
    createApp, ref, reactive, computed, watch, watchEffect,
    onMounted, onUnmounted, onBeforeMount, onBeforeUnmount,
    onUpdated, onBeforeUpdate, defineComponent, defineProps,
    defineEmits, defineExpose, withDefaults, toRefs, toRef,
    isRef, unref, nextTick, provide, inject, h, resolveComponent,
    createVNode, createTextVNode, createElementVNode,
    createElementBlock, openBlock, Fragment, renderList,
    withDirectives, vModelText, vModelSelect, vModelCheckbox,
    mergeProps, normalizeClass, normalizeStyle,
  } = Vue;

  // ── Compiled <template> render function ─────────────────────────────────────
  ${cleanedRender}

  // ── Compiled <script> / <script setup> ──────────────────────────────────────
  ${scriptWithExport}

  // ── Mount ────────────────────────────────────────────────────────────────────
  // window.__VueComponent is set by the export-default rewrite above (script path).
  // If there is no script section, build a minimal component with just the render fn.
  var _component = window.__VueComponent || {};

  // Attach the compiled render function to the component.
  // The template compiler emits a named export called "render" — attach it.
  if (typeof render === 'function' && !_component.render) {
    _component.render = render;
  }

  var _app = createApp(_component);
  _app.mount('#app');
})();
`.trim()

        return { js, css, error: null }
    } catch (err) {
        // Catch module-not-found and any unexpected runtime errors
        return {
            js: null,
            css: '',
            error: `Vue compiler not available: ${String(err)}`,
        }
    }
}
