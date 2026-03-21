/**
 * DBOM Generator — flint-mcp/src/core/dbom/generator.ts
 *
 * Generates a Design Bill of Materials (DBOM) for a Flint project by:
 *   1. Reading .flint/policy.json for active governance settings.
 *   2. Reading .flint/design-tokens.json for the token inventory.
 *   3. Scanning all .tsx/.ts files under the project's src/ directory.
 *   4. For each file: parsing with Babel, running MithrilLinter + A11yLinter.
 *   5. Counting token usage by scanning className strings.
 *   6. Computing tokenCoverage per component.
 *   7. Computing overall health score, grade, and compliance status.
 *   8. Reading .flint/violation_baselines if a baseline exists.
 *   9. Assembling and returning the complete DBOM.
 *
 * This module runs in the MCP server process (Node.js) and MUST NOT be
 * imported anywhere inside src/ (process boundary law).
 */

import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import { auditAll } from '../MithrilLinter.js'
import { A11yLinter } from '../A11yLinter.js'
import { loadPolicy } from '../config-loader.js'
import { computeHealthScore, scoreToGrade } from '../dashboard/debtReportService.js'
import type { DesignToken } from '../../types.js'
import type {
    DesignBillOfMaterials,
    DBOMToken,
    DBOMComponent,
    DBOMViolation,
    DBOMA11yViolation,
    DBOMOverride,
    DBOMBaseline,
} from './types.js'

// CJS/ESM interop for @babel/traverse
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Glob helper (mirrors debtReportService pattern) ──────────────────────────

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'dist-electron', '.git', '.flint', 'coverage', 'out', 'build'])

/**
 * Converts a glob pattern string to a RegExp.
 *
 * Supported syntax:
 *   **   — matches any number of path segments (including zero)
 *   *    — matches any characters within a single path segment (no slashes)
 *   ?    — matches exactly one character (not a slash)
 *
 * All other regex metacharacters in the input are escaped.
 * Matching is done against the POSIX-normalised relative path from projectRoot.
 */
function globToRegex(pattern: string): RegExp {
    // Normalise Windows separators in the pattern itself
    const normalised = pattern.replace(/\\/g, '/')
    let regexStr = ''
    let i = 0
    while (i < normalised.length) {
        if (normalised[i] === '*' && normalised[i + 1] === '*') {
            // ** — matches any path segment sequence (greedy)
            regexStr += '.*'
            i += 2
            // Consume an optional trailing slash after **
            if (normalised[i] === '/') i++
        } else if (normalised[i] === '*') {
            // * — matches anything except a slash
            regexStr += '[^/]*'
            i++
        } else if (normalised[i] === '?') {
            // ? — matches exactly one non-slash character
            regexStr += '[^/]'
            i++
        } else {
            // Escape regex metacharacters
            regexStr += normalised[i].replace(/[.+^${}()|[\]\\]/g, '\\$&')
            i++
        }
    }
    return new RegExp(`^${regexStr}$`)
}

/**
 * Filters an array of absolute file paths against a glob pattern.
 * The pattern is matched against the relative path from projectRoot
 * (using forward slashes regardless of platform).
 *
 * @param files        Absolute file paths to filter.
 * @param projectRoot  Project root used to compute relative paths.
 * @param glob         Glob pattern (e.g. "demos/**\/*.tsx").
 * @returns            Files whose relative path matches the pattern.
 */
function filterByGlob(files: string[], projectRoot: string, glob: string): string[] {
    const regex = globToRegex(glob)
    return files.filter((f) => {
        const rel = path.relative(projectRoot, f).replace(/\\/g, '/')
        return regex.test(rel)
    })
}

function findFiles(rootDir: string, extensions: string[]): string[] {
    const results: string[] = []
    const extSet = new Set(extensions)

    function walk(dir: string): void {
        let entries: fs.Dirent[]
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
            return
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
                walk(path.join(dir, entry.name))
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name)
                if (extSet.has(ext)) {
                    results.push(path.join(dir, entry.name))
                }
            }
        }
    }

    walk(rootDir)
    return results.sort()
}

// ── Token loading ─────────────────────────────────────────────────────────────

function loadTokens(projectRoot: string): DesignToken[] {
    const tokensPath = path.join(projectRoot, '.flint', 'design-tokens.json')
    if (!fs.existsSync(tokensPath)) return []
    try {
        const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
        return Array.isArray(raw) ? raw : Object.values(raw)
    } catch {
        return []
    }
}

// ── Token coverage analysis ───────────────────────────────────────────────────

/**
 * Arbitrary CSS value patterns that indicate a class is NOT a token-derived class.
 * These are the Tailwind arbitrary value syntaxes: [value] brackets.
 */
