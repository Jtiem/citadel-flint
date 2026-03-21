/**
 * Audit Engine Tests -- flint-ci/src/audit-engine.test.ts
 *
 * Verifies the CI governance gate correctly detects Mithril design token
 * drift and WCAG accessibility violations in source files.
 */

import { describe, it, expect } from 'vitest'
import { parseSource, auditFile, auditFiles, shouldFail } from './audit-engine.js'
import type { DesignToken, FlintPolicy } from './types.js'
import { DEFAULT_POLICY } from './types.js'

// -- Test Tokens ---------------------------------------------------------------

const TEST_TOKENS: DesignToken[] = [
    {
        id: 1,
        token_path: 'color-brand.primary',
        token_type: 'color',
        token_value: '#3b82f6',
        description: 'Primary brand color',
        mode: 'default',
        collection_name: 'Color Tokens',
    },
    {
        id: 2,
        token_path: 'color-brand.secondary',
        token_type: 'color',
        token_value: '#10b981',
        description: 'Secondary brand color',
        mode: 'default',
        collection_name: 'Color Tokens',
    },
    {
        id: 3,
        token_path: 'spacing.medium',
        token_type: 'dimension',
        token_value: '16px',
        description: 'Medium spacing',
        mode: 'default',
        collection_name: 'Spacing Tokens',
    },
]

// -- parseSource Tests ---------------------------------------------------------

describe('parseSource', () => {
    it('parses valid TSX', () => {
        const ast = parseSource('<div className="test">Hello</div>')
        expect(ast).not.toBeNull()
        expect(ast!.type).toBe('File')
    })

    it('returns null for invalid syntax', () => {
        const ast = parseSource('<<<totally invalid>>>')
        expect(ast).toBeNull()
    })

    it('parses TypeScript with types', () => {
        const code = `
            interface Props { name: string }
            const App = ({ name }: Props) => <div>{name}</div>
        `
        const ast = parseSource(code)
        expect(ast).not.toBeNull()
    })
})

// -- Mithril Detection Tests ---------------------------------------------------

describe('auditFile - Mithril', () => {
    it('detects color drift in arbitrary hex values', () => {
        const code = `
            export default function App() {
                return <div data-flint-id="node-1" className="bg-[#ff0000]">Red</div>
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        expect(result.parseError).toBeNull()
        expect(result.mithrilWarnings.length).toBeGreaterThan(0)
        expect(result.mithrilWarnings[0].type).toBe('color-drift')
    })

    it('passes when color matches a token', () => {
        const code = `
            export default function App() {
                return <div data-flint-id="node-1" className="bg-[#3b82f6]">Blue</div>
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        expect(result.mithrilWarnings.length).toBe(0)
    })

    it('detects spacing drift', () => {
        const code = `
            export default function App() {
                return <div data-flint-id="node-1" className="p-[37px]">Content</div>
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        expect(result.mithrilWarnings.length).toBeGreaterThan(0)
        expect(result.mithrilWarnings[0].type).toBe('spacing-drift')
    })

    it('passes when spacing matches a token', () => {
        const code = `
            export default function App() {
                return <div data-flint-id="node-1" className="p-[16px]">Content</div>
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        // Spacing should match dimension token
        const spacingViolations = result.mithrilWarnings.filter(w => w.type === 'spacing-drift')
        expect(spacingViolations.length).toBe(0)
    })

    it('skips elements without data-flint-id', () => {
        const code = `
            export default function App() {
                return <div className="bg-[#ff0000]">No ID</div>
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        expect(result.mithrilWarnings.length).toBe(0)
    })
})

// -- A11y Detection Tests ------------------------------------------------------

describe('auditFile - A11y', () => {
    it('detects missing alt on img', () => {
        const code = `
            export default function App() {
                return <img src="photo.jpg" />
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.some(v => v.includes('A11Y-001'))).toBe(true)
    })

    it('passes when img has alt', () => {
        const code = `
            export default function App() {
                return <img src="photo.jpg" alt="A photo" />
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.some(v => v.includes('A11Y-001'))).toBe(false)
    })

    it('detects missing accessible name on button', () => {
        const code = `
            export default function App() {
                return <button></button>
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.some(v => v.includes('A11Y-002'))).toBe(true)
    })

    it('passes when button has text content', () => {
        const code = `
            export default function App() {
                return <button>Click me</button>
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.some(v => v.includes('A11Y-002'))).toBe(false)
    })

    it('detects missing label on input', () => {
        const code = `
            export default function App() {
                return <input type="text" />
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.some(v => v.includes('A11Y-004'))).toBe(true)
    })

    it('detects heading level skip', () => {
        const code = `
            export default function App() {
                return (
                    <div>
                        <h1>Title</h1>
                        <h3>Skipped h2</h3>
                    </div>
                )
            }
        `
        const result = auditFile('test.tsx', code, TEST_TOKENS)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.some(v => v.includes('A11Y-010'))).toBe(true)
    })
})

// -- Policy Tests --------------------------------------------------------------

describe('auditFile - Policy', () => {
    it('skips Mithril checks when mode is off', () => {
        const code = `
            export default function App() {
                return <div data-flint-id="node-1" className="bg-[#ff0000]">Red</div>
            }
        `
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            mithril: { ...DEFAULT_POLICY.mithril, mode: 'off' },
        }
        const result = auditFile('test.tsx', code, TEST_TOKENS, policy)
        expect(result.mithrilWarnings.length).toBe(0)
    })

    it('skips A11y checks when mode is off', () => {
        const code = `
            export default function App() {
                return <img src="photo.jpg" />
            }
        `
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            a11y: { ...DEFAULT_POLICY.a11y, mode: 'off' },
        }
        const result = auditFile('test.tsx', code, TEST_TOKENS, policy)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.length).toBe(0)
    })

    it('skips disabled A11y rules', () => {
        const code = `
            export default function App() {
                return <img src="photo.jpg" />
            }
        `
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            a11y: { ...DEFAULT_POLICY.a11y, disabled_rules: ['A11Y-001'] },
        }
        const result = auditFile('test.tsx', code, TEST_TOKENS, policy)
        const violations = Object.values(result.a11yViolations).flat()
        expect(violations.some(v => v.includes('A11Y-001'))).toBe(false)
    })

    it('skips Mithril checks for ignored file patterns', () => {
        const code = `
            export default function App() {
                return <div data-flint-id="node-1" className="bg-[#ff0000]">Red</div>
            }
        `
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            mithril: { ...DEFAULT_POLICY.mithril, ignore_patterns: ['test\\.tsx$'] },
        }
        const result = auditFile('test.tsx', code, TEST_TOKENS, policy)
        expect(result.mithrilWarnings.length).toBe(0)
    })
})

