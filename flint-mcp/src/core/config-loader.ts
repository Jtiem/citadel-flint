/**
 * Config Loader — flint-mcp/src/core/config-loader.ts
 *
 * Resolves the project root directory and loads the Flint configuration.
 *
 * Resolution priority for project root:
 *   1. --project-root <path> CLI argument
 *   2. FLINT_PROJECT_ROOT environment variable
 *   3. process.cwd() fallback
 *
 * Configuration resolution (UCFG.1):
 *   1. Check for flint.config.yaml at project root (unified YAML config)
 *   2. Fall back to .flint/policy.json (legacy JSON config)
 *   3. Fall back to DEFAULT_POLICY when neither exists
 *
 * The YAML config is parsed into FlintProjectConfig, then mapped to
 * FlintPolicy via projectConfigToPolicy(). All downstream consumers
 * receive the same FlintConfig shape they always have.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import type { FlintConfig, FlintPolicy, FlintProjectConfig, RuleMode } from './config.js'
import { DEFAULT_POLICY, projectConfigToPolicy } from './config.js'
import { validateProjectConfig } from './configValidator.js'
import { resolveRegistryRef } from './registryResolver.js'

// ── Config loader options + sandbox errors (Sprint 3) ──────────────────────

/**
 * Options bag for loadConfig / loadYamlConfig. `strict: true` promotes
 * validation warnings to thrown errors (used by flint-ci). Default is
 * permissive to preserve existing runtime behavior.
 *
 * MAJOR-2 fix (Sprint 3).
 */
export interface ConfigLoaderOptions {
    /** Fail loudly on any validateProjectConfig error. Default: false. */
    strict?: boolean
    /** Optional project root override. */
    projectRoot?: string
}

/**
 * Thrown when an `extends` path attempts to resolve outside the project root
 * (path traversal) or to an unsanctioned absolute path outside PRESETS_DIR.
 *
 * MAJOR-3 fix (Sprint 3) — closes a filesystem bypass where user YAML could
 * drag arbitrary host files into the config merge.
 */
export class ConfigPathSandboxError extends Error {
    readonly code = 'FLINT_CONFIG_PATH_SANDBOX' as const
    constructor(
        readonly attemptedRef: string,
        readonly resolvedPath: string
    ) {
        super(
            `[Flint Config] extends path '${attemptedRef}' resolves outside projectRoot: ${resolvedPath}`
        )
        this.name = 'ConfigPathSandboxError'
    }
}

/**
 * Thrown from strict mode when validateProjectConfig returns errors.
 * MAJOR-2 fix (Sprint 3).
 */
export class ConfigValidationError extends Error {
    readonly code = 'FLINT_CONFIG_VALIDATION' as const
    constructor(readonly errors: Array<{ path: string; message: string }>) {
        super(
            `[Flint Config] validation failed:\n` +
            errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n')
        )
        this.name = 'ConfigValidationError'
    }
}

/**
 * Redacts common secret patterns from strings before they hit logs or the
 * config-events ledger. SEC-3 (Sprint 3 polish) — YAML parse errors may
 * include a source excerpt near the syntax break; if a secret is adjacent
 * to the break it would otherwise leak.
 *
 * Patterns redacted:
 *   - Long hex/base64 tokens (>= 20 chars of [A-Za-z0-9_\-+/=])
 *   - Values following `api_key:`, `token:`, `secret:`, `password:`, `bearer`
 *   - Values inside quotes that match the token shape
 */
