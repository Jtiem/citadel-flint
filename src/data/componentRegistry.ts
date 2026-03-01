/**
 * Component Registry — src/data/componentRegistry.ts
 *
 * Hardcoded catalogue of injectable UI components shown in the Assets Panel.
 * Each entry carries everything `injectComponent` needs:
 *   · snippet    — the JSX string that gets appended to the target node
 *   · importStmt — optional import declaration to prepend (deduplicated by
 *                  the AST surgeon so re-injecting the same component is safe)
 *
 * Renderer Process only — no Node.js imports.
 */

export interface RegistryEntry {
    id: string
    name: string
    snippet: string
    importStmt?: string
}

export const componentRegistry: RegistryEntry[] = [
    {
        id: 'button',
        name: 'Button',
        snippet: '<Button>Action</Button>',
        importStmt: "import { Button } from '@/components/ui/button';",
    },
    {
        id: 'badge',
        name: 'Badge',
        snippet: '<Badge>New</Badge>',
        importStmt: "import { Badge } from '@/components/ui/badge';",
    },
    {
        id: 'text',
        name: 'Paragraph',
        snippet: '<p className="text-content-primary">New text block</p>',
    },
]
