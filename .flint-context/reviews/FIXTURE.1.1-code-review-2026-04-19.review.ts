import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'SUG-1',
    title: 'Bare-string alias detection matches any {…}-wrapped string literal',
    severity: 'suggestion',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 189,
        excerpt:
          "if (typeof rawValue === 'string' && rawValue.startsWith('{') && rawValue.endsWith('}')) {",
        note: 'A string $value of "{anything}" is interpreted as an alias ref, even when the author meant a literal.',
      },
    ],
    observed:
      'The adapter treats any string wrapped in curly braces as a DTCG bare-string alias. Non-ref curly-brace strings would be routed to _resolveAlias and would emit ALIAS_BROKEN_REF.',
    rationale:
      'Low risk in practice because DTCG conventions and the current demo token set never produce curly-brace literal values, but an $type:"string" token with value "{note}" would regress to an adapter error instead of passing through. Consider gating on $type !== "string" or on the presence of a matching path before declaring it a ref.',
    proposedFix:
      'Optional: only treat "{x}" as an alias when _lookupByDotPath(root, "x") resolves; otherwise return the literal.',
    scope: 'one-line',
    status: 'open',
    commandment: 13,
  },
  {
    id: 'SUG-2',
    title: 'Non-fixture token paths at server.ts:1972 and 2179 still use legacy shape detection',
    severity: 'suggestion',
    evidence: [
      {
        file: 'flint-mcp/src/server.ts',
        line: 1972,
        excerpt:
          'tokens = Array.isArray(rawTokens) ? rawTokens : Object.values(rawTokens);',
        note: 'Pre-fixture project-default token load path; retains legacy shape coercion.',
      },
      {
        file: 'flint-mcp/src/server.ts',
        line: 2179,
        excerpt:
          'tokens = Array.isArray(rawTokens) ? rawTokens : Object.values(rawTokens);',
        note: 'Secondary flint_audit token load path; identical pattern.',
      },
    ],
    observed:
      'Two non-fixture token load sites remain on the legacy Object.values coercion. They are outside FIXTURE.1.1 scope per the contract non-goals, but would silently mis-load DTCG tokens if a project placed a DTCG file at the default tokensPath.',
    rationale:
      'Contract explicitly scopes to fixture-only and lists broader migration as a non-goal. This is documented technical debt, not a blocker. Worth a follow-up ticket.',
    proposedFix:
      'Queue a follow-up phase to widen normalizeTokenShape adoption to the non-fixture paths once we next touch the server token pipeline.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: 'fnv1a32 uses UTF-16 code units, not codepoints',
    severity: 'suggestion',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 66,
        excerpt: 'hash ^= input.charCodeAt(i)',
        note: 'charCodeAt yields the UTF-16 code unit; surrogate pairs are hashed as two independent halves.',
      },
    ],
    observed:
      'The FNV-1a implementation mixes UTF-16 code units rather than full codepoints. Two token_path strings differing only in surrogate-pair composition could hash identically if one were to contain an astral character.',
    rationale:
      'DTCG token names are constrained by convention to ASCII (letters, digits, hyphens), so this cannot bite in practice today. The id-hash-collision-free invariant passed at N=100 with the real corpus. Flag for awareness only.',
    proposedFix:
      'If non-ASCII token paths become a real concern, switch to iterating codePointAt(i) with appropriate index advancement for surrogate pairs.',
    scope: 'one-line',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FIXTURE.1.1',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      '1 prod module (dtcgTokenAdapter.ts, 381 lines)',
      '1 prod file touched (server.ts: import + one-line swap at 2038)',
      '2 test files (adapter unit + server canary)',
      '1 bench file (3 bench cases)',
      '1 demo fixture rework (banner-broken.tsx)',
    ],
    markdownFile: 'FIXTURE.1.1-code-review-2026-04-19.md',
  },
  rubric: [
    {
      criterion:
        'All 10 contract invariants have a covering test with measured values beating threshold',
      result: 'pass',
      evidence:
        '10/10 invariants covered and passing — see invariant table in markdown sibling',
    },
    {
      criterion: 'npx tsc --noEmit exits 0 in flint-mcp/',
      result: 'pass',
      evidence: '0 errors',
    },
    {
      criterion: 'Full adapter + audit-fixture test suite passes',
      result: 'pass',
      evidence: '64/64 tests pass (37 adapter + 27 audit-fixture)',
    },
    {
      criterion:
        'adapter-overhead-budget bench: p95 < 2ms at N=100 leaves',
      result: 'pass',
      evidence: 'p99=0.0864ms, p95≈0.035ms, 28,209 hz; ~55x under budget',
    },
    {
      criterion:
        'C13 Deterministic Surgery: no regex-based source code modification in adapter',
      result: 'pass',
      evidence:
        'Adapter is pure object traversal; string predicates on token values only, never on source code',
    },
    {
      criterion:
        'C14 Bypass Prohibition: adapter performs zero I/O (no fs/path/child_process imports)',
      result: 'pass',
      evidence:
        'dtcgTokenAdapter.ts only imports types from ../types.js; zero I/O modules',
    },
    {
      criterion:
        'Append-only discipline: non-fixture token load sites unchanged',
      result: 'pass',
      evidence:
        'server.ts:1972 and server.ts:2179 retain legacy pattern per contract scope',
    },
    {
      criterion:
        'swarm.ts has no independent token-load site requiring patching',
      result: 'pass',
      evidence:
        'grep confirms zero direct token-load call sites in swarm.ts; delegates via handleFlintAuditBatch',
    },
    {
      criterion:
        'FNV-1a id synthesis is deterministic and negative across platforms',
      result: 'pass',
      evidence:
        'Math.imul used for 32-bit multiply; sign-bit OR forces negative; determinism asserted in id synthesis tests',
    },
    {
      criterion:
        'Alias cycle detection never throws and never stack-overflows (bounded iteration)',
      result: 'pass',
      evidence:
        'Two-node and self-ref cycle tests both assert no throw; visited-set guard bounds iteration to O(chain-length)',
    },
    {
      criterion:
        'TokenAdapterResult/TokenAdapterError types consistent between contract.ts and adapter.ts',
      result: 'pass',
      evidence:
        'Contract declares tokens:unknown[] to avoid src coupling; impl declares DesignToken[]; test file bridges via AdapterModule shim — intentional and documented',
    },
    {
      criterion: 'Tightened canary replaces FIXTURE.1 SHIP-WITH-DOCUMENTED-DRIFT',
      result: 'pass',
      evidence:
        'server.audit-fixture.test.ts:538 now asserts TYP-002=0 and SPC-001=0 on banner-compliant.tsx; previously documented as drift',
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'flint-mcp/src/core/dtcgTokenAdapter.ts',
      'flint-mcp/src/server.ts (import at 23, swap at 2038-2044)',
      'flint-mcp/src/tools/swarm.ts (verified no independent token load)',
      'flint-mcp/src/core/__tests__/dtcgTokenAdapter.test.ts',
      'flint-mcp/src/core/__tests__/dtcgTokenAdapter.bench.ts',
      'flint-mcp/src/__tests__/server.audit-fixture.test.ts',
      'demos/01-rag-ui-builder/banner-broken.tsx',
      '.flint-context/contracts/FIXTURE.1.1.contract.ts (binding spec)',
    ],
    skipped: [
      'Unrelated in-flight work in git status (CHRON, RUNTIME, FIGMA-LINT) — out of FIXTURE.1.1 scope',
      'docs/strategy/** — not code review territory',
      'electron/**, src/** — FIXTURE.1.1 is engine-internal; no renderer or main-process surface touched',
    ],
  },
};
