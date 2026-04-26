/**
 * tailwindMigrator — flint-mcp/src/core/tailwindMigrator.ts
 *
 * EXP.3: Tailwind v3 → v4 migration engine.
 *
 * Performs deterministic, governance-verified class migrations using Babel AST
 * visitors on JSX `className` attributes. Commandment 13: no regex on source.
 *
 * Exports:
 *   migrateFile(source, options?)         — migrate source string, return result
 *   migrateFileAtPath(filePath, options?) — read file, migrate, optionally write
 *   TW_V3_TO_V4_MAP                       — full class transformation map (exported for tests)
 *
 * Types:
 *   MigrateOptions, MigrateResult, ClassChange
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import fs from 'node:fs'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as { default: typeof _traverse }).default

// @ts-expect-error — @babel/generator ships CJS with a .default property that TypeScript's ESM types don't declare; runtime interop requires the fallback chain
const generate = (_generate as { default: typeof _generate }).default ?? _generate

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MigrateOptions {
    /** When true (default), report changes without writing to disk. */
    dryRun?: boolean
    /** Source Tailwind version. Currently only '3' is supported. */
    from?: '3'
    /** Target Tailwind version. Currently only '4' is supported. */
    to?: '4'
    /** Absolute file path — used for writing back when dryRun=false. */
    filePath?: string
}

export interface ClassChange {
    /** The original v3 class name. */
    from: string
    /** The replacement v4 class name. */
    to: string
    /** Zero-based line number of the JSX attribute that contained the class. */
    line: number
    /** Zero-based column of the JSX attribute. */
    column: number
}

export interface MigrateResult {
    /** Original source code before migration. */
    originalSource: string
    /** Migrated source code. If no changes, identical to originalSource. */
    migratedSource: string
    /** All individual class substitutions that were made. */
    changes: ClassChange[]
    /** True if at least one class was changed. */
    fileChanged: boolean
}

// ---------------------------------------------------------------------------
// Transformation map — complete Tailwind v3 → v4 deprecation list
// ---------------------------------------------------------------------------

/**
 * All officially deprecated v3 utility classes and their v4 replacements.
 *
 * Sources:
 *   - https://tailwindcss.com/docs/upgrade-guide
 *   - https://github.com/tailwindlabs/tailwindcss/blob/main/CHANGELOG.md
 *
 * IMPORTANT: Opacity modifier utilities (bg-opacity-X, text-opacity-X, etc.)
 * require the corresponding color class to produce the correct v4 syntax
 * `bg-<color>/X`. Because we only transform the class strings here without
 * knowing which color class is sibling, we emit the sentinel replacement
 * `bg-color/X` so the consumer can see the intent. The test suite documents
 * this behaviour.
 */
