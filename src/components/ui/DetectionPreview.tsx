/**
 * DetectionPreview — src/components/ui/DetectionPreview.tsx
 *
 * Surfaces the detected ProjectEnvironment to the user before they commit to
 * opening a project. Each field has an override control so the user can correct
 * a mis-detection before auto-configure runs.
 *
 * Props:
 *   environment — result of project:detect-environment / project:smart-open
 *   projectPath — absolute path that was opened (shown as context)
 *   onConfirm   — called with optional Partial<ProjectEnvironment> overrides
 *   onCancel    — called with no args; does NOT invoke project:auto-configure
 *
 * Contract: FORGE.1 — DetectionPreviewProps (FORGE.1.contract.ts)
 * IPC emitted: project:auto-configure (via onConfirm → caller)
 *
 * Design tokens only — no arbitrary hex or spacing values (Commandment 2).
 */

import { useState } from 'react'
import { CheckCircle, X, ChevronDown } from 'lucide-react'
import type { ProjectEnvironment } from '../../types/flint-api'

// CODE-SUG-2: DRY the MUI label so a future rename only touches one place.
const MUI_LABEL = 'MUI (Material UI)'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DetectionPreviewProps {
    environment: ProjectEnvironment
    projectPath: string
    onConfirm: (overrides?: Partial<ProjectEnvironment>) => void
    onCancel: () => void
}

// ── Library options — MUI is the default when detection returns null ──────────

const LIBRARY_OPTIONS = [
    { value: '', label: 'None detected' },
    { value: 'mui', label: MUI_LABEL },
    { value: 'shadcn', label: 'shadcn/ui' },
    { value: 'chakra', label: 'Chakra UI' },
    { value: 'radix', label: 'Radix UI' },
    { value: 'antd', label: 'Ant Design' },
    { value: 'other', label: 'Other' },
]

const FRAMEWORK_OPTIONS = [
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'angular', label: 'Angular' },
    { value: 'solid', label: 'Solid' },
    { value: 'other', label: 'Other' },
]

