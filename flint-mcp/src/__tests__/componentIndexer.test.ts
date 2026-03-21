/**
 * componentIndexer tests
 * flint-mcp/src/__tests__/componentIndexer.test.ts
 *
 * Phase INIT.1: Test suite for the component discovery engine.
 *
 * Strategy:
 *   - All filesystem calls are mocked with vi.mock('node:fs').
 *   - Real Babel parsing is used for AST extraction by constructing
 *     in-memory source strings and passing them through the mocked fs layer.
 *   - A shared `mockState` object is used so the vi.mock factory closure
 *     always sees the most recent per-test values.
 *
 * Test map:
 *   1  — Finds default export function component
 *   2  — Finds named export function component
 *   3  — Finds arrow function component (export const Button = (...) => ...)
 *   4  — Extracts destructured props from parameter list
 *   5  — Skips test files (*.test.tsx)
 *   6  — Skips non-component exports (lowercase names)
 *   7  — Handles file with no exports gracefully
 *   8  — Handles parse error gracefully (malformed JSX)
 *   9  — Excludes node_modules directory
 *  10  — Extracts props from a referenced interface / type alias
 *  11  — Finds React.forwardRef component followed by export default
 *  12  — Uses @/ alias when tsconfig.json has @/* paths
 *  13  — Uses relative import path when no @/* alias is configured
 *  14  — filePaths / totalFiles reflect all scanned files
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Shared mock state — the factory closure always reads from this object so
// per-test setup takes effect without needing vi.resetModules().
// ---------------------------------------------------------------------------

interface DirEntry { name: string; isDir: boolean }

const mockState = {
    files: new Map<string, string>(),   // abs path → file content
    dirs: new Map<string, DirEntry[]>(), // abs dir path → entries
}

function mockDirent(name: string, isDir: boolean) {
    return {
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
    }
}

vi.mock('node:fs', () => {
    return {
        default: {
            existsSync: (p: string) => mockState.dirs.has(p) || mockState.files.has(p),
            readdirSync: (p: string, _opts?: unknown) => {
                const entries = mockState.dirs.get(p) ?? []
                return entries.map(e => mockDirent(e.name, e.isDir))
            },
            readFileSync: (p: string, _enc?: unknown): string => {
                const content = mockState.files.get(p)
                if (content !== undefined) return content
                throw Object.assign(new Error(`ENOENT: no such file: ${p}`), { code: 'ENOENT' })
            },
        },
        existsSync: (p: string) => mockState.dirs.has(p) || mockState.files.has(p),
        readdirSync: (p: string, _opts?: unknown) => {
            const entries = mockState.dirs.get(p) ?? []
            return entries.map(e => mockDirent(e.name, e.isDir))
        },
        readFileSync: (p: string, _enc?: unknown): string => {
            const content = mockState.files.get(p)
            if (content !== undefined) return content
            throw Object.assign(new Error(`ENOENT: no such file: ${p}`), { code: 'ENOENT' })
        },
    }
})

beforeEach(() => {
    mockState.files.clear()
    mockState.dirs.clear()
})

// ---------------------------------------------------------------------------
// Helper: build a minimal in-memory project tree
// ---------------------------------------------------------------------------

const PROJECT_ROOT = '/fake/project'

function setupProject(
    files: Record<string, string>,
    opts: { atAlias?: boolean } = {},
) {
    // Register the src/ directory
    const srcDir = path.join(PROJECT_ROOT, 'src')
    mockState.dirs.set(srcDir, [])
    mockState.dirs.set(PROJECT_ROOT, [{ name: 'src', isDir: true }])

    // tsconfig.json — only written when atAlias is requested
    if (opts.atAlias) {
        const tsconfig = JSON.stringify({
            compilerOptions: { paths: { '@/*': ['src/*'] } },
        })
        mockState.files.set(path.join(PROJECT_ROOT, 'tsconfig.json'), tsconfig)
    }

    // Register every file and its ancestor directories
    for (const [rel, content] of Object.entries(files)) {
        const abs = path.join(PROJECT_ROOT, rel)
        mockState.files.set(abs, content)

        const parts = rel.split('/')
        for (let i = 1; i <= parts.length; i++) {
            const dirRel = parts.slice(0, i - 1).join('/')
            const dirAbs = dirRel ? path.join(PROJECT_ROOT, dirRel) : PROJECT_ROOT
            const entryName = parts[i - 1]
            const isDir = i < parts.length

            if (!mockState.dirs.has(dirAbs)) mockState.dirs.set(dirAbs, [])
            const siblings = mockState.dirs.get(dirAbs)!
            if (!siblings.some(e => e.name === entryName)) {
                siblings.push({ name: entryName, isDir })
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Import module under test (static — mock hoisted by Vitest before imports)
// ---------------------------------------------------------------------------

import { indexComponents } from '../core/init/componentIndexer.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('componentIndexer — export pattern detection', () => {
    it('1. finds default export function component', async () => {
        setupProject({
            'src/Button.tsx': `
                export default function Button({ label }: { label: string }) {
                    return <button>{label}</button>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components).toHaveProperty('Button')
        expect(result.components['Button'].name).toBe('Button')
    })

    it('2. finds named export function component', async () => {
        setupProject({
            'src/Card.tsx': `
                export function Card({ title }: { title: string }) {
                    return <div>{title}</div>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components).toHaveProperty('Card')
    })

    it('3. finds arrow function component (export const Badge = (...))', async () => {
        setupProject({
            'src/Badge.tsx': `
                export const Badge = ({ count }: { count: number }) => {
                    return <span>{count}</span>;
                };
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components).toHaveProperty('Badge')
    })
})

describe('componentIndexer — prop extraction', () => {
    it('4. extracts destructured props from parameter list', async () => {
        setupProject({
            'src/Alert.tsx': `
                export function Alert({ variant, message, dismissible }: {
                    variant: string;
                    message: string;
                    dismissible?: boolean;
                }) {
                    return <div className={variant}>{message}</div>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        const props = result.components['Alert'].props ?? {}
        expect(props).toHaveProperty('variant')
        expect(props).toHaveProperty('message')
        expect(props).toHaveProperty('dismissible')
    })

    it('10. extracts props from a referenced interface', async () => {
        setupProject({
            'src/Modal.tsx': `
                interface ModalProps {
                    title: string;
                    isOpen: boolean;
                    onClose: () => void;
                }
                export function Modal({ title, isOpen, onClose }: ModalProps) {
                    return <dialog open={isOpen}>{title}</dialog>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        const props = result.components['Modal'].props ?? {}
        expect(props).toHaveProperty('title')
        expect(props).toHaveProperty('isOpen')
        expect(props).toHaveProperty('onClose')
    })
})

describe('componentIndexer — exclusion rules', () => {
    it('5. skips test files (*.test.tsx)', async () => {
        setupProject({
            'src/Button.test.tsx': `
                export default function Button() { return <div />; }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(0)
        expect(result.totalFiles).toBe(0)
    })

    it('6. skips non-component exports (lowercase names)', async () => {
        setupProject({
            'src/utils.tsx': `
                export function formatDate(d: Date) { return d.toString(); }
                export const helper = () => null;
                export default function myUtility() { return null; }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(0)
    })

    it('9. excludes node_modules directory', async () => {
        const nodeModulesDir = path.join(PROJECT_ROOT, 'node_modules')
        // Override the default setup — manually build the tree
        mockState.dirs.set(PROJECT_ROOT, [
            { name: 'src', isDir: true },
            { name: 'node_modules', isDir: true },
        ])
        mockState.dirs.set(path.join(PROJECT_ROOT, 'src'), [])
        mockState.dirs.set(nodeModulesDir, [
            { name: 'SomeLibComponent.tsx', isDir: false },
        ])
        mockState.files.set(
            path.join(nodeModulesDir, 'SomeLibComponent.tsx'),
            `export default function SomeLibComponent() { return <div />; }`,
        )

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(0)
    })
})

describe('componentIndexer — edge cases', () => {
    it('7. handles file with no exports gracefully', async () => {
        setupProject({
            'src/styles.tsx': `
                // No exports at all
                const x = 1;
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(0)
        expect(result.warnings).toHaveLength(0)
    })

    it('8. handles parse error gracefully (malformed source)', async () => {
        // Feed a file that will fail even with errorRecovery enabled
        // by making the content completely unparseable.
        setupProject({
            'src/Broken.tsx': `
                !!!! @@@@ completely invalid not-even-jsx ####
                function
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        // Should not throw; broken file produces either 0 components or a warning
        // (errorRecovery may parse partially; either outcome is acceptable)
        expect(result.count).toBeGreaterThanOrEqual(0)
        // The file was enumerated
        expect(result.totalFiles).toBe(1)
    })

    it('11. finds React.forwardRef component followed by export default', async () => {
        setupProject({
            'src/Input.tsx': `
                import React from 'react';
                const Input = React.forwardRef(({ placeholder, value }: {
                    placeholder: string;
                    value: string;
                }, ref) => {
                    return <input ref={ref} placeholder={placeholder} value={value} />;
                });
                export default Input;
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components).toHaveProperty('Input')
        expect(result.components['Input'].name).toBe('Input')
    })
})

describe('componentIndexer — JSDoc description extraction (EN.2)', () => {
    it('15. extracts JSDoc description from /** ... */ above export function', async () => {
        setupProject({
            'src/Button.tsx': `
                /**
                 * A reusable button component with multiple visual variants.
                 * Supports disabled state and loading indicator.
                 *
                 * @param props - Button props
                 */
                export function Button({ label }: { label: string }) {
                    return <button>{label}</button>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        const btn = result.components['Button']
        expect(btn.description).toBe(
            'A reusable button component with multiple visual variants. Supports disabled state and loading indicator.',
        )
    })

    it('16. extracts JSDoc description from /** ... */ above export default function', async () => {
        setupProject({
            'src/Hero.tsx': `
                /**
                 * Full-width hero section with background image and CTA.
                 */
                export default function Hero({ title }: { title: string }) {
                    return <section>{title}</section>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components['Hero'].description).toBe(
            'Full-width hero section with background image and CTA.',
        )
    })

    it('17. extracts JSDoc description from /** ... */ above export const Foo = ...', async () => {
        setupProject({
            'src/Badge.tsx': `
                /**
                 * Displays a numeric badge count with configurable color.
                 */
                export const Badge = ({ count }: { count: number }) => {
                    return <span>{count}</span>;
                };
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components['Badge'].description).toBe(
            'Displays a numeric badge count with configurable color.',
        )
    })

    it('18. ignores @param / @returns tags, extracts only prose', async () => {
        setupProject({
            'src/Input.tsx': `
                /**
                 * @param value - The controlled input value
                 * @returns A styled input element
                 */
                export function Input({ value }: { value: string }) {
                    return <input value={value} />;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        // Only @tags, no prose → description should be undefined
        expect(result.components['Input'].description).toBeUndefined()
    })

    it('19. returns undefined description when no JSDoc present (backward compat)', async () => {
        setupProject({
            'src/Card.tsx': `
                export function Card({ title }: { title: string }) {
                    return <div>{title}</div>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components['Card'].description).toBeUndefined()
    })

    it('20. truncates description at 500 chars with ellipsis', async () => {
        const longLine = 'A'.repeat(600)
        setupProject({
            'src/LongDoc.tsx': `
                /**
                 * ${longLine}
                 */
                export function LongDoc() {
                    return <div />;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        const desc = result.components['LongDoc'].description
        expect(desc).toBeDefined()
        expect(desc!.length).toBe(503) // 500 chars + '...'
        expect(desc!.endsWith('...')).toBe(true)
    })

    it('21. ignores single-line // comments (not JSDoc)', async () => {
        setupProject({
            'src/Alert.tsx': `
                // This is a single-line comment, not JSDoc
                // Another line
                export function Alert({ msg }: { msg: string }) {
                    return <div>{msg}</div>;
                }
            `,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components['Alert'].description).toBeUndefined()
    })
})

describe('componentIndexer — import path generation', () => {
    it('12. uses @/ alias when tsconfig.json has @/* paths', async () => {
        setupProject(
            { 'src/components/ui/Button.tsx': `export function Button() { return <button />; }` },
            { atAlias: true },
        )

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components['Button'].importPath).toBe('@/components/ui/Button')
    })

    it('13. uses relative import path when no @/* alias is configured', async () => {
        setupProject({
            'src/components/ui/Card.tsx': `export function Card() { return <div />; }`,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.count).toBe(1)
        expect(result.components['Card'].importPath).toBe('./src/components/ui/Card')
    })

    it('14. filePaths / totalFiles reflect all scanned files', async () => {
        setupProject({
            'src/Foo.tsx': `export function Foo() { return <div />; }`,
            'src/Bar.tsx': `export function Bar() { return <div />; }`,
        })

        const result = await indexComponents(PROJECT_ROOT)

        expect(result.filePaths).toHaveLength(2)
        expect(result.filePaths.some(p => p.includes('Foo.tsx'))).toBe(true)
        expect(result.filePaths.some(p => p.includes('Bar.tsx'))).toBe(true)
        expect(result.totalFiles).toBe(2)
    })
})
