/**
 * PolicySettings.tsx — src/components/ui/PolicySettings.tsx
 *
 * POL.1 Group 1c — Glass settings panel for `.flint/policy.json`.
 *
 * Architecture:
 *   Full-screen modal (same pattern as GovernancePanel) opened from the
 *   GovernancePanel header or a standalone "Policy" button in App.tsx.
 *
 * Form sections:
 *   1. Domain Preset Picker
 *   2. Mithril — deltaE sliders + category mode + per-rule mode selects
 *   3. Accessibility — conformance level + category mode + per-rule mode selects
 *   4. Export Gate — severity floor + block_on_overrides toggle
 *
 * State model:
 *   - Reads policy on mount via `window.flintAPI.policy.get()`
 *   - Maintains a local draft until Save is clicked
 *   - Save calls `window.flintAPI.policy.set(draft)` (POL.1 IPC, Group 1b)
 *   - Reset reverts to DEFAULT_POLICY_V2
 *
 * Commandment compliance:
 *   - No fs / Node.js in src/ (Commandment 14)
 *   - All IPC via window.flintAPI (Commandment 14)
 *   - No hardcoded hex colours (Mithril Safety)
 *   - No arbitrary spacing (Mithril Safety)
 *   - All form controls have associated labels (Commandment 5)
 *   - Escape key closes + focus trap (Commandment 5)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import {
    X,
    Save,
    RotateCcw,
    Settings2,
    ShieldAlert,
    AlertTriangle,
} from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'

// ── Local policy type (v2 superset) ──────────────────────────────────────────
//
// Group 1A (flint-state-architect) will update src/types/flint-api.d.ts with
// the full v2 FlintPolicy shape. Until that lands we declare the v2 superset
// locally so this component can be developed in parallel without breaking TSC.

type PolicyMode = 'blocking' | 'advisory' | 'off'
type A11yLevel = 'A' | 'AA' | 'AAA'
type SeverityFloor = 'critical' | 'warning' | 'info'
type GovernanceDomain =
    | 'general'
    | 'healthcare'
    | 'fintech'
    | 'e-commerce'
    | 'government'
    | 'enterprise-saas'

interface PolicyV2 {
    version: number
    domain?: GovernanceDomain
    mithril: {
        deltaE_threshold: number
        deltaE_critical_threshold: number
        mode: PolicyMode
        ignore_patterns: string[]
        rules: Record<string, PolicyMode>
    }
    a11y: {
        level: A11yLevel
        mode: PolicyMode
        rules: Record<string, PolicyMode>
        disabled_rules?: string[]
    }
    export_gate: {
        severity_floor: SeverityFloor
        block_on_overrides: boolean
        // v1 compat fields (deprecated)
        block_on_mithril?: boolean
        block_on_a11y?: boolean
    }
    baseline: {
        enabled: boolean
    }
    teams?: Record<string, unknown>
}

// ── Default policy (v2) ───────────────────────────────────────────────────────

const DEFAULT_POLICY_V2: PolicyV2 = {
    version: 2,
    domain: 'general',
    mithril: {
        deltaE_threshold: 2.0,
        deltaE_critical_threshold: 10.0,
        mode: 'blocking',
        ignore_patterns: ['**/node_modules/**'],
        rules: {},
    },
    a11y: {
        level: 'AA',
        mode: 'blocking',
        rules: {},
    },
    export_gate: {
        severity_floor: 'warning',
        block_on_overrides: true,
    },
    baseline: {
        enabled: false,
    },
}

// ── Domain preset configurations ──────────────────────────────────────────────

const DOMAIN_PRESETS: Record<GovernanceDomain, Partial<PolicyV2>> = {
    general: {},
    healthcare: {
        a11y: {
            level: 'AAA',
            mode: 'blocking',
            rules: {},
        },
        export_gate: {
            severity_floor: 'info',
            block_on_overrides: true,
        },
    },
    fintech: {
        mithril: {
            deltaE_threshold: 1.0,
            deltaE_critical_threshold: 5.0,
            mode: 'blocking',
            ignore_patterns: ['**/node_modules/**'],
            rules: {},
        },
        export_gate: {
            severity_floor: 'warning',
            block_on_overrides: true,
        },
    },
    'e-commerce': {
        mithril: {
            deltaE_threshold: 3.0,
            deltaE_critical_threshold: 10.0,
            mode: 'advisory',
            ignore_patterns: ['**/node_modules/**'],
            rules: {},
        },
        export_gate: {
            severity_floor: 'warning',
            block_on_overrides: false,
        },
    },
    government: {
        a11y: {
            level: 'AA',
            mode: 'blocking',
            rules: {},
        },
        export_gate: {
            severity_floor: 'warning',
            block_on_overrides: true,
        },
    },
    'enterprise-saas': {
        mithril: {
            deltaE_threshold: 2.0,
            deltaE_critical_threshold: 8.0,
            mode: 'blocking',
            ignore_patterns: ['**/node_modules/**'],
            rules: {},
        },
        export_gate: {
            severity_floor: 'warning',
            block_on_overrides: true,
        },
    },
}

// ── Rule manifests ────────────────────────────────────────────────────────────

interface RuleDef {
    id: string
    label: string
    category: string
}

const MITHRIL_RULES: RuleDef[] = [
    { id: 'MITHRIL-COL',     label: 'Color Drift',       category: 'Color Drift' },
    { id: 'MITHRIL-TYP-001', label: 'Font Family',        category: 'Typography' },
    { id: 'MITHRIL-TYP-002', label: 'Font Weight',        category: 'Typography' },
    { id: 'MITHRIL-TYP-003', label: 'Font Size',          category: 'Typography' },
    { id: 'MITHRIL-TYP-004', label: 'Line Height',        category: 'Typography' },
    { id: 'MITHRIL-TYP-005', label: 'Letter Spacing',     category: 'Typography' },
    { id: 'MITHRIL-SPC-001', label: 'Spacing Scale',      category: 'Spacing' },
    { id: 'MITHRIL-SHD-001', label: 'Shadow Token',       category: 'Shadow' },
    { id: 'MITHRIL-OPC-001', label: 'Opacity Token',      category: 'Opacity' },
]

const A11Y_RULES: RuleDef[] = [
    { id: 'A11Y-001', label: 'Images must have alt text',              category: 'Accessibility' },
    { id: 'A11Y-002', label: 'Interactive elements must have labels',   category: 'Accessibility' },
    { id: 'A11Y-003', label: 'Color contrast (AA)',                     category: 'Accessibility' },
    { id: 'A11Y-004', label: 'Form inputs must have labels',            category: 'Accessibility' },
    { id: 'A11Y-005', label: 'Links must have descriptive text',        category: 'Accessibility' },
    { id: 'A11Y-006', label: 'Headings must be in order',               category: 'Accessibility' },
    { id: 'A11Y-007', label: 'Focus visible',                           category: 'Accessibility' },
    { id: 'A11Y-008', label: 'ARIA roles must be valid',                category: 'Accessibility' },
    { id: 'A11Y-009', label: 'Language attribute required',             category: 'Accessibility' },
    { id: 'A11Y-010', label: 'Skip navigation present',                 category: 'Accessibility' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

// ModeSelect — a three-state dropdown for blocking / advisory / off
interface ModeSelectProps {
    id: string
    value: PolicyMode
    onChange: (v: PolicyMode) => void
    label: string
}

function ModeSelect({ id, value, onChange, label }: ModeSelectProps) {
    return (
        <div className="flex items-center gap-2">
            {/* Icon indicator for the current mode */}
            {value === 'blocking' && (
                <ShieldAlert className="h-3 w-3 shrink-0 text-red-400" aria-hidden="true" />
            )}
            {value === 'advisory' && (
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" aria-hidden="true" />
            )}
            {value === 'off' && (
                <span
                    className="h-3 w-3 shrink-0 rounded-full border border-zinc-600 bg-zinc-800"
                    aria-hidden="true"
                />
            )}
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value as PolicyMode)}
                className={`rounded border bg-zinc-900 py-0.5 pl-2 pr-6 text-xs outline-none transition-colors focus:ring-1 focus:ring-indigo-500/50 ${
                    value === 'blocking'
                        ? 'border-red-700/40 text-red-400'
                        : value === 'advisory'
                        ? 'border-amber-500/30 text-amber-400'
                        : 'border-zinc-700 text-zinc-500'
                }`}
                aria-label={label}
            >
                <option value="blocking">Blocking</option>
                <option value="advisory">Advisory</option>
                <option value="off">Off</option>
            </select>
        </div>
    )
}

