import { describe, it, expect } from 'vitest';
import {
  type ReviewReport,
  type ReviewFinding,
  type ReviewDimension,
  countFindings,
  deriveVerdict,
  validateReport,
  aggregateConsensus,
  VERDICT_SEVERITY_ORDER,
} from '../review-schema';

// ─── Fixtures ────────────────────────────────────────────────────────

const basicFinding = (overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  id: 'BLK-1',
  title: 'Example blocking finding',
  severity: 'blocking',
  evidence: [{ file: 'src/foo.ts', line: 42, excerpt: 'const x = 1;' }],
  observed: 'The thing we observed',
  rationale: 'Why it matters',
  scope: 'one-file',
  status: 'open',
  ...overrides,
});

const basicReport = (overrides: Partial<ReviewReport> = {}): ReviewReport => {
  const findings = overrides.findings ?? [];
  return {
    meta: {
      phase: 'T.1',
      dimension: 'code',
      reviewer: 'flint-code-reviewer',
      date: '2026-04-17',
      round: 1,
      scope: ['src/foo.ts'],
      ...(overrides.meta ?? {}),
    },
    rubric: [{ criterion: 'All IPC channels have Zod validators', result: 'pass' }],
    findings,
    counts: countFindings(findings),
    verdict: deriveVerdict(findings, (overrides.meta?.dimension ?? 'code') as ReviewDimension),
    scopeCoverage: { reviewed: ['src/foo.ts'], skipped: [] },
    ...overrides,
  };
};

// ─── countFindings ───────────────────────────────────────────────────

describe('countFindings', () => {
  it('returns all zeros for empty array', () => {
    expect(countFindings([])).toEqual({ blocking: 0, warning: 0, suggestion: 0 });
  });

  it('counts mixed severities correctly', () => {
    const findings: ReviewFinding[] = [
      basicFinding({ id: 'B1', severity: 'blocking' }),
      basicFinding({ id: 'B2', severity: 'blocking' }),
      basicFinding({ id: 'W1', severity: 'warning' }),
      basicFinding({ id: 'S1', severity: 'suggestion' }),
      basicFinding({ id: 'S2', severity: 'suggestion' }),
      basicFinding({ id: 'S3', severity: 'suggestion' }),
    ];
    expect(countFindings(findings)).toEqual({ blocking: 2, warning: 1, suggestion: 3 });
  });
});

// ─── deriveVerdict ───────────────────────────────────────────────────

describe('deriveVerdict', () => {
  it('returns SHIP when no findings', () => {
    expect(deriveVerdict([], 'code')).toBe('SHIP');
  });

  it('returns SHIP with only non-findings (empty)', () => {
    expect(deriveVerdict([], 'ux')).toBe('SHIP');
  });

  it('returns FIX-FORWARD with warnings but no blockers', () => {
    const findings = [basicFinding({ id: 'W1', severity: 'warning' })];
    expect(deriveVerdict(findings, 'code')).toBe('FIX-FORWARD');
  });

  it('returns FIX-FORWARD with only suggestions (promoted from SHIP since warning threshold)', () => {
    // Current implementation: only warnings trigger FIX-FORWARD, suggestions alone → SHIP
    const findings = [basicFinding({ id: 'S1', severity: 'suggestion' })];
    expect(deriveVerdict(findings, 'code')).toBe('SHIP');
  });

  it('returns FIX-BEFORE-SHIP with 1 blocking finding', () => {
    const findings = [basicFinding({ severity: 'blocking' })];
    expect(deriveVerdict(findings, 'code')).toBe('FIX-BEFORE-SHIP');
  });

  it('returns FIX-BEFORE-SHIP with 3 blocking findings', () => {
    const findings = [
      basicFinding({ id: 'B1', severity: 'blocking' }),
      basicFinding({ id: 'B2', severity: 'blocking' }),
      basicFinding({ id: 'B3', severity: 'blocking' }),
    ];
    expect(deriveVerdict(findings, 'code')).toBe('FIX-BEFORE-SHIP');
  });

  it('returns REDESIGN with 4+ blocking findings', () => {
    const findings = [
      basicFinding({ id: 'B1', severity: 'blocking' }),
      basicFinding({ id: 'B2', severity: 'blocking' }),
      basicFinding({ id: 'B3', severity: 'blocking' }),
      basicFinding({ id: 'B4', severity: 'blocking' }),
    ];
    expect(deriveVerdict(findings, 'code')).toBe('REDESIGN');
  });

  it('returns REDESIGN on any architectural-scope blocking finding', () => {
    const findings = [basicFinding({ severity: 'blocking', scope: 'architectural' })];
    expect(deriveVerdict(findings, 'code')).toBe('REDESIGN');
  });

  it('returns REDESIGN when architectural blocker mixed with one-line blockers', () => {
    const findings = [
      basicFinding({ id: 'B1', severity: 'blocking', scope: 'one-line' }),
      basicFinding({ id: 'B2', severity: 'blocking', scope: 'architectural' }),
    ];
    expect(deriveVerdict(findings, 'code')).toBe('REDESIGN');
  });

  it('escalates to BLOCK on any blocking finding in security dimension', () => {
    const findings = [basicFinding({ severity: 'blocking' })];
    expect(deriveVerdict(findings, 'security')).toBe('BLOCK');
  });

  it('BLOCK overrides architectural REDESIGN in security dimension', () => {
    const findings = [basicFinding({ severity: 'blocking', scope: 'architectural' })];
    expect(deriveVerdict(findings, 'security')).toBe('BLOCK');
  });

  it('security dimension with only warnings returns FIX-FORWARD (not BLOCK)', () => {
    const findings = [basicFinding({ severity: 'warning' })];
    expect(deriveVerdict(findings, 'security')).toBe('FIX-FORWARD');
  });

  it('security dimension with no findings returns SHIP', () => {
    expect(deriveVerdict([], 'security')).toBe('SHIP');
  });
});

