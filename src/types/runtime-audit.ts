/**
 * runtime-audit.ts — Renderer-side type surface for RUNTIME.1 axe-core adapter.
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 *
 * These types are the renderer-side mirror of the shapes declared in the
 * executable contract. They MUST stay in sync with
 * `RuntimeAuditRequest` / `RuntimeAuditResult` / `RuntimeAuditStatus` /
 * `MergedA11yFinding` / `SourceAuthority` + `runtime-dom` in
 * `.flint-context/contracts/RUNTIME.1.contract.ts`.
 *
 * Why a dedicated file (instead of inlining in flint-api.d.ts): tests import
 * these types directly without pulling the entire preload surface, and Group A
 * (electron-ipc) will extend flint-api.d.ts independently. Keeping the
 * renderer-facing source types here means both Group A and Group B can
 * compile in parallel without colliding on the same declaration.
 *
 * Runtime shape parity is enforced at the preload bridge by the Zod
 * validators in shared/ipc-validators.ts (runtimeRunAxePayloadSchema and
 * runtimeRunAxeResponseSchema).
 */

import type { SourceAuthority as BaseSourceAuthority } from './flint-api'

// ── Source Authority (extended) ──────────────────────────────────────────────

/**
 * SourceAuthority union extended with the runtime-dom value.
 *
 * The base union in flint-api.d.ts will be extended append-only by Group A
 * to include 'runtime-dom'. Until that extension lands we narrow to the
 * base union `| 'runtime-dom'` here so RUNTIME.1 consumers can reference
 * the value without a compile dependency on a Group A file.
 */
export type RuntimeSourceAuthority = BaseSourceAuthority | 'runtime-dom'

// ── Core shapes mirroring the .contract.ts ────────────────────────────────

/**
 * A11yViolationDetail — renderer-side mirror of the Warden violation shape.
 * Kept locally so UI components don't have to import MCP types.
 */
export interface A11yViolationDetail {
    ruleId: string
    elementId: string
    message: string
    severity: 'critical' | 'warning' | 'info' | 'advisory'
    wcag: string
    fixable: boolean
    explanation?: string
    recovery?: string
}

/**
 * Hook/IPC status values. Drives RuntimeAuditPill UI.
 */
export type RuntimeAuditStatus =
    | 'idle'
    | 'running'
    | 'passed'
    | 'violations'
    | 'no-preview'
    | 'version-mismatch'
    | 'error'

export interface RuntimeAuditRequest {
    previewHtml: string
    previewUrl?: string
    rules?: string[]
}

export interface RuntimeAuditResult {
    status: RuntimeAuditStatus
    timestamp: string
    axeVersion: string
    nodeCount: number
    durationMs: number
    violations: A11yViolationDetail[]
    error?: {
        code: string
        message: string
    }
}

/**
 * Output shape of useMergedA11yFindings.
 * Extends A11yViolationDetail with a multi-authority array; a dedup hit
 * (same mapped ruleId + same elementId across AST and runtime) collapses
 * to a single row with sourceAuthorities containing both values.
 */
export interface MergedA11yFinding extends A11yViolationDetail {
    sourceAuthorities: RuntimeSourceAuthority[]
}
