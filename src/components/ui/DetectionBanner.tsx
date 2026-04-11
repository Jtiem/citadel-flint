/**
 * DetectionBanner.tsx — FORGE.2d + FORGE.4c + FORGE.4d
 *
 * Dismissible banner shown above the canvas when Flint detects the project
 * environment. Displays the detected stack (framework, CSS, TypeScript) and
 * an optional audit summary. Includes a "Run full audit" button when no
 * audit was run automatically.
 *
 * FORGE.4c: Scan progress bar (determinate when counts available, animated
 *           indeterminate otherwise).
 * FORGE.4d: Smart recommendations based on audit results and token state.
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
    /** FORGE.4c: Whether a scan is currently in progress. */
    isScanning?: boolean
    /** FORGE.4c: File-level scan progress (determinate mode). */
    scanProgress?: { filesScanned: number; totalFiles: number }
}

export function DetectionBanner({ environment, onRunAudit, isScanning, scanProgress }: DetectionBannerProps) {
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
    if (environment.cssFrameworkLabel && environment.cssFrameworkLabel !== 'Unknown') {
        parts.push(environment.cssFrameworkLabel)
    }
    if (environment.componentLibraryLabel) {
        parts.push(environment.componentLibraryLabel)
    }

    const stackSummary = parts.length > 0 ? parts.join(' + ') : 'no known frameworks'

    // Component count badge (e.g. "89 components")
    const componentCountLabel = environment.componentCount > 0
        ? `${environment.componentCount} component${environment.componentCount !== 1 ? 's' : ''}`
        : null

    const hasAudit = environment.auditSummary != null
    // Switch to vertical layout when we have extra content to show
    const hasExtendedContent = hasAudit || (isScanning && !hasAudit)

    return (
        <div
            role="status"
            aria-live="polite"
            className={`border-l-2 border-indigo-500 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 ${
                hasExtendedContent ? 'flex flex-col gap-1.5' : 'flex items-center gap-3'
            }`}
            data-testid="detection-banner"
        >
            {/* Row 1: Stack summary + actions */}
            <div className="flex items-center gap-3">
                <span className="flex-1">
                    Flint detected: {stackSummary}
                    {componentCountLabel && (
                        <span className="ml-1 text-zinc-400" data-testid="component-count">
                            {' \u00B7 '}{componentCountLabel}
                        </span>
                    )}
                    {hasAudit && (
                        <span className="ml-1 text-zinc-400">
                            {' \u00B7 '}{environment.auditSummary!.violations} issue{environment.auditSummary!.violations !== 1 ? 's' : ''} found
                        </span>
                    )}
                </span>

                {!hasAudit && !isScanning && onRunAudit && (
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

            {/* FORGE.4c: Scan progress bar */}
            {isScanning && !hasAudit && (
                <div className="flex items-center gap-2" data-testid="scan-progress">
                    <div className="h-1 flex-1 rounded bg-zinc-700 overflow-hidden">
                        <div
                            className={`h-full rounded transition-all duration-300 ${
                                scanProgress ? 'bg-indigo-500' : 'bg-indigo-500 animate-scan-indeterminate'
                            }`}
                            style={scanProgress
                                ? { width: `${Math.round((scanProgress.filesScanned / Math.max(scanProgress.totalFiles, 1)) * 100)}%` }
                                : undefined
                            }
                            data-testid="scan-progress-bar"
                        />
                    </div>
                    <span className="text-[10px] text-zinc-500 shrink-0" data-testid="scan-progress-label">
                        {scanProgress ? `${scanProgress.filesScanned}/${scanProgress.totalFiles} files` : 'Scanning...'}
                    </span>
                </div>
            )}

            {/* FORGE.4d: Smart recommendations */}
            {hasAudit && (
                <div className="space-y-0.5" data-testid="recommendations">
                    {environment.auditSummary!.violations > 10 && (
                        <p className="text-xs text-indigo-400">
                            → Start with auto-fixable issues — Autopilot can handle many instantly
                        </p>
                    )}
                    {environment.auditSummary!.violations > 0 && environment.auditSummary!.violations <= 10 && (
                        <p className="text-xs text-indigo-400">
                            → A few issues to address — try &quot;fix it&quot; to auto-remediate
                        </p>
                    )}
                    {environment.auditSummary!.violations === 0 && (
                        <p className="text-xs text-emerald-400">
                            → Looking clean! Export when ready.
                        </p>
                    )}
                    {!environment.tokenFormat && (
                        <p className="text-xs text-indigo-400">
                            → No design tokens detected — connect Figma to get started
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
