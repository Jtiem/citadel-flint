/**
 * useDesignToCodeApply — src/hooks/useDesignToCodeApply.ts
 *
 * Phase D2C.2b: React hook that orchestrates the Design-to-Code apply flow.
 *
 * Responsibilities:
 *   - Calls `window.flintAPI.designToCode?.apply(request)` via IPC
 *   - On success: updates the workspace tree, switches canvas to preview mode,
 *     opens the page compositor file, and shows a success notification.
 *   - On error: shows an error notification.
 *   - Tracks in-flight state via `isApplying` so callers can disable UI
 *     navigation while the write is in progress.
 *
 * Process Boundary: no Node.js imports. All cross-boundary calls go through
 * `window.flintAPI.designToCode` (optional-chained for headless environments
 * such as Vitest or older preload versions).
 *
 * Store usage: uses `store.getState()` for imperative calls (not subscriptions)
 * to avoid triggering re-renders from store updates inside the hook body.
 */

import { useState, useCallback } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import type { D2CApplyRequest } from '../types/flint-api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseDesignToCodeApplyReturn {
    /**
     * Call with a D2CApplyRequest to atomically write component files to disk,
     * refresh the workspace tree, and open the page compositor in LivePreview.
     *
     * Returns true when the apply completed successfully, false on any failure
     * (IPC error, validation failure, missing API surface).
     */
    applyDesignToCode: (request: D2CApplyRequest) => Promise<boolean>
    /**
     * True while the apply IPC call is in flight.
     * Use this to disable navigation or show a loading indicator in the caller.
     */
    isApplying: boolean
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDesignToCodeApply(): UseDesignToCodeApplyReturn {
    const [isApplying, setIsApplying] = useState(false)

    const applyDesignToCode = useCallback(async (request: D2CApplyRequest): Promise<boolean> => {
        // Guard: if the designToCode API surface is not available (older preload
        // version, Vitest environment), fail gracefully without crashing.
        const api = window.flintAPI?.designToCode
        if (!api) {
            useNotificationStore.getState().push({
                type: 'error',
                title: 'Design to Code unavailable',
                message: 'The designToCode API is not available in this environment.',
                severity: 'error',
                autoDismissMs: 5000,
            })
            return false
        }

        setIsApplying(true)

        try {
            const result = await api.apply(request)

            if (!result.ok) {
                useNotificationStore.getState().push({
                    type: 'error',
                    title: 'Design to Code failed',
                    message: result.error ?? 'An unknown error occurred during file creation.',
                    severity: 'error',
                    autoDismissMs: 6000,
                })
                return false
            }

            // Update the workspace tree so the sidebar reflects the new files.
            // Use getState() for imperative store updates — not a subscription.
            useCanvasStore.getState().setWorkspaceFiles(result.workspaceTree)

            // Open the page compositor. This triggers the Clean Slate Protocol
            // (clearAST → readFile → setCode) which causes LivePreview to render.
            await useCanvasStore.getState().setActiveFile(result.pageFilePath)

            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'Page applied to canvas',
                message: `${request.pageName} is now live in the preview.`,
                severity: 'success',
                autoDismissMs: 4000,
            })

            return true
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            useNotificationStore.getState().push({
                type: 'error',
                title: 'Design to Code failed',
                message,
                severity: 'error',
                autoDismissMs: 6000,
            })
            return false
        } finally {
            setIsApplying(false)
        }
    }, [])

    return { applyDesignToCode, isApplying }
}
