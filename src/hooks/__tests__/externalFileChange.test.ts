/**
 * externalFileChange.test.ts
 *
 * P2 Journey 3 Step 3.4: Validates that re-calling setCode() (the re-lint
 * trigger for external file edits) correctly updates linter warnings.
 *
 * The actual fs.watch → IPC → renderer notification path is not yet wired.
 * This test validates the STORE-LEVEL re-audit: if editorStore.setCode() is
 * called with new content (as would happen after an external change notification),
 * the Mithril and A11y warnings update correctly.
 *
 * Gap documented: no fs.watch → IPC trigger exists yet. These tests ensure the
 * re-audit engine works when triggered.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { LanguageRegistry } from '../../core/adapters/types'
import { ReactAdapter } from '../../core/adapters/ReactAdapter'

// ── Adapter ──────────────────────────────────────────────────────────────────

LanguageRegistry.register(['tsx', 'ts', 'jsx', 'js'], new ReactAdapter())

// ── IPC mocks ────────────────────────────────────────────────────────────────

Object.defineProperty(window, 'flintAPI', {
    value: {
        readFile: vi.fn(async () => ''),
        saveFile: vi.fn(async () => undefined),
    },
    writable: true,
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CLEAN_CODE = `export default function App() {
  return <div data-flint-id="div:1:0" className="p-4 bg-zinc-900">Hello</div>
}`

const VIOLATION_CODE = `export default function App() {
  return <img data-flint-id="img:1:0" src="/photo.jpg" />
}`

// img without alt → A11Y violation

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Re-audit on external file change (J3.4 store-level)', () => {
    beforeEach(() => {
        useEditorStore.setState({
            rawCode: '',
            ast: null,
            visualTree: [],
            selectedNodeId: null,
            linterWarnings: new Map(),
        })
        useCanvasStore.setState({
            activeFilePath: '/project/src/App.tsx',
            a11yViolations: {},
            mithrilViolations: [],
        })
    })

    it('setCode with clean content produces empty a11y violations', () => {
        useEditorStore.getState().setCode(CLEAN_CODE)
        const a11y = useCanvasStore.getState().a11yViolations
        expect(Object.keys(a11y)).toHaveLength(0)
    })

    it('setCode with <img> missing alt produces a11y violation', () => {
        useEditorStore.getState().setCode(VIOLATION_CODE)
        const a11y = useCanvasStore.getState().a11yViolations
        // Should have at least one violation for the img element
        expect(Object.keys(a11y).length).toBeGreaterThan(0)
    })

    it('switching from violation code to clean code clears violations', () => {
        // First load violation code
        useEditorStore.getState().setCode(VIOLATION_CODE)
        expect(Object.keys(useCanvasStore.getState().a11yViolations).length).toBeGreaterThan(0)

        // Then external edit introduces clean code
        useEditorStore.getState().setCode(CLEAN_CODE)
        expect(Object.keys(useCanvasStore.getState().a11yViolations)).toHaveLength(0)
    })

    it('AST is non-null after setCode with valid TSX', () => {
        useEditorStore.getState().setCode(CLEAN_CODE)
        expect(useEditorStore.getState().ast).not.toBeNull()
    })

    it('visualTree is populated after setCode', () => {
        useEditorStore.getState().setCode(CLEAN_CODE)
        expect(useEditorStore.getState().visualTree.length).toBeGreaterThan(0)
    })

    it('rawCode is updated to the new content', () => {
        useEditorStore.getState().setCode(CLEAN_CODE)
        expect(useEditorStore.getState().rawCode).toBe(CLEAN_CODE)
    })

    it('handles syntax-error code gracefully (ast stays null)', () => {
        const brokenCode = 'export default function { <div unclosed'
        useEditorStore.getState().setCode(brokenCode)
        // rawCode is still updated
        expect(useEditorStore.getState().rawCode).toBe(brokenCode)
        // AST should be null since parse failed
        expect(useEditorStore.getState().ast).toBeNull()
    })
})
