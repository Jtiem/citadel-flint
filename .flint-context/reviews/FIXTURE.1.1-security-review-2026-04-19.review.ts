import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'BLK-1',
    title: 'Unbounded recursion in _walkDTCG enables single-file DoS',
    severity: 'blocking',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 226,
        excerpt: '_walkDTCG(root, val as DTCGDocument, childPath, tokens, errors)',
        note: 'Recursive call with no depth guard; only isDTCGDocument (line 119) has depth>20 guard.',
      },
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 170,
        note: '_walkDTCG signature has no depth parameter.',
      },
    ],
    observed:
      '_walkDTCG recurses into every nested DTCG group with no depth cap. A design-tokens.json with ~10,000 nested groups triggers V8 RangeError inside server.ts:2038, crashing the audit path with an unhandled exception.',
    rationale:
      'Contract FIXTURE.1.1 §2 asserts the adapter "never throws and never stack-overflows". Files ingested from Figma, GPX pack imports, and any workspace-local design-tokens.json all flow through this path. A malicious or malformed file is a one-byte DoS against every concurrent MCP request served by the engine instance. Commandment 13 (Deterministic Surgery) requires stable output for adversarial input, not just well-formed input.',
    proposedFix:
      'Add `depth: number = 0` parameter to _walkDTCG; cap at 64. On exceed, push a TokenAdapterError with a new DEPTH_EXCEEDED code and return early. Mirrors the existing depth>20 guard in _containsDTCGLeaf.',
    scope: 'one-file',
    status: 'open',
    commandment: 13,
  },
  {
    id: 'BLK-2',
    title: 'String(rawValue) fallback throws on Symbol and throwing getters',
    severity: 'blocking',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 211,
        excerpt: 'resolvedValue = String(rawValue)',
        note: 'Unguarded String() coercion; throws TypeError on Symbol and on objects with throwing Symbol.toPrimitive.',
      },
    ],
    observed:
      'The fallback stringification at line 211 assumes rawValue is coercible. String(Symbol()) throws TypeError. A $value object with a throwing toString/Symbol.toPrimitive also throws here. No try/catch wraps the call.',
    rationale:
      'Contract FIXTURE.1.1 §2 asserts "the adapter never throws". Symbols cannot arrive via JSON.parse, but the public signature is normalizeTokenShape(raw: unknown) and the contract does not restrict input to JSON-origin values. Programmatic callers (swarm.ts, tests, future library adapters) can pass such inputs. Any throw propagates out of normalizeTokenShape → server.ts:2038 → the audit_ui_component handler, which does not wrap this path per the contract scope ("no changes to any visitor").',
    proposedFix:
      'Either (a) wrap String(rawValue) in try/catch and push a TokenAdapterError with INVALID_VALUE_TYPE on failure, or (b) pre-guard with `if (typeof rawValue === "symbol" || typeof rawValue === "function") { push error; continue; }` before the String() call.',
    scope: 'one-line',
    status: 'open',
    commandment: 13,
  },
  {
    id: 'BLK-3',
    title: 'Non-string $ref crashes _lookupByDotPath via split on object',
    severity: 'blocking',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 198,
        excerpt: "else if (typeof rawValue === 'object' && rawValue !== null && '$ref' in rawValue)",
        note: 'Guard checks key presence but not typeof $ref === "string".',
      },
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 286,
        excerpt: 'currentRef = (leaf.$value as { $ref: string }).$ref',
        note: 'Cast asserts string but no runtime check.',
      },
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 303,
        excerpt: 'const parts = dotPath.split(\'.\')',
        note: 'split called on non-string throws TypeError.',
      },
    ],
    observed:
      'A payload `{ "t": { "$value": { "$ref": { "nested": "x" } } } }` passes the `"$ref" in rawValue` guard at lines 198 and 284, then line 303 calls `.split(".")` on an object — throws TypeError: dotPath.split is not a function.',
    rationale:
      'Reachable through any JSON-origin input (Figma ingestion, GPX pack import, workspace design-tokens.json) since arrays and objects are JSON-native. Same "adapter never throws" invariant violation as BLK-2, but with a larger reachability surface. Commandment 13: deterministic output for all input shapes.',
    proposedFix:
      'Tighten the guards at lines 198 and 284 from `"$ref" in rawValue` to `"$ref" in rawValue && typeof (rawValue as { $ref: unknown }).$ref === "string"`. Values that fail the guard fall through to the stringify path (which BLK-2 also hardens).',
    scope: 'one-line',
    status: 'open',
    commandment: 13,
  },
  {
    id: 'WARN-1',
    title: '_lookupByDotPath reads through prototype chain via bracket access',
    severity: 'warning',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 307,
        excerpt: "current = (current as Record<string, unknown>)[part]",
        note: 'Bracket access without Object.hasOwn guard traverses prototype.',
      },
    ],
    observed:
      'Bracket access `current[part]` with no own-property guard. Input `{ "$ref": "__proto__.toString" }` walks into Object.prototype. Today this returns a function which isPlainObject rejects → broken-ref error. No write occurs.',
    rationale:
      'No direct pollution-to-RCE reachable through this adapter today, but the invariant "token lookup only considers own properties of the loaded document" is worth enforcing explicitly. Hostile prototype pollution from any other loaded module would silently satisfy _lookupByDotPath, and future refactors that re-export the resolved node could leak prototype keys. Defense-in-depth against Commandment 13 drift.',
    proposedFix:
      'Add `if (!Object.hasOwn(current as object, part)) return undefined;` before the bracket read at line 307.',
    scope: 'one-line',
    status: 'open',
    commandment: 13,
  },
  {
    id: 'WARN-2',
    title: 'Alias visited-set is O(N²) via Array.includes',
    severity: 'warning',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 238,
        excerpt: 'const visited: string[] = [originPath]',
      },
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 242,
        excerpt: 'if (visited.includes(currentRef))',
        note: 'O(N) per hop; O(N²) total over an N-hop chain.',
      },
    ],
    observed:
      'visited is a string[] and cycle detection uses Array.includes. For an N-hop non-cyclic chain (not a cycle, just long), total cost is N(N+1)/2 string comparisons plus N push allocations. At N=10,000: ~50M comparisons synchronously.',
    rationale:
      'Blocks the Node event loop inside the MCP tool handler, stalling every concurrent audit request. Not a DoS primitive alone, but amplifies BLK-1. Also no hop-count cap — a legitimate-looking-but-pathological token file can burn several seconds of CPU with no emitted error.',
    proposedFix:
      'Replace with `const visited = new Set<string>([originPath])` and use visited.has / visited.add. Add `if (visited.size > 1024) return { error: { code: "ALIAS_CYCLE", ... } };` as a defense-in-depth hop cap.',
    scope: 'one-line',
    status: 'open',
    commandment: 13,
  },
  {
    id: 'SUG-1',
    title: 'Hash-collision probability on fnv1a32 is undocumented',
    severity: 'suggestion',
    evidence: [
      {
        file: 'flint-mcp/src/core/dtcgTokenAdapter.ts',
        line: 63,
        excerpt: 'function fnv1a32(input: string): number',
        note: '32-bit hash space; negative-id half is 2^31.',
      },
    ],
    observed:
      'fnv1a32 is a 32-bit hash. After forcing the sign bit, the usable negative-id space is 2^31. Birthday-collision probability is ~N²/2^32: ~0.0001% at N=1,000; ~0.002% at N=10,000. Contract invariant id-hash-collision-free is aspirational.',
    rationale:
      "Current audit path does not key any Map on DesignToken.id (MithrilLinter filters by token_type only), so collision has no current impact. But the invariant name in the contract implies a guarantee the code cannot provide. A JSDoc comment setting expectations prevents a future refactor from keying on id and discovering the collision the hard way.",
    proposedFix:
      'Add a JSDoc block on fnv1a32 documenting: (1) the 2^31 effective space, (2) the birthday probability curve, and (3) the invariant that downstream consumers key on token_path (string) rather than id (number).',
    scope: 'one-line',
    status: 'open',
    commandment: 13,
  },
];

