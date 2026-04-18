/**
 * Review Schema — Machine-readable structure for the end-of-round review ceremony.
 *
 * The ceremony runs 3 parallel reviews (UX, code, security) before any phase is
 * marked COMPLETE. Historically, reviewers returned free-form markdown with letter
 * grades ("B+") — adjective verdicts that hid the underlying evidence.
 *
 * This schema makes reviews falsifiable and diffable:
 *   - Verdicts are derived from severity counts, not assigned by vibes
 *   - Every finding cites evidence (file:line)
 *   - Parallel reviewers produce reports that can be aggregated mechanically
 *   - The user triages findings (accept/defer/wontfix); agents do not assign grades
 *
 * Usage:
 *   Reviewer agent writes:
 *     `.flint-context/reviews/<phase>-<dimension>-<date>.md`       (human-readable)
 *     `.flint-context/reviews/<phase>-<dimension>-<date>.review.ts` (machine-readable)
 *   User reads findings, triages, and decides verdict threshold.
 */

// ─── Review Metadata ────────────────────────────────────────────────

/** Which slice of quality this review covers. */
export type ReviewDimension =
  | 'ux'
  | 'code'
  | 'security'
  | 'accessibility'
  | 'performance';

/**
 * Overall verdict. Derived from `counts` via `deriveVerdict()` — reviewers
 * do NOT assign this by judgment. The agent reports findings; the math
 * reports the verdict.
 */
export type ReviewVerdict =
  | 'SHIP'              // 0 blocking, 0 warnings
  | 'FIX-FORWARD'       // 0 blocking, warnings permitted (merge, follow up)
  | 'FIX-BEFORE-SHIP'   // 1–3 blocking findings, all tractable
  | 'REDESIGN'          // 4+ blocking or any architectural-scope finding
  | 'BLOCK';            // any security-critical blocking finding

/** Severity of an individual finding. */
export type FindingSeverity = 'blocking' | 'warning' | 'suggestion';

/**
 * User-assigned status after triage. Reviewers always emit `open`;
 * the user (or a follow-up agent acting on user direction) updates it.
 */
export type FindingStatus =
  | 'open'
  | 'accepted'   // agreed, will fix
  | 'deferred'   // agreed, not fixing this round
  | 'wontfix';   // disagreed, closing

/** Rough scope estimate so the user can triage cost/value. */
export type FindingScope =
  | 'one-line'
  | 'one-file'
  | 'cross-file'
  | 'architectural';

// ─── Evidence ───────────────────────────────────────────────────────

/**
 * Every finding must cite at least one evidence entry.
 * "I noticed the auth flow is weak" without a file:line is not a finding.
 */
export interface Evidence {
  /** Relative file path from project root */
  file: string;
  /** Line number (1-indexed). Optional only for whole-file observations. */
  line?: number;
  /** Code snippet, error output, or other verbatim excerpt */
  excerpt?: string;
  /** Optional description of what the excerpt shows */
  note?: string;
}

// ─── Finding ────────────────────────────────────────────────────────

export interface ReviewFinding {
  /** Stable ID, e.g., "BLK-1", "WARN-3", "SUG-7" */
  id: string;
  /** One-line summary for tables and indexes */
  title: string;
  /** Severity — drives the overall verdict */
  severity: FindingSeverity;
  /** Required: at least one evidence entry */
  evidence: Evidence[];
  /**
   * What the reviewer observed — non-interpretive.
   * "The IPC handler `foo:bar` has no Zod validator in shared/ipc-validators.ts."
   */
  observed: string;
  /**
   * Why it matters — the interpretation.
   * "Unvalidated IPC payloads at the preload bridge violate Commandment 14
   *  and expose the main process to malformed input from a compromised renderer."
   */
  rationale: string;
  /** Optional concrete fix proposal */
  proposedFix?: string;
  /** Rough scope so user can triage */
  scope: FindingScope;
  /** Reviewers always emit `open`; user updates during triage */
  status: FindingStatus;
  /** If deferred/wontfix, the reason (filled in by triage) */
  resolution?: string;
  /**
   * Optional: which Commandment this relates to (1–16).
   * Useful for security and code findings.
   */
  commandment?: number;
}

// ─── Rubric ─────────────────────────────────────────────────────────

/**
 * Each review dimension has a rubric of falsifiable criteria.
 * Pass/fail is observable — not a judgment call.
 *
 * Good criterion: "Every renderer→main IPC channel has a Zod validator in shared/ipc-validators.ts"
 * Bad criterion:  "IPC validation is robust"
 */
