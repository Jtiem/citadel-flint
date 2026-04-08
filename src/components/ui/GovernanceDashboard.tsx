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
import { ChevronDown, ChevronRight, Loader2, Play, ShieldOff, ShieldCheck, Wand2, SendHorizonal, Copy, Check, Activity, Pin, AlertTriangle, Flag, X, CheckCircle2, ClipboardList, TrendingUp, TrendingDown } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useGovernanceStore } from '../../store/governanceStore'
import { useTokenStore } from '../../store/tokenStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { LinterWarning, BaselineEntry, ProvenanceInfo, AnomalyAlert, PendingMutation } from '../../types/flint-api'
import { auditDelta } from '../../utils/deltaAudit'
import { CoverageBar } from './CoverageBar'
import { InheritanceChain } from './InheritanceChain'
import { Modal } from './Modal'
import { useGovernanceConfig } from '../../hooks/useGovernanceConfig'
import { useUserPrefs } from '../../hooks/useUserPrefs'
import { FixPreviewDrawer, type FixableItem } from './FixPreviewDrawer'
import { applyUndo } from '../../core/recoveryController'
import { formatHealthSignal } from '../../../shared/healthSignal'
import type { DeferDuration } from '../../../shared/deferralUtils'
import { useGovernanceHealth, gradeFromScore } from '../../hooks/useGovernanceHealth'
import { ScoreSection } from './governance/ScoreSection'
import { ViolationCard, extractHardcodedClassFromMsg as _extractHardcodedClass, extractRuleIdFromMsg as _extractRuleId, A11Y_NOT_AUTO_FIXABLE as _A11Y_NOT_AUTO_FIXABLE } from './governance/ViolationCard'
import { BatchActionBar } from './governance/BatchActionBar'

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
    /** COUNSEL.4.4: Animate a green pulse on the ring when true */
    pulse?: boolean
}

function ScoreRing({ score, grade, pulse }: ScoreRingProps) {
    const RADIUS = 34
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS
    const filled = (score / 100) * CIRCUMFERENCE
    const gap    = CIRCUMFERENCE - filled

    return (
        <svg
            width={80}
            height={80}
            viewBox="0 0 80 80"
            className={`shrink-0${pulse ? ' motion-safe:animate-pulse' : ''}`}
            aria-label={`Health score ${score} out of 100`}
            role="img"
            data-testid="score-ring"
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

/** A11y rules where Warden cannot auto-fix — requires human intervention. */
// A11y rules that CANNOT be auto-fixed — these require manual structural
// changes that can't be safely automated (context-dependent, structural injection).
// Rules NOT in this set have deterministic updateProp fixes in fixer.ts.
const A11Y_NOT_AUTO_FIXABLE = new Set([
    'A11Y-008', 'A11Y-010', 'A11Y-012', 'A11Y-014', 'A11Y-015', 'A11Y-016',
    'A11Y-017', 'A11Y-021', 'A11Y-022', 'A11Y-030', 'A11Y-031', 'A11Y-032',
    'A11Y-035', 'A11Y-050', 'A11Y-051', 'A11Y-052', 'A11Y-053',
    'A11Y-060', 'A11Y-061', 'A11Y-062', 'A11Y-070', 'A11Y-072', 'A11Y-073',
    'A11Y-090',
])

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
    'A11Y-010': {
        wcag: 'WCAG 1.3.1 Info and Relationships',
        wcagRef: '1.3.1',
        why: 'Screen readers use heading levels to build a page outline. Skipping levels (e.g. h1 → h3) breaks that outline and confuses users navigating by headings.',
        steps: [
            'Check the heading hierarchy — each level should follow the previous (h1 → h2 → h3)',
            'Change the skipped heading to the correct level (e.g. <h3> → <h2>)',
            'Use CSS to style heading size independently from the semantic level',
        ],
        snippet: '<h2 className="text-lg font-semibold">Section title</h2>',
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

// ── COUNSEL.4.2: Sparkline (SVG) ────────────────────────────────────────────

function Sparkline({ data }: { data: Array<{ score: number }> }) {
    if (data.length < 2) return null
    const w = 120, h = 32, pad = 2
    const scores = data.slice(-7).map(d => d.score)
    const min = Math.min(...scores), max = Math.max(...scores)
    const range = max - min || 1
    const points = scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * (w - 2 * pad)
        const y = h - pad - ((s - min) / range) * (h - 2 * pad)
        return `${x},${y}`
    }).join(' ')
    const trend = scores[scores.length - 1] - scores[0]
    const color = trend > 2 ? '#34d399' : trend < -2 ? '#f87171' : '#fbbf24'
    return (
        <svg width={w} height={h} className="shrink-0" aria-label="Health trend" role="img" data-testid="sparkline">
            <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        </svg>
    )
}

// ── Relative time helper ────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

// ── COUNSEL.2.3: Resurface time helper ──────────────────────────────────────
// Computes how much time remains until a deferred violation resurfaces.
// Returns null when expiresAt is null (manual defer — never auto-resurfaces).

function resurfaceLabel(expiresAtMs: number | null): { text: string; overdue: boolean } | null {
    if (expiresAtMs === null) return null
    const remaining = expiresAtMs - Date.now()
    if (remaining <= 0) return { text: 'Resurface due', overdue: true }
    const mins = Math.floor(remaining / 60000)
    if (mins < 60) return { text: `Resurfaces in ${mins}m`, overdue: false }
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) {
        const leftoverMins = mins % 60
        return { text: leftoverMins > 0 ? `Resurfaces in ${hrs}h ${leftoverMins}m` : `Resurfaces in ${hrs}h`, overdue: false }
    }
    const days = Math.floor(hrs / 24)
    return { text: `Resurfaces in ${days} ${days === 1 ? 'day' : 'days'}`, overdue: false }
}

