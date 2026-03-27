/**
 * ComplianceProfileSelector — src/components/ui/ComplianceProfileSelector.tsx
 *
 * Jurisdiction checklist that auto-configures governance presets.
 * Rendered as a tab within GovernancePanel ("Profiles" tab).
 *
 * Layout:
 *   A checkbox list of compliance profiles (jurisdictions).
 *   Checking enables the associated rule pack via the parent's onToggle callback.
 *   Coming-soon profiles are disabled with a visual indicator.
 *
 * Behavior:
 *   - Derives which profiles are checked from activePresets (governanceStore).
 *   - Calls onToggleJurisdiction with the pack preset ID when a box is toggled.
 *   - The parent (GovernancePanel) wires this to window.flintAPI.governance.togglePack.
 *
 * Mithril Safety: all classes from the Flint token palette only.
 */

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { RULE_PACK_REGISTRY } from '../../core/rulePackRegistryClient'

// ── Types ──────────────────────────────────────────────────────────────────

interface ComplianceProfile {
    /** Pack ID from the registry */
    packId: string
    /** The @flint/ preset that enables this profile */
    preset?: string
    /** Human-readable label for the jurisdiction */
    label: string
    /** Short description of the framework */
    description: string
    /** Whether this profile is currently active */
    status: 'active' | 'available' | 'coming-soon'
    /** Region prefix for display grouping */
    region: string
}

interface ComplianceProfileSelectorProps {
    /** Currently active preset IDs from the resolved config */
    activePresets: string[]
    /** Called when the user toggles a profile — passes the pack ID and desired state */
    onToggleJurisdiction: (packId: string, enabled: boolean) => void
    /** True while a toggle IPC call is in flight */
    isToggling: boolean
}

// ── Static profile list (derived from the pack registry) ──────────────────

const COMPLIANCE_PROFILES: ComplianceProfile[] = [
    {
        packId: 'wcag-2.1-aa',
        preset: '@flint/wcag-aa',
        label: 'EU — European Accessibility Act',
        description: 'EAA mandates WCAG 2.1 AA for public-facing digital services in the EU.',
        status: 'active',
        region: 'EU',
    },
    {
        packId: 'wcag-2.1-aa',
        preset: '@flint/wcag-aa',
        label: 'US — ADA Title II',
        description: 'ADA Title II now requires WCAG 2.1 AA for US state & local government sites.',
        status: 'active',
        region: 'US',
    },
    {
        packId: 'gdpr-consent',
        preset: '@flint/gdpr',
        label: 'GDPR Consent Patterns',
        description: 'Enforces correct consent UI, cookie banners, and data subject rights flows.',
        status: 'coming-soon',
        region: 'EU',
    },
    {
        packId: 'ccpa-cpra',
        preset: '@flint/ccpa',
        label: 'CCPA/CPRA Privacy',
        description: 'California Consumer Privacy Act / CPRA UI opt-out flows.',
        status: 'coming-soon',
        region: 'US',
    },
    {
        packId: 'pci-dss-ui',
        preset: '@flint/fintech',
        label: 'PCI-DSS (fintech)',
        description: 'Payment card industry UI — masked fields, secure input indicators.',
        status: 'coming-soon',
        region: 'US',
    },
    {
        packId: 'hipaa-phi',
        preset: '@flint/healthcare',
        label: 'HIPAA (healthcare)',
        description: 'PHI display restrictions, session timeouts, and secure form patterns.',
        status: 'available',
        region: 'US',
    },
    {
        packId: 'wcag-2.1-aa',
        preset: '@flint/wcag-aa',
        label: 'Section 508 (US federal)',
        description: 'Requires WCAG 2.1 AA compliance for US federal agency digital services.',
        status: 'active',
        region: 'US',
    },
]

