/**
 * GovernancePanel — src/components/ui/GovernancePanel.tsx
 *
 * Full-screen governance rules manager. Allows enabling/disabling individual
 * rules and overriding their severity, grouped by category.
 *
 * Architecture:
 *   GovernancePanel         — full-screen modal shell + tab bar + tab content
 *   CategorySidebar         — left sidebar with category filter buttons (Rules tab)
 *   RuleRow                 — single rule with toggle, ID, name, severity badge
 *   SeverityBadge           — color-coded severity display
 *   RuleCatalogPanel        — Rule Packs tab (browsable pack catalog)
 *   ComplianceProfileSelector — Profiles tab (jurisdiction checklist)
 *
 * State:
 *   - Reads rule definitions from GOVERNANCE_RULES_MANIFEST (static)
 *   - Reads/writes overrides via useGovernanceStore
 *   - Pending changes tracked locally; committed on Save, discarded on Reset/Close
 *   - ERM: activePresets and togglePack via useGovernanceConfig hook
 *
 * Mithril Safety: all classes from Flint design token palette only.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { X, Save, RotateCcw, ShieldCheck } from 'lucide-react'
import { FocusTrap } from './FocusTrap'
import {
    GOVERNANCE_RULES_MANIFEST,
    GOVERNANCE_CATEGORIES,
    type GovernanceRule,
    type RuleSeverity,
    type GovernanceCategory,
} from '../../core/governanceRulesManifest'

// Planned rules are displayed in a visually distinct state so users understand
// they are roadmap items and will never fire in the current release.
const PLANNED_BADGE = (
    <span
        className="rounded border border-zinc-700/40 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600"
        title="This rule is in development and will be enforced in a future update."
    >
        In development
    </span>
)
import { useGovernanceStore, type RuleOverride } from '../../store/governanceStore'
import { useCanvasStore } from '../../store/canvasStore'
import { RuleCatalogPanel } from './RuleCatalogPanel'
import { ComplianceProfileSelector } from './ComplianceProfileSelector'
import { useGovernanceConfig } from '../../hooks/useGovernanceConfig'
import { SwitchToggle } from './SwitchToggle'

// ── Props ─────────────────────────────────────────────────────────────────────

interface GovernancePanelProps {
    onClose: () => void
    /**
     * OPP-15: When provided, the panel opens to the Rules tab, navigates to the
     * category containing this rule ID, and scrolls to + highlights that row.
     */
    focusRuleId?: string
}

// ── Panel tab type ────────────────────────────────────────────────────────────

type PanelTab = 'rules' | 'packs' | 'profiles'

// ── SeverityBadge ─────────────────────────────────────────────────────────────

interface SeverityBadgeProps {
    severity: RuleSeverity
}

function SeverityBadge({ severity }: SeverityBadgeProps) {
    if (severity === 'critical') {
        return (
            <span className="rounded border border-red-700/40 bg-red-900/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                Critical
            </span>
        )
    }
    if (severity === 'warning') {
        return (
            <span className="rounded border border-amber-500/30 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Warning
            </span>
        )
    }
    return (
        <span className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Info
        </span>
    )
}

// ── RuleRow ───────────────────────────────────────────────────────────────────

interface RuleRowProps {
    rule: GovernanceRule
    override: RuleOverride | undefined
    onToggle: (ruleId: string, enabled: boolean) => void
    onReset: (ruleId: string) => void
    /** OPP-15: When true, applies a highlight ring to draw the eye to this row. */
    isFocused?: boolean
    /** OPP-15: Ref forwarded to the row element for programmatic scroll. */
    rowRef?: React.RefObject<HTMLDivElement | null>
}

// ── EDU-04: Taxonomy lookup (renderer-side copy; no cross-package import) ────

/**
 * One-line descriptions for each rule, sourced from errorTaxonomy titles.
 * Keyed by rule ID (exact or prefix match).
 */
