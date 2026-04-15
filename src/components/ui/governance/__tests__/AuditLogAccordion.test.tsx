/**
 * AuditLogAccordion.test.tsx — T30
 *
 * Covers C15: COUNSEL.4.5 Lazy Audit Log accordion.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuditLogAccordion, type AuditLogEntry } from '../AuditLogAccordion'

const noop = () => {}

const sampleEntries: AuditLogEntry[] = [
    {
        id: 1,
        timestamp: new Date(Date.now() - 60_000).toISOString(),
        action: 'audit scan',
        filePath: '/src/components/Button.tsx',
        description: 'Full Mithril + Warden audit',
    },
    {
        id: 2,
        timestamp: new Date(Date.now() - 3600_000).toISOString(),
        action: 'fix applied',
        filePath: '/src/components/Header.tsx',
        description: 'Fixed color-drift on header',
    },
    {
        id: 3,
        timestamp: new Date(Date.now() - 86400_000).toISOString(),
        action: 'override set',
        filePath: '/src/App.tsx',
        description: 'Manual override on layout',
    },
]

describe('AuditLogAccordion', () => {
    it('renders the accordion toggle button', () => {
        render(
            <AuditLogAccordion
                isOpen={false}
                onToggle={noop}
                auditLog={[]}
                auditLogLoaded={false}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByTestId('audit-log-toggle')).toBeDefined()
        expect(screen.getByText('Audit Log')).toBeDefined()
    })

    it('does not render list content when closed', () => {
        render(
            <AuditLogAccordion
                isOpen={false}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.queryByTestId('audit-log-list')).toBeNull()
    })

    it('renders list content when open', () => {
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByTestId('audit-log-list')).toBeDefined()
    })

    it('shows loading state when loading and not yet loaded', () => {
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={[]}
                auditLogLoaded={false}
                auditLogLoading={true}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByText('Loading audit log...')).toBeDefined()
    })

    it('shows empty state when loaded with no entries', () => {
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={[]}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByTestId('audit-log-empty')).toBeDefined()
        expect(screen.getByText('No audit events yet')).toBeDefined()
    })

    it('renders audit log entries when available', () => {
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByTestId('audit-log-entry-1')).toBeDefined()
        expect(screen.getByTestId('audit-log-entry-2')).toBeDefined()
        expect(screen.getByTestId('audit-log-entry-3')).toBeDefined()
    })

    it('renders entry action text', () => {
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByText('audit scan')).toBeDefined()
        expect(screen.getByText('fix applied')).toBeDefined()
    })

    it('shows count badge when loaded with entries', () => {
        render(
            <AuditLogAccordion
                isOpen={false}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByText('3')).toBeDefined()
    })

    it('appends "+" to count when auditLogHasMore is true', () => {
        render(
            <AuditLogAccordion
                isOpen={false}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={true}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByText('3+')).toBeDefined()
    })

    it('shows "Load more" button when auditLogHasMore is true', () => {
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={true}
                onLoadMore={noop}
            />,
        )
        expect(screen.getByTestId('audit-log-load-more')).toBeDefined()
        expect(screen.getByText('Load more')).toBeDefined()
    })

    it('does not show "Load more" when auditLogHasMore is false', () => {
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.queryByTestId('audit-log-load-more')).toBeNull()
    })

    it('calls onLoadMore when "Load more" is clicked', () => {
        const handler = vi.fn()
        render(
            <AuditLogAccordion
                isOpen={true}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={true}
                auditLogLoading={false}
                auditLogHasMore={true}
                onLoadMore={handler}
            />,
        )
        fireEvent.click(screen.getByTestId('audit-log-load-more'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('calls onToggle when the toggle button is clicked', () => {
        const handler = vi.fn()
        render(
            <AuditLogAccordion
                isOpen={false}
                onToggle={handler}
                auditLog={[]}
                auditLogLoaded={false}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        fireEvent.click(screen.getByTestId('audit-log-toggle'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('does not show count badge when auditLogLoaded is false', () => {
        render(
            <AuditLogAccordion
                isOpen={false}
                onToggle={noop}
                auditLog={sampleEntries}
                auditLogLoaded={false}
                auditLogLoading={false}
                auditLogHasMore={false}
                onLoadMore={noop}
            />,
        )
        expect(screen.queryByText('3')).toBeNull()
    })
})
