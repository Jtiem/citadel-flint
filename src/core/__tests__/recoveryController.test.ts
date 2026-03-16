/**
 * recoveryController.test.ts — src/core/__tests__/recoveryController.test.ts
 *
 * Journey 6 Steps 6.1–6.3 — Undo/Redo Controller
 *
 * Covers:
 *   6.1  applyUndo() with a single-file history entry reverts code to previous state
 *   6.2  applyUndo() pushes a redo entry onto historyStore.future
 *   6.3  applyUndo() with empty history is a no-op (no crash)
 *        applyRedo() after undo returns code to post-mutation state
 *        Pre-flight: zombie node causes undo to revert via restoreCode snapshot
 *        Stack discipline: past shrinks by 1, future grows by 1 after undo
 *
 * Test environment: jsdom (via vitest.config.react.ts) with window.bridgeAPI mocked
 * by the global setup in src/components/__tests__/setup.ts.
 *
 * The LanguageRegistry must be seeded with the ReactAdapter before any store
 * actions are called, because editorStore.applyBatch delegates through it.
 * We register it once at module scope so it is available for every test.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LanguageRegistry } from '../adapters/types'
import { reactAdapter } from '../adapters/ReactAdapter'
import { useEditorStore } from '../../store/editorStore'
import { useHistoryStore } from '../../store/historyStore'
import { useCanvasStore } from '../../store/canvasStore'
import { applyUndo, applyRedo } from '../recoveryController'
import type { InverseMutation } from '../ASTService'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Register the React adapter once so LanguageRegistry.getAdapter('file.tsx')
// succeeds inside editorStore.applyBatch and syncCode.
LanguageRegistry.register(['ts', 'tsx', 'js', 'jsx'], reactAdapter)

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Minimal valid TSX that carries a data-bridge-id so the structural mutation
 * engine can target it by attribute value rather than line:col position.
 * Using a known bridge ID keeps tests independent of code-generation whitespace.
 */
const BRIDGE_ID = 'card-a1b2'

const ORIGINAL_CODE = `export default function Card() {
  return (
    <div data-bridge-id="${BRIDGE_ID}" className="text-zinc-400">Hello</div>
  )
}`

const MUTATED_CLASS = 'text-zinc-100'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Seeds editorStore and historyStore into a post-mutation state by applying
 * a single updateClassName batch against ORIGINAL_CODE.
 *
 * After this call:
 *   - editorStore.rawCode contains the mutated code (MUTATED_CLASS applied)
 *   - historyStore.past has exactly one entry
 *   - historyStore.future is empty
 */
function applyMutation(): void {
    useEditorStore.setState({ rawCode: ORIGINAL_CODE })
    useEditorStore.getState().applyBatch([
        { op: 'updateClassName', nodeId: BRIDGE_ID, className: MUTATED_CLASS },
    ])
}

