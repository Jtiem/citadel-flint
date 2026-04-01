/**
 * DetectionBanner.tsx — FORGE.2d
 *
 * Dismissible banner shown above the canvas when Flint detects the project
 * environment. Displays the detected stack (framework, CSS, TypeScript) and
 * an optional audit summary. Includes a "Run full audit" button when no
 * audit was run automatically.
 *
 * Renders only when `environment` is non-null. Dismissed for the session
 * when the user clicks the close button.
 */

import React, { useState, useCallback } from 'react'
import type { ProjectEnvironment } from '../../types/flint-api'
import { X } from 'lucide-react'

export interface DetectionBannerProps {
    environment: ProjectEnvironment | null
    /** Callback fired when the user clicks "Run full audit". */
    onRunAudit?: () => void
}

export function DetectionBanner({ environment, onRunAudit }: DetectionBannerProps) {
    const [dismissed, setDismissed] = useState(false)

    const handleDismiss = useCallback(() => {
        setDismissed(true)
    }, [])

    if (!environment || dismissed) return null

    // Build the detection summary string
    const parts: string[] = []
    if (environment.uiFramework !== 'Unknown') {
        parts.push(environment.uiFramework)
    }
    if (environment.cssFramework !== 'Unknown') {
        parts.push(environment.cssFramework)
    }
    if (environment.typescript) {
        parts.push('TypeScript')
    }
    if (environment.componentLibrary) {
        parts.push(environment.componentLibrary)
    }
    if (environment.tokenFormat) {
        parts.push(environment.tokenFormat)
    }

    const stackSummary = parts.length > 0 ? parts.join(' + ') : 'no known frameworks'

    const hasAudit = environment.auditSummary != null

    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 border-l-2 border-indigo-500 bg-zinc-900 px-3 py-2 text-xs text-zinc-300"
            data-testid="detection-banner"
        >
            <span className="flex-1">
                Flint detected: {stackSummary}
                {hasAudit && (
                    <span className="ml-2 text-zinc-400">
                        — {environment.auditSummary!.violations} violation{environment.auditSummary!.violations !== 1 ? 's' : ''} found
                    </span>
                )}
            </span>

            {!hasAudit && onRunAudit && (
                <button
                    type="button"
                    onClick={onRunAudit}
                    className="shrink-0 rounded bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                    Run full audit
                </button>
            )}

            <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss detection banner"
                className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                data-testid="detection-banner-dismiss"
            >
                <X size={14} />
            </button>
        </div>
    )
}
