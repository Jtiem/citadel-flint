/**
 * GLASSTYPO.1 Group C — Canary Visual Regression Tests
 *
 * Validates that the Governance panel canary scope:
 *  1. Carries `data-schema-role` on every interactive/content surface
 *  2. Has at most 1 `cta-primary` per rendered panel surface
 *  3. ViolationsList Section expands when totalViolations > 0 (ctx-driven)
 *  4. Score breakdown Section starts collapsed (always passive)
 *  5. PendingApprovals Section starts expanded when pendingMutations.length > 0
 *  6. PendingApprovals returns null (not a collapsed section) when no approvals
 *  7. No raw `text-zinc-{400..700}` in rendered output (className assertions)
 *
 * These are structural / behavioural tests — not pixel snapshots.
 */

import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Component imports ─────────────────────────────────────────────────────────
import { GovernanceHeader } from '../GovernanceHeader'
import { AnomalyBanner } from '../AnomalyBanner'
import { BatchActionBar } from '../BatchActionBar'
import { PendingApprovalsAccordion } from '../PendingApprovalsAccordion'
import Section from '../../primitives/Section'
import type { SectionContext } from '../../primitives/Section'

// ── Shared stubs ─────────────────────────────────────────────────────────────

const noop = vi.fn()

const defaultHeaderProps = {
  isAuditing: false,
  activeFilePath: '/src/App.tsx',
  totalViolations: 0,
  lastAuditRanAt: null,
  isBaselineSet: false,
  govOverrideCount: 0,
  autopilotEnabled: false,
  lastCleanState: null,
  score: 100,
  onRunAudit: noop,
  onToggleAutopilot: noop,
  onRewindToClean: noop,
}

const makePendingMutation = (id: number) => ({
  id,
  type: 'token-replace',
  filePath: '/src/App.tsx',
  riskScore: 72,
  riskTier: 'Amber',
})

// ── 1. Schema-role coverage ───────────────────────────────────────────────────

describe('GLASSTYPO.1 schema-role coverage', () => {
  it('GovernanceHeader Run Audit button is tagged cta-primary', () => {
    render(<GovernanceHeader {...defaultHeaderProps} />)
    const btn = screen.getByTestId('run-audit-button')
    expect(btn).toHaveAttribute('data-schema-role', 'cta-primary')
  })

  it('GovernanceHeader Autopilot toggle is tagged cta-secondary when violations exist', () => {
    // Autopilot toggle only renders when totalViolations > 0
    render(<GovernanceHeader {...defaultHeaderProps} totalViolations={3} />)
    const toggle = screen.getByTestId('autopilot-header-toggle')
    expect(toggle).toHaveAttribute('data-schema-role', 'cta-secondary')
  })

  it('AnomalyBanner container is tagged state-signal', () => {
    render(
      <AnomalyBanner
        anomalies={[{ type: 'mutation_spike', severity: 'high', message: 'Spike detected', detected_at: new Date().toISOString() }]}
        isDismissed={false}
        onDismiss={noop}
      />
    )
    const banner = screen.getByTestId('anomaly-alert-banner')
    expect(banner).toHaveAttribute('data-schema-role', 'state-signal')
  })

  it('Section primitive root carries data-schema-role="primary-content"', () => {
    const ctx: SectionContext = {
      score: 0,
      totalViolations: 0,
      pendingApprovals: 0,
      hasRuntimeViolations: false,
    }
    const { container } = render(
      <Section
        title="Test Section"
        schemaRole="primary-content"
        expandedWhen={() => false}
        ctx={ctx}
        id="test-section"
      >
        <p>content</p>
      </Section>
    )
    const root = container.querySelector('[data-schema-role="primary-content"]')
    expect(root).not.toBeNull()
  })
})

// ── 2. CTA-primary cap (at most 1 per panel surface) ─────────────────────────

