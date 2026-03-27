/**
 * GovernanceDashboard.tsx — Phase V.1 + Delta Mode (Gap 6)
 *
 * Persistent health monitoring panel rendered in the right sidebar when the
 * "health" tab is active.  All data is derived entirely from Zustand state
 * (editorStore.linterWarnings + canvasStore.a11yViolations /
 * canvasStore.overridesExist) so there is no polling, no IPC, and no
 * external dependency — fully local-first per Architecture Commandment 4.
 *
 * Health score formula (spec §V.1):
 *   score = 100 - (mithrilCount × 5) - (a11yCount × 10) - (overrideCount × 3)
 *   clamped to [0, 100].
 *
 * Grade mapping:
 *   A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60
 *
 * Delta Mode (Gap 6):
 *   When the user clicks "Set Baseline", all current violations are written to
 *   the violation_baselines SQLite table.  From that point the health score and
 *   violation list only count NEW violations — ones not present at snapshot time.
 *   A "Delta Mode" badge appears in the header.  "Clear Baseline" resets.
 *
 * Mithril compliance:
 *   - No hardcoded hex colours — all classes use Flint token palette.
 *   - No arbitrary spacing — all spacing from the 4 px grid scale.
 *   - data-flint-id is not required here (dashboard is not canvas-selectable).
 */

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useGovernanceStore } from '../../store/governanceStore'
import type { LinterWarning, BaselineEntry } from '../../types/flint-api'
import { auditDelta } from '../../utils/deltaAudit'
import { CoverageBar } from './CoverageBar'
import { InheritanceChain } from './InheritanceChain'
import { useGovernanceConfig } from '../../hooks/useGovernanceConfig'

// ── Score / grade helpers ─────────────────────────────────────────────────────

function computeHealthScore(
    mithrilCount: number,
    a11yCount: number,
    overrideCount: number,
): number {
    const raw = 100 - mithrilCount * 5 - a11yCount * 10 - overrideCount * 3
    return Math.max(0, Math.min(100, raw))
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
}

// ── Grade → token colour maps ─────────────────────────────────────────────────

const GRADE_TEXT: Record<string, string> = {
    A: 'text-emerald-400',
    B: 'text-emerald-400',
    C: 'text-amber-400',
    D: 'text-amber-400',
    F: 'text-red-400',
}

const GRADE_RING: Record<string, string> = {
    A: 'stroke-emerald-400',
    B: 'stroke-emerald-400',
    C: 'stroke-amber-400',
    D: 'stroke-amber-400',
    F: 'stroke-red-400',
}

const SEVERITY_DOT: Record<LinterWarning['severity'], string> = {
    critical: 'bg-red-400',
    amber: 'bg-amber-400',
}

const SEVERITY_BADGE: Record<LinterWarning['severity'], string> = {
    critical: 'bg-red-900/30 text-red-400 border border-red-700/40',
    amber: 'bg-amber-900/20 text-amber-400 border border-amber-500/30',
}

// ── Violation type → short label ─────────────────────────────────────────────

const TYPE_LABEL: Record<LinterWarning['type'], string> = {
    'color-drift':      'Color Drift',
    'typography-drift': 'Typography',
    'spacing-drift':    'Spacing',
    'shadow-drift':     'Shadow',
    'opacity-drift':    'Opacity',
    'a11y':             'A11y',
    'semantic-drift':   'Semantic',
}

// ── Score ring (SVG) ──────────────────────────────────────────────────────────

