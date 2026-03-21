/**
 * LivePreview.autopilot.test.tsx
 *
 * Phase REM.2.2: Governance Autopilot diff toggle in LivePreview.
 *
 * Tests:
 *   AP-01 — Toggle bar renders when governedCode is non-null and autopilot is on
 *   AP-02 — Badge shows the correct fix count
 *   AP-03 — No toggle bar when governedCode is null
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { LivePreview } from '../LivePreview'
import { useCanvasStore } from '../../../store/canvasStore'
import { useEditorStore } from '../../../store/editorStore'

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('LivePreview — Governance Autopilot diff toggle', () => {
    // AP-01: toggle bar renders when autopilot is on and governed code is present
    it('renders the Original/Governed toggle bar when governedCode is non-null', async () => {
        useEditorStore.setState({ rawCode: 'export default function App() { return <div>hi</div> }' })
        useCanvasStore.setState({
            autopilotEnabled: true,
            governedCode: 'export default function App() { return <div className="text-zinc-100">hi</div> }',
            governedFixCount: 1,
        })

        render(<LivePreview />)

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Original/i })).toBeDefined()
            expect(screen.getByRole('button', { name: /Governed/i })).toBeDefined()
        })
    })

    // AP-02: badge shows correct fix count
    it('shows the correct fix count in the "fixes available" badge', async () => {
        useEditorStore.setState({ rawCode: 'export default function App() { return <div>hi</div> }' })
        useCanvasStore.setState({
            autopilotEnabled: true,
            governedCode: 'export default function App() { return <div className="text-zinc-100">hi</div> }',
            governedFixCount: 4,
        })

        render(<LivePreview />)

        await waitFor(() => {
            expect(screen.getByText(/4 fixes available/i)).toBeDefined()
        })
    })

    // AP-02b: singular "fix" when count is 1
    it('uses singular "fix" label when fixableCount is 1', async () => {
        useEditorStore.setState({ rawCode: 'export default function App() { return <div>hi</div> }' })
        useCanvasStore.setState({
            autopilotEnabled: true,
            governedCode: 'export default function App() { return <div className="text-zinc-100">hi</div> }',
            governedFixCount: 1,
        })

        render(<LivePreview />)

        await waitFor(() => {
            expect(screen.getByText(/1 fix available/i)).toBeDefined()
        })
    })

    // AP-03: no toggle bar when governedCode is null
    it('does not render the toggle bar when governedCode is null', async () => {
        useEditorStore.setState({ rawCode: 'export default function App() { return <div>hi</div> }' })
        useCanvasStore.setState({
            autopilotEnabled: true,
            governedCode: null,
            governedFixCount: 0,
        })

        render(<LivePreview />)

        await waitFor(() => {
            const iframe = document.querySelector('iframe[title="Live Preview"]')
            expect(iframe).not.toBeNull()
        })

        // The toggle buttons should not exist when there is no governed code
        const originalBtn = screen.queryByRole('button', { name: /^Original$/i })
        const governedBtn = screen.queryByRole('button', { name: /^Governed$/i })
        expect(originalBtn).toBeNull()
        expect(governedBtn).toBeNull()
    })

    // AP-03b: no toggle bar when autopilot is disabled even if governed code exists
    it('does not render the toggle bar when autopilot is disabled', async () => {
        useEditorStore.setState({ rawCode: 'export default function App() { return <div>hi</div> }' })
        useCanvasStore.setState({
            autopilotEnabled: false,
            governedCode: 'some governed code',
            governedFixCount: 2,
        })

        render(<LivePreview />)

        await waitFor(() => {
            const iframe = document.querySelector('iframe[title="Live Preview"]')
            expect(iframe).not.toBeNull()
        })

        const originalBtn = screen.queryByRole('button', { name: /^Original$/i })
        expect(originalBtn).toBeNull()
    })
})
