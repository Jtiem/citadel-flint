/**
 * componentIndexer — flint-mcp/src/core/init/componentIndexer.ts
 *
 * Phase INIT.1: Scans a project's source tree for components and builds
 * a registry of ComponentEntry objects compatible with registryService.ts.
 *
 * Exports:
 *   indexComponents(projectRoot, srcDir?) — discover all components
 *   ComponentIndexResult                  — return shape
 *
 * Rules:
 *   - Commandment 13: Babel AST traversal only — never regex on source code.
 *   - Read-only: no mutations, no disk writes.
 *
 * Return shape is designed to satisfy the `initRunner.ts` contract:
 *   count     — number of components found
 *   components — Record<name, ComponentEntry> for flint-manifest.json
 *   filePaths  — relative file paths of every scanned TSX/JSX file
 *   totalFiles — total files examined (including those with no components)
 *   warnings   — non-fatal diagnostic messages
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import fs from 'node:fs'
import path from 'node:path'
import type { ComponentEntry } from '../registryService.js'

// CJS/ESM interop — same pattern as MithrilLinter.ts and tailwindMigrator.ts
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── JSDoc extraction ──────────────────────────────────────────────────────────

const JSDOC_MAX_LENGTH = 500

/**
 * Given an AST node with optional `leadingComments`, extract the prose
 * description from the closest JSDoc block comment (`/** ... *\/`).
 *
 * Rules:
 *   - Only `CommentBlock` nodes whose value starts with `*` are JSDoc.
 *   - Uses the last such block (closest to the declaration).
 *   - Strips the leading `* ` / `*` prefix from each line.
 *   - Extracts only the first paragraph (stops at blank line or `@tag`).
 *   - Returns undefined when there is no prose.
 *   - Truncates at 500 chars, appending "..." when truncated.
 */
function extractJsDocDescription(node: t.Node): string | undefined {
    const comments = node.leadingComments
    if (!comments || comments.length === 0) return undefined

    // Find the last CommentBlock that looks like JSDoc (value starts with '*')
    let jsDocComment: { type: string; value: string } | undefined
    for (let i = comments.length - 1; i >= 0; i--) {
        const c = comments[i]
        if (c.type === 'CommentBlock' && c.value.startsWith('*')) {
            jsDocComment = c
            break
        }
    }

    if (!jsDocComment) return undefined

    // Split into lines, strip the leading `*` and whitespace from each
    const rawLines = jsDocComment.value.split('\n')
    const lines: string[] = rawLines.map(line => {
        // Strip leading whitespace + optional '*' + optional single space
        return line.replace(/^\s*\*\s?/, '').trimEnd()
    })

    // Collect prose lines until we hit a blank line or a @tag line
    const proseParts: string[] = []
    for (const line of lines) {
        if (line.startsWith('@')) break   // @param, @returns, etc.
        if (line === '' && proseParts.length > 0) break  // blank line = end of first paragraph
        if (line !== '') proseParts.push(line)
    }

    if (proseParts.length === 0) return undefined

    let description = proseParts.join(' ')

    if (description.length > JSDOC_MAX_LENGTH) {
        description = description.slice(0, JSDOC_MAX_LENGTH) + '...'
    }

    return description
}

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Result shape returned by indexComponents.
 *
 * The `components` map is keyed by component name (e.g. "Button") and
 * contains ComponentEntry values — matching the flint-manifest.json schema
 * that initRunner.ts writes out.
 *
 * `filePaths` holds the relative path (from projectRoot) of every file that
 * was actually scanned — even files that yielded no components.
 */
export interface ComponentIndexResult {
    /** Number of components found across all scanned files. */
    count: number
    /** Registry map — compatible with flint-manifest.json `components` field. */
    components: Record<string, ComponentEntry>
    /** Relative file paths of all scanned TSX/JSX source files. */
    filePaths: string[]
    /** Total number of files examined (including those with no components). */
    totalFiles: number
    /** Non-fatal diagnostic messages (parse errors, unreadable files, etc.). */
    warnings: string[]
}

// Re-export so callers can import the type from here without also pulling in
// registryService.
export type { ComponentEntry }

// ── Constants ─────────────────────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
    'node_modules',
    'dist',
    'build',
    '.next',
    'out',
    '__tests__',
    '.git',
])

