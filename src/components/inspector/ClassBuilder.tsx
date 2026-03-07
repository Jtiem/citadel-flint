import type { TokenType } from '../../types/bridge-api'
import { useTokenStore } from '../../store/tokenStore'
import { normalizePath, tokenToClass } from '../../utils/classMapper'
import { Accordion, CompactSelect, ColorPickerSwatch } from './primitives'

// ── Section definitions ────────────────────────────────────────────────────────

interface SectionDef {
    prefix: string
    tokenType: TokenType
}

const SECTIONS: Record<string, SectionDef> = {
    // Typography
    textColor: { prefix: 'text-', tokenType: 'color' },
    fontSize: { prefix: 'text-', tokenType: 'dimension' },
    fontFamily: { prefix: 'font-', tokenType: 'fontFamily' },
    fontWeight: { prefix: 'font-', tokenType: 'fontWeight' },
    lineHeight: { prefix: 'leading-', tokenType: 'lineHeight' },
    letterSpacing: { prefix: 'tracking-', tokenType: 'letterSpacing' },
    // Fill
    background: { prefix: 'bg-', tokenType: 'color' },
    // Stroke
    borderColor: { prefix: 'border-', tokenType: 'color' },
    borderRadius: { prefix: 'rounded-', tokenType: 'dimension' },
    // Effects
    shadow: { prefix: 'shadow-', tokenType: 'shadow' },
    opacity: { prefix: 'opacity-', tokenType: 'opacity' },
}

interface Props {
    className: string
    onCommit: (newClassName: string) => void
}

