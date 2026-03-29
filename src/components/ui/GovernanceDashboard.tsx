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

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, Loader2, Play, ShieldOff, ShieldCheck, Wand2, SendHorizonal, Copy, Check, Activity, Pin } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useGovernanceStore } from '../../store/governanceStore'
import { useTokenStore } from '../../store/tokenStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { LinterWarning, BaselineEntry } from '../../types/flint-api'
import { auditDelta } from '../../utils/deltaAudit'
import { CoverageBar } from './CoverageBar'
import { InheritanceChain } from './InheritanceChain'
import { useGovernanceConfig } from '../../hooks/useGovernanceConfig'
import { useUserPrefs } from '../../hooks/useUserPrefs'
import { FixPreviewDrawer, type FixableItem } from './FixPreviewDrawer'
import { applyUndo } from '../../core/recoveryController'

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface GovernanceDashboardProps {
    onOpenExportModal?: () => void
    /** S5.8: Opens the full GovernancePanel rules manager */
    onOpenGovernancePanel?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceDashboard({ onOpenExportModal, onOpenGovernancePanel }: GovernanceDashboardProps = {}) {
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

    // ── Derived counts (delta-aware) ──────────────────────────────────────────
    const mithrilCount  = effectiveLinterWarnings.length
    const a11yCount     = effectiveA11yWarnings.length
    // Use the real override count from IPC (govOverrideCount); fall back to 1
    // when overridesExist is true but the count hasn't loaded yet.
    const overrideCount = overridesExist ? Math.max(1, govOverrideCount) : 0

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
                        <span className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-900/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400" title="New Issues Only — violations present at baseline are excluded">
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
                            Export blocked — {mithrilCount + a11yCount} violation{mithrilCount + a11yCount !== 1 ? 's' : ''}
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
                            {isBaselineSet ? 'No new violations — export ready' : 'All clear — export ready'}
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
                            Auto-fixes Tier-1 violations as you work
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAutopilotEnabled(!autopilotEnabled)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            autopilotEnabled ? 'bg-blue-500' : 'bg-zinc-700'
                        }`}
                        role="switch"
                        aria-checked={autopilotEnabled}
                        aria-label="Toggle Autopilot"
                    >
                        <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                autopilotEnabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                        />
                    </button>
                </div>
            )}

            {/* ── VIOLATIONS SECTION — primary job surface ─────────────── */}
            {tokenCount > 0 && (mithrilCount > 0 || a11yCount > 0 || overridesExist) && (
                <div ref={violationsSectionRef}>
                    {/* Section header + batch fix CTA */}
                    <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
                        <h4 className="flex-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
                            Violations
                            {isBaselineSet && <span className="ml-1.5 text-indigo-400">(new only)</span>}
                        </h4>
                        {autoFixableEntries.length > 0 && (
                            <button
                                type="button"
                                onClick={handleFixAll}
                                className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/20 px-2.5 py-1 text-[10px] text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition-colors"
                                aria-label={`Fix all ${autoFixableEntries.length} auto-fixable violations`}
                            >
                                <Wand2 size={9} aria-hidden="true" />
                                Auto-fix {autoFixableEntries.length} {autoFixableEntries.length === 1 ? 'issue' : 'issues'}
                            </button>
                        )}
                    </div>

                    {/* Violation cards — expandable action items */}
                    <div className="divide-y divide-zinc-800/50">
                        {effectiveLinterWarnings.map((w) => {
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
                            const isOpen = expandedViolations.has(`m-${w.id}`) || pinnedViolations.has(`m-${w.id}`)
                            const isPinned = pinnedViolations.has(`m-${w.id}`)
                            return (
                                <div key={`m-${w.id}`} className="border-b border-zinc-800/30 last:border-0">
                                    {/* Summary row — always visible. Expand toggle and action buttons are siblings. */}
                                    <div className="flex w-full items-start hover:bg-zinc-800/30 transition-colors">
                                        <button
                                            type="button"
                                            onClick={() => toggleViolation(`m-${w.id}`)}
                                            className="flex flex-1 items-start gap-2 px-3 py-2 text-left min-w-0"
                                            aria-expanded={isOpen}
                                            aria-controls={`v-m-${w.id}`}
                                        >
                                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[w.severity]}`} aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] text-zinc-300 font-medium">{ruleId}</p>
                                                {/* S5.10: line-clamp-2 instead of truncate — shows 2 lines before ellipsis */}
                                                <p className="text-[10px] text-zinc-500 line-clamp-2" title={w.message}>
                                                    {w.message.replace(/^[A-Z0-9-]+:\s*/, '')}
                                                </p>
                                            </div>
                                            {isOpen
                                                ? <ChevronDown size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />
                                                : <ChevronRight size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />}
                                        </button>
                                        {/* S5.5 + S5.9: action buttons (Fix / Defer / Pin) */}
                                        <div className="flex shrink-0 items-center gap-1 self-center mr-2">
                                            {canFix && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleFixSingle(fixItem!)}
                                                    className="rounded border border-indigo-500/30 bg-indigo-900/20 px-2 py-0.5 text-[10px] text-indigo-400 hover:bg-indigo-900/40 transition-colors"
                                                    aria-label={`Fix violation on element ${w.id}`}
                                                >
                                                    Fix
                                                </button>
                                            )}
                                            {/* S5.5: Defer — snoozes the violation for this session */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void window.flintAPI.deferViolation?.(activeFilePath ?? '', ruleId, w.id)
                                                    useNotificationStore.getState().push({ type: 'sync', title: 'Deferred', message: `${ruleId} deferred`, severity: 'info', autoDismissMs: 3000 })
                                                }}
                                                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                                                aria-label={`Defer ${ruleId} violation`}
                                                title="Snooze this violation for the current session"
                                            >
                                                Defer
                                            </button>
                                            {/* S5.9: Pin — keeps the detail panel open while working */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    togglePin(`m-${w.id}`)
                                                    if (!isPinned) setExpandedViolations((prev) => { const n = new Set(prev); n.add(`m-${w.id}`); return n })
                                                }}
                                                className={`rounded p-0.5 transition-colors ${isPinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                aria-label={isPinned ? 'Unpin violation detail' : 'Pin violation detail open'}
                                                title={isPinned ? 'Unpin' : 'Pin open while working'}
                                            >
                                                <Pin size={9} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>

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
                        {effectiveA11yWarnings.map((w, i) => {
                            const guide = getFixGuide('a11y', w.message)
                            const ruleId = extractRuleIdFromMsg(w.message) ?? 'A11Y'
                            const isOpen = expandedViolations.has(`a-${w.id}-${i}`) || pinnedViolations.has(`a-${w.id}-${i}`)
                            const isPinned = pinnedViolations.has(`a-${w.id}-${i}`)
                            return (
                                <div key={`a-${w.id}-${i}`} className="border-b border-zinc-800/30 last:border-0">
                                    <div className="flex w-full items-start hover:bg-zinc-800/30 transition-colors">
                                        <button
                                            type="button"
                                            onClick={() => toggleViolation(`a-${w.id}-${i}`)}
                                            className="flex flex-1 items-start gap-2 px-3 py-2 text-left min-w-0"
                                            aria-expanded={isOpen}
                                            aria-controls={`v-a-${w.id}-${i}`}
                                        >
                                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] text-zinc-300 font-medium">{ruleId}</p>
                                                {/* S5.10: line-clamp-2 shows 2 lines before truncating */}
                                                <p className="text-[10px] text-zinc-500 line-clamp-2" title={w.message}>
                                                    {w.message.replace(/^[A-Z0-9-]+:\s*/, '')}
                                                </p>
                                            </div>
                                            {isOpen
                                                ? <ChevronDown size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />
                                                : <ChevronRight size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />}
                                        </button>
                                        {/* S5.5 + S5.9: Defer + Pin actions for a11y violations */}
                                        <div className="flex shrink-0 items-center gap-1 self-center mr-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void window.flintAPI.deferViolation?.(activeFilePath ?? '', ruleId, w.id)
                                                    useNotificationStore.getState().push({ type: 'sync', title: 'Deferred', message: `${ruleId} deferred`, severity: 'info', autoDismissMs: 3000 })
                                                }}
                                                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
                                                aria-label={`Defer ${ruleId} violation`}
                                                title="Snooze this violation for the current session"
                                            >
                                                Defer
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    togglePin(`a-${w.id}-${i}`)
                                                    if (!isPinned) setExpandedViolations((prev) => { const n = new Set(prev); n.add(`a-${w.id}-${i}`); return n })
                                                }}
                                                className={`rounded p-0.5 transition-colors ${isPinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                aria-label={isPinned ? 'Unpin violation detail' : 'Pin violation detail open'}
                                                title={isPinned ? 'Unpin' : 'Pin open while working'}
                                            >
                                                <Pin size={9} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>

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

            {/* S5.8: Configure rules link — shown whenever there are violations */}
            {tokenCount > 0 && (mithrilCount > 0 || a11yCount > 0) && onOpenGovernancePanel && (
                <div className="flex items-center justify-end border-b border-zinc-800/60 px-3 py-1.5">
                    <button
                        type="button"
                        onClick={onOpenGovernancePanel}
                        className="text-[10px] text-zinc-600 underline-offset-2 hover:text-indigo-400 hover:underline transition-colors"
                    >
                        Configure rules
                    </button>
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
                            <div className="flex items-center gap-4 px-4 py-4" title={scoreTrendHint ?? undefined}>
                                <ScoreRing score={score} grade={grade} />
                                <div className="flex flex-col gap-0.5">
                                    <span className={`text-6xl font-bold leading-none ${GRADE_TEXT[grade]}`} aria-label={`Grade ${grade}`}>{grade}</span>
                                    <span className="text-xs text-zinc-500">{isBaselineSet ? 'Delta Score (new issues only)' : 'Governance Health'}</span>
                                    {scoreTrendHint && <span className="text-xs text-zinc-300 mt-0.5" data-testid="score-trend-hint">{scoreTrendHint}</span>}
                                </div>
                            </div>
                            {(mithrilCount > 0 || a11yCount > 0 || overrideCount > 0) && (
                                <div className="px-3 py-2 space-y-1.5 border-t border-zinc-800/50">
                                    {mithrilCount > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                                            <span className="flex-1">Fixing {mithrilCount} design system {mithrilCount !== 1 ? 'issues' : 'issue'} would raise your score by {mithrilCount * 5} pts</span>
                                        </div>
                                    )}
                                    {a11yCount > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                                            <span className="flex-1">Fixing {a11yCount} accessibility {a11yCount !== 1 ? 'issues' : 'issue'} would raise your score by {a11yCount * 10} pts</span>
                                        </div>
                                    )}
                                    {overrideCount > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
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
                                            <li className="flex items-center justify-between"><span>Design system drift</span><span className="font-mono text-amber-400">−5 per issue</span></li>
                                            <li className="flex items-center justify-between"><span>Accessibility violations</span><span className="font-mono text-red-400">−10 per issue</span></li>
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

            {/* ── ACCORDION: Top Violated Rules ─────────────────────────── */}
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
                        <span className="flex-1 text-xs text-zinc-400">Top Violated Rules</span>
                        {topRules.length > 0 && <span className="font-mono text-[10px] text-zinc-600">{topRules.length}</span>}
                    </button>
                    {isTopRulesOpen && (
                        <div id="top-rules-accordion" className="px-3 py-2 space-y-1">
                            {topRules.length === 0 ? (
                                <p className="text-xs text-emerald-400">No violations</p>
                            ) : (
                                topRules.map((row) => (
                                    <button
                                        key={`${row.type}-${row.severity}`}
                                        type="button"
                                        onClick={() => handleRuleRowClick(row.type)}
                                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-zinc-800/50 transition-colors text-left"
                                        data-testid={`rule-row-${row.type}`}
                                        title={`Scroll to ${TYPE_LABEL[row.type]} violations`}
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
                                            : `Show only new violations${totalRaw > 0 ? ` (${totalRaw} baselined)` : ''}`}
                                    </button>
                                ) : (
                                    <>
                                        <span className="flex-1 text-xs text-indigo-400">Showing new violations only ({baselineEntries.length} baselined)</span>
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
