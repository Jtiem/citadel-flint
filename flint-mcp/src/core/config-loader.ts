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
export function loadYamlConfig(projectRoot: string): FlintProjectConfig | null {
    const yamlPath = path.join(projectRoot, 'flint.config.yaml')

    if (!fs.existsSync(yamlPath)) {
        return null
    }

    try {
        const raw = fs.readFileSync(yamlPath, 'utf-8')
        const parsed = parseYaml(raw)

        if (!parsed || typeof parsed !== 'object') {
            console.error('[Flint Config] flint.config.yaml is empty or invalid, skipping')
            return null
        }

        const config = parsed as FlintProjectConfig

        // Validate: 'project' is the only required field
        if (!config.project || typeof config.project !== 'string') {
            console.error(
                '[Flint Config] flint.config.yaml missing required "project" field, skipping'
            )
            return null
        }

        // Run full structural validation — log warnings but do not block loading
        const validationErrors = validateProjectConfig(parsed)
        if (validationErrors.length > 0) {
            console.warn(
                `[Flint Config] flint.config.yaml has ${validationErrors.length} validation warning(s):\n` +
                    validationErrors
                        .map((e) => `  - ${e.path}: ${e.message}`)
                        .join('\n')
            )
        }

        return config
    } catch (err) {
        console.error(
            '[Flint Config] Failed to parse flint.config.yaml:',
            err instanceof Error ? err.message : err
        )
        return null
    }
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

    // Trust — merge with array replacement
    if (override.trust) {
        merged.trust = {
            ...base.trust,
            ...override.trust,
            profiles: override.trust?.profiles ?? base.trust?.profiles,
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
function resolveExtendsRef(ref: string, projectRoot: string): string | null {
    if (ref.startsWith('@flint/')) {
        const presetName = ref.slice('@flint/'.length)
        return path.join(PRESETS_DIR, `${presetName}.yaml`)
    }

    if (ref.startsWith('./') || ref.startsWith('../')) {
        return path.resolve(projectRoot, ref)
    }

    if (path.isAbsolute(ref)) {
        return ref
    }

    // org/pack-name — attempt local pack cache resolution (UCFG.6 / GPX registry)
    return resolveRegistryRef(ref, projectRoot)
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
        // Circular dependency check
        if (seen.has(ref)) {
            console.warn(`[Flint Config] Circular extends detected: "${ref}". Skipping.`)
            continue
        }
        seen.add(ref)

        const filePath = resolveExtendsRef(ref, projectRoot)
        if (!filePath) continue

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
export function loadConfig(projectRoot: string): FlintConfig {
    let policy: FlintPolicy
    let yamlConfig: FlintProjectConfig | null = null

    // 1. Try flint.config.yaml first
    yamlConfig = loadYamlConfig(projectRoot)

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