const EXCLUDED_FILE_SUFFIXES = [
    '.test.tsx',
    '.test.jsx',
    '.test.ts',
    '.test.js',
    '.spec.tsx',
    '.spec.jsx',
    '.spec.ts',
    '.spec.js',
    '.stories.tsx',
    '.stories.jsx',
    '.stories.ts',
    '.stories.js',
    '.d.ts',
]

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Recursively discovers components under `srcDir` (or under `projectRoot`
 * when no srcDir is supplied).  Falls back to scanning the project root when
 * the default `src/` sub-directory doesn't exist.
 */
export async function indexComponents(
    projectRoot: string,
    srcDir?: string,
): Promise<ComponentIndexResult> {
    const warnings: string[] = []

    // Resolve the scan root
    let scanRoot: string
    if (srcDir) {
        scanRoot = path.isAbsolute(srcDir) ? srcDir : path.join(projectRoot, srcDir)
    } else {
        const defaultSrc = path.join(projectRoot, 'src')
        scanRoot = fs.existsSync(defaultSrc) ? defaultSrc : projectRoot
    }

    // Decide whether to produce `@/` import paths
    const usesAtAlias = detectAtAlias(projectRoot)

    // Gather all candidate files
    const files: string[] = []
    collectFiles(scanRoot, files)

    const componentsMap: Record<string, ComponentEntry> = {}
    const filePaths: string[] = []

    for (const filePath of files) {
        const relPath = path.relative(projectRoot, filePath)
        filePaths.push(relPath)

        let source: string
        try {
            source = fs.readFileSync(filePath, 'utf-8')
        } catch {
            warnings.push(`Could not read ${relPath} — skipped.`)
            continue
        }

        try {
            const found = extractComponents(source, filePath, projectRoot, usesAtAlias)
            for (const entry of found) {
                componentsMap[entry.name] = entry
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            warnings.push(`Parse error in ${relPath}: ${msg} — skipped.`)
        }
    }

    const count = Object.keys(componentsMap).length

    return {
        count,
        components: componentsMap,
        filePaths,
        totalFiles: files.length,
        warnings,
    }
}

// ── File discovery ────────────────────────────────────────────────────────────

function collectFiles(dir: string, results: string[]): void {
    let entries: fs.Dirent[]
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
        return
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            if (!EXCLUDED_DIRS.has(entry.name)) {
                collectFiles(fullPath, results)
            }
            continue
        }

        if (!entry.isFile()) continue

        const name = entry.name
        const isTsxOrJsx = name.endsWith('.tsx') || name.endsWith('.jsx')
        if (!isTsxOrJsx) continue

        if (EXCLUDED_FILE_SUFFIXES.some(suffix => name.endsWith(suffix))) continue

        results.push(fullPath)
    }
}

// ── Component extraction ──────────────────────────────────────────────────────

/**
 * Parse `source` and return all components found within it.
 */
