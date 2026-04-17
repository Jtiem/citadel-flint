/**
 * flint_set_library MCP tool — flint-mcp/src/tools/setLibrary.ts
 *
 * Phase LIB.1: Sets the active component library for a project.
 * Writes selectedLibrary to .flint/policy.json and seeds base tokens.
 *
 * Supports two modes:
 *   - Explicit: library="shadcn" → set and seed
 *   - Auto-detect: library="auto" → detect from existing tokens
 *
 * Registration: imported by server.ts and wired into ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 */

import fs from 'node:fs'
import path from 'node:path'
import { toolName, configPath } from '../brand.js'
import {
    getAdapter,
    getAvailableLibraries,
    getAdapterCatalog,
    hasAdapter,
    detectLibraryFromTokens,
} from '../core/libraryAdapters/index.js'
import type { LibraryTarget } from '../core/libraryAdapters/types.js'
import type { DesignToken } from '../types.js'
import type { ComponentEntry } from '../core/registryService.js'

// ---------------------------------------------------------------------------
// ARM.1: library component manifests (hardcoded per-library component lists)
// ---------------------------------------------------------------------------
//
// Each library contributes a canonical set of primitives that Mason generates
// from and that REG-001 trusts. Source: 'library' entries are seeded into
// flint-manifest.json under libraryComponents, never overwriting source:'local'
// entries. Kept inline here (not on the LibraryAdapter interface) so the
// CHRON.1-repair sprint doesn't have to widen the adapter contract.

function libEntry(name: string, importPath: string, description: string): ComponentEntry {
    return { name, importPath, source: 'library', description }
}

