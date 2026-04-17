/**
 * ViolationCard.tsx — Extracted from GovernanceDashboard (Sprint 3A refactor)
 *
 * Renders a single violation card for either a Mithril (design-system) or
 * a11y violation.  Handles expand/collapse, inline diff preview, defer form,
 * flag/unflag, pin/unpin, and the fix-guidance panel.
 *
 * UX improvement (Sprint 3A): Secondary triage actions (Flag, Defer, Pin) are
 * only visible on hover using the Tailwind `group` + `opacity-0 group-hover:opacity-100`
 * pattern. At rest, only the primary action (Fix / "Needs input" badge) is shown.
 * This reduces visible interactive elements from 10 down to 2–3 per card.
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only.
 * - No arbitrary spacing — 4px grid scale only.
 */

import { useState, useEffect, useRef } from 'react'
import {
    ChevronDown, ChevronRight, Loader2, Check, Copy, Pin,
    TrendingUp, TrendingDown,
} from 'lucide-react'
import type { LinterWarning, ProvenanceInfo } from '../../../types/flint-api'
import type { FixableItem } from '../FixPreviewDrawer'
import type { DeferDuration } from '../../../../shared/deferralUtils'
import { OverrideReasonDialog } from './OverrideReasonDialog'

// ── Human-readable rule labels ────────────────────────────────────────────────

const RULE_HUMAN_LABELS: Record<string, string> = {
    'MITHRIL-COLOR': 'Color drift',
    'MITHRIL-INL-CLR': 'Hardcoded color',
    'MITHRIL-INL-SPC': 'Hardcoded spacing',
    'MITHRIL-INL-TYP': 'Hardcoded typography',
    'MITHRIL-INL-SDW': 'Hardcoded shadow',
    'MITHRIL-INL-OPC': 'Hardcoded opacity',
    'MITHRIL-TYPO-SIZE': 'Font size drift',
    'MITHRIL-TYPO-WEIGHT': 'Font weight drift',
    'MITHRIL-SPACING': 'Spacing drift',
    'MITHRIL-SHADOW': 'Shadow drift',
    'A11Y-001': 'Missing alt text',
    'A11Y-002': 'Empty button',
    'A11Y-003': 'Missing link text',
    'A11Y-004': 'Missing input label',
    'A11Y-005': 'Missing select label',
    'A11Y-006': 'Missing textarea label',
    'A11Y-007': 'Tab order disrupted',
    'A11Y-008': 'Table missing label',
    'A11Y-009': 'Missing lang attribute',
    'A11Y-010': 'Heading skip level',
    'inline-style': 'Inline style detected',
}

function getRuleLabel(ruleId: string): string {
    return RULE_HUMAN_LABELS[ruleId] ?? ruleId
}

// ── Shared token maps (used by both card types) ──────────────────────────────

const SEVERITY_DOT: Record<LinterWarning['severity'], string> = {
    critical: 'bg-red-400',
    amber: 'bg-amber-400',
    advisory: 'bg-indigo-400',
}

// ── Fix guide data (owned by ViolationCard) ───────────────────────────────────

interface FixGuide {
    wcag: string
    wcagRef: string
    why: string
    steps: string[]
    snippet?: string
}

/** A11y rules that CANNOT be auto-fixed — require manual structural changes. */
export const A11Y_NOT_AUTO_FIXABLE = new Set([
    'A11Y-008', 'A11Y-010', 'A11Y-012', 'A11Y-014', 'A11Y-015', 'A11Y-016',
    'A11Y-017', 'A11Y-021', 'A11Y-022', 'A11Y-030', 'A11Y-031', 'A11Y-032',
    'A11Y-035', 'A11Y-050', 'A11Y-051', 'A11Y-052', 'A11Y-053',
    'A11Y-060', 'A11Y-061', 'A11Y-062', 'A11Y-070', 'A11Y-072', 'A11Y-073',
    'A11Y-090',
])