// ── Store reset ───────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()

    // Reset to a clean slate: no code, no history, no active file.
    useHistoryStore.getState().clear()
    useEditorStore.setState({
        rawCode: '',
        ast: null,
        visualTree: [],
        selectedNodeId: null,
        hoveredId: null,
        jumpToLine: null,
        linterWarnings: new Map(),
    })
    useCanvasStore.setState({
        activeFilePath: null,
        saveState: 'idle',
        mithrilViolations: [],
        a11yViolations: {},
        overridesExist: false,
    })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyUndo', () => {

    // 6.1 — Single-file undo reverts code to previous state

    it('reverts rawCode to the pre-mutation value after a single-file undo', async () => {
        applyMutation()

        // Confirm the mutation was applied before we undo it.
        expect(useEditorStore.getState().rawCode).toContain(MUTATED_CLASS)
        expect(useEditorStore.getState().rawCode).not.toContain('text-zinc-400')

        await applyUndo()

        const code = useEditorStore.getState().rawCode
        expect(code).toContain('text-zinc-400')
        expect(code).not.toContain(MUTATED_CLASS)
    })

    it('preserves data-bridge-id on the target element after undo', async () => {
        applyMutation()
        await applyUndo()

        const code = useEditorStore.getState().rawCode
        expect(code).toContain(`data-bridge-id="${BRIDGE_ID}"`)
    })

    // 6.2 — Undo pushes the redo entry onto historyStore.future

    it('pushes a redo entry to future after undoing a single-file mutation', async () => {
        applyMutation()

        // Before undo: future must be empty (new edit always clears it).
        expect(useHistoryStore.getState().future).toHaveLength(0)

        await applyUndo()

        expect(useHistoryStore.getState().future).toHaveLength(1)
    })

    it('sets canRedo to true after a successful undo', async () => {
        applyMutation()
        expect(useHistoryStore.getState().canRedo).toBe(false)

        await applyUndo()

        expect(useHistoryStore.getState().canRedo).toBe(true)
    })

    // 6.3 — Empty history: no-op

    it('does not throw when the history stack is empty', async () => {
        // historyStore starts empty (reset in beforeEach).
        expect(useHistoryStore.getState().past).toHaveLength(0)

        await expect(applyUndo()).resolves.toBeUndefined()
    })

    it('leaves rawCode unchanged when history is empty', async () => {
        useEditorStore.setState({ rawCode: ORIGINAL_CODE })

        await applyUndo()

        expect(useEditorStore.getState().rawCode).toBe(ORIGINAL_CODE)
    })

    // Stack discipline: past shrinks by 1, future grows by 1

    it('shrinks past by 1 after undo', async () => {
        applyMutation()
        expect(useHistoryStore.getState().past).toHaveLength(1)

        await applyUndo()

        expect(useHistoryStore.getState().past).toHaveLength(0)
    })

    it('grows future by 1 after undo — strict count', async () => {
        applyMutation()
        const futureBefore = useHistoryStore.getState().future.length

        await applyUndo()

        expect(useHistoryStore.getState().future.length).toBe(futureBefore + 1)
    })

    it('sets canUndo to false when past reaches zero entries', async () => {
        applyMutation()
        expect(useHistoryStore.getState().canUndo).toBe(true)

        await applyUndo()

        expect(useHistoryStore.getState().canUndo).toBe(false)
    })

    // Pre-flight: restoreCode inverse (structural mutation) is applied correctly

    it('restores code from a restoreCode snapshot when the inverse is structural', async () => {
        // Manually push a history entry that carries a restoreCode inverse —
        // the same shape that moveNode and deleteNode produce.
        useEditorStore.setState({ rawCode: 'export default function X() { return <span /> }' })

        const snapshotCode = ORIGINAL_CODE
        const inversions: InverseMutation[] = [{ op: 'restoreCode', code: snapshotCode }]
        useHistoryStore.getState().push(inversions, [])

        // Set rawCode to something different from the snapshot so we can tell
        // that the snapshot was applied, not the current code kept as-is.
        useEditorStore.setState({
            rawCode: 'export default function X() { return <article /> }',
        })

        await applyUndo()

        expect(useEditorStore.getState().rawCode).toContain('text-zinc-400')
    })

    // Pre-flight zombie check: if the inverse targets a node that no longer
    // exists (was deleted by a later edit), the restoreCode snapshot path still
    // succeeds because applyInversions returns the snapshot immediately when one
    // is present. For property-only inverses, applyInversions is tolerant — it
    // simply leaves the class unchanged if the node is absent.

    it('does not crash when the target node of a property inverse no longer exists', async () => {
        // Push a property-level inverse for a nodeId that doesn't appear in
        // the current rawCode (simulates a zombie node situation).
        const zombieInversions: InverseMutation[] = [
            { op: 'updateClassName', nodeId: 'ghost-node-xyz', className: 'bg-red-500' },
        ]
        useEditorStore.setState({ rawCode: ORIGINAL_CODE })
        useHistoryStore.getState().push(zombieInversions, [])

        await expect(applyUndo()).resolves.toBeUndefined()
    })
})

// ── applyRedo ─────────────────────────────────────────────────────────────────