const LIBRARY_COMPONENT_MANIFESTS: Record<LibraryTarget, ComponentEntry[]> = {
    mui: [
        libEntry('Box', '@mui/material/Box', 'Layout container, accepts sx prop'),
        libEntry('Stack', '@mui/material/Stack', 'Flexbox layout stack with spacing'),
        libEntry('Typography', '@mui/material/Typography', 'Text with variant hierarchy'),
        libEntry('Button', '@mui/material/Button', 'Action button: text, outlined, contained'),
        libEntry('TextField', '@mui/material/TextField', 'Form input with label and helper text'),
        libEntry('Accordion', '@mui/material/Accordion', 'Collapsible content panel'),
        libEntry('AccordionSummary', '@mui/material/AccordionSummary', 'Accordion trigger header'),
        libEntry('AccordionDetails', '@mui/material/AccordionDetails', 'Accordion expanded content'),
        libEntry('Dialog', '@mui/material/Dialog', 'Modal dialog overlay'),
        libEntry('DialogTitle', '@mui/material/DialogTitle', 'Dialog header'),
        libEntry('DialogContent', '@mui/material/DialogContent', 'Dialog body'),
        libEntry('DialogActions', '@mui/material/DialogActions', 'Dialog footer actions'),
        libEntry('Card', '@mui/material/Card', 'Surface container with elevation'),
        libEntry('CardContent', '@mui/material/CardContent', 'Card body'),
        libEntry('CardActions', '@mui/material/CardActions', 'Card footer actions'),
        libEntry('Chip', '@mui/material/Chip', 'Compact tag or filter'),
        libEntry('Alert', '@mui/material/Alert', 'Feedback banner'),
        libEntry('Snackbar', '@mui/material/Snackbar', 'Toast notification'),
        libEntry('CircularProgress', '@mui/material/CircularProgress', 'Loading indicator'),
        libEntry('Divider', '@mui/material/Divider', 'Horizontal or vertical separator'),
        libEntry('List', '@mui/material/List', 'Item list container'),
        libEntry('ListItem', '@mui/material/ListItem', 'List item'),
        libEntry('ListItemText', '@mui/material/ListItemText', 'List item text'),
        libEntry('Menu', '@mui/material/Menu', 'Dropdown menu'),
        libEntry('MenuItem', '@mui/material/MenuItem', 'Menu option'),
        libEntry('Select', '@mui/material/Select', 'Dropdown select input'),
        libEntry('Switch', '@mui/material/Switch', 'Toggle switch'),
        libEntry('Checkbox', '@mui/material/Checkbox', 'Binary checkbox'),
        libEntry('Radio', '@mui/material/Radio', 'Radio button'),
        libEntry('Tabs', '@mui/material/Tabs', 'Tab container'),
        libEntry('Tab', '@mui/material/Tab', 'Single tab'),
        libEntry('Tooltip', '@mui/material/Tooltip', 'Hover label'),
        libEntry('IconButton', '@mui/material/IconButton', 'Icon-only button'),
        libEntry('Avatar', '@mui/material/Avatar', 'User image or initials'),
        libEntry('Badge', '@mui/material/Badge', 'Numeric indicator'),
        libEntry('Breadcrumbs', '@mui/material/Breadcrumbs', 'Navigation trail'),
        libEntry('Skeleton', '@mui/material/Skeleton', 'Loading placeholder'),
        libEntry('Stepper', '@mui/material/Stepper', 'Multi-step indicator'),
        libEntry('Step', '@mui/material/Step', 'Single step'),
        libEntry('StepLabel', '@mui/material/StepLabel', 'Step label'),
        libEntry('Paper', '@mui/material/Paper', 'Elevated surface'),
        libEntry('AppBar', '@mui/material/AppBar', 'Top navigation bar'),
        libEntry('Toolbar', '@mui/material/Toolbar', 'AppBar content row'),
        libEntry('Drawer', '@mui/material/Drawer', 'Side panel overlay'),
        libEntry('FormControl', '@mui/material/FormControl', 'Form element wrapper'),
        libEntry('FormLabel', '@mui/material/FormLabel', 'Form group label'),
        libEntry('FormHelperText', '@mui/material/FormHelperText', 'Form helper text'),
        libEntry('InputLabel', '@mui/material/InputLabel', 'Floating input label'),
        libEntry('Grid', '@mui/material/Grid', 'Responsive CSS grid'),
        libEntry('Container', '@mui/material/Container', 'Centered content container'),
        libEntry('Link', '@mui/material/Link', 'Styled anchor'),
        libEntry('Table', '@mui/material/Table', 'HTML table'),
        libEntry('TableHead', '@mui/material/TableHead', 'Table header rows'),
        libEntry('TableBody', '@mui/material/TableBody', 'Table body rows'),
        libEntry('TableRow', '@mui/material/TableRow', 'Table row'),
        libEntry('TableCell', '@mui/material/TableCell', 'Table cell'),
    ],
    shadcn: [
        libEntry('Button', '@/components/ui/button', 'shadcn button primitive'),
        libEntry('Card', '@/components/ui/card', 'shadcn surface container'),
        libEntry('CardHeader', '@/components/ui/card', 'Card header slot'),
        libEntry('CardContent', '@/components/ui/card', 'Card body slot'),
        libEntry('CardFooter', '@/components/ui/card', 'Card footer slot'),
        libEntry('Input', '@/components/ui/input', 'shadcn input primitive'),
        libEntry('Label', '@/components/ui/label', 'shadcn form label'),
        libEntry('Dialog', '@/components/ui/dialog', 'shadcn dialog primitive'),
        libEntry('DialogTrigger', '@/components/ui/dialog', 'Dialog trigger slot'),
        libEntry('DialogContent', '@/components/ui/dialog', 'Dialog content slot'),
        libEntry('Badge', '@/components/ui/badge', 'shadcn tag primitive'),
        libEntry('Tabs', '@/components/ui/tabs', 'shadcn tab container'),
        libEntry('TabsList', '@/components/ui/tabs', 'Tab list'),
        libEntry('TabsTrigger', '@/components/ui/tabs', 'Tab trigger'),
        libEntry('TabsContent', '@/components/ui/tabs', 'Tab content panel'),
        libEntry('Select', '@/components/ui/select', 'shadcn select primitive'),
        libEntry('SelectTrigger', '@/components/ui/select', 'Select trigger'),
        libEntry('SelectContent', '@/components/ui/select', 'Select content'),
        libEntry('SelectItem', '@/components/ui/select', 'Select option'),
        libEntry('Separator', '@/components/ui/separator', 'shadcn divider'),
    ],
    primeng: [
        libEntry('Button', 'primereact/button', 'PrimeReact button primitive'),
        libEntry('InputText', 'primereact/inputtext', 'PrimeReact text input'),
        libEntry('Dropdown', 'primereact/dropdown', 'PrimeReact dropdown'),
        libEntry('Dialog', 'primereact/dialog', 'PrimeReact modal dialog'),
        libEntry('Card', 'primereact/card', 'PrimeReact surface'),
        libEntry('DataTable', 'primereact/datatable', 'PrimeReact data grid'),
        libEntry('Column', 'primereact/column', 'DataTable column'),
        libEntry('TabView', 'primereact/tabview', 'PrimeReact tab container'),
        libEntry('TabPanel', 'primereact/tabview', 'Tab panel'),
        libEntry('Checkbox', 'primereact/checkbox', 'PrimeReact checkbox'),
        libEntry('RadioButton', 'primereact/radiobutton', 'PrimeReact radio'),
        libEntry('Toast', 'primereact/toast', 'PrimeReact toast notifications'),
        libEntry('Panel', 'primereact/panel', 'PrimeReact content panel'),
        libEntry('Accordion', 'primereact/accordion', 'PrimeReact accordion'),
        libEntry('AccordionTab', 'primereact/accordion', 'Accordion tab'),
    ],
    tailwind: [],
    antd: [],
    radix: [],
    chakra: [],
    carbon: [],
}

