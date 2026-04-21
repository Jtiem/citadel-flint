/**
 * DetectionBanner.tsx — FORGE.2d + FORGE.3a + FORGE.3b + FORGE.4c + FORGE.4d
 *
 * Dismissible banner shown above the canvas when Flint detects the project
 * environment. Displays the detected stack (framework, CSS, TypeScript) and
 * an optional audit summary. Includes a "Run full audit" button when no
 * audit was run automatically.
 *
 * FORGE.3a: Progressive integration suggestions based on detected environment.
 * FORGE.3b: Figma connection as contextual suggestion (tokens but no Figma).
 * FORGE.4c: Scan progress bar (determinate when counts available, animated
 *           indeterminate otherwise).
 * FORGE.4d: Smart recommendations based on audit results and token state.
 *
 * Renders only when `environment` is non-null. Dismissed for the session
 * when the user clicks the close button.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { ProjectEnvironment } from '../../types/flint-api';
import { X, ArrowRight } from 'lucide-react';

// ── FORGE.3a: Integration suggestion definitions ─────────────────────────────

export interface IntegrationSuggestion {
  id: string;
  label: string;
  description: string;
  actionLabel: string;
}

/**
 * Derives up to 3 contextual next-step suggestions based on the detected
 * environment. Most relevant suggestions sort first.
 */