describe('GLASSTYPO.1 cta-primary cap', () => {
  it('GovernanceHeader renders exactly one cta-primary element', () => {
    const { container } = render(<GovernanceHeader {...defaultHeaderProps} />)
    const primaries = container.querySelectorAll('[data-schema-role="cta-primary"]')
    expect(primaries.length).toBe(1)
  })

  it('BatchActionBar renders zero cta-primary elements (all buttons are cta-secondary)', () => {
    const { container } = render(
      <BatchActionBar
        acceptedCount={3}
        autoFixableCount={2}
        a11yFixableCount={1}
        manualCount={0}
        onApplyAccepted={noop}
        onAutoFixMithril={noop}
        onFixAllA11y={noop}
        onReviewManual={noop}
      />
    )
    const primaries = container.querySelectorAll('[data-schema-role="cta-primary"]')
    expect(primaries.length).toBe(0)
  })

  it('PendingApprovalsAccordion renders zero cta-primary elements', () => {
    const { container } = render(
      <PendingApprovalsAccordion
        isOpen={true}
        onToggle={noop}
        pendingMutations={[makePendingMutation(1)]}
        onApprove={noop}
        onReject={noop}
      />
    )
    const primaries = container.querySelectorAll('[data-schema-role="cta-primary"]')
    expect(primaries.length).toBe(0)
  })
})

// ── 3. expandedWhen contract ──────────────────────────────────────────────────

describe('GLASSTYPO.1 expandedWhen contract', () => {
  it('Section with expandedWhen: () => false starts collapsed (passive info)', () => {
    const ctx: SectionContext = {
      score: 85,
      totalViolations: 10,
      pendingApprovals: 0,
      hasRuntimeViolations: false,
    }
    const { container } = render(
      <Section
        title="Score Breakdown"
        schemaRole="primary-content"
        expandedWhen={() => false}
        ctx={ctx}
        id="score-bd"
      >
        <p data-testid="score-bd-body">breakdown</p>
      </Section>
    )
    const region = container.querySelector('[role="region"]')
    expect(region).toHaveAttribute('hidden')
  })

  it('Section with expandedWhen: ctx => ctx.totalViolations > 0 expands when violations exist', () => {
    const ctx: SectionContext = {
      score: 70,
      totalViolations: 5,
      pendingApprovals: 0,
      hasRuntimeViolations: false,
    }
    const { container } = render(
      <Section
        title="Violations"
        schemaRole="primary-content"
        expandedWhen={(c) => c.totalViolations > 0}
        ctx={ctx}
        id="violations-sec"
      >
        <p data-testid="violations-body">items here</p>
      </Section>
    )
    const region = container.querySelector('[role="region"]')
    expect(region).not.toHaveAttribute('hidden')
  })

  it('Section with expandedWhen: ctx => ctx.totalViolations > 0 collapses when none', () => {
    const ctx: SectionContext = {
      score: 100,
      totalViolations: 0,
      pendingApprovals: 0,
      hasRuntimeViolations: false,
    }
    const { container } = render(
      <Section
        title="Violations"
        schemaRole="primary-content"
        expandedWhen={(c) => c.totalViolations > 0}
        ctx={ctx}
        id="violations-sec-empty"
      >
        <p data-testid="violations-body-empty">items here</p>
      </Section>
    )
    const region = container.querySelector('[role="region"]')
    expect(region).toHaveAttribute('hidden')
  })

  it('PendingApprovalsAccordion renders when pendingMutations are present', () => {
    render(
      <PendingApprovalsAccordion
        isOpen={true}
        onToggle={noop}
        pendingMutations={[makePendingMutation(1), makePendingMutation(2)]}
        onApprove={noop}
        onReject={noop}
      />
    )
    expect(screen.getByTestId('pending-approvals-section')).toBeInTheDocument()
    // Both mutations are rendered
    expect(screen.getByTestId('pending-mutation-1')).toBeInTheDocument()
    expect(screen.getByTestId('pending-mutation-2')).toBeInTheDocument()
  })

  it('PendingApprovalsAccordion returns null when no pending mutations', () => {
    const { container } = render(
      <PendingApprovalsAccordion
        isOpen={false}
        onToggle={noop}
        pendingMutations={[]}
        onApprove={noop}
        onReject={noop}
      />
    )
    // null render — nothing in the container
    expect(container.firstChild).toBeNull()
  })
})