// ---------------------------------------------------------------------------
// Tool definition (MCP ListTools schema)
// ---------------------------------------------------------------------------

export const FLINT_SET_LIBRARY_TOOL = {
    name: toolName('set_library'),
    description:
        'Set the active component library for this project. Writes selectedLibrary to ' +
        '.flint/policy.json and seeds the project with the library\'s base design tokens ' +
        '(merge-with-preserve: existing tokens are never overwritten). ' +
        'Pass library="auto" to auto-detect from existing tokens. ' +
        'Pass library="list" to see available libraries. ' +
        'Supported: shadcn, mui, primeng, tailwind.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            library: {
                type: 'string',
                enum: ['shadcn', 'mui', 'primeng', 'tailwind', 'auto', 'list', 'none'],
                description:
                    'Target component library. Use "auto" to detect from existing tokens, ' +
                    '"list" to see available libraries, "none" to clear the selection.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root. Defaults to cwd.',
            },
        },
        required: ['library'],
    },
} as const

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export interface SetLibraryArgs {
    library: string
    projectRoot?: string
}

export function handleSetLibrary(args: SetLibraryArgs): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    const projectRoot = args.projectRoot ?? process.cwd()

    // --- List mode ---
    if (args.library === 'list') {
        const catalog = getAdapterCatalog()
        const listing = catalog.map(a =>
            `  ${a.library.padEnd(10)} ${a.displayName} — ${a.description}`,
        ).join('\n')

        return {
            content: [{
                type: 'text',
                text: `Available libraries (${catalog.length}):\n\n${listing}\n\nUse library="auto" to detect from existing tokens.`,
            }],
        }
    }

    // --- Clear mode ---
    if (args.library === 'none') {
        const policy = readPolicy(projectRoot)
        delete policy.selectedLibrary
        writePolicy(projectRoot, policy)
        return {
            content: [{
                type: 'text',
                text: 'Active library cleared. AI generation will use generic constraints only.',
            }],
        }
    }

    // --- Auto-detect mode ---
    if (args.library === 'auto') {
        const tokens = readTokens(projectRoot)
        if (tokens.length === 0) {
            return {
                content: [{
                    type: 'text',
                    text: 'No tokens found in .flint/design-tokens.json. Import tokens first (flint_sync_pull or flint_ingest_figma), then run flint_set_library with library="auto".',
                }],
                isError: true,
            }
        }

        const detection = detectLibraryFromTokens(tokens)

        if (!detection.library) {
            const scoreList = Object.entries(detection.scores)
                .sort(([, a], [, b]) => b.score - a.score)
                .map(([lib, r]) => `  ${lib.padEnd(10)} score=${r.score}  ${r.reasons.slice(0, 2).join('; ')}`)
                .join('\n')

            return {
                content: [{
                    type: 'text',
                    text: `Auto-detection inconclusive (confidence=${detection.confidence}%, threshold=60%).\n\nScores:\n${scoreList}\n\nSpecify the library explicitly: flint_set_library library="shadcn"`,
                }],
            }
        }

        // Confident detection — fall through to set it
        args = { ...args, library: detection.library }

        // Continue to the explicit set logic below, but include detection info
        const detectionNote = `Auto-detected: ${detection.library} (confidence=${detection.confidence}%)\n\n`
        const result = setLibraryExplicit(args.library as LibraryTarget, projectRoot)
        if (result.isError) return result
        return {
            content: [{
                type: 'text',
                text: detectionNote + result.content[0].text,
            }],
        }
    }

    // --- Explicit set mode ---
    const libraryTarget = args.library as LibraryTarget
    if (!hasAdapter(libraryTarget)) {
        const available = getAvailableLibraries().join(', ')
        return {
            content: [{
                type: 'text',
                text: `Unknown library: "${args.library}". Available: ${available}. Pass library="list" for details.`,
            }],
            isError: true,
        }
    }

    return setLibraryExplicit(libraryTarget, projectRoot)
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function setLibraryExplicit(library: LibraryTarget, projectRoot: string): {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
} {
    // 1. Write selectedLibrary to policy.json
    const policy = readPolicy(projectRoot)
    const previousLibrary = policy.selectedLibrary
    policy.selectedLibrary = library
    writePolicy(projectRoot, policy)

    // 2. Seed tokens (merge-with-preserve)
    const adapter = getAdapter(library)
    const seedTokens = adapter.seedTokens()
    const { seeded, existing, total } = mergeTokens(projectRoot, seedTokens)

    // 3. ARM.1: Seed library component manifest into flint-manifest.json.
    //    REG-001 trusts source:'library' entries automatically so Mason-generated
    //    MUI/shadcn/PrimeNG primitives don't fire false-positives at audit time.
    const manifest = LIBRARY_COMPONENT_MANIFESTS[library]
    const { seeded: componentsSeeded, existing: componentsExisting } = mergeComponents(projectRoot, manifest)

    // 4. Build response
    const lines: string[] = [
        `Active library set to: ${adapter.displayName} (${library})`,
    ]

    if (previousLibrary && previousLibrary !== library) {
        lines.push(`Previous library: ${previousLibrary}`)
        lines.push(`Note: ${previousLibrary} tokens remain in design-tokens.json. Run flint_audit to identify orphaned tokens.`)
    }

    lines.push('')
    lines.push(`Token seeding: ${seeded} new tokens added, ${existing} existing preserved (${total} total)`)
    lines.push(`Library components: ${componentsSeeded} registered, ${componentsExisting} already present`)

    if (seeded > 0) {
        lines.push('')
        lines.push('Next steps:')
        lines.push('  1. Run flint_sync_push to push tokens to Figma')
        lines.push('  2. Design with tokens in Figma')
        lines.push('  3. Run flint_sync_pull to import updates')
        lines.push(`  4. Run flint_map_tokens library="${library}" to generate theme file`)
    }

    return {
        content: [{ type: 'text', text: lines.join('\n') }],
    }
}