function extractComponents(
    source: string,
    absoluteFilePath: string,
    projectRoot: string,
    usesAtAlias: boolean,
): ComponentEntry[] {
    const ast = parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        errorRecovery: true,
        attachComment: true,
    })

    // Build a map of top-level interface/type alias declarations so we can
    // resolve prop type references.
    const typeMap = buildTypeMap(ast)

    const results: ComponentEntry[] = []
    const relFilePath = path.relative(projectRoot, absoluteFilePath)

    // We track forward-ref patterns: `const Foo = React.forwardRef(...)`
    // followed later by `export default Foo`.
    const pendingForwardRefs = new Map<string, { props: PropInfo[]; description?: string }>()
    // Track `const Foo = ...` bindings for default-export-identifier pattern
    const constBindings = new Map<string, { props: PropInfo[]; isComponent: boolean; description?: string }>()

    traverse(ast, {
        // ── export default function ComponentName(...) ───────────────────────
        ExportDefaultDeclaration(nodePath) {
            const decl = nodePath.node.declaration
            const description = extractJsDocDescription(nodePath.node)

            if (t.isFunctionDeclaration(decl) || t.isArrowFunctionExpression(decl)) {
                const name =
                    t.isFunctionDeclaration(decl) && decl.id ? decl.id.name : null
                if (name && isComponentName(name)) {
                    const props = extractPropsFromFunction(decl, typeMap)
                    results.push(
                        makeEntry(name, relFilePath, props, projectRoot, usesAtAlias, description),
                    )
                }
                return
            }

            // export default <identifier>
            if (t.isIdentifier(decl)) {
                const name = decl.name
                if (!isComponentName(name)) return

                // Check if it was a forwardRef
                const pending = pendingForwardRefs.get(name)
                if (pending) {
                    // Prefer description from the export site; fall back to the const site
                    const resolvedDescription = description ?? pending.description
                    results.push(
                        makeEntry(name, relFilePath, pending.props, projectRoot, usesAtAlias, resolvedDescription),
                    )
                    pendingForwardRefs.delete(name)
                    return
                }

                // Check const binding
                const binding = constBindings.get(name)
                if (binding && binding.isComponent) {
                    const resolvedDescription = description ?? binding.description
                    results.push(
                        makeEntry(name, relFilePath, binding.props, projectRoot, usesAtAlias, resolvedDescription),
                    )
                }
            }
        },

        // ── export function ComponentName(...) ───────────────────────────────
        // ── export const ComponentName = (...) ──────────────────────────────
        ExportNamedDeclaration(nodePath) {
            const decl = nodePath.node.declaration
            if (!decl) return

            const description = extractJsDocDescription(nodePath.node)

            if (t.isFunctionDeclaration(decl)) {
                const name = decl.id?.name
                if (!name || !isComponentName(name)) return
                const props = extractPropsFromFunction(decl, typeMap)
                results.push(makeEntry(name, relFilePath, props, projectRoot, usesAtAlias, description))
                return
            }

            if (t.isVariableDeclaration(decl)) {
                for (const declarator of decl.declarations) {
                    if (!t.isIdentifier(declarator.id)) continue
                    const name = declarator.id.name
                    if (!isComponentName(name)) continue

                    const fn = declarator.init
                    if (!fn) continue

                    if (t.isArrowFunctionExpression(fn) || t.isFunctionExpression(fn)) {
                        const props = extractPropsFromFunction(fn, typeMap)
                        results.push(
                            makeEntry(name, relFilePath, props, projectRoot, usesAtAlias, description),
                        )
                    }
                }
            }
        },

        // ── const Foo = React.forwardRef(...) ────────────────────────────────
        // ── const Foo = (...) => <JSX> ──────────────────────────────────────
        VariableDeclaration(nodePath) {
            // Only process top-level declarations
            if (!t.isProgram(nodePath.parent)) return

            const description = extractJsDocDescription(nodePath.node)

            for (const declarator of nodePath.node.declarations) {
                if (!t.isIdentifier(declarator.id)) continue
                const name = declarator.id.name
                if (!isComponentName(name)) continue

                const init = declarator.init
                if (!init) continue

                // React.forwardRef(...)
                if (isForwardRefCall(init)) {
                    const inner = getForwardRefCallback(init)
                    const props = inner ? extractPropsFromFunction(inner, typeMap) : []
                    pendingForwardRefs.set(name, { props, description })
                    constBindings.set(name, { props, isComponent: true, description })
                    continue
                }

                // Arrow function or function expression
                if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
                    const props = extractPropsFromFunction(init, typeMap)
                    constBindings.set(name, { props, isComponent: true, description })
                }
            }
        },
    })

    return results
}

// ── AST helpers ───────────────────────────────────────────────────────────────

type FunctionNode =
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression

/**
 * Extract prop names from the first parameter of a function component.
 *
 * Handles two patterns:
 *   1. Destructuring pattern: `({ variant, size, children }: Props)`
 *   2. Named identifier: `(props: ButtonProps)` — resolved via typeMap
 */
function extractPropsFromFunction(
    fn: FunctionNode,
    typeMap: Map<string, PropInfo[]>,
): PropInfo[] {
    const firstParam = fn.params[0]
    if (!firstParam) return []

    // Pattern 1: destructuring `{ variant, size, children }`
    if (t.isObjectPattern(firstParam)) {
        return extractObjectPatternProps(firstParam, typeMap)
    }

    // Pattern 2: typed identifier — resolve via typeMap
    if (t.isIdentifier(firstParam)) {
        const annotation = firstParam.typeAnnotation
        if (t.isTSTypeAnnotation(annotation)) {
            const typeName = resolveTypeName(annotation.typeAnnotation)
            if (typeName) {
                return typeMap.get(typeName) ?? []
            }
        }
    }

    // Pattern 3: assignment pattern with object pattern default
    if (t.isAssignmentPattern(firstParam) && t.isObjectPattern(firstParam.left)) {
        return extractObjectPatternProps(firstParam.left, typeMap)
    }

    return []
}

