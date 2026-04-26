/**
 * Integration Schema — Machine-readable Phase 3 validator output.
 *
 * Phase 3 of the Contract-First Feature Build workflow runs after parallel
 * implementation agents complete. Historically, flint-integration-validator
 * returned narrative SHIP/FIX/REDESIGN verdicts — prose rationale, no mechanical
 * verification of contract claims.
 *
 * This schema closes the loop opened by contract-schema v2:
 *   Contract v2 declares `invariants` (falsifiable), `nonGoals`, `audience`
 *   Integration validator verifies each one
 *   Verdict is derived from check results, not from judgment
 *
 * Usage:
 *   Validator agent writes:
 *     `.flint-context/contracts/<name>-validation.md`       (human-readable)
 *     `.flint-context/contracts/<name>-validation.report.ts` (machine-readable)
 */

// ─── Check Categories ───────────────────────────────────────────────

/**
 * The fixed set of checks performed against every contract.
 * Every `FeatureContract` produces exactly one result per category.
 */
export type CheckCategory =
  | 'type-check'          // npx tsc --noEmit
  | 'ipc-symmetry'        // handler + preload + renderer legs match
  | 'store-isolation'     // no cross-store imports, no IPC in stores
  | 'contract-fidelity'   // types used, no scope creep
  | 'commandment'         // applicable commandments hold
  | 'test-coverage'       // every testBoundary → real assertion
  | 'process-boundary'    // no fs/electron in src/, no src/ in electron/
  | 'import-hygiene'      // no circular, no unused, no @ts-ignore
  | 'invariants'          // each Invariant measured and met
  | 'non-goals'           // contract's nonGoals not implemented
  | 'audience-fidelity';  // Phase 2 touched only the declared audience surface

export type CheckResult = 'pass' | 'fail' | 'n/a';

export interface CheckOutcome {
  category: CheckCategory;
  result: CheckResult;
  /** Short human summary, e.g., "0 TS errors" or "2 handlers missing preload exposure" */
  summary: string;
  /** Required when result is 'fail' — specific violations with file:line */
  violations?: Array<{
    file?: string;
    line?: number;
    description: string;
  }>;
}

// ─── Invariant Verification ─────────────────────────────────────────

/**
 * Every contract `Invariant` produces exactly one verification.
 * The validator agent is responsible for running `measuredBy` (bench, manual,
 * telemetry probe) and recording the actual measured value.
 *
 * If the agent cannot measure (e.g., telemetry not yet emitting), `met` MUST
 * be `false` with `unableToMeasure: true` — an unmeasured invariant is a failed
 * invariant, not a passed one.
 */
export interface InvariantVerification {
  /** Matches Invariant.name from the contract */
  name: string;
  /** The threshold declared in the contract (for audit clarity) */
  declaredThreshold: string;
  /** The actual measured value (e.g., "178ms p95 over 1000 runs") */
  measured: string;
  /** True if `measured` satisfies `declaredThreshold` */
  met: boolean;
  /** Set when the agent could not measure — distinguishes "failed" from "unverified" */
  unableToMeasure?: boolean;
  /** Optional: note from the agent (e.g., what method was used) */
  notes?: string;
}

// ─── Non-Goal Verification ──────────────────────────────────────────

/**
 * Every contract `nonGoals` entry produces exactly one verification.
 * If the entry was implemented anyway, this is scope creep.
 */
export interface NonGoalVerification {
  /** The non-goal text from the contract */
  nonGoal: string;
  /** True if the non-goal was NOT implemented (which is what we want) */
  respected: boolean;
  /** Evidence if `respected: false` — what was implemented that shouldn't be */
  violations?: Array<{ file: string; line?: number; description: string }>;
}

// ─── Audience Fidelity ──────────────────────────────────────────────

/**
 * Phase 2 agents should touch only the code surface matching the declared
 * audience. A `'designer'` contract should not modify `flint-vscode/` or `flint-ci/`.
 */
export interface AudienceFidelity {
  /** The audience declared in the contract */
  declaredAudience: string;
  /** Directories Phase 2 actually modified */
  actualSurfaces: string[];
  /** True if all `actualSurfaces` are valid for `declaredAudience` */
  consistent: boolean;
  /** Off-target modifications — files outside the declared audience's surface */
  drift?: Array<{ file: string; expectedSurface: string }>;
}

// ─── Verdict ────────────────────────────────────────────────────────

/**
 * Phase 3 verdict. Derived from check results — do not assign by hand.
 *
 *   SHIP      — all checks pass, 0 fails
 *   FIX       — 1–N check fails, all tractable (no architectural drift)
 *   REDESIGN  — architectural-scope violations or the contract itself is wrong
 */
export type IntegrationVerdict = 'SHIP' | 'FIX' | 'REDESIGN';