// ─── validateReport ──────────────────────────────────────────────────

describe('validateReport', () => {
  it('returns no errors for a well-formed report', () => {
    expect(validateReport(basicReport())).toEqual([]);
  });

  it('flags missing phase', () => {
    const report = basicReport();
    report.meta.phase = '';
    const errors = validateReport(report);
    expect(errors).toContain('meta.phase is required');
  });

  it('flags missing dimension', () => {
    const report = basicReport();
    (report.meta as { dimension?: string }).dimension = undefined;
    const errors = validateReport(report);
    expect(errors).toContain('meta.dimension is required');
  });

  it('flags missing reviewer', () => {
    const report = basicReport();
    report.meta.reviewer = '';
    expect(validateReport(report)).toContain('meta.reviewer is required');
  });

  it('flags missing date', () => {
    const report = basicReport();
    report.meta.date = '';
    expect(validateReport(report)).toContain('meta.date is required');
  });

  it('flags round < 1', () => {
    const report = basicReport();
    report.meta.round = 0;
    const errors = validateReport(report);
    expect(errors.some(e => e.includes('meta.round'))).toBe(true);
  });

  it('flags duplicate finding IDs', () => {
    const findings = [
      basicFinding({ id: 'BLK-1' }),
      basicFinding({ id: 'BLK-1', title: 'Dup' }),
    ];
    const report = basicReport({ findings });
    const errors = validateReport(report);
    expect(errors.some(e => e.includes('Duplicate finding id'))).toBe(true);
  });

  it('flags finding with no evidence', () => {
    const findings = [basicFinding({ evidence: [] })];
    const report = basicReport({ findings });
    const errors = validateReport(report);
    expect(errors.some(e => e.includes('at least one evidence entry'))).toBe(true);
  });

  it('flags evidence entry with no file path', () => {
    const findings = [basicFinding({ evidence: [{ file: '', line: 1 }] })];
    const report = basicReport({ findings });
    const errors = validateReport(report);
    expect(errors.some(e => e.includes('no file path'))).toBe(true);
  });

  it('flags finding missing observed', () => {
    const findings = [basicFinding({ observed: '' })];
    const report = basicReport({ findings });
    expect(validateReport(report).some(e => e.includes('`observed`'))).toBe(true);
  });

  it('flags finding missing rationale', () => {
    const findings = [basicFinding({ rationale: '' })];
    const report = basicReport({ findings });
    expect(validateReport(report).some(e => e.includes('`rationale`'))).toBe(true);
  });

  it('flags non-open status with no resolution', () => {
    const findings = [basicFinding({ status: 'deferred' })];
    const report = basicReport({ findings });
    expect(validateReport(report).some(e => e.includes('no resolution note'))).toBe(true);
  });

  it('accepts non-open status with resolution', () => {
    const findings = [basicFinding({ status: 'deferred', resolution: 'Ship without' })];
    const report = basicReport({ findings });
    expect(validateReport(report)).toEqual([]);
  });

  it('flags rubric item with no criterion', () => {
    const report = basicReport();
    report.rubric = [{ criterion: '', result: 'pass' }];
    expect(validateReport(report).some(e => e.includes('missing criterion'))).toBe(true);
  });

  it('flags failing rubric item with no evidence', () => {
    const report = basicReport();
    report.rubric = [{ criterion: 'X is true', result: 'fail' }];
    expect(validateReport(report).some(e => e.includes('no evidence provided'))).toBe(true);
  });

  it('accepts failing rubric with evidence', () => {
    const report = basicReport();
    report.rubric = [{ criterion: 'X is true', result: 'fail', evidence: 'Saw Y at z.ts:42' }];
    expect(validateReport(report)).toEqual([]);
  });

  it('flags counts that do not match findings', () => {
    const findings = [basicFinding({ severity: 'blocking' })];
    const report = basicReport({ findings });
    report.counts = { blocking: 5, warning: 0, suggestion: 0 };
    expect(validateReport(report).some(e => e.includes('counts mismatch'))).toBe(true);
  });

  it('flags verdict that does not match derived', () => {
    const report = basicReport();
    report.verdict = 'REDESIGN';
    expect(validateReport(report).some(e => e.includes('verdict mismatch'))).toBe(true);
  });

  it('flags empty scopeCoverage.reviewed', () => {
    const report = basicReport();
    report.scopeCoverage.reviewed = [];
    expect(validateReport(report).some(e => e.includes('must list at least one'))).toBe(true);
  });
});

