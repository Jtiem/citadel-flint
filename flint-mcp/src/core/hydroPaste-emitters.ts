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
    /**
     * Map a Figma FRAME node to a library container component.
     * The optional `element` param overrides the default wrapper element type.
     * Supported values: 'div' | 'form' | 'nav' | 'section' | 'main' | 'article' | 'header' | 'footer'
     * Defaults to 'div' (or the library's default container) when omitted.
     */
    wrapContainer(className: string, children: string, depth: number, element?: 'div' | 'form' | 'nav' | 'section' | 'main' | 'article' | 'header' | 'footer'): string
    /** Map a Figma TEXT node to a library text component. */
    emitText(text: string, colorClass: string, depth: number): string
    /** Map a Figma COMPONENT or INSTANCE node to a library component. */
    emitComponent(name: string, props: Record<string, string>, children: string, depth: number): string
    /**
     * Emit a semantic heading element.
     * colorClass is a fully-prefixed Tailwind class (e.g. "text-foreground").
     */
    emitHeading(text: string, colorClass: string, depth: number): string
    /**
     * Emit a recognized semantic component type (Input, Select, Textarea, etc.)
     * with library-idiomatic markup.
     * componentType is a value from the ComponentType union produced by classifyComponent.
     */
    emitNamedComponent(
        componentType: string,
        props: Record<string, string>,
        children: string,
        depth: number,
    ): string
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

    wrapContainer(className: string, children: string, depth: number, element?: 'div' | 'form' | 'nav' | 'section' | 'main' | 'article' | 'header' | 'footer'): string {
        const indent = '  '.repeat(depth)
        // Semantic HTML elements bypass the Card wrapper and emit native elements.
        // This ensures a Figma "ContactForm" frame becomes <form>, not <Card>.
        if (element && element !== 'div') {
            if (!children.trim()) {
                return `${indent}<${element} className="${className}" />`
            }
            return [
                `${indent}<${element} className="${className}">`,
                children,
                `${indent}</${element}>`,
            ].join('\n')
        }
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

    emitNamedComponent(componentType: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        switch (componentType.toLowerCase()) {
            case 'input':
                this.usedComponents.add('Input')
                return `${indent}<Input${propStr} />`
            case 'textarea':
                this.usedComponents.add('Textarea')
                return `${indent}<Textarea${propStr}>${children}</Textarea>`
            case 'select':
                this.usedComponents.add('Select')
                this.usedComponents.add('SelectTrigger')
                this.usedComponents.add('SelectContent')
                return [
                    `${indent}<Select${propStr}>`,
                    `${indent}  <SelectTrigger />`,
                    `${indent}  <SelectContent>${children}</SelectContent>`,
                    `${indent}</Select>`,
                ].join('\n')
            case 'checkbox':
                this.usedComponents.add('Checkbox')
                return `${indent}<Checkbox${propStr} />`
            case 'switch':
                this.usedComponents.add('Switch')
                return `${indent}<Switch${propStr} />`
            case 'avatar':
                this.usedComponents.add('Avatar')
                this.usedComponents.add('AvatarImage')
                this.usedComponents.add('AvatarFallback')
                return [
                    `${indent}<Avatar${propStr}>`,
                    `${indent}  <AvatarImage />`,
                    `${indent}  <AvatarFallback />`,
                    `${indent}</Avatar>`,
                ].join('\n')
            case 'badge':
                this.usedComponents.add('Badge')
                return `${indent}<Badge${propStr}>${children}</Badge>`
            case 'tabs':
                this.usedComponents.add('Tabs')
                this.usedComponents.add('TabsList')
                this.usedComponents.add('TabsTrigger')
                return [
                    `${indent}<Tabs${propStr}>`,
                    `${indent}  <TabsList>`,
                    `${indent}    <TabsTrigger value="">${children}</TabsTrigger>`,
                    `${indent}  </TabsList>`,
                    `${indent}</Tabs>`,
                ].join('\n')
            case 'separator':
                this.usedComponents.add('Separator')
                return `${indent}<Separator${propStr} />`
            case 'alert':
                this.usedComponents.add('Alert')
                this.usedComponents.add('AlertDescription')
                return [
                    `${indent}<Alert${propStr}>`,
                    `${indent}  <AlertDescription>${children}</AlertDescription>`,
                    `${indent}</Alert>`,
                ].join('\n')
            default:
                // Unknown component type — fall back to generic emitComponent
                return this.emitComponent(componentType, props, children, depth)
        }
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
        const used = this.usedComponents

        // Group shadcn imports by their source file
        const cardComps = [...used].filter(c => ['Card', 'CardContent', 'CardHeader', 'CardTitle'].includes(c))
        if (cardComps.length > 0) imports.push(`import { ${cardComps.join(', ')} } from "@/components/ui/card"`)

        if (used.has('Button')) imports.push(`import { Button } from "@/components/ui/button"`)
        if (used.has('Input')) imports.push(`import { Input } from "@/components/ui/input"`)
        if (used.has('Textarea')) imports.push(`import { Textarea } from "@/components/ui/textarea"`)

        const selectComps = [...used].filter(c => ['Select', 'SelectTrigger', 'SelectContent', 'SelectItem'].includes(c))
        if (selectComps.length > 0) imports.push(`import { ${selectComps.join(', ')} } from "@/components/ui/select"`)

        if (used.has('Checkbox')) imports.push(`import { Checkbox } from "@/components/ui/checkbox"`)
        if (used.has('Switch')) imports.push(`import { Switch } from "@/components/ui/switch"`)

        const avatarComps = [...used].filter(c => ['Avatar', 'AvatarImage', 'AvatarFallback'].includes(c))
        if (avatarComps.length > 0) imports.push(`import { ${avatarComps.join(', ')} } from "@/components/ui/avatar"`)

        if (used.has('Badge')) imports.push(`import { Badge } from "@/components/ui/badge"`)

        const tabsComps = [...used].filter(c => ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'].includes(c))
        if (tabsComps.length > 0) imports.push(`import { ${tabsComps.join(', ')} } from "@/components/ui/tabs"`)

        if (used.has('Separator')) imports.push(`import { Separator } from "@/components/ui/separator"`)

        const alertComps = [...used].filter(c => ['Alert', 'AlertDescription', 'AlertTitle'].includes(c))
        if (alertComps.length > 0) imports.push(`import { ${alertComps.join(', ')} } from "@/components/ui/alert"`)

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

    wrapContainer(className: string, children: string, depth: number, element?: 'div' | 'form' | 'nav' | 'section' | 'main' | 'article' | 'header' | 'footer'): string {
        const indent = '  '.repeat(depth)
        // Semantic HTML elements emit as MUI Box with the `component` prop override
        if (element && element !== 'div') {
            this.usedComponents.add('Box')
            const sxHint = className ? ` /* ${className} */` : ''
            if (!children.trim()) {
                return `${indent}<Box component="${element}" sx={{ display: 'flex', flexDirection: 'column' }}${sxHint} />`
            }
            return [
                `${indent}<Box component="${element}" sx={{ display: 'flex', flexDirection: 'column' }}${sxHint}>`,
                children,
                `${indent}</Box>`,
            ].join('\n')
        }
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

    emitNamedComponent(componentType: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        switch (componentType.toLowerCase()) {
            case 'input':
                this.usedComponents.add('TextField')
                return `${indent}<TextField${propStr} />`
            case 'textarea':
                this.usedComponents.add('TextField')
                return `${indent}<TextField multiline${propStr} />`
            case 'select':
                this.usedComponents.add('Select')
                return `${indent}<Select${propStr}>${children}</Select>`
            case 'checkbox':
                this.usedComponents.add('Checkbox')
                return `${indent}<Checkbox${propStr} />`
            case 'switch':
                this.usedComponents.add('Switch')
                return `${indent}<Switch${propStr} />`
            case 'avatar':
                this.usedComponents.add('Avatar')
                return `${indent}<Avatar${propStr} />`
            case 'badge':
                this.usedComponents.add('Chip')
                return `${indent}<Chip${propStr} />`
            case 'tabs':
                this.usedComponents.add('Tabs')
                this.usedComponents.add('Tab')
                return [
                    `${indent}<Tabs${propStr}>`,
                    `${indent}  <Tab label="${children || 'Tab'}" />`,
                    `${indent}</Tabs>`,
                ].join('\n')
            case 'separator':
                this.usedComponents.add('Divider')
                return `${indent}<Divider${propStr} />`
            case 'alert':
                this.usedComponents.add('Alert')
                return `${indent}<Alert${propStr}>${children}</Alert>`
            default:
                return this.emitComponent(componentType, props, children, depth)
        }
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
        const knownMuiComponents = new Set([
            'Box', 'Stack', 'Typography', 'Paper', 'Button',
            'TextField', 'Select', 'Checkbox', 'Switch',
            'Avatar', 'Chip', 'Tabs', 'Tab', 'Divider', 'Alert',
        ])
        const muiCore = [...this.usedComponents].filter(c => knownMuiComponents.has(c))
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

    wrapContainer(className: string, children: string, depth: number, element?: 'div' | 'form' | 'nav' | 'section' | 'main' | 'article' | 'header' | 'footer'): string {
        const indent = '  '.repeat(depth)
        // Semantic HTML elements bypass the Card wrapper and emit native elements
        if (element && element !== 'div') {
            if (!children.trim()) {
                return `${indent}<${element} className="${className}" />`
            }
            return [
                `${indent}<${element} className="${className}">`,
                children,
                `${indent}</${element}>`,
            ].join('\n')
        }
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

    emitNamedComponent(componentType: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        switch (componentType.toLowerCase()) {
            case 'input':
                this.usedComponents.add('InputText')
                return `${indent}<InputText${propStr} />`
            case 'textarea':
                this.usedComponents.add('InputTextarea')
                return `${indent}<InputTextarea${propStr} />`
            case 'select':
                this.usedComponents.add('Dropdown')
                return `${indent}<Dropdown${propStr} />`
            case 'checkbox':
                this.usedComponents.add('Checkbox')
                return `${indent}<Checkbox${propStr} />`
            case 'switch':
                this.usedComponents.add('InputSwitch')
                return `${indent}<InputSwitch${propStr} />`
            case 'avatar':
                this.usedComponents.add('Avatar')
                return `${indent}<Avatar${propStr} />`
            case 'badge':
                this.usedComponents.add('Badge')
                return `${indent}<Badge${propStr} />`
            case 'tabs':
                this.usedComponents.add('TabView')
                this.usedComponents.add('TabPanel')
                return [
                    `${indent}<TabView${propStr}>`,
                    `${indent}  <TabPanel header="${children || 'Tab'}" />`,
                    `${indent}</TabView>`,
                ].join('\n')
            case 'separator':
                this.usedComponents.add('Divider')
                return `${indent}<Divider${propStr} />`
            case 'alert':
                this.usedComponents.add('Message')
                return `${indent}<Message${propStr} />`
            default:
                return this.emitComponent(componentType, props, children, depth)
        }
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
        const used = this.usedComponents

        if (used.has('Card')) imports.push(`import { Card } from "primereact/card"`)
        if (used.has('Button')) imports.push(`import { Button } from "primereact/button"`)
        if (used.has('Panel')) imports.push(`import { Panel } from "primereact/panel"`)
        if (used.has('InputText')) imports.push(`import { InputText } from "primereact/inputtext"`)
        if (used.has('InputTextarea')) imports.push(`import { InputTextarea } from "primereact/inputtextarea"`)
        if (used.has('Dropdown')) imports.push(`import { Dropdown } from "primereact/dropdown"`)
        if (used.has('Checkbox')) imports.push(`import { Checkbox } from "primereact/checkbox"`)
        if (used.has('InputSwitch')) imports.push(`import { InputSwitch } from "primereact/inputswitch"`)
        if (used.has('Avatar')) imports.push(`import { Avatar } from "primereact/avatar"`)
        if (used.has('Badge')) imports.push(`import { Badge } from "primereact/badge"`)
        if (used.has('TabView') || used.has('TabPanel')) {
            imports.push(`import { TabView, TabPanel } from "primereact/tabview"`)
        }
        if (used.has('Divider')) imports.push(`import { Divider } from "primereact/divider"`)
        if (used.has('Message')) imports.push(`import { Message } from "primereact/message"`)

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
    wrapContainer(className: string, children: string, depth: number, element?: 'div' | 'form' | 'nav' | 'section' | 'main' | 'article' | 'header' | 'footer'): string {
        const indent = '  '.repeat(depth)
        const tag = element ?? 'div'
        if (!children.trim()) {
            return `${indent}<${tag} className="${className}" />`
        }
        return [
            `${indent}<${tag} className="${className}">`,
            children,
            `${indent}</${tag}>`,
        ].join('\n')
    }

    emitNamedComponent(componentType: string, props: Record<string, string>, children: string, depth: number): string {
        const indent = '  '.repeat(depth)
        const propStr = Object.entries(props)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('')
        switch (componentType.toLowerCase()) {
            case 'input':
                return `${indent}<input${propStr} />`
            case 'textarea':
                return `${indent}<textarea${propStr}>${children}</textarea>`
            case 'select':
                return `${indent}<select${propStr}>${children}</select>`
            case 'checkbox':
                return `${indent}<input type="checkbox"${propStr} />`
            case 'switch':
                return `${indent}<input type="checkbox" role="switch"${propStr} />`
            case 'avatar':
                return `${indent}<div className="avatar"${propStr}>${children}</div>`
            case 'badge':
                return `${indent}<span className="badge"${propStr}>${children}</span>`
            case 'tabs':
                return `${indent}<div role="tablist"${propStr}>${children}</div>`
            case 'separator':
                return `${indent}<hr${propStr} />`
            case 'alert':
                return `${indent}<div role="alert"${propStr}>${children}</div>`
            default:
                return this.emitComponent(componentType, props, children, depth)
        }
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
