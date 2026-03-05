/**
 * ClassBuilder — src/components/inspector/ClassBuilder.tsx
 *
 * Breaks the selected node's `className` string into categorised sections
 * (Layout, Dimensions, Typography, Appearance) and renders a TokenSelect
 * dropdown for each.
 *
 * Reconstruction logic:
 *   1. Compute the full set of "managed" class names — any token × any section.
 *   2. Keep all classes from the existing string that are NOT in the managed set
 *      ("unmanaged": standard Tailwind classes the user typed manually).
 *   3. Carry forward the active selection from every OTHER section unchanged.
 *   4. Append the newly selected class (or skip if null / "none").
 *   5. Pass the joined result to `onCommit`.
 *
 * This ensures manually-written classes (e.g. `flex`, `font-bold`, `rounded-xl`)
 * survive unchanged while token-derived classes are cleanly swapped.
 */

import type { TokenType } from '../../types/bridge-api'
import { useTokenStore } from '../../store/tokenStore'
import { tokenToClass } from '../../utils/classMapper'
import { TokenSelect } from './TokenSelect'

// ── Section definitions ────────────────────────────────────────────────────────

interface SectionDef {
    label: string
    prefix: string
    tokenType: TokenType
    group: string
}

const SECTIONS: ReadonlyArray<SectionDef> = [
    // Layout
    { label: 'Padding', prefix: 'p-', tokenType: 'dimension', group: 'Layout' },
    { label: 'Margin', prefix: 'm-', tokenType: 'dimension', group: 'Layout' },
    // Dimensions
    { label: 'Width', prefix: 'w-', tokenType: 'dimension', group: 'Dimensions' },
    { label: 'Height', prefix: 'h-', tokenType: 'dimension', group: 'Dimensions' },
    // Typography
    { label: 'Text Color', prefix: 'text-', tokenType: 'color', group: 'Typography' },
    { label: 'Font Size', prefix: 'text-', tokenType: 'dimension', group: 'Typography' },
    { label: 'Font Family', prefix: 'font-', tokenType: 'fontFamily', group: 'Typography' },
    { label: 'Font Weight', prefix: 'font-', tokenType: 'fontWeight', group: 'Typography' },
    { label: 'Line Height', prefix: 'leading-', tokenType: 'lineHeight', group: 'Typography' },
    { label: 'Letter Spacing', prefix: 'tracking-', tokenType: 'letterSpacing', group: 'Typography' },
    // Appearance
    { label: 'Background', prefix: 'bg-', tokenType: 'color', group: 'Appearance' },
    { label: 'Border Color', prefix: 'border-', tokenType: 'color', group: 'Appearance' },
    { label: 'Border Radius', prefix: 'rounded-', tokenType: 'dimension', group: 'Appearance' },
    { label: 'Shadow', prefix: 'shadow-', tokenType: 'shadow', group: 'Appearance' },
    { label: 'Opacity', prefix: 'opacity-', tokenType: 'opacity', group: 'Appearance' },
]


const GROUP_ORDER = ['Layout', 'Dimensions', 'Typography', 'Appearance'] as const

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
    /** The full className string of the currently selected node. */
    className: string
    /** Called with the reconstructed className string when any dropdown changes. */
    onCommit: (newClassName: string) => void
}

export function ClassBuilder({ className, onCommit }: Props) {
    const tokens = useTokenStore((s) => s.tokens)

    /**
     * Computes the full set of Tailwind class names that ClassBuilder "owns" —
     * every possible (token × section) pair. Used to identify which classes in
     * `className` should be removed when rebuilding after a dropdown change.
     */
    function computeManaged(): Set<string> {
        const managed = new Set<string>()
        for (const section of SECTIONS) {
            for (const token of tokens.filter((t) => t.token_type === section.tokenType)) {
                managed.add(tokenToClass(token.token_path, token.token_type, section.prefix))
            }
        }
        return managed
    }

    /**
     * Returns the active Tailwind class for a section by checking which
     * token-derived class (for this section's prefix + type) appears in `className`.
     */
    function getActiveClass(section: SectionDef): string {
        const classList = new Set(className.split(' ').filter(Boolean))
        for (const token of tokens.filter((t) => t.token_type === section.tokenType)) {
            const cls = tokenToClass(token.token_path, token.token_type, section.prefix)
            if (classList.has(cls)) return cls
        }
        return ''
    }

    function handleChange(changedSection: SectionDef, newCls: string | null): void {
        const managed = computeManaged()

        // Classes the user wrote manually (not derivable from any token × section).
        const unmanaged = className
            .split(' ')
            .filter((c) => c !== '' && !managed.has(c))

        // Active selections from every other section — carry them forward.
        const otherActives = SECTIONS.filter((s) => s !== changedSection)
            .map((s) => getActiveClass(s))
            .filter((c) => c !== '')

        const parts = [...unmanaged, ...otherActives]
        if (newCls !== null) parts.push(newCls)

        onCommit(parts.join(' '))
    }

    if (tokens.length === 0) {
        return (
            <div className="px-3 py-4 text-center text-[11px] text-gray-600">
                No tokens loaded — add tokens in the Token Manager panel.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 px-3 py-3">
            {GROUP_ORDER.map((group) => {
                const sections = SECTIONS.filter((s) => s.group === group)
                // Only render the group if at least one section has tokens of its type.
                const hasTokens = sections.some((s) =>
                    tokens.some((t) => t.token_type === s.tokenType)
                )
                if (!hasTokens) return null

                return (
                    <div key={group} className="flex flex-col gap-1">
                        <span className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                            {group}
                        </span>
                        {sections.map((section) => (
                            <TokenSelect
                                key={`${section.prefix}-${section.tokenType}`}
                                label={section.label}
                                tokenType={section.tokenType}
                                classPrefix={section.prefix}
                                value={getActiveClass(section)}
                                onChange={(cls) => handleChange(section, cls)}
                            />
                        ))}
                    </div>
                )
            })}
        </div>
    )
}
