import { describe, it, expect } from 'vitest';
import {
  type IntegrationReport,
  type CheckOutcome,
  type CheckCategory,
  type InvariantVerification,
  type NonGoalVerification,
  type AudienceFidelity,
  REQUIRED_CHECK_CATEGORIES,
  deriveIntegrationVerdict,
  validateIntegrationReport,
  checkContractCoverage,
} from '../integration-schema';

// ─── Fixtures ────────────────────────────────────────────────────────

const passingCheck = (category: CheckCategory, summary = 'ok'): CheckOutcome => ({
  category,
  result: 'pass',
  summary,
});

const allPassingChecks = (): CheckOutcome[] =>
  REQUIRED_CHECK_CATEGORIES.map(c => passingCheck(c));

const validInvariant: InvariantVerification = {
  name: 'tokenLookup-p95',
  declaredThreshold: '< 200ms at N=1000',
  measured: '178ms at N=1000',
  met: true,
};

const validNonGoal: NonGoalVerification = {
  nonGoal: 'Real-time sync',
  respected: true,
};

const validAudience: AudienceFidelity = {
  declaredAudience: 'designer',
  actualSurfaces: ['src/', 'electron/'],
  consistent: true,
};

const basicReport = (overrides: Partial<IntegrationReport> = {}): IntegrationReport => {
  const checks = overrides.checks ?? allPassingChecks();
  const invariants = overrides.invariants ?? [validInvariant];
  const nonGoals = overrides.nonGoals ?? [validNonGoal];
  const audience = overrides.audience ?? validAudience;
  const base: IntegrationReport = {
    meta: {
      feature: 'TestFeature',
      phase: 'T.1',
      validator: 'flint-integration-validator',
      date: '2026-04-17',
      round: 1,
      contractFile: '.flint-context/contracts/T.1.contract.ts',
      ...(overrides.meta ?? {}),
    },
    verdict: 'SHIP',
    checks,
    invariants,
    nonGoals,
    audience,
    fixes: [],
    ...overrides,
  };
  // Re-derive verdict from the final state so fixtures are self-consistent
  base.verdict = overrides.verdict ?? deriveIntegrationVerdict(base);
  return base;
};

// ─── deriveIntegrationVerdict ────────────────────────────────────────

describe('deriveIntegrationVerdict', () => {
  it('returns SHIP when everything passes', () => {
    const report = basicReport();
    expect(deriveIntegrationVerdict(report)).toBe('SHIP');
  });

  it('returns FIX when a check fails', () => {
    const checks = allPassingChecks();
    checks[0] = {
      category: 'type-check',
      result: 'fail',
      summary: '3 TS errors',
      violations: [{ file: 'src/foo.ts', description: 'TS2339' }],
    };
    const report = basicReport({ checks });
    expect(deriveIntegrationVerdict(report)).toBe('FIX');
  });

  it('returns FIX when an invariant is unmet', () => {
    const invariants = [{ ...validInvariant, measured: '250ms at N=1000', met: false }];
    const report = basicReport({ invariants });
    expect(deriveIntegrationVerdict(report)).toBe('FIX');
  });

  it('returns FIX when an invariant is unmeasured', () => {
    const invariants = [{ ...validInvariant, measured: 'n/a', met: false, unableToMeasure: true }];
    const report = basicReport({ invariants });
    expect(deriveIntegrationVerdict(report)).toBe('FIX');
  });

  it('returns FIX when a non-goal is violated', () => {
    const nonGoals = [{
      nonGoal: 'Real-time sync',
      respected: false,
      violations: [{ file: 'src/sync.ts', description: 'Implemented WebSocket sync' }],
    }];
    const report = basicReport({ nonGoals });
    expect(deriveIntegrationVerdict(report)).toBe('FIX');
  });

  it('returns FIX when audience drifts', () => {
    const audience: AudienceFidelity = {
      declaredAudience: 'designer',
      actualSurfaces: ['src/', 'flint-vscode/'],
      consistent: false,
      drift: [{ file: 'flint-vscode/extension.ts', expectedSurface: 'src/' }],
    };
    const report = basicReport({ audience });
    expect(deriveIntegrationVerdict(report)).toBe('FIX');
  });

  it('escalates to REDESIGN on [ARCHITECTURAL] marker', () => {
    const checks = allPassingChecks();
    checks[0] = {
      category: 'type-check',
      result: 'fail',
      summary: 'contract assumes wrong boundary',
      violations: [{ description: '[ARCHITECTURAL] Contract assumes store ownership that violates isolation' }],
    };
    const report = basicReport({ checks });
    expect(deriveIntegrationVerdict(report)).toBe('REDESIGN');
  });

  it('REDESIGN wins over FIX when both conditions present', () => {
    const checks = allPassingChecks();
    // fail + architectural
    checks[0] = {
      category: 'type-check',
      result: 'fail',
      summary: 'x',
      violations: [{ description: '[ARCHITECTURAL] wrong' }],
    };
    // also a normal failure
    checks[1] = {
      category: 'ipc-symmetry',
      result: 'fail',
      summary: 'y',
      violations: [{ description: 'missing preload leg' }],
    };
    const invariants = [{ ...validInvariant, met: false, measured: '500ms' }];
    const report = basicReport({ checks, invariants });
    expect(deriveIntegrationVerdict(report)).toBe('REDESIGN');
  });
});