export function ClassBuilder({ className, onCommit }: Props) {
    const tokens = useTokenStore((s) => s.tokens)

    function computeManaged(): Set<string> {
        const managed = new Set<string>()
        for (const key of Object.keys(SECTIONS)) {
            const section = SECTIONS[key]
            for (const token of tokens.filter((t) => t.token_type === section.tokenType)) {
                managed.add(tokenToClass(token.token_path, token.token_type, section.prefix))
            }
        }
        return managed
    }

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

        const unmanaged = className
            .split(' ')
            .filter((c) => c !== '' && !managed.has(c))

        const otherActives = Object.values(SECTIONS)
            .filter((s) => s !== changedSection)
            .map((s) => getActiveClass(s))
            .filter((c) => c !== '')

        const parts = [...unmanaged, ...otherActives]
        if (newCls !== null && newCls !== '__none__') parts.push(newCls)

        onCommit(parts.join(' '))
    }

    // Helper to generate options for CompactSelect
    function getOptionsFor(sectionKey: keyof typeof SECTIONS) {
        const section = SECTIONS[sectionKey]
        return tokens
            .filter(t => t.token_type === section.tokenType)
            .map(t => ({
                label: normalizePath(t.token_path, t.token_type),
                value: tokenToClass(t.token_path, t.token_type, section.prefix)
            }))
    }

    // Helper to generate options for ColorPickerSwatch
    function getColorOptionsFor(sectionKey: keyof typeof SECTIONS) {
        const section = SECTIONS[sectionKey]
        return tokens
            .filter(t => t.token_type === section.tokenType)
            .map(t => ({
                id: t.id,
                label: normalizePath(t.token_path, t.token_type),
                value: tokenToClass(t.token_path, t.token_type, section.prefix),
                hex: String(t.token_value)
            }))
    }

    function getColorActive(sectionKey: keyof typeof SECTIONS) {
        const section = SECTIONS[sectionKey]
        const activeCls = getActiveClass(section)
        const opts = getColorOptionsFor(sectionKey)
        const found = opts.find(o => o.value === activeCls)
        return {
            colorHex: found?.hex || '',
            display: found ? `${found.label}` : ''
        }
    }

    if (tokens.length === 0) {
        return (
            <div className="px-3 py-4 text-center text-[11px] text-gray-600">
                No tokens loaded — add tokens in the Token Manager panel.
            </div>
        )
    }

    const txtColorActive = getColorActive('textColor')
    const bgColorActive = getColorActive('background')
    const brdColorActive = getColorActive('borderColor')

    // Check if sections have active values for headerRight
    const hasTypography = Object.values(SECTIONS).slice(0, 6).some(s => getActiveClass(s) !== '')
    const hasFill = getActiveClass(SECTIONS.background) !== ''
    const hasStroke = getActiveClass(SECTIONS.borderColor) !== '' || getActiveClass(SECTIONS.borderRadius) !== ''
    const hasEffects = getActiveClass(SECTIONS.shadow) !== '' || getActiveClass(SECTIONS.opacity) !== ''

    return (
        <div className="flex flex-col">
            <Accordion title="Typography" defaultOpen={hasTypography}>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0" title="Font Family">
                            <CompactSelect
                                value={getActiveClass(SECTIONS.fontFamily)}
                                onChange={(val) => handleChange(SECTIONS.fontFamily, val)}
                                options={getOptionsFor('fontFamily')}
                            />
                        </div>
                        <div className="flex-1 min-w-0" title="Font Weight">
                            <CompactSelect
                                value={getActiveClass(SECTIONS.fontWeight)}
                                onChange={(val) => handleChange(SECTIONS.fontWeight, val)}
                                options={getOptionsFor('fontWeight')}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0" title="Font Size">
                            <CompactSelect
                                value={getActiveClass(SECTIONS.fontSize)}
                                onChange={(val) => handleChange(SECTIONS.fontSize, val)}
                                options={getOptionsFor('fontSize')}
                            />
                        </div>
                        <div className="flex-1 min-w-0" title="Line Height">
                            <CompactSelect
                                value={getActiveClass(SECTIONS.lineHeight)}
                                onChange={(val) => handleChange(SECTIONS.lineHeight, val)}
                                options={getOptionsFor('lineHeight')}
                            />
                        </div>
                    </div>
                    <div title="Text Color">
                        <ColorPickerSwatch
                            colorHex={txtColorActive.colorHex}
                            activeTokenDisplay={txtColorActive.display}
                            options={getColorOptionsFor('textColor')}
                            onSelect={(val) => handleChange(SECTIONS.textColor, val)}
                        />
                    </div>
                </div>
            </Accordion>

            <Accordion title="Fill" defaultOpen={hasFill} headerRight={
                bgColorActive.colorHex && <div className="h-3 w-3 rounded-full border border-gray-600" style={{ backgroundColor: bgColorActive.colorHex }} />
            }>
                <ColorPickerSwatch
                    colorHex={bgColorActive.colorHex}
                    activeTokenDisplay={bgColorActive.display}
                    options={getColorOptionsFor('background')}
                    onSelect={(val) => handleChange(SECTIONS.background, val)}
                />
            </Accordion>

            <Accordion title="Stroke" defaultOpen={hasStroke} headerRight={
                brdColorActive.colorHex && <div className="h-3 w-3 rounded-full border border-gray-600" style={{ backgroundColor: brdColorActive.colorHex }} />
            }>
                <div className="flex flex-col gap-2">
                    <ColorPickerSwatch
                        colorHex={brdColorActive.colorHex}
                        activeTokenDisplay={brdColorActive.display}
                        options={getColorOptionsFor('borderColor')}
                        onSelect={(val) => handleChange(SECTIONS.borderColor, val)}
                    />
                    <div className="flex gap-2 items-center">
                        <span className="w-16 shrink-0 text-[10px] text-gray-500">Radius</span>
                        <div className="flex-1 min-w-0">
                            <CompactSelect
                                value={getActiveClass(SECTIONS.borderRadius)}
                                onChange={(val) => handleChange(SECTIONS.borderRadius, val)}
                                options={getOptionsFor('borderRadius')}
                            />
                        </div>
                    </div>
                </div>
            </Accordion>

            <Accordion title="Effects" defaultOpen={hasEffects}>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                        <span className="w-16 shrink-0 text-[10px] text-gray-500">Shadow</span>
                        <div className="flex-1 min-w-0">
                            <CompactSelect
                                value={getActiveClass(SECTIONS.shadow)}
                                onChange={(val) => handleChange(SECTIONS.shadow, val)}
                                options={getOptionsFor('shadow')}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="w-16 shrink-0 text-[10px] text-gray-500">Opacity</span>
                        <div className="flex-1 min-w-0">
                            <CompactSelect
                                value={getActiveClass(SECTIONS.opacity)}
                                onChange={(val) => handleChange(SECTIONS.opacity, val)}
                                options={getOptionsFor('opacity')}
                            />
                        </div>
                    </div>
                </div>
            </Accordion>
        </div>
    )
}
