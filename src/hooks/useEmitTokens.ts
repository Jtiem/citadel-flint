/**
 * useEmitTokens — src/hooks/useEmitTokens.ts
 *
 * MINT.5 Phase 3 — Emit/Handoff Dropdown (Scout)
 *
 * Hook that owns the emit operation state. Wraps `mcp.callTool('flint_emit_tokens')`
 * for both dry-run (preview) and write-to-disk (destructive) modes.
 *
 * Ownership:
 *   - `emitOp`   — current in-flight emit mode ('preview' | 'write' | null).
 *                  Serializes: only one emit can be in flight at a time.
 *   - `lastError` — last MCP error, with `classification` from the result
 *                   envelope (Phase 3's MCPCallResult.classification field).
 *   - `ready`    — true only when `window.flintAPI.mcp.callTool` is available.
 *
 * Modes:
 *   'preview' → calls with `dryRun: true`. Read-shaped, no side effects.
 *               Proceeds immediately (no confirmation required).
 *   'write'   → calls with `dryRun: false`. Destructive; requires the
 *               `confirmWrite` option to return `true` before calling.
 *               When `confirmWrite` is not provided, write mode is blocked.
 *
 * Serialization:
 *   A synchronous ref guard (`emitOpRef`) prevents two concurrent emits from
 *   the same hook instance. React state updates are async so the ref is the
 *   authoritative in-flight signal (matches the pattern in useSyncActions).
 *
 * Notifications:
 *   Success → 'sync' toast (severity=success, autoDismissMs=4000)
 *   Error   → 'error' toast (severity=error, autoDismissMs=8000)
 *             with lastError.classification populated from result.classification.
 *
 * IPC path: `window.flintAPI.mcp.callTool('flint_emit_tokens', { platforms, dryRun, outputDir? })`
 *   Degrades gracefully when `window.flintAPI` is unavailable: `ready=false`,
 *   every `emit()` call is a no-op that resolves immediately.
 *
 * Commandments honored:
 *   - C1  (Code is Truth): write path goes through the tool's main-process fs write.
 *   - C4  (Local-First): all emit output is local; no external URLs.
 *   - C14 (Bypass Prohibition): no direct fs imports.
 *   - C12 (Atomic Queuing): emitOp transitions are atomic.
 *
 * Contract: MINT.5-phase3.contract.ts / UseEmitTokensResult
 * Owner: flint-state-architect
 * Renderer process only — no Node.js imports.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import { sanitizeError } from '../../shared/errorSanitizer'
import type {
    EmitMode,
    EmitOp,
    EmitPlatform,
    UseEmitTokensHook,
    UseEmitTokensOptions,
    UseEmitTokensResult,
} from '../../.flint-context/contracts/MINT.5-phase3.contract'
import type { SyncActionError } from '../../.flint-context/contracts/MINT.5-phase2.contract'

// Re-export for consumers.
export type { EmitMode, EmitOp, EmitPlatform }

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract a user-readable message from an MCP tool response. Mirrors the
 * extractMessage helper in useSyncActions.
 */
