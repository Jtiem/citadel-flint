/**
 * DetectionPreview.test.tsx
 *
 * FORGE.1 Sprint 1: Full test suite for the DetectionPreview component.
 *
 * Contract invariants tested (from FORGE.1.contract.ts testBoundaries):
 *   - confirm calls onConfirm with merged environment (including overrides)
 *   - cancel calls onCancel and does NOT call project:auto-configure
 *   - library defaults to MUI when detection returns null and no override set
 *   - override controls merge into the auto-configure payload
 *
 * Coverage:
 *   - Render with full environment
 *   - Render with null componentLibrary (MUI default path)
 *   - Confirm without overrides
 *   - Confirm with library override
 *   - Confirm with null library override (explicit "None")
 *   - Cancel is non-destructive
 *   - Path truncation display
 *   - Accessible controls (aria-labels)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DetectionPreview } from '../DetectionPreview'
import type { ProjectEnvironment } from '../../../types/flint-api'

function makeEnvironment(overrides: Partial<ProjectEnvironment> = {}): ProjectEnvironment {
    return {
        framework: { name: 'react', version: '19.1.0' },
        cssFramework: { name: 'tailwind', version: '4.0.0' },
        componentLibrary: null,
        hasDesignTokens: false,
        tokenSource: null,
        componentCount: 12,
        uiFramework: 'React 19',
        cssFrameworkLabel: 'Tailwind v4',
        tokenFormat: null,
        typescript: true,
        componentLibraryLabel: null,
        detectedAt: new Date().toISOString(),
        ...overrides,
    }
}

function defaultProps(overrides: Partial<Parameters<typeof DetectionPreview>[0]> = {}) {
    return {
        environment: makeEnvironment(),
        projectPath: '/Users/dev/my-react-app',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
        ...overrides,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('DetectionPreview — render', () => {

    it('renders the detection-preview container', () => {
        render(<DetectionPreview {...defaultProps()} />)
        expect(screen.getByTestId('detection-preview')).toBeDefined()
    })

    it('displays "Project detected" heading', () => {
        render(<DetectionPreview {...defaultProps()} />)
        expect(screen.getByText('Project detected')).toBeDefined()
    })

    it('displays the project path', () => {
        render(<DetectionPreview {...defaultProps({ projectPath: '/Users/dev/my-react-app' })} />)
        expect(screen.getByText('/Users/dev/my-react-app')).toBeDefined()
    })

    it('truncates long project paths', () => {
        const longPath = '/Users/dev/very-long-path-that-exceeds-the-maximum-display-length-allowed/my-react-app'
        render(<DetectionPreview {...defaultProps({ projectPath: longPath })} />)
        // Path should be truncated with leading ...
        const pathEl = screen.getByLabelText(/Project path:/i)
        expect(pathEl.textContent?.startsWith('...')).toBe(true)
    })

    it('displays component count', () => {
        render(<DetectionPreview {...defaultProps({ environment: makeEnvironment({ componentCount: 42 }) })} />)
        expect(screen.getByText('42')).toBeDefined()
    })

    it('displays Code type: TypeScript when typescript is true (UX-B3 plain-language)', () => {
        render(<DetectionPreview {...defaultProps({ environment: makeEnvironment({ typescript: true }) })} />)
        expect(screen.getByText('TypeScript')).toBeDefined()
    })

    it('displays Code type: JavaScript when typescript is false (UX-B3 plain-language)', () => {
        render(<DetectionPreview {...defaultProps({ environment: makeEnvironment({ typescript: false }) })} />)
        expect(screen.getByText('JavaScript')).toBeDefined()
    })

    it('displays token source row when hasDesignTokens is true', () => {
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ hasDesignTokens: true, tokenSource: 'flint' })
        })} />)
        expect(screen.getByText('flint')).toBeDefined()
    })

    it('does not display token source row when hasDesignTokens is false (UX-B3 plain-language label is "Design tokens")', () => {
        render(<DetectionPreview {...defaultProps({ environment: makeEnvironment({ hasDesignTokens: false }) })} />)
        expect(screen.queryByText('Design tokens')).toBeNull()
    })

    it('renders confirm and cancel buttons', () => {
        render(<DetectionPreview {...defaultProps()} />)
        expect(screen.getByTestId('detection-preview-confirm')).toBeDefined()
        expect(screen.getByTestId('detection-preview-cancel')).toBeDefined()
    })

    it('renders a cancel button in the header (X icon)', () => {
        render(<DetectionPreview {...defaultProps()} />)
        expect(screen.getByLabelText('Cancel')).toBeDefined()
    })

    it('has accessible region label', () => {
        render(<DetectionPreview {...defaultProps()} />)
        const region = screen.getByRole('region', { name: /Detection results/i })
        expect(region).toBeDefined()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('DetectionPreview — MUI default when library is null', () => {

    it('shows amber "Defaulting to MUI" hint when componentLibrary is null and no override chosen', () => {
        render(<DetectionPreview {...defaultProps({ environment: makeEnvironment({ componentLibrary: null }) })} />)
        expect(screen.getByText('Using MUI (change if needed)')).toBeDefined()
    })

    it('does NOT show the amber hint when componentLibrary is detected', () => {
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ componentLibrary: { name: 'mui', version: '6.0.0' } })
        })} />)
        expect(screen.queryByText('Using MUI (change if needed)')).toBeNull()
    })

    it('hides the amber hint when user selects an override', async () => {
        render(<DetectionPreview {...defaultProps({ environment: makeEnvironment({ componentLibrary: null }) })} />)
        expect(screen.getByText('Using MUI (change if needed)')).toBeDefined()

        const librarySelect = screen.getByLabelText('Override component library')
        fireEvent.change(librarySelect, { target: { value: 'shadcn' } })

        await waitFor(() => {
            expect(screen.queryByText('Using MUI (change if needed)')).toBeNull()
        })
    })

    it('confirm with null library and no override passes MUI default in overrides', () => {
        const onConfirm = vi.fn()
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ componentLibrary: null }),
            onConfirm,
        })} />)

        fireEvent.click(screen.getByTestId('detection-preview-confirm'))

        expect(onConfirm).toHaveBeenCalledOnce()
        const [overrides] = onConfirm.mock.calls[0] as [Partial<ProjectEnvironment> | undefined]
        expect(overrides?.componentLibrary?.name).toBe('mui')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('DetectionPreview — confirm behaviour', () => {

    it('calls onConfirm when Confirm button is clicked', () => {
        const onConfirm = vi.fn()
        render(<DetectionPreview {...defaultProps({ onConfirm })} />)
        fireEvent.click(screen.getByTestId('detection-preview-confirm'))
        expect(onConfirm).toHaveBeenCalledOnce()
    })

    it('calls onConfirm with undefined overrides when nothing changed and library was detected', () => {
        const onConfirm = vi.fn()
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ componentLibrary: { name: 'mui', version: '6.0.0' } }),
            onConfirm,
        })} />)
        fireEvent.click(screen.getByTestId('detection-preview-confirm'))
        expect(onConfirm).toHaveBeenCalledWith(undefined)
    })

    it('calls onConfirm with { componentLibrary: { name: "mui", version: "latest" } } when user selects mui override', () => {
        const onConfirm = vi.fn()
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ componentLibrary: null }),
            onConfirm,
        })} />)

        const librarySelect = screen.getByLabelText('Override component library')
        fireEvent.change(librarySelect, { target: { value: 'shadcn' } })
        // Override to shadcn, then change back to mui to confirm the value
        fireEvent.change(librarySelect, { target: { value: 'mui' } })
        fireEvent.click(screen.getByTestId('detection-preview-confirm'))

        expect(onConfirm).toHaveBeenCalledOnce()
        const [overrides] = onConfirm.mock.calls[0] as [Partial<ProjectEnvironment> | undefined]
        expect(overrides?.componentLibrary?.name).toBe('mui')
        expect(overrides?.componentLibrary?.version).toBe('latest')
    })

    it('calls onConfirm with { componentLibrary: null } when user explicitly selects "None"', () => {
        const onConfirm = vi.fn()
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ componentLibrary: { name: 'mui', version: '6.0.0' } }),
            onConfirm,
        })} />)

        const librarySelect = screen.getByLabelText('Override component library')
        fireEvent.change(librarySelect, { target: { value: '' } })
        fireEvent.click(screen.getByTestId('detection-preview-confirm'))

        expect(onConfirm).toHaveBeenCalledOnce()
        const [overrides] = onConfirm.mock.calls[0] as [Partial<ProjectEnvironment> | undefined]
        expect(overrides?.componentLibrary).toBeNull()
    })

    it('calls onConfirm with framework override when framework select changes', () => {
        const onConfirm = vi.fn()
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ framework: { name: 'react', version: '19.1.0' } }),
            onConfirm,
        })} />)

        const frameworkSelect = screen.getByLabelText('Override framework')
        fireEvent.change(frameworkSelect, { target: { value: 'vue' } })
        fireEvent.click(screen.getByTestId('detection-preview-confirm'))

        expect(onConfirm).toHaveBeenCalledOnce()
        const [overrides] = onConfirm.mock.calls[0] as [Partial<ProjectEnvironment> | undefined]
        expect(overrides?.framework?.name).toBe('vue')
    })

    it('includes CSS framework override in onConfirm payload', () => {
        const onConfirm = vi.fn()
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ cssFramework: { name: 'tailwind', version: '4.0.0' } }),
            onConfirm,
        })} />)

        const cssSelect = screen.getByLabelText('Override CSS framework')
        fireEvent.change(cssSelect, { target: { value: 'emotion' } })
        fireEvent.click(screen.getByTestId('detection-preview-confirm'))

        expect(onConfirm).toHaveBeenCalledOnce()
        const [overrides] = onConfirm.mock.calls[0] as [Partial<ProjectEnvironment> | undefined]
        expect(overrides?.cssFramework?.name).toBe('emotion')
    })

    it('X header button also calls onCancel', () => {
        const onCancel = vi.fn()
        render(<DetectionPreview {...defaultProps({ onCancel })} />)
        fireEvent.click(screen.getByLabelText('Cancel'))
        expect(onCancel).toHaveBeenCalledOnce()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('DetectionPreview — cancel behaviour', () => {

    it('calls onCancel when Back button is clicked', () => {
        const onCancel = vi.fn()
        render(<DetectionPreview {...defaultProps({ onCancel })} />)
        fireEvent.click(screen.getByTestId('detection-preview-cancel'))
        expect(onCancel).toHaveBeenCalledOnce()
    })

    it('does NOT call onConfirm when Back button is clicked', () => {
        const onConfirm = vi.fn()
        const onCancel = vi.fn()
        render(<DetectionPreview {...defaultProps({ onConfirm, onCancel })} />)
        fireEvent.click(screen.getByTestId('detection-preview-cancel'))
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('cancel is non-destructive: onCancel receives no arguments', () => {
        const onCancel = vi.fn()
        render(<DetectionPreview {...defaultProps({ onCancel })} />)
        fireEvent.click(screen.getByTestId('detection-preview-cancel'))
        expect(onCancel).toHaveBeenCalledOnce()
        // Confirm the call was made with zero arguments
        expect(onCancel.mock.calls[0]).toHaveLength(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('DetectionPreview — override controls', () => {

    it('framework select has correct initial value from detected framework', () => {
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ framework: { name: 'react', version: '19.0.0' } })
        })} />)
        const select = screen.getByLabelText('Override framework') as HTMLSelectElement
        expect(select.value).toBe('react')
    })

    it('library select defaults to "mui" when componentLibrary is null', () => {
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ componentLibrary: null })
        })} />)
        const select = screen.getByLabelText('Override component library') as HTMLSelectElement
        expect(select.value).toBe('mui')
    })

    it('library select reflects detected library when present', () => {
        render(<DetectionPreview {...defaultProps({
            environment: makeEnvironment({ componentLibrary: { name: 'shadcn', version: '1.0.0' } })
        })} />)
        const select = screen.getByLabelText('Override component library') as HTMLSelectElement
        expect(select.value).toBe('shadcn')
    })

    it('changing framework select updates the displayed value', async () => {
        render(<DetectionPreview {...defaultProps()} />)
        const frameworkSelect = screen.getByLabelText('Override framework') as HTMLSelectElement
        fireEvent.change(frameworkSelect, { target: { value: 'vue' } })
        await waitFor(() => {
            expect(frameworkSelect.value).toBe('vue')
        })
    })
})