// Deduplicate by packId + region to avoid double-rendering entries
// that share the same pack (WCAG 2.1 AA covers multiple jurisdictions)
function dedupeProfiles(profiles: ComplianceProfile[]): ComplianceProfile[] {
    const seen = new Set<string>()
    return profiles.filter((p) => {
        const key = `${p.packId}:${p.region}:${p.label}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

// ── Checkbox row ──────────────────────────────────────────────────────────

interface ProfileRowProps {
    profile: ComplianceProfile
    isChecked: boolean
    isToggling: boolean
    onToggle: (enabled: boolean) => void
}

function ProfileRow({ profile, isChecked, isToggling, onToggle }: ProfileRowProps) {
    const isComingSoon = profile.status === 'coming-soon'
    const isDisabled = isComingSoon || isToggling

    const checkboxId = `profile-${profile.packId}-${profile.region}-${profile.label.replace(/\s+/g, '-').toLowerCase()}`

    return (
        <label
            htmlFor={checkboxId}
            className={`flex cursor-pointer items-start gap-3 rounded px-3 py-2.5 transition-colors ${
                isDisabled
                    ? 'cursor-not-allowed opacity-40'
                    : isChecked
                    ? 'bg-indigo-900/10 hover:bg-indigo-900/20'
                    : 'hover:bg-zinc-800/40'
            }`}
        >
            {/* Custom checkbox */}
            <div className="relative mt-0.5 shrink-0">
                <input
                    id={checkboxId}
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={(e) => onToggle(e.target.checked)}
                    className="sr-only"
                    aria-describedby={`${checkboxId}-desc`}
                />
                <div
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                        isChecked
                            ? 'border-indigo-500/60 bg-indigo-600'
                            : 'border-zinc-600 bg-zinc-800'
                    }`}
                    aria-hidden="true"
                >
                    {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
            </div>

            {/* Label + description */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isChecked ? 'text-zinc-100' : 'text-zinc-300'}`}>
                        {profile.label}
                    </span>
                    {isComingSoon && (
                        <span className="rounded border border-zinc-700/40 bg-zinc-800/60 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                            Soon
                        </span>
                    )}
                </div>
                <p
                    id={`${checkboxId}-desc`}
                    className="mt-0.5 text-[10px] leading-snug text-zinc-500"
                >
                    {profile.description}
                </p>
            </div>

            {/* Region badge */}
            <span className="mt-0.5 shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                {profile.region}
            </span>
        </label>
    )
}

// ── ComplianceProfileSelector ──────────────────────────────────────────────

export function ComplianceProfileSelector({
    activePresets,
    onToggleJurisdiction,
    isToggling,
}: ComplianceProfileSelectorProps) {
    const profiles = useMemo(() => dedupeProfiles(COMPLIANCE_PROFILES), [])

    // Count enabled packs for the summary line
    const enabledCount = useMemo(() => {
        const packIds = new Set<string>()
        for (const profile of profiles) {
            const isActive =
                RULE_PACK_REGISTRY.find((p) => p.id === profile.packId)?.status === 'active' ||
                (profile.preset !== undefined && activePresets.includes(profile.preset))
            if (isActive) packIds.add(profile.packId)
        }
        return packIds.size
    }, [profiles, activePresets])

    return (
        <div className="flex flex-col">
            {/* ── Header ── */}
            <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
                <h3 className="text-xs font-medium text-zinc-100">Compliance Profiles</h3>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                    Checking a profile enables its rule pack in your flint.config.yaml.
                    {enabledCount > 0 && (
                        <span className="ml-1 text-indigo-400">{enabledCount} active</span>
                    )}
                </p>
            </div>

            {/* ── Profile list ── */}
            <div className="divide-y divide-zinc-800/30 overflow-y-auto">
                {profiles.map((profile) => {
                    const isChecked =
                        RULE_PACK_REGISTRY.find((p) => p.id === profile.packId)?.status ===
                            'active' ||
                        (profile.preset !== undefined && activePresets.includes(profile.preset))

                    return (
                        <ProfileRow
                            key={`${profile.packId}:${profile.label}`}
                            profile={profile}
                            isChecked={isChecked}
                            isToggling={isToggling}
                            onToggle={(enabled) =>
                                onToggleJurisdiction(profile.packId, enabled)
                            }
                        />
                    )
                })}
            </div>

            {/* ── Footer note ── */}
            <div className="shrink-0 border-t border-zinc-800 px-4 py-2.5">
                <p className="text-[10px] text-zinc-600">
                    Profile changes are written atomically to flint.config.yaml and take effect immediately.
                </p>
            </div>
        </div>
    )
}