// ── 4. No raw zinc-{400..700} text classes in rendered output ─────────────────

describe('GLASSTYPO.1 I2: no text-zinc-{400..700} in rendered className strings', () => {
  const FORBIDDEN = /text-zinc-(400|500|600|700)/

  function getViolatingClasses(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('[class]'))
      .map(el => el.getAttribute('class') ?? '')
      .filter(c => FORBIDDEN.test(c))
  }

  it('GovernanceHeader: no forbidden zinc text classes', () => {
    const { container } = render(<GovernanceHeader {...defaultHeaderProps} />)
    expect(getViolatingClasses(container)).toHaveLength(0)
  })

  it('AnomalyBanner: no forbidden zinc text classes', () => {
    const { container } = render(
      <AnomalyBanner
        anomalies={[{ type: 'override_spike', severity: 'medium', message: '2 anomalies', detected_at: new Date().toISOString() }]}
        isDismissed={false}
        onDismiss={noop}
      />
    )
    expect(getViolatingClasses(container)).toHaveLength(0)
  })

  it('BatchActionBar: no forbidden zinc text classes', () => {
    const { container } = render(
      <BatchActionBar
        acceptedCount={2}
        autoFixableCount={1}
        a11yFixableCount={1}
        manualCount={0}
        onApplyAccepted={noop}
        onAutoFixMithril={noop}
        onFixAllA11y={noop}
        onReviewManual={noop}
      />
    )
    expect(getViolatingClasses(container)).toHaveLength(0)
  })

  it('PendingApprovalsAccordion: no forbidden zinc text classes', () => {
    const { container } = render(
      <PendingApprovalsAccordion
        isOpen={true}
        onToggle={noop}
        pendingMutations={[makePendingMutation(1)]}
        onApprove={noop}
        onReject={noop}
      />
    )
    expect(getViolatingClasses(container)).toHaveLength(0)
  })
})

// ── 5. Section keyboard accessibility ────────────────────────────────────────

describe('GLASSTYPO.1 Section ARIA accessibility', () => {
  it('trigger button has aria-expanded reflecting initial open state', () => {
    const ctx: SectionContext = {
      score: 0,
      totalViolations: 0,
      pendingApprovals: 0,
      hasRuntimeViolations: false,
    }
    render(
      <Section
        title="Keyboard Test"
        schemaRole="primary-content"
        expandedWhen={() => true}
        ctx={ctx}
        id="kbtest"
      >
        <p>body</p>
      </Section>
    )
    const trigger = screen.getByRole('button', { name: /Keyboard Test/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('trigger aria-controls points to a real DOM element', () => {
    const ctx: SectionContext = {
      score: 0,
      totalViolations: 0,
      pendingApprovals: 0,
      hasRuntimeViolations: false,
    }
    render(
      <Section
        title="A11y Section"
        schemaRole="primary-content"
        expandedWhen={() => false}
        ctx={ctx}
        id="a11y-section"
      >
        <p>body</p>
      </Section>
    )
    const trigger = screen.getByRole('button', { name: /A11y Section/i })
    const controlsId = trigger.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    expect(document.getElementById(controlsId!)).not.toBeNull()
  })

  it('collapsed region has aria-hidden="true"', () => {
    const ctx: SectionContext = {
      score: 0,
      totalViolations: 0,
      pendingApprovals: 0,
      hasRuntimeViolations: false,
    }
    const { container } = render(
      <Section
        title="Collapsed"
        schemaRole="primary-content"
        expandedWhen={() => false}
        ctx={ctx}
        id="collapsed-test"
      >
        <p>body</p>
      </Section>
    )
    const region = container.querySelector('[role="region"]')
    expect(region).toHaveAttribute('aria-hidden', 'true')
  })
})