export const A11Y_FIX_GUIDE: Record<string, FixGuide> = {
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
            "Add a visible <label> element referencing the input's id attribute",
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

export const MITH_FIX_GUIDE: Record<string, FixGuide> = {
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
    'inline-style': {
        wcag: 'Flint Design System',
        wcagRef: '',
        why: 'Inline styles bypass the design system and cannot be audited or automatically updated when tokens change.',
        steps: [
            'Remove the style prop from the element',
            'Replace each inline value with the equivalent Tailwind token class',
            'If no token matches, add the value to the design token file first',
        ],
    },
}

// ── Message parsing helpers ──────────────────────────────────────────────────

export function extractHardcodedClassFromMsg(message: string): string | null {
    const match = /'([^']+)'/.exec(message)
    return match ? match[1] : null
}

export function extractRuleIdFromMsg(message: string): string | null {
    const match = /^([A-Z0-9-]+):/.exec(message)
    return match ? match[1] : null
}

export function getFixGuide(type: LinterWarning['type'], message: string): FixGuide | null {
    const ruleId = extractRuleIdFromMsg(message)
    if (ruleId && A11Y_FIX_GUIDE[ruleId]) return A11Y_FIX_GUIDE[ruleId]
    return MITH_FIX_GUIDE[type] ?? null
}

// ── Resurface time helper ────────────────────────────────────────────────────

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

// ── CopySnippet helper ───────────────────────────────────────────────────────