export function deriveSuggestions(env: ProjectEnvironment, figmaConnected: boolean): IntegrationSuggestion[] {
  const suggestions: IntegrationSuggestion[] = [];

  // Tailwind detected but no tokens — high relevance
  if (env.cssFramework?.name === 'tailwindcss' && !env.hasDesignTokens) {
    suggestions.push({
      id: 'import-tailwind-tokens',
      label: 'Import Tailwind tokens',
      description: 'Import your Tailwind config as design tokens',
      actionLabel: 'Import tokens'
    });
  }

  // React/Vue/Svelte detected but no component library — medium relevance
  if (env.framework && ['react', 'vue', 'svelte', 'angular'].includes(env.framework.name) && !env.componentLibrary) {
    suggestions.push({
      id: 'set-component-library',
      label: 'Set component library',
      description: 'Set a component library to enable registry governance',
      actionLabel: 'Choose library'
    });
  }

  // FORGE.3b: Tokens present but no Figma connection — contextual Figma prompt
  if (env.hasDesignTokens && !figmaConnected) {
    suggestions.push({
      id: 'connect-figma',
      label: 'Connect Figma',
      description: 'Connect Figma to enable token sync',
      actionLabel: 'Connect'
    });
  }
  return suggestions.slice(0, 3);
}
export interface DetectionBannerProps {
  environment: ProjectEnvironment | null;
  /** Callback fired when the user clicks "Run full audit". */
  onRunAudit?: () => void;
  /** FORGE.4c: Whether a scan is currently in progress. */
  isScanning?: boolean;
  /** FORGE.4c: File-level scan progress (determinate mode). */
  scanProgress?: {
    filesScanned: number;
    totalFiles: number;
  };
  /** FORGE.3a: Whether Figma is currently connected (drives suggestion logic). */
  figmaConnected?: boolean;
  /** FORGE.3a: Callback fired when the user clicks a suggestion action button. */
  onSuggestionAction?: (suggestionId: string) => void;
}
export function DetectionBanner({
  environment,
  onRunAudit,
  isScanning,
  scanProgress,
  figmaConnected = false,
  onSuggestionAction
}: DetectionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [allSuggestionsDismissed, setAllSuggestionsDismissed] = useState(false);
  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);
  const handleDismissSuggestion = useCallback((id: string) => {
    setDismissedSuggestions(prev => new Set(prev).add(id));
  }, []);
  const handleDismissAllSuggestions = useCallback(() => {
    setAllSuggestionsDismissed(true);
  }, []);

  // FORGE.3a: Derive suggestions from environment
  const suggestions = useMemo(() => {
    if (!environment || allSuggestionsDismissed) return [];
    return deriveSuggestions(environment, figmaConnected).filter(s => !dismissedSuggestions.has(s.id));
  }, [environment, figmaConnected, dismissedSuggestions, allSuggestionsDismissed]);
  if (!environment || dismissed) return null;

  // Build the detection summary string
  const parts: string[] = [];
  if (environment.uiFramework !== 'Unknown') {
    parts.push(environment.uiFramework);
  }
  if (environment.cssFrameworkLabel && environment.cssFrameworkLabel !== 'Unknown') {
    parts.push(environment.cssFrameworkLabel);
  }
  if (environment.componentLibraryLabel) {
    parts.push(environment.componentLibraryLabel);
  }
  const stackSummary = parts.length > 0 ? parts.join(' + ') : 'no known frameworks';

  // Component count badge (e.g. "89 components")
  const componentCountLabel = environment.componentCount > 0 ? `${environment.componentCount} component${environment.componentCount !== 1 ? 's' : ''}` : null;
  const hasAudit = environment.auditSummary != null;
  // Switch to vertical layout when we have extra content to show
  const hasExtendedContent = hasAudit || isScanning && !hasAudit || suggestions.length > 0;
  return <div role="status" aria-live="polite" className={`border-l-2 border-indigo-500 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 ${hasExtendedContent ? 'flex flex-col gap-1.5' : 'flex items-center gap-3'}`} data-testid="detection-banner">
            {/* Row 1: Stack summary + actions */}
            <div className="flex items-center gap-3">
                <span className="flex-1">
                    Flint detected: {stackSummary}
                    {componentCountLabel && <span className="ml-1 text-zinc-400" data-testid="component-count">
                            {' \u00B7 '}{componentCountLabel}
                        </span>}
                    {hasAudit && <span className="ml-1 text-zinc-400">
                            {' \u00B7 '}{environment.auditSummary!.violations} issue{environment.auditSummary!.violations !== 1 ? 's' : ''} found
                        </span>}
                </span>

                {!hasAudit && !isScanning && onRunAudit && <button type="button" onClick={onRunAudit} className="shrink-0 rounded bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors">
                        Run full audit
                    </button>}

                <button type="button" onClick={handleDismiss} aria-label="Dismiss detection banner" className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors" data-testid="detection-banner-dismiss">
                    <X size={14} />
                </button>
            </div>

            {/* FORGE.4c: Scan progress bar */}
            {isScanning && !hasAudit && <div className="flex items-center gap-2" data-testid="scan-progress">
                    <div className="h-1 flex-1 rounded bg-zinc-700 overflow-hidden">
                        <div className={`h-full rounded transition-all duration-300 ${scanProgress ? 'bg-indigo-500' : 'bg-indigo-500 animate-scan-indeterminate'}`} style={scanProgress ? {
          width: `${Math.round(scanProgress.filesScanned / Math.max(scanProgress.totalFiles, 1) * 100)}%`
        } : undefined} data-testid="scan-progress-bar" />
                    </div>
                    <span className="text-[var(--spacing.2, 8px)] text-zinc-500 shrink-0" data-testid="scan-progress-label">
                        {scanProgress ? `${scanProgress.filesScanned}/${scanProgress.totalFiles} files` : 'Scanning...'}
                    </span>
                </div>}

            {/* FORGE.4d: Smart recommendations */}
            {hasAudit && <div className="space-y-0.5" data-testid="recommendations">
                    {environment.auditSummary!.violations > 10 && <p className="text-xs text-indigo-400">
                            → You have {environment.auditSummary!.violations} issues — Autopilot can auto-fix many in one click
                        </p>}
                    {environment.auditSummary!.violations > 0 && environment.auditSummary!.violations <= 10 && <p className="text-xs text-indigo-400">
                            → A few issues to address — try &quot;fix it&quot; to auto-remediate
                        </p>}
                    {environment.auditSummary!.violations === 0 && <p className="text-xs text-emerald-400">
                            → Looking clean! Export when ready.
                        </p>}
                    {!environment.tokenFormat && <p className="text-xs text-indigo-400">
                            → No design tokens detected — connect Figma or import a tokens file
                        </p>}
                    {environment.componentLibrary && !environment.hasDesignTokens && <p className="text-xs text-indigo-400" data-testid="recommendation-registry">
                            → {environment.componentLibraryLabel ?? environment.componentLibrary.name} detected but no tokens — enable registry governance
                        </p>}
                    {environment.hasDesignTokens && environment.componentCount > 0 && environment.auditSummary!.violations === 0 && !environment.cssFramework?.name?.includes('tailwind') && <p className="text-xs text-zinc-400" data-testid="recommendation-darkmode">
                            → Consider adding dark mode support for broader coverage
                        </p>}
                </div>}

            {/* FORGE.3a: Progressive integration suggestions */}
            {suggestions.length > 0 && <div className="space-y-1" data-testid="integration-suggestions">
                    <div className="flex items-center justify-between">
                        <span className="text-[var(--spacing.2, 8px)] font-medium uppercase tracking-wider text-zinc-500">
                            Next steps
                        </span>
                        {suggestions.length > 1 && <button type="button" onClick={handleDismissAllSuggestions} className="text-[var(--spacing.2, 8px)] text-zinc-600 transition-colors hover:text-zinc-400" data-testid="dismiss-all-suggestions">
                                Dismiss all
                            </button>}
                    </div>
                    {suggestions.map(suggestion => <div key={suggestion.id} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-800/40 px-2 py-1.5" data-testid={`suggestion-${suggestion.id}`}>
                            <span className="flex-1 text-xs text-zinc-300">
                                {suggestion.description}
                            </span>
                            {onSuggestionAction && <button type="button" onClick={() => onSuggestionAction(suggestion.id)} className="flex shrink-0 items-center gap-1 rounded bg-indigo-600/80 px-2 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-white transition-colors hover:bg-indigo-500" data-testid={`suggestion-action-${suggestion.id}`}>
                                    {suggestion.actionLabel}
                                    <ArrowRight size={10} aria-hidden="true" />
                                </button>}
                            <button type="button" onClick={() => handleDismissSuggestion(suggestion.id)} aria-label={`Dismiss suggestion: ${suggestion.label}`} className="shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400" data-testid={`suggestion-dismiss-${suggestion.id}`}>
                                <X size={12} aria-hidden="true" />
                            </button>
                        </div>)}
                </div>}
        </div>;
}