/**
 * Sprint 4 — D2: Shared handler context type.
 *
 * Every extracted tool handler receives a `ResolvedToolContext` rather than
 * closing over server.ts module state. This makes the handlers unit-testable
 * and makes the dispatch surface in server.ts a thin one-liner per case.
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts (D2)
 */

import type { FlintConfig } from '../../core/config.js'
import type { ResolvedPolicy } from '../../core/policyEngine.js'

/**
 * Context passed to every extracted tool handler.
 *
 *   - `projectRoot` is hoisted once per CallToolRequest callback via
 *     `resolveProjectRoot()` so every handler sees the same value.
 *   - `resolved` is loaded once per request via `loadAndResolvePolicy()`
 *     so policy edits via `flint_set_policy` are reflected on the very
 *     next tool call without a process restart.
 *   - `flintConfig` is kept for the rare handler that still reads
 *     project metadata (domains). After D3 the legacy `policy` field is
 *     no longer read from `flintConfig` anywhere.
 */
export interface ResolvedToolContext {
    projectRoot: string
    flintConfig: FlintConfig
    resolved: ResolvedPolicy
    /**
     * Reload the server-level FlintConfig after an out-of-band mutation
     * (e.g. flint_set_policy writing a new policy file). Returns the
     * freshly loaded config. Optional because most handlers don't need it.
     */
    reloadFlintConfig?: () => FlintConfig
}

/**
 * Thin callable signature for an extracted tool handler. Most handlers
 * annotate their own arg shape from `tools/schemas.ts`.
 */
export type ToolHandler<TArgs = unknown, TResult = unknown> = (
    args: TArgs,
    ctx: ResolvedToolContext,
) => Promise<TResult>