// Strip the ad-hoc `category` field we attached above — ReviewFinding schema
// doesn't define it, and TS will complain. We filter it out at export time.
const sanitizedFindings: ReviewFinding[] = findings.map(({ ...f }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copy: any = { ...f };
  delete copy.category;
  return copy as ReviewFinding;
});

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FIXTURE.1.1',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'flint-mcp/src/core/dtcgTokenAdapter.ts',
      'flint-mcp/src/server.ts (line 2038 integration point)',
    ],
    markdownFile: 'FIXTURE.1.1-security-review-2026-04-19.md',
  },
  rubric: [
    {
      criterion: 'Adapter imports no fs, child_process, path, os, crypto, http(s), or net modules (Commandment 14)',
      result: 'pass',
    },
    {
      criterion: 'No regex used on source code; regex-free or regex-safe on token values (Commandment 13)',
      result: 'pass',
    },
    {
      criterion: 'Synthesized negative FNV-1a ids are disjoint from positive DB-issued DesignToken.id range',
      result: 'pass',
    },
    {
      criterion: 'Adapter never throws on any JSON-valid input',
      result: 'fail',
      evidence: 'BLK-2 (Symbol/throwing-getter), BLK-3 (non-string $ref)',
      relatedFindings: ['BLK-2', 'BLK-3'],
    },
    {
      criterion: 'Adapter never stack-overflows on adversarial nesting',
      result: 'fail',
      evidence: 'BLK-1: _walkDTCG has no depth guard; only shape detection does',
      relatedFindings: ['BLK-1'],
    },
    {
      criterion: 'Alias resolution terminates deterministically on cycles of any length',
      result: 'pass',
    },
    {
      criterion: 'Alias resolution is efficient on long non-cyclic chains (sub-quadratic)',
      result: 'fail',
      evidence: 'WARN-2: Array.includes visited-set is O(N²)',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'Dot-path lookup considers only own properties of the loaded document (no prototype-chain traversal)',
      result: 'fail',
      evidence: 'WARN-1: bracket access without Object.hasOwn guard',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'No new MCP tool, IPC channel, preload surface, or renderer trust boundary is introduced',
      result: 'pass',
    },
  ],
  findings: sanitizedFindings,
  counts: countFindings(sanitizedFindings),
  verdict: deriveVerdict(sanitizedFindings, 'security'),
  scopeCoverage: {
    reviewed: [
      'flint-mcp/src/core/dtcgTokenAdapter.ts',
      'flint-mcp/src/server.ts:2038 integration point',
      '.flint-context/contracts/FIXTURE.1.1-contract.md',
    ],
    skipped: [
      'flint-mcp/src/core/__tests__/dtcgTokenAdapter.test.ts — not yet written per contract Group A; adversarial test cases in the parent review markdown should be added',
      'flint-mcp/src/tools/swarm.ts — contract notes the server.ts fix should propagate; independent load site not present',
    ],
  },
};