export function redactSecrets(input: string): string {
    let out = input
    // 1. Match key: value patterns (yaml or json-ish). Exclude `[`/`]` so a
    //    prior `[REDACTED]` marker isn't re-matched on a second pass.
    out = out.replace(
        /(api[_-]?key|token|secret|password|authorization|bearer)([\s:=]+["']?)(?!\[REDACTED\])([^\s"',}\]\[]+)/gi,
        (_m, key: string, sep: string) => `${key}${sep}[REDACTED]`
    )
    // 2. Match standalone long opaque tokens (>= 20 chars)
    out = out.replace(/\b[A-Za-z0-9_\-+/=]{20,}\b/g, '[REDACTED]')
    return out
}

/**
 * Emits a structured config-loader event to `.flint/ledger/config-events.jsonl`.
 * MINOR-8 fix (Sprint 3). Best-effort — never throws.
 */
function emitConfigEvent(
    projectRoot: string,
    event: { type: string; path?: string; message: string; timestamp?: string }
): void {
    try {
        const ledgerDir = path.join(projectRoot, '.flint', 'ledger')
        if (!fs.existsSync(ledgerDir)) {
            fs.mkdirSync(ledgerDir, { recursive: true })
        }
        const line = JSON.stringify({
            timestamp: new Date().toISOString(),
            ...event,
        }) + '\n'
        fs.appendFileSync(path.join(ledgerDir, 'config-events.jsonl'), line, 'utf-8')
    } catch {
        // ledger is best-effort — never block config loading
    }
}

// ── Presets directory resolution ────────────────────────────────────────────
// Works from both src/ (dev/vitest) and dist/ (production).
const __filename_ = fileURLToPath(import.meta.url)
const PACKAGE_ROOT = path.resolve(path.dirname(__filename_), '..', '..')
const PRESETS_DIR = path.join(PACKAGE_ROOT, 'presets')

// ── Project root resolution ─────────────────────────────────────────────────

/**
 * Resolves the project root directory from CLI args, env, or cwd.
 */
export function resolveProjectRoot(): string {
    // 1. CLI argument: --project-root <path>
    const args = process.argv
    const rootArgIdx = args.indexOf('--project-root')
    if (rootArgIdx !== -1 && rootArgIdx + 1 < args.length) {
        const rootArg = args[rootArgIdx + 1]
        if (rootArg && fs.existsSync(rootArg)) {
            return path.resolve(rootArg)
        }
    }

    // 2. Environment variable
    const envRoot = process.env.FLINT_PROJECT_ROOT
    if (envRoot && fs.existsSync(envRoot)) {
        return path.resolve(envRoot)
    }

    // 3. Fallback to cwd
    return process.cwd()
}

// ── YAML config loading (UCFG.1) ───────────────────────────────────────────

/**
 * Attempts to load and parse flint.config.yaml from the project root.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function loadYamlConfig(
    projectRoot: string,
    options?: ConfigLoaderOptions
): FlintProjectConfig | null {
    const strict = options?.strict === true
    const yamlPath = path.join(projectRoot, 'flint.config.yaml')

    if (!fs.existsSync(yamlPath)) {
        return null
    }

    let parsed: unknown
    try {
        const raw = fs.readFileSync(yamlPath, 'utf-8')
        parsed = parseYaml(raw)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // SEC-3 (Sprint 3 polish) — redact secret-looking tokens from parse-error
        // messages before logging. YAML parsers often include a source excerpt
        // near the syntax error; if a secret sits adjacent to the break it could
        // leak to console + ledger. Policy: flint.config.yaml should not contain
        // secrets, but we redact defensively.
        const redactedMsg = redactSecrets(msg)
        // MINOR-8: structured config-validation event
        emitConfigEvent(projectRoot, {
            type: 'yaml_parse_error',
            path: yamlPath,
            message: redactedMsg,
        })
        console.error('[Flint Config] Failed to parse flint.config.yaml:', redactedMsg)
        if (strict) {
            throw new ConfigValidationError([
                { path: 'flint.config.yaml', message: `YAML parse error: ${redactedMsg}` },
            ])
        }
        return null
    }

    if (!parsed || typeof parsed !== 'object') {
        console.error('[Flint Config] flint.config.yaml is empty or invalid, skipping')
        emitConfigEvent(projectRoot, {
            type: 'yaml_empty_or_invalid',
            path: yamlPath,
            message: 'File parsed to null or non-object',
        })
        if (strict) {
            throw new ConfigValidationError([
                { path: 'flint.config.yaml', message: 'Config is empty or not an object' },
            ])
        }
        return null
    }

    const config = parsed as FlintProjectConfig

    // Validate: 'project' is the only required field
    if (!config.project || typeof config.project !== 'string') {
        const msg = 'flint.config.yaml missing required "project" field'
        console.error(`[Flint Config] ${msg}, skipping`)
        if (strict) {
            throw new ConfigValidationError([{ path: 'project', message: msg }])
        }
        return null
    }

    // Run full structural validation — log warnings, or throw in strict mode
    const validationErrors = validateProjectConfig(parsed)
    if (validationErrors.length > 0) {
        if (strict) {
            throw new ConfigValidationError(
                validationErrors.map((e) => ({ path: e.path, message: e.message }))
            )
        }
        console.warn(
            `[Flint Config] flint.config.yaml has ${validationErrors.length} validation warning(s):\n` +
                validationErrors
                    .map((e) => `  - ${e.path}: ${e.message}`)
                    .join('\n')
        )
    }

    return config
}

/**
 * Resolves the active environment overlay from FLINT_ENV.
 * Merges the overlay into the base config (shallow per-section merge).
 */
export function applyEnvironmentOverlay(config: FlintProjectConfig): FlintProjectConfig {
    const env = process.env.FLINT_ENV
    if (!env || !config.environments || !config.environments[env]) {
        return config
    }

    const overlay = config.environments[env]

    // Deep merge: overlay sections override base sections
    return {
        ...config,
        rules: overlay.rules
            ? {
                  ...config.rules,
                  mithril: { ...config.rules?.mithril, ...overlay.rules?.mithril },
                  accessibility: {
                      ...config.rules?.accessibility,
                      ...overlay.rules?.accessibility,
                  },
                  export_gate: { ...config.rules?.export_gate, ...overlay.rules?.export_gate },
                  baseline: { ...config.rules?.baseline, ...overlay.rules?.baseline },
              }
            : config.rules,
        trust: overlay.trust
            ? {
                  ...config.trust,
                  ...overlay.trust,
              }
            : config.trust,
        // Strip environments from resolved config
        environments: undefined,
    }
}

// ── Profile merge helper (Sprint 3, MINOR-2) ──────────────────────────────

/**
 * Deep-merges two trust.profiles arrays by profile `id`. Child profiles
 * override parent profiles with the same id (field-by-field merge); profiles
 * unique to either side are preserved.
 */
function mergeProfilesById(
    base: import('./config.js').YamlAgentProfile[] | undefined,
    override: import('./config.js').YamlAgentProfile[] | undefined
): import('./config.js').YamlAgentProfile[] | undefined {
    if (!base && !override) return undefined
    if (!base) return override
    if (!override) return base

    const byId = new Map<string, import('./config.js').YamlAgentProfile>()
    for (const p of base) {
        if (p && typeof p.id === 'string') byId.set(p.id, { ...p })
    }
    for (const p of override) {
        if (p && typeof p.id === 'string') {
            const existing = byId.get(p.id)
            byId.set(p.id, existing ? { ...existing, ...p } : { ...p })
        }
    }
    return Array.from(byId.values())
}

// ── Deep merge (UCFG.2) ────────────────────────────────────────────────────

/**
 * Deep-merges two FlintProjectConfig objects. `override` wins for scalar values.
 * Nested objects are merged per-section. Arrays are replaced, not concatenated.
 */
export function deepMergeConfigs(
    base: FlintProjectConfig,
    override: Partial<FlintProjectConfig>
): FlintProjectConfig {
    const merged: FlintProjectConfig = { ...base }

    // Scalars — override wins
    if (override.project) merged.project = override.project
    if (override.domain) merged.domain = override.domain
    if (override.classification) merged.classification = override.classification
    if (override.schema_version) merged.schema_version = override.schema_version
    if (override.tighten_only !== undefined) merged.tighten_only = override.tighten_only

    // Labels — merge
    if (override.labels) merged.labels = { ...base.labels, ...override.labels }

    // Extends — override replaces (extends don't stack across layers)
    if (override.extends) merged.extends = override.extends

    // Tokens — per-field merge
    if (override.tokens) {
        merged.tokens = {
            ...base.tokens,
            ...override.tokens,
            figma: { ...base.tokens?.figma, ...override.tokens?.figma },
        }
    }

    // Rules — per-subsection merge
    if (override.rules) {
        merged.rules = {
            ...base.rules,
            mithril: { ...base.rules?.mithril, ...override.rules?.mithril },
            accessibility: { ...base.rules?.accessibility, ...override.rules?.accessibility },
            export_gate: { ...base.rules?.export_gate, ...override.rules?.export_gate },
            baseline: { ...base.rules?.baseline, ...override.rules?.baseline },
            policies: override.rules?.policies ?? base.rules?.policies,
        }
    }

    // Scoring — per-field merge
    if (override.scoring) {
        merged.scoring = {
            weights: { ...base.scoring?.weights, ...override.scoring?.weights },
            presets: { ...base.scoring?.presets, ...override.scoring?.presets },
        }
    }

    // Trust — deep merge profiles by id (MINOR-2 fix, Sprint 3).
    // Previously override.profiles replaced the entire base array, so any
    // child config that defined a single profile would nuke the parent's list.
    if (override.trust) {
        merged.trust = {
            ...base.trust,
            ...override.trust,
            profiles: mergeProfilesById(base.trust?.profiles, override.trust?.profiles),
            approval: override.trust?.approval ?? base.trust?.approval,
            escalation: override.trust?.escalation ?? base.trust?.escalation,
            promotion: { ...base.trust?.promotion, ...override.trust?.promotion },
        }
    }

    // Enforcement, review, content, audit — override wins
    if (override.enforcement) merged.enforcement = { ...base.enforcement, ...override.enforcement }
    if (override.review) merged.review = override.review
    if (override.content) merged.content = override.content
    if (override.audit) merged.audit = { ...base.audit, ...override.audit }

    // Environments — override replaces
    if (override.environments) merged.environments = override.environments

    return merged
}

// ── Tighten-only enforcement (UCFG.2) ──────────────────────────────────────

/** Strictness ordering: higher index = stricter. */
const MODE_STRICTNESS: Record<RuleMode, number> = {
    off: 0,
    advisory: 1,
    normative: 2,
    coercive: 3,
}

/**
 * Validates that `child` does not relax any governance rule from `parent`.
 * Returns an array of violation messages. Empty array = compliant.
 *
 * Checks:
 *   - Rule modes can only get stricter (off → advisory → normative → coercive)
 *   - delta_e thresholds can only decrease (tighter)
 *   - export_gate booleans can only go false → true (more blocking)
 *   - disabled rules list can only shrink (fewer disabled = stricter)
 */
export function validateTightenOnly(
    parent: FlintProjectConfig,
    child: FlintProjectConfig
): string[] {
    const violations: string[] = []

    // Mode strictness check
    const checkMode = (section: string, parentMode?: RuleMode, childMode?: RuleMode) => {
        if (!parentMode || !childMode) return
        if (MODE_STRICTNESS[childMode] < MODE_STRICTNESS[parentMode]) {
            violations.push(
                `rules.${section}.mode: cannot relax from "${parentMode}" to "${childMode}"`
            )
        }
    }

    checkMode('mithril', parent.rules?.mithril?.mode, child.rules?.mithril?.mode)
    checkMode('accessibility', parent.rules?.accessibility?.mode, child.rules?.accessibility?.mode)

    // Delta-E thresholds: lower = stricter, so child must be <= parent
    const pDE = parent.rules?.mithril?.delta_e
    const cDE = child.rules?.mithril?.delta_e
    if (pDE !== undefined && cDE !== undefined && cDE > pDE) {
        violations.push(
            `rules.mithril.delta_e: cannot relax from ${pDE} to ${cDE} (must be <= parent)`
        )
    }

    const pDEC = parent.rules?.mithril?.delta_e_critical
    const cDEC = child.rules?.mithril?.delta_e_critical
    if (pDEC !== undefined && cDEC !== undefined && cDEC > pDEC) {
        violations.push(
            `rules.mithril.delta_e_critical: cannot relax from ${pDEC} to ${cDEC} (must be <= parent)`
        )
    }

    // Export gate: can only become MORE blocking (false → true OK, true → false NOT OK)
    const pGate = parent.rules?.export_gate
    const cGate = child.rules?.export_gate
    if (pGate && cGate) {
        if (pGate.block_on_overrides === true && cGate.block_on_overrides === false) {
            violations.push('rules.export_gate.block_on_overrides: cannot relax from true to false')
        }
        if (pGate.block_on_mithril === true && cGate.block_on_mithril === false) {
            violations.push('rules.export_gate.block_on_mithril: cannot relax from true to false')
        }
        if (pGate.block_on_a11y === true && cGate.block_on_a11y === false) {
            violations.push('rules.export_gate.block_on_a11y: cannot relax from true to false')
        }
    }

    // Disabled rules: child cannot ADD to the disabled list (that relaxes enforcement)
    const pDisabled = new Set(parent.rules?.accessibility?.disabled ?? [])
    const cDisabled = child.rules?.accessibility?.disabled ?? []
    for (const rule of cDisabled) {
        if (!pDisabled.has(rule)) {
            violations.push(
                `rules.accessibility.disabled: cannot add "${rule}" (parent does not disable it)`
            )
        }
    }

    return violations
}

// ── Extends resolution (UCFG.2) ────────────────────────────────────────────

/**
 * Loads a YAML file and parses it as a partial FlintProjectConfig.
 * Used for resolving local file and preset references.
 */
function loadYamlFile(filePath: string): FlintProjectConfig | null {
    if (!fs.existsSync(filePath)) return null
    try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = parseYaml(raw)
        if (!parsed || typeof parsed !== 'object') return null
        return parsed as FlintProjectConfig
    } catch {
        return null
    }
}

/**
 * Resolves a single `extends` reference to a file path.
 *
 * Prefixes:
 *   @flint/<name>   → bundled preset at flint-mcp/presets/<name>.yaml
 *   ./ or ../       → local file relative to project root
 *   /absolute/path  → direct file reference
 *   org/pack-name   → reserved for GPX registry (UCFG.6), returns null
 */
export function resolveExtendsRef(ref: string, projectRoot: string): string | null {
    // Canonicalize projectRoot once for sandbox comparisons.
    let canonicalRoot: string
    try {
        canonicalRoot = fs.realpathSync(projectRoot)
    } catch {
        canonicalRoot = path.resolve(projectRoot)
    }
    const rootWithSep = canonicalRoot.endsWith(path.sep)
        ? canonicalRoot
        : canonicalRoot + path.sep

    // MAJOR-3/4: helper that realpath-canonicalizes a resolved path and enforces
    // the sandbox. Returns canonical path on success, throws on escape.
    // When the target file does not exist yet, walk up to the nearest existing
    // ancestor and realpath that to avoid platform-specific path mismatches
    // (e.g. /var vs /private/var on macOS).
    const canonicalizeInside = (resolved: string, allowOutside: boolean): string => {
        let canonical: string
        try {
            canonical = fs.realpathSync(resolved)
        } catch {
            // File does not exist — canonicalize the nearest existing ancestor
            // and append the remaining tail so the sandbox comparison works
            // against the same canonical form as canonicalRoot.
            let ancestor = path.resolve(resolved)
            const tailParts: string[] = []
            while (!fs.existsSync(ancestor)) {
                const parent = path.dirname(ancestor)
                if (parent === ancestor) break
                tailParts.unshift(path.basename(ancestor))
                ancestor = parent
            }
            try {
                const realAncestor = fs.realpathSync(ancestor)
                canonical = tailParts.length
                    ? path.join(realAncestor, ...tailParts)
                    : realAncestor
            } catch {
                canonical = path.resolve(resolved)
            }
        }
        if (allowOutside) return canonical
        if (canonical !== canonicalRoot && !canonical.startsWith(rootWithSep)) {
            throw new ConfigPathSandboxError(ref, canonical)
        }
        return canonical
    }

    if (ref.startsWith('@flint/')) {
        const presetName = ref.slice('@flint/'.length)
        const presetPath = path.join(PRESETS_DIR, `${presetName}.yaml`)
        // Presets live outside projectRoot (inside package). Canonicalize but
        // do not enforce projectRoot sandbox — enforce PRESETS_DIR instead.
        let canonical: string
        try {
            canonical = fs.realpathSync(presetPath)
        } catch {
            canonical = path.resolve(presetPath)
        }
        let canonicalPresetsDir: string
        try {
            canonicalPresetsDir = fs.realpathSync(PRESETS_DIR)
        } catch {
            canonicalPresetsDir = path.resolve(PRESETS_DIR)
        }
        const presetDirWithSep = canonicalPresetsDir.endsWith(path.sep)
            ? canonicalPresetsDir
            : canonicalPresetsDir + path.sep
        if (canonical !== canonicalPresetsDir && !canonical.startsWith(presetDirWithSep)) {
            throw new ConfigPathSandboxError(ref, canonical)
        }
        return canonical
    }

    if (ref.startsWith('./') || ref.startsWith('../')) {
        // MAJOR-3: enforce projectRoot sandbox for relative refs.
        const resolved = path.resolve(projectRoot, ref)
        return canonicalizeInside(resolved, false)
    }

    if (path.isAbsolute(ref)) {
        // MAJOR-3: absolute paths must fall inside projectRoot.
        return canonicalizeInside(ref, false)
    }

    // org/pack-name — attempt local pack cache resolution (UCFG.6 / GPX registry)
    const registryPath = resolveRegistryRef(ref, projectRoot)
    if (registryPath === null) return null
    // Registry pack cache lives under projectRoot/.flint/… so the sandbox applies.
    return canonicalizeInside(registryPath, false)
}

/**
 * Resolves the full `extends` chain for a FlintProjectConfig.
 *
 * Resolution order:
 *   1. Built-in defaults
 *   2. extends[0] → extends[1] → ... → extends[N]  (deep-merged in order)
 *   3. The project config itself (overrides everything)
 *
 * Supports recursive extends (parent configs can also have `extends`).
 * Detects circular references via a seen-set.
 *
 * When `tighten_only` is true (default), validates that the project config
 * does not relax any rule inherited from the extends chain. Violations are
 * logged as warnings but do NOT block loading (advisory enforcement).
 */
export function resolveExtends(
    config: FlintProjectConfig,
    projectRoot: string,
    _seen?: Set<string>
): FlintProjectConfig {
    const seen = _seen ?? new Set<string>()
    const refs = config.extends

    if (!refs || refs.length === 0) {
        return config
    }

    // Start with a minimal base (just project name, will be overridden)
    let accumulated: FlintProjectConfig = { project: config.project }

    for (const ref of refs) {
        const filePath = resolveExtendsRef(ref, projectRoot)
        if (!filePath) continue

        // MAJOR-4: dedupe via canonical realpath so `./a.yaml` and
        // `../dir/a.yaml` referring to the same file are not loaded twice.
        // resolveExtendsRef already canonicalizes, so filePath is canonical.
        if (seen.has(filePath)) {
            console.warn(
                `[Flint Config] Circular extends detected: "${ref}" (${filePath}). Skipping.`
            )
            continue
        }
        seen.add(filePath)

        const parentConfig = loadYamlFile(filePath)
        if (!parentConfig) {
            console.warn(`[Flint Config] Could not load extends ref "${ref}" from ${filePath}`)
            continue
        }

        // Recursively resolve parent's own extends
        const parentRoot = path.dirname(filePath)
        const resolvedParent = resolveExtends(parentConfig, parentRoot, seen)

        // Merge parent into accumulated base
        accumulated = deepMergeConfigs(accumulated, resolvedParent)
    }

    // Merge project config on top of accumulated parents
    const merged = deepMergeConfigs(accumulated, config)

    // Tighten-only enforcement
    const tightenOnly = config.tighten_only ?? true // default: true
    if (tightenOnly) {
        const violations = validateTightenOnly(accumulated, config)
        if (violations.length > 0) {
            console.warn(
                `[Flint Config] tighten_only violations (${violations.length}):\n` +
                    violations.map((v) => `  - ${v}`).join('\n') +
                    '\n  Child config relaxes inherited rules. ' +
                    'Set tighten_only: false to allow this.'
            )
        }
    }

    // Strip extends from resolved config (already applied)
    return { ...merged, extends: undefined }
}

// ── Legacy JSON policy loading ─────────────────────────────────────────────

/**
 * Loads the `.flint/policy.json` file from the given project root.
 * Returns DEFAULT_POLICY if the file is missing or malformed.
 *
 * Performs a shallow-then-deep merge: each top-level section is individually
 * merged with its default so partial sections are safe. Unknown keys are
 * silently preserved (forward compatibility).
 */
export function loadPolicy(projectRoot: string): FlintPolicy {
    const policyPath = path.join(projectRoot, '.flint', 'policy.json')

    if (!fs.existsSync(policyPath)) {
        return { ...DEFAULT_POLICY }
    }

    try {
        const raw = fs.readFileSync(policyPath, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<FlintPolicy>

        // Validate version
        if (parsed.version !== undefined && parsed.version !== 1) {
            console.error(
                `[Flint Policy] Unsupported policy version ${parsed.version}, using defaults`
            )
            return { ...DEFAULT_POLICY }
        }

        // Deep merge each section with its default
        return {
            version: 1,
            mithril: {
                ...DEFAULT_POLICY.mithril,
                ...(parsed.mithril ?? {}),
            },
            a11y: {
                ...DEFAULT_POLICY.a11y,
                ...(parsed.a11y ?? {}),
            },
            export_gate: {
                ...DEFAULT_POLICY.export_gate,
                ...(parsed.export_gate ?? {}),
            },
            baseline: {
                ...DEFAULT_POLICY.baseline,
                ...(parsed.baseline ?? {}),
            },
            domain: parsed.domain,
        }
    } catch (err) {
        console.error(
            `[Flint Policy] Failed to load ${policyPath}, using defaults:`,
            err instanceof Error ? err.message : err
        )
        return { ...DEFAULT_POLICY }
    }
}

// ── Full config loading ─────────────────────────────────────────────────────

/**
 * Loads the full FlintConfig for a given project root.
 *
 * Resolution order (UCFG.1):
 *   1. flint.config.yaml (unified YAML config) — takes precedence
 *   2. .flint/policy.json (legacy JSON config) — fallback with deprecation notice
 *   3. DEFAULT_POLICY — when neither exists
 *
 * The FlintConfig interface is unchanged. YAML is mapped to FlintPolicy
 * via projectConfigToPolicy(). All downstream consumers are unaffected.
 */
export function loadConfig(
    projectRoot: string,
    options?: ConfigLoaderOptions
): FlintConfig {
    let policy: FlintPolicy
    let yamlConfig: FlintProjectConfig | null = null

    // 1. Try flint.config.yaml first
    yamlConfig = loadYamlConfig(projectRoot, options)

    if (yamlConfig) {
        // Resolve extends chain (UCFG.2)
        const withExtends = resolveExtends(yamlConfig, projectRoot)
        // Apply environment overlay if FLINT_ENV is set
        const resolved = applyEnvironmentOverlay(withExtends)
        // Map YAML config → FlintPolicy
        policy = projectConfigToPolicy(resolved)
    } else {
        // 2. Fall back to legacy .flint/policy.json
        const policyPath = path.join(projectRoot, '.flint', 'policy.json')
        if (fs.existsSync(policyPath)) {
            console.warn(
                '[Flint Config] Using legacy .flint/policy.json. ' +
                    'Consider migrating to flint.config.yaml for unified governance configuration.'
            )
        }
        policy = loadPolicy(projectRoot)
    }

    // Discover active domains — check for .flint/domains/ subdirectories
    let domains = ['ui']
    const domainsDir = path.join(projectRoot, '.flint', 'domains')
    if (fs.existsSync(domainsDir)) {
        try {
            const entries = fs.readdirSync(domainsDir, { withFileTypes: true })
            const domainNames = entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name)
            if (domainNames.length > 0) {
                domains = domainNames
            }
        } catch {
            // Fallback to default domains
        }
    }

    return {
        projectRoot,
        domains,
        policy,
    }
}

/**
 * Returns the raw FlintProjectConfig if a YAML config exists.
 * Useful for tools that need access to YAML-only fields (trust, scoring, etc.)
 * that aren't represented in FlintPolicy.
 */
export function loadProjectConfig(projectRoot: string): FlintProjectConfig | null {
    const config = loadYamlConfig(projectRoot)
    if (!config) return null
    const withExtends = resolveExtends(config, projectRoot)
    return applyEnvironmentOverlay(withExtends)
}