const ARBITRARY_VALUE_RE = /\[.+?\]/

/**
 * Extracts all className strings from a parsed Babel AST.
 * Returns an array of class-string-per-element arrays.
 */
function extractClassStrings(ast: t.File): string[][] {
    const results: string[][] = []

    traverse(ast, {
        JSXAttribute(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'className' })) return
            const valNode = path.node.value
            let classStr: string | null = null
            if (t.isStringLiteral(valNode)) {
                classStr = valNode.value
            } else if (
                t.isJSXExpressionContainer(valNode) &&
                t.isStringLiteral(valNode.expression)
            ) {
                classStr = valNode.expression.value
            }
            if (classStr !== null && classStr.trim().length > 0) {
                results.push(classStr.trim().split(/\s+/).filter(Boolean))
            }
        },
    })

    return results
}

/**
 * Computes token coverage for a single component file.
 *
 * Coverage = (token classes / total classes) * 100
 * A "token class" is any Tailwind class that does NOT use an arbitrary value
 * (i.e., does not contain square brackets). This is a heuristic: classes like
 * `bg-blue-500` (design-system scale) are counted as "token", while
 * `bg-[#1A73E8]` or `text-[16px]` are counted as "arbitrary".
 *
 * Returns 100.0 when there are no classes (nothing to violate).
 */
function computeTokenCoverage(classStrings: string[][]): number {
    let totalClasses = 0
    let tokenClasses = 0

    for (const classes of classStrings) {
        for (const cls of classes) {
            totalClasses++
            // Strip responsive/state prefixes (e.g. 'md:', 'hover:') before checking
            const stripped = cls.replace(/^(?:[\w-]+:)+/, '')
            if (!ARBITRARY_VALUE_RE.test(stripped)) {
                tokenClasses++
            }
        }
    }

    if (totalClasses === 0) return 100.0
    return Math.round((tokenClasses / totalClasses) * 1000) / 10
}

// ── Token usage tracking ──────────────────────────────────────────────────────

/**
 * Builds a token-path to value map for fast lookup.
 * Also computes a set of "tokenized class segments" — the tail segments of token
 * paths that can appear in Tailwind class names (e.g. 'primary-500' from
 * 'colors.brand.primary-500').
 */
function buildTokenClassIndex(tokens: DesignToken[]): Map<string, DesignToken> {
    const index = new Map<string, DesignToken>()
    for (const token of tokens) {
        index.set(token.token_path, token)
    }
    return index
}

/**
 * Detects whether any class in a set of className strings references a given
 * token by value or path segment. This is a best-effort heuristic — it checks
 * if the token value (e.g. '#1A73E8') appears as an arbitrary value, or if
 * a token path segment appears as part of a Tailwind scale class.
 *
 * We rely on exact value matching for arbitrary classes (e.g. `bg-[#1A73E8]`)
 * and do not attempt to resolve Tailwind scale names to token values because
 * that requires a full Tailwind config parse.
 */
function classesReferenceToken(allClassStrings: string[][], token: DesignToken): boolean {
    const tokenVal = token.token_value.toLowerCase()
    const tokenPathTail = token.token_path.split('.').pop()?.toLowerCase() ?? ''

    for (const classes of allClassStrings) {
        for (const cls of classes) {
            const lower = cls.toLowerCase()
            // Exact arbitrary value match: e.g. bg-[#1a73e8] with token value #1a73e8
            if (lower.includes(`[${tokenVal}]`)) return true
            // Path tail match: e.g. class 'brand-primary-500' with token path tail 'primary-500'
            if (tokenPathTail.length > 3 && lower.includes(tokenPathTail)) return true
        }
    }
    return false
}

// ── Component name inference ──────────────────────────────────────────────────

/**
 * Infers the component name from a file path.
 * Converts the basename (without extension) to PascalCase.
 * E.g. 'src/components/hero-section.tsx' → 'HeroSection'
 */