function extractObjectPatternProps(
    pattern: t.ObjectPattern,
    typeMap: Map<string, PropInfo[]>,
): PropInfo[] {
    const props: PropInfo[] = []
    const seen = new Set<string>()

    // First: get typed info from the type annotation on the pattern
    if (pattern.typeAnnotation && t.isTSTypeAnnotation(pattern.typeAnnotation)) {
        const typeName = resolveTypeName(pattern.typeAnnotation.typeAnnotation)
        if (typeName) {
            const resolved = typeMap.get(typeName) ?? []
            for (const p of resolved) {
                props.push(p)
                seen.add(p.name)
            }
        }
    }

    // Then: fill in any destructured names not already covered by the type map
    for (const prop of pattern.properties) {
        if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            if (!seen.has(prop.key.name)) {
                props.push({ name: prop.key.name, type: 'unknown', required: false })
                seen.add(prop.key.name)
            }
        }
    }

    return props
}

/**
 * Return the string name of a TSType reference, if it's a plain identifier
 * (e.g. `Props`, `ButtonProps`).
 */
function resolveTypeName(typeNode: t.TSType): string | null {
    if (t.isTSTypeReference(typeNode)) {
        const typeName = typeNode.typeName
        if (t.isIdentifier(typeName)) return typeName.name
    }
    return null
}

/** Extracted prop info with type and optionality. */
interface PropInfo {
    name: string
    type: string
    required: boolean
}

/**
 * Extract type string from a TSPropertySignature's type annotation.
 * Returns a human-readable TypeScript type or 'unknown'.
 */
function extractPropType(member: t.TSPropertySignature): string {
    if (!member.typeAnnotation || !t.isTSTypeAnnotation(member.typeAnnotation)) return 'unknown'
    const tsType = member.typeAnnotation.typeAnnotation

    if (t.isTSStringKeyword(tsType)) return 'string'
    if (t.isTSNumberKeyword(tsType)) return 'number'
    if (t.isTSBooleanKeyword(tsType)) return 'boolean'
    if (t.isTSAnyKeyword(tsType)) return 'any'
    if (t.isTSVoidKeyword(tsType)) return 'void'
    if (t.isTSNullKeyword(tsType)) return 'null'
    if (t.isTSUndefinedKeyword(tsType)) return 'undefined'

    // Union types: 'primary' | 'secondary' → "'primary' | 'secondary'"
    if (t.isTSUnionType(tsType)) {
        const parts = tsType.types.map(u => {
            if (t.isTSLiteralType(u)) {
                if (t.isStringLiteral(u.literal)) return `'${u.literal.value}'`
                if (t.isNumericLiteral(u.literal)) return String(u.literal.value)
                if (t.isBooleanLiteral(u.literal)) return String(u.literal.value)
            }
            if (t.isTSStringKeyword(u)) return 'string'
            if (t.isTSNumberKeyword(u)) return 'number'
            if (t.isTSBooleanKeyword(u)) return 'boolean'
            if (t.isTSNullKeyword(u)) return 'null'
            if (t.isTSUndefinedKeyword(u)) return 'undefined'
            if (t.isTSTypeReference(u) && t.isIdentifier(u.typeName)) return u.typeName.name
            return 'unknown'
        })
        return parts.join(' | ')
    }

    // Type reference: React.ReactNode, HTMLElement, etc.
    if (t.isTSTypeReference(tsType)) {
        if (t.isIdentifier(tsType.typeName)) return tsType.typeName.name
        if (t.isTSQualifiedName(tsType.typeName)) {
            const left = t.isIdentifier(tsType.typeName.left) ? tsType.typeName.left.name : ''
            return `${left}.${tsType.typeName.right.name}`
        }
    }

    // Array types: string[], number[]
    if (t.isTSArrayType(tsType)) {
        if (t.isTSStringKeyword(tsType.elementType)) return 'string[]'
        if (t.isTSNumberKeyword(tsType.elementType)) return 'number[]'
        return 'unknown[]'
    }

    // Function types: () => void, (e: Event) => void
    if (t.isTSFunctionType(tsType)) return '(...args: any[]) => any'

    return 'unknown'
}

/**
 * Extract PropInfo[] from TSPropertySignature members.
 */
function extractPropInfos(members: t.TSTypeElement[]): PropInfo[] {
    return members
        .filter((m): m is t.TSPropertySignature => t.isTSPropertySignature(m) && t.isIdentifier(m.key))
        .map(m => ({
            name: (m.key as t.Identifier).name,
            type: extractPropType(m),
            required: !m.optional,
        }))
}