describe('applyRedo', () => {

    it('re-applies the original mutation after undo — code returns to post-mutation state', async () => {
        applyMutation()

        const codeAfterMutation = useEditorStore.getState().rawCode

        await applyUndo()

        // Confirm the undo worked.
        expect(useEditorStore.getState().rawCode).toContain('text-zinc-400')

        await applyRedo()

        const codeAfterRedo = useEditorStore.getState().rawCode
        expect(codeAfterRedo).toContain(MUTATED_CLASS)
        expect(codeAfterRedo).not.toContain('text-zinc-400')
        // The redo-generated code should match the original mutation output.
        expect(codeAfterRedo).toBe(codeAfterMutation)
    })

    it('is a no-op when the future stack is empty', async () => {
        useEditorStore.setState({ rawCode: ORIGINAL_CODE })

        // future is empty — applyRedo must return without throwing.
        await expect(applyRedo()).resolves.toBeUndefined()

        // Code must be unchanged.
        expect(useEditorStore.getState().rawCode).toBe(ORIGINAL_CODE)
    })

    it('moves the redo entry back onto past after redo completes', async () => {
        applyMutation()
        await applyUndo()

        expect(useHistoryStore.getState().future).toHaveLength(1)
        expect(useHistoryStore.getState().past).toHaveLength(0)

        await applyRedo()

        // applyBatch inside applyRedo pushes a fresh inverse back onto past.
        expect(useHistoryStore.getState().past).toHaveLength(1)
    })

    it('clears future after redo consumes the only entry', async () => {
        applyMutation()
        await applyUndo()

        await applyRedo()

        expect(useHistoryStore.getState().future).toHaveLength(0)
        expect(useHistoryStore.getState().canRedo).toBe(false)
    })

    it('preserves data-bridge-id after a full undo→redo round-trip', async () => {
        applyMutation()
        await applyUndo()
        await applyRedo()

        const code = useEditorStore.getState().rawCode
        expect(code).toContain(`data-bridge-id="${BRIDGE_ID}"`)
    })
})

// ── historyStore.pushFuture / popRedo discipline ───────────────────────────────

describe('historyStore stack invariants', () => {

    it('push() clears future so a new edit invalidates the redo timeline', () => {
        // Seed future with a dummy entry via pushFuture.
        useHistoryStore.getState().pushFuture({ inversions: [], redoMutations: [] })
        expect(useHistoryStore.getState().future).toHaveLength(1)

        // A new push (representing a fresh mutation) must clear future.
        useHistoryStore.getState().push([], [])
        expect(useHistoryStore.getState().future).toHaveLength(0)
        expect(useHistoryStore.getState().canRedo).toBe(false)
    })

    it('popUndo() returns null on an empty stack without mutating the store', () => {
        const result = useHistoryStore.getState().popUndo()
        expect(result).toBeNull()
        expect(useHistoryStore.getState().past).toHaveLength(0)
    })

    it('popRedo() returns null on an empty future without mutating the store', () => {
        const result = useHistoryStore.getState().popRedo()
        expect(result).toBeNull()
        expect(useHistoryStore.getState().future).toHaveLength(0)
    })

    it('clear() empties both stacks and resets canUndo and canRedo', () => {
        useHistoryStore.getState().push([{ op: 'updateClassName', nodeId: 'x', className: 'y' }], [])
        useHistoryStore.getState().pushFuture({ inversions: [], redoMutations: [] })

        useHistoryStore.getState().clear()

        const state = useHistoryStore.getState()
        expect(state.past).toHaveLength(0)
        expect(state.future).toHaveLength(0)
        expect(state.canUndo).toBe(false)
        expect(state.canRedo).toBe(false)
    })

    it('multiple undos reduce past to zero and grow future proportionally', async () => {
        // Apply two sequential mutations.
        applyMutation()
        useEditorStore.getState().applyBatch([
            { op: 'updateClassName', nodeId: BRIDGE_ID, className: 'text-white' },
        ])

        expect(useHistoryStore.getState().past).toHaveLength(2)
        expect(useHistoryStore.getState().future).toHaveLength(0)

        await applyUndo()

        expect(useHistoryStore.getState().past).toHaveLength(1)
        expect(useHistoryStore.getState().future).toHaveLength(1)

        await applyUndo()

        expect(useHistoryStore.getState().past).toHaveLength(0)
        expect(useHistoryStore.getState().future).toHaveLength(2)
    })
})