const CSS_OPTIONS = [
    { value: '', label: 'None detected' },
    { value: 'tailwind', label: 'Tailwind CSS' },
    { value: 'css-modules', label: 'CSS Modules' },
    { value: 'styled-components', label: 'styled-components' },
    { value: 'emotion', label: 'Emotion' },
    { value: 'sass', label: 'Sass/SCSS' },
    { value: 'other', label: 'Other' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncatePath(path: string, maxLen = 48): string {
    if (path.length <= maxLen) return path
    return '...' + path.slice(-(maxLen - 3))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DetectionPreview({
    environment,
    projectPath,
    onConfirm,
    onCancel,
}: DetectionPreviewProps) {
    // Per-field override state. Null means "use detected value".
    const [libraryOverride, setLibraryOverride] = useState<string | null>(null)
    const [frameworkOverride, setFrameworkOverride] = useState<string | null>(null)
    const [cssOverride, setCssOverride] = useState<string | null>(null)

    // Derived display values (override wins over detected)
    const detectedLibrary = environment.componentLibrary?.name ?? null
    const effectiveLibrary = libraryOverride ?? detectedLibrary ?? 'mui' // MUI default

    const detectedFramework = environment.framework?.name ?? null
    const effectiveFramework = frameworkOverride ?? detectedFramework

    const detectedCss = environment.cssFramework?.name ?? null
    const effectiveCss = cssOverride ?? detectedCss

    // UX-W5: only flag as "override applied" when the effective value actually
    // differs from what detection produced. Selecting the same value from the
    // dropdown should not trigger the indicator.
    const libraryChanged = effectiveLibrary !== (detectedLibrary ?? 'mui')
    const frameworkChanged = effectiveFramework !== detectedFramework && effectiveFramework !== null
    const cssChanged = effectiveCss !== detectedCss && effectiveCss !== null
    const hasOverrides = libraryChanged || frameworkChanged || cssChanged

    const handleConfirm = () => {
        // Build a Partial<ProjectEnvironment> containing only user-changed fields
        const overrides: Partial<ProjectEnvironment> = {}

        if (libraryOverride !== null) {
            if (libraryOverride === '') {
                overrides.componentLibrary = null
                overrides.componentLibraryLabel = null
            } else {
                overrides.componentLibrary = { name: libraryOverride, version: 'latest' }
                overrides.componentLibraryLabel = LIBRARY_OPTIONS.find(o => o.value === libraryOverride)?.label ?? libraryOverride
            }
        } else if (!detectedLibrary) {
            // No detected library and no user override — apply MUI default
            overrides.componentLibrary = { name: 'mui', version: 'latest' }
            overrides.componentLibraryLabel = MUI_LABEL
        }

        if (frameworkOverride !== null && frameworkOverride !== '') {
            overrides.framework = { name: frameworkOverride, version: 'latest' }
            overrides.uiFramework = FRAMEWORK_OPTIONS.find(o => o.value === frameworkOverride)?.label ?? frameworkOverride
        }

        if (cssOverride !== null) {
            if (cssOverride === '') {
                overrides.cssFramework = null
                overrides.cssFrameworkLabel = ''
            } else {
                overrides.cssFramework = { name: cssOverride, version: 'latest' }
                overrides.cssFrameworkLabel = CSS_OPTIONS.find(o => o.value === cssOverride)?.label ?? cssOverride
            }
        }

        onConfirm(Object.keys(overrides).length > 0 ? overrides : undefined)
    }

    return (
        <div
            data-testid="detection-preview"
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
            role="region"
            aria-label="Detection results"
        >
            {/* Header */}
            <div className="mb-4 flex items-start gap-3">
                <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">Project detected</p>
                    <p
                        className="mt-0.5 text-xs text-zinc-500 truncate"
                        title={projectPath}
                        aria-label={`Project path: ${projectPath}`}
                    >
                        {truncatePath(projectPath)}
                    </p>
                </div>
                <button
                    type="button"
                    aria-label="Cancel"
                    onClick={() => onCancel()}
                    className="shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
                >
                    <X size={14} aria-hidden="true" />
                </button>
            </div>

            {/* Detection rows */}
            <div className="space-y-3 mb-4">

                {/* Framework — UX-B3 plain-language label */}
                <DetectionRow label="Built with">
                    <SelectOverride
                        id="framework-override"
                        value={frameworkOverride ?? detectedFramework ?? ''}
                        options={FRAMEWORK_OPTIONS}
                        onChange={setFrameworkOverride}
                        placeholder={detectedFramework ?? 'Unknown'}
                        aria-label="Override framework"
                    />
                </DetectionRow>

                {/* Component library — UX-B3 plain-language label, UX-W3 confident default */}
                <DetectionRow label="Component kit">
                    {!detectedLibrary && libraryOverride === null && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 mr-2">
                            <CheckCircle size={11} aria-hidden="true" />
                            <span>Using MUI (change if needed)</span>
                        </span>
                    )}
                    <SelectOverride
                        id="library-override"
                        value={libraryOverride ?? detectedLibrary ?? 'mui'}
                        options={LIBRARY_OPTIONS}
                        onChange={setLibraryOverride}
                        placeholder={detectedLibrary ?? `${MUI_LABEL} (default)`}
                        aria-label="Override component library"
                    />
                </DetectionRow>

                {/* CSS framework — UX-B3 plain-language label */}
                <DetectionRow label="Styling">
                    <SelectOverride
                        id="css-override"
                        value={cssOverride ?? detectedCss ?? ''}
                        options={CSS_OPTIONS}
                        onChange={setCssOverride}
                        placeholder={detectedCss ?? 'None'}
                        aria-label="Override CSS framework"
                    />
                </DetectionRow>

                {/* Read-only info rows */}
                {/* UX-B3: plain-language labels for read-only rows */}
                <InfoRow label="Components" value={String(environment.componentCount)} />
                <InfoRow label="Code type" value={environment.typescript ? 'TypeScript' : 'JavaScript'} />
                {environment.hasDesignTokens && (
                    <InfoRow label="Design tokens" value={environment.tokenSource ?? 'detected'} />
                )}
            </div>

            {/* UX-W5: only render when effective ≠ detected */}
            {hasOverrides && (
                <p className="mb-3 text-xs text-indigo-400">
                    {[
                        frameworkChanged && `Built with: ${effectiveFramework}`,
                        libraryChanged && `Component kit: ${effectiveLibrary}`,
                        cssChanged && `Styling: ${effectiveCss}`,
                    ].filter(Boolean).join(' · ')}
                </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    type="button"
                    data-testid="detection-preview-confirm"
                    onClick={handleConfirm}
                    className="flex-1 rounded-lg border border-indigo-500/40 bg-indigo-600/20 py-2.5 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30"
                >
                    Confirm and open
                </button>
                <button
                    type="button"
                    data-testid="detection-preview-cancel"
                    onClick={() => onCancel()}
                    className="rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-2.5 text-xs text-zinc-400 transition-colors hover:text-zinc-300"
                >
                    Back
                </button>
            </div>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetectionRow({
    label,
    highlight = false,
    children,
}: {
    label: string
    highlight?: boolean
    children: React.ReactNode
}) {
    return (
        <div className={[
            'flex items-center gap-2 rounded-lg px-2.5 py-1.5',
            highlight ? 'border border-amber-500/20 bg-amber-900/10' : 'border border-zinc-800/50',
        ].join(' ')}>
            <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
            <div className="flex flex-1 min-w-0 items-center gap-1.5">
                {children}
            </div>
        </div>
    )
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800/50 px-2.5 py-1.5">
            <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
            <span className="text-xs text-zinc-300">{value}</span>
        </div>
    )
}

function SelectOverride({
    id,
    value,
    options,
    onChange,
    placeholder,
    'aria-label': ariaLabel,
}: {
    id: string
    value: string
    options: { value: string; label: string }[]
    onChange: (v: string) => void
    placeholder: string
    'aria-label': string
}) {
    return (
        <div className="relative flex-1 min-w-0">
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={ariaLabel}
                className="w-full appearance-none rounded border border-zinc-700/50 bg-zinc-800/60 py-1 pl-2 pr-6 text-xs text-zinc-200 outline-none transition-colors focus:border-indigo-500/40 focus:bg-zinc-800"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <ChevronDown
                size={10}
                aria-hidden="true"
                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
        </div>
    )
}