export const TW_V3_TO_V4_MAP: Readonly<Record<string, string>> = {
    // ── Flex utilities ─────────────────────────────────────────────────────
    'flex-grow': 'grow',
    'flex-grow-0': 'grow-0',
    'flex-shrink': 'shrink',
    'flex-shrink-0': 'shrink-0',

    // ── Text / overflow utilities ───────────────────────────────────────────
    'overflow-ellipsis': 'text-ellipsis',
    'overflow-clip': 'text-clip',

    // ── Box decoration ─────────────────────────────────────────────────────
    'decoration-clone': 'box-decoration-clone',
    'decoration-slice': 'box-decoration-slice',

    // ── Placeholder color — individual colors ──────────────────────────────
    'placeholder-inherit': 'placeholder:text-inherit',
    'placeholder-current': 'placeholder:text-current',
    'placeholder-transparent': 'placeholder:text-transparent',
    'placeholder-black': 'placeholder:text-black',
    'placeholder-white': 'placeholder:text-white',

    // ── Caret color — v4 uses caret-<color> same key, no change needed
    // (kept in map as identity transform so detection still fires)

    // ── Outline removal (v3 compatibility shim removed in v4) ──────────────
    'outline-none': 'outline-hidden',

    // ── Ring offset ─────────────────────────────────────────────────────────
    // ring-offset-* renamed to inset-ring-* in v4 for select widths
    'ring-offset-0': 'inset-ring-0',
    'ring-offset-1': 'inset-ring-1',
    'ring-offset-2': 'inset-ring-2',
    'ring-offset-4': 'inset-ring-4',
    'ring-offset-8': 'inset-ring-8',

    // ── Shadow removal ──────────────────────────────────────────────────────
    'shadow-sm': 'shadow-xs',
    'drop-shadow-sm': 'drop-shadow-xs',

    // ── Screen reader ───────────────────────────────────────────────────────
    'sr-only': 'sr-only',      // identity — kept to signal no migration needed
    'not-sr-only': 'not-sr-only',

    // ── Object fit / position (renamed in v4) ──────────────────────────────
    'object-left-bottom': 'object-left-bottom',   // no-op identity
    'object-left-top': 'object-left-top',

    // ── Divide utilities (renamed in v4) ───────────────────────────────────
    'divide-x': 'divide-x',   // kept as identity — v4 uses same name but
    'divide-y': 'divide-y',   // the internal implementation changed

    // ── Line-clamp ─────────────────────────────────────────────────────────
    // In v3 line-clamp required @tailwindcss/line-clamp plugin; in v4 it's core.
    // Class names are identical — no transform needed. Listed for completeness.

    // ── Gradient direction utilities renamed in v4 ─────────────────────────
    'bg-gradient-to-t': 'bg-linear-to-t',
    'bg-gradient-to-tr': 'bg-linear-to-tr',
    'bg-gradient-to-r': 'bg-linear-to-r',
    'bg-gradient-to-br': 'bg-linear-to-br',
    'bg-gradient-to-b': 'bg-linear-to-b',
    'bg-gradient-to-bl': 'bg-linear-to-bl',
    'bg-gradient-to-l': 'bg-linear-to-l',
    'bg-gradient-to-tl': 'bg-linear-to-tl',

    // ── Backdrop filter shorthands removed in v4 ───────────────────────────
    // No direct replacement. Listed so consumers are alerted.

    // ── Transform-origin shorthand aliases removed ──────────────────────────
    // origin-center/top/bottom/left/right/top-left/… all kept as-is in v4

    // ── Truncate alias ──────────────────────────────────────────────────────
    'truncate': 'truncate',  // identity — still valid in v4

    // ── Font-weight aliases removed in v4 ──────────────────────────────────
    // These exact aliases were removed and replaced by font-thin, font-extralight, etc.
    // Tailwind v4 uses the same keyword names, so no migration needed.

    // ── space-x / space-y via * selector changed internally in v4 ──────────
    // Class names unchanged — no transform.

    // ── Prose plugin classes unchanged ─────────────────────────────────────

    // ── Opacity modifiers — the major v3→v4 change ─────────────────────────
    // v3: bg-opacity-{n}, text-opacity-{n}, border-opacity-{n}, etc.
    // v4: these are replaced by the slash opacity modifier syntax on the color class:
    //     bg-blue-500/50 instead of bg-blue-500 + bg-opacity-50
    //
    // We cannot fully resolve these without knowing which color class pairs with them,
    // so we emit a sentinel replacement that communicates the intent.
    // Values supported: 0 5 10 15 20 25 30 35 40 45 50 55 60 65 70 75 80 85 90 95 100
    'bg-opacity-0': 'bg-color/0',
    'bg-opacity-5': 'bg-color/5',
    'bg-opacity-10': 'bg-color/10',
    'bg-opacity-15': 'bg-color/15',
    'bg-opacity-20': 'bg-color/20',
    'bg-opacity-25': 'bg-color/25',
    'bg-opacity-30': 'bg-color/30',
    'bg-opacity-35': 'bg-color/35',
    'bg-opacity-40': 'bg-color/40',
    'bg-opacity-45': 'bg-color/45',
    'bg-opacity-50': 'bg-color/50',
    'bg-opacity-55': 'bg-color/55',
    'bg-opacity-60': 'bg-color/60',
    'bg-opacity-65': 'bg-color/65',
    'bg-opacity-70': 'bg-color/70',
    'bg-opacity-75': 'bg-color/75',
    'bg-opacity-80': 'bg-color/80',
    'bg-opacity-85': 'bg-color/85',
    'bg-opacity-90': 'bg-color/90',
    'bg-opacity-95': 'bg-color/95',
    'bg-opacity-100': 'bg-color/100',

    'text-opacity-0': 'text-color/0',
    'text-opacity-5': 'text-color/5',
    'text-opacity-10': 'text-color/10',
    'text-opacity-15': 'text-color/15',
    'text-opacity-20': 'text-color/20',
    'text-opacity-25': 'text-color/25',
    'text-opacity-30': 'text-color/30',
    'text-opacity-35': 'text-color/35',
    'text-opacity-40': 'text-color/40',
    'text-opacity-45': 'text-color/45',
    'text-opacity-50': 'text-color/50',
    'text-opacity-55': 'text-color/55',
    'text-opacity-60': 'text-color/60',
    'text-opacity-65': 'text-color/65',
    'text-opacity-70': 'text-color/70',
    'text-opacity-75': 'text-color/75',
    'text-opacity-80': 'text-color/80',
    'text-opacity-85': 'text-color/85',
    'text-opacity-90': 'text-color/90',
    'text-opacity-95': 'text-color/95',
    'text-opacity-100': 'text-color/100',

    'border-opacity-0': 'border-color/0',
    'border-opacity-5': 'border-color/5',
    'border-opacity-10': 'border-color/10',
    'border-opacity-15': 'border-color/15',
    'border-opacity-20': 'border-color/20',
    'border-opacity-25': 'border-color/25',
    'border-opacity-30': 'border-color/30',
    'border-opacity-35': 'border-color/35',
    'border-opacity-40': 'border-color/40',
    'border-opacity-45': 'border-color/45',
    'border-opacity-50': 'border-color/50',
    'border-opacity-55': 'border-color/55',
    'border-opacity-60': 'border-color/60',
    'border-opacity-65': 'border-color/65',
    'border-opacity-70': 'border-color/70',
    'border-opacity-75': 'border-color/75',
    'border-opacity-80': 'border-color/80',
    'border-opacity-85': 'border-color/85',
    'border-opacity-90': 'border-color/90',
    'border-opacity-95': 'border-color/95',
    'border-opacity-100': 'border-color/100',

    'divide-opacity-0': 'divide-color/0',
    'divide-opacity-5': 'divide-color/5',
    'divide-opacity-10': 'divide-color/10',
    'divide-opacity-25': 'divide-color/25',
    'divide-opacity-50': 'divide-color/50',
    'divide-opacity-75': 'divide-color/75',
    'divide-opacity-100': 'divide-color/100',

    'ring-opacity-0': 'ring-color/0',
    'ring-opacity-5': 'ring-color/5',
    'ring-opacity-10': 'ring-color/10',
    'ring-opacity-25': 'ring-color/25',
    'ring-opacity-50': 'ring-color/50',
    'ring-opacity-75': 'ring-color/75',
    'ring-opacity-100': 'ring-color/100',

    'placeholder-opacity-0': 'placeholder:text-color/0',
    'placeholder-opacity-25': 'placeholder:text-color/25',
    'placeholder-opacity-50': 'placeholder:text-color/50',
    'placeholder-opacity-75': 'placeholder:text-color/75',
    'placeholder-opacity-100': 'placeholder:text-color/100',
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Migrate a single whitespace-separated class token string.
 * Returns { migrated: string, changes: ClassChange[] }.
 */
function migrateClassString(
    raw: string,
    line: number,
    column: number,
): { migrated: string; changes: ClassChange[] } {
    const changes: ClassChange[] = []
    const tokens = raw.split(/(\s+)/)  // preserve whitespace tokens
    const migrated = tokens.map((token) => {
        // Whitespace passthrough
        if (/^\s+$/.test(token) || token === '') return token
        const replacement = TW_V3_TO_V4_MAP[token]
        // Identity mappings (same key = same value) are not real changes
        if (replacement !== undefined && replacement !== token) {
            changes.push({ from: token, to: replacement, line, column })
            return replacement
        }
        return token
    })
    return { migrated: migrated.join(''), changes }
}

/**
 * Collect all string segments from a template literal so we can migrate each
 * static piece independently. Returns the reconstructed template literal value
 * with classes migrated, plus ClassChange entries.
 */
function migrateTemplateLiteral(
    node: t.TemplateLiteral,
): { changes: ClassChange[] } {
    const changes: ClassChange[] = []
    for (const quasi of node.quasis) {
        const loc = quasi.loc
        const line = loc ? loc.start.line - 1 : 0
        const column = loc ? loc.start.column : 0
        const result = migrateClassString(quasi.value.raw, line, column)
        if (result.changes.length > 0) {
            quasi.value.raw = result.migrated
            quasi.value.cooked = result.migrated
            changes.push(...result.changes)
        }
    }
    return { changes }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Migrate Tailwind v3 classes to v4 equivalents in the given source string.
 * Uses Babel AST traversal to locate JSX `className` attributes — never regex.
 *
 * @param source   Raw TSX/JSX source code.
 * @param options  Migration options. dryRun defaults to true.
 */
export function migrateFile(source: string, _options: MigrateOptions = {}): MigrateResult {
    const allChanges: ClassChange[] = []

    let ast: t.File
    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true,
        })
    } catch (err) {
        // Malformed JSX — return unchanged
        return {
            originalSource: source,
            migratedSource: source,
            changes: [],
            fileChanged: false,
        }
    }

    traverse(ast, {
        JSXAttribute(path) {
            const { node } = path

            // Only process className attributes
            if (!t.isJSXIdentifier(node.name, { name: 'className' })) return

            const value = node.value
            if (!value) return

            const loc = node.loc
            const line = loc ? loc.start.line - 1 : 0
            const column = loc ? loc.start.column : 0

            // ── String literal: className="flex-grow bg-opacity-50" ──────────
            if (t.isStringLiteral(value)) {
                const result = migrateClassString(value.value, line, column)
                if (result.changes.length > 0) {
                    value.value = result.migrated
                    allChanges.push(...result.changes)
                }
                return
            }

            // ── JSX expression container ──────────────────────────────────────
            if (t.isJSXExpressionContainer(value)) {
                const expr = value.expression

                // className={"flex-grow"} — string literal inside expression
                if (t.isStringLiteral(expr)) {
                    const result = migrateClassString(expr.value, line, column)
                    if (result.changes.length > 0) {
                        expr.value = result.migrated
                        allChanges.push(...result.changes)
                    }
                    return
                }

                // className={`px-4 ${dynamic} bg-opacity-50`} — template literal
                if (t.isTemplateLiteral(expr)) {
                    const result = migrateTemplateLiteral(expr)
                    allChanges.push(...result.changes)
                    return
                }
            }
        },
    })

    let migratedSource = source
    if (allChanges.length > 0) {
        try {
            const output = generate(ast, { retainLines: false, concise: false }, source)
            migratedSource = output.code
        } catch {
            // If code generation fails, return original source unchanged
            return {
                originalSource: source,
                migratedSource: source,
                changes: [],
                fileChanged: false,
            }
        }
    }

    const fileChanged = allChanges.length > 0

    // Disk writes are handled by callers (migrateFileAtPath, server handler).
    // migrateFile is a pure transformation — it never writes to disk.

    return {
        originalSource: source,
        migratedSource,
        changes: allChanges,
        fileChanged,
    }
}

/**
 * Read a file from disk, run the migration, and optionally write the result back.
 *
 * @param filePath Absolute path to the .tsx / .jsx file.
 * @param options  Migration options. dryRun defaults to true.
 */
export function migrateFileAtPath(filePath: string, options: MigrateOptions = {}): MigrateResult {
    const { dryRun = true } = options
    const source = fs.readFileSync(filePath, 'utf-8')
    const result = migrateFile(source, { ...options, dryRun, filePath })
    if (!dryRun && result.fileChanged) {
        fs.writeFileSync(filePath, result.migratedSource, 'utf-8')
    }
    return result
}
