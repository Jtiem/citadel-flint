/**
 * GovernanceDashboard.tsx — Phase V.1 + Delta Mode (Gap 6)
 *
 * Persistent health monitoring panel rendered in the right sidebar when the
 * "health" tab is active.  All data is derived entirely from Zustand state
 * (editorStore.linterWarnings + canvasStore.a11yViolations /
 * canvasStore.overridesExist) so there is no polling, no IPC, and no
 * external dependency — fully local-first per Architecture Commandment 4.
 *
 * Health score formula (canonical — matches debtReportService and MCP):
 *   score = 100 − (criticals × 10) − (warnings × 3) − (infos × 1) − (overrides × 3)
 *   clamped to [0, 100]. Computed via useGovernanceHealth hook.
 *   Severity mapping: critical → criticals, amber → warnings, advisory → infos.
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

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, Loader2, Play, ShieldOff, ShieldCheck, Wand2, SendHorizonal, Copy, Check, Activity, Pin, AlertTriangle, Flag, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useGovernanceStore } from '../../store/governanceStore'
import { useTokenStore } from '../../store/tokenStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { LinterWarning, BaselineEntry, ProvenanceInfo, AnomalyAlert } from '../../types/flint-api'
import { auditDelta } from '../../utils/deltaAudit'
import { CoverageBar } from './CoverageBar'
import { InheritanceChain } from './InheritanceChain'
import { useGovernanceConfig } from '../../hooks/useGovernanceConfig'
import { useUserPrefs } from '../../hooks/useUserPrefs'
import { FixPreviewDrawer, type FixableItem } from './FixPreviewDrawer'
import { applyUndo } from '../../core/recoveryController'
import { formatHealthSignal } from '../../../shared/healthSignal'
import type { DeferDuration } from '../../../shared/deferralUtils'
import { useGovernanceHealth, gradeFromScore } from '../../hooks/useGovernanceHealth'

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
    advisory: 'bg-indigo-400',
}

const SEVERITY_BADGE: Record<LinterWarning['severity'], string> = {
    critical: 'bg-red-900/30 text-red-400 border border-red-700/40',
    amber: 'bg-amber-900/20 text-amber-400 border border-amber-500/30',
    advisory: 'bg-indigo-900/20 text-indigo-400 border border-indigo-500/30',
}

// ── Violation type → short label ─────────────────────────────────────────────

const TYPE_LABEL: Record<LinterWarning['type'], string> = {
    'color-drift':        'Color Drift',
    'typography-drift':   'Typography',
    'spacing-drift':      'Spacing',
    'shadow-drift':       'Shadow',
    'opacity-drift':      'Opacity',
    'a11y':               'A11y',
    'semantic-drift':     'Semantic',
    'sync':               'Token Sync',
    'inline-style-drift': 'Inline Style',
    'registry':           'Registry',
}

// ── Node name lookup (human-readable layer name from visualTree) ──────────────

function getNodeName(id: string): string {
    const tree = useEditorStore.getState().visualTree
    const node = tree.find((n) => n.id === id)
    return node?.tagName ? `<${node.tagName}>` : `#${id.slice(0, 12)}`
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
            {/* Centre score label — aria-hidden since the containing SVG already
                 has aria-label with the full score context (Issue 8) */}
            <text
                x={40}
                y={44}
                textAnchor="middle"
                className="fill-zinc-100"
                fontSize={16}
                fontWeight={700}
                fontFamily="inherit"
                aria-hidden="true"
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

// ── Message parsing helpers (mirrors GovernanceOverlay) ──────────────────────

/**
 * Extracts the hardcoded class/value from a linter message.
 * Messages are formatted as: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set"
 */
function extractHardcodedClassFromMsg(message: string): string | null {
    const match = /'([^']+)'/.exec(message)
    return match ? match[1] : null
}

/**
 * Extracts the rule ID prefix from a linter message.
 * Messages are formatted as: "MITHRIL-COL-001: description"
 */
function extractRuleIdFromMsg(message: string): string | null {
    const match = /^([A-Z0-9-]+):/.exec(message)
    return match ? match[1] : null
}


// ── A11y fix guidance map ─────────────────────────────────────────────────────
//
// For each known rule ID, provides:
//   wcag  — the WCAG 2.1 criterion (links to W3C spec)
//   why   — 1-sentence "why it matters" for designers
//   steps — ordered list of concrete fix steps
//   snippet — optional copy-ready code hint

interface FixGuide {
    wcag: string
    wcagRef: string       // WCAG success criterion number
    why: string
    steps: string[]
    snippet?: string
}

const A11Y_FIX_GUIDE: Record<string, FixGuide> = {
    'A11Y-001': {
        wcag: 'WCAG 1.1.1 Non-text Content',
        wcagRef: '1.1.1',
        why: 'Screen readers announce images using alt text. Without it, the image is invisible to assistive tech users.',
        steps: [
            'Select the image element on the canvas',
            'In Properties, add an aria-alt or alt attribute',
            'Use a concise description of what the image conveys (not "image of…")',
            'For decorative images, set alt="" to hide from screen readers',
        ],
        snippet: 'alt="Descriptive text here"',
    },
    'A11Y-004': {
        wcag: 'WCAG 1.3.1 Info and Relationships / 4.1.2 Name, Role, Value',
        wcagRef: '4.1.2',
        why: 'Form inputs without a label are invisible to screen readers — users of assistive tech cannot understand what data to enter.',
        steps: [
            'Add a visible <label> element referencing the input\'s id attribute',
            'Or add aria-label="Field name" directly on the input',
            'Or use aria-labelledby pointing to an existing heading or text element',
        ],
        snippet: 'aria-label="Email address"',
    },
    'A11Y-002': {
        wcag: 'WCAG 1.4.3 Contrast (Minimum)',
        wcagRef: '1.4.3',
        why: 'Low contrast text is unreadable for users with low vision or in bright environments. AA requires 4.5:1 for normal text.',
        steps: [
            'Replace the current color token with one that meets 4.5:1 contrast against the background',
            'Use the Token panel to find compliant color alternatives',
            'Test with the Flint contrast checker or WebAIM Contrast Checker',
        ],
    },
    'A11Y-003': {
        wcag: 'WCAG 4.1.2 Name, Role, Value',
        wcagRef: '4.1.2',
        why: 'Interactive elements without an ARIA role are misidentified by screen readers, causing confusion and navigation barriers.',
        steps: [
            'Add the appropriate role attribute (e.g., role="button", role="dialog")',
            'Ensure the element also has an accessible name via aria-label or visible text',
        ],
        snippet: 'role="button" aria-label="Close dialog"',
    },
    'A11Y-005': {
        wcag: 'WCAG 2.4.3 Focus Order',
        wcagRef: '2.4.3',
        why: 'Keyboard users navigate by Tab — if focus skips or loops incorrectly, they lose their place in the page.',
        steps: [
            'Review the DOM order of interactive elements to match the visual order',
            'Avoid using tabindex values greater than 0',
            'Use tabindex="0" to include custom elements in natural tab order',
        ],
    },
    'A11Y-006': {
        wcag: 'WCAG 2.4.7 Focus Visible',
        wcagRef: '2.4.7',
        why: 'Keyboard users cannot see where they are on the page without a visible focus indicator.',
        steps: [
            'Add a visible :focus-visible style to the element',
            'Use the Flint focus-ring token (e.g., ring-indigo-500) instead of outline: none',
        ],
        snippet: 'focus-visible:ring-2 focus-visible:ring-indigo-500',
    },
}

const MITH_FIX_GUIDE: Record<string, FixGuide> = {
    'color-drift': {
        wcag: 'Flint Design System',
        wcagRef: '',
        why: 'Using a color outside the token set breaks visual consistency and makes brand updates manual instead of automatic.',
        steps: [
            'Click Fix to automatically replace with the nearest token',
            'Or open the Token panel to browse available color tokens',
            'Tokens auto-update when the design system is refreshed',
        ],
    },
    'typography-drift': {
        wcag: 'Flint Design System',
        wcagRef: '',
        why: 'Arbitrary font sizes and weights drift from the type scale, making the design feel inconsistent.',
        steps: [
            'Replace the custom value with the nearest typography token from the Token panel',
            'Common tokens: text-sm (14px), text-base (16px), text-lg (18px)',
        ],
    },
    'spacing-drift': {
        wcag: 'Flint Design System',
        wcagRef: '',
        why: 'Arbitrary spacing values break the 4px grid and cause visual misalignment.',
        steps: [
            'Replace with the nearest spacing token (e.g., p-2=8px, p-4=16px, p-6=24px)',
            'Click Fix to auto-apply the nearest token',
        ],
    },
}

function getFixGuide(
    type: LinterWarning['type'],
    message: string,
): FixGuide | null {
    const ruleId = extractRuleIdFromMsg(message)
    if (ruleId && A11Y_FIX_GUIDE[ruleId]) return A11Y_FIX_GUIDE[ruleId]
    return MITH_FIX_GUIDE[type] ?? null
}

// ── CopySnippet helper ───────────────────────────────────────────────────────