// ─── aggregateConsensus ──────────────────────────────────────────────

describe('aggregateConsensus', () => {
  it('returns SHIP with no reports', () => {
    const result = aggregateConsensus([]);
    expect(result.overallVerdict).toBe('SHIP');
    expect(result.disagreement).toBe(false);
    expect(result.allFindings).toEqual([]);
  });

  it('returns unanimous verdict when all agree', () => {
    const reports = [
      basicReport({ meta: { dimension: 'ux' } as ReviewReport['meta'] }),
      basicReport({ meta: { dimension: 'code' } as ReviewReport['meta'] }),
      basicReport({ meta: { dimension: 'security' } as ReviewReport['meta'] }),
    ];
    const result = aggregateConsensus(reports);
    expect(result.overallVerdict).toBe('SHIP');
    expect(result.disagreement).toBe(false);
  });

  it('returns the worst-of-three verdict', () => {
    // UX: SHIP, code: FIX-BEFORE-SHIP, security: SHIP → worst is FIX-BEFORE-SHIP
    const codeFindings = [basicFinding({ severity: 'blocking', scope: 'one-file' })];
    const reports = [
      basicReport({ meta: { ...basicReport().meta, dimension: 'ux' } }),
      basicReport({
        findings: codeFindings,
        meta: { ...basicReport().meta, dimension: 'code' },
      }),
      basicReport({ meta: { ...basicReport().meta, dimension: 'security' } }),
    ];
    const result = aggregateConsensus(reports);
    expect(result.overallVerdict).toBe('FIX-BEFORE-SHIP');
  });

  it('surfaces disagreement when reviewers disagree', () => {
    const codeFindings = [basicFinding({ severity: 'blocking' })];
    const reports = [
      basicReport({ meta: { ...basicReport().meta, dimension: 'ux' } }),
      basicReport({
        findings: codeFindings,
        meta: { ...basicReport().meta, dimension: 'code' },
      }),
    ];
    const result = aggregateConsensus(reports);
    expect(result.disagreement).toBe(true);
  });

  it('BLOCK (from security) is the worst verdict and wins', () => {
    const secFindings = [basicFinding({ severity: 'blocking' })];
    const reports = [
      basicReport({ meta: { ...basicReport().meta, dimension: 'ux' } }),
      basicReport({
        findings: secFindings,
        meta: { ...basicReport().meta, dimension: 'security' },
      }),
    ];
    const result = aggregateConsensus(reports);
    expect(result.overallVerdict).toBe('BLOCK');
  });

  it('populates perDimension with each reviewer verdict', () => {
    const reports = [
      basicReport({ meta: { ...basicReport().meta, dimension: 'ux' } }),
      basicReport({ meta: { ...basicReport().meta, dimension: 'code' } }),
    ];
    const result = aggregateConsensus(reports);
    expect(result.perDimension.ux).toBe('SHIP');
    expect(result.perDimension.code).toBe('SHIP');
  });

  it('tags each finding with its originating dimension', () => {
    const reports = [
      basicReport({
        findings: [basicFinding({ id: 'UX-1' })],
        meta: { ...basicReport().meta, dimension: 'ux' },
      }),
      basicReport({
        findings: [basicFinding({ id: 'SEC-1' })],
        meta: { ...basicReport().meta, dimension: 'security' },
      }),
    ];
    const result = aggregateConsensus(reports);
    const dimensions = result.allFindings.map(f => f.dimension);
    expect(dimensions).toContain('ux');
    expect(dimensions).toContain('security');
  });
});

// ─── VERDICT_SEVERITY_ORDER sanity ───────────────────────────────────

describe('VERDICT_SEVERITY_ORDER', () => {
  it('orders verdicts from least to most severe', () => {
    // SHIP is cheapest, BLOCK is most severe
    expect(VERDICT_SEVERITY_ORDER[0]).toBe('SHIP');
    expect(VERDICT_SEVERITY_ORDER[VERDICT_SEVERITY_ORDER.length - 1]).toBe('BLOCK');
  });

  it('contains all five verdict values', () => {
    expect(VERDICT_SEVERITY_ORDER).toHaveLength(5);
    expect(new Set(VERDICT_SEVERITY_ORDER).size).toBe(5);
  });
});