function inferComponentName(filePath: string): string {
    const base = path.basename(filePath, path.extname(filePath))
    return base
        .split(/[-_\s]+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
}

// ── Baseline reading ──────────────────────────────────────────────────────────

interface BaselineEntry {
    file_path: string
    node_id: string
    rule_id: string
    severity: string
    snapshot_value: string | null
    created_at?: number
}

/**
 * Reads violation baselines from .flint/violation_baselines.json.
 * Returns null if no baseline file exists.
 *
 * The baseline file format mirrors what the Glass baseline API writes:
 * an array of BaselineEntry objects.
 */
function readViolationBaselines(projectRoot: string): BaselineEntry[] | null {
    // Support two naming conventions used across the codebase
    const candidates = [
        path.join(projectRoot, '.flint', 'violation_baselines.json'),
        path.join(projectRoot, '.flint', 'violation-baselines.json'),
    ]

    for (const baselinePath of candidates) {
        if (fs.existsSync(baselinePath)) {
            try {
                const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
                if (Array.isArray(raw)) return raw as BaselineEntry[]
            } catch {
                // Corrupt baseline — treat as absent
            }
        }
    }
    return null
}

/**
 * Reads the baseline timestamp from .flint/violation-baseline-meta.json.
 * Returns null when no metadata file exists.
 */
function readBaselineMeta(projectRoot: string): { setAt: string } | null {
    const metaPath = path.join(projectRoot, '.flint', 'violation-baseline-meta.json')
    if (!fs.existsSync(metaPath)) return null
    try {
        const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        if (typeof raw?.setAt === 'string') return { setAt: raw.setAt }
    } catch {
        // ignore
    }
    return null
}

// ── DBOM generator ────────────────────────────────────────────────────────────

/**
 * Generates a Design Bill of Materials for the given project root.
 *
 * @param projectRoot  Absolute path to the project root.
 * @param glob         Optional glob pattern to restrict which files are scanned
 *                     (matched against the relative path from projectRoot).
 *                     When omitted, all TSX/TS files under src/ are scanned.
 * @returns            A fully assembled DesignBillOfMaterials object.
 */
export async function generateDBOM(projectRoot: string, glob?: string): Promise<DesignBillOfMaterials> {
    const generatedAt = new Date().toISOString()

    // ── 1. Policy ──────────────────────────────────────────────────────────────
    const policy = loadPolicy(projectRoot)
    const dbomPolicy = {
        deltaE_threshold: policy.mithril.deltaE_threshold,
        a11y_level: policy.a11y.level,
        mode: policy.mithril.mode,
    }

    // ── 2. Tokens ──────────────────────────────────────────────────────────────
    const tokens = loadTokens(projectRoot)
    const tokenIndex = buildTokenClassIndex(tokens)

    // ── 3. Discover source files ───────────────────────────────────────────────
    // Scan src/ if it exists; fall back to projectRoot itself.
    // When a glob is provided, scan the whole projectRoot so the glob can reach
    // any subdirectory (e.g. "demos/**/*.tsx"), then apply the glob filter.
    // Without a glob, keep the original behaviour of restricting to src/.
    let sourceFiles: string[]
    if (glob) {
        const allFiles = findFiles(projectRoot, ['.tsx', '.ts'])
        sourceFiles = filterByGlob(allFiles, projectRoot, glob)
    } else {
        const srcDir = path.join(projectRoot, 'src')
        const scanRoot = fs.existsSync(srcDir) ? srcDir : projectRoot
        sourceFiles = findFiles(scanRoot, ['.tsx', '.ts'])
    }

    // ── 4-6. Per-file analysis ─────────────────────────────────────────────────
    const components: DBOMComponent[] = []

    // Accumulate token usage data: token_path → set of relative file paths
    const tokenUsageMap = new Map<string, Set<string>>(
        tokens.map((tok) => [tok.token_path, new Set<string>()]),
    )

    // Severity accumulators for health score
    let totalCriticals = 0
    let totalWarnings = 0

    // Policy options for MithrilLinter
    const policyOptions = {
        deltaE_threshold: policy.mithril.deltaE_threshold,
        deltaE_critical_threshold: policy.mithril.deltaE_critical_threshold,
    }

    for (const filePath of sourceFiles) {
        let source: string
        try {
            source = fs.readFileSync(filePath, 'utf-8')
        } catch {
            continue
        }

        let ast: t.File
        try {
            ast = parse(source, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            }) as t.File
        } catch {
            // Unparseable files are silently skipped — not a governance violation
            continue
        }

        const relativePath = path.relative(projectRoot, filePath)

        // Extract all className strings from this file
        const classStrings = extractClassStrings(ast)

        // Token coverage
        const tokenCoverage = computeTokenCoverage(classStrings)

        // Token usage attribution
        for (const [tokenPath] of tokenIndex) {
            const token = tokenIndex.get(tokenPath)!
            if (classesReferenceToken(classStrings, token)) {
                tokenUsageMap.get(tokenPath)?.add(relativePath)
            }
        }

        // Mithril linting
        const violations: DBOMViolation[] = []
        if (policy.mithril.mode !== 'off') {
            const mithrilWarnings = auditAll(ast as any, tokens, policyOptions)
            for (const [nodeId, warning] of mithrilWarnings) {
                violations.push({
                    ruleId: warning.ruleId ?? extractRuleId(warning.message),
                    severity: warning.severity,
                    message: warning.message,
                    nodeId,
                })
                if (warning.severity === 'critical') totalCriticals++
                else totalWarnings++
            }
        }

        // A11y linting
        const a11yViolations: DBOMA11yViolation[] = []
        if (policy.a11y.mode !== 'off') {
            const a11yResult = A11yLinter.auditStructured(ast as any, filePath)
            for (const v of a11yResult.violations) {
                a11yViolations.push({
                    ruleId: v.ruleId,
                    message: v.message,
                })
                // A11y violations are always critical (Commandment 5)
                totalCriticals++
            }
        }

        // Component status
        let status: DBOMComponent['status'] = 'clean'
        if (a11yViolations.length > 0 || violations.some((v) => v.severity === 'critical')) {
            status = 'critical'
        } else if (violations.length > 0) {
            status = 'warning'
        }

        components.push({
            filePath,
            name: inferComponentName(filePath),
            violations,
            a11yViolations,
            tokenCoverage,
            status,
        })
    }

    // ── 7. Health score + grade + compliance status ────────────────────────────
    const healthScore = computeHealthScore(totalCriticals, totalWarnings, 0)
    const grade = scoreToGrade(healthScore)

    let complianceStatus: 'compliant' | 'non-compliant' | 'partial'
    if (totalCriticals === 0 && totalWarnings === 0) {
        complianceStatus = 'compliant'
    } else if (totalCriticals > 0) {
        complianceStatus = 'non-compliant'
    } else {
        complianceStatus = 'partial'
    }

    // ── Build DBOMToken array ──────────────────────────────────────────────────
    const dbomTokens: DBOMToken[] = tokens.map((token) => {
        const usedInSet = tokenUsageMap.get(token.token_path) ?? new Set<string>()
        return {
            path: token.token_path,
            type: token.token_type,
            value: token.token_value,
            collection: token.collection_name ?? 'default',
            usageCount: usedInSet.size,
            usedIn: Array.from(usedInSet).sort(),
        }
    })

    // ── Build DBOMOverride array ───────────────────────────────────────────────
    const dbomOverrides: DBOMOverride[] = readOverrides(projectRoot)

    // ── 8. Baseline ────────────────────────────────────────────────────────────
    let baseline: DBOMBaseline | undefined
    const baselineEntries = readViolationBaselines(projectRoot)
    if (baselineEntries !== null) {
        const baselineMeta = readBaselineMeta(projectRoot)
        const violationsAtBaseline = baselineEntries.length
        const currentTotal = totalCriticals + totalWarnings
        baseline = {
            setAt: baselineMeta?.setAt ?? new Date(0).toISOString(),
            violationsAtBaseline,
            newViolationsSinceBaseline: currentTotal - violationsAtBaseline,
        }
    }

    // ── 9. Assemble and return ─────────────────────────────────────────────────
    const dbom: DesignBillOfMaterials = {
        version: '1.0',
        generatedAt,
        projectRoot,
        policy: dbomPolicy,
        summary: {
            totalFiles: sourceFiles.length,
            totalComponents: components.length,
            totalTokens: tokens.length,
            healthScore,
            grade,
            complianceStatus,
        },
        tokens: dbomTokens,
        components,
        overrides: dbomOverrides,
        ...(baseline !== undefined ? { baseline } : {}),
    }

    return dbom
}

