/**
 * visualRegressionStub.ts — Phase P7: Visual Regression (MCP-side stub)
 *
 * The visual regression audit requires a real DOM and layout engine, which
 * only exists inside Flint Glass (Electron BrowserWindow). The headless MCP
 * server has no rendering context, so this stub:
 *
 *   1. Detects whether a Glass IPC bridge is available (injected by the
 *      Electron-side bootstrap via `registerGlassBridge`).
 *   2. If yes — delegates to Glass and returns the real audit result.
 *   3. If no — returns a single advisory LinterWarning telling the agent
 *      that visual regression requires Flint Glass.
 *
 * This lets other linters (MithrilLinter, A11yLinter) reference VISUAL-REG-001
 * via a stable rule identifier without depending on Electron at build time.
 */

import type { LinterWarning } from '../types.js'

// ── Rule ID export ───────────────────────────────────────────────────────────

/** Stable rule identifier for visual regression violations. */
export const VISUAL_REG_RULE_ID = 'VISUAL-REG-001' as const

/** The canonical LinterWarning.type for visual regression. */
export const VISUAL_REG_WARNING_TYPE = 'visual-regression' as const

// ── Public types ─────────────────────────────────────────────────────────────

export interface ExpectedBox {
    flintId: string
    width: number
    height: number
    x: number
    y: number
}

export interface VisualRegressionInput {
    componentCode: string
    componentName: string
    expectedBoxes: ExpectedBox[]
    tolerance?: number
}

export interface VisualRegressionViolation {
    flintId: string
    ruleId: typeof VISUAL_REG_RULE_ID
    message: string
    expected: { width: number; height: number }
    actual: { width: number; height: number }
    deltaPx: number
    suggestion: string | null
}

export interface VisualRegressionResult {
    ok: boolean
    violations: VisualRegressionViolation[]
    error: string | null
    /**
     * True when the audit was delegated to Flint Glass. False when the stub
     * returned an advisory fallback because no Glass bridge was registered.
     */
    ranInGlass: boolean
}

/**
 * The Glass-side IPC surface. Electron registers this at startup via
 * `registerGlassBridge`. The MCP server has no `electron` dependency, so we
 * accept an opaque async function.
 */
export type GlassVisualBridge = (input: VisualRegressionInput) => Promise<{
    ok: boolean
    violations: VisualRegressionViolation[]
    error: string | null
}>

// ── Bridge registration ──────────────────────────────────────────────────────

let glassBridge: GlassVisualBridge | null = null

/**
 * Register the Glass-side visual audit bridge. Called from Electron's
 * MCP client bootstrap. Safe to call multiple times — the latest bridge wins.
 */
export function registerGlassBridge(bridge: GlassVisualBridge | null): void {
    glassBridge = bridge
}

/** For tests — restore the uninitialized state. */
export function resetGlassBridgeForTests(): void {
    glassBridge = null
}

/** True when a Glass IPC bridge has been registered. */
export function isGlassAvailable(): boolean {
    return glassBridge !== null
}

// ── Advisory warning builder ─────────────────────────────────────────────────

/**
 * The fallback advisory emitted when no Glass bridge is available.
 * Surfaced to the agent so it knows *why* the visual audit did not run.
 */
export function buildGlassUnavailableAdvisory(): LinterWarning {
    return {
        id: `visual-reg-unavailable-${Date.now()}`,
        type: VISUAL_REG_WARNING_TYPE,
        severity: 'advisory',
        value: 0,
        message:
            'Visual regression checking requires Flint Glass to be running. ' +
            'The headless MCP server cannot render components. ' +
            'Launch Flint Glass (`npm run dev`) or run this audit from the Glass UI to enable VISUAL-REG-001.',
        nearestToken: null,
        nearestTokenValue: null,
        ruleId: VISUAL_REG_RULE_ID,
        fixable: false,
        explanation:
            'Visual regression violations (VISUAL-REG-001) detect layout drift by rendering the component ' +
            'in a real DOM and comparing bounding boxes against the Figma AST. This check requires a ' +
            'browser engine, which only exists in Flint Glass (Electron).',
        recovery:
            'Open the component in Flint Glass and re-run the audit. The visual auditor will render the ' +
            'component in a hidden BrowserWindow, measure each data-flint-id element, and emit violations ' +
            'for any dimension that drifts beyond the configured tolerance (default 2px).',
    }
}

/**
 * Convert a visual regression violation from the Glass audit into a
 * LinterWarning suitable for the main Mithril/A11y violation pipeline.
 */
export function violationToLinterWarning(v: VisualRegressionViolation): LinterWarning {
    const suggestionSuffix = v.suggestion ? ` ${v.suggestion}` : ''
    return {
        id: `visual-reg-${v.flintId}`,
        type: VISUAL_REG_WARNING_TYPE,
        severity: 'advisory',
        value: v.deltaPx,
        message: v.message + suggestionSuffix,
        nearestToken: null,
        nearestTokenValue: null,
        ruleId: v.ruleId,
        fixable: false,
    }
}

// ── Main audit entry point ───────────────────────────────────────────────────

/**
 * Run a visual regression audit. Delegates to Glass when available, otherwise
 * returns an advisory fallback.
 *
 * This function never throws — all errors are surfaced via the `error` field.
 */
export async function runVisualRegressionAudit(
    input: VisualRegressionInput
): Promise<VisualRegressionResult> {
    if (glassBridge === null) {
        return {
            ok: true,
            violations: [],
            error: null,
            ranInGlass: false,
        }
    }

    try {
        const result = await glassBridge(input)
        return {
            ok: result.ok,
            violations: result.violations,
            error: result.error,
            ranInGlass: true,
        }
    } catch (err) {
        return {
            ok: false,
            violations: [],
            error: `Glass bridge threw: ${String(err)}`,
            ranInGlass: true,
        }
    }
}

/**
 * Convenience: produce LinterWarnings for the main audit pipeline. Returns
 * the advisory fallback when Glass is unavailable so the agent sees *something*.
 */
export async function runVisualRegressionForLinter(
    input: VisualRegressionInput
): Promise<LinterWarning[]> {
    const result = await runVisualRegressionAudit(input)

    if (!result.ranInGlass) {
        return [buildGlassUnavailableAdvisory()]
    }

    if (result.error) {
        return [{
            id: `visual-reg-error-${Date.now()}`,
            type: VISUAL_REG_WARNING_TYPE,
            severity: 'advisory',
            value: 0,
            message: `Visual regression audit failed: ${result.error}`,
            nearestToken: null,
            nearestTokenValue: null,
            ruleId: VISUAL_REG_RULE_ID,
            fixable: false,
        }]
    }

    return result.violations.map(violationToLinterWarning)
}