// -- Multi-file Audit Tests ----------------------------------------------------

describe('auditFiles', () => {
    it('produces correct aggregate summary', () => {
        const files = [
            {
                path: 'clean.tsx',
                content: `export default function App() {
                    return <div data-flint-id="n1" className="bg-[#3b82f6]">
                        <img src="x.jpg" alt="photo" />
                    </div>
                }`,
            },
            {
                path: 'dirty.tsx',
                content: `export default function App() {
                    return <div data-flint-id="n2" className="bg-[#ff0000]">
                        <img src="x.jpg" />
                    </div>
                }`,
            },
        ]

        const summary = auditFiles(files, TEST_TOKENS)
        expect(summary.totalFiles).toBe(2)
        expect(summary.filesWithViolations).toBe(1)
        expect(summary.totalMithrilWarnings).toBeGreaterThanOrEqual(1)
        expect(summary.totalA11yViolations).toBeGreaterThanOrEqual(1)
    })
})

// -- shouldFail Tests ----------------------------------------------------------

describe('shouldFail', () => {
    it('fails on critical A11y violations in blocking mode', () => {
        const summary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 0,
            totalA11yViolations: 1,
            criticalCount: 1,
            amberCount: 0,
            results: [],
        }
        expect(shouldFail(summary, DEFAULT_POLICY, false)).toBe(true)
    })

    it('passes when A11y mode is advisory', () => {
        // criticalCount is 0 here because the only violations are a11y,
        // and a11y is in advisory mode -- so the audit engine would not
        // increment criticalCount. Mithril has no violations either.
        const summary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 0,
            totalA11yViolations: 1,
            criticalCount: 0,
            amberCount: 0,
            results: [],
        }
        const policy: FlintPolicy = {
            ...DEFAULT_POLICY,
            a11y: { ...DEFAULT_POLICY.a11y, mode: 'advisory' },
        }
        const result = shouldFail(summary, policy, false)
        expect(result).toBe(false)
    })

    it('fails on amber when fail_on_warning is true', () => {
        const summary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 1,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 1,
            results: [],
        }
        expect(shouldFail(summary, DEFAULT_POLICY, true)).toBe(true)
    })

    it('passes amber when fail_on_warning is false', () => {
        const summary = {
            totalFiles: 1,
            filesWithViolations: 1,
            totalMithrilWarnings: 1,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 1,
            results: [],
        }
        expect(shouldFail(summary, DEFAULT_POLICY, false)).toBe(false)
    })

    it('passes when no violations exist', () => {
        const summary = {
            totalFiles: 5,
            filesWithViolations: 0,
            totalMithrilWarnings: 0,
            totalA11yViolations: 0,
            criticalCount: 0,
            amberCount: 0,
            results: [],
        }
        expect(shouldFail(summary, DEFAULT_POLICY, true)).toBe(false)
    })
})