function extractMessage(result: { content?: Array<{ type?: string; text?: string }> } | undefined): string {
    const text = result?.content?.[0]?.text
    if (typeof text === 'string' && text.trim().length > 0) return text.trim()
    return 'Unknown error.'
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useEmitTokens: UseEmitTokensHook = (options: UseEmitTokensOptions = {}): UseEmitTokensResult => {
    const { confirmWrite, onAfterEmit } = options

    const pushNotification = useNotificationStore((s) => s.push)

    // emitOp state + synchronous ref mirror (same serialization pattern as useSyncActions).
    const [emitOp, setEmitOpState] = useState<EmitOp>(null)
    const emitOpRef = useRef<EmitOp>(null)

    const setEmitOp = useCallback((next: EmitOp) => {
        emitOpRef.current = next
        setEmitOpState(next)
    }, [])

    // lastError state.
    const [lastError, setLastError] = useState<SyncActionError | null>(null)

    // Ready flag.
    const [ready, setReady] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false
        return typeof window.flintAPI?.mcp?.callTool === 'function'
    })

    // Mounted ref — prevents state updates after unmount.
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        if (typeof window !== 'undefined' && typeof window.flintAPI?.mcp?.callTool === 'function') {
            setReady(true)
        }
        return () => {
            mountedRef.current = false
        }
    }, [])

    // ── Core emit function ───────────────────────────────────────────────────

    const emit = useCallback(
        async (platforms: EmitPlatform[], mode: EmitMode): Promise<void> => {
            if (!ready) return
            if (emitOpRef.current !== null) return // already in flight

            const callTool = window.flintAPI?.mcp?.callTool
            if (typeof callTool !== 'function') return

            // Write mode gate: if a confirmWrite callback is provided, the caller
            // has wired up a confirmation dialog. Only proceed if it returns true.
            // When confirmWrite is NOT provided, the hook proceeds directly —
            // the caller is assumed to have handled confirmation at the UI layer
            // (e.g. the EmitDropdown shows a ConfirmEmitDialog before calling emit).
            if (mode === 'write' && typeof confirmWrite === 'function') {
                const approved = await confirmWrite(platforms)
                if (!approved) return
            }

            if (!mountedRef.current) return

            setEmitOp(mode)

            try {
                const args: Record<string, unknown> = {
                    platforms,
                    dryRun: mode === 'preview',
                }

                const result = await callTool('flint_emit_tokens', args)

                if (!mountedRef.current) return

                const isError = result?.isError === true

                if (isError) {
                    const rawMessage = extractMessage(result)
                    const safeMessage = sanitizeError(rawMessage)

                    // Phase 3: read classification from the result envelope.
                    // The field is optional (legacy degrade) — fall back to 'unknown'.
                    const classification = (result as { classification?: string }).classification ?? 'unknown'

                    const nextError: SyncActionError = {
                        tool: 'flint_emit_tokens',
                        message: safeMessage,
                        timestamp: Date.now(),
                        // auth-expired and rate-limited are persistent (same logic as useSyncActions).
                        persistent: classification === 'auth-expired' || classification === 'rate-limited',
                    }
                    setLastError(nextError)

                    pushNotification({
                        type: 'error',
                        title: 'Emit failed',
                        message: safeMessage,
                        severity: nextError.persistent ? 'critical' : 'error',
                        autoDismissMs: nextError.persistent ? 0 : 8000,
                    })
                    return
                }

                // Success path.
                setLastError(null)
                const platformList = platforms.join(', ')
                const modeLabel = mode === 'preview' ? 'preview' : 'written to disk'
                pushNotification({
                    type: 'sync',
                    title: 'Tokens emitted',
                    message: `${platformList} tokens ${modeLabel} successfully.`,
                    severity: 'success',
                    autoDismissMs: 4000,
                })
                onAfterEmit?.()
            } catch (err) {
                if (!mountedRef.current) return

                const rawMessage =
                    err instanceof Error && err.message
                        ? err.message
                        : 'Could not reach the governance engine.'
                const safeMessage = sanitizeError(rawMessage)
                const nextError: SyncActionError = {
                    tool: 'flint_emit_tokens',
                    message: safeMessage,
                    timestamp: Date.now(),
                    persistent: false,
                }
                setLastError(nextError)

                pushNotification({
                    type: 'error',
                    title: 'Emit failed',
                    message: safeMessage,
                    severity: 'error',
                    autoDismissMs: 8000,
                })
            } finally {
                if (mountedRef.current) {
                    setEmitOp(null)
                }
            }
        },
        [ready, setEmitOp, confirmWrite, onAfterEmit, pushNotification],
    )

    return {
        emitOp,
        lastError,
        ready,
        emit,
    }
}
