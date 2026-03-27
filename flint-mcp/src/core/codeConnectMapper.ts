/**
 * codeConnectMapper.ts — flint-mcp/src/core/codeConnectMapper.ts
 *
 * Phase D2C.4 / Feature 3: Code Connect Auto-Registration
 *
 * Pure, stateless module that generates Figma Code Connect mappings from
 * Flint's library adapter registry. No I/O — callers are responsible for
 * reading library choice and writing the output file.
 *
 * Supports: shadcn (15 components), MUI (12 components), PrimeNG (10 components).
 * Returns null for any unrecognised library so callers can handle gracefully.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeConnectPropDef {
    /** DTCG-style type: "string", "boolean", "enum", "function", "node" */
    type: string
    /** Figma property name when it differs from the prop key */
    figmaProp?: string
    /** Enum value mapping: code value => Figma variant value */
    mapping?: Record<string, string>
}

export interface CodeConnectMapping {
    /** Component name as it appears in the Figma file */
    figmaComponentName: string
    /** Import path in the codebase, e.g. "@/components/ui/button" */
    importPath: string
    /** JSX export name, e.g. "Button" */
    exportName: string
    /** Sub-components that compose this component (for compound patterns) */
    compoundParts?: string[]
    /** Prop definitions keyed by code prop name */
    props: Record<string, CodeConnectPropDef>
}

export interface CodeConnectConfig {
    library: string
    mappings: CodeConnectMapping[]
    generatedAt: string
}

// ---------------------------------------------------------------------------
// shadcn/ui — 15 components
// ---------------------------------------------------------------------------

const SHADCN_MAPPINGS: CodeConnectMapping[] = [
    {
        figmaComponentName: 'Button',
        importPath: '@/components/ui/button',
        exportName: 'Button',
        props: {
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: {
                    default: 'Default',
                    destructive: 'Destructive',
                    outline: 'Outline',
                    secondary: 'Secondary',
                    ghost: 'Ghost',
                    link: 'Link',
                },
            },
            size: {
                type: 'enum',
                figmaProp: 'Size',
                mapping: { default: 'Default', sm: 'Small', lg: 'Large', icon: 'Icon' },
            },
            disabled: { type: 'boolean', figmaProp: 'Disabled' },
            asChild: { type: 'boolean' },
        },
    },
    {
        figmaComponentName: 'Card',
        importPath: '@/components/ui/card',
        exportName: 'Card',
        props: {},
    },
    {
        figmaComponentName: 'Input',
        importPath: '@/components/ui/input',
        exportName: 'Input',
        props: {
            type: { type: 'string', figmaProp: 'Type' },
            placeholder: { type: 'string', figmaProp: 'Placeholder' },
            disabled: { type: 'boolean', figmaProp: 'Disabled' },
        },
    },
    {
        figmaComponentName: 'Label',
        importPath: '@/components/ui/label',
        exportName: 'Label',
        props: {
            htmlFor: { type: 'string', figmaProp: 'For' },
        },
    },
    {
        figmaComponentName: 'Textarea',
        importPath: '@/components/ui/textarea',
        exportName: 'Textarea',
        props: {
            placeholder: { type: 'string', figmaProp: 'Placeholder' },
            disabled: { type: 'boolean', figmaProp: 'Disabled' },
        },
    },
    {
        figmaComponentName: 'Select',
        importPath: '@/components/ui/select',
        exportName: 'Select',
        compoundParts: ['SelectTrigger', 'SelectContent', 'SelectItem', 'SelectValue'],
        props: {},
    },
    {
        figmaComponentName: 'Tabs',
        importPath: '@/components/ui/tabs',
        exportName: 'Tabs',
        compoundParts: ['TabsList', 'TabsTrigger', 'TabsContent'],
        props: {},
    },
    {
        figmaComponentName: 'Avatar',
        importPath: '@/components/ui/avatar',
        exportName: 'Avatar',
        compoundParts: ['AvatarImage', 'AvatarFallback'],
        props: {},
    },
    {
        figmaComponentName: 'Badge',
        importPath: '@/components/ui/badge',
        exportName: 'Badge',
        props: {
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: {
                    default: 'Default',
                    secondary: 'Secondary',
                    destructive: 'Destructive',
                    outline: 'Outline',
                },
            },
        },
    },
    {
        figmaComponentName: 'Separator',
        importPath: '@/components/ui/separator',
        exportName: 'Separator',
        props: {
            orientation: {
                type: 'enum',
                figmaProp: 'Orientation',
                mapping: { horizontal: 'Horizontal', vertical: 'Vertical' },
            },
        },
    },
    {
        figmaComponentName: 'Switch',
        importPath: '@/components/ui/switch',
        exportName: 'Switch',
        props: {
            checked: { type: 'boolean', figmaProp: 'Checked' },
            onCheckedChange: { type: 'function' },
        },
    },
    {
        figmaComponentName: 'Checkbox',
        importPath: '@/components/ui/checkbox',
        exportName: 'Checkbox',
        props: {
            checked: { type: 'boolean', figmaProp: 'Checked' },
            onCheckedChange: { type: 'function' },
        },
    },
    {
        figmaComponentName: 'Alert',
        importPath: '@/components/ui/alert',
        exportName: 'Alert',
        compoundParts: ['AlertTitle', 'AlertDescription'],
        props: {
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: { default: 'Default', destructive: 'Destructive' },
            },
        },
    },
    {
        figmaComponentName: 'Dialog',
        importPath: '@/components/ui/dialog',
        exportName: 'Dialog',
        compoundParts: [
            'DialogTrigger',
            'DialogContent',
            'DialogHeader',
            'DialogTitle',
            'DialogDescription',
        ],
        props: {},
    },
    {
        figmaComponentName: 'Sheet',
        importPath: '@/components/ui/sheet',
        exportName: 'Sheet',
        compoundParts: [
            'SheetTrigger',
            'SheetContent',
            'SheetHeader',
            'SheetTitle',
            'SheetDescription',
        ],
        props: {},
    },
]