/**
 * Build a map from interface/type-alias name → PropInfo[] for all
 * top-level declarations in the file.
 */
function buildTypeMap(ast: t.File): Map<string, PropInfo[]> {
    const map = new Map<string, PropInfo[]>()

    for (const node of ast.program.body) {
        if (t.isTSInterfaceDeclaration(node)) {
            map.set(node.id.name, extractPropInfos(node.body.body))
            continue
        }

        if (t.isTSTypeAliasDeclaration(node) && t.isTSTypeLiteral(node.typeAnnotation)) {
            map.set(node.id.name, extractPropInfos(node.typeAnnotation.members))
        }

        if (t.isExportNamedDeclaration(node) && node.declaration) {
            const inner = node.declaration
            if (t.isTSInterfaceDeclaration(inner)) {
                map.set(inner.id.name, extractPropInfos(inner.body.body))
            } else if (t.isTSTypeAliasDeclaration(inner) && t.isTSTypeLiteral(inner.typeAnnotation)) {
                map.set(inner.id.name, extractPropInfos(inner.typeAnnotation.members))
            }
        }
    }

    return map
}

function isForwardRefCall(node: t.Expression): boolean {
    // React.forwardRef(...)
    if (
        t.isCallExpression(node) &&
        t.isMemberExpression(node.callee) &&
        t.isIdentifier(node.callee.object, { name: 'React' }) &&
        t.isIdentifier(node.callee.property, { name: 'forwardRef' })
    ) {
        return true
    }
    // forwardRef(...)
    if (
        t.isCallExpression(node) &&
        t.isIdentifier(node.callee, { name: 'forwardRef' })
    ) {
        return true
    }
    return false
}

function getForwardRefCallback(node: t.Expression): FunctionNode | null {
    if (!t.isCallExpression(node)) return null
    const arg = node.arguments[0]
    if (!arg) return null
    if (t.isFunctionExpression(arg) || t.isArrowFunctionExpression(arg)) {
        return arg
    }
    return null
}

function isComponentName(name: string): boolean {
    return name.length > 0 && name[0] === name[0].toUpperCase() && name[0] !== '_'
}

// ── Import path builder ───────────────────────────────────────────────────────

/**
 * Build a ComponentEntry that is compatible with the registryService schema.
 * The `props` field on ComponentEntry is `Record<string, PropDefinition>` — we
 * store only the prop names here (with a minimal placeholder PropDefinition)
 * since we don't do full type inference at index time.
 */
function makeEntry(
    name: string,
    relFilePath: string,
    propInfos: PropInfo[],
    projectRoot: string,
    usesAtAlias: boolean,
    description?: string,
): ComponentEntry {
    const importPath = buildImportPath(relFilePath, projectRoot, usesAtAlias)

    const props: ComponentEntry['props'] = {}
    for (const pi of propInfos) {
        props[pi.name] = { type: pi.type, required: pi.required }
    }

    const entry: ComponentEntry = {
        name,
        importPath,
        props,
    }

    if (description !== undefined) {
        entry.description = description
    }

    return entry
}

function buildImportPath(
    relFilePath: string,
    _projectRoot: string,
    usesAtAlias: boolean,
): string {
    // Strip file extension
    const withoutExt = relFilePath.replace(/\.(tsx|jsx|ts|js)$/, '')

    if (usesAtAlias && (withoutExt.startsWith('src/') || withoutExt.startsWith('src\\'))) {
        // Replace `src/` prefix with `@/`
        return '@/' + withoutExt.slice('src/'.length)
    }

    // Relative path from project root — prefix with `./`
    return './' + withoutExt
}

/**
 * Returns true when `tsconfig.json` in projectRoot contains a paths alias
 * for `@/*` pointing at `src/*`.
 */
function detectAtAlias(projectRoot: string): boolean {
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
    if (!fs.existsSync(tsconfigPath)) return false

    try {
        const raw = fs.readFileSync(tsconfigPath, 'utf-8')
        const cfg = JSON.parse(raw) as Record<string, unknown>
        const paths = (cfg.compilerOptions as Record<string, unknown> | undefined)?.paths as
            | Record<string, unknown>
            | undefined
        if (!paths) return false
        return '@/*' in paths
    } catch {
        return false
    }
}