// ─── validateIntegrationReport ───────────────────────────────────────

describe('validateIntegrationReport', () => {
  it('returns no errors for a well-formed passing report', () => {
    expect(validateIntegrationReport(basicReport())).toEqual([]);
  });

  it('flags missing meta fields', () => {
    const report = basicReport();
    report.meta.feature = '';
    expect(validateIntegrationReport(report)).toContain('meta.feature is required');
  });

  it('flags round < 1', () => {
    const report = basicReport();
    report.meta.round = 0;
    expect(validateIntegrationReport(report).some(e => e.includes('meta.round'))).toBe(true);
  });

  it('flags missing contractFile', () => {
    const report = basicReport();
    report.meta.contractFile = '';
    expect(validateIntegrationReport(report)).toContain('meta.contractFile is required');
  });

  it('flags missing check categories', () => {
    const report = basicReport({ checks: [passingCheck('type-check')] });
    const errors = validateIntegrationReport(report);
    expect(errors.some(e => e.includes('Missing required check category: ipc-symmetry'))).toBe(true);
  });

  it('flags duplicate check categories', () => {
    const checks = allPassingChecks();
    checks.push(passingCheck('type-check'));
    const report = basicReport({ checks });
    expect(validateIntegrationReport(report).some(e => e.includes('Duplicate check category'))).toBe(true);
  });

  it('flags failed check with no violations listed', () => {
    const checks = allPassingChecks();
    checks[0] = { category: 'type-check', result: 'fail', summary: 'fail' };
    const report = basicReport({ checks });
    expect(validateIntegrationReport(report).some(e => e.includes('listed no violations'))).toBe(true);
  });

  it('flags check with no summary', () => {
    const checks = allPassingChecks();
    checks[0].summary = '';
    const report = basicReport({ checks });
    expect(validateIntegrationReport(report).some(e => e.includes('missing summary'))).toBe(true);
  });

  it('flags invariant with no measured value', () => {
    const invariants = [{ ...validInvariant, measured: '' }];
    const report = basicReport({ invariants });
    expect(validateIntegrationReport(report).some(e => e.includes('missing measured value'))).toBe(true);
  });

  it('flags invariant claiming both unableToMeasure and met', () => {
    const invariants = [{ ...validInvariant, unableToMeasure: true, met: true }];
    const report = basicReport({ invariants });
    expect(validateIntegrationReport(report).some(e => e.includes('cannot be "met"'))).toBe(true);
  });

  it('flags duplicate invariant names', () => {
    const invariants = [validInvariant, { ...validInvariant, measured: '99ms' }];
    const report = basicReport({ invariants });
    expect(validateIntegrationReport(report).some(e => e.includes('Duplicate invariant'))).toBe(true);
  });

  it('flags violated non-goal with no evidence', () => {
    const nonGoals = [{ nonGoal: 'Real-time sync', respected: false }];
    const report = basicReport({ nonGoals });
    expect(validateIntegrationReport(report).some(e => e.includes('lists no evidence'))).toBe(true);
  });

  it('flags missing audience.declaredAudience', () => {
    const audience = { ...validAudience, declaredAudience: '' };
    const report = basicReport({ audience });
    expect(validateIntegrationReport(report).some(e => e.includes('declaredAudience'))).toBe(true);
  });

  it('flags inconsistent audience with no drift listed', () => {
    const audience: AudienceFidelity = {
      declaredAudience: 'designer',
      actualSurfaces: ['x'],
      consistent: false,
    };
    const report = basicReport({ audience });
    expect(validateIntegrationReport(report).some(e => e.includes('no drift entries'))).toBe(true);
  });

  it('flags verdict mismatch (overriding derived)', () => {
    const report = basicReport();
    report.verdict = 'REDESIGN';
    expect(validateIntegrationReport(report).some(e => e.includes('verdict mismatch'))).toBe(true);
  });

  it('flags REDESIGN without redesignReason', () => {
    const checks = allPassingChecks();
    checks[0] = {
      category: 'type-check',
      result: 'fail',
      summary: 'x',
      violations: [{ description: '[ARCHITECTURAL] broken' }],
    };
    const report = basicReport({ checks });
    // verdict auto-derives to REDESIGN but no reason
    expect(validateIntegrationReport(report).some(e => e.includes('requires a non-empty redesignReason'))).toBe(true);
  });

  it('accepts REDESIGN with redesignReason', () => {
    const checks = allPassingChecks();
    checks[0] = {
      category: 'type-check',
      result: 'fail',
      summary: 'x',
      violations: [{ description: '[ARCHITECTURAL] broken' }],
    };
    const report = basicReport({
      checks,
      redesignReason: 'Contract conflates designer and developer audiences',
      fixes: [],
    });
    expect(validateIntegrationReport(report)).toEqual([]);
  });

  it('flags FIX verdict with empty fixes[]', () => {
    const checks = allPassingChecks();
    checks[0] = {
      category: 'type-check',
      result: 'fail',
      summary: '3 errors',
      violations: [{ file: 'a.ts', description: 'TS error' }],
    };
    const report = basicReport({ checks });
    expect(validateIntegrationReport(report).some(e => e.includes('requires at least one entry in fixes'))).toBe(true);
  });

  it('flags SHIP verdict with non-empty fixes[]', () => {
    const report = basicReport({
      fixes: [{
        id: 'FIX-1',
        assignedAgent: 'flint-electron-ipc',
        description: 'do something',
        files: ['a.ts'],
        sourceCategory: 'type-check',
      }],
    });
    expect(validateIntegrationReport(report).some(e => e.includes('should have empty fixes'))).toBe(true);
  });
});

