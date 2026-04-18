/**
 * useSyncActions — src/hooks/useSyncActions.ts
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Single-ownership hook for the Mint sync action cluster. Wraps the 5 MCP tools
 * that Mint's Pull / Push / Resolve / Pull-this / Connect actions fire:
 *
 *   flint_sync_pull      — full pull from Figma
 *   flint_sync_push      — push local edits to Figma (destructive; guarded by dialog)
 *   flint_resolve_all    — bulk-resolve conflicts (destructive; guarded by dialog)
 *   flint_sync_check     — per-token pull (scope/tokenPath arg)
 *   flint_figma_connect  — Alliance OAuth entry
 *
 * Ownership:
 *   - `syncOp`    — current in-flight op (`'pull' | 'push' | 'resolve' | 'pull-one' | 'connect' | null`).
 *                   Serializes so only one sync action can be in flight at a time.
 *   - `lastError` — last MCP error observed. `persistent=true` for auth-expired /
 *                   revoked-connection responses, which the UI may surface as a
 *                   persistent SeverityChip instead of a transient toast.
 *
 * IPC is consumed via `window.flintAPI.mcp.callTool` (the sanctioned hook pattern
 * per CLAUDE.md — IPC is forbidden in stores but allowed in hooks). The hook
 * degrades gracefully when `window.flintAPI` is unavailable (tests, SSR) by
 * returning `ready: false` and making every action a no-op that resolves.
 *
 * Notifications:
 *   - Success → 'sync' toast (severity=success, autoDismissMs=4000)
 *   - Transient error → 'error' toast (severity=error, autoDismissMs=8000)
 *   - Auth-expired → 'error' toast (severity=critical, persistent) AND sets
 *     lastError.persistent=true for persistent UI badges.
 *
 * The 5-concurrent notification cap (notificationStore.MAX_CONCURRENT) is not a
 * concern for normal sync bursts — 3 back-to-back sync toasts at 4s auto-dismiss
 * fit well under the cap. Documented for future reference.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useNotificationStore } from '../store/notificationStore'
import { sanitizeError } from '../../shared/errorSanitizer'
import type {
    SyncOp,
    ResolveStrategy,
    SyncActionError,
    UseSyncActionsOptions,
    UseSyncActionsResult,
} from '../../.flint-context/contracts/MINT.5-phase2.contract'

// Re-export SyncActionError for consumers (FIX-2 persistent chip wiring).
export type { SyncActionError } from '../../.flint-context/contracts/MINT.5-phase2.contract'

/**
 * MINT.5 Phase 2 consensus FIX-5 — Runtime Zod guard on ResolveStrategy.
 * The compile-time narrowing at the ConfirmResolveDialog → useSyncActions
 * boundary does not defend against `as any` casts from external callers. A
 * one-line Zod parse at dispatch time catches malformed strategies before
 * they reach the MCP tool.
 */
const RESOLVE_STRATEGY_SCHEMA = z.enum(['prefer-figma', 'prefer-local'])

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract a user-readable message from an MCP tool response. Prefers the
 * first text content block; falls back to "Unknown error." when absent.
 */
function extractMessage(result: { content?: Array<{ type?: string; text?: string }> } | undefined): string {
    const text = result?.content?.[0]?.text
    if (typeof text === 'string' && text.trim().length > 0) return text.trim()
    return 'Unknown error.'
}

/**
 * Classify whether an MCP error represents an auth-expired / revoked connection.
 * Phase 2 uses keyword matching on the response text because MCP CallToolResult
 * has no status-header field in the shared type. If/when a structured status
 * field is added (Phase 3+), swap this for that field.
 */