function CopySnippet({ snippet }: { snippet: string }) {
    const [copied, setCopied] = useState(false)
    const handleCopy = () => {
        void navigator.clipboard.writeText(snippet).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }
    return (
        <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[10px] text-indigo-300">
                {snippet}
            </code>
            <button
                type="button"
                onClick={handleCopy}
                className={`shrink-0 flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors ${
                    copied
                        ? 'border-emerald-500/40 bg-emerald-900/20 text-emerald-400'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                aria-label="Copy code snippet to clipboard"
            >
                {copied
                    ? <><Check size={9} aria-hidden="true" /> Copied</>     
                    : <><Copy size={9} aria-hidden="true" /> Copy</>}
            </button>
        </div>
    )
}

// ── Delta Mode state ──────────────────────────────────────────────────────────

type BaselineStatus = 'idle' | 'setting' | 'clearing'

// ── COUNSEL.1.4: Inline diff preview data ────────────────────────────────────

/** Data returned by governance.previewFix IPC (COUNSEL.1.4). */
interface InlineFixPreview {
    current: string
    proposed: string
    tokenName: string
    isColor: boolean
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GovernanceDashboardProps {
    onOpenExportModal?: () => void
    /** S5.8: Opens the full GovernancePanel rules manager */
    onOpenGovernancePanel?: () => void
    /**
     * COUNSEL.1.2: Total violation count at project open.
     * When > 10 and delta mode is currently off, auto-enables delta mode
     * and shows a contextual banner so designers focus on new issues.
     */
    initialViolationCount?: number
    /** COUNSEL.4.3: Navigate to the GovernancePanel rules manager */
    onManageRules?: () => void
    /** COUNSEL.4.3: Navigate to Policy Settings */
    onPolicySettings?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceDashboard({ onOpenExportModal, onOpenGovernancePanel, initialViolationCount, onManageRules, onPolicySettings }: GovernanceDashboardProps = {}) {
    // Zustand selectors — one per slice to minimise re-renders.
    const linterWarnings       = useEditorStore((s) => s.linterWarnings)
    const a11yViolations       = useCanvasStore((s) => s.a11yViolations)
    const overridesExist       = useCanvasStore((s) => s.overridesExist)
    const activeFilePath       = useCanvasStore((s) => s.activeFilePath)
    const jurisdictionCoverage = useGovernanceStore((s) => s.jurisdictionCoverage)
    const inheritanceChain     = useGovernanceStore((s) => s.inheritanceChain)
    const tokenCount           = useTokenStore((s) => s.tokens.length)
    const setRightTab          = useCanvasStore((s) => s.setRightTab)
    const unlockTab            = useCanvasStore((s) => s.unlockTab)
    const autopilotEnabled     = useCanvasStore((s) => s.autopilotEnabled)
    const setAutopilotEnabled  = useCanvasStore((s) => s.setAutopilotEnabled)
    const governedFixCount     = useCanvasStore((s) => s.governedFixCount)

    // GLASS.1e: Rule filter and audit state
    const setGovernanceRuleFilter = useCanvasStore((s) => s.setGovernanceRuleFilter)
    const [isAuditing, setIsAuditing] = useState(false)

    // Expandable violation cards — tracks which cards are open
    const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set())
    const toggleViolation = useCallback((key: string) => {
        setExpandedViolations((prev) => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else { next.add(key) }
            return next
        })
    }, [])

    // S5.9: Pinned violation cards — stay open regardless of expand toggle
    const [pinnedViolations, setPinnedViolations] = useState<Set<string>>(new Set())
    const togglePin = useCallback((key: string) => {
        setPinnedViolations((prev) => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else { next.add(key) }
            return next
        })
    }, [])

    // ERM: load resolved config on mount and subscribe to changes
    const { isLoading: isLoadingConfig } = useGovernanceConfig()

    // ── GOV.2: Override count (relocated from StatusBar — GLASS.3.4-B) ──────
    const [govOverrideCount, setGovOverrideCount] = useState<number>(0)

    const fetchOverrideCount = useCallback(() => {
        window.flintAPI.governance.getOverrideCount()
            .then(setGovOverrideCount)
            .catch(() => { /* governance IPC may not be ready on first paint */ })
    }, [])

    useEffect(() => {
        fetchOverrideCount()
        const unsubscribe = window.flintAPI.governance.onOverrideRecorded(() => {
            fetchOverrideCount()
        })
        return unsubscribe
    }, [fetchOverrideCount])

    // EDU-08: "How is this calculated?" collapsible — collapsed by default
    const [isScoreExpanded, setIsScoreExpanded] = useState(false)

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
            Object.entries(a11yViolations).map(([nodeId, msgs]) => ({
                id: nodeId,
                type: 'a11y' as const,
                severity: 'critical' as const,
                value: 1,
                message: msgs.join(', '),
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

    // ── COUNSEL.1.1 + COUNSEL.1.2: category filter + banner state ───────────
    const [activeCategory, setActiveCategory] = useState<'design-system' | 'accessibility' | 'token-sync' | null>(null)
    const [bannerDismissed, setBannerDismissed] = useState(false)

    // ── Derived counts (delta-aware) ──────────────────────────────────────────
    const mithrilCount  = effectiveLinterWarnings.length
    const a11yCount     = effectiveA11yWarnings.length
    // Use the real override count from IPC (govOverrideCount); fall back to 1
    // when overridesExist is true but the count hasn't loaded yet.
    const overrideCount = overridesExist ? Math.max(1, govOverrideCount) : 0

    // Combine effective violations for the canonical severity-weighted formula
    const allEffectiveViolations = useMemo(
        () => [...effectiveLinterWarnings, ...effectiveA11yWarnings],
        [effectiveLinterWarnings, effectiveA11yWarnings],
    )
    const { score, grade } = useGovernanceHealth(allEffectiveViolations, overrideCount)

    // ── COUNSEL.1.1: category chip counts + filtered violation lists ──────────
    const syncCount = effectiveLinterWarnings.filter((w) => w.type === 'sync').length
    const visibleLinterWarnings = activeCategory === null
        ? effectiveLinterWarnings
        : activeCategory === 'design-system' ? effectiveLinterWarnings.filter((w) => w.type !== 'sync')
        : activeCategory === 'token-sync' ? effectiveLinterWarnings.filter((w) => w.type === 'sync')
        : []
    const visibleA11yWarnings = (activeCategory === null || activeCategory === 'accessibility')
        ? effectiveA11yWarnings : []

    // ── COUNSEL.2.2: Flagged for Review state ──────────────────────────────
    const [flaggedCardKeys, setFlaggedCardKeys] = useState<Set<string>>(new Set())

    const handleFlag = useCallback(async (key: string, ruleId: string, nodeId: string) => {
        setFlaggedCardKeys((prev) => new Set([...prev, key]))
        // Persist via defer with [FLAGGED] prefix so it survives sessions
        try {
            if (window.flintAPI.governance.deferViolation) {
                await window.flintAPI.governance.deferViolation({
                    ruleId,
                    filePath: activeFilePath ?? '',
                    nodeId,
                    reason: '[FLAGGED] Flagged for review',
                    duration: 'Manually',
                })
            }
        } catch { /* best-effort persistence */ }
    }, [activeFilePath])

    const handleUnflag = useCallback((key: string) => {
        setFlaggedCardKeys((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
        })
    }, [])

    // ── COUNSEL.3.2: Provenance data ─────────────────────────────────────────
    const [provenanceMap, setProvenanceMap] = useState<Record<string, ProvenanceInfo>>({})

    useEffect(() => {
        if (!activeFilePath) {
            setProvenanceMap({})
            return
        }
        const api = window.flintAPI.governance
        if (api.getProvenanceSummary) {
            void api.getProvenanceSummary(activeFilePath)
                .then(setProvenanceMap)
                .catch(() => setProvenanceMap({}))
        }
    }, [activeFilePath])

    // ── COUNSEL.3.3: Anomaly alerts ──────────────────────────────────────────
    const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([])
    const [anomalyBannerDismissed, setAnomalyBannerDismissed] = useState(false)

    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getAnomalies) {
            void api.getAnomalies()
                .then(setAnomalies)
                .catch(() => setAnomalies([]))
        }
    }, [])

    // ── COUNSEL.2.2 + COUNSEL.2.4: effort framing text (excludes flagged violations) ──
    const unflaggedLinterWarnings = useMemo(
        () => effectiveLinterWarnings.filter((w) => !flaggedCardKeys.has(`m-${w.id}`)),
        [effectiveLinterWarnings, flaggedCardKeys],
    )
    const unflaggedA11yWarnings = useMemo(
        () => effectiveA11yWarnings.filter((w, i) => !flaggedCardKeys.has(`a-${w.id}-${i}`)),
        [effectiveA11yWarnings, flaggedCardKeys],
    )
    const autoFixableCount = unflaggedLinterWarnings.filter((w) => w.nearestToken !== null).length
    const effortText: string = (() => {
        const total = unflaggedLinterWarnings.length + unflaggedA11yWarnings.length
        if (total === 0) return 'No violations — looking good'
        if (autoFixableCount > 0) return `${autoFixableCount} auto-fixable — Autopilot can resolve ${autoFixableCount === 1 ? 'it' : 'them'} in one click`
        return `${total} ${total === 1 ? 'issue' : 'issues'} need your input to resolve`
    })()

    // ── Shared health signal (sub-scores for breakdown labels) ──────────────
    const healthSignal = useMemo(
        () => formatHealthSignal(mithrilCount, a11yCount, overrideCount),
        [mithrilCount, a11yCount, overrideCount],
    )

    // ── Next-step coaching sentence ──────────────────────────────────────────
    const nextStep = useMemo(() => {
        const total = mithrilCount + a11yCount + overrideCount
        if (score === 100) {
            return { variant: 'perfect' as const, text: 'Perfect score — your design system is fully in sync.' }
        }
        if (overrideCount > mithrilCount + a11yCount) {
            return { variant: 'override-dominant' as const, text: `${overrideCount} rule override${overrideCount !== 1 ? 's are' : ' is'} active. Review them in the Governance panel to restore full compliance.` }
        }
        if (score >= 90) {
            const category = a11yCount > mithrilCount ? 'accessibility gap' + (total !== 1 ? 's' : '') : 'design drift' + (total !== 1 ? 's' : '')
            return { variant: 'nearly-perfect' as const, text: `Nearly perfect. ${total} ${category} remain — say 'fix it' in your IDE to clean up.` }
        }
        if (a11yCount > 0 && mithrilCount > 0) {
            if (a11yCount > mithrilCount) {
                return { variant: 'a11y-dominant' as const, text: `${a11yCount} accessibility gap${a11yCount !== 1 ? 's are' : ' is'} pulling your score down. Run an a11y audit for details.` }
            }
            return { variant: 'mithril-dominant' as const, text: `${mithrilCount} color drift${mithrilCount !== 1 ? 's are' : ' is'} lowering your score. Say 'fix it' in your IDE to auto-remediate.` }
        }
        if (a11yCount > 0) {
            return { variant: 'a11y-dominant' as const, text: `${a11yCount} accessibility gap${a11yCount !== 1 ? 's are' : ' is'} pulling your score down. Run an a11y audit for details.` }
        }
        if (mithrilCount > 0) {
            return { variant: 'mithril-dominant' as const, text: `${mithrilCount} color drift${mithrilCount !== 1 ? 's are' : ' is'} lowering your score. Say 'fix it' in your IDE to auto-remediate.` }
        }
        // mixed fallback (overrides only, but not dominant)
        return { variant: 'mixed' as const, text: `${mithrilCount} drift${mithrilCount !== 1 ? 's' : ''} and ${a11yCount} accessibility gap${a11yCount !== 1 ? 's' : ''} need attention. Start with accessibility — it has the biggest score impact.` }
    }, [mithrilCount, a11yCount, overrideCount, score])

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
            `Baseline set — ${violations.length} existing ${violations.length !== 1 ? 'issues' : 'issue'} marked as known`,
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
        setConfirmationMsg('Baseline cleared — all issues are now visible')
        setTimeout(() => setConfirmationMsg(null), 4000)
    }, [])

    // ── GLASS.1e: Run Audit handler ────────────────────────────────────────
    const handleRunAudit = useCallback(async () => {
        if (!activeFilePath) return
        setIsAuditing(true)
        try {
            await window.flintAPI.mcp?.callTool('flint_audit', { file: activeFilePath })
        } catch (err) {
            console.error('[GovernanceDashboard] Run Audit failed:', err)
        } finally {
            setIsAuditing(false)
        }
    }, [activeFilePath])

    // ── GLASS.1e: Score trend hint — most impactful fix category ─────────
    const scoreTrendHint = useMemo<string | null>(() => {
        if (topRules.length === 0) return null
        const top = topRules[0]
        const label = TYPE_LABEL[top.type]
        // Compute what the next grade would be if those violations were fixed
        const pointsBack = top.type === 'a11y' ? top.count * 10 : top.count * 5
        const projectedScore = Math.min(100, score + pointsBack)
        const projectedGrade = gradeFromScore(projectedScore)
        if (projectedGrade === grade) {
            return `Fix ${top.count} ${label} issue${top.count !== 1 ? 's' : ''} to improve your score by ${pointsBack} points`
        }
        return `Fix ${top.count} ${label} issue${top.count !== 1 ? 's' : ''} to reach grade ${projectedGrade}`
    }, [topRules, score, grade])

    // ── Intent-first: Handle rule row click — stay on Governance tab ─────
    // No longer switches to Properties. Instead scrolls the violations
    // section into view so the user stays in context.
    const violationsSectionRef = useRef<HTMLDivElement>(null)
    const handleRuleRowClick = useCallback((type: LinterWarning['type']) => {
        setGovernanceRuleFilter(type)
        violationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [setGovernanceRuleFilter])

    // ── User fix preferences ─────────────────────────────────────────────────
    const [prefs] = useUserPrefs()

    // ── Fix preview state ─────────────────────────────────────────────────────
    const [fixPreviewItems, setFixPreviewItems] = useState<FixableItem[] | null>(null)

    // ── Auto-fixable Mithril violations (nearestToken present) ────────────────
    const autoFixableEntries = useMemo(
        () =>
            effectiveLinterWarnings
                .filter((w) => w.nearestToken !== null && extractHardcodedClassFromMsg(w.message) !== null)
                .map((w) => ({
                    nodeId: w.id,
                    label: `${extractRuleIdFromMsg(w.message) ?? w.type} — ${w.id.slice(0, 12)}`,
                    hardcodedClass: extractHardcodedClassFromMsg(w.message) ?? '',
                    tokenClass: w.nearestToken ?? '',
                })),
        [effectiveLinterWarnings],
    )

    // ── Inline fix handler (single violation) ─────────────────────────────────
    const handleFixSingle = useCallback((item: FixableItem) => {
        if (prefs.fixMode === 'auto') {
            useEditorStore.getState().applyBatch([{
                op: 'applyTokenFix',
                nodeId: item.nodeId,
                hardcodedClass: item.hardcodedClass,
                tokenClass: item.tokenClass,
            }])
        } else {
            setFixPreviewItems([item])
        }
    }, [prefs.fixMode])

    // ── Batch fix handler ─────────────────────────────────────────────────────
    const handleFixAll = useCallback(() => {
        if (autoFixableEntries.length === 0) return
        if (prefs.fixMode === 'auto') {
            useEditorStore.getState().applyBatch(
                autoFixableEntries.map((item) => ({
                    op: 'applyTokenFix' as const,
                    nodeId: item.nodeId,
                    hardcodedClass: item.hardcodedClass,
                    tokenClass: item.tokenClass,
                }))
            )
        } else {
            setFixPreviewItems(autoFixableEntries)
        }
    }, [autoFixableEntries, prefs.fixMode])

    // ── A11y fix handler — calls flint_fix via bidirectional MCP client ─────────
    const handleA11yFix = useCallback(async (ruleId: string) => {
        const filePath = useCanvasStore.getState().activeFilePath
        if (!filePath) {
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Fix failed',
                message: 'No active file — open a file before fixing',
                severity: 'warning',
                autoDismissMs: 4000,
            })
            return
        }
        try {
            await window.flintAPI.mcp?.callTool('flint_fix', { filePath, ruleId, dry_run: false })
            // Re-sync editor store so in-memory AST matches what MCP wrote to disk
            try {
                const content = await window.flintAPI.readFile(filePath)
                useEditorStore.getState().syncCode(content)
            } catch { /* best-effort — file watcher will catch it on next poll */ }
            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'Fix applied',
                message: `${ruleId} fixed in ${filePath.split('/').pop()}`,
                severity: 'info',
                autoDismissMs: 3000,
            })
            // Trigger re-audit so violations refresh
            void window.flintAPI.mcp?.callTool('flint_audit', { file: filePath }).catch(() => { /* best-effort */ })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Fix failed',
                message: `Fix failed — ${msg}`,
                severity: 'warning',
                autoDismissMs: 5000,
            })
        }
    }, [])

    // ── Apply confirmed fix(es) from preview drawer ───────────────────────────
    const handleApplyPreview = useCallback(() => {
        if (!fixPreviewItems) return
        useEditorStore.getState().applyBatch(
            fixPreviewItems.map((item) => ({
                op: 'applyTokenFix' as const,
                nodeId: item.nodeId,
                hardcodedClass: item.hardcodedClass,
                tokenClass: item.tokenClass,
            }))
        )
        setFixPreviewItems(null)
    }, [fixPreviewItems])

    // ── COUNSEL.1.4: Inline diff preview state ────────────────────────────────
    const [inlineDiffOpen, setInlineDiffOpen] = useState<Set<string>>(new Set())
    const [inlineDiffData, setInlineDiffData] = useState<Map<string, InlineFixPreview>>(new Map())
    const [inlineDiffLoading, setInlineDiffLoading] = useState<Set<string>>(new Set())
    // Queue of accepted fixes awaiting batch apply
    const [acceptedFixes, setAcceptedFixes] = useState<FixableItem[]>([])

    const toggleInlineDiff = useCallback(async (key: string, ruleId: string, filePath: string | null) => {
        if (inlineDiffOpen.has(key)) {
            setInlineDiffOpen((prev) => { const n = new Set(prev); n.delete(key); return n })
            return
        }
        setInlineDiffOpen((prev) => new Set([...prev, key]))
        if (inlineDiffData.has(key)) return
        setInlineDiffLoading((prev) => new Set([...prev, key]))
        try {
            if (window.flintAPI.governance.previewFix && filePath) {
                const data = await window.flintAPI.governance.previewFix(ruleId, filePath)
                if (data) setInlineDiffData((prev) => new Map([...prev, [key, data]]))
            }
        } catch {
            /* IPC not yet available — show placeholder diff from store data */
        } finally {
            setInlineDiffLoading((prev) => { const n = new Set(prev); n.delete(key); return n })
        }
    }, [inlineDiffOpen, inlineDiffData])

    const acceptInlineFix = useCallback((key: string, item: FixableItem) => {
        setAcceptedFixes((prev) => {
            if (prev.some((f) => f.nodeId === item.nodeId)) return prev
            return [...prev, item]
        })
        setInlineDiffOpen((prev) => { const n = new Set(prev); n.delete(key); return n })
    }, [])

    const skipInlineFix = useCallback((key: string) => {
        setInlineDiffOpen((prev) => { const n = new Set(prev); n.delete(key); return n })
    }, [])

    const applyAcceptedFixes = useCallback(() => {
        if (acceptedFixes.length === 0) return
        useEditorStore.getState().applyBatch(
            acceptedFixes.map((item) => ({
                op: 'applyTokenFix' as const,
                nodeId: item.nodeId,
                hardcodedClass: item.hardcodedClass,
                tokenClass: item.tokenClass,
            }))
        )
        setAcceptedFixes([])
    }, [acceptedFixes])

    // ── COUNSEL.2.1: Defer form state ─────────────────────────────────────────
    const [deferFormOpen, setDeferFormOpen] = useState<Set<string>>(new Set())
    const [deferReasons, setDeferReasons] = useState<Map<string, string>>(new Map())
    const [deferDurations, setDeferDurations] = useState<Map<string, DeferDuration>>(new Map())
    const [deferSuccess, setDeferSuccess] = useState<Set<string>>(new Set())
    const [deferSuccessMsg, setDeferSuccessMsg] = useState<Map<string, string>>(new Map())
    // G4: track which violation rows have been successfully deferred this session
    const [deferredCardKeys, setDeferredCardKeys] = useState<Set<string>>(new Set())

    const toggleDeferForm = useCallback((key: string) => {
        setDeferFormOpen((prev) => {
            const n = new Set(prev)
            if (n.has(key)) { n.delete(key) } else { n.add(key) }
            return n
        })
    }, [])

    const submitDefer = useCallback(async (key: string, ruleId: string, nodeId: string) => {
        const reason = deferReasons.get(key) ?? ''
        const duration = deferDurations.get(key) ?? '1 day'
        let deferred = false
        try {
            if (window.flintAPI.governance.deferViolation) {
                await window.flintAPI.governance.deferViolation({ ruleId, filePath: activeFilePath ?? '', reason, duration })
                deferred = true
            } else if (window.flintAPI.deferViolation) {
                await window.flintAPI.deferViolation(activeFilePath ?? '', ruleId, nodeId, reason, duration)
                deferred = true
            }
        } catch { /* best-effort */ }
        if (!deferred) {
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Defer unavailable',
                message: 'Defer IPC is not available in this environment',
                severity: 'warning',
                autoDismissMs: 4000,
            })
            return
        }
        const msg = duration === 'Manually' ? 'Deferred. Will resurface manually.' : `Deferred. Will resurface in ${duration}.`
        setDeferSuccessMsg((prev) => new Map([...prev, [key, msg]]))
        setDeferSuccess((prev) => new Set([...prev, key]))
        setDeferFormOpen((prev) => { const n = new Set(prev); n.delete(key); return n })
        // G4: mark the row as deferred so the badge persists after the toast dismisses
        setDeferredCardKeys((prev) => new Set([...prev, key]))
        setTimeout(() => {
            setDeferSuccess((prev) => { const n = new Set(prev); n.delete(key); return n })
        }, 4000)
    }, [deferReasons, deferDurations, activeFilePath])

    // ── COUNSEL.2.5: Session fix progress indicator ───────────────────────────
    const [sessionInitialCount] = useState<number>(() => {
        const mWarnings = Array.from(useEditorStore.getState().linterWarnings.values())
        const aWarnings = Object.keys(useCanvasStore.getState().a11yViolations)
        return mWarnings.length + aWarnings.length
    })

    // ── COUNSEL.1.6: A11y auto-fixable entries ────────────────────────────────
    const autoFixableA11yEntries = useMemo(
        () => effectiveA11yWarnings.filter((w) => {
            const ruleId = extractRuleIdFromMsg(w.message) ?? ''
            return w.nearestToken !== null || ['A11Y-001', 'A11Y-002'].includes(ruleId)
        }),
        [effectiveA11yWarnings],
    )
    const manualA11yEntries = useMemo(
        () => effectiveA11yWarnings.filter((w) => {
            const ruleId = extractRuleIdFromMsg(w.message) ?? ''
            return w.nearestToken === null && !['A11Y-001', 'A11Y-002'].includes(ruleId)
        }),
        [effectiveA11yWarnings],
    )

    const handleBatchFixA11y = useCallback(async () => {
        if (!activeFilePath) return
        try {
            if (window.flintAPI.governance.batchFixA11y) {
                await window.flintAPI.governance.batchFixA11y(activeFilePath)
            } else {
                for (const w of autoFixableA11yEntries) {
                    const rId = extractRuleIdFromMsg(w.message) ?? 'A11Y'
                    await handleA11yFix(rId).catch(() => { /* best-effort */ })
                }
            }
            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'A11y batch fix applied',
                message: `${autoFixableA11yEntries.length} a11y ${autoFixableA11yEntries.length === 1 ? 'issue' : 'issues'} fixed`,
                severity: 'info',
                autoDismissMs: 3000,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'A11y batch fix failed',
                message: msg,
                severity: 'warning',
                autoDismissMs: 5000,
            })
        }
    }, [activeFilePath, autoFixableA11yEntries, handleA11yFix])

    // ── Export gate ──────────────────────────────────────────────────────────
    // Use the store's canExport() which respects cachedPolicy mode settings.
    // Subscribe to the three slices that canExport() reads so we re-derive on
    // any change to those slices.
    const storeCanExport       = useCanvasStore((s) => s.canExport)
    const mithrilViolationsGd  = useCanvasStore((s) => s.mithrilViolations)
    const exportBlocked = useMemo(
        () => !storeCanExport(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mithrilViolationsGd, overridesExist, a11yViolations, storeCanExport],
    )

    // ── MCP Activity Log state (S4.11) ───────────────────────────────────────
    // Display recent MCP-sourced notifications (mutation / fix / audit / violation)
    // as a lightweight activity feed. The notification store's history is used as
    // the source so we only show events that actually fired this session.
    const mcpHistory = useNotificationStore((s) => s.history)
    const mcpActivityEvents = useMemo(
        () =>
            mcpHistory
                .filter((n) => n.type === 'mutation' || n.type === 'violation' || n.type === 'sync')
                .slice(-20)
                .reverse(),
        [mcpHistory],
    )
    const [isActivityOpen, setIsActivityOpen] = useState(false)

    // ── Accordion open/close state ───────────────────────────────────────────
    // Score open by default so users always see the ring on first load
    const [isScoreOpen, setIsScoreOpen] = useState(true)
    const [isTopRulesOpen, setIsTopRulesOpen] = useState(false)
    const [isSessionOpen, setIsSessionOpen] = useState(false)
    // When violations disappear, open score accordion automatically
    useEffect(() => {
        if (!exportBlocked) setIsScoreOpen(true)
    }, [exportBlocked])

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col">

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Governance Health
                </h3>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => void handleRunAudit()}
                        disabled={isAuditing || !activeFilePath}
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed"
                        data-testid="run-audit-button"
                        aria-label={isAuditing ? 'Auditing in progress' : 'Run governance audit'}
                        title="Run a full governance audit via the AI engine — more thorough than the live linter but requires the MCP engine to be connected"
                    >
                        {isAuditing ? <Loader2 size={10} className="animate-spin" aria-hidden="true" /> : <Play size={10} aria-hidden="true" />}
                        {isAuditing ? 'Auditing...' : 'Run Audit'}
                    </button>
                    {isBaselineSet && (
                        <span className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-900/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400" title="New Issues Only — issues present at baseline are excluded">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                            New Issues Only
                        </span>
                    )}
                    {govOverrideCount > 0 && (
                        <span className="text-xs text-amber-400" aria-label={`${govOverrideCount} governance rule ${govOverrideCount === 1 ? 'override' : 'overrides'} recorded this session`}>
                            {govOverrideCount} {govOverrideCount === 1 ? 'override' : 'overrides'}
                        </span>
                    )}
                </div>
            </div>

            {/* ── COUNSEL.3.3: Flare Anomaly Alert Banner ────────────────── */}
            {anomalies.length > 0 && !anomalyBannerDismissed && (
                <div
                    data-testid="anomaly-alert-banner"
                    className="mx-3 mt-2 rounded border border-amber-700/40 bg-amber-900/20 px-3 py-2"
                    role="alert"
                >
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-amber-300">
                                Flare detected {anomalies.length} {anomalies.length === 1 ? 'anomaly' : 'anomalies'}
                            </p>
                            <div className="mt-1.5 space-y-1">
                                {anomalies.map((a, idx) => (
                                    <p key={idx} className="text-[10px] text-amber-400/80">
                                        <span className="font-medium text-amber-300">{a.type}:</span> {a.message}
                                    </p>
                                ))}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAnomalyBannerDismissed(true)}
                            className="shrink-0 rounded p-0.5 text-amber-500 hover:text-amber-300 transition-colors"
                            aria-label="Dismiss anomaly alert banner"
                            data-testid="anomaly-banner-dismiss"
                        >
                            <X size={12} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── No design system ──────────────────────────────────────── */}
            {tokenCount === 0 && (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center border-b border-zinc-800">
                    <ShieldOff className="h-8 w-8 text-zinc-600 mb-3" aria-hidden="true" />
                    <p className="text-sm text-zinc-400 leading-relaxed max-w-[240px]">
                        Health score measures against your design tokens. Connect Figma or import tokens to start measuring.
                    </p>
                    <button
                        type="button"
                        onClick={() => { unlockTab('tokens'); setRightTab('tokens') }}
                        className="mt-4 rounded border border-indigo-500/40 bg-indigo-900/20 px-3 py-1.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-900/40 hover:text-indigo-300"
                    >
                        Import Tokens
                    </button>
                </div>
            )}

            {/* ── EXPORT GATE BANNER — first contextual signal ─────────── */}
            {tokenCount > 0 && exportBlocked && (
                <div className="px-3 py-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 rounded border border-red-700/40 bg-red-900/10 px-3 py-2" role="alert">
                        <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-xs font-medium text-red-300">
                            Export blocked — {mithrilCount + a11yCount} {mithrilCount + a11yCount !== 1 ? 'issues' : 'issue'}
                            {overridesExist ? ' + overrides' : ''}
                        </span>
                    </div>
                </div>
            )}
            {tokenCount > 0 && !exportBlocked && (
                <div className="px-3 py-2 border-b border-zinc-800">
                    <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-900/10 px-3 py-2">
                        <ShieldCheck size={13} className="shrink-0 text-emerald-400" aria-hidden="true" />
                        <span className="flex-1 text-xs font-medium text-emerald-300">
                            {isBaselineSet ? 'No new issues — export ready' : 'All clear — export ready'}
                        </span>
                        <button
                            type="button"
                            onClick={() => onOpenExportModal?.()}
                            className="flex items-center gap-1 rounded bg-emerald-600/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                            aria-label="Open export modal"
                        >
                            Export
                            <SendHorizonal size={10} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── AUTOPILOT TOGGLE ──────────────────────────────────────── */}
            {tokenCount > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-zinc-200">Autopilot</span>
                            {governedFixCount > 0 && (
                                <span className="rounded bg-indigo-900/30 border border-indigo-500/30 px-1 py-px text-[10px] text-indigo-400 font-medium leading-none">
                                    {governedFixCount} {governedFixCount === 1 ? 'fix' : 'fixes'} ready
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-zinc-500 leading-snug">
                            Auto-fixes Tier-1 drift as you work
                        </span>
                    </div>
                    {/* COUNSEL.4.3: Read-only status chip replaces the toggle — autopilot state is
                         set by the engine policy, not manually toggled from Glass. */}
                    <span
                        data-testid="autopilot-status-chip"
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            autopilotEnabled
                                ? 'border-emerald-500/30 bg-emerald-900/20 text-emerald-400'
                                : 'border-zinc-700 bg-zinc-800 text-zinc-500'
                        }`}
                        aria-label={autopilotEnabled ? 'Autopilot: On' : 'Autopilot: Off'}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${autopilotEnabled ? 'bg-emerald-400' : 'bg-zinc-600'}`} aria-hidden="true" />
                        {autopilotEnabled ? 'On' : 'Off'}
                    </span>
                </div>
            )}

            {/* ── VIOLATIONS SECTION — primary job surface ─────────────── */}
            {tokenCount > 0 && (mithrilCount > 0 || a11yCount > 0 || overridesExist) && (
                <div ref={violationsSectionRef}>
                    {/* Section header + batch fix CTAs */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
                        <h4 className="flex-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
                            Issues
                            {isBaselineSet && <span className="ml-1.5 text-indigo-400">(new only)</span>}
                        </h4>
                        {/* COUNSEL.2.5: Session fix progress indicator */}
                        {sessionInitialCount > 0 && (
                            <span
                                data-testid="session-progress-indicator"
                                className="text-[10px] text-zinc-600"
                                aria-live="polite"
                            >
                                {Math.max(0, sessionInitialCount - mithrilCount - a11yCount)} of {sessionInitialCount} fixed this session
                            </span>
                        )}
                        {/* COUNSEL.1.4: Apply accepted fixes queue button */}
                        {acceptedFixes.length > 0 && (
                            <button
                                type="button"
                                onClick={applyAcceptedFixes}
                                data-testid="apply-accepted-fixes-button"
                                className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-900/20 px-2.5 py-1 text-[10px] text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition-colors"
                                aria-label={`Apply ${acceptedFixes.length} accepted ${acceptedFixes.length === 1 ? 'fix' : 'fixes'}`}
                            >
                                <Check size={9} aria-hidden="true" />
                                Apply {acceptedFixes.length} {acceptedFixes.length === 1 ? 'fix' : 'fixes'}
                            </button>
                        )}
                        {autoFixableEntries.length > 0 && (
                            <button
                                type="button"
                                onClick={handleFixAll}
                                className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/20 px-2.5 py-1 text-[10px] text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition-colors"
                                aria-label={`Fix all ${autoFixableEntries.length} auto-fixable issues`}
                            >
                                <Wand2 size={9} aria-hidden="true" />
                                Auto-fix {autoFixableEntries.length} {autoFixableEntries.length === 1 ? 'issue' : 'issues'}
                            </button>
                        )}
                        {/* COUNSEL.1.6: Fix all a11y batch button + Review N manually link */}
                        {autoFixableA11yEntries.length > 0 && (
                            <button
                                type="button"
                                onClick={() => void handleBatchFixA11y()}
                                data-testid="fix-all-a11y-button"
                                className="flex items-center gap-1 rounded border border-red-500/30 bg-red-900/20 px-2.5 py-1 text-[10px] text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
                                aria-label={`Fix all ${autoFixableA11yEntries.length} auto-fixable accessibility issues`}
                            >
                                <Wand2 size={9} aria-hidden="true" />
                                Fix all a11y ({autoFixableA11yEntries.length})
                            </button>
                        )}
                        {manualA11yEntries.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    manualA11yEntries.forEach((w) => {
                                        const k = `a-${w.id}-${effectiveA11yWarnings.indexOf(w)}`
                                        setExpandedViolations((prev) => { const n = new Set(prev); n.add(k); return n })
                                    })
                                }}
                                data-testid="review-manual-a11y-button"
                                className="text-[10px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline transition-colors"
                                aria-label={`Review ${manualA11yEntries.length} accessibility issues that need manual input`}
                            >
                                Review {manualA11yEntries.length} manually
                            </button>
                        )}
                    </div>

                    {/* Violation cards — expandable action items */}
                    <div className="divide-y divide-zinc-800/50" data-testid="violations-list">
                        {visibleLinterWarnings.map((w) => {
                            const hardcoded = extractHardcodedClassFromMsg(w.message)
                            const token = w.nearestToken
                            const canFix = hardcoded !== null && token !== null
                            const fixItem: FixableItem | null = canFix ? {
                                nodeId: w.id,
                                label: `${extractRuleIdFromMsg(w.message) ?? w.type} — ${w.id.slice(0, 12)}`,
                                hardcodedClass: hardcoded,
                                tokenClass: token,
                            } : null
                            const guide = getFixGuide(w.type, w.message)
                            const ruleId = extractRuleIdFromMsg(w.message) ?? w.type
                            const cardKey = `m-${w.id}`
                            const isOpen = expandedViolations.has(cardKey) || pinnedViolations.has(cardKey)
                            const isPinned = pinnedViolations.has(cardKey)
                            // COUNSEL.1.5: auto-fixable badge — Mithril violations with a nearestToken are auto-fixable
                            const isAutoFixable = canFix
                            const isDiffOpen = inlineDiffOpen.has(cardKey)
                            const isDiffLoading = inlineDiffLoading.has(cardKey)
                            const diffData = inlineDiffData.get(cardKey)
                            const isDeferOpen = deferFormOpen.has(cardKey)
                            const isDeferSuccess = deferSuccess.has(cardKey)
                            const isDeferred = deferredCardKeys.has(cardKey)
                            const isFlagged = flaggedCardKeys.has(cardKey)
                            const provenance = provenanceMap[w.id]
                            return (
                                <div key={cardKey} className={`border-b border-zinc-800/30 last:border-0${isDeferred ? ' opacity-50' : isFlagged ? ' opacity-70' : ''}${isFlagged ? ' border-l-2 border-l-amber-500/60' : ''}`}>
                                    {/* Summary row — always visible. Expand toggle and action buttons are siblings. */}
                                    <div className="flex w-full items-start hover:bg-zinc-800/30 transition-colors">
                                        <button
                                            type="button"
                                            onClick={() => toggleViolation(cardKey)}
                                            className="flex flex-1 items-start gap-2 px-3 py-2 text-left min-w-0"
                                            aria-expanded={isOpen}
                                            aria-controls={`v-m-${w.id}`}
                                        >
                                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[w.severity]}`} aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <p className="text-[10px] text-zinc-300 font-medium">{ruleId}</p>
                                                    {/* COUNSEL.2.2: Flagged badge */}
                                                    {isFlagged && (
                                                        <span
                                                            data-testid={`flagged-badge-${w.id}`}
                                                            className="rounded-full border border-amber-500/40 bg-amber-900/20 px-1.5 py-px text-[9px] font-medium text-amber-400 leading-none"
                                                        >
                                                            Flagged for Review
                                                        </span>
                                                    )}
                                                    {/* COUNSEL.1.5: fixability badge */}
                                                    {!isFlagged && isAutoFixable ? (
                                                        <span
                                                            data-testid={`badge-auto-fixable-${w.id}`}
                                                            className="rounded-full border border-emerald-500/30 bg-emerald-900/20 px-1.5 py-px text-[9px] font-medium text-emerald-400 leading-none"
                                                        >
                                                            Auto-fixable
                                                        </span>
                                                    ) : !isFlagged ? (
                                                        <span
                                                            data-testid={`badge-needs-input-${w.id}`}
                                                            className="rounded-full border border-amber-500/30 bg-amber-900/20 px-1.5 py-px text-[9px] font-medium text-amber-400 leading-none"
                                                        >
                                                            Needs input
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {/* S5.10: line-clamp-2 instead of truncate — shows 2 lines before ellipsis */}
                                                <p className="text-[10px] text-zinc-500 line-clamp-2" title={w.message}>
                                                    {w.message.replace(/^[A-Z0-9-]+:\s*/, '')}
                                                </p>
                                                {/* COUNSEL.3.2: Provenance chip */}
                                                {provenance && (
                                                    <span
                                                        data-testid={`provenance-chip-${w.id}`}
                                                        className="mt-0.5 inline-block text-[10px] text-zinc-500 bg-zinc-800/50 rounded px-1.5 py-0.5"
                                                    >
                                                        Introduced by {provenance.source === 'human' ? 'you' : provenance.agentId ?? provenance.source}
                                                    </span>
                                                )}
                                            </div>
                                            {isOpen
                                                ? <ChevronDown size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />
                                                : <ChevronRight size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />}
                                        </button>
                                        {/* Action buttons: Preview Fix / Fix / Defer / Pin */}
                                        <div className="flex shrink-0 items-center gap-1 self-center mr-2">
                                            {/* COUNSEL.1.4: Preview fix button */}
                                            {canFix && (
                                                <button
                                                    type="button"
                                                    onClick={() => void toggleInlineDiff(cardKey, ruleId, activeFilePath)}
                                                    data-testid={`preview-fix-btn-${w.id}`}
                                                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                                                        isDiffOpen
                                                            ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300'
                                                            : 'border-indigo-500/30 bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40'
                                                    }`}
                                                    aria-label={isDiffOpen ? 'Close diff preview' : `Preview fix for ${ruleId}`}
                                                    aria-expanded={isDiffOpen}
                                                >
                                                    {isDiffLoading ? <Loader2 size={8} className="animate-spin inline mr-0.5" aria-hidden="true" /> : null}
                                                    {isDiffOpen ? 'Close' : 'Preview fix'}
                                                </button>
                                            )}
                                            {canFix && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleFixSingle(fixItem!)}
                                                    className="rounded border border-indigo-500/30 bg-indigo-900/20 px-2 py-0.5 text-[10px] text-indigo-400 hover:bg-indigo-900/40 transition-colors"
                                                    aria-label={`Fix drift on element ${w.id}`}
                                                >
                                                    Fix
                                                </button>
                                            )}
                                            {/* COUNSEL.2.2: Flag for review button */}
                                            {!isDeferred && !isFlagged && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleFlag(cardKey, ruleId, w.id)}
                                                    data-testid={`flag-btn-${w.id}`}
                                                    className="rounded border border-amber-500/30 bg-amber-900/20 px-2 py-0.5 text-[10px] text-amber-400 hover:bg-amber-900/40 transition-colors"
                                                    aria-label={`Flag ${ruleId} for review`}
                                                >
                                                    Flag
                                                </button>
                                            )}
                                            {isFlagged && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnflag(cardKey)}
                                                    data-testid={`unflag-btn-${w.id}`}
                                                    className="rounded border border-amber-500/40 bg-amber-900/20 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-900/40 transition-colors"
                                                    aria-label={`Remove flag from ${ruleId}`}
                                                >
                                                    Unflag
                                                </button>
                                            )}
                                            {/* COUNSEL.2.1: Defer form toggle / G4: Deferred badge */}
                                            {isDeferred ? (
                                                <span
                                                    data-testid={`deferred-badge-${w.id}`}
                                                    className="text-xs text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5"
                                                >
                                                    Deferred
                                                </span>
                                            ) : !isFlagged ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleDeferForm(cardKey)}
                                                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                                                        isDeferOpen
                                                            ? 'border-zinc-600 bg-zinc-700 text-zinc-300'
                                                            : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                                                    }`}
                                                    aria-label={isDeferOpen ? 'Cancel defer' : `Defer ${ruleId} issue`}
                                                    aria-expanded={isDeferOpen}
                                                >
                                                    Defer
                                                </button>
                                            ) : null}
                                            {/* S5.9: Pin — keeps the detail panel open while working */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    togglePin(cardKey)
                                                    if (!isPinned) setExpandedViolations((prev) => { const n = new Set(prev); n.add(cardKey); return n })
                                                }}
                                                className={`rounded p-0.5 transition-colors ${isPinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                aria-label={isPinned ? 'Unpin issue detail' : 'Pin issue detail open'}
                                                title={isPinned ? 'Unpin' : 'Pin open while working'}
                                            >
                                                <Pin size={9} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* COUNSEL.1.4: Inline diff preview panel */}
                                    {isDiffOpen && (
                                        <div
                                            data-testid={`inline-diff-${w.id}`}
                                            className="mx-3 mb-2 rounded border border-zinc-700 bg-zinc-950 overflow-hidden"
                                        >
                                            {isDiffLoading || !diffData ? (
                                                <div className="flex items-center justify-center gap-2 py-3">
                                                    <Loader2 size={12} className="animate-spin text-zinc-500" aria-hidden="true" />
                                                    <span className="text-[10px] text-zinc-500">Loading diff...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-2 divide-x divide-zinc-800">
                                                        <div className="px-3 py-2">
                                                            <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-zinc-600">Current</p>
                                                            {diffData.isColor && (
                                                                <span
                                                                    className="mb-1 block h-4 w-4 rounded border border-zinc-700"
                                                                    style={{ backgroundColor: diffData.current }}
                                                                    aria-hidden="true"
                                                                />
                                                            )}
                                                            <code className="text-[10px] text-red-400 font-mono">{diffData.current}</code>
                                                        </div>
                                                        <div className="px-3 py-2">
                                                            <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-zinc-600">Proposed</p>
                                                            {diffData.isColor && (
                                                                <span
                                                                    className="mb-1 block h-4 w-4 rounded border border-zinc-700"
                                                                    style={{ backgroundColor: diffData.proposed }}
                                                                    aria-hidden="true"
                                                                />
                                                            )}
                                                            <code className="text-[10px] text-emerald-400 font-mono">{diffData.proposed}</code>
                                                            <p className="mt-0.5 text-[9px] text-zinc-500">{diffData.tokenName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => acceptInlineFix(cardKey, fixItem!)}
                                                            data-testid={`accept-fix-btn-${w.id}`}
                                                            className="rounded border border-emerald-500/30 bg-emerald-900/20 px-2.5 py-1 text-[10px] text-emerald-400 hover:bg-emerald-900/40 transition-colors"
                                                            aria-label="Accept this fix"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => skipInlineFix(cardKey)}
                                                            data-testid={`skip-fix-btn-${w.id}`}
                                                            className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                                                            aria-label="Skip this fix"
                                                        >
                                                            Skip
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* COUNSEL.2.1: Inline defer form */}
                                    {isDeferOpen && (
                                        <div
                                            data-testid={`defer-form-${w.id}`}
                                            className="mx-3 mb-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2.5 space-y-2"
                                        >
                                            <p className="text-[10px] font-medium text-zinc-400">Defer this issue</p>
                                            <textarea
                                                rows={2}
                                                placeholder="Reason (optional)"
                                                value={deferReasons.get(cardKey) ?? ''}
                                                onChange={(e) => setDeferReasons((prev) => new Map([...prev, [cardKey, e.target.value]]))}
                                                className="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-600 focus:border-indigo-500/60 focus:outline-none"
                                                aria-label="Defer reason"
                                            />
                                            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Defer duration">
                                                {(['1 day', '3 days', '1 week', '1 sprint', 'Manually'] as const).map((d) => (
                                                    <label key={d} className="flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`defer-duration-${cardKey}`}
                                                            value={d}
                                                            checked={(deferDurations.get(cardKey) ?? '1 day') === d}
                                                            onChange={() => setDeferDurations((prev) => new Map([...prev, [cardKey, d]]))}
                                                            className="sr-only"
                                                        />
                                                        <span
                                                            className={`rounded-full border px-2 py-0.5 text-[9px] font-medium cursor-pointer transition-colors ${
                                                                (deferDurations.get(cardKey) ?? '1 day') === d
                                                                    ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300'
                                                                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                                                            }`}
                                                        >
                                                            {d}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void submitDefer(cardKey, ruleId, w.id)}
                                                    data-testid={`defer-submit-${w.id}`}
                                                    className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700 transition-colors"
                                                    aria-label="Submit defer"
                                                >
                                                    Defer issue
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleDeferForm(cardKey)}
                                                    data-testid={`defer-cancel-${w.id}`}
                                                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                                                    aria-label="Cancel defer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Defer success confirmation */}
                                    {isDeferSuccess && (
                                        <div
                                            data-testid={`defer-success-${w.id}`}
                                            className="mx-3 mb-2 flex items-center gap-2 rounded border border-indigo-500/30 bg-indigo-900/20 px-3 py-1.5"
                                            role="status"
                                        >
                                            <Check size={10} className="shrink-0 text-indigo-400" aria-hidden="true" />
                                            <span className="text-[10px] text-indigo-300">{deferSuccessMsg.get(cardKey)}</span>
                                        </div>
                                    )}

                                    {/* Expanded guide */}
                                    {isOpen && (
                                        <div id={`v-m-${w.id}`} className="px-3 pb-3 space-y-2.5 bg-zinc-950/60">
                                            {guide ? (
                                                <>
                                                    {/* Why it matters */}
                                                    <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
                                                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                            <span className="text-zinc-400 font-medium">Why: </span>{guide.why}
                                                        </p>
                                                        {guide.wcag && (
                                                            <p className="mt-1 text-[10px] text-indigo-400">{guide.wcag}</p>
                                                        )}
                                                    </div>
                                                    {/* Fix steps */}
                                                    <div>
                                                        <p className="mb-1 text-[10px] font-medium text-zinc-400">How to fix:</p>
                                                        <ol className="space-y-1 list-none">
                                                            {guide.steps.map((step, si) => (
                                                                <li key={si} className="flex items-start gap-2 text-[10px] text-zinc-500">
                                                                    <span className="mt-px shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-700 text-[9px] text-zinc-600 font-mono">{si + 1}</span>
                                                                    <span>{step}</span>
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    </div>
                                                    {/* Copy snippet */}
                                                    {guide.snippet && (
                                                        <CopySnippet snippet={guide.snippet} />
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-[10px] text-zinc-600">No fix guide available for this rule.</p>
                                            )}
                                            {/* Element ref */}
                                            <p className="font-mono text-[10px] text-zinc-700">Element: {getNodeName(w.id)}</p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* A11y violation cards */}
                        {visibleA11yWarnings.map((w, i) => {
                            const guide = getFixGuide('a11y', w.message)
                            const ruleId = extractRuleIdFromMsg(w.message) ?? 'A11Y'
                            const cardKey = `a-${w.id}-${i}`
                            const isOpen = expandedViolations.has(cardKey) || pinnedViolations.has(cardKey)
                            const isPinned = pinnedViolations.has(cardKey)
                            // COUNSEL.1.5: a11y auto-fixable = has nearestToken or is a known auto-fixable rule
                            const isAutoFixable = w.nearestToken !== null || ['A11Y-001', 'A11Y-002'].includes(ruleId)
                            const isDeferOpen = deferFormOpen.has(cardKey)
                            const isDeferSuccess = deferSuccess.has(cardKey)
                            const isDeferred = deferredCardKeys.has(cardKey)
                            const isFlagged = flaggedCardKeys.has(cardKey)
                            const provenance = provenanceMap[w.id]
                            return (
                                <div key={cardKey} className={`border-b border-zinc-800/30 last:border-0${isDeferred ? ' opacity-50' : isFlagged ? ' opacity-70' : ''}${isFlagged ? ' border-l-2 border-l-amber-500/60' : ''}`}>
                                    <div className="flex w-full items-start hover:bg-zinc-800/30 transition-colors">
                                        <button
                                            type="button"
                                            onClick={() => toggleViolation(cardKey)}
                                            className="flex flex-1 items-start gap-2 px-3 py-2 text-left min-w-0"
                                            aria-expanded={isOpen}
                                            aria-controls={`v-a-${w.id}-${i}`}
                                        >
                                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <p className="text-[10px] text-zinc-300 font-medium">{ruleId}</p>
                                                    {/* COUNSEL.2.2: Flagged badge */}
                                                    {isFlagged && (
                                                        <span
                                                            data-testid={`flagged-badge-a11y-${w.id}`}
                                                            className="rounded-full border border-amber-500/40 bg-amber-900/20 px-1.5 py-px text-[9px] font-medium text-amber-400 leading-none"
                                                        >
                                                            Flagged for Review
                                                        </span>
                                                    )}
                                                    {/* COUNSEL.1.5: fixability badge */}
                                                    {!isFlagged && isAutoFixable ? (
                                                        <span
                                                            data-testid={`badge-auto-fixable-a11y-${w.id}`}
                                                            className="rounded-full border border-emerald-500/30 bg-emerald-900/20 px-1.5 py-px text-[9px] font-medium text-emerald-400 leading-none"
                                                        >
                                                            Auto-fixable
                                                        </span>
                                                    ) : !isFlagged ? (
                                                        <span
                                                            data-testid={`badge-needs-input-a11y-${w.id}`}
                                                            className="rounded-full border border-amber-500/30 bg-amber-900/20 px-1.5 py-px text-[9px] font-medium text-amber-400 leading-none"
                                                        >
                                                            Needs input
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {/* S5.10: line-clamp-2 shows 2 lines before truncating */}
                                                <p className="text-[10px] text-zinc-500 line-clamp-2" title={w.message}>
                                                    {w.message.replace(/^[A-Z0-9-]+:\s*/, '')}
                                                </p>
                                                {/* COUNSEL.3.2: Provenance chip */}
                                                {provenance && (
                                                    <span
                                                        data-testid={`provenance-chip-a11y-${w.id}`}
                                                        className="mt-0.5 inline-block text-[10px] text-zinc-500 bg-zinc-800/50 rounded px-1.5 py-0.5"
                                                    >
                                                        Introduced by {provenance.source === 'human' ? 'you' : provenance.agentId ?? provenance.source}
                                                    </span>
                                                )}
                                            </div>
                                            {isOpen
                                                ? <ChevronDown size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />
                                                : <ChevronRight size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />}
                                        </button>
                                        {/* Fix + Flag + Defer + Pin actions for a11y violations */}
                                        <div className="flex shrink-0 items-center gap-1 self-center mr-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleA11yFix(ruleId)}
                                                className="rounded border border-indigo-500/30 bg-indigo-900/20 px-2 py-0.5 text-[10px] text-indigo-400 hover:bg-indigo-900/40 transition-colors"
                                                aria-label={`Fix ${ruleId} gap`}
                                                data-testid={`a11y-fix-btn-${ruleId}`}
                                            >
                                                Fix
                                            </button>
                                            {/* COUNSEL.2.2: Flag for review button */}
                                            {!isDeferred && !isFlagged && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleFlag(cardKey, ruleId, w.id)}
                                                    data-testid={`flag-btn-a11y-${w.id}`}
                                                    className="rounded border border-amber-500/30 bg-amber-900/20 px-2 py-0.5 text-[10px] text-amber-400 hover:bg-amber-900/40 transition-colors"
                                                    aria-label={`Flag ${ruleId} for review`}
                                                >
                                                    Flag
                                                </button>
                                            )}
                                            {isFlagged && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnflag(cardKey)}
                                                    data-testid={`unflag-btn-a11y-${w.id}`}
                                                    className="rounded border border-amber-500/40 bg-amber-900/20 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-900/40 transition-colors"
                                                    aria-label={`Remove flag from ${ruleId}`}
                                                >
                                                    Unflag
                                                </button>
                                            )}
                                            {/* COUNSEL.2.1: Defer form toggle / G4: Deferred badge */}
                                            {isDeferred ? (
                                                <span
                                                    data-testid={`deferred-badge-a11y-${w.id}`}
                                                    className="text-xs text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5"
                                                >
                                                    Deferred
                                                </span>
                                            ) : !isFlagged ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleDeferForm(cardKey)}
                                                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                                                        isDeferOpen
                                                            ? 'border-zinc-600 bg-zinc-700 text-zinc-300'
                                                            : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                                                    }`}
                                                    aria-label={isDeferOpen ? 'Cancel defer' : `Defer ${ruleId} issue`}
                                                    aria-expanded={isDeferOpen}
                                                >
                                                    Defer
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    togglePin(cardKey)
                                                    if (!isPinned) setExpandedViolations((prev) => { const n = new Set(prev); n.add(cardKey); return n })
                                                }}
                                                className={`rounded p-0.5 transition-colors ${isPinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                aria-label={isPinned ? 'Unpin issue detail' : 'Pin issue detail open'}
                                                title={isPinned ? 'Unpin' : 'Pin open while working'}
                                            >
                                                <Pin size={9} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* COUNSEL.2.1: Inline defer form */}
                                    {isDeferOpen && (
                                        <div
                                            data-testid={`defer-form-a11y-${w.id}`}
                                            className="mx-3 mb-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2.5 space-y-2"
                                        >
                                            <p className="text-[10px] font-medium text-zinc-400">Defer this issue</p>
                                            <textarea
                                                rows={2}
                                                placeholder="Reason (optional)"
                                                value={deferReasons.get(cardKey) ?? ''}
                                                onChange={(e) => setDeferReasons((prev) => new Map([...prev, [cardKey, e.target.value]]))}
                                                className="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-300 placeholder-zinc-600 focus:border-indigo-500/60 focus:outline-none"
                                                aria-label="Defer reason"
                                            />
                                            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Defer duration">
                                                {(['1 day', '3 days', '1 week', '1 sprint', 'Manually'] as const).map((d) => (
                                                    <label key={d} className="flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`defer-duration-${cardKey}`}
                                                            value={d}
                                                            checked={(deferDurations.get(cardKey) ?? '1 day') === d}
                                                            onChange={() => setDeferDurations((prev) => new Map([...prev, [cardKey, d]]))}
                                                            className="sr-only"
                                                        />
                                                        <span
                                                            className={`rounded-full border px-2 py-0.5 text-[9px] font-medium cursor-pointer transition-colors ${
                                                                (deferDurations.get(cardKey) ?? '1 day') === d
                                                                    ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300'
                                                                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                                                            }`}
                                                        >
                                                            {d}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void submitDefer(cardKey, ruleId, w.id)}
                                                    data-testid={`defer-submit-a11y-${w.id}`}
                                                    className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700 transition-colors"
                                                    aria-label="Submit defer"
                                                >
                                                    Defer issue
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleDeferForm(cardKey)}
                                                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                                                    aria-label="Cancel defer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Defer success confirmation */}
                                    {isDeferSuccess && (
                                        <div
                                            className="mx-3 mb-2 flex items-center gap-2 rounded border border-indigo-500/30 bg-indigo-900/20 px-3 py-1.5"
                                            role="status"
                                        >
                                            <Check size={10} className="shrink-0 text-indigo-400" aria-hidden="true" />
                                            <span className="text-[10px] text-indigo-300">{deferSuccessMsg.get(cardKey)}</span>
                                        </div>
                                    )}

                                    {isOpen && (
                                        <div id={`v-a-${w.id}-${i}`} className="px-3 pb-3 space-y-2.5 bg-zinc-950/60">
                                            {guide ? (
                                                <>
                                                    <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
                                                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                            <span className="text-zinc-400 font-medium">Why: </span>{guide.why}
                                                        </p>
                                                        <p className="mt-1 text-[10px] text-red-400/80">{guide.wcag}</p>
                                                    </div>
                                                    <div>
                                                        <p className="mb-1 text-[10px] font-medium text-zinc-400">How to fix:</p>
                                                        <ol className="space-y-1 list-none">
                                                            {guide.steps.map((step, si) => (
                                                                <li key={si} className="flex items-start gap-2 text-[10px] text-zinc-500">
                                                                    <span className="mt-px shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-700 text-[9px] text-zinc-600 font-mono">{si + 1}</span>
                                                                    <span>{step}</span>
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    </div>
                                                    {guide.snippet && <CopySnippet snippet={guide.snippet} />}
                                                </>
                                            ) : (
                                                <p className="text-[10px] text-zinc-600">Click the element on the canvas to inspect it in Properties.</p>
                                            )}
                                            <p className="font-mono text-[10px] text-zinc-700">Element: {getNodeName(w.id)}</p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Overrides */}
                        {overridesExist && (
                            <div className="flex items-start gap-2 px-3 py-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                <div className="flex-1">
                                    <p className="text-[10px] text-zinc-300 font-medium">Unapplied Overrides</p>
                                    <p className="text-[10px] text-zinc-500">Property overrides are blocking export. Apply or revert them to unblock.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* COUNSEL.4.3: Governance navigation footer — Manage rules + Policy settings */}
            {tokenCount > 0 && (mithrilCount > 0 || a11yCount > 0) && (onOpenGovernancePanel || onManageRules || onPolicySettings) && (
                <div className="flex items-center justify-end gap-3 border-b border-zinc-800/60 px-3 py-1.5">
                    {/* Legacy "Configure rules" via onOpenGovernancePanel (S5.8) */}
                    {onOpenGovernancePanel && !onManageRules && (
                        <button
                            type="button"
                            onClick={onOpenGovernancePanel}
                            className="text-[10px] text-zinc-600 underline-offset-2 hover:text-indigo-400 hover:underline transition-colors"
                        >
                            Configure rules
                        </button>
                    )}
                    {/* COUNSEL.4.3: "Manage rules →" link */}
                    {onManageRules && (
                        <button
                            type="button"
                            onClick={onManageRules}
                            className="text-[10px] text-zinc-500 underline-offset-2 hover:text-indigo-400 hover:underline transition-colors"
                            data-testid="manage-rules-link"
                        >
                            Manage rules →
                        </button>
                    )}
                    {/* COUNSEL.4.3: "Policy settings →" link */}
                    {onPolicySettings && (
                        <button
                            type="button"
                            onClick={onPolicySettings}
                            className="text-[10px] text-zinc-500 underline-offset-2 hover:text-indigo-400 hover:underline transition-colors"
                            data-testid="policy-settings-link"
                        >
                            Policy settings →
                        </button>
                    )}
                </div>
            )}

            {/* ── Fix Preview Drawer (slides in below violations) ───────── */}
            {fixPreviewItems && (
                <FixPreviewDrawer
                    items={fixPreviewItems}
                    onApply={handleApplyPreview}
                    onCancel={() => setFixPreviewItems(null)}
                    onOpenSettings={() => { setRightTab('governance') }}
                />
            )}

            {/* ── ACCORDION: Health Score ────────────────────────────────── */}
            {tokenCount > 0 && (
                <div className="border-t border-zinc-800">
                    <button
                        type="button"
                        onClick={() => setIsScoreOpen((v) => !v)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                        aria-expanded={isScoreOpen}
                        aria-controls="score-accordion"
                    >
                        {isScoreOpen ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" /> : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                        <span className="flex-1 text-xs text-zinc-400">Health Score</span>
                        <span className={`text-xs font-bold ${GRADE_TEXT[grade]}`} aria-hidden="true">{grade}</span>
                        <span className="font-mono text-xs text-zinc-500" aria-label={`Score ${score} out of 100`}>{score}</span>
                    </button>
                    {isScoreOpen && (
                        <div id="score-accordion">
                            {/* COUNSEL.2.4: Effort framing — must appear before the score ring (DOM order) */}
                            {tokenCount > 0 && (
                                <p className="px-4 pt-3 pb-1 text-xs text-zinc-400" data-testid="effort-framing">
                                    {effortText}
                                </p>
                            )}
                            {/* COUNSEL.1.1: Category split chips */}
                            {tokenCount > 0 && (
                                <div className="flex items-center gap-1.5 px-4 pb-2" data-testid="category-chips">
                                    <button
                                        type="button"
                                        aria-pressed={activeCategory === 'design-system'}
                                        onClick={() => setActiveCategory(activeCategory === 'design-system' ? null : 'design-system')}
                                        className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 aria-pressed:border-amber-500/50 aria-pressed:bg-amber-900/20 aria-pressed:text-amber-300"
                                        data-testid="chip-design-system"
                                    >
                                        Design System {mithrilCount}
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={activeCategory === 'accessibility'}
                                        onClick={() => setActiveCategory(activeCategory === 'accessibility' ? null : 'accessibility')}
                                        className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 aria-pressed:border-red-500/50 aria-pressed:bg-red-900/20 aria-pressed:text-red-300"
                                        data-testid="chip-accessibility"
                                    >
                                        Accessibility {a11yCount}
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={activeCategory === 'token-sync'}
                                        onClick={() => setActiveCategory(activeCategory === 'token-sync' ? null : 'token-sync')}
                                        className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 aria-pressed:border-indigo-500/50 aria-pressed:bg-indigo-900/20 aria-pressed:text-indigo-300"
                                        data-testid="chip-token-sync"
                                    >
                                        Token Sync {syncCount}
                                    </button>
                                </div>
                            )}
                            {/* COUNSEL.1.2: Delta mode auto-enable banner */}
                            {tokenCount > 0 && (initialViolationCount ?? 0) > 10 && isBaselineSet && !bannerDismissed && (
                                <div className="mx-3 mb-2 rounded border border-indigo-500/30 bg-indigo-900/10 px-3 py-2" data-testid="delta-mode-auto-banner">
                                    <p className="text-[10px] text-indigo-300">
                                        Delta mode active — showing new issues only. There are {initialViolationCount} existing violations being filtered.
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <button
                                            type="button"
                                            aria-label="Show all violations"
                                            onClick={() => void window.flintAPI.baseline?.clear?.()}
                                            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                                        >
                                            Show all violations
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Dismiss delta mode banner"
                                            onClick={() => setBannerDismissed(true)}
                                            className="text-[10px] text-zinc-500 hover:text-zinc-400"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-4 px-4 py-4" title={scoreTrendHint ?? undefined}>
                                <ScoreRing score={score} grade={grade} />
                                <div className="flex flex-col gap-0.5">
                                    <span className={`text-6xl font-bold leading-none ${GRADE_TEXT[grade]}`} aria-label={`Grade ${grade}`}>{grade}</span>
                                    <span className="text-xs text-zinc-500">{isBaselineSet ? 'Delta Score (new issues only)' : 'Governance Health'}</span>
                                    {scoreTrendHint && <span className="text-xs text-zinc-300 mt-0.5" data-testid="score-trend-hint">{scoreTrendHint}</span>}
                                    <p className="text-xs text-zinc-500 mt-1" data-testid="next-step-prompt">{nextStep.text}</p>
                                </div>
                            </div>
                            {(mithrilCount > 0 || a11yCount > 0 || overrideCount > 0) && (
                                <div className="px-3 py-2 space-y-1.5 border-t border-zinc-800/50">
                                    {mithrilCount > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="fidelity-score-row">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                            <span className="flex-1">Fidelity Score: {healthSignal.fidelityScore}/100 — fixing {mithrilCount} design system {mithrilCount !== 1 ? 'issues' : 'issue'} would raise your score by {mithrilCount * 5} pts</span>
                                        </div>
                                    )}
                                    {a11yCount > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="a11y-score-row">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                                            <span className="flex-1">Accessibility Score: {healthSignal.a11yScore}/100 — fixing {a11yCount} accessibility {a11yCount !== 1 ? 'issues' : 'issue'} would raise your score by {a11yCount * 10} pts</span>
                                        </div>
                                    )}
                                    {overrideCount > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-zinc-400" data-testid="override-score-row">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                            <span className="flex-1">Fixing {overrideCount} unapplied style {overrideCount !== 1 ? 'overrides' : 'override'} would raise your score by {overrideCount * 3} pts</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="px-3 py-2 border-t border-zinc-800/50">
                                <button
                                    type="button"
                                    onClick={() => setIsScoreExpanded((v) => !v)}
                                    className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                                    aria-expanded={isScoreExpanded}
                                    aria-controls="score-formula"
                                >
                                    {isScoreExpanded ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                                    How is this calculated?
                                </button>
                                {isScoreExpanded && (
                                    <div id="score-formula" className="mt-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 space-y-1.5">
                                        <ul className="space-y-1 text-[10px] text-zinc-500">
                                            <li className="flex items-center justify-between"><span>Critical violations</span><span className="font-mono text-red-400">−10 per issue</span></li>
                                            <li className="flex items-center justify-between"><span>Amber violations</span><span className="font-mono text-amber-400">−3 per issue</span></li>
                                            <li className="flex items-center justify-between"><span>Advisory violations</span><span className="font-mono text-zinc-400">−1 per issue</span></li>
                                            <li className="flex items-center justify-between"><span>Unapplied overrides</span><span className="font-mono text-amber-400">−3 per change</span></li>
                                        </ul>
                                        <p className="text-[10px] font-mono text-zinc-600">A (90–100) · B (80–89) · C (70–79) · D (60–69) · F (&lt;60)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── ACCORDION: Top Triggered Rules ─────────────────────────── */}
            {tokenCount > 0 && (
                <div className="border-t border-zinc-800">
                    <button
                        type="button"
                        onClick={() => setIsTopRulesOpen((v) => !v)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                        aria-expanded={isTopRulesOpen}
                        aria-controls="top-rules-accordion"
                    >
                        {isTopRulesOpen ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" /> : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                        <span className="flex-1 text-xs text-zinc-400">Top Triggered Rules</span>
                        {topRules.length > 0 && <span className="font-mono text-[10px] text-zinc-600">{topRules.length}</span>}
                    </button>
                    {isTopRulesOpen && (
                        <div id="top-rules-accordion" className="px-3 py-2 space-y-1">
                            {topRules.length === 0 ? (
                                <p className="text-xs text-emerald-400">No issues</p>
                            ) : (
                                topRules.map((row) => (
                                    <button
                                        key={`${row.type}-${row.severity}`}
                                        type="button"
                                        onClick={() => handleRuleRowClick(row.type)}
                                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-zinc-800/50 transition-colors text-left"
                                        data-testid={`rule-row-${row.type}`}
                                        title={`Scroll to ${TYPE_LABEL[row.type]} issues`}
                                    >
                                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[row.severity]}`} aria-hidden="true" />
                                        <span className="flex-1 truncate text-xs text-zinc-300">{TYPE_LABEL[row.type]}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_BADGE[row.severity]}`}>{row.severity}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{row.count}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── ACCORDION: Session & Baseline ─────────────────────────── */}
            {tokenCount > 0 && (
                <div className="border-t border-zinc-800">
                    <button
                        type="button"
                        onClick={() => setIsSessionOpen((v) => !v)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                        aria-expanded={isSessionOpen}
                        aria-controls="session-accordion"
                    >
                        {isSessionOpen ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" /> : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                        <span className="flex-1 text-xs text-zinc-400">Session &amp; Baseline</span>
                        {isBaselineSet && <span className="text-[10px] text-indigo-400">Delta on</span>}
                    </button>
                    {isSessionOpen && (
                        <div id="session-accordion" className="px-3 py-2 space-y-2">
                            {activeFileName ? (
                                <div className="flex items-center gap-2 rounded px-2 py-1.5 bg-zinc-800/40">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />
                                    <span className="flex-1 truncate font-mono text-xs text-zinc-300" title={activeFilePath ?? ''}>{activeFileName}</span>
                                    {mithrilCount + a11yCount > 0 && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{mithrilCount + a11yCount}</span>
                                    )}
                                </div>
                            ) : (
                                <p className="py-1 text-xs text-zinc-600">No file open</p>
                            )}
                            <div className="flex items-center gap-2" data-testid="delta-mode-section">
                                {!isBaselineSet ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleSetBaseline()}
                                        disabled={baselineStatus !== 'idle' || !activeFilePath}
                                        className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-900/20 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {baselineStatus === 'setting'
                                            ? 'Setting baseline...'
                                            : `Show only new issues${totalRaw > 0 ? ` (${totalRaw} baselined)` : ''}`}
                                    </button>
                                ) : (
                                    <>
                                        <span className="flex-1 text-xs text-indigo-400">Showing new issues only ({baselineEntries.length} baselined)</span>
                                        <button
                                            type="button"
                                            onClick={() => void handleClearBaseline()}
                                            disabled={baselineStatus !== 'idle'}
                                            className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-red-500/40 hover:bg-red-900/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {baselineStatus === 'clearing' ? 'Clearing...' : 'Show All'}
                                        </button>
                                    </>
                                )}
                            </div>
                            {overridesExist && (
                                <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-900/20 px-3 py-2">
                                    <span className="flex-1 text-xs text-amber-400">Manual Style Overrides active — export blocked</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono">{overrideCount}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Confirmation toast ─────────────────────────────────────── */}
            {confirmationMsg && (
                <div className="mx-3 mt-2 flex items-center gap-2 rounded border border-indigo-500/40 bg-indigo-900/20 px-3 py-2" role="status" aria-live="polite">
                    <span className="flex-1 text-xs text-indigo-300">{confirmationMsg}</span>
                </div>
            )}

            {/* ── ACCORDION: MCP Activity Feed (S4.11) ──────────────────── */}
            <div className="border-t border-zinc-800">
                <button
                    type="button"
                    onClick={() => setIsActivityOpen((v) => !v)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                    aria-expanded={isActivityOpen}
                    aria-controls="activity-accordion"
                    data-testid="activity-accordion-toggle"
                >
                    {isActivityOpen
                        ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                        : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                    <span className="flex-1 text-xs text-zinc-400">Agent Activity</span>
                    {mcpActivityEvents.length > 0 && (
                        <span className="text-[10px] text-zinc-600">{mcpActivityEvents.length}</span>
                    )}
                </button>
                {isActivityOpen && (
                    <div
                        id="activity-accordion"
                        className="px-3 py-2"
                        data-testid="activity-feed-section"
                    >
                        {mcpActivityEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                                <Activity className="h-5 w-5 text-zinc-600" aria-hidden="true" />
                                <p className="text-sm text-zinc-500">
                                    This feed tracks AI agent actions. Connect an MCP client to start seeing activity.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {mcpActivityEvents.map((event) => (
                                    <div
                                        key={event.id}
                                        className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/40"
                                    >
                                        <span
                                            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                                                event.severity === 'error' || event.severity === 'critical'
                                                    ? 'bg-red-400'
                                                    : event.severity === 'warning'
                                                      ? 'bg-amber-400'
                                                      : 'bg-indigo-400'
                                            }`}
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs text-zinc-300">{event.title}</p>
                                            {event.message && (
                                                <p className="truncate text-[10px] text-zinc-500">{event.message}</p>
                                            )}
                                        </div>
                                        {/* S5.11: "Undo this" link for mutation-type events that changed code */}
                                        {event.type === 'mutation' && (
                                            <button
                                                type="button"
                                                onClick={() => void applyUndo()}
                                                className="shrink-0 self-center rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors"
                                                aria-label="Undo this agent action"
                                            >
                                                Undo this
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Compliance Coverage (ERM) ──────────────────────────────── */}
            <CoverageBar coverages={jurisdictionCoverage} isLoading={isLoadingConfig} />

            {/* ── Config Inheritance (ERM) ───────────────────────────────── */}
            <InheritanceChain chain={inheritanceChain} isLoading={isLoadingConfig} />
        </div>
    )
}
