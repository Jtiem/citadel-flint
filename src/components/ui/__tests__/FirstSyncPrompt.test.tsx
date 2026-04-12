/**
 * FirstSyncPrompt.test.tsx — MINT.4a tests
 *
 * FSP-01: Renders when figmaConnected is true and tokenCount > 0
 * FSP-02: Does not render when figmaConnected is false
 * FSP-03: Does not render when tokenCount is 0
 * FSP-04: Shows correct token count (singular)
 * FSP-05: Shows correct token count (plural)
 * FSP-06: Clicking "Review tokens" calls onNavigateToTokens
 * FSP-07: Clicking "Review tokens" dismisses the prompt
 * FSP-08: Clicking dismiss button hides the prompt
 * FSP-09: Persists dismissal to localStorage
 * FSP-10: Does not render when already dismissed in localStorage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FirstSyncPrompt } from '../FirstSyncPrompt'

beforeEach(() => {
    localStorage.clear()
})

describe('FirstSyncPrompt — MINT.4a', () => {
    const defaultProps = {
        figmaConnected: true,
        tokenCount: 42,
        projectPath: '/test/project',
        onNavigateToTokens: vi.fn(),
    }

    it('FSP-01: renders when figmaConnected and tokenCount > 0', () => {
        render(<FirstSyncPrompt {...defaultProps} />)
        expect(screen.getByTestId('first-sync-prompt')).toBeTruthy()
    })

    it('FSP-02: does not render when figmaConnected is false', () => {
        render(<FirstSyncPrompt {...defaultProps} figmaConnected={false} />)
        expect(screen.queryByTestId('first-sync-prompt')).toBeNull()
    })

    it('FSP-03: does not render when tokenCount is 0', () => {
        render(<FirstSyncPrompt {...defaultProps} tokenCount={0} />)
        expect(screen.queryByTestId('first-sync-prompt')).toBeNull()
    })

    it('FSP-04: shows singular token count', () => {
        render(<FirstSyncPrompt {...defaultProps} tokenCount={1} />)
        expect(screen.getByTestId('first-sync-count').textContent).toBe('1 token imported')
    })

    it('FSP-05: shows plural token count', () => {
        render(<FirstSyncPrompt {...defaultProps} tokenCount={42} />)
        expect(screen.getByTestId('first-sync-count').textContent).toBe('42 tokens imported')
    })

    it('FSP-06: clicking Review tokens calls onNavigateToTokens', () => {
        const onNav = vi.fn()
        render(<FirstSyncPrompt {...defaultProps} onNavigateToTokens={onNav} />)
        fireEvent.click(screen.getByTestId('first-sync-review-button'))
        expect(onNav).toHaveBeenCalledOnce()
    })

    it('FSP-07: clicking Review tokens dismisses the prompt', () => {
        render(<FirstSyncPrompt {...defaultProps} />)
        expect(screen.getByTestId('first-sync-prompt')).toBeTruthy()
        fireEvent.click(screen.getByTestId('first-sync-review-button'))
        expect(screen.queryByTestId('first-sync-prompt')).toBeNull()
    })

    it('FSP-08: clicking dismiss button hides the prompt', () => {
        render(<FirstSyncPrompt {...defaultProps} />)
        expect(screen.getByTestId('first-sync-prompt')).toBeTruthy()
        fireEvent.click(screen.getByTestId('first-sync-dismiss'))
        expect(screen.queryByTestId('first-sync-prompt')).toBeNull()
    })

    it('FSP-09: persists dismissal to localStorage', () => {
        render(<FirstSyncPrompt {...defaultProps} />)
        fireEvent.click(screen.getByTestId('first-sync-dismiss'))
        expect(localStorage.getItem('flint:first-sync-dismissed:/test/project')).toBe('true')
    })

    it('FSP-10: does not render when already dismissed in localStorage', () => {
        localStorage.setItem('flint:first-sync-dismissed:/test/project', 'true')
        render(<FirstSyncPrompt {...defaultProps} />)
        expect(screen.queryByTestId('first-sync-prompt')).toBeNull()
    })
})