// ── Overrides reader ──────────────────────────────────────────────────────────

/**
 * Reads active component_overrides from .flint/overrides.json.
 * Returns an empty array when the file does not exist.
 *
 * The overrides file is written by the Glass baseline:set IPC handler
 * and mirrors the component_overrides SQLite table shape.
 */
function readOverrides(projectRoot: string): DBOMOverride[] {
    const overridesPath = path.join(projectRoot, '.flint', 'overrides.json')
    if (!fs.existsSync(overridesPath)) return []
    try {
        const raw = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'))
        if (!Array.isArray(raw)) return []
        return raw
            .filter(
                (r): r is { flint_id: string; property_key: string; property_value: string } =>
                    typeof r?.flint_id === 'string' &&
                    typeof r?.property_key === 'string' &&
                    typeof r?.property_value === 'string',
            )
            .map((r) => ({
                nodeId: r.flint_id,
                property: r.property_key,
                value: r.property_value.slice(0, 255),
            }))
    } catch {
        return []
    }
}

// ── Rule ID extractor ─────────────────────────────────────────────────────────

function extractRuleId(message: string): string {
    const match = /^((?:MITHRIL-[A-Z]+-?\d*|A11Y-\d+))/.exec(message)
    return match?.[1] ?? 'UNKNOWN'
}
