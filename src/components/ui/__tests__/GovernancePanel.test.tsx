/**
 * GovernancePanel.test.tsx
 *
 * Unit tests for the GovernancePanel component, focused on OPP-15:
 * the focusRuleId prop that opens the panel focused on a specific rule.
 *
 * Test plan:
 *   1. Renders without crash
 *   2. Shows "Governance Rules" header
 *   3. Escape key calls onClose
 *   4. Backdrop click calls onClose
 *   5. focusRuleId switches to the Rules tab
 *   6. focusRuleId filters to the rule's category in the sidebar
 *   7. focusRuleId applies highlight ring to the matched rule row
 *   8. Unknown focusRuleId renders without crash (graceful fallback)
 *   9. focusRuleId is undefined — panel opens with all rules visible (default state)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GovernancePanel } from '../GovernancePanel'
import { useGovernanceStore } from '../../../store/governanceStore'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Module mocks ─────────────────────────────────────────────────────────────

// Avoid rendering heavy sub-components — they have their own test suites
vi.mock('../RuleCatalogPanel', () => ({
    RuleCatalogPanel: () => <div data-testid="rule-catalog-panel" />,
}))

vi.mock('../ComplianceProfileSelector', () => ({
    ComplianceProfileSelector: () => <div data-testid="compliance-profile-selector" />,
}))

vi.mock('../../../hooks/useGovernanceConfig', () => ({
    useGovernanceConfig: () => ({
        activePresets: [],
        togglePack: vi.fn().mockResolvedValue({ success: true, extends: [] }),
    }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPanel(props: { focusRuleId?: string; onClose?: () => void } = {}) {
    const onClose = props.onClose ?? vi.fn()
    return {
        onClose,
        ...render(<GovernancePanel onClose={onClose} focusRuleId={props.focusRuleId} />),
    }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernancePanel', () => {
    beforeEach(() => {
        useGovernanceStore.setState({ overrides: {} })
        useCanvasStore.setState({ activeFilePath: null })
    })

    // 1. Renders without crash
    it('renders without crash', () => {
        renderPanel()
        expect(screen.getByRole('dialog')).toBeDefined()
    })

    // 2. Shows the panel header
    it('shows "Governance Rules" heading', () => {
        renderPanel()
        expect(screen.getByText('Governance Rules')).toBeDefined()
    })

    // 3. Escape key calls onClose
    it('calls onClose when Escape is pressed', () => {
        const { onClose } = renderPanel()
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledOnce()
    })

    // 4. Backdrop click calls onClose
    it('calls onClose when backdrop is clicked', () => {
        const { onClose } = renderPanel()
        // The backdrop is the outer fixed div (parent of the dialog).
        // role="dialog" is on the inner content div; the backdrop is its grandparent.
        const dialog = screen.getByRole('dialog')
        const backdrop = dialog.parentElement!.parentElement!
        fireEvent.click(backdrop)
        expect(onClose).toHaveBeenCalledOnce()
    })

    // 5. focusRuleId — the Rules tab is active (not Packs or Profiles)
    it('activates the Rules tab when focusRuleId is provided', () => {
        renderPanel({ focusRuleId: 'MITHRIL-COL' })
        // The Rules tab button should have the active indigo border style
        const rulesTab = screen.getByRole('button', { name: 'Rules' })
        expect(rulesTab.className).toMatch(/border-indigo-500/)
    })

    // 6. focusRuleId — filters category sidebar to the matching rule's category
    it('sets the category to the matching rule category when focusRuleId is provided', async () => {
        // MITHRIL-COL is in the "Color" category per governanceRulesManifest
        renderPanel({ focusRuleId: 'MITHRIL-COL' })

        // The Color category button should have active styling
        await waitFor(() => {
            const colorBtn = screen.getByRole('button', { name: /^Color/ })
            expect(colorBtn.className).toMatch(/bg-indigo-600/)
        })
    })

    // 7. focusRuleId — applies the highlight ring class to the matched rule row
    it('applies highlight ring to the focused rule row', async () => {
        renderPanel({ focusRuleId: 'MITHRIL-COL' })

        await waitFor(() => {
            const focusedRow = document.querySelector('[class*="ring-indigo-500"]')
            expect(focusedRow).not.toBeNull()
        })
    })

    // 8. Unknown focusRuleId — renders without crash (graceful fallback to All category)
    it('renders without crash when focusRuleId does not match any rule', () => {
        // Should not throw; the panel opens with All category and rules tab
        renderPanel({ focusRuleId: 'UNKNOWN-RULE-999' })
        expect(screen.getByText('Governance Rules')).toBeDefined()
    })

    // 9. No focusRuleId — panel opens showing the "All" category in Rules tab
    it('shows the All category by default when focusRuleId is not provided', () => {
        renderPanel()
        // The "All" sidebar button should have the active indigo styling
        const allBtn = screen.getByRole('button', { name: /^All/ })
        expect(allBtn.className).toMatch(/bg-indigo-600/)
    })
})