function CopySnippet({ snippet }: { snippet: string }) {
    const [copied, setCopied] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current)
        }
    }, [])

    const handleCopy = () => {
        void navigator.clipboard.writeText(snippet).then(() => {
            setCopied(true)
            if (timerRef.current !== null) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => setCopied(false), 2000)
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

// ── InlineFixPreview data type ───────────────────────────────────────────────

interface InlineFixPreview {
    current: string
    proposed: string
    tokenName: string
    isColor: boolean
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ViolationCardProps {
    issue: LinterWarning
    type: 'mithril' | 'a11y'
    /** Unique key string used as DOM ids and data-testid suffix */
    cardKey: string
    /** Index within the a11y list — needed for stable id on a11y cards */
    indexInList?: number

    isPinned: boolean
    isFlagged: boolean
    isDeferred: boolean
    deferExpiresAtMs?: number | null
    isDeferSuccess: boolean
    deferSuccessMsg?: string
    /** resurfaceTick: counter incremented every 60s in parent — read by card to recompute resurface label */
    resurfaceTick?: number
    /** COUNSEL.2.3: This violation was previously deferred and has now resurfaced */
    isResurfaced?: boolean
    /** COUNSEL.2.2: This violation was introduced by an AI agent and needs human review */
    isAiSourced?: boolean

    isExpanded: boolean
    isDiffOpen: boolean
    isDiffLoading: boolean
    diffData?: InlineFixPreview | null
    isDeferFormOpen: boolean

    fixItem: FixableItem | null
    provenance?: ProvenanceInfo | null

    deferReason: string
    deferDuration: DeferDuration

    onToggleExpand: () => void
    onFix: () => void
    onPreviewFix: () => void
    onAcceptFix: () => void
    onSkipFix: () => void
    onFlag: () => void
    onUnflag: () => void
    onDefer: (duration: DeferDuration) => void
    onDeferReasonChange: (reason: string) => void
    onDeferDurationChange: (duration: DeferDuration) => void
    onSubmitDefer: () => void
    onCancelDefer: () => void
    onPin: () => void
    onJumpToElement?: () => void

    /**
     * CHRON.1-repair M3: Fires when the user confirms a rule override for this
     * violation via OverrideReasonDialog. The reason string is already trimmed
     * (or undefined when the user waived it on an Amber-tier dialog).
     *
     * When omitted, the Override button is hidden — callers who do not wire
     * override semantics keep the existing hover-reveal cluster untouched.
     */
    onOverride?: (reason?: string) => void

    /** Used to look up a human-readable node name */
    getNodeName: (id: string) => string

    /** activeFilePath — needed for diff preview IPC */
    activeFilePath: string | null

    /** COUNSEL.4.3: Navigation pathway — 1-based index in the recommended fix order.
     *  null means no pathway indicator is shown. */
    navigationIndex?: number | null

    /**
     * CHRON.1 UX A+: Past override reason for this rule+file (if one exists).
     * null/undefined/'skipped'/'auto' hides the override row entirely.
     */
    overrideReason?: string | null
    /** CHRON.1 UX A+: Who recorded the override (best-effort). */
    overrideActor?: string | null
    /** CHRON.1 UX A+: ISO timestamp of the override event (rendered as relative time). */
    overrideTimestamp?: string | null
}

// ── CHRON.1 UX A+: relative-time helper (exported for testing) ───────────────
export function formatRelativeTime(iso: string): string {
    if (!iso) return ''
    const ts = Date.parse(iso)
    if (Number.isNaN(ts)) return ''
    const diffSec = Math.round((Date.now() - ts) / 1000)
    if (diffSec < 60) return 'just now'
    const diffMin = Math.round(diffSec / 60)
    if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`
    const diffHr = Math.round(diffMin / 60)
    if (diffHr < 24) return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`
    const diffDay = Math.round(diffHr / 24)
    if (diffDay < 7) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`
    const diffWk = Math.round(diffDay / 7)
    return diffWk === 1 ? '1 week ago' : `${diffWk} weeks ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ViolationCard({
    issue: w,
    type,
    cardKey,
    indexInList = 0,
    isPinned,
    isFlagged,
    isDeferred,
    deferExpiresAtMs,
    isDeferSuccess,
    deferSuccessMsg,
    resurfaceTick,
    isResurfaced = false,
    isAiSourced = false,
    isExpanded,
    isDiffOpen,
    isDiffLoading,
    diffData,
    isDeferFormOpen,
    fixItem,
    provenance,
    deferReason,
    deferDuration,
    onToggleExpand,
    onFix,
    onPreviewFix,
    onAcceptFix,
    onSkipFix,
    onFlag,
    onUnflag,
    onDefer,
    onDeferReasonChange,
    onDeferDurationChange,
    onSubmitDefer,
    onCancelDefer,
    onPin,
    onJumpToElement,
    onOverride,
    getNodeName,
    activeFilePath,
    navigationIndex,
    overrideReason,
    overrideActor,
    overrideTimestamp,
}: ViolationCardProps) {
    // Consume resurfaceTick to ensure re-render every 60s (label freshness)
    void resurfaceTick

    const isOpen = isExpanded || isPinned
    const canFix = fixItem !== null
    const ruleId = extractRuleIdFromMsg(w.message) ?? (type === 'a11y' ? 'A11Y' : w.type)
    const guide = getFixGuide(w.type, w.message)
    const isAutoFixable = type === 'mithril' ? canFix : !A11Y_NOT_AUTO_FIXABLE.has(ruleId)

    // CHRON.1-repair M3: Override dialog state.
    // The dialog is only wired when a caller provides `onOverride`. Clicking the
    // Override button opens the modal; the dialog's onConfirm fires with the
    // (optionally waived) reason, which we forward to the parent.
    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
    const ruleTitle = getRuleLabel(ruleId)

    // Resurface label (recomputed every render since resurfaceTick changes)
    const deferExpMs = deferExpiresAtMs ?? null
    const resurface = isDeferred ? resurfaceLabel(deferExpMs) : null

    const expandId = type === 'mithril' ? `v-m-${w.id}` : `v-a-${w.id}-${indexInList}`

    // CHRON.1 UX A+: past override reason display. Hide for null/undefined/'skipped'/'auto'.
    const showOverrideReason =
        typeof overrideReason === 'string' &&
        overrideReason.length > 0 &&
        overrideReason !== 'skipped' &&
        overrideReason !== 'auto'
    const relTime = overrideTimestamp ? formatRelativeTime(overrideTimestamp) : ''
    const overrideHeader =
        'Overridden' +
        (overrideActor ? ` by ${overrideActor}` : '') +
        (relTime ? ` ${relTime}` : '')

    return (
        <div className={[
            'border-b border-zinc-800/30 last:border-0 group',
            isDeferred ? 'opacity-50' : isFlagged ? 'opacity-70' : '',
            isFlagged ? 'border-l-2 border-l-amber-500/60' : '',
        ].filter(Boolean).join(' ')}>

            {/* CHRON.1 UX A+: past override reason display */}
            {showOverrideReason && (
                <p
                    data-testid={`override-reason-${w.id}`}
                    aria-label={`Override reason: ${overrideReason}`}
                    className="px-3 pt-1.5 text-[10px] italic text-zinc-500"
                >
                    {overrideHeader}: &ldquo;{overrideReason}&rdquo;
                </p>
            )}

            {/* ── Expand toggle ─────────────────────────────────────────── */}
            <button
                type="button"
                onClick={onToggleExpand}
                className="flex w-full items-start gap-2 px-3 pt-2.5 pb-1.5 text-left hover:bg-zinc-800/30 transition-colors"
                aria-expanded={isOpen}
                aria-controls={expandId}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${ruleId} issue detail`}
            >
                {/* COUNSEL.4.3: Navigation pathway index */}
                {navigationIndex != null ? (
                    <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums ${
                            navigationIndex === 1
                                ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-400/50'
                                : 'bg-zinc-800 text-zinc-500'
                        }`}
                        aria-label={navigationIndex === 1 ? 'Start here — highest impact fix' : `Fix step ${navigationIndex}`}
                        data-testid={`nav-index-${navigationIndex}`}
                    >
                        {navigationIndex}
                    </span>
                ) : (
                    <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            type === 'a11y' ? 'bg-red-400' : SEVERITY_DOT[w.severity]
                        }`}
                        aria-hidden="true"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[10px] text-zinc-300 font-medium" title={ruleId}>{getRuleLabel(ruleId)}</p>

                        {/* COUNSEL.2.3: Resurfaced badge */}
                        {isResurfaced && (
                            <span
                                data-testid={`resurfaced-badge-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                                className="rounded-full border border-amber-500/40 bg-amber-900/20 px-1.5 py-px text-[10px] font-medium text-amber-400 leading-none"
                            >
                                Resurfaced
                            </span>
                        )}

                        {/* Flagged badge (manual) */}
                        {isFlagged && !isResurfaced && (
                            <span
                                data-testid={`flagged-badge-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                                className="rounded-full border border-amber-500/40 bg-amber-900/20 px-1.5 py-px text-[10px] font-medium text-amber-400 leading-none"
                            >
                                Flagged for Review
                            </span>
                        )}

                        {/* COUNSEL.2.2: AI-sourced "Review" badge (indigo) */}
                        {isAiSourced && !isFlagged && !isResurfaced && (
                            <span
                                data-testid={`review-badge-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                                className="rounded-full border border-indigo-500/40 bg-indigo-900/20 px-1.5 py-px text-[10px] font-medium text-indigo-400 leading-none"
                            >
                                Review
                            </span>
                        )}

                        {/* Fixability badge (primary signal, always visible) */}
                        {!isFlagged && !isAiSourced && !isResurfaced && isAutoFixable && (
                            <span
                                data-testid={`badge-auto-fixable-${w.id}`}
                                className="rounded-full border border-emerald-500/30 bg-emerald-900/20 px-1.5 py-px text-[10px] font-medium text-emerald-400 leading-none"
                            >
                                Auto-fixable
                            </span>
                        )}
                        {!isFlagged && !isAiSourced && !isResurfaced && !isAutoFixable && (
                            <span
                                data-testid={`badge-needs-input-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                                className="rounded-full border border-amber-500/30 bg-amber-900/20 px-1.5 py-px text-[10px] font-medium text-amber-400 leading-none"
                            >
                                Needs input
                            </span>
                        )}

                        {/* COUNSEL.3.4: Risk trend badges (Mithril only) */}
                        {type === 'mithril' && w.riskTrend === 'rising' && (
                            <span
                                data-testid={`risk-trend-rising-${w.id}`}
                                className="inline-flex items-center gap-0.5 rounded-full border border-red-500/40 bg-red-900/20 px-1.5 py-px text-[10px] font-medium text-red-400 leading-none"
                            >
                                <TrendingUp size={8} aria-hidden="true" />
                                Rising
                            </span>
                        )}
                        {type === 'mithril' && w.riskTrend === 'falling' && (
                            <span
                                data-testid={`risk-trend-falling-${w.id}`}
                                className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/40 bg-emerald-900/20 px-1.5 py-px text-[10px] font-medium text-emerald-400 leading-none"
                            >
                                <TrendingDown size={8} aria-hidden="true" />
                                Improving
                            </span>
                        )}
                    </div>

                    <p className="text-[10px] text-zinc-500 line-clamp-1" title={w.message}>
                        {w.message.replace(/^[A-Z0-9-]+:\s*/, '')}
                    </p>

                    {/* COUNSEL.3.2: Provenance chip — subtle "via [source]" chip */}
                    {provenance && (
                        <span
                            data-testid={`provenance-chip-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                            className="mt-0.5 inline-block text-[10px] text-zinc-500 bg-zinc-800/50 rounded px-1.5 py-0.5"
                            aria-label={`Source: ${provenance.source === 'human' ? 'manual edit' : provenance.source === 'auto-fix' || provenance.source === 'auto_fix' ? 'auto-fix' : provenance.source === 'auto-heal' ? 'auto-fix' : provenance.source === 'import' ? 'import' : provenance.agentId ?? 'AI orchestrator'}`}
                        >
                            via {provenance.source === 'human'
                                ? 'manual edit'
                                : provenance.source === 'auto-fix' || provenance.source === 'auto_fix' || provenance.source === 'auto-heal'
                                    ? 'auto-fix'
                                    : provenance.source === 'import'
                                        ? 'import'
                                        : provenance.agentId ?? 'AI orchestrator'}
                        </span>
                    )}

                    {/* COUNSEL.3.4: MRS risk score badge */}
                    {w.mrsScore != null && (
                        <span
                            data-testid={`mrs-badge-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                            className={`mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                                w.mrsScore <= 30
                                    ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/30'
                                    : w.mrsScore <= 60
                                        ? 'bg-amber-900/20 text-amber-400 border border-amber-500/30'
                                        : 'bg-red-900/20 text-red-400 border border-red-500/30'
                            }`}
                            aria-label={`Mutation risk score ${w.mrsScore} out of 100, ${w.mrsScore <= 30 ? 'low' : w.mrsScore <= 60 ? 'medium' : 'high'} risk`}
                        >
                            MRS {w.mrsScore}
                        </span>
                    )}
                </div>
                {isOpen
                    ? <ChevronDown size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />
                    : <ChevronRight size={10} className="shrink-0 mt-1 text-zinc-600" aria-hidden="true" />}
            </button>

            {/* ── Action footer ─────────────────────────────────────────── */}
            {type === 'mithril' ? (
                <div className={`flex items-center gap-2 px-3 pb-3 pt-0 ${canFix ? 'justify-between' : 'justify-end'}`}>
                    {/* Primary: Preview fix + Fix */}
                    <div className="flex items-center gap-2">
                        {canFix && (
                            <button
                                type="button"
                                onClick={onPreviewFix}
                                data-testid={`preview-fix-btn-${w.id}`}
                                className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    isDiffOpen
                                        ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300'
                                        : 'border-indigo-500/30 bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40'
                                }`}
                                aria-label={isDiffOpen ? 'Close diff preview' : `Preview fix for ${ruleId}`}
                                aria-expanded={isDiffOpen}
                            >
                                {isDiffLoading ? <Loader2 size={10} className="animate-spin inline mr-1" aria-hidden="true" /> : null}
                                {isDiffOpen ? 'Close preview' : 'Preview fix'}
                            </button>
                        )}
                        {canFix && (
                            <button
                                type="button"
                                onClick={onFix}
                                className="rounded border border-indigo-500/40 bg-indigo-900/25 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:bg-indigo-900/50 transition-colors"
                                aria-label={`Fix drift on element ${w.id}`}
                            >
                                Fix
                            </button>
                        )}
                    </div>

                    {/* Secondary triage — hidden at rest, visible on hover (group pattern) */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isDeferred && (
                            <span className="flex items-center gap-1.5">
                                <span
                                    data-testid={`deferred-badge-${w.id}`}
                                    className="text-xs text-amber-400 bg-amber-400/10 rounded px-2 py-1"
                                >
                                    Snoozed
                                </span>
                                {resurface && (
                                    <span
                                        data-testid={`resurface-label-${w.id}`}
                                        className={`text-xs rounded px-2 py-1 ${
                                            resurface.overdue
                                                ? 'text-amber-300 bg-amber-500/20'
                                                : 'text-zinc-500 bg-zinc-800/50'
                                        }`}
                                    >
                                        {resurface.text}
                                    </span>
                                )}
                            </span>
                        )}
                        {!isDeferred && !isFlagged && (
                            <button
                                type="button"
                                onClick={onFlag}
                                data-testid={`flag-btn-${w.id}`}
                                className="rounded border border-zinc-700/60 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                                aria-label={`Flag ${ruleId} for review`}
                                title="Set aside for later review"
                            >
                                Flag
                            </button>
                        )}
                        {isFlagged && (
                            <button
                                type="button"
                                onClick={onUnflag}
                                data-testid={`unflag-btn-${w.id}`}
                                className="rounded border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-500/60 hover:text-amber-300 transition-colors"
                                aria-label={`Remove flag from ${ruleId}`}
                            >
                                Unflag
                            </button>
                        )}
                        {!isDeferred && !isFlagged && (
                            <button
                                type="button"
                                onClick={onCancelDefer}
                                data-testid={`defer-btn-${w.id}`}
                                className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                                    isDeferFormOpen
                                        ? 'border-zinc-600 text-zinc-300'
                                        : 'border-zinc-700/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                                }`}
                                aria-label={isDeferFormOpen ? 'Cancel defer' : `Defer ${ruleId} issue`}
                                aria-expanded={isDeferFormOpen}
                                title="Snooze this issue"
                            >
                                Defer
                            </button>
                        )}
                        {/* CHRON.1-repair M3: Override — opens OverrideReasonDialog */}
                        {onOverride && !isDeferred && !isFlagged && (
                            <button
                                type="button"
                                onClick={() => setOverrideDialogOpen(true)}
                                data-testid={`override-btn-${w.id}`}
                                className="rounded border border-zinc-700/60 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                                aria-label={`Override ${ruleId} rule for this file`}
                                aria-haspopup="dialog"
                                title="Waive this rule for this file"
                            >
                                Override
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onPin}
                            className={`rounded p-2 transition-colors ${isPinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                            aria-label={isPinned ? 'Unpin issue detail' : 'Pin issue detail open'}
                            title={isPinned ? 'Unpin' : 'Pin open while working'}
                        >
                            <Pin size={12} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            ) : (
                /* A11y card footer — secondary triage only (chevron on header communicates expand) */
                <div className="flex items-center justify-end gap-2 px-3 pb-3 pt-0">
                    {/* Secondary triage — hover reveal */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isDeferred && (
                            <span
                                data-testid={`deferred-badge-a11y-${w.id}`}
                                className="text-xs text-amber-400 bg-amber-400/10 rounded px-2 py-1"
                            >
                                Snoozed
                            </span>
                        )}
                        {!isDeferred && !isFlagged && (
                            <button
                                type="button"
                                onClick={onFlag}
                                data-testid={`flag-btn-a11y-${w.id}`}
                                className="rounded border border-zinc-700/60 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                                aria-label={`Flag ${ruleId} for review`}
                                title="Set aside for later review"
                            >
                                Flag
                            </button>
                        )}
                        {isFlagged && (
                            <button
                                type="button"
                                onClick={onUnflag}
                                data-testid={`unflag-btn-a11y-${w.id}`}
                                className="rounded border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-500/60 hover:text-amber-300 transition-colors"
                                aria-label={`Remove flag from ${ruleId}`}
                            >
                                Unflag
                            </button>
                        )}
                        {!isDeferred && !isFlagged && (
                            <button
                                type="button"
                                onClick={onCancelDefer}
                                className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                                    isDeferFormOpen
                                        ? 'border-zinc-600 text-zinc-300'
                                        : 'border-zinc-700/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                                }`}
                                aria-label={isDeferFormOpen ? 'Cancel defer' : `Defer ${ruleId} issue`}
                                aria-expanded={isDeferFormOpen}
                            >
                                Defer
                            </button>
                        )}
                        {/* CHRON.1-repair M3: Override — opens OverrideReasonDialog */}
                        {onOverride && !isDeferred && !isFlagged && (
                            <button
                                type="button"
                                onClick={() => setOverrideDialogOpen(true)}
                                data-testid={`override-btn-a11y-${w.id}`}
                                className="rounded border border-zinc-700/60 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                                aria-label={`Override ${ruleId} rule for this file`}
                                aria-haspopup="dialog"
                                title="Waive this rule for this file"
                            >
                                Override
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onPin}
                            className={`rounded p-2 transition-colors ${isPinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                            aria-label={isPinned ? 'Unpin issue detail' : 'Pin issue detail open'}
                        >
                            <Pin size={12} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Inline diff preview (Mithril only) ────────────────────── */}
            {type === 'mithril' && isDiffOpen && (
                <div
                    data-testid={`inline-diff-${w.id}`}
                    className="mx-3 mb-2 rounded border border-zinc-700 bg-zinc-950 overflow-hidden"
                >
                    {isDiffLoading || !diffData ? (
                        <div className="flex items-center justify-center gap-2 py-3">
                            <Loader2 size={12} className="animate-spin text-zinc-500" aria-hidden="true" />
                            <span className="text-[10px] text-zinc-400">Loading diff...</span>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 divide-x divide-zinc-800">
                                <div className="px-3 py-2">
                                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Current</p>
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
                                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Proposed</p>
                                    {diffData.isColor && (
                                        <span
                                            className="mb-1 block h-4 w-4 rounded border border-zinc-700"
                                            style={{ backgroundColor: diffData.proposed }}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <code className="text-[10px] text-emerald-400 font-mono">{diffData.proposed}</code>
                                    <p className="mt-0.5 text-[10px] text-zinc-400">{diffData.tokenName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-1.5">
                                <button
                                    type="button"
                                    onClick={onAcceptFix}
                                    data-testid={`accept-fix-btn-${w.id}`}
                                    className="rounded border border-emerald-500/30 bg-emerald-900/20 px-2.5 py-1 text-[10px] text-emerald-400 hover:bg-emerald-900/40 transition-colors"
                                    aria-label="Accept this fix"
                                >
                                    Accept
                                </button>
                                <button
                                    type="button"
                                    onClick={onSkipFix}
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

            {/* ── Defer form ────────────────────────────────────────────── */}
            {isDeferFormOpen && (
                <div
                    data-testid={`defer-form-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                    className="mx-3 mb-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2.5 space-y-2"
                >
                    <p className="text-[10px] font-medium text-zinc-400">Defer this issue</p>
                    <textarea
                        rows={2}
                        placeholder="Reason (optional)"
                        value={deferReason}
                        onChange={(e) => onDeferReasonChange(e.target.value)}
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
                                    checked={deferDuration === d}
                                    onChange={() => onDeferDurationChange(d)}
                                    className="sr-only"
                                />
                                <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
                                        deferDuration === d
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
                            onClick={onSubmitDefer}
                            data-testid={`defer-submit-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700 transition-colors"
                            aria-label="Submit defer"
                        >
                            Defer issue
                        </button>
                        <button
                            type="button"
                            onClick={onCancelDefer}
                            data-testid={`defer-cancel-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                            aria-label="Cancel defer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Defer success confirmation ─────────────────────────────── */}
            {isDeferSuccess && (
                <div
                    data-testid={`defer-success-${type === 'a11y' ? 'a11y-' : ''}${w.id}`}
                    className="mx-3 mb-2 flex items-center gap-2 rounded border border-indigo-500/30 bg-indigo-900/20 px-3 py-1.5"
                    role="status"
                >
                    <Check size={10} className="shrink-0 text-indigo-400" aria-hidden="true" />
                    <span className="text-[10px] text-indigo-300">{deferSuccessMsg}</span>
                </div>
            )}

            {/* ── Expanded fix guide ─────────────────────────────────────── */}
            {isOpen && (
                <div id={expandId} className="px-3 pb-3 space-y-2.5 bg-zinc-950/60">
                    {/* Full message — shown here, hidden in collapsed header */}
                    <p className="text-[10px] text-zinc-400 leading-relaxed pt-1">
                        {w.message.replace(/^[A-Z0-9-]+:\s*/, '')}
                    </p>
                    {guide ? (
                        <>
                            <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                    <span className="text-zinc-400 font-medium">Why: </span>{guide.why}
                                </p>
                                {guide.wcag && (
                                    <p className={`mt-1 text-[10px] ${type === 'a11y' ? 'text-red-400/80' : 'text-indigo-400'}`}>
                                        {guide.wcag}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="mb-1 text-[10px] font-medium text-zinc-400">How to fix:</p>
                                <ol className="space-y-1 list-none">
                                    {guide.steps.map((step, si) => (
                                        <li key={si} className="flex items-start gap-2 text-[10px] text-zinc-400">
                                            <span className="mt-px shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-700 text-[10px] text-zinc-600 font-mono">{si + 1}</span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                            {guide.snippet && <CopySnippet snippet={guide.snippet} />}
                        </>
                    ) : (
                        <p className="text-[10px] text-zinc-600">
                            {type === 'a11y'
                                ? 'Click the element on the canvas to inspect it in Properties.'
                                : 'No fix guide available for this rule.'}
                        </p>
                    )}
                    <p className="font-mono text-[10px] text-zinc-700">Element: {getNodeName(w.id)}</p>
                    {onJumpToElement && (
                        <button
                            type="button"
                            aria-label={`Jump to element ${getNodeName(w.id)}`}
                            onClick={onJumpToElement}
                            className="mt-1 flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            <span>Jump to element</span>
                            <span aria-hidden="true">→</span>
                        </button>
                    )}
                </div>
            )}

            {/* ── CHRON.1-repair M3: OverrideReasonDialog ───────────────── */}
            {onOverride && (
                <OverrideReasonDialog
                    open={overrideDialogOpen}
                    onClose={() => setOverrideDialogOpen(false)}
                    onConfirm={(reason) => {
                        setOverrideDialogOpen(false)
                        onOverride(reason)
                    }}
                    ruleId={ruleId}
                    ruleTitle={ruleTitle}
                    severity={w.severity}
                    filePath={activeFilePath ?? undefined}
                />
            )}
        </div>
    )
}