// ---------------------------------------------------------------------------
// MUI — 12 components
// ---------------------------------------------------------------------------

const MUI_MAPPINGS: CodeConnectMapping[] = [
    {
        figmaComponentName: 'Button',
        importPath: '@mui/material/Button',
        exportName: 'Button',
        props: {
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: { contained: 'Contained', outlined: 'Outlined', text: 'Text' },
            },
            color: {
                type: 'enum',
                figmaProp: 'Color',
                mapping: {
                    primary: 'Primary',
                    secondary: 'Secondary',
                    error: 'Error',
                    warning: 'Warning',
                    info: 'Info',
                    success: 'Success',
                },
            },
            size: {
                type: 'enum',
                figmaProp: 'Size',
                mapping: { small: 'Small', medium: 'Medium', large: 'Large' },
            },
            disabled: { type: 'boolean', figmaProp: 'Disabled' },
        },
    },
    {
        figmaComponentName: 'Card',
        importPath: '@mui/material/Card',
        exportName: 'Card',
        compoundParts: ['CardContent', 'CardActions'],
        props: {},
    },
    {
        figmaComponentName: 'TextField',
        importPath: '@mui/material/TextField',
        exportName: 'TextField',
        props: {
            label: { type: 'string', figmaProp: 'Label' },
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: { outlined: 'Outlined', filled: 'Filled', standard: 'Standard' },
            },
            multiline: { type: 'boolean', figmaProp: 'Multiline' },
            rows: { type: 'string', figmaProp: 'Rows' },
        },
    },
    {
        figmaComponentName: 'Typography',
        importPath: '@mui/material/Typography',
        exportName: 'Typography',
        props: {
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: {
                    h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5', h6: 'H6',
                    body1: 'Body1', body2: 'Body2', caption: 'Caption',
                },
            },
            component: { type: 'string', figmaProp: 'Component' },
            color: { type: 'string', figmaProp: 'Color' },
        },
    },
    {
        figmaComponentName: 'Box',
        importPath: '@mui/material/Box',
        exportName: 'Box',
        props: {
            sx: { type: 'node' },
            component: { type: 'string', figmaProp: 'Component' },
        },
    },
    {
        figmaComponentName: 'Stack',
        importPath: '@mui/material/Stack',
        exportName: 'Stack',
        props: {
            direction: {
                type: 'enum',
                figmaProp: 'Direction',
                mapping: { row: 'Row', column: 'Column' },
            },
            spacing: { type: 'string', figmaProp: 'Spacing' },
            divider: { type: 'node' },
        },
    },
    {
        figmaComponentName: 'Avatar',
        importPath: '@mui/material/Avatar',
        exportName: 'Avatar',
        props: {
            src: { type: 'string', figmaProp: 'Image' },
            alt: { type: 'string', figmaProp: 'Label' },
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: { circular: 'Circular', rounded: 'Rounded', square: 'Square' },
            },
        },
    },
    {
        figmaComponentName: 'Chip',
        importPath: '@mui/material/Chip',
        exportName: 'Chip',
        props: {
            label: { type: 'string', figmaProp: 'Label' },
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: { filled: 'Filled', outlined: 'Outlined' },
            },
            color: { type: 'string', figmaProp: 'Color' },
            onDelete: { type: 'function' },
        },
    },
    {
        figmaComponentName: 'Divider',
        importPath: '@mui/material/Divider',
        exportName: 'Divider',
        props: {
            orientation: {
                type: 'enum',
                figmaProp: 'Orientation',
                mapping: { horizontal: 'Horizontal', vertical: 'Vertical' },
            },
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: { fullWidth: 'Full Width', inset: 'Inset', middle: 'Middle' },
            },
        },
    },
    {
        figmaComponentName: 'Alert',
        importPath: '@mui/material/Alert',
        exportName: 'Alert',
        props: {
            severity: {
                type: 'enum',
                figmaProp: 'Severity',
                mapping: { error: 'Error', warning: 'Warning', info: 'Info', success: 'Success' },
            },
            variant: {
                type: 'enum',
                figmaProp: 'Variant',
                mapping: { filled: 'Filled', outlined: 'Outlined', standard: 'Standard' },
            },
        },
    },
    {
        figmaComponentName: 'Switch',
        importPath: '@mui/material/Switch',
        exportName: 'Switch',
        props: {
            checked: { type: 'boolean', figmaProp: 'Checked' },
            onChange: { type: 'function' },
        },
    },
    {
        figmaComponentName: 'Select',
        importPath: '@mui/material/Select',
        exportName: 'Select',
        compoundParts: ['MenuItem'],
        props: {
            value: { type: 'string', figmaProp: 'Value' },
            label: { type: 'string', figmaProp: 'Label' },
        },
    },
]

