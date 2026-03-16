/**
 * GovernancePanel — src/components/ui/GovernancePanel.tsx
 *
 * Full-screen governance rules manager. Allows enabling/disabling individual
 * rules and overriding their severity, grouped by category.
 *
 * Architecture:
 *   GovernancePanel         — full-screen modal shell + category sidebar + rule list
 *   CategorySidebar         — left sidebar with category filter buttons
 *   RuleRow                 — single rule with toggle, ID, name, severity badge
 *   SeverityBadge           — color-coded severity display
 *
 * State:
 *   - Reads rule definitions from GOVERNANCE_RULES_MANIFEST (static)
 *   - Reads/writes overrides via useGovernanceStore
 *   - Pending changes tracked locally; committed on Save, discarded on Reset/Close
 *
 * Mithril Safety: all classes from Bridge design token palette only.
 */

import { useEffect, useState, useCallback } from 'react'
import { X, Save, RotateCcw, ShieldCheck } from 'lucide-react'
import {
    GOVERNANCE_RULES_MANIFEST,
    GOVERNANCE_CATEGORIES,
    type GovernanceRule,
    type RuleSeverity,
    type GovernanceCategory,
} from '../../core/governanceRulesManifest'
import { useGovernanceStore, type RuleOverride } from '../../store/governanceStore'
import { useCanvasStore } from '../../store/canvasStore'

// ── Props ─────────────────────────────────────────────────────────────────────

interface GovernancePanelProps {
    onClose: () => void
}

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

// ── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleProps {
    enabled: boolean
    onChange: (value: boolean) => void
    label: string
}

function Toggle({ enabled, onChange, label }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={label}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                enabled
                    ? 'border-indigo-500/50 bg-indigo-600'
                    : 'border-zinc-700 bg-zinc-800'
            }`}
        >
            <span
                className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
            />
        </button>
    )
}

// ── RuleRow ───────────────────────────────────────────────────────────────────

interface RuleRowProps {
    rule: GovernanceRule
    override: RuleOverride | undefined
    onToggle: (ruleId: string, enabled: boolean) => void
    onReset: (ruleId: string) => void
}

function RuleRow({ rule, override, onToggle, onReset }: RuleRowProps) {
    const isEnabled = override?.enabled !== false
    const effectiveSeverity: RuleSeverity = override?.severity ?? rule.defaultSeverity
    const isModified = override !== undefined

    return (
        <div
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors ${
                isModified ? 'border-l-2 border-indigo-500/40' : 'border-l-2 border-transparent'
            }`}
        >
            <Toggle
                enabled={isEnabled}
                onChange={(val) => onToggle(rule.id, val)}
                label={`Toggle ${rule.name}`}
            />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">{rule.id}</span>
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
            </div>

            <SeverityBadge severity={effectiveSeverity} />
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
                <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
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
                            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-zinc-800/40 ${
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

export function GovernancePanel({ onClose }: GovernancePanelProps) {
    const overrides = useGovernanceStore((s) => s.overrides)
    const setOverride = useGovernanceStore((s) => s.setOverride)
    const resetOverride = useGovernanceStore((s) => s.resetOverride)
    const resetAll = useGovernanceStore((s) => s.resetAll)
    const saveToFile = useGovernanceStore((s) => s.saveToFile)
    const loadFromFile = useGovernanceStore((s) => s.loadFromFile)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    const [activeCategory, setActiveCategory] = useState<GovernanceCategory | 'All'>('All')
    const [saving, setSaving] = useState(false)

    // Load persisted overrides on mount
    useEffect(() => {
        void loadFromFile()
    }, [loadFromFile])

    // Escape key to close
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [onClose])

    // Filter rules by selected category
    const visibleRules =
        activeCategory === 'All'
            ? GOVERNANCE_RULES_MANIFEST
            : GOVERNANCE_RULES_MANIFEST.filter((r) => r.category === activeCategory)

    // Count of modified rules per category (for sidebar badge context)
    const categoryCounts: Record<string, number> = {}
    for (const cat of GOVERNANCE_CATEGORIES) {
        categoryCounts[cat] = GOVERNANCE_RULES_MANIFEST.filter((r) => r.category === cat).length
    }

    const handleToggle = useCallback(
        (ruleId: string, enabled: boolean) => {
            const override: RuleOverride = { enabled }
            setOverride(ruleId, override)
            // GOV.2: fire-and-forget telemetry — do not await
            window.bridgeAPI.governance.recordOverride({
                ruleId,
                action: enabled ? 'enable' : 'disable',
                newValue: override,
                filePath: activeFilePath ?? '',
            })
        },
        [setOverride, activeFilePath]
    )

    const handleResetRule = useCallback(
        (ruleId: string) => {
            resetOverride(ruleId)
            // GOV.2: fire-and-forget telemetry — do not await
            window.bridgeAPI.governance.recordOverride({
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
        window.bridgeAPI.governance.recordOverride({
            ruleId: '*',
            action: 'reset_all',
            newValue: null,
            filePath: activeFilePath ?? '',
        })
    }

    const modifiedCount = Object.keys(overrides).length

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
            aria-modal="true"
            role="dialog"
            aria-labelledby="governance-panel-title"
        >
            <div
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
                        <p className="mt-0.5 text-xs text-zinc-500">
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
                        className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {/* Category sidebar */}
                    <CategorySidebar
                        activeCategory={activeCategory}
                        counts={categoryCounts}
                        onChange={setActiveCategory}
                    />

                    {/* Rule list */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Section header */}
                        <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/90 px-4 py-2 backdrop-blur-sm">
                            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                                {activeCategory} ({visibleRules.length})
                            </h3>
                        </div>

                        {/* Rule rows */}
                        <div className="divide-y divide-zinc-800/40">
                            {visibleRules.map((rule) => (
                                <RuleRow
                                    key={rule.id}
                                    rule={rule}
                                    override={overrides[rule.id]}
                                    onToggle={handleToggle}
                                    onReset={handleResetRule}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3">
                    {/* Reset button */}
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={modifiedCount === 0}
                        className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset All
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Close / Cancel */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                        >
                            Close
                        </button>

                        {/* Save */}
                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 active:scale-95 disabled:opacity-60"
                        >
                            <Save className="h-3 w-3" />
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
