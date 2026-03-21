/**
 * TokenSelect — src/components/inspector/TokenSelect.tsx
 *
 * A labelled `<select>` dropdown that lists design tokens of a given type and
 * maps the selected token to its Tailwind class name (classPrefix + token path).
 *
 * Path normalisation and class derivation are delegated to src/utils/classMapper.ts.
 */

import type { TokenType } from '../../types/flint-api'
import { useTokenStore } from '../../store/tokenStore'
import { normalizePath, tokenToClass } from '../../utils/classMapper'

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
    label: string
    tokenType: TokenType
    classPrefix: string
    /** Active Tailwind class for this row (e.g. 'bg-brand-primary'), or '' for none. */
    value: string
    onChange: (cls: string | null) => void
}

export function TokenSelect({
    label,
    tokenType,
    classPrefix,
    value,
    onChange,
}: Props) {
    const tokens = useTokenStore((s) => s.tokens)
    const filtered = tokens.filter((t) => t.token_type === tokenType)

    // Token whose derived class matches the current value — used for the swatch.
    const activeToken = filtered.find(
        (t) => tokenToClass(t.token_path, t.token_type, classPrefix) === value
    )

    return (
        <div className="flex items-center gap-2 py-0.5">
            {/* Visual indicator — colored swatch for colors, thin bar for dimensions */}
            {tokenType === 'color' ? (
                <div
                    className="h-3 w-3 shrink-0 rounded-full border border-gray-600"
                    style={{
                        backgroundColor: activeToken?.token_value ?? '#374151',
                    }}
                />
            ) : (
                <div className="h-0.5 w-3 shrink-0 rounded-full bg-gray-600" />
            )}

            <span className="w-20 shrink-0 text-[11px] text-gray-500">{label}</span>

            <select
                value={value === '' ? '__none__' : value}
                onChange={(e) => {
                    const v = e.target.value
                    onChange(v === '__none__' ? null : v)
                }}
                className="flex-1 appearance-none rounded border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[11px] text-gray-200 outline-none focus:border-indigo-500"
            >
                <option value="__none__">— none —</option>
                {filtered.map((token) => {
                    const cls = tokenToClass(
                        token.token_path,
                        token.token_type,
                        classPrefix
                    )
                    const display = normalizePath(token.token_path, token.token_type)
                    return (
                        <option key={token.id} value={cls}>
                            {display} ({token.token_value})
                        </option>
                    )
                })}
            </select>
        </div>
    )
}