// ---------------------------------------------------------------------------
// Policy helpers
// ---------------------------------------------------------------------------

function readPolicy(projectRoot: string): Record<string, unknown> {
    const policyPath = path.join(projectRoot, configPath('policy.json'))
    try {
        if (fs.existsSync(policyPath)) {
            return JSON.parse(fs.readFileSync(policyPath, 'utf-8'))
        }
    } catch { /* ignore parse errors */ }
    return {}
}

function writePolicy(projectRoot: string, policy: Record<string, unknown>): void {
    const configDir = path.join(projectRoot, configPath(''))
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
    }
    const policyPath = path.join(configDir, 'policy.json')
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n', 'utf-8')
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function readTokens(projectRoot: string): DesignToken[] {
    const tokensPath = path.join(projectRoot, configPath('design-tokens.json'))
    try {
        if (fs.existsSync(tokensPath)) {
            const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
            return Array.isArray(raw) ? raw : []
        }
    } catch { /* ignore */ }
    return []
}

/**
 * ARM.1: Merge library component manifest into `.flint/flint-manifest.json`.
 * Writes entries into a top-level `libraryComponents` array (never overwriting
 * existing source:'local' entries with the same name). Idempotent.
 */
function mergeComponents(
    projectRoot: string,
    entries: ComponentEntry[],
): { seeded: number; existing: number } {
    if (entries.length === 0) return { seeded: 0, existing: 0 }

    const manifestPath = path.join(projectRoot, configPath('flint-manifest.json'))
    let manifest: Record<string, unknown> = {}
    try {
        if (fs.existsSync(manifestPath)) {
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        }
    } catch { /* ignore parse errors */ }

    if (!Array.isArray(manifest.libraryComponents)) {
        manifest.libraryComponents = []
    }
    const libraryComponents = manifest.libraryComponents as ComponentEntry[]

    const existingLibraryNames = new Set(
        libraryComponents.filter((e): e is ComponentEntry => typeof e?.name === 'string').map(e => e.name),
    )

    // Local components (source === 'local' or source undefined) always win over library entries.
    const localComponentNames = new Set<string>()
    if (Array.isArray(manifest.components)) {
        for (const c of manifest.components as ComponentEntry[]) {
            if (c?.name && typeof c.name === 'string' && (c.source === 'local' || !c.source)) {
                localComponentNames.add(c.name)
            }
        }
    }

    let seeded = 0
    let existing = 0
    for (const entry of entries) {
        if (localComponentNames.has(entry.name) || existingLibraryNames.has(entry.name)) {
            existing++
            continue
        }
        libraryComponents.push(entry)
        existingLibraryNames.add(entry.name)
        seeded++
    }

    if (seeded > 0) {
        const configDir = path.join(projectRoot, configPath(''))
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true })
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
    }

    return { seeded, existing }
}

/**
 * Merge seed tokens into existing tokens with preserve semantics.
 * Existing token paths are never overwritten.
 */
function mergeTokens(projectRoot: string, seedTokens: DesignToken[]): {
    seeded: number
    existing: number
    total: number
} {
    const currentTokens = readTokens(projectRoot)
    const existingPaths = new Set(currentTokens.map(t => t.token_path))

    let seeded = 0
    const merged = [...currentTokens]
    let nextId = currentTokens.length > 0
        ? Math.max(...currentTokens.map(t => t.id)) + 1
        : 1

    for (const seed of seedTokens) {
        if (!existingPaths.has(seed.token_path)) {
            merged.push({ ...seed, id: nextId++ })
            seeded++
        }
    }

    // Write merged tokens
    const configDir = path.join(projectRoot, configPath(''))
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
    }
    const tokensPath = path.join(configDir, 'design-tokens.json')
    fs.writeFileSync(tokensPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')

    return {
        seeded,
        existing: existingPaths.size,
        total: merged.length,
    }
}