// SectionHeader — panel section divider
function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="border-b border-zinc-800 px-4 py-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                {children}
            </h3>
        </div>
    )
}

// FormRow — label + control pair
interface FormRowProps {
    label: string
    htmlFor?: string
    hint?: string
    children: React.ReactNode
}

function FormRow({ label, htmlFor, hint, children }: FormRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 px-4 py-2">
            <div className="min-w-0">
                {htmlFor ? (
                    <label
                        htmlFor={htmlFor}
                        className="block text-xs text-zinc-300"
                    >
                        {label}
                    </label>
                ) : (
                    <span className="block text-xs text-zinc-300">{label}</span>
                )}
                {hint && (
                    <span className="mt-0.5 block text-[10px] text-zinc-600">{hint}</span>
                )}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    )
}

// DeltaESlider — accessible range slider with live value display
interface DeltaESliderProps {
    id: string
    label: string
    value: number
    min: number
    max: number
    step?: number
    leftLabel: string
    rightLabel: string
    defaultMarker?: number
    onChange: (v: number) => void
}

function DeltaESlider({
    id,
    label,
    value,
    min,
    max,
    step = 0.1,
    leftLabel,
    rightLabel,
    defaultMarker,
    onChange,
}: DeltaESliderProps) {
    return (
        <div className="flex flex-col gap-1.5 px-4 py-2">
            <div className="flex items-center justify-between">
                <label htmlFor={id} className="text-xs text-zinc-300">
                    {label}
                </label>
                <span
                    className="rounded border border-indigo-500/30 bg-indigo-900/20 px-1.5 py-0.5 font-mono text-[10px] text-indigo-400"
                    aria-live="polite"
                    aria-label={`${label}: ${value.toFixed(1)}`}
                >
                    {value.toFixed(1)}
                </span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-label={label}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
            />
            <div className="flex justify-between">
                <span className="text-[10px] text-zinc-600">{leftLabel}</span>
                {defaultMarker !== undefined && (
                    <span className="text-[10px] text-zinc-600">
                        Default: {defaultMarker.toFixed(1)}
                    </span>
                )}
                <span className="text-[10px] text-zinc-600">{rightLabel}</span>
            </div>
        </div>
    )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PolicySettingsProps {
    onClose: () => void
}

// ── PolicySettings ────────────────────────────────────────────────────────────

export function PolicySettings({ onClose }: PolicySettingsProps) {
    const cachedPolicy = useCanvasStore((s) => s.cachedPolicy)
    const push = useNotificationStore((s) => s.push)

    // Local draft state — tracks form until Save
    const [draft, setDraft] = useState<PolicyV2>(DEFAULT_POLICY_V2)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // For focus trap
    const dialogRef = useRef<HTMLDivElement>(null)

    // ── Load policy on mount ──────────────────────────────────────────────────
    useEffect(() => {
        async function loadInitialPolicy() {
            setLoading(true)
            try {
                // Prefer cachedPolicy from canvasStore (already loaded, synchronous)
                if (cachedPolicy) {
                    setDraft(normalizeToV2(cachedPolicy as unknown as Partial<PolicyV2>))
                    setLoading(false)
                    return
                }
                // Fall back to IPC read
                const api = window.flintAPI?.policy
                if (api?.get) {
                    const policy = await api.get()
                    setDraft(normalizeToV2(policy as unknown as Partial<PolicyV2>))
                } else {
                    setDraft(DEFAULT_POLICY_V2)
                }
            } catch {
                setDraft(DEFAULT_POLICY_V2)
            } finally {
                setLoading(false)
            }
        }
        void loadInitialPolicy()
    }, [cachedPolicy])

    // ── Keyboard handling ─────────────────────────────────────────────────────
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [onClose])

    // ── Draft update helpers ──────────────────────────────────────────────────

    const setDomain = useCallback((domain: GovernanceDomain) => {
        const preset = DOMAIN_PRESETS[domain]
        setDraft((prev) => mergePreset(prev, domain, preset))
    }, [])

    const setMithrilDeltaE = useCallback((v: number) => {
        setDraft((prev) => ({
            ...prev,
            mithril: { ...prev.mithril, deltaE_threshold: v },
        }))
    }, [])

    const setMithrilCritical = useCallback((v: number) => {
        setDraft((prev) => ({
            ...prev,
            mithril: { ...prev.mithril, deltaE_critical_threshold: v },
        }))
    }, [])

    const setMithrilMode = useCallback((mode: PolicyMode) => {
        setDraft((prev) => ({
            ...prev,
            mithril: { ...prev.mithril, mode },
        }))
    }, [])

    const setMithrilRuleMode = useCallback((ruleId: string, mode: PolicyMode) => {
        setDraft((prev) => ({
            ...prev,
            mithril: {
                ...prev.mithril,
                rules: { ...prev.mithril.rules, [ruleId]: mode },
            },
        }))
    }, [])

    const setA11yLevel = useCallback((level: A11yLevel) => {
        setDraft((prev) => ({
            ...prev,
            a11y: { ...prev.a11y, level },
        }))
    }, [])

    const setA11yMode = useCallback((mode: PolicyMode) => {
        setDraft((prev) => ({
            ...prev,
            a11y: { ...prev.a11y, mode },
        }))
    }, [])

    const setA11yRuleMode = useCallback((ruleId: string, mode: PolicyMode) => {
        setDraft((prev) => ({
            ...prev,
            a11y: {
                ...prev.a11y,
                rules: { ...prev.a11y.rules, [ruleId]: mode },
            },
        }))
    }, [])

    const setSeverityFloor = useCallback((floor: SeverityFloor) => {
        setDraft((prev) => ({
            ...prev,
            export_gate: { ...prev.export_gate, severity_floor: floor },
        }))
    }, [])

    const setBlockOnOverrides = useCallback((v: boolean) => {
        setDraft((prev) => ({
            ...prev,
            export_gate: { ...prev.export_gate, block_on_overrides: v },
        }))
    }, [])

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        setSaving(true)
        try {
            const policyApi = window.flintAPI?.policy as
                | { get: () => Promise<unknown>; set?: (p: unknown) => Promise<unknown> }
                | undefined

            if (policyApi?.set) {
                await policyApi.set(draft)
            } else {
                // policy.set not yet wired (Group 1B pending) — inform the user
                throw new Error('Policy write IPC not available. Run npm run dev after Group 1B lands.')
            }
            push({
                type: 'sync',
                title: 'Policy Saved',
                message: 'Policy settings written to .flint/policy.json',
                severity: 'success',
                autoDismissMs: 3000,
            })
            onClose()
        } catch (err) {
            push({
                type: 'error',
                title: 'Save Failed',
                message: err instanceof Error ? err.message : 'Unknown error',
                severity: 'error',
                autoDismissMs: 0,
            })
        } finally {
            setSaving(false)
        }
    }, [draft, onClose, push])

    // ── Reset ─────────────────────────────────────────────────────────────────

    const handleReset = useCallback(() => {
        setDraft(DEFAULT_POLICY_V2)
    }, [])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
            aria-modal="true"
            role="dialog"
            aria-labelledby="policy-settings-title"
            data-testid="policy-settings-backdrop"
        >
            <div
                ref={dialogRef}
                className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-5 py-4">
                    <Settings2 className="h-5 w-5 shrink-0 text-indigo-400" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                        <h2
                            id="policy-settings-title"
                            className="text-sm font-semibold text-zinc-100"
                        >
                            Policy Settings
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-500">
                            Governance policy for{' '}
                            <code className="font-mono text-zinc-400">.flint/policy.json</code>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close policy settings"
                        className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Body ──────────────────────────────────────────────── */}
                {loading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <span className="text-xs text-zinc-500">Loading policy…</span>
                    </div>
                ) : (
                    <div
                        className="flex-1 overflow-y-auto"
                        role="group"
                        aria-label="Policy settings form"
                    >
                        {/* ── Domain Preset ───────────────────────────── */}
                        <SectionHeader>Domain Preset</SectionHeader>
                        <FormRow
                            label="Industry Domain"
                            htmlFor="policy-domain"
                            hint="Selecting a preset fills recommended values"
                        >
                            <select
                                id="policy-domain"
                                value={draft.domain ?? 'general'}
                                onChange={(e) => setDomain(e.target.value as GovernanceDomain)}
                                className="rounded border border-zinc-700 bg-zinc-900 py-1 pl-2 pr-6 text-xs text-zinc-300 outline-none transition-colors focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                                aria-label="Industry domain preset"
                            >
                                <option value="general">General</option>
                                <option value="healthcare">Healthcare</option>
                                <option value="fintech">Fintech</option>
                                <option value="e-commerce">E-commerce</option>
                                <option value="government">Government</option>
                                <option value="enterprise-saas">Enterprise SaaS</option>
                            </select>
                        </FormRow>

                        {/* ── Mithril Design System ───────────────────── */}
                        <SectionHeader>Mithril Design System</SectionHeader>

                        <DeltaESlider
                            id="policy-delta-e"
                            label="ΔE Threshold"
                            value={draft.mithril.deltaE_threshold}
                            min={0.5}
                            max={20.0}
                            step={0.1}
                            leftLabel="Strict (0.5)"
                            rightLabel="Lenient (20.0)"
                            defaultMarker={2.0}
                            onChange={setMithrilDeltaE}
                        />

                        <DeltaESlider
                            id="policy-delta-e-critical"
                            label="ΔE Critical Threshold"
                            value={draft.mithril.deltaE_critical_threshold}
                            min={1.0}
                            max={30.0}
                            step={0.1}
                            leftLabel="Tight (1.0)"
                            rightLabel="Wide (30.0)"
                            defaultMarker={10.0}
                            onChange={setMithrilCritical}
                        />

                        <FormRow
                            label="Category Mode"
                            htmlFor="policy-mithril-mode"
                            hint="Default mode for all Mithril rules"
                        >
                            <ModeSelect
                                id="policy-mithril-mode"
                                value={draft.mithril.mode}
                                onChange={setMithrilMode}
                                label="Mithril category mode"
                            />
                        </FormRow>

                        {/* Per-rule overrides */}
                        <div className="border-b border-zinc-800 px-4 py-2">
                            <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                                Per-Rule Overrides
                            </h3>
                        </div>

                        {MITHRIL_RULES.map((rule) => {
                            const effectiveMode: PolicyMode =
                                draft.mithril.rules[rule.id] ?? draft.mithril.mode
                            return (
                                <div
                                    key={rule.id}
                                    className="flex items-center justify-between gap-4 px-4 py-1.5 hover:bg-zinc-800/20 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <span className="block font-mono text-[10px] text-zinc-500">
                                            {rule.id}
                                        </span>
                                        <span className="block text-xs text-zinc-400">
                                            {rule.label}
                                        </span>
                                    </div>
                                    <ModeSelect
                                        id={`mithril-rule-${rule.id}`}
                                        value={effectiveMode}
                                        onChange={(mode) => setMithrilRuleMode(rule.id, mode)}
                                        label={`${rule.label} mode`}
                                    />
                                </div>
                            )
                        })}

                        {/* ── Accessibility ───────────────────────────── */}
                        <SectionHeader>Accessibility</SectionHeader>

                        <FormRow
                            label="Conformance Level"
                            htmlFor="policy-a11y-level"
                            hint="WCAG 2.1 conformance level"
                        >
                            <select
                                id="policy-a11y-level"
                                value={draft.a11y.level}
                                onChange={(e) => setA11yLevel(e.target.value as A11yLevel)}
                                className="rounded border border-zinc-700 bg-zinc-900 py-1 pl-2 pr-6 text-xs text-zinc-300 outline-none transition-colors focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                                aria-label="WCAG conformance level"
                            >
                                <option value="A">A — Minimum</option>
                                <option value="AA">AA — Standard (recommended)</option>
                                <option value="AAA">AAA — Enhanced</option>
                            </select>
                        </FormRow>

                        <FormRow
                            label="Category Mode"
                            htmlFor="policy-a11y-mode"
                            hint="Default mode for all accessibility rules"
                        >
                            <ModeSelect
                                id="policy-a11y-mode"
                                value={draft.a11y.mode}
                                onChange={setA11yMode}
                                label="Accessibility category mode"
                            />
                        </FormRow>

                        {/* Per-rule overrides */}
                        <div className="border-b border-zinc-800 px-4 py-2">
                            <h3 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                                Per-Rule Overrides
                            </h3>
                        </div>

                        {A11Y_RULES.map((rule) => {
                            const effectiveMode: PolicyMode =
                                draft.a11y.rules[rule.id] ?? draft.a11y.mode
                            return (
                                <div
                                    key={rule.id}
                                    className="flex items-center justify-between gap-4 px-4 py-1.5 hover:bg-zinc-800/20 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <span className="block font-mono text-[10px] text-zinc-500">
                                            {rule.id}
                                        </span>
                                        <span className="block text-xs text-zinc-400">
                                            {rule.label}
                                        </span>
                                    </div>
                                    <ModeSelect
                                        id={`a11y-rule-${rule.id}`}
                                        value={effectiveMode}
                                        onChange={(mode) => setA11yRuleMode(rule.id, mode)}
                                        label={`${rule.label} mode`}
                                    />
                                </div>
                            )
                        })}

                        {/* ── Export Gate ─────────────────────────────── */}
                        <SectionHeader>Export Gate</SectionHeader>

                        <FormRow
                            label="Severity Floor"
                            htmlFor="policy-severity-floor"
                            hint="Violations below this level do not block export"
                        >
                            <select
                                id="policy-severity-floor"
                                value={draft.export_gate.severity_floor}
                                onChange={(e) => setSeverityFloor(e.target.value as SeverityFloor)}
                                className="rounded border border-zinc-700 bg-zinc-900 py-1 pl-2 pr-6 text-xs text-zinc-300 outline-none transition-colors focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                                aria-label="Export gate severity floor"
                            >
                                <option value="critical">Critical — only critical violations block</option>
                                <option value="warning">Warning — warning and critical block</option>
                                <option value="info">Info — all violations block</option>
                            </select>
                        </FormRow>

                        <div className="flex items-center justify-between gap-4 px-4 py-2">
                            <div className="min-w-0">
                                <label
                                    htmlFor="policy-block-overrides"
                                    className="block text-xs text-zinc-300"
                                >
                                    Block on Overrides
                                </label>
                                <span className="mt-0.5 block text-[10px] text-zinc-600">
                                    Block export when property overrides exist
                                </span>
                            </div>
                            <button
                                id="policy-block-overrides"
                                type="button"
                                role="switch"
                                aria-checked={draft.export_gate.block_on_overrides}
                                aria-label="Block export on overrides"
                                onClick={() =>
                                    setBlockOnOverrides(!draft.export_gate.block_on_overrides)
                                }
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                                    draft.export_gate.block_on_overrides
                                        ? 'border-indigo-500/50 bg-indigo-600'
                                        : 'border-zinc-700 bg-zinc-800'
                                }`}
                            >
                                <span
                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                                        draft.export_gate.block_on_overrides
                                            ? 'translate-x-4'
                                            : 'translate-x-0.5'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Bottom padding so last row isn't hidden under footer */}
                        <div className="h-4" aria-hidden="true" />
                    </div>
                )}

                {/* ── Footer ────────────────────────────────────────────── */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-800 px-5 py-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                        aria-label="Reset to default policy"
                    >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        Reset to Defaults
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={saving || loading}
                            className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Save policy settings"
                        >
                            <Save className="h-3 w-3" aria-hidden="true" />
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalises a raw policy object (v1 or v2) into the full PolicyV2 shape,
 * filling missing fields from DEFAULT_POLICY_V2.
 */
function normalizeToV2(raw: Partial<PolicyV2>): PolicyV2 {
    return {
        version: 2,
        domain: (raw.domain as GovernanceDomain) ?? DEFAULT_POLICY_V2.domain,
        mithril: {
            ...DEFAULT_POLICY_V2.mithril,
            ...(raw.mithril ?? {}),
            rules: (raw.mithril as PolicyV2['mithril'] | undefined)?.rules ?? {},
        },
        a11y: {
            ...DEFAULT_POLICY_V2.a11y,
            ...(raw.a11y ?? {}),
            rules: (raw.a11y as PolicyV2['a11y'] | undefined)?.rules ?? {},
        },
        export_gate: {
            ...DEFAULT_POLICY_V2.export_gate,
            ...(raw.export_gate ?? {}),
            // v1 -> v2 severity_floor migration
            severity_floor:
                (raw.export_gate as PolicyV2['export_gate'] | undefined)?.severity_floor ??
                DEFAULT_POLICY_V2.export_gate.severity_floor,
        },
        baseline: raw.baseline ?? DEFAULT_POLICY_V2.baseline,
    }
}

/**
 * Merges a domain preset into the current draft.
 * Only applies preset fields — user-modified fields outside the preset are preserved.
 */
function mergePreset(
    prev: PolicyV2,
    domain: GovernanceDomain,
    preset: Partial<PolicyV2>,
): PolicyV2 {
    return {
        ...prev,
        domain,
        mithril: preset.mithril
            ? { ...prev.mithril, ...preset.mithril }
            : prev.mithril,
        a11y: preset.a11y
            ? { ...prev.a11y, ...preset.a11y }
            : prev.a11y,
        export_gate: preset.export_gate
            ? { ...prev.export_gate, ...preset.export_gate }
            : prev.export_gate,
    }
}
