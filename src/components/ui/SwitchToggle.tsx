/**
 * SwitchToggle — src/components/ui/SwitchToggle.tsx
 *
 * Canonical accessible toggle switch for Flint Glass.
 *
 * Accessibility:
 *   - role="switch" + aria-checked on the button element
 *   - External label association via htmlFor/id
 *   - aria-label for contexts without a visible label
 *   - aria-describedby for supplemental descriptions
 *   - disabled state propagates to the button
 *
 * Mithril Safety: all colors from Flint design token palette only (Zinc + Indigo).
 * Renderer Process only — no Node.js imports.
 */

export interface SwitchToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    /** Visible label text rendered beside the toggle. */
    label?: string
    /** Position of the visible label relative to the toggle. Defaults to 'right'. */
    labelPosition?: 'left' | 'right'
    disabled?: boolean
    /** Toggle size. Defaults to 'md'. */
    size?: 'sm' | 'md'
    /** ID for the underlying button — enables external <label htmlFor={id}> association. */
    id?: string
    /** Accessible label when no visible label is rendered. */
    'aria-label'?: string
    /** Points to an element that describes the toggle in more detail. */
    'aria-describedby'?: string
    className?: string
}

export function SwitchToggle({
    checked,
    onChange,
    label,
    labelPosition = 'right',
    disabled = false,
    size = 'md',
    id,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    className = '',
}: SwitchToggleProps) {
    // Derive a stable button ID for label association when no explicit id provided.
    const fieldId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    const isSmall = size === 'sm'

    const trackClass = isSmall
        ? 'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900'
        : 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900'

    const thumbClass = isSmall
        ? `inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transform transition-transform ${
              checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`
        : `inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0.5'
          }`

    const button = (
        <button
            id={fieldId}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`${trackClass} ${
                checked
                    ? 'border-indigo-500/50 bg-indigo-600'
                    : 'border-zinc-700 bg-zinc-800'
            }`}
        >
            <span className={thumbClass} />
        </button>
    )

    // No visible label — render the button directly (no wrapping label element).
    if (!label) {
        return <span className={className}>{button}</span>
    }

    const labelText = (
        <span className={`text-xs text-zinc-300 ${disabled ? 'opacity-50' : ''}`}>
            {label}
        </span>
    )

    return (
        <label
            htmlFor={fieldId}
            className={`inline-flex items-center gap-2 select-none ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            } ${className}`}
        >
            {labelPosition === 'left' && labelText}
            {button}
            {labelPosition === 'right' && labelText}
        </label>
    )
}