const RULE_DESCRIPTIONS: Record<string, string> = {
    'A11Y-001': 'Images need alt text so screen readers can describe them.',
    'A11Y-002': 'Buttons need a visible or accessible label so users know what they do.',
    'A11Y-003': 'Links need descriptive text — "click here" is not meaningful.',
    'A11Y-004': 'Form inputs need labels so screen readers can announce them.',
    'A11Y-005': 'Select dropdowns need labels so screen readers can announce them.',
    'A11Y-006': 'Textareas need labels so screen readers can announce them.',
    'A11Y-007': 'Positive tabIndex values disrupt natural keyboard navigation order.',
    'A11Y-008': 'Tables need a summary or caption to explain their structure.',
    'A11Y-009': 'The HTML lang attribute tells screen readers which language to use.',
    'A11Y-010': 'Heading levels should not skip (e.g. h1 → h3) — this breaks document structure.',
    'MITHRIL-COL':     'Colors not in your token set drift from your design system.',
    'MITHRIL-TYP-001': 'Font families not in your token set drift from your brand.',
    'MITHRIL-TYP-002': 'Font sizes not in your token set break the type scale.',
    'MITHRIL-TYP-003': 'Font weights not in your token set disrupt visual hierarchy.',
    'MITHRIL-TYP-004': 'Line heights not in your token set break vertical rhythm.',
    'MITHRIL-TYP-005': 'Letter spacing not in your token set creates micro-inconsistencies.',
    'MITHRIL-SPC-001': 'Spacing not in your token set breaks the layout grid.',
    'MITHRIL-SHD-001': 'Shadows not in your token set break the depth system.',
    'MITHRIL-OPC-001': 'Opacity values not in your token set create inconsistent transparency.',
}

function getRuleDescription(ruleId: string): string | null {
    if (RULE_DESCRIPTIONS[ruleId]) return RULE_DESCRIPTIONS[ruleId]
    // Prefix match (e.g. MITHRIL-TYP-001 could also match MITHRIL-TYP if no exact entry)
    for (const key of Object.keys(RULE_DESCRIPTIONS)) {
        if (ruleId.startsWith(key) && key !== ruleId) return RULE_DESCRIPTIONS[key]
    }
    return null
}

// ── RuleRow ───────────────────────────────────────────────────────────────────

function RuleRow({ rule, override, onToggle, onReset, isFocused, rowRef }: RuleRowProps) {
    const isPlanned = rule.status === 'planned'
    const isEnabled = override?.enabled !== false
    const effectiveSeverity: RuleSeverity = override?.severity ?? rule.defaultSeverity
    const isModified = override !== undefined
    // EDU-04: one-line description from taxonomy
    const description = getRuleDescription(rule.id)

    return (
        <div
            ref={rowRef}
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors ${
                isModified ? 'border-l-2 border-indigo-500/40' : 'border-l-2 border-transparent'
            } ${isPlanned ? 'opacity-50' : ''} ${
                isFocused ? 'ring-1 ring-inset ring-indigo-500/40 bg-indigo-900/10' : ''
            }`}
        >
            <SwitchToggle
                checked={isEnabled}
                onChange={(val: boolean) => onToggle(rule.id, val)}
                aria-label={`Toggle ${rule.name}`}
                size="sm"
            />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-400">{rule.id}</span>
                    {isModified && (
                        <button
                            type="button"
                            onClick={() => onReset(rule.id)}
                            className="rounded bg-indigo-900/20 px-1 py-0.5 text-[10px] text-indigo-400 transition-colors hover:bg-indigo-900/40 hover:text-indigo-300"
                            title={`Reset ${rule.id} to default`}
                        >
                            modified
                        </button>
                    )}
                </div>
                <p
                    className={`mt-0.5 text-xs leading-snug transition-colors ${
                        isEnabled ? 'text-zinc-300' : 'text-zinc-600 line-through'
                    }`}
                >
                    {rule.name}
                </p>
                {/* EDU-04: one-line description surfaces taxonomy content inline */}
                {description && (
                    <p className="mt-0.5 text-[10px] text-zinc-600 leading-snug">
                        {description}
                    </p>
                )}
            </div>

            {isPlanned ? PLANNED_BADGE : <SeverityBadge severity={effectiveSeverity} />}
        </div>
    )
}

// ── CategorySidebar ───────────────────────────────────────────────────────────

interface CategorySidebarProps {
    activeCategory: GovernanceCategory | 'All'
    counts: Record<string, number>
    onChange: (cat: GovernanceCategory | 'All') => void
}

function CategorySidebar({ activeCategory, counts, onChange }: CategorySidebarProps) {
    const allCategories: Array<GovernanceCategory | 'All'> = ['All', ...GOVERNANCE_CATEGORIES]

    return (
        <aside className="flex w-40 shrink-0 flex-col border-r border-zinc-800 overflow-y-auto">
            <div className="shrink-0 border-b border-zinc-800 px-3 py-2">
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Categories
                </h3>
            </div>
            <nav className="flex-1 py-1">
                {allCategories.map((cat) => {
                    const isActive = activeCategory === cat
                    const count = cat === 'All'
                        ? GOVERNANCE_RULES_MANIFEST.length
                        : counts[cat] ?? 0

                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => onChange(cat)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800/40 ${
                                isActive
                                    ? 'bg-indigo-600/20 text-indigo-300'
                                    : 'text-zinc-400'
                            }`}
                        >
                            <span className="truncate">{cat}</span>
                            <span
                                className={`ml-1 shrink-0 rounded px-1 py-0.5 text-[10px] ${
                                    isActive ? 'bg-indigo-900/40 text-indigo-400' : 'bg-zinc-800 text-zinc-600'
                                }`}
                            >
                                {count}
                            </span>
                        </button>
                    )
                })}
            </nav>
        </aside>
    )
}

