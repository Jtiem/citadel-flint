// ---------------------------------------------------------------------------
// HydroPaste Library Code Emitters — flint-mcp/src/core/hydroPaste-emitters.ts
//
// Each emitter translates Figma node types into library-idiomatic JSX.
// All emitters are pure — no I/O, no imports from adapter internals.
// ---------------------------------------------------------------------------

import { type LabTokenEntry, findNearestToken } from './colorDistance.js'

/**
 * Contract for a library-aware JSX code emitter.
 * Each method receives pre-resolved context and returns a JSX string fragment.
 */
export interface LibraryCodeEmitter {
    /** Map a Figma FRAME node to a library container component. */
    wrapContainer(className: string, children: string, depth: number): string
    /** Map a Figma TEXT node to a library text component. */
    emitText(text: string, colorClass: string, depth: number): string
    /** Map a Figma COMPONENT or INSTANCE node to a library component. */
    emitComponent(name: string, props: Record<string, string>, children: string, depth: number): string
    /**
     * Emit a semantic heading element.
     * colorClass is a fully-prefixed Tailwind class (e.g. "text-foreground").
     */
    emitHeading(text: string, colorClass: string, depth: number): string
    /** Return all required import statements for components emitted so far. */
    getImports(): string[]
    /**
     * Resolve a hex color to a library-idiomatic class or prop value.
     * labTokens enables fuzzy CIEDE2000 matching when exact hex lookup fails.
     */
    resolveColor(
        hex: string,
        tokenLookup: Map<string, string>,
        labTokens: Array<LabTokenEntry>,
        tokenMappings: Record<string, string>,
    ): string
}

// ---------------------------------------------------------------------------
// shadcn/ui emitter
// Uses Card/CardContent for containers, Typography-style text, semantic CSS vars
// ---------------------------------------------------------------------------

export class ShadcnEmitter implements LibraryCodeEmitter {
    private readonly usedComponents = new Set<string>()

    wrapContainer(className: string, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add('Card')
        this.usedComponents.add('CardContent')
        if (!children.trim()) {
            return `${indent}<Card className="${className}" />`
        }
        return [
            `${indent}<Card className="${className}">`,
            `${indent}  <CardContent>`,
            children,
            `${indent}  </CardContent>`,
            `${indent}</Card>`,
        ].join('\n')
    }

    emitText(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const cls = colorClass ? ` className="${colorClass}"` : ''
        return `${indent}<p${cls}>${text}</p>`
    }

    emitHeading(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const cls = ['text-2xl', 'font-bold', colorClass].filter(Boolean).join(' ')
        return `${indent}<h2 className="${cls}">${text}</h2>`
    }

    emitComponent(name: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add(name)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        if (!children.trim()) {
            return `${indent}<${name}${propStr} />`
        }
        return [
            `${indent}<${name}${propStr}>`,
            children,
            `${indent}</${name}>`,
        ].join('\n')
    }

    getImports(): string[] {
        const imports: string[] = []
        const uiComponents = [...this.usedComponents].filter(c =>
            ['Card', 'CardContent', 'CardHeader', 'CardTitle', 'Button'].includes(c)
        )
        if (uiComponents.length > 0) {
            // Group shadcn imports by file
            const cardComps = uiComponents.filter(c => c.startsWith('Card'))
            const buttonComps = uiComponents.filter(c => c === 'Button')
            if (cardComps.length > 0) {
                imports.push(`import { ${cardComps.join(', ')} } from "@/components/ui/card"`)
            }
            if (buttonComps.length > 0) {
                imports.push(`import { Button } from "@/components/ui/button"`)
            }
        }
        return imports
    }

    resolveColor(
        hex: string,
        tokenLookup: Map<string, string>,
        labTokens: Array<LabTokenEntry>,
        tokenMappings: Record<string, string>,
    ): string {
        const match = findNearestToken(hex, tokenLookup, labTokens)
        if (match) {
            tokenMappings[hex.toUpperCase()] = match.className
            return match.className
        }
        // Shadcn semantic fallback — use background token without prefix (caller applies bg-/text-)
        return 'background'
    }
}

// ---------------------------------------------------------------------------
// MUI emitter
// Uses Box/Stack for layout, Typography for text, sx prop for theming
// ---------------------------------------------------------------------------

export class MuiEmitter implements LibraryCodeEmitter {
    private readonly usedComponents = new Set<string>()

    wrapContainer(className: string, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add('Box')
        // Convert className to an sx comment — MUI uses sx prop not className
        const sxHint = className ? ` /* ${className} */` : ''
        if (!children.trim()) {
            return `${indent}<Box sx={{ display: 'flex', flexDirection: 'column' }}${sxHint} />`
        }
        return [
            `${indent}<Box sx={{ display: 'flex', flexDirection: 'column' }}${sxHint}>`,
            children,
            `${indent}</Box>`,
        ].join('\n')
    }

    emitText(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add('Typography')
        const sxHint = colorClass ? ` sx={{ color: 'text.primary' }} /* ${colorClass} */` : ''
        return `${indent}<Typography variant="body1"${sxHint}>${text}</Typography>`
    }

    emitHeading(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add('Typography')
        const sxHint = colorClass ? ` sx={{ color: 'text.primary' }} /* ${colorClass} */` : ''
        return `${indent}<Typography variant="h5"${sxHint}>${text}</Typography>`
    }

    emitComponent(name: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add(name)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        if (!children.trim()) {
            return `${indent}<${name}${propStr} />`
        }
        return [
            `${indent}<${name}${propStr}>`,
            children,
            `${indent}</${name}>`,
        ].join('\n')
    }