// ---------------------------------------------------------------------------
// PrimeNG / PrimeReact — 10 components
// ---------------------------------------------------------------------------

const PRIMENG_MAPPINGS: CodeConnectMapping[] = [
    {
        figmaComponentName: 'Button',
        importPath: 'primereact/button',
        exportName: 'Button',
        props: {
            label: { type: 'string', figmaProp: 'Label' },
            severity: {
                type: 'enum',
                figmaProp: 'Severity',
                mapping: {
                    secondary: 'Secondary',
                    success: 'Success',
                    info: 'Info',
                    warning: 'Warning',
                    help: 'Help',
                    danger: 'Danger',
                },
            },
            outlined: { type: 'boolean', figmaProp: 'Outlined' },
            icon: { type: 'string', figmaProp: 'Icon' },
        },
    },
    {
        figmaComponentName: 'Card',
        importPath: 'primereact/card',
        exportName: 'Card',
        props: {
            title: { type: 'string', figmaProp: 'Title' },
            subTitle: { type: 'string', figmaProp: 'SubTitle' },
            header: { type: 'node' },
            footer: { type: 'node' },
        },
    },
    {
        figmaComponentName: 'InputText',
        importPath: 'primereact/inputtext',
        exportName: 'InputText',
        props: {
            value: { type: 'string', figmaProp: 'Value' },
            placeholder: { type: 'string', figmaProp: 'Placeholder' },
        },
    },
    {
        figmaComponentName: 'Dropdown',
        importPath: 'primereact/dropdown',
        exportName: 'Dropdown',
        props: {
            options: { type: 'node' },
            optionLabel: { type: 'string', figmaProp: 'OptionLabel' },
            value: { type: 'string', figmaProp: 'Value' },
            placeholder: { type: 'string', figmaProp: 'Placeholder' },
        },
    },
    {
        figmaComponentName: 'DataTable',
        importPath: 'primereact/datatable',
        exportName: 'DataTable',
        compoundParts: ['Column'],
        props: {
            value: { type: 'node' },
            header: { type: 'string', figmaProp: 'Header' },
        },
    },
    {
        figmaComponentName: 'Panel',
        importPath: 'primereact/panel',
        exportName: 'Panel',
        props: {
            header: { type: 'string', figmaProp: 'Header' },
            toggleable: { type: 'boolean', figmaProp: 'Toggleable' },
        },
    },
    {
        figmaComponentName: 'Avatar',
        importPath: 'primereact/avatar',
        exportName: 'Avatar',
        props: {
            label: { type: 'string', figmaProp: 'Label' },
            image: { type: 'string', figmaProp: 'Image' },
            shape: {
                type: 'enum',
                figmaProp: 'Shape',
                mapping: { circle: 'Circle', square: 'Square' },
            },
        },
    },
    {
        figmaComponentName: 'Badge',
        importPath: 'primereact/badge',
        exportName: 'Badge',
        props: {
            value: { type: 'string', figmaProp: 'Value' },
            severity: {
                type: 'enum',
                figmaProp: 'Severity',
                mapping: {
                    success: 'Success',
                    info: 'Info',
                    warning: 'Warning',
                    danger: 'Danger',
                },
            },
        },
    },
    {
        figmaComponentName: 'Divider',
        importPath: 'primereact/divider',
        exportName: 'Divider',
        props: {
            align: {
                type: 'enum',
                figmaProp: 'Align',
                mapping: { left: 'Left', center: 'Center', right: 'Right' },
            },
            type: {
                type: 'enum',
                figmaProp: 'Type',
                mapping: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' },
            },
        },
    },
    {
        figmaComponentName: 'Message',
        importPath: 'primereact/message',
        exportName: 'Message',
        props: {
            severity: {
                type: 'enum',
                figmaProp: 'Severity',
                mapping: {
                    success: 'Success',
                    info: 'Info',
                    warn: 'Warn',
                    error: 'Error',
                },
            },
            text: { type: 'string', figmaProp: 'Text' },
        },
    },
]

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const LIBRARY_MAPPINGS: Record<string, CodeConnectMapping[]> = {
    shadcn: SHADCN_MAPPINGS,
    mui: MUI_MAPPINGS,
    primeng: PRIMENG_MAPPINGS,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate Code Connect mappings for the given library.
 *
 * Returns null when the library is not recognised so callers can
 * return a clear error without throwing.
 *
 * @param library  One of "shadcn", "mui", "primeng"
 */
export function generateCodeConnectMappings(library: string): CodeConnectConfig | null {
    const normalised = library.toLowerCase()
    const mappings = LIBRARY_MAPPINGS[normalised]
    if (!mappings) return null

    return {
        library: normalised,
        mappings,
        generatedAt: new Date().toISOString(),
    }
}

/**
 * List all libraries that have Code Connect mappings registered.
 */
export function getSupportedLibraries(): string[] {
    return Object.keys(LIBRARY_MAPPINGS)
}