// ── COUNSEL.4.5: Audit log entry type ───────────────────────────────────────

interface AuditLogEntry {
    id: number | string
    timestamp: string
    action: string
    filePath: string
    description: string
}

// ── Impact colour helpers ───────────────────────────────────────────────────

const IMPACT_COLOR: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
}

const IMPACT_BORDER: Record<string, string> = {
    low: 'border-emerald-500/30 bg-emerald-900/10',
    medium: 'border-amber-500/30 bg-amber-900/10',
    high: 'border-red-500/30 bg-red-900/10',
}

const RISK_TIER_STYLE: Record<string, string> = {
    Amber: 'border-amber-500/40 bg-amber-900/20 text-amber-400',
    Red: 'border-red-500/40 bg-red-900/20 text-red-400',
}

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
            .catch((err) => console.warn('[Flint] GovernanceDashboard: failed to fetch override count', err))
    }, [])

    useEffect(() => {
        fetchOverrideCount()
        const unsubscribe = window.flintAPI.governance.onOverrideRecorded(() => {
            fetchOverrideCount()
        })
        return unsubscribe
    }, [fetchOverrideCount])

    // EDU-08: "How is this calculated?" — opens as a modal
    const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)

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
        } catch (err) { console.warn('[Flint] GovernanceDashboard: failed to persist flag', err) }
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

    // ── COUNSEL.2.3: Deferred violations with expiresAt for resurface labels ──
    // Map from cardKey → expiresAt unix-ms (null = manual / never)
    const [deferredExpiresAt, setDeferredExpiresAt] = useState<Map<string, number | null>>(new Map())
    // Tick counter refreshed every 60s so resurface labels stay current
    const [resurfaceTick, setResurfaceTick] = useState(0)

    useEffect(() => {
        const id = setInterval(() => setResurfaceTick((t) => t + 1), 60_000)
        return () => clearInterval(id)
    }, [])

    // ── COUNSEL.4.4: Animated pulse on zero-violation ring ───────────────────
    // Pulse for 3 seconds when the total drops to 0 (celebration state)
    const [ringPulse, setRingPulse] = useState(false)
    const prevTotalRef = useRef<number | null>(null)
    // totalViolations is computed below from mithrilCount + a11yCount but we
    // reference it reactively here via a separate effect after deriving it.

    // ── COUNSEL.4.5: Audit log ────────────────────────────────────────────────
    const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
    const [isAuditLogOpen, setIsAuditLogOpen] = useState(false)

    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getAuditLog) {
            void api.getAuditLog({ limit: 50 })
                .then(setAuditLog)
                .catch(() => setAuditLog([]))
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

    // ── COUNSEL.4.4: Trigger ring pulse when total drops to 0 ────────────────
    const totalViolations = mithrilCount + a11yCount
    useEffect(() => {
        if (prevTotalRef.current !== null && prevTotalRef.current > 0 && totalViolations === 0) {
            setRingPulse(true)
            const t = setTimeout(() => setRingPulse(false), 3000)
            return () => clearTimeout(t)
        }
        prevTotalRef.current = totalViolations
    }, [totalViolations])

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
        if (!window.flintAPI.mcp?.callTool) {
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Fix unavailable',
                message: 'Flint MCP is not connected — start the MCP server to enable auto-fix',
                severity: 'warning',
                autoDismissMs: 5000,
            })
            return
        }
        try {
            const result = await window.flintAPI.mcp.callTool('flint_fix', { file: filePath, ruleId, dry_run: false })
            // Check whether the tool actually applied any fixes.
            // MCP callTool returns { content: [{ type, text }] } — parse the JSON text.
            let fixCount = 0
            try {
                const text = result?.content?.[0]?.text
                if (text) { fixCount = JSON.parse(text)?.fixesApplied ?? 0 }
            } catch (err) { console.warn('[Flint] GovernanceDashboard: failed to parse fix result', err) }
            if (fixCount === 0) {
                useNotificationStore.getState().push({
                    type: 'violation',
                    title: 'No auto-fix available',
                    message: `${ruleId} requires a manual fix — add the missing attribute in your editor`,
                    severity: 'warning',
                    autoDismissMs: 5000,
                })
                return
            }
            // Re-sync editor store so in-memory AST matches what MCP wrote to disk
            try {
                const content = await window.flintAPI.readFile(filePath)
                useEditorStore.getState().syncCode(content)
            } catch (err) { console.warn('[Flint] GovernanceDashboard: failed to re-sync editor after fix', err) }
            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'Fix applied',
                message: `${ruleId} fixed in ${filePath.split('/').pop()}`,
                severity: 'info',
                autoDismissMs: 3000,
            })
            // Trigger re-audit so violations refresh
            void window.flintAPI.mcp?.callTool('flint_audit', { file: filePath }).catch((err) => console.warn('[Flint] GovernanceDashboard: post-fix re-audit failed', err))
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
        } catch (err) { console.warn('[Flint] GovernanceDashboard: deferViolation IPC failed', err) }
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
        // COUNSEL.2.3: store the computed expiresAt for the resurface label
        const { computeExpiresAt: computeExp } = await import('../../../shared/deferralUtils')
        const expiresMs: number | null = (() => {
            if (duration === 'Manually') return null
            const expStr = computeExp(duration as Parameters<typeof computeExp>[0])
            return expStr ? new Date(expStr).getTime() : null
        })()
        setDeferredExpiresAt((prev) => new Map([...prev, [key, expiresMs]]))
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

    // ── COUNSEL.3.1: Last clean state (Rewind to clean) ────────────────────
    const [lastCleanState, setLastCleanState] = useState<{ timestamp: string; score: number } | null>(null)

    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getLastCleanState) {
            void api.getLastCleanState()
                .then(setLastCleanState)
                .catch(() => setLastCleanState(null))
        }
    }, [score]) // re-check when score changes

    const handleRewindToClean = useCallback(async () => {
        if (!lastCleanState) return
        const confirmed = window.confirm(
            `Rewind to last clean state (score ${lastCleanState.score}, ${relativeTime(lastCleanState.timestamp)})?\n\nThis will undo all changes since that point.`
        )
        if (!confirmed) return
        try {
            await applyUndo()
            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'Reverted to clean state',
                message: `Reverted to score ${lastCleanState.score}`,
                severity: 'info',
                autoDismissMs: 4000,
            })
        } catch {
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Rewind failed',
                message: 'Could not revert — try using the undo shortcut instead',
                severity: 'warning',
                autoDismissMs: 5000,
            })
        }
    }, [lastCleanState])

    // ── COUNSEL.4.1: Token impact preview ────────────────────────────────────
    const [tokenImpact, setTokenImpact] = useState<{ tokenName: string; affectedFiles: number; estimatedImpact: 'low' | 'medium' | 'high' } | null>(null)
    const [isTokenImpactOpen, setIsTokenImpactOpen] = useState(false)

    // Fetch token impact when sync-type violations exist
    useEffect(() => {
        const syncWarnings = effectiveLinterWarnings.filter((w) => w.type === 'sync')
        if (syncWarnings.length === 0) {
            setTokenImpact(null)
            return
        }
        const api = window.flintAPI.governance
        if (!api.previewTokenImpact) return
        // Use the first sync warning's token as the preview candidate
        const firstSync = syncWarnings[0]
        const tokenName = firstSync.nearestToken ?? extractHardcodedClassFromMsg(firstSync.message) ?? ''
        if (!tokenName) return
        void api.previewTokenImpact(tokenName, '')
            .then((result) => setTokenImpact({ tokenName, ...result }))
            .catch(() => setTokenImpact(null))
    }, [effectiveLinterWarnings])

    // ── COUNSEL.4.2: Health history for sparkline ────────────────────────────
    const [healthHistory, setHealthHistory] = useState<Array<{ date: string; score: number; grade: string }>>([])

    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getHealthHistory) {
            void api.getHealthHistory()
                .then(setHealthHistory)
                .catch(() => setHealthHistory([]))
        }
    }, [])

    // Record health entry when score changes (debounced by React's batching)
    const prevScoreRef = useRef<number | null>(null)
    useEffect(() => {
        if (prevScoreRef.current === null) {
            prevScoreRef.current = score
            return
        }
        if (prevScoreRef.current === score) return
        prevScoreRef.current = score
        const api = window.flintAPI.governance
        if (api.recordHealth && tokenCount > 0) {
            void api.recordHealth({ score, grade })
                .then(() => {
                    // Refresh the sparkline data after recording
                    if (api.getHealthHistory) {
                        void api.getHealthHistory()
                            .then(setHealthHistory)
                            .catch((err) => console.warn('[Flint] GovernanceDashboard: failed to refresh health history', err))
                    }
                })
                .catch((err) => console.warn('[Flint] GovernanceDashboard: failed to record health score', err))
        }
    }, [score, grade, tokenCount])

    // ── S8.3: Pending mutations ──────────────────────────────────────────────
    const [pendingMutations, setPendingMutations] = useState<PendingMutation[]>([])
    const [isPendingOpen, setIsPendingOpen] = useState(false)

    useEffect(() => {
        const api = window.flintAPI.governance
        if (api.getPendingMutations) {
            void api.getPendingMutations()
                .then(setPendingMutations)
                .catch(() => setPendingMutations([]))
        }
    }, [])

    const handleApproveMutation = useCallback(async (id: number) => {
        const api = window.flintAPI.governance
        if (!api.approveMutation) return
        try {
            await api.approveMutation(id)
            setPendingMutations((prev) => prev.filter((m) => m.id !== id))
            useNotificationStore.getState().push({
                type: 'mutation',
                title: 'Mutation approved',
                message: `Mutation #${id} approved`,
                severity: 'info',
                autoDismissMs: 3000,
            })
        } catch (err) { console.warn('[Flint] GovernanceDashboard: approve mutation failed', err) }
    }, [])

    const handleRejectMutation = useCallback(async (id: number) => {
        const api = window.flintAPI.governance
        if (!api.rejectMutation) return
        try {
            await api.rejectMutation(id)
            setPendingMutations((prev) => prev.filter((m) => m.id !== id))
            useNotificationStore.getState().push({
                type: 'violation',
                title: 'Mutation rejected',
                message: `Mutation #${id} rejected and removed`,
                severity: 'warning',
                autoDismissMs: 3000,
            })
        } catch (err) { console.warn('[Flint] GovernanceDashboard: reject mutation failed', err) }
    }, [])

    // ── COUNSEL.1.6: A11y auto-fixable entries ────────────────────────────────
    // A11y violations that have deterministic updateProp fixes in fixer.ts
    const autoFixableA11yEntries = useMemo(
        () => effectiveA11yWarnings.filter((w) => {
            const ruleId = extractRuleIdFromMsg(w.message) ?? ''
            return !A11Y_NOT_AUTO_FIXABLE.has(ruleId)
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
                    await handleA11yFix(rId).catch((err) => console.warn('[Flint] GovernanceDashboard: a11y batch fix item failed', err))
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
                    {totalViolations > 0 && (
                        <button
                            type="button"
                            data-testid="autopilot-header-toggle"
                            onClick={() => setAutopilotEnabled(!autopilotEnabled)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                                autopilotEnabled
                                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                            }`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${autopilotEnabled ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
                            Autopilot {autopilotEnabled ? 'On' : 'Off'}
                        </button>
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

            {/* ── Export gate banner — rendered by ScoreSection below ─── */}
            {/* (moved to ScoreSection sub-component) */}

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
                        <span className="text-[10px] text-zinc-400 leading-snug">
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

            {/* ── COUNSEL.4.4: Zero-violation celebration state ─────────── */}
            {tokenCount > 0 && totalViolations === 0 && !overridesExist && (
                <div
                    className="flex flex-col items-center gap-3 px-6 py-8 border-b border-zinc-800 text-center"
                    data-testid="zero-violation-state"
                >
                    <CheckCircle2
                        className={`h-9 w-9 text-emerald-400${ringPulse ? ' motion-safe:animate-pulse' : ''}`}
                        aria-hidden="true"
                        data-testid="zero-violation-icon"
                    />
                    <div>
                        <p className="text-sm font-medium text-emerald-300">No issues found</p>
                        <p className="mt-1 text-xs text-zinc-400 max-w-[220px] leading-relaxed">
                            Your component meets all governance standards. You&apos;re clear to export.
                        </p>
                    </div>
                </div>
            )}

            {/* ── VIOLATIONS SECTION — primary job surface ─────────────── */}
            {tokenCount > 0 && (mithrilCount > 0 || a11yCount > 0 || overridesExist) && (
                <div ref={violationsSectionRef}>
                    {/* BatchActionBar — batch fix CTAs */}
                    <BatchActionBar
                        acceptedCount={acceptedFixes.length}
                        autoFixableCount={autoFixableEntries.length}
                        a11yFixableCount={autoFixableA11yEntries.length}
                        manualCount={manualA11yEntries.length}
                        onApplyAccepted={applyAcceptedFixes}
                        onAutoFixMithril={handleFixAll}
                        onFixAllA11y={() => void handleBatchFixA11y()}
                        onReviewManual={() => {
                            manualA11yEntries.forEach((w) => {
                                const k = `a-${w.id}-${effectiveA11yWarnings.indexOf(w)}`
                                setExpandedViolations((prev) => { const n = new Set(prev); n.add(k); return n })
                            })
                        }}
                        sessionProgress={sessionInitialCount > 0 ? {
                            fixed: Math.max(0, sessionInitialCount - mithrilCount - a11yCount),
                            total: sessionInitialCount,
                        } : undefined}
                        isBaselineSet={isBaselineSet}
                    />

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
                            const cardKey = `m-${w.id}`
                            const isPinned = pinnedViolations.has(cardKey)
                            const isFlagged = flaggedCardKeys.has(cardKey)
                            // resurfaceTick is read to ensure resurface labels inside ViolationCard refresh every 60s
                            void resurfaceTick
                            return (
                                <ViolationCard
                                    key={cardKey}
                                    issue={w}
                                    type="mithril"
                                    cardKey={cardKey}
                                    isPinned={isPinned}
                                    isFlagged={isFlagged}
                                    isDeferred={deferredCardKeys.has(cardKey)}
                                    deferExpiresAtMs={deferredExpiresAt.get(cardKey) ?? null}
                                    isDeferSuccess={deferSuccess.has(cardKey)}
                                    deferSuccessMsg={deferSuccessMsg.get(cardKey)}
                                    resurfaceTick={resurfaceTick}
                                    isExpanded={expandedViolations.has(cardKey)}
                                    isDiffOpen={inlineDiffOpen.has(cardKey)}
                                    isDiffLoading={inlineDiffLoading.has(cardKey)}
                                    diffData={inlineDiffData.get(cardKey) ?? null}
                                    isDeferFormOpen={deferFormOpen.has(cardKey)}
                                    fixItem={fixItem}
                                    provenance={provenanceMap[w.id] ?? null}
                                    deferReason={deferReasons.get(cardKey) ?? ''}
                                    deferDuration={deferDurations.get(cardKey) ?? '1 day'}
                                    onToggleExpand={() => toggleViolation(cardKey)}
                                    onFix={() => handleFixSingle(fixItem!)}
                                    onPreviewFix={() => void toggleInlineDiff(cardKey, extractRuleIdFromMsg(w.message) ?? w.type, activeFilePath)}
                                    onAcceptFix={() => acceptInlineFix(cardKey, fixItem!)}
                                    onSkipFix={() => skipInlineFix(cardKey)}
                                    onFlag={() => void handleFlag(cardKey, extractRuleIdFromMsg(w.message) ?? w.type, w.id)}
                                    onUnflag={() => handleUnflag(cardKey)}
                                    onDefer={(d) => setDeferDurations((prev) => new Map([...prev, [cardKey, d]]))}
                                    onDeferReasonChange={(r) => setDeferReasons((prev) => new Map([...prev, [cardKey, r]]))}
                                    onDeferDurationChange={(d) => setDeferDurations((prev) => new Map([...prev, [cardKey, d]]))}
                                    onSubmitDefer={() => void submitDefer(cardKey, extractRuleIdFromMsg(w.message) ?? w.type, w.id)}
                                    onCancelDefer={() => toggleDeferForm(cardKey)}
                                    onPin={() => {
                                        togglePin(cardKey)
                                        if (!isPinned) setExpandedViolations((prev) => { const n = new Set(prev); n.add(cardKey); return n })
                                    }}
                                    getNodeName={getNodeName}
                                    activeFilePath={activeFilePath}
                                />
                            )
                        })}

                        {/* A11y violation cards */}
                        {visibleA11yWarnings.map((w, i) => {
                            const cardKey = `a-${w.id}-${i}`
                            void resurfaceTick
                            return (
                                <ViolationCard
                                    key={cardKey}
                                    issue={w}
                                    type="a11y"
                                    cardKey={cardKey}
                                    indexInList={i}
                                    isPinned={pinnedViolations.has(cardKey)}
                                    isFlagged={flaggedCardKeys.has(cardKey)}
                                    isDeferred={deferredCardKeys.has(cardKey)}
                                    deferExpiresAtMs={deferredExpiresAt.get(cardKey) ?? null}
                                    isDeferSuccess={deferSuccess.has(cardKey)}
                                    deferSuccessMsg={deferSuccessMsg.get(cardKey)}
                                    resurfaceTick={resurfaceTick}
                                    isExpanded={expandedViolations.has(cardKey) || pinnedViolations.has(cardKey)}
                                    isDeferFormOpen={deferFormOpen.has(cardKey)}
                                    fixItem={null}
                                    diffData={null}
                                    isDiffOpen={false}
                                    isDiffLoading={false}
                                    provenance={provenanceMap[w.id] ?? null}
                                    deferReason={deferReasons.get(cardKey) ?? ''}
                                    deferDuration={deferDurations.get(cardKey) ?? '1 day'}
                                    onToggleExpand={() => toggleViolation(cardKey)}
                                    onFix={() => { /* a11y violations use handleA11yFix */ }}
                                    onPreviewFix={() => { /* no inline diff for a11y */ }}
                                    onAcceptFix={() => { /* no inline diff for a11y */ }}
                                    onSkipFix={() => { /* no inline diff for a11y */ }}
                                    onFlag={() => void handleFlag(cardKey, extractRuleIdFromMsg(w.message) ?? 'A11Y', w.id)}
                                    onUnflag={() => handleUnflag(cardKey)}
                                    onDefer={(d) => setDeferDurations((prev) => new Map([...prev, [cardKey, d]]))}
                                    onDeferReasonChange={(r) => setDeferReasons((prev) => new Map([...prev, [cardKey, r]]))}
                                    onDeferDurationChange={(d) => setDeferDurations((prev) => new Map([...prev, [cardKey, d]]))}
                                    onSubmitDefer={() => void submitDefer(cardKey, extractRuleIdFromMsg(w.message) ?? 'A11Y', w.id)}
                                    onCancelDefer={() => toggleDeferForm(cardKey)}
                                    onPin={() => {
                                        const isPinned = pinnedViolations.has(cardKey)
                                        togglePin(cardKey)
                                        if (!isPinned) setExpandedViolations((prev) => { const n = new Set(prev); n.add(cardKey); return n })
                                    }}
                                    getNodeName={getNodeName}
                                    activeFilePath={activeFilePath}
                                />
                            )
                        })}

                        {/* Overrides */}
                        {overridesExist && (
                            <div className="flex items-start gap-2 px-3 py-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                <div className="flex-1">
                                    <p className="text-[10px] text-zinc-300 font-medium">Unapplied Overrides</p>
                                    <p className="text-[10px] text-zinc-400">Property overrides are blocking export. Apply or revert them to unblock.</p>
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
                <ScoreSection
                    score={score}
                    grade={grade}
                    trend={healthHistory.length >= 2
                        ? healthHistory[healthHistory.length - 1].score - healthHistory[0].score
                        : 0}
                    exportBlocked={exportBlocked}
                    mithrilCount={mithrilCount}
                    a11yCount={a11yCount}
                    overridesExist={overridesExist}
                    overrideCount={overrideCount}
                    onRunAudit={() => void handleRunAudit()}
                    baselineMode={isBaselineSet}
                    onToggleBaseline={isBaselineSet ? () => void handleClearBaseline() : () => void handleSetBaseline()}
                    healthHistory={healthHistory}
                    scoreTrendHint={scoreTrendHint}
                    nextStep={nextStep}
                    effortText={effortText}
                    ringPulse={ringPulse}
                    lastCleanState={lastCleanState}
                    onRewindToClean={() => void handleRewindToClean()}
                    activeCategory={activeCategory}
                    onSetCategory={setActiveCategory}
                    syncCount={syncCount}
                    initialViolationCount={initialViolationCount}
                    isBaselineSet={isBaselineSet}
                    bannerDismissed={bannerDismissed}
                    onDismissBanner={() => setBannerDismissed(true)}
                    onShowAllViolations={() => void window.flintAPI.baseline?.clear?.()}
                    onOpenExportModal={onOpenExportModal}
                />
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
                                <p className="text-sm text-zinc-400">
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
                                                <p className="truncate text-[10px] text-zinc-400">{event.message}</p>
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

            {/* ── COUNSEL.4.1: Token Change Impact Preview ─────────────── */}
            {tokenImpact && (
                <div className="border-t border-zinc-800" data-testid="token-impact-section">
                    <button
                        type="button"
                        onClick={() => setIsTokenImpactOpen((v) => !v)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                        aria-expanded={isTokenImpactOpen}
                        aria-controls="token-impact-accordion"
                    >
                        {isTokenImpactOpen
                            ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                            : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                        <span className="flex-1 text-xs text-zinc-400">Token Impact</span>
                        <span className={`text-[10px] font-medium ${IMPACT_COLOR[tokenImpact.estimatedImpact]}`}>
                            {tokenImpact.estimatedImpact}
                        </span>
                    </button>
                    {isTokenImpactOpen && (
                        <div id="token-impact-accordion" className="px-3 py-2 space-y-1.5">
                            <div className={`flex items-start gap-2 rounded border px-3 py-2 ${IMPACT_BORDER[tokenImpact.estimatedImpact]}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-zinc-300">
                                        Changing <span className="font-mono text-indigo-300">{tokenImpact.tokenName}</span> would
                                        affect <span className={`font-bold ${IMPACT_COLOR[tokenImpact.estimatedImpact]}`}>{tokenImpact.affectedFiles}</span> {tokenImpact.affectedFiles === 1 ? 'file' : 'files'}
                                    </p>
                                    <p className={`mt-0.5 text-[10px] ${IMPACT_COLOR[tokenImpact.estimatedImpact]}`}>
                                        {tokenImpact.estimatedImpact === 'low' && 'Low impact — safe to change'}
                                        {tokenImpact.estimatedImpact === 'medium' && 'Medium impact — review affected files before changing'}
                                        {tokenImpact.estimatedImpact === 'high' && 'High impact — this token is widely used, proceed with caution'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── S8.3: Pending Approvals (MRS) ────────────────────────────── */}
            {pendingMutations.length > 0 && (
                <div className="border-t border-zinc-800" data-testid="pending-approvals-section">
                    <button
                        type="button"
                        onClick={() => setIsPendingOpen((v) => !v)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                        aria-expanded={isPendingOpen}
                        aria-controls="pending-approvals-accordion"
                    >
                        {isPendingOpen
                            ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                            : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                        <span className="flex-1 text-xs text-zinc-400">Pending Approvals</span>
                        <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                            {pendingMutations.length} pending
                        </span>
                    </button>
                    {isPendingOpen && (
                        <div id="pending-approvals-accordion" className="px-3 py-2 space-y-1.5" data-testid="pending-approvals-list">
                            {pendingMutations.map((m) => (
                                <div
                                    key={m.id}
                                    className={`rounded border px-3 py-2 ${RISK_TIER_STYLE[m.riskTier] ?? 'border-zinc-700 bg-zinc-800/50 text-zinc-400'}`}
                                    data-testid={`pending-mutation-${m.id}`}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">
                                                {m.type} — {m.filePath.split('/').pop() ?? m.filePath}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-mono">
                                                    Risk: {m.riskScore}
                                                </span>
                                                <span className={`text-[10px] rounded px-1 py-px ${
                                                    m.riskTier === 'Red' ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/40 text-amber-300'
                                                }`}>
                                                    {m.riskTier}
                                                </span>
                                                {m.agentId && (
                                                    <span className="text-[10px] text-zinc-400 truncate">
                                                        Agent: {m.agentId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => void handleApproveMutation(m.id)}
                                                className="rounded border border-emerald-500/40 bg-emerald-900/20 px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-900/40 transition-colors"
                                                aria-label={`Approve mutation ${m.id}`}
                                                data-testid={`approve-mutation-${m.id}`}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleRejectMutation(m.id)}
                                                className="rounded border border-red-500/40 bg-red-900/20 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-900/40 transition-colors"
                                                aria-label={`Reject mutation ${m.id}`}
                                                data-testid={`reject-mutation-${m.id}`}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── COUNSEL.4.5: Audit Log ──────────────────────────────────── */}
            <div className="border-t border-zinc-800" data-testid="audit-log-section">
                <button
                    type="button"
                    onClick={() => setIsAuditLogOpen((v) => !v)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                    aria-expanded={isAuditLogOpen}
                    aria-controls="audit-log-accordion"
                    data-testid="audit-log-toggle"
                >
                    {isAuditLogOpen
                        ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                        : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                    <ClipboardList size={11} className="shrink-0 text-zinc-500" aria-hidden="true" />
                    <span className="flex-1 text-xs text-zinc-400">Audit Log</span>
                    {auditLog.length > 0 && (
                        <span className="text-[10px] text-zinc-600">{auditLog.length}</span>
                    )}
                </button>
                {isAuditLogOpen && (
                    <div
                        id="audit-log-accordion"
                        className="overflow-y-auto"
                        style={{ maxHeight: 240 }}
                        data-testid="audit-log-list"
                    >
                        {auditLog.length === 0 ? (
                            <p className="px-4 py-4 text-xs text-zinc-600 text-center" data-testid="audit-log-empty">
                                No audit events yet
                            </p>
                        ) : (
                            <div className="divide-y divide-zinc-800/40">
                                {auditLog.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="flex items-start gap-2 px-3 py-2 hover:bg-zinc-800/30 transition-colors"
                                        data-testid={`audit-log-entry-${entry.id}`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-medium text-zinc-300">{entry.action}</span>
                                                <span className="text-[10px] font-mono text-zinc-600 truncate max-w-[100px]" title={entry.filePath}>
                                                    {entry.filePath.split('/').pop() ?? entry.filePath}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-zinc-400 line-clamp-1">{entry.description}</p>
                                        </div>
                                        <span className="shrink-0 text-[10px] text-zinc-700 tabular-nums">
                                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
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