export interface RubricItem {
  /** The criterion statement (must be falsifiable) */
  criterion: string;
  /** Whether it was verified */
  result: 'pass' | 'fail' | 'n/a';
  /** Required when result is 'fail'; optional otherwise */
  evidence?: string;
  /** Which finding IDs relate to this rubric item, if any */
  relatedFindings?: string[];
}

// ─── Scope Coverage ─────────────────────────────────────────────────

/**
 * Honest disclosure of what was and wasn't reviewed.
 * Prevents false confidence from "B+ UX grade" when half the screens weren't opened.
 */
export interface ScopeCoverage {
  /** Files or areas actually examined */
  reviewed: string[];
  /**
   * Files or areas intentionally skipped, each with a one-line reason.
   * Format: "path/to/file — reason"
   */
  skipped: string[];
}

// ─── Review Meta ────────────────────────────────────────────────────

export interface ReviewMeta {
  /** Phase or feature being reviewed (e.g., "CHRON.1") */
  phase: string;
  /** Which dimension this review covers */
  dimension: ReviewDimension;
  /** Reviewer persona/agent name */
  reviewer: string;
  /** ISO date of the review */
  date: string;
  /** Round number — 1 for initial, 2+ for re-reviews after fixes */
  round: number;
  /** High-level scope summary (for the markdown header) */
  scope: string[];
  /** Optional link to the markdown sibling */
  markdownFile?: string;
}

// ─── Counts ─────────────────────────────────────────────────────────

export interface FindingCounts {
  blocking: number;
  warning: number;
  suggestion: number;
}

// ─── Full Review Report ─────────────────────────────────────────────

/**
 * The complete, machine-readable review report.
 *
 * Reviewer agents export this as `REPORT` from the `.review.ts` file
 * alongside their human-readable markdown. Aggregators can then mechanically
 * combine parallel reviews and surface disagreements to the user.
 */