interface ScoreRingProps {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

function ScoreRing({ score, grade }: ScoreRingProps) {
    const RADIUS = 34
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS
    const filled = (score / 100) * CIRCUMFERENCE
    const gap    = CIRCUMFERENCE - filled

    return (
        <svg
            width={80}
            height={80}
            viewBox="0 0 80 80"
            className="shrink-0"
            aria-label={`Health score ${score} out of 100`}
            role="img"
        >
            {/* Track */}
            <circle
                cx={40}
                cy={40}
                r={RADIUS}
                fill="none"
                className="stroke-zinc-800"
                strokeWidth={6}
            />
            {/* Progress arc — rotated so it starts at the top */}
            <circle
                cx={40}
                cy={40}
                r={RADIUS}
                fill="none"
                className={GRADE_RING[grade]}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={`${filled} ${gap}`}
                transform="rotate(-90 40 40)"
            />
            {/* Centre score label */}
            <text
                x={40}
                y={44}
                textAnchor="middle"
                className="fill-zinc-100"
                fontSize={16}
                fontWeight={700}
                fontFamily="inherit"
            >
                {score}
            </text>
        </svg>
    )
}

// ── Aggregated rule row ───────────────────────────────────────────────────────

interface RuleRow {
    type: LinterWarning['type']
    severity: LinterWarning['severity']
    count: number
}

// ── Delta Mode state ──────────────────────────────────────────────────────────

type BaselineStatus = 'idle' | 'setting' | 'clearing'

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceDashboard() {
    // Zustand selectors — one per slice to minimise re-renders.
    const linterWarnings       = useEditorStore((s) => s.linterWarnings)
    const a11yViolations       = useCanvasStore((s) => s.a11yViolations)
    const overridesExist       = useCanvasStore((s) => s.overridesExist)
    const activeFilePath       = useCanvasStore((s) => s.activeFilePath)
    const jurisdictionCoverage = useGovernanceStore((s) => s.jurisdictionCoverage)
    const inheritanceChain     = useGovernanceStore((s) => s.inheritanceChain)

    // ERM: load resolved config on mount and subscribe to changes
    const { isLoading: isLoadingConfig } = useGovernanceConfig()

    // ── Delta Mode state ──────────────────────────────────────────────────────
    const [isBaselineSet, setIsBaselineSet] = useState(false)
    const [baselineEntries, setBaselineEntries] = useState<BaselineEntry[]>([])
    const [baselineStatus, setBaselineStatus] = useState<BaselineStatus>('idle')
    const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null)

    // On mount (and when the active file changes) check whether a baseline is set
    // and fetch entries for the current file.
    useEffect(() => {
        const api = window.flintAPI.baseline
        if (!api) return

        void api.isSet().then(setIsBaselineSet)

        if (activeFilePath) {
            void api.get(activeFilePath).then(setBaselineEntries)
        } else {
            setBaselineEntries([])
        }
    }, [activeFilePath])

    // ── Flatten linter warnings to an array for delta computation ─────────────
    const allLinterWarnings = useMemo<LinterWarning[]>(
        () => Array.from(linterWarnings.values()),
        [linterWarnings],
    )

    // Synthesise a11y violations into the LinterWarning shape so they participate
    // in delta filtering alongside Mithril violations.
    const allA11yWarnings = useMemo<LinterWarning[]>(
        () =>
            Object.entries(a11yViolations).map(([nodeId, msg]) => ({
                id: nodeId,
                type: 'a11y' as const,
                severity: 'critical' as const,
                value: 1,
                message: String(msg),
                nearestToken: null,
                nearestTokenValue: null,
            })),
        [a11yViolations],
    )

    // ── Apply delta filter when baseline is active ────────────────────────────
    const effectiveLinterWarnings = useMemo<LinterWarning[]>(() => {
        if (!isBaselineSet || baselineEntries.length === 0) return allLinterWarnings
        return auditDelta(allLinterWarnings, baselineEntries)
    }, [isBaselineSet, baselineEntries, allLinterWarnings])

    const effectiveA11yWarnings = useMemo<LinterWarning[]>(() => {
        if (!isBaselineSet || baselineEntries.length === 0) return allA11yWarnings
        return auditDelta(allA11yWarnings, baselineEntries)
    }, [isBaselineSet, baselineEntries, allA11yWarnings])

    // ── Derived counts (delta-aware) ──────────────────────────────────────────
    const mithrilCount  = effectiveLinterWarnings.length
    const a11yCount     = effectiveA11yWarnings.length
    const overrideCount = overridesExist ? 1 : 0

    const score = computeHealthScore(mithrilCount, a11yCount, overrideCount)
    const grade = gradeFromScore(score)