    getImports(): string[] {
        const muiCore = [...this.usedComponents].filter(c =>
            ['Box', 'Stack', 'Typography', 'Paper', 'Button'].includes(c)
        )
        if (muiCore.length === 0) return []
        return [`import { ${muiCore.join(', ')} } from "@mui/material"`]
    }

    resolveColor(
        hex: string,
        tokenLookup: Map<string, string>,
        labTokens: Array<LabTokenEntry>,
        tokenMappings: Record<string, string>,
    ): string {
        const match = findNearestToken(hex, tokenLookup, labTokens)
        if (match) {
            tokenMappings[hex.toUpperCase()] = match.className
            return match.className
        }
        // MUI uses theme palette references via sx — return a placeholder class
        // Bare fallback — caller applies bg-/text- prefix based on role
        return '[var(--mui-palette-background-default)]'
    }
}

// ---------------------------------------------------------------------------
// PrimeReact emitter
// Uses Card/Panel for containers, Button for actions, PrimeTek variables
// ---------------------------------------------------------------------------

export class PrimeEmitter implements LibraryCodeEmitter {
    private readonly usedComponents = new Set<string>()

    wrapContainer(className: string, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add('Card')
        const titleAttr = className ? ` title=""` : ''
        if (!children.trim()) {
            return `${indent}<Card${titleAttr} className="${className}" />`
        }
        return [
            `${indent}<Card${titleAttr} className="${className}">`,
            children,
            `${indent}</Card>`,
        ].join('\n')
    }

    emitText(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const cls = colorClass ? ` className="${colorClass}"` : ''
        return `${indent}<p${cls}>${text}</p>`
    }

    emitHeading(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const cls = colorClass ? ` className="${colorClass}"` : ''
        return `${indent}<h2${cls}>${text}</h2>`
    }

    emitComponent(name: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        this.usedComponents.add(name)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        if (!children.trim()) {
            return `${indent}<${name}${propStr} />`
        }
        return [
            `${indent}<${name}${propStr}>`,
            children,
            `${indent}</${name}>`,
        ].join('\n')
    }

    getImports(): string[] {
        const imports: string[] = []
        if (this.usedComponents.has('Card')) {
            imports.push(`import { Card } from "primereact/card"`)
        }
        if (this.usedComponents.has('Button')) {
            imports.push(`import { Button } from "primereact/button"`)
        }
        if (this.usedComponents.has('Panel')) {
            imports.push(`import { Panel } from "primereact/panel"`)
        }
        return imports
    }

    resolveColor(
        hex: string,
        tokenLookup: Map<string, string>,
        labTokens: Array<LabTokenEntry>,
        tokenMappings: Record<string, string>,
    ): string {
        const match = findNearestToken(hex, tokenLookup, labTokens)
        if (match) {
            tokenMappings[hex.toUpperCase()] = match.className
            return match.className
        }
        // PrimeTek uses CSS variable-based surface tokens
        // Bare fallback — caller applies bg-/text- prefix based on role
        return '[var(--p-surface-0)]'
    }
}

// ---------------------------------------------------------------------------
// Tailwind emitter (enhanced)
// Same structure as generic path but uses token-derived custom classes,
// avoids arbitrary values when a token mapping is available.
// ---------------------------------------------------------------------------

export class TailwindLibEmitter implements LibraryCodeEmitter {
    wrapContainer(className: string, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        if (!children.trim()) {
            return `${indent}<div className="${className}" />`
        }
        return [
            `${indent}<div className="${className}">`,
            children,
            `${indent}</div>`,
        ].join('\n')
    }

    emitText(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const cls = colorClass ? ` text-base ${colorClass}` : 'text-base'
        return `${indent}<p className="${cls}">${text}</p>`
    }

    emitHeading(text: string, colorClass: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const cls = ['text-2xl', 'font-bold', colorClass].filter(Boolean).join(' ')
        return `${indent}<h2 className="${cls}">${text}</h2>`
    }

    emitComponent(name: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        if (!children.trim()) {
            return `${indent}<${name}${propStr} />`
        }
        return [
            `${indent}<${name}${propStr}>`,
            children,
            `${indent}</${name}>`,
        ].join('\n')
    }

    getImports(): string[] {
        // Tailwind needs no component imports — it's utility-only
        return []
    }

    resolveColor(
        hex: string,
        tokenLookup: Map<string, string>,
        labTokens: Array<LabTokenEntry>,
        tokenMappings: Record<string, string>,
    ): string {
        const match = findNearestToken(hex, tokenLookup, labTokens)
        if (match) {
            tokenMappings[hex.toUpperCase()] = match.className
            return match.className
        }
        // Arbitrary fallback — will be flagged by Mithril audit (intentional:
        // tokens should be imported for this color before shipping)
        return `[${hex}]`
    }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Known library keys mapped to their emitter factory.
 * Keys match the LibraryTarget values in the adapter registry (single source of truth).
 */
const EMITTER_MAP: Record<string, () => LibraryCodeEmitter> = {
    shadcn:   () => new ShadcnEmitter(),
    mui:      () => new MuiEmitter(),
    primeng:  () => new PrimeEmitter(),
    tailwind: () => new TailwindLibEmitter(),
}

/**
 * Get a code emitter for the given library key.
 * Returns null when the library is unknown — the caller should fall back to
 * the generic (no-library) JSX path.
 */
export function getEmitterForLibrary(library: string): LibraryCodeEmitter | null {
    const factory = EMITTER_MAP[library.toLowerCase()]
    return factory ? factory() : null
}
