/**
 * DriftDetector — src/components/inspector/DriftDetector.tsx
 *
 * Inspector section for the Soft Mithril 'Systemize' workflow.
 *
 * For the currently selected JSX node it:
 *   1. Scans the AST for hardcoded Tailwind arbitrary colour classes
 *      (e.g. bg-[#f3f3f3], hover:text-[#000]).
 *   2. Matches each against the design token store using CIEDE2000.
 *   3. Shows a ΔE badge per class:
 *        ΔE < 2  → emerald  "Auto-fixable" — perceptually indistinguishable
 *        ΔE 2–5  → amber    noticeable drift
 *        ΔE > 5  → red      significant drift
 *   4. Exposes a "Fix" button for systemizable matches that calls
 *      applyTokenFix to surgically swap the class in the AST.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Zap } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useTokenStore } from '../../store/tokenStore'
import { scanArbitraryColors } from '../../utils/astScanner'
import { findClosestToken } from '../../utils/tokenMatcher'
import { normalizePath } from '../../utils/classMapper'
import type { DriftCandidate } from '../../utils/astScanner'
import type { TokenMatch } from '../../utils/tokenMatcher'

// ── ΔE badge styling ──────────────────────────────────────────────────────────

function deltaEBadgeClass(deltaE: number): string {
    if (deltaE < 2) return 'bg-emerald-900/40 text-emerald-400 border-emerald-800/60'
    if (deltaE < 5) return 'bg-amber-900/40 text-amber-400 border-amber-800/60'
    return 'bg-red-900/40 text-red-400 border-red-800/60'
}

function deltaELabel(deltaE: number): string {
    if (deltaE < 2) return 'Exact match'
    if (deltaE < 5) return 'Minor drift'
    return 'Significant drift'
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface DriftRowProps {
    candidate: DriftCandidate
    match: TokenMatch | null
    onFix: (candidate: DriftCandidate, match: TokenMatch) => void
}

function DriftRow({ candidate, match, onFix }: DriftRowProps) {
    return (
        <div className="group flex flex-col gap-1 border-b border-gray-800/60 px-3 py-2 last:border-0">
            {/* Detected class + colour swatch */}
            <div className="flex items-center gap-1.5">
                {/* Colour swatch */}
                <span
                    className="h-3 w-3 shrink-0 rounded-sm border border-white/10"
                    style={{ backgroundColor: candidate.rawValue }}
                    title={candidate.rawValue}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-amber-400">
                    {candidate.fullClass}
                </span>
                {match !== null ? (
                    <span
                        className={`shrink-0 rounded border px-1 py-px text-[10px] ${deltaEBadgeClass(match.deltaE)}`}
                    >
                        {deltaELabel(match.deltaE)}{' '}
                        <span className="opacity-60 font-mono">ΔE {match.deltaE.toFixed(1)}</span>
                    </span>
                ) : (
                    <span className="text-[10px] text-zinc-400">No off-brand colors found</span>
                )}
            </div>

            {/* Suggestion row */}
            {match !== null && (
                <div className="flex items-center gap-1.5 pl-[18px]">
                    <span className="text-[10px] text-zinc-500">→</span>
                    {/* Token colour swatch */}
                    <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/10"
                        style={{ backgroundColor: match.tokenValue }}
                        title={match.tokenValue}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-500">
                        {match.tokenPath}
                    </span>
                    {match.systemizable && (
                        <button
                            type="button"
                            onClick={() => onFix(candidate, match)}
                            className="flex shrink-0 items-center gap-0.5 rounded border border-emerald-800/60 bg-emerald-900/30 px-1.5 py-px text-[10px] text-emerald-400 transition-colors hover:bg-emerald-900/60"
                            title="Apply token fix"
                        >
                            <Zap className="h-2.5 w-2.5" />
                            Fix
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// ── DriftDetector ─────────────────────────────────────────────────────────────

export function DriftDetector() {
    const ast = useEditorStore((s) => s.ast)
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
    const applyTokenFix = useEditorStore((s) => s.applyTokenFix)
    const tokens = useTokenStore((s) => s.tokens)

    // Scan the entire AST for drift candidates, memoised on the ast reference.
    // Re-runs only when the AST changes (i.e. after any mutation).
    const allCandidates = useMemo(
        () => (ast !== null ? scanArbitraryColors(ast as any) : []),
        [ast]
    )

    // Filter to the selected node only.
    const candidates = useMemo(
        () => allCandidates.filter((c) => c.nodeId === selectedNodeId),
        [allCandidates, selectedNodeId]
    )

    if (candidates.length === 0) return null

    function handleFix(candidate: DriftCandidate, match: TokenMatch): void {
        if (selectedNodeId === null) return
        // Rebuild the replacement class: preserve variant chain + prefix + token suffix
        const suffix = normalizePath(match.tokenPath, 'color')
        const tokenClass = `${candidate.variantChain}${candidate.prefix}-${suffix}`
        applyTokenFix(selectedNodeId, candidate.fullClass, tokenClass)
    }

    const systemizableCount = candidates.filter((c) => {
        const m = findClosestToken(c.rawValue, tokens)
        return m?.systemizable === true
    }).length

    return (
        <div className="flex flex-col border-t border-gray-800">
            {/* Section header */}
            <div className="flex shrink-0 items-center gap-1.5 px-3 py-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/80">
                    Color Alignment
                </span>
                {systemizableCount > 0 && (
                    <span className="ml-auto rounded bg-emerald-900/40 px-1.5 py-px text-[10px] text-emerald-400">
                        {systemizableCount} fixable
                    </span>
                )}
            </div>

            {/* Candidate rows */}
            <div className="flex flex-col">
                {candidates.map((candidate) => {
                    const match = findClosestToken(candidate.rawValue, tokens)
                    return (
                        <DriftRow
                            key={candidate.fullClass}
                            candidate={candidate}
                            match={match}
                            onFix={handleFix}
                        />
                    )
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 border-t border-gray-800/60 px-3 py-1.5">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                <span className="text-[10px] text-zinc-500">ΔE&lt;2 auto-fixable</span>
                <span className="text-[10px] text-zinc-500">·</span>
                <span className="text-[10px] text-zinc-500">ΔE&gt;5 noticeable drift</span>
            </div>
        </div>
    )
}