// ─── checkContractCoverage ───────────────────────────────────────────

describe('checkContractCoverage', () => {
  it('returns no errors when report covers all contract entries exactly', () => {
    const report = basicReport();
    const errors = checkContractCoverage(
      report,
      ['tokenLookup-p95'],
      ['Real-time sync']
    );
    expect(errors).toEqual([]);
  });

  it('flags contract invariants missing from report', () => {
    const report = basicReport();
    const errors = checkContractCoverage(
      report,
      ['tokenLookup-p95', 'extraInvariant'],
      ['Real-time sync']
    );
    expect(errors.some(e => e.includes('"extraInvariant" but report does not verify'))).toBe(true);
  });

  it('flags report invariants not in contract (scope creep)', () => {
    const invariants = [
      validInvariant,
      { ...validInvariant, name: 'sneakyInvariant' },
    ];
    const report = basicReport({ invariants });
    const errors = checkContractCoverage(
      report,
      ['tokenLookup-p95'],
      ['Real-time sync']
    );
    expect(errors.some(e => e.includes('"sneakyInvariant" which is not in the contract'))).toBe(true);
  });

  it('flags contract nonGoals missing from report', () => {
    const report = basicReport();
    const errors = checkContractCoverage(
      report,
      ['tokenLookup-p95'],
      ['Real-time sync', 'Undo support']
    );
    expect(errors.some(e => e.includes('"Undo support" but report does not verify'))).toBe(true);
  });
});

// ─── REQUIRED_CHECK_CATEGORIES sanity ────────────────────────────────

describe('REQUIRED_CHECK_CATEGORIES', () => {
  it('has no duplicates', () => {
    expect(new Set(REQUIRED_CHECK_CATEGORIES).size).toBe(REQUIRED_CHECK_CATEGORIES.length);
  });

  it('includes the three v2.1 additions (invariants, non-goals, audience-fidelity)', () => {
    expect(REQUIRED_CHECK_CATEGORIES).toContain('invariants');
    expect(REQUIRED_CHECK_CATEGORIES).toContain('non-goals');
    expect(REQUIRED_CHECK_CATEGORIES).toContain('audience-fidelity');
  });
});