export interface ReviewReport {
  meta: ReviewMeta;
  /** Derived from counts via deriveVerdict() — do not assign by hand */
  verdict: ReviewVerdict;
  rubric: RubricItem[];
  findings: ReviewFinding[];
  counts: FindingCounts;
  scopeCoverage: ScopeCoverage;
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Count findings by severity. Reviewers call this after assembling findings
 * and set `report.counts = countFindings(report.findings)`.
 */
export function countFindings(findings: ReviewFinding[]): FindingCounts {
  const counts: FindingCounts = { blocking: 0, warning: 0, suggestion: 0 };
  for (const f of findings) {
    if (f.severity === 'blocking') counts.blocking++;
    else if (f.severity === 'warning') counts.warning++;
    else if (f.severity === 'suggestion') counts.suggestion++;
  }
  return counts;
}

/**
 * Derive the verdict from counts + scope + dimension.
 * This is the one place verdicts are assigned. Reviewers must not override it.
 *
 * Rules:
 *   - Any security-critical blocking finding → BLOCK
 *   - Any architectural-scope blocking finding → REDESIGN
 *   - 4+ blocking findings → REDESIGN
 *   - 1–3 blocking findings → FIX-BEFORE-SHIP
 *   - 0 blocking, any warnings → FIX-FORWARD
 *   - 0 blocking, 0 warnings → SHIP
 */
export function deriveVerdict(
  findings: ReviewFinding[],
  dimension: ReviewDimension
): ReviewVerdict {
  const counts = countFindings(findings);
  const blocking = findings.filter(f => f.severity === 'blocking');

  // Security escalation: any blocking security finding → BLOCK
  if (dimension === 'security' && blocking.length > 0) {
    return 'BLOCK';
  }

  // Architectural blockers → REDESIGN (regardless of count)
  if (blocking.some(f => f.scope === 'architectural')) {
    return 'REDESIGN';
  }

  if (counts.blocking >= 4) return 'REDESIGN';
  if (counts.blocking >= 1) return 'FIX-BEFORE-SHIP';
  if (counts.warning >= 1) return 'FIX-FORWARD';
  return 'SHIP';
}

/**
 * Validate that a ReviewReport is well-formed.
 * Returns an array of error strings (empty = valid).
 * Agents should call this before writing the .review.ts file.
 */
export function validateReport(report: ReviewReport): string[] {
  const errors: string[] = [];

  // Meta
  if (!report.meta?.phase) errors.push('meta.phase is required');
  if (!report.meta?.dimension) errors.push('meta.dimension is required');
  if (!report.meta?.reviewer) errors.push('meta.reviewer is required');
  if (!report.meta?.date) errors.push('meta.date is required');
  if (typeof report.meta?.round !== 'number' || report.meta.round < 1) {
    errors.push('meta.round must be a positive integer');
  }

  // Findings
  const seenIds = new Set<string>();
  for (const f of report.findings) {
    if (!f.id) errors.push('Finding missing id');
    if (seenIds.has(f.id)) errors.push(`Duplicate finding id "${f.id}"`);
    seenIds.add(f.id);
    if (!f.title?.trim()) errors.push(`Finding "${f.id}" missing title`);
    if (!f.observed?.trim()) errors.push(`Finding "${f.id}" missing \`observed\``);
    if (!f.rationale?.trim()) errors.push(`Finding "${f.id}" missing \`rationale\``);
    if (!Array.isArray(f.evidence) || f.evidence.length === 0) {
      errors.push(`Finding "${f.id}" must cite at least one evidence entry`);
    } else {
      for (const e of f.evidence) {
        if (!e.file?.trim()) errors.push(`Finding "${f.id}" has evidence entry with no file path`);
      }
    }
    if (f.status !== 'open' && !f.resolution) {
      errors.push(`Finding "${f.id}" has status "${f.status}" but no resolution note`);
    }
  }

  // Rubric
  for (let i = 0; i < report.rubric.length; i++) {
    const r = report.rubric[i];
    if (!r.criterion?.trim()) errors.push(`Rubric item ${i} missing criterion`);
    if (r.result === 'fail' && !r.evidence?.trim()) {
      errors.push(`Rubric item "${r.criterion}" result=fail but no evidence provided`);
    }
  }

  // Counts must match findings
  const actual = countFindings(report.findings);
  if (
    actual.blocking !== report.counts.blocking ||
    actual.warning !== report.counts.warning ||
    actual.suggestion !== report.counts.suggestion
  ) {
    errors.push(
      `counts mismatch: declared ${JSON.stringify(report.counts)} but findings yield ${JSON.stringify(actual)}`
    );
  }

  // Verdict must match derived verdict
  const derived = deriveVerdict(report.findings, report.meta.dimension);
  if (report.verdict !== derived) {
    errors.push(
      `verdict mismatch: declared "${report.verdict}" but deriveVerdict() returns "${derived}". Do not override.`
    );
  }

  // Scope coverage
  if (!Array.isArray(report.scopeCoverage?.reviewed) || report.scopeCoverage.reviewed.length === 0) {
    errors.push('scopeCoverage.reviewed must list at least one file or area examined');
  }

  return errors;
}

// ─── Consensus Aggregation (parallel reviewers) ─────────────────────

/**
 * When 3 reviewers run in parallel (UX + code + security), the overall
 * verdict is the worst of the three. Disagreements surface as a meta-finding
 * rather than being synthesized away.
 */
export const VERDICT_SEVERITY_ORDER: ReviewVerdict[] = [
  'SHIP',
  'FIX-FORWARD',
  'FIX-BEFORE-SHIP',
  'REDESIGN',
  'BLOCK',
];

export interface ConsensusSummary {
  /** Worst of the individual verdicts */
  overallVerdict: ReviewVerdict;
  /** Per-dimension verdicts from each reviewer */
  perDimension: Record<string, ReviewVerdict>;
  /**
   * True if reviewers disagreed (more than one distinct verdict).
   * A disagreement is not a bug — it's information. Surface to the user.
   */
  disagreement: boolean;
  /** Total findings across all reviews, with dimension prefix on IDs */
  allFindings: Array<ReviewFinding & { dimension: ReviewDimension }>;
}

export function aggregateConsensus(reports: ReviewReport[]): ConsensusSummary {
  if (reports.length === 0) {
    return {
      overallVerdict: 'SHIP',
      perDimension: {},
      disagreement: false,
      allFindings: [],
    };
  }
  const perDimension: Record<string, ReviewVerdict> = {};
  let worstIdx = 0;
  for (const r of reports) {
    perDimension[r.meta.dimension] = r.verdict;
    const idx = VERDICT_SEVERITY_ORDER.indexOf(r.verdict);
    if (idx > worstIdx) worstIdx = idx;
  }
  const distinctVerdicts = new Set(reports.map(r => r.verdict));
  const allFindings = reports.flatMap(r =>
    r.findings.map(f => ({ ...f, dimension: r.meta.dimension }))
  );
  return {
    overallVerdict: VERDICT_SEVERITY_ORDER[worstIdx],
    perDimension,
    disagreement: distinctVerdicts.size > 1,
    allFindings,
  };
}