function isAuthExpiredError(message: string): boolean {
    const lower = message.toLowerCase()
    return (
        lower.includes('auth-expired') ||
        lower.includes('auth expired') ||
        lower.includes('token expired') ||
        lower.includes('connection revoked') ||
        lower.includes('unauthorized') ||
        lower.includes('not authorized')
    )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncActions(options: UseSyncActionsOptions = {}): UseSyncActionsResult {
    const { onAfterSync, confirmPush, confirmResolve } = options

    // Read notification push function (stable selector).
    const pushNotification = useNotificationStore((s) => s.push)

    // syncOp state + synchronous ref mirror.
    // The ref is consulted by every action before invoking mcp.callTool so two
    // actions fired in the same tick cannot both pass the guard — React state
    // updates are asynchronous and would not serialize fast-fire invocations.
    const [syncOp, setSyncOpState] = useState<SyncOp>(null)
    const syncOpRef = useRef<SyncOp>(null)

    const setSyncOp = useCallback((next: SyncOp) => {
        syncOpRef.current = next
        setSyncOpState(next)
    }, [])

    // lastError state.
    const [lastError, setLastError] = useState<SyncActionError | null>(null)

    // Ready flag — true only when window.flintAPI.mcp.callTool is available.
    // Re-checked on mount so tests that populate window.flintAPI in beforeEach
    // report ready=true on the first render.
    const [ready, setReady] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false
        return typeof window.flintAPI?.mcp?.callTool === 'function'
    })

    useEffect(() => {
        // Re-evaluate once on mount (covers cases where the window.flintAPI
        // shim is attached asynchronously in dev/test).
        if (typeof window !== 'undefined' && typeof window.flintAPI?.mcp?.callTool === 'function') {
            setReady(true)
        }
    }, [])

    /**
     * Core dispatch. Serializes on syncOpRef, invokes the MCP tool, routes
     * success/error to notifications + lastError, and fires onAfterSync on
     * every success.
     *
     * Returns silently on:
     *   - hook not ready (no window.flintAPI)
     *   - another op in flight (serialization guard)
     */
    const dispatch = useCallback(
        async (
            op: Exclude<SyncOp, null>,
            toolName: string,
            args: Record<string, unknown>,
            successTitle: string,
            successMessage: string,
            failureTitle: string,
        ): Promise<void> => {
            if (!ready) return
            if (syncOpRef.current !== null) return
            const callTool = window.flintAPI?.mcp?.callTool
            if (typeof callTool !== 'function') return

            setSyncOp(op)

            try {
                const result = await callTool(toolName, args)
                const isError = result?.isError === true

                if (isError) {
                    // FIX-3 (Security WARN-2): sanitize BEFORE classification so
                    // the detection still sees the original signal words, but the
                    // user-visible message and lastError.message have any secrets
                    // redacted and the allowlist dump collapsed.
                    const rawMessage = extractMessage(result)
                    const persistent = isAuthExpiredError(rawMessage)
                    const safeMessage = sanitizeError(rawMessage)
                    const nextError: SyncActionError = {
                        tool: toolName,
                        message: safeMessage,
                        timestamp: Date.now(),
                        persistent,
                    }
                    setLastError(nextError)

                    pushNotification({
                        type: 'error',
                        title: persistent ? 'Figma connection expired' : failureTitle,
                        message: safeMessage,
                        severity: persistent ? 'critical' : 'error',
                        // persistent severity=critical is forced to 0 (sticky) by the
                        // notification store. For transient errors we stamp 8000ms
                        // explicitly so the UI contract is falsifiable in tests.
                        autoDismissMs: persistent ? 0 : 8000,
                    })
                    return
                }

                // Success path — clear any prior error, emit a success toast,
                // fire the onAfterSync callback so consumers can refetch.
                setLastError(null)
                pushNotification({
                    type: 'sync',
                    title: successTitle,
                    message: successMessage,
                    severity: 'success',
                    autoDismissMs: 4000,
                })
                onAfterSync?.()
            } catch (err) {
                // Catches thrown errors from window.flintAPI (e.g. IPC bridge
                // rejection) — mirror the isError path with a synthesized message.
                const rawMessage =
                    err instanceof Error && err.message
                        ? err.message
                        : 'Could not reach the governance engine.'
                const persistent = isAuthExpiredError(rawMessage)
                // FIX-3 (Security WARN-2): sanitize before surfacing.
                const safeMessage = sanitizeError(rawMessage)
                const nextError: SyncActionError = {
                    tool: toolName,
                    message: safeMessage,
                    timestamp: Date.now(),
                    persistent,
                }
                setLastError(nextError)

                pushNotification({
                    type: 'error',
                    title: persistent ? 'Figma connection expired' : failureTitle,
                    message: safeMessage,
                    severity: persistent ? 'critical' : 'error',
                    autoDismissMs: persistent ? 0 : 8000,
                })
            } finally {
                setSyncOp(null)
            }
        },
        [ready, setSyncOp, pushNotification, onAfterSync],
    )

    // ── Public actions ───────────────────────────────────────────────────────

    const pull = useCallback(async () => {
        await dispatch(
            'pull',
            'flint_sync_pull',
            {},
            'Pull complete',
            'Figma tokens pulled to local project.',
            'Pull failed',
        )
    }, [dispatch])

    const push = useCallback(async () => {
        // Destructive action — gate on confirm callback if provided.
        if (confirmPush) {
            const approved = await confirmPush()
            if (!approved) return
        }
        await dispatch(
            'push',
            'flint_sync_push',
            {},
            'Push complete',
            'Local tokens pushed to Figma.',
            'Push failed',
        )
    }, [dispatch, confirmPush])

    const resolve = useCallback(
        async (strategy: ResolveStrategy) => {
            // Destructive — if a confirmResolve callback was provided the caller
            // is expected to have resolved to the same or a different strategy.
            // The argument passed to resolve() takes precedence over the dialog
            // default; the dialog is used when the UI wants to prompt first.
            let effective: ResolveStrategy = strategy
            if (confirmResolve) {
                const chosen = await confirmResolve()
                if (chosen === null) return
                effective = chosen
            }

            // FIX-5 (Security WARN-3): defend against `as any` casts at the
            // dispatch boundary. Compile-time narrowing at the dialog prop
            // signature is not enough — this guard fires before mcp.callTool
            // sees the payload.
            const parseResult = RESOLVE_STRATEGY_SCHEMA.safeParse(effective)
            if (!parseResult.success) {
                const nextError: SyncActionError = {
                    tool: 'flint_resolve_all',
                    message: 'Invalid resolution strategy. Please try again.',
                    timestamp: Date.now(),
                    persistent: false,
                }
                setLastError(nextError)
                pushNotification({
                    type: 'error',
                    title: 'Resolve failed',
                    message: nextError.message,
                    severity: 'error',
                    autoDismissMs: 8000,
                })
                return
            }

            await dispatch(
                'resolve',
                'flint_resolve_all',
                { strategy: parseResult.data },
                'Conflicts resolved',
                `Resolved with strategy "${parseResult.data}".`,
                'Resolve failed',
            )
        },
        [dispatch, confirmResolve, pushNotification],
    )

    const pullOne = useCallback(
        async (tokenPath: string) => {
            await dispatch(
                'pull-one',
                'flint_sync_pull',
                { scope: 'token', tokenPath },
                'Token pulled',
                `Pulled "${tokenPath}" from Figma.`,
                'Pull failed',
            )
        },
        [dispatch],
    )

    const connect = useCallback(async () => {
        // FIX-6 (UX WARN-1/2): plain-language copy, no Citadel vocabulary.
        // The title is "Opening Figma" — not "Figma connected" — because
        // `flint_figma_connect` launches the OAuth flow in the browser; the
        // tool returning success means the browser tab opened, not that the
        // user approved. The `flint://figma-connection` status change is what
        // actually indicates completion (and TokenManager already re-renders
        // on that signal via fetchFigmaState).
        await dispatch(
            'connect',
            'flint_figma_connect',
            { action: 'connect' },
            'Opening Figma',
            'Complete the approval in your browser to finish connecting.',
            'Connect failed',
        )
    }, [dispatch])

    return {
        syncOp,
        lastError,
        ready,
        pull,
        push,
        resolve,
        pullOne,
        connect,
    }
}