// ─── Fix Assignment ─────────────────────────────────────────────────

/**
 * When verdict is FIX, each violation gets assigned to a specialist agent.
 * Reviewers/users triage; agents do the work.
 */
export interface FixAssignment {
  /** Stable ID, e.g., "FIX-1" */
  id: string;
  /** Which agent should pick this up */
  assignedAgent: string;
  /** Short description of what to fix */
  description: string;
  /** File(s) involved */
  files: string[];
  /** Which check surfaced this */
  sourceCategory: CheckCategory;
}

// ─── Full Integration Report ────────────────────────────────────────

export interface IntegrationReportMeta {
  /** Feature name (matches contract.meta.name) */
  feature: string;
  /** Phase ID (matches contract.meta.phase) */
  phase: string;
  /** Validator persona/agent */
  validator: string;
  /** ISO date of validation */
  date: string;
  /** Round number — 1 for initial, 2+ after FIX cycles */
  round: number;
  /** Path to the contract validated */
  contractFile: string;
  /** Path to the human-readable markdown sibling */
  markdownFile?: string;
}

export interface IntegrationReport {
  meta: IntegrationReportMeta;
  /** Verdict is derived from check results via deriveIntegrationVerdict() */
  verdict: IntegrationVerdict;
  /** One outcome per CheckCategory (12 total — all must be present) */
  checks: CheckOutcome[];
  /** One entry per contract Invariant — must match contract.invariants by name */
  invariants: InvariantVerification[];
  /** One entry per contract nonGoals element */
  nonGoals: NonGoalVerification[];
  /** Audience fidelity check */
  audience: AudienceFidelity;
  /** Fix assignments (only populated when verdict = FIX) */
  fixes: FixAssignment[];
  /**
   * If verdict = REDESIGN, explain what's fundamentally wrong with the contract.
   * Required when verdict = 'REDESIGN'; ignored otherwise.
   */
  redesignReason?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * The complete set of check categories that every IntegrationReport must cover.
 * Used by validateIntegrationReport to confirm no category was skipped.
 */
export const REQUIRED_CHECK_CATEGORIES: CheckCategory[] = [
  'type-check',
  'ipc-symmetry',
  'store-isolation',
  'contract-fidelity',
  'commandment',
  'test-coverage',
  'process-boundary',
  'import-hygiene',
  'invariants',
  'non-goals',
  'audience-fidelity',
];

/**
 * Derive the integration verdict from check outcomes + invariants + non-goals + audience.
 *
 * Rules:
 *   - Any CheckOutcome with a violation marked as architectural scope → REDESIGN
 *   - 0 failed checks, all invariants met, all non-goals respected, audience consistent → SHIP
 *   - Any failed check, unmet invariant, violated non-goal, or audience drift → FIX
 *   - REDESIGN is reserved for: contract fundamentally wrong, architectural drift,
 *     or contradiction between contract and reality that no agent fix can resolve.
 *
 * Callers signal REDESIGN explicitly by marking any `CheckOutcome.violations[].description`
 * with the substring "[ARCHITECTURAL]". This is deliberate — most FIX situations should
 * be tractable, and REDESIGN should be rare and explicit.
 */
export function deriveIntegrationVerdict(
  report: Pick<IntegrationReport, 'checks' | 'invariants' | 'nonGoals' | 'audience'>
): IntegrationVerdict {
  // Architectural escalation
  const hasArchitecturalViolation = report.checks.some(c =>
    c.violations?.some(v => v.description.includes('[ARCHITECTURAL]'))
  );
  if (hasArchitecturalViolation) return 'REDESIGN';

  const anyCheckFailed = report.checks.some(c => c.result === 'fail');
  const anyInvariantUnmet = report.invariants.some(i => !i.met);
  const anyNonGoalViolated = report.nonGoals.some(n => !n.respected);
  const audienceDrift = !report.audience.consistent;

  if (anyCheckFailed || anyInvariantUnmet || anyNonGoalViolated || audienceDrift) {
    return 'FIX';
  }

  return 'SHIP';
}

/**
 * Validate that an IntegrationReport is well-formed.
 * Returns an array of error strings (empty = valid).
 * Agents call this before writing the report.
 */
export function validateIntegrationReport(report: IntegrationReport): string[] {
  const errors: string[] = [];

  // Meta
  if (!report.meta?.feature) errors.push('meta.feature is required');
  if (!report.meta?.phase) errors.push('meta.phase is required');
  if (!report.meta?.validator) errors.push('meta.validator is required');
  if (!report.meta?.date) errors.push('meta.date is required');
  if (typeof report.meta?.round !== 'number' || report.meta.round < 1) {
    errors.push('meta.round must be a positive integer');
  }
  if (!report.meta?.contractFile) errors.push('meta.contractFile is required');

  // All required check categories present
  const presentCategories = new Set(report.checks.map(c => c.category));
  for (const required of REQUIRED_CHECK_CATEGORIES) {
    if (!presentCategories.has(required)) {
      errors.push(`Missing required check category: ${required}`);
    }
  }
  const categoryCounts = new Map<CheckCategory, number>();
  for (const c of report.checks) {
    categoryCounts.set(c.category, (categoryCounts.get(c.category) ?? 0) + 1);
  }
  for (const [cat, count] of categoryCounts) {
    if (count > 1) errors.push(`Duplicate check category "${cat}" (${count} entries)`);
  }

  // Failed checks must have violations
  for (const c of report.checks) {
    if (c.result === 'fail' && (!c.violations || c.violations.length === 0)) {
      errors.push(`Check "${c.category}" failed but listed no violations`);
    }
    if (!c.summary?.trim()) errors.push(`Check "${c.category}" missing summary`);
  }

  // Invariant verifications
  const seenInvariantNames = new Set<string>();
  for (const inv of report.invariants) {
    if (!inv.name?.trim()) errors.push('Invariant verification missing name');
    if (seenInvariantNames.has(inv.name)) {
      errors.push(`Duplicate invariant verification for "${inv.name}"`);
    }
    seenInvariantNames.add(inv.name);
    if (!inv.declaredThreshold?.trim()) {
      errors.push(`Invariant "${inv.name}" missing declaredThreshold`);
    }
    if (!inv.measured?.trim()) {
      errors.push(`Invariant "${inv.name}" missing measured value (use unableToMeasure: true if applicable)`);
    }
    if (inv.unableToMeasure && inv.met) {
      errors.push(
        `Invariant "${inv.name}" has unableToMeasure: true but met: true — ` +
        `an unmeasured invariant cannot be "met"`
      );
    }
  }

  // Non-goal verifications
  for (const ng of report.nonGoals) {
    if (!ng.nonGoal?.trim()) errors.push('Non-goal verification missing nonGoal text');
    if (!ng.respected && (!ng.violations || ng.violations.length === 0)) {
      errors.push(`Non-goal "${ng.nonGoal}" reported as violated but lists no evidence`);
    }
  }

  // Audience
  if (!report.audience?.declaredAudience?.trim()) {
    errors.push('audience.declaredAudience is required');
  }
  if (!Array.isArray(report.audience?.actualSurfaces)) {
    errors.push('audience.actualSurfaces must be an array');
  }
  if (!report.audience?.consistent && (!report.audience?.drift || report.audience.drift.length === 0)) {
    errors.push('audience marked inconsistent but no drift entries listed');
  }

  // Verdict must match derived verdict
  const derived = deriveIntegrationVerdict(report);
  if (report.verdict !== derived) {
    errors.push(
      `verdict mismatch: declared "${report.verdict}" but deriveIntegrationVerdict() returns "${derived}". Do not override.`
    );
  }

  // REDESIGN requires a reason
  if (report.verdict === 'REDESIGN' && !report.redesignReason?.trim()) {
    errors.push('verdict=REDESIGN requires a non-empty redesignReason');
  }

  // FIX verdict should have fixes assigned
  if (report.verdict === 'FIX' && report.fixes.length === 0) {
    errors.push('verdict=FIX requires at least one entry in fixes[]');
  }

  // SHIP verdict should not have fixes
  if (report.verdict === 'SHIP' && report.fixes.length > 0) {
    errors.push('verdict=SHIP should have empty fixes[] (fixes are only for FIX verdict)');
  }

  return errors;
}

/**
 * Convenience: given a contract's expected invariants/nonGoals, verify that
 * the report covered each one exactly once. Callable by the validator agent
 * OR by a post-hoc auditor confirming nothing was skipped.
 */
export function checkContractCoverage(
  report: IntegrationReport,
  contractInvariantNames: string[],
  contractNonGoals: string[]
): string[] {
  const errors: string[] = [];

  const reportedInvariants = new Set(report.invariants.map(i => i.name));
  for (const name of contractInvariantNames) {
    if (!reportedInvariants.has(name)) {
      errors.push(`Contract declares invariant "${name}" but report does not verify it`);
    }
  }
  for (const inv of report.invariants) {
    if (!contractInvariantNames.includes(inv.name)) {
      errors.push(`Report verifies invariant "${inv.name}" which is not in the contract`);
    }
  }

  const reportedNonGoals = new Set(report.nonGoals.map(n => n.nonGoal));
  for (const ng of contractNonGoals) {
    if (!reportedNonGoals.has(ng)) {
      errors.push(`Contract declares nonGoal "${ng}" but report does not verify it`);
    }
  }

  return errors;
}
