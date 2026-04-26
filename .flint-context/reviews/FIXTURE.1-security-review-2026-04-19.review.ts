/**
 * FIXTURE.1 Security Review — Audit Context System
 * Pilot REPLICATION run. Surfaced inline by flint-security-reviewer (Write tool
 * still unavailable in this session — confirmed pilot meta-finding: agent
 * definition update did not propagate). Persisted by parent orchestrator.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'No realpath/symlink canonicalization in fixtureResolver — symlink-escape attack vector',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 50,
        note: 'startsWith(projectRoot) check is purely lexical — no fs.realpath canonicalization on the candidate path.',
      },
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 167,
        note: 'tokens path resolution uses startsWith only — symlinks at the resolved tokens path can escape projectRoot.',
      },
      {
        file: 'flint-mcp/src/core/__tests__/fixtureResolver.test.ts',
        line: 303,
        note: 'Contract testBoundary mentions "symlink that escapes projectRoot ⇒ blocked" but no actual symlink test exists in the file.',
      },
    ],
    observed:
      'fixtureResolver uses lexical `startsWith(projectRoot)` to gate path-traversal but does not canonicalize via `fs.realpath`. A symlink inside the project pointing outside (e.g., `demos/escape -> /etc`) would pass the lexical check and trigger fs.readFileSync on the canonicalized target.',
    rationale:
      'Commandment 14 forbids bypassing controlled access. The path-traversal guard is the security boundary for fixture-driven token loading; without realpath canonicalization, the guard can be bypassed by symlinks. The contract testBoundary at fixtureResolver.test.ts:303 explicitly names this scenario.',
    proposedFix:
      'Apply fs.realpathSync to fixturePath and resolved tokensCandidate before the containment check. Add a symlink vitest using vi.spyOn(fs, "readFileSync") to assert no read occurs on the escape target.',
  },
  {
    id: 'WARN-2',
    title: 'Error envelope echoes attacker-controlled resolved path into MCP response',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 171,
        note: 'Throws an error containing the canonical resolved tokensCandidate path.',
      },
      {
        file: 'flint-mcp/src/server.ts',
        line: 2044,
        note: 'Error reflected into auditWarnings → forwarded as MCP response payload to renderer/MCP client.',
      },
    ],
    observed:
      'When path-traversal guard rejects a tokens path, the thrown error embeds the canonicalized escape target. server.ts catches and reflects this into auditWarnings, which becomes part of the MCP response.',
    rationale:
      'Information leak: a malicious or misconfigured fixture can probe for filesystem layout outside the project root via the audit response. The user-authored fixture.tokens string is what the client supplied; echoing back the resolved canonical target is gratuitous and discloses absolute paths.',
    proposedFix:
      'Echo only the user-authored fixture.tokens string and the fixturePath that contained the bad reference. Drop the resolved escape target from the error message.',
  },
  {
    id: 'SUG-1',
    title: 'Resolver cache is not project-scoped — cross-project bleed in long-running MCP server',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 34,
        note: 'Module-global Map.',
      },
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 113,
        note: 'Cache key is startDir only — does not include projectRoot.',
      },
    ],
    observed:
      'The fixtureResolver cache is a module-global Map keyed on startDir alone. Two MCP clients in a long-running server (or two sequential project loads) sharing an absolute directory path can cross-read each other\'s fixture resolution.',
    rationale:
      'Edge case in single-project Glass usage; real concern in shared/long-running MCP deployments where multiple projects open in sequence. As a governance product, Flint cannot have cross-project state bleed in its own audit pipeline.',
    proposedFix:
      'Key cache on `${resolvedRoot}\\0${startDir}` so resolutions are project-scoped. Add clearFixtureCache(projectRoot?) so callers can scope-clear.',
  },
  {
    id: 'SUG-2',
    title: 'Walk-up loop has no depth cap and cache has no eviction policy',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 66,
        note: 'while (true) loop walking up the directory tree with no iteration guard.',
      },
    ],
    observed:
      'Walk-up uses an unbounded while(true) loop. If projectRoot is somehow misconfigured to be deeper than startDir, the loop terminates only on `dirname(currentDir) === currentDir` (root). Combined with cache having no eviction, a long-running MCP processing many distinct project trees can grow the cache without bound.',
    rationale:
      'Resource-exhaustion concern. Not exploitable in normal use but unbounded cache growth in a long-running server is a code-smell that beta deployments will eventually hit.',
    proposedFix:
      'Cap walk-up at 64 iterations. Add LRU eviction at ~1024 entries to the cache.',
  },
  {
    id: 'SUG-3',
    title: 'TOCTOU catch-all silently masks EACCES, EISDIR, and other non-ENOENT errors',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'flint-mcp/src/core/fixtureResolver.ts',
        line: 132,
        note: 'Catch-all returns DEFAULT_FIXTURE on any error, including permission-denied.',
      },
    ],
    observed:
      'Any error thrown during fixture file read silently returns DEFAULT_FIXTURE. ENOENT (file genuinely doesn\'t exist) is the expected case; EACCES (permission denied) and EISDIR (target is directory) silently masquerade as "no fixture found."',
    rationale:
      'A misconfigured fixture (wrong permissions, name collision with a directory) appears identical to "no fixture defined" in the audit pipeline. Designers will see "auditing in default context" with no signal that their fixture was unreadable.',
    proposedFix:
      'Differentiate ENOENT (silent fall-through) from other errors. Surface non-ENOENT errors into auditWarnings so the user sees "fixture file present but unreadable: <reason>" instead of silent fallback.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FIXTURE.1',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'flint-mcp/src/core/fixtureResolver.ts (full file)',
      'shared/fixture-schema.ts (Zod schema + types)',
      'flint-mcp/src/server.ts (FIXTURE.1 block L2023-2046, L2135)',
      'flint-mcp/src/tools/swarm.ts (L206-222)',
      'flint-mcp/src/core/A11yLinter.ts (FIXTURE.1 block L180-266)',
      'flint-mcp/src/core/a11y/rules/*.ts (appliesTo classifications)',
      'fixtureResolver.test.ts + server.audit-fixture.test.ts (security-critical assertions)',
    ],
    markdownFile: 'FIXTURE.1-security-review-2026-04-19.md',
  },
  rubric: [
    { criterion: 'Path-traversal guard with realpath canonicalization', result: 'fail', evidence: 'Lexical startsWith only; no fs.realpath', relatedFindings: ['WARN-1'] },
    { criterion: 'Realpath canonical check on symlinks before fs.readFile', result: 'fail', evidence: 'fixtureResolver.ts:50, 167 — no canonicalization', relatedFindings: ['WARN-1'] },
    { criterion: 'Untrusted JSON parsing — Zod .strict() rejects unknown keys', result: 'pass', evidence: 'fixture-schema.ts uses .strict()' },
    { criterion: 'Critical security a11y rules (A11Y-001..006, contrast) NOT silently skippable via "surface": "component"', result: 'pass', evidence: 'All names-labels, aria, contrast rules → appliesTo: "any"' },
    { criterion: 'No information leak in error envelopes', result: 'fail', evidence: 'fixtureResolver.ts:171 echoes resolved path; reflected via server.ts:2044 into MCP response', relatedFindings: ['WARN-2'] },
    { criterion: 'Cache project-scoped (no cross-project bleed)', result: 'fail', evidence: 'Module-global Map keyed on startDir only', relatedFindings: ['SUG-1'] },
    { criterion: 'No new IPC surface', result: 'pass', evidence: 'Phase 3 declares zero new IPC channels; verified' },
    { criterion: 'Append-only on shared MithrilLinter + A11yLinter', result: 'pass', evidence: 'auditAllWithSurface() and auditWithSurface() are net-new methods; existing visitors untouched' },
    { criterion: 'Resource exhaustion bounded (depth cap, cache eviction)', result: 'fail', evidence: 'while(true) walk-up + unbounded cache', relatedFindings: ['SUG-2'] },
    { criterion: 'End-to-end tests use public API (no guard bypass)', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'flint-mcp/src/core/fixtureResolver.ts (full file — security-critical primary surface)',
      'shared/fixture-schema.ts (Zod schema)',
      'flint-mcp/src/server.ts (FIXTURE.1 lines only)',
      'flint-mcp/src/tools/swarm.ts (FIXTURE.1 lines only)',
      'flint-mcp/src/core/A11yLinter.ts (FIXTURE.1 block only)',
      'flint-mcp/src/core/a11y/rules/*.ts (appliesTo audit)',
      'fixtureResolver.test.ts + server.audit-fixture.test.ts (security-critical assertions)',
    ],
    skipped: [
      'StatusBar.tsx + canvasStore.ts (UX reviewer scope)',
      'Demo .flint-fixture.json content (test data, not user input — code reviewer scope)',
      'Pure type definitions and rule appliesTo metadata content (code reviewer scope)',
      'wcag22.ts rule-by-rule appliesTo audit (sampled, all "any" — code reviewer owns full audit)',
    ],
  },
};
