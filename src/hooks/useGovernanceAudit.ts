/**
 * useGovernanceAudit — src/hooks/useGovernanceAudit.ts
 *
 * Owns: isAuditing, lastAuditRanAt, runAudit, auditError.
 * Extracted from GovernanceDashboard.tsx lines ~981-1002.
 *
 * Triggers an on-demand `flint_audit` MCP tool call against the active file.
 * Handles error capture and cleanup on unmount.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useNotificationStore } from '../store/notificationStore'
import type { UseGovernanceAuditResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceAuditResult }

export function useGovernanceAudit(): UseGovernanceAuditResult {
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    const [isAuditing, setIsAuditing] = useState(false)
    const [lastAuditRanAt, setLastAuditRanAt] = useState<number | null>(null)
    const [auditError, setAuditError] = useState<string | null>(null)

    // Track mounted state so we don't set state after unmount.
    const isMountedRef = useRef(true)
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    const runAudit = useCallback(async () => {
        if (!activeFilePath) return
        if (!isMountedRef.current) return

        setIsAuditing(true)
        setAuditError(null)

        try {
            if (!window.flintAPI.mcp) return
            await window.flintAPI.mcp.callTool('flint_audit', { file: activeFilePath })
            if (isMountedRef.current) {
                setLastAuditRanAt(Date.now())
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error('[useGovernanceAudit] Run Audit failed:', msg)
            if (isMountedRef.current) {
                setAuditError(msg)
                useNotificationStore.getState().push({
                    type: 'error',
                    title: 'Audit failed',
                    message: `Could not run the audit — ${msg}`,
                    severity: 'error',
                    autoDismissMs: 8000,
                })
            }
        } finally {
            if (isMountedRef.current) {
                setIsAuditing(false)
            }
        }
    }, [activeFilePath])

    return {
        isAuditing,
        lastAuditRanAt,
        runAudit,
        auditError,
    }
}