// ── GovernancePanel ───────────────────────────────────────────────────────────

export function GovernancePanel({ onClose, focusRuleId }: GovernancePanelProps) {
    const overrides = useGovernanceStore((s) => s.overrides)
    const setOverride = useGovernanceStore((s) => s.setOverride)
    const resetOverride = useGovernanceStore((s) => s.resetOverride)
    const resetAll = useGovernanceStore((s) => s.resetAll)
    const saveToFile = useGovernanceStore((s) => s.saveToFile)
    const loadFromFile = useGovernanceStore((s) => s.loadFromFile)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    const [activeCategory, setActiveCategory] = useState<GovernanceCategory | 'All'>('All')
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<PanelTab>('rules')
    const [isToggling, setIsToggling] = useState(false)
    const [showPlanned, setShowPlanned] = useState(false)

    // OPP-15: ref for the focused rule row, used to scroll it into view
    const focusedRowRef = useRef<HTMLDivElement | null>(null)

    // ERM: resolved config (activePresets) via the governance hook
    const { activePresets, togglePack } = useGovernanceConfig()

    // Load persisted overrides on mount
    useEffect(() => {
        void loadFromFile()
    }, [loadFromFile])

    // OPP-15: When focusRuleId is provided, switch to Rules tab and navigate to
    // the category that contains this rule so it becomes visible.
    useEffect(() => {
        if (!focusRuleId) return

        setActiveTab('rules')

        const targetRule = GOVERNANCE_RULES_MANIFEST.find((r) => r.id === focusRuleId)
        if (targetRule) {
            setActiveCategory(targetRule.category as GovernanceCategory)
        }
        // Scroll into view after the DOM updates — one microtask delay is enough
        // because setActiveCategory triggers a synchronous React re-render before
        // the browser paints.
        const id = setTimeout(() => {
            focusedRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }, 50)
        return () => clearTimeout(id)
    }, [focusRuleId])

    // Escape key to close
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [onClose])

    // Filter rules by selected category, then split active vs planned
    const allCategoryRules =
        activeCategory === 'All'
            ? GOVERNANCE_RULES_MANIFEST
            : GOVERNANCE_RULES_MANIFEST.filter((r) => r.category === activeCategory)
    const visibleRules = allCategoryRules.filter((r) => r.status !== 'planned')
    const plannedRules = allCategoryRules.filter((r) => r.status === 'planned')

    // Count of modified rules per category (for sidebar badge context)
    const categoryCounts: Record<string, number> = {}
    for (const cat of GOVERNANCE_CATEGORIES) {
        categoryCounts[cat] = GOVERNANCE_RULES_MANIFEST.filter((r) => r.category === cat).length
    }

    const handleToggle = useCallback(
        (ruleId: string, enabled: boolean) => {
            const rule = GOVERNANCE_RULES_MANIFEST.find((r) => r.id === ruleId)
            const currentOverride = overrides[ruleId]
            const isReturningToDefault = enabled && (!currentOverride?.severity || currentOverride.severity === rule?.defaultSeverity)

            if (isReturningToDefault) {
                resetOverride(ruleId)
            } else {
                setOverride(ruleId, { enabled })
            }

            window.flintAPI.governance.recordOverride({
                ruleId,
                action: isReturningToDefault ? 'reset' : enabled ? 'enable' : 'disable',
                newValue: isReturningToDefault ? null : { enabled },
                filePath: activeFilePath ?? '',
            })
        },
        [setOverride, resetOverride, overrides, activeFilePath]
    )

    const handleResetRule = useCallback(
        (ruleId: string) => {
            resetOverride(ruleId)
            // GOV.2: fire-and-forget telemetry — do not await
            window.flintAPI.governance.recordOverride({
                ruleId,
                action: 'reset',
                newValue: null,
                filePath: activeFilePath ?? '',
            })
        },
        [resetOverride, activeFilePath]
    )

    const handleSave = async () => {
        setSaving(true)
        try {
            await saveToFile()
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        resetAll()
        // GOV.2: fire-and-forget telemetry for reset_all — do not await
        window.flintAPI.governance.recordOverride({
            ruleId: '*',
            action: 'reset_all',
            newValue: null,
            filePath: activeFilePath ?? '',
        })
    }

    // ERM: enable / disable a rule pack via IPC
    const handleEnablePack = useCallback(
        async (packId: string) => {
            setIsToggling(true)
            try {
                await togglePack(packId, true)
            } finally {
                setIsToggling(false)
            }
        },
        [togglePack],
    )

    const handleDisablePack = useCallback(
        async (packId: string) => {
            setIsToggling(true)
            try {
                await togglePack(packId, false)
            } finally {
                setIsToggling(false)
            }
        },
        [togglePack],
    )

    const modifiedCount = Object.keys(overrides).length

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            role="button"
            tabIndex={0}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) onClose()
            }}
            aria-label="Close"
        >
            <FocusTrap>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="governance-panel-title"
                className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-5 py-4">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-400" />
                    <div className="flex-1 min-w-0">
                        <h2
                            id="governance-panel-title"
                            className="text-sm font-semibold text-zinc-100"
                        >
                            Governance Rules
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-400">
                            {GOVERNANCE_RULES_MANIFEST.length} rules
                            {modifiedCount > 0 && (
                                <span className="ml-1.5 text-indigo-400">
                                    · {modifiedCount} modified
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close governance panel"
                        className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Tab bar ── */}
                {/* Issue 4: proper ARIA tab markup — role=tablist wraps the tabs,
                    each tab has role=tab, aria-selected, and aria-controls pointing
                    to the corresponding tabpanel. */}
                <div
                    className="shrink-0 flex items-center gap-0 border-b border-zinc-800 px-5"
                    role="tablist"
                    aria-label="Governance panel sections"
                >
                    {(
                        [
                            {
                                id: 'rules' as PanelTab,
                                label: 'Rules',
                                // EDU-07: subtitle explaining each tab's purpose
                                subtitle: 'Individual checks that run on your code',
                            },
                            {
                                id: 'packs' as PanelTab,
                                label: 'Rule Packs',
                                subtitle: 'Pre-built rule sets for common standards',
                            },
                            {
                                id: 'profiles' as PanelTab,
                                label: 'Profiles',
                                subtitle: 'Saved configurations for different projects',
                            },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`governance-tabpanel-${tab.id}`}
                            id={`governance-tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            // EDU-07: subtitle shown as tooltip on each tab
                            title={tab.subtitle}
                            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-300'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* EDU-07: Active tab subtitle — shown below the tab bar */}
                {activeTab === 'rules' && (
                    <p className="shrink-0 px-5 py-1.5 text-[10px] text-zinc-600 border-b border-zinc-800/50">
                        Individual checks that run on your code
                    </p>
                )}
                {activeTab === 'packs' && (
                    <p className="shrink-0 px-5 py-1.5 text-[10px] text-zinc-600 border-b border-zinc-800/50">
                        Pre-built rule sets for common standards — enabling a pack activates all its rules
                    </p>
                )}
                {activeTab === 'profiles' && (
                    <p className="shrink-0 px-5 py-1.5 text-[10px] text-zinc-600 border-b border-zinc-800/50">
                        Saved configurations for different projects — enabling a profile activates its packs and rules
                    </p>
                )}

                {/* ── Body ── */}
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {activeTab === 'rules' && (
                        <>
                            {/* Category sidebar */}
                            <CategorySidebar
                                activeCategory={activeCategory}
                                counts={categoryCounts}
                                onChange={setActiveCategory}
                            />

                            {/* Rule list — Issue 4: tabpanel role with matching aria-labelledby */}
                            <div
                                className="flex-1 overflow-y-auto"
                                role="tabpanel"
                                id="governance-tabpanel-rules"
                                aria-labelledby="governance-tab-rules"
                            >
                                {/* Section header */}
                                <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/90 px-4 py-2 backdrop-blur-sm">
                                    <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                                        {activeCategory} ({visibleRules.length})
                                    </h3>
                                </div>

                                {/* Rule rows — active rules only */}
                                <div className="divide-y divide-zinc-800/40">
                                    {visibleRules.map((rule) => {
                                        const isFocused = rule.id === focusRuleId
                                        return (
                                            <RuleRow
                                                key={rule.id}
                                                rule={rule}
                                                override={overrides[rule.id]}
                                                onToggle={handleToggle}
                                                onReset={handleResetRule}
                                                isFocused={isFocused}
                                                rowRef={isFocused ? focusedRowRef : undefined}
                                            />
                                        )
                                    })}
                                </div>

                                {/* Planned rules — collapsed by default */}
                                {plannedRules.length > 0 && (
                                    <div className="border-t border-zinc-800/40">
                                        <button
                                            type="button"
                                            onClick={() => setShowPlanned((v) => !v)}
                                            className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors"
                                        >
                                            <span className={`transition-transform duration-150 ${showPlanned ? 'rotate-90' : ''}`}>▸</span>
                                            Also coming ({plannedRules.length})
                                        </button>
                                        {showPlanned && (
                                            <div className="divide-y divide-zinc-800/40">
                                                {plannedRules.map((rule) => (
                                                    <RuleRow
                                                        key={rule.id}
                                                        rule={rule}
                                                        override={overrides[rule.id]}
                                                        onToggle={handleToggle}
                                                        onReset={handleResetRule}
                                                        isFocused={rule.id === focusRuleId}
                                                        rowRef={rule.id === focusRuleId ? focusedRowRef : undefined}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'packs' && (
                        // Issue 4: tabpanel role for packs tab
                        <div
                            className="flex-1 overflow-y-auto"
                            role="tabpanel"
                            id="governance-tabpanel-packs"
                            aria-labelledby="governance-tab-packs"
                        >
                            <RuleCatalogPanel
                                activePresets={activePresets}
                                onEnablePack={(packId) => void handleEnablePack(packId)}
                                onDisablePack={(packId) => void handleDisablePack(packId)}
                                isToggling={isToggling}
                            />
                        </div>
                    )}

                    {activeTab === 'profiles' && (
                        // Issue 4: tabpanel role for profiles tab
                        <div
                            className="flex-1 overflow-y-auto"
                            role="tabpanel"
                            id="governance-tabpanel-profiles"
                            aria-labelledby="governance-tab-profiles"
                        >
                            <ComplianceProfileSelector
                                activePresets={activePresets}
                                onToggleJurisdiction={(packId, enabled) =>
                                    void (enabled ? handleEnablePack(packId) : handleDisablePack(packId))
                                }
                                isToggling={isToggling}
                            />
                        </div>
                    )}
                </div>

                {/* ── S5.7: Persistence context banner ── */}
                {activeTab === 'rules' && modifiedCount > 0 && (
                    <div
                        className="shrink-0 flex items-center gap-2 border-t border-amber-900/30 bg-amber-950/20 px-5 py-2"
                        role="status"
                        aria-live="polite"
                    >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        <p className="text-[10px] text-amber-400/80">
                            Toggles apply immediately to live audits · <strong className="font-semibold">Save</strong> to persist across sessions
                        </p>
                    </div>
                )}
                {(activeTab === 'packs' || activeTab === 'profiles') && (
                    <div className="shrink-0 flex items-center gap-2 border-t border-zinc-800/60 bg-zinc-900 px-5 py-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                        <p className="text-[10px] text-zinc-600">
                            Changes take effect immediately — no Save required
                        </p>
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3">
                    {/* Reset button — only shown on Rules tab */}
                    {activeTab === 'rules' ? (
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={modifiedCount === 0}
                            className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset All
                        </button>
                    ) : (
                        <span />
                    )}

                    <div className="flex items-center gap-2">
                        {/* Close / Cancel */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                        >
                            Close
                        </button>

                        {/* Save — only on Rules tab; badge shows pending count */}
                        {activeTab === 'rules' && (
                            <button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors active:scale-95 disabled:opacity-60 ${
                                    modifiedCount > 0
                                        ? 'bg-indigo-600 ring-1 ring-indigo-400/40 hover:bg-indigo-500'
                                        : 'bg-indigo-600 hover:bg-indigo-500'
                                }`}
                            >
                                <Save className="h-3 w-3" />
                                {saving ? 'Saving…' : modifiedCount > 0 ? `Save (${modifiedCount})` : 'Save'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            </FocusTrap>
        </div>
    )
}
