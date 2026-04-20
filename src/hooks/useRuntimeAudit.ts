/**
 * useRuntimeAudit — src/hooks/useRuntimeAudit.ts
 *
 * The ONLY renderer-side consumer of `window.flintAPI.runtime.runAxe`.
 * Components must use this hook — never call the IPC surface directly
 * (Flint Architectural Anti-Pattern: IPC belongs in hooks/services,
 * not components, and NEVER inside a Zustand store action).
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 * Contract test boundaries:
 *   - `useRuntimeAudit happy path`
 *   - `useRuntimeAudit serialization` (invariant: `serialization` = 1 IPC call)
 *   - `useRuntimeAudit error surfacing`
 *   - `useRuntimeAudit reset on file change`
 *
 * Responsibilities:
 *   1. Expose `run(request?)` that calls `window.flintAPI.runtime.runAxe`
 *      and writes the result into `canvasStore.runtimeFindings` on success.
 *   2. Serialize concurrent `run()` calls — a second invocation while the
 *      first is still pending is a no-op (no extra IPC, no notification).
 *   3. Surface IPC rejections via `notificationStore` (severity: 'error',
 *      autoDismissMs: 8000 per contract) and leave `runtimeFindings` null.
 *   4. Track local `status` for the pill UI — mirrors `result.status` once
 *      the IPC resolves; otherwise 'idle' or 'running'.
 *   5. Expose `reset()` that clears both the hook-local status and the
 *      store slice. Called manually; the store itself also clears on
 *      `activeFilePath` change.
 */

import { useCallback, useRef, useState } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import type {
    RuntimeAuditRequest,
    RuntimeAuditResult,
    RuntimeAuditStatus,
} from '../types/runtime-audit'

// ── Local IPC shim ───────────────────────────────────────────────────────────
//
// Group A will extend flint-api.d.ts with the runtime namespace. Until that
// landing merges, we declare a minimal local shape so this hook compiles
// standalone. At runtime we optional-chain everything.

interface FlintAPIRuntimeNamespace {
    runAxe: (request: RuntimeAuditRequest) => Promise<RuntimeAuditResult>
}

// ── Hook return shape ────────────────────────────────────────────────────────

export interface UseRuntimeAuditResult {
    /** Hook-local status — 'running' while IPC in-flight, else mirrors result.status. */
    status: RuntimeAuditStatus
    /** Latest audit result, or null. Reads from canvasStore.runtimeFindings. */
    result: RuntimeAuditResult | null
    /**
     * Trigger an audit. A second call while `status === 'running'` is a no-op.
     * The optional `request` overrides are shallow-merged with defaults.
     */
    run: (request?: Partial<RuntimeAuditRequest>) => Promise<void>
    /** Resets both hook status and store slice to their initial state. */
    reset: () => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useRuntimeAudit(): UseRuntimeAuditResult {
    const [status, setStatus] = useState<RuntimeAuditStatus>('idle')

    // Ref mirror of the status so the `run` callback can check it without
    // recreating itself on every state change (which would re-subscribe any
    // consumers and cause infinite effect loops in components).
    const statusRef = useRef<RuntimeAuditStatus>('idle')

    // Read slices selector-style so the hook re-renders when findings change.
    const runtimeFindings = useCanvasStore((s) => s.runtimeFindings)
    const setRuntimeFindings = useCanvasStore((s) => s.setRuntimeFindings)
    const clearRuntimeFindings = useCanvasStore((s) => s.clearRuntimeFindings)

    const updateStatus = useCallback((next: RuntimeAuditStatus) => {
        statusRef.current = next
        setStatus(next)
    }, [])

    const run = useCallback(
        async (request?: Partial<RuntimeAuditRequest>): Promise<void> => {
            // ── Serialization guard (invariant: `serialization` = 1 IPC call) ──
            // A second invocation while the first is still pending is a no-op.
            // We do NOT emit a notification for the rejected call — that
            // would violate contract edge case "No notification emitted for
            // the rejected call".
            if (statusRef.current === 'running') return

            const api = (window as unknown as {
                flintAPI?: { runtime?: FlintAPIRuntimeNamespace }
            }).flintAPI?.runtime

            if (!api?.runAxe) {
                // IPC surface not available (Vitest headless before Group A
                // ships, or web build before adapter delivery). Surface as
                // error but do not throw — callers should handle the status.
                updateStatus('error')
                useNotificationStore.getState().push({
                    type: 'error',
                    severity: 'error',
                    title: 'Runtime audit unavailable',
                    message:
                        'The runtime audit engine is not connected. Restart Flint to retry.',
                    autoDismissMs: 8000,
                })
                return
            }

            updateStatus('running')

            // Build the payload. The previewHtml comes from either the caller's
            // partial override, or an empty string (which the adapter treats as
            // a sentinel and returns status: 'no-preview').
            const payload: RuntimeAuditRequest = {
                previewHtml: request?.previewHtml ?? '',
                previewUrl: request?.previewUrl,
                rules: request?.rules,
            }

            try {
                const response = await api.runAxe(payload)
                setRuntimeFindings(response)
                updateStatus(response.status)
            } catch (err) {
                // Leave runtimeFindings untouched (null per contract edge case)
                // and push an error notification matching the 8000ms autoDismiss
                // pattern used by other Flint error toasts.
                const message = err instanceof Error ? err.message : String(err)
                updateStatus('error')
                useNotificationStore.getState().push({
                    type: 'error',
                    severity: 'error',
                    title: 'Runtime audit failed',
                    // Defensive: never surface raw error strings longer than
                    // 200 chars — prevents stack traces or file paths leaking
                    // into a toast (aligns with StatusBar Figma error pattern).
                    message: message.slice(0, 200),
                    autoDismissMs: 8000,
                })
            }
        },
        [setRuntimeFindings, updateStatus],
    )

    const reset = useCallback(() => {
        clearRuntimeFindings()
        updateStatus('idle')
    }, [clearRuntimeFindings, updateStatus])

    return {
        status,
        result: runtimeFindings,
        run,
        reset,
    }
}