    // ── Top-5 violated rules (aggregated by type + severity) ─────────────────
    const topRules = useMemo<RuleRow[]>(() => {
        const buckets = new Map<string, RuleRow>()

        for (const warning of effectiveLinterWarnings) {
            const key = `${warning.type}:${warning.severity}`
            const existing = buckets.get(key)
            if (existing) {
                existing.count += 1
            } else {
                buckets.set(key, {
                    type: warning.type,
                    severity: warning.severity,
                    count: 1,
                })
            }
        }

        // A11y violations (delta-filtered) — synthetic row.
        if (a11yCount > 0) {
            buckets.set('a11y:critical', {
                type: 'a11y',
                severity: 'critical',
                count: a11yCount,
            })
        }

        return Array.from(buckets.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
    }, [effectiveLinterWarnings, a11yCount])

    // ── Active file name ──────────────────────────────────────────────────────
    const activeFileName = activeFilePath
        ? activeFilePath.split('/').pop() ?? activeFilePath
        : null

    // ── Total violation count before delta filter (for confirmation message) ──
    const totalRaw = allLinterWarnings.length + allA11yWarnings.length

    // ── Set Baseline handler ──────────────────────────────────────────────────
    const handleSetBaseline = useCallback(async () => {
        const api = window.flintAPI.baseline
        if (!api || !activeFilePath) return

        setBaselineStatus('setting')

        // Flatten all current violations — Mithril + A11y — into the payload shape.
        const violations = [...allLinterWarnings, ...allA11yWarnings].map((v) => ({
            nodeId: v.id,
            ruleId: v.type,
            severity: v.severity,
            filePath: activeFilePath,
            value: String(v.value),
        }))

        await api.set(violations)

        // Refresh local state from the db to be authoritative.
        const [nowSet, entries] = await Promise.all([
            api.isSet(),
            api.get(activeFilePath),
        ])
        setIsBaselineSet(nowSet)
        setBaselineEntries(entries)
        setBaselineStatus('idle')
        setConfirmationMsg(
            `Baseline set — ${violations.length} existing violation${violations.length !== 1 ? 's' : ''} marked as known`,
        )
        // Auto-dismiss the confirmation after 4 seconds.
        setTimeout(() => setConfirmationMsg(null), 4000)
    }, [activeFilePath, allLinterWarnings, allA11yWarnings])

    // ── Clear Baseline handler ────────────────────────────────────────────────
    const handleClearBaseline = useCallback(async () => {
        const api = window.flintAPI.baseline
        if (!api) return

        setBaselineStatus('clearing')
        await api.clear()
        setIsBaselineSet(false)
        setBaselineEntries([])
        setBaselineStatus('idle')
        setConfirmationMsg('Baseline cleared — all violations are now visible')
        setTimeout(() => setConfirmationMsg(null), 4000)
    }, [])

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col">

            {/* ── Header section ───────────────────────────────────────── */}
            <div className="border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Governance Health
                </h3>

                {/* Delta Mode badge */}
                {isBaselineSet && (
                    <span
                        className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-900/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400"
                        title="Delta Mode — only new violations since the baseline are counted. Click 'Clear Baseline' below to show all violations again."
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                        Delta Mode
                    </span>
                )}
            </div>

            {/* ── Score hero ───────────────────────────────────────────── */}
            <div className="flex items-center gap-4 px-4 py-5">
                <ScoreRing score={score} grade={grade} />

                <div className="flex flex-col gap-0.5">
                    <span
                        className={`text-6xl font-bold leading-none ${GRADE_TEXT[grade]}`}
                        aria-label={`Grade ${grade}`}
                    >
                        {grade}
                    </span>
                    <span className="text-xs text-zinc-500">
                        {isBaselineSet ? 'Delta Score (new issues only)' : 'Governance Health'}
                    </span>
                </div>
            </div>

            {/* ── Penalty breakdown ────────────────────────────────────── */}
            <div className="border-b border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Penalty Breakdown
                </h3>
            </div>
            <div className="px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Mithril violations</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-zinc-100">{mithrilCount}</span>
                        <span className="text-xs text-zinc-600">× 5 pts</span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Accessibility violations</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-zinc-100">{a11yCount}</span>
                        <span className="text-xs text-zinc-600">× 10 pts</span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Active overrides</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-zinc-100">{overrideCount}</span>
                        <span className="text-xs text-zinc-600">× 3 pts</span>
                    </div>
                </div>
            </div>

            {/* ── Top violated rules ───────────────────────────────────── */}
            <div className="border-b border-t border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Top Violated Rules
                    {isBaselineSet && (
                        <span className="ml-1.5 text-indigo-400">(new only)</span>
                    )}
                </h3>
            </div>
            <div className="px-3 py-2 space-y-1">
                {topRules.length === 0 ? (
                    <p className="py-3 text-center text-xs text-zinc-600">
                        {isBaselineSet
                            ? 'No new violations since baseline'
                            : 'No violations — clean file'}
                    </p>
                ) : (
                    topRules.map((row) => (
                        <div
                            key={`${row.type}-${row.severity}`}
                            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/50 transition-colors"
                        >
                            {/* Severity dot */}
                            <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[row.severity]}`}
                                aria-hidden="true"
                            />
                            {/* Rule type label */}
                            <span className="flex-1 truncate text-xs text-zinc-300">
                                {TYPE_LABEL[row.type]}
                            </span>
                            {/* Severity badge */}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_BADGE[row.severity]}`}>
                                {row.severity}
                            </span>
                            {/* Count chip */}
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                {row.count}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* ── Active file ──────────────────────────────────────────── */}
            <div className="border-b border-t border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Active File
                </h3>
            </div>
            <div className="px-3 py-2">
                {activeFileName ? (
                    <div className="flex items-center gap-2 rounded px-2 py-1.5 bg-zinc-800/40">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                        <span
                            className="flex-1 truncate font-mono text-xs text-zinc-300"
                            title={activeFilePath ?? ''}
                        >
                            {activeFileName}
                        </span>
                        {mithrilCount + a11yCount > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                {mithrilCount + a11yCount}
                            </span>
                        )}
                    </div>
                ) : (
                    <p className="py-2 text-center text-xs text-zinc-600">
                        Single file active
                    </p>
                )}
            </div>

            {/* ── Override count chip ──────────────────────────────────── */}
            {overridesExist && (
                <>
                    <div className="border-b border-t border-zinc-800 px-3 py-2">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                            Active Overrides
                        </h3>
                    </div>
                    <div className="px-3 py-2">
                        <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-900/20 px-3 py-2">
                            <span className="flex-1 text-xs text-amber-400">
                                Property overrides are active — export is blocked.
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono">
                                {overrideCount}
                            </span>
                        </div>
                    </div>
                </>
            )}

            {/* ── Clean state ──────────────────────────────────────────── */}
            {score === 100 && (
                <div className="mx-3 mt-2 flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-900/10 px-3 py-2.5">
                    <span className="text-xs text-emerald-400">
                        {isBaselineSet
                            ? 'No new violations since baseline. File is export-ready.'
                            : 'All checks passing. File is export-ready.'}
                    </span>
                </div>
            )}

            {/* ── Confirmation toast ────────────────────────────────────── */}
            {confirmationMsg && (
                <div className="mx-3 mt-2 flex items-center gap-2 rounded border border-indigo-500/40 bg-indigo-900/20 px-3 py-2">
                    <span className="flex-1 text-xs text-indigo-300">{confirmationMsg}</span>
                </div>
            )}

            {/* ── Compliance Coverage (ERM) ─────────────────────────────── */}
            <CoverageBar
                coverages={jurisdictionCoverage}
                isLoading={isLoadingConfig}
            />

            {/* ── Config Inheritance (ERM) ──────────────────────────────── */}
            <InheritanceChain
                chain={inheritanceChain}
                isLoading={isLoadingConfig}
            />

            {/* ── Delta Mode footer controls ────────────────────────────── */}
            <div className="border-t border-zinc-800 px-3 py-3 flex items-center gap-2 mt-auto">
                {!isBaselineSet ? (
                    <button
                        type="button"
                        onClick={() => void handleSetBaseline()}
                        disabled={baselineStatus !== 'idle' || !activeFilePath}
                        className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-900/20 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {baselineStatus === 'setting'
                            ? 'Setting baseline…'
                            : `Set Baseline${totalRaw > 0 ? ` (${totalRaw})` : ''}`}
                    </button>
                ) : (
                    <>
                        <span className="flex-1 text-[10px] text-zinc-600">
                            {baselineEntries.length} violation{baselineEntries.length !== 1 ? 's' : ''} baselined
                        </span>
                        <button
                            type="button"
                            onClick={() => void handleClearBaseline()}
                            disabled={baselineStatus !== 'idle'}
                            className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-red-500/40 hover:bg-red-900/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {baselineStatus === 'clearing' ? 'Clearing…' : 'Clear Baseline'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
