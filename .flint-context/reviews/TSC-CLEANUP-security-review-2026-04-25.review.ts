import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'FLINT_FORCE_AUTOUPDATE env-var bypass is honoured in production binaries',
    severity: 'warning',
    evidence: [
      {
        file: 'electron/autoUpdater.ts',
        line: 70,
        excerpt: "if (process.env.FLINT_FORCE_AUTOUPDATE !== '1') {",
        note: 'Bypass condition skips the app.isPackaged + app-update.yml existence check.',
      },
      {
        file: 'electron/__tests__/autoUpdater.test.ts',
        line: 111,
        excerpt: "process.env.FLINT_FORCE_AUTOUPDATE = '1'",
        note: 'Sole legitimate consumer is the unit test.',
      },
    ],
    observed:
      'The env-var bypass at autoUpdater.ts:70 is unconditional — production binaries will honour FLINT_FORCE_AUTOUPDATE=1 just like tests do, then proceed to set up real periodic checkForUpdates() timers.',
    rationale:
      'Composite attack: a malicious shell-profile mod that exports the env var, plus a planted attacker-controlled app-update.yml in process.resourcesPath, would route the updater to an attacker-controlled feed. Both vectors require pre-existing local compromise, but the env var is a novel new lever the bypass introduced. Commandment 4 (local-first, no external URLs) prefers fail-closed defaults.',
    proposedFix:
      "Guard the bypass with `if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true')`. The test runs under Vitest so this is invisible to autoUpdater.test.ts; the production code path becomes fail-closed.",
    scope: 'one-file',
    status: 'open',
    commandment: 4,
  },
  {
    id: 'WARN-2',
    title: 'Double-cast (window.flintAPI as unknown as Record<string, unknown>) muted TS narrowing in production code',
    severity: 'warning',
    evidence: [
      {
        file: 'src/main.tsx',
        line: 19,
        excerpt: ';(window as unknown as Record<string, unknown>).flintAPI = createWebFlintAPI()',
        note: 'Production write to window.flintAPI uses the double-cast pattern.',
      },
      {
        file: 'src/components/ui/GovernanceDashboard.tsx',
        line: 1,
        note: 'Same cast pattern applied via perl bulk edit; production component, not a test.',
      },
      {
        file: 'src/components/ui/LaunchScreen.tsx',
        line: 1,
        note: 'Same cast pattern applied; production component.',
      },
    ],
    observed:
      'The bulk perl rewrite changed (window.flintAPI as Record<string, unknown>) to (window.flintAPI as unknown as Record<string, unknown>) across ~10 test files AND 3 production files. The double-cast is a TypeScript escape hatch that bypasses normal type narrowing.',
    rationale:
      'Runtime safety is unchanged because validateIPCResponse() and per-call schemas still apply. But a future refactor that removes a method from the typed bridge will no longer trigger a TS error at these call sites. This is type-safety hygiene, not a live vulnerability.',
    proposedFix:
      "Declare a `WebFlintAPI` interface and use a single named cast at main.tsx:19 (e.g., `(window as { flintAPI?: WebFlintAPI }).flintAPI = createWebFlintAPI()`). Test files can keep the loose form.",
    scope: 'cross-file',
    status: 'open',
    commandment: 9,
  },
  {
    id: 'WARN-3',
    title: 'tsconfig.tests.json disables noUnusedLocals — unused security-helper imports go undetected',
    severity: 'warning',
    evidence: [
      {
        file: 'tsconfig.tests.json',
        line: 5,
        excerpt: '"noUnusedLocals": false,',
        note: 'Disabled across all test directories (src + electron + shared __tests__).',
      },
    ],
    observed:
      'The tests tsconfig disables both noUnusedLocals and noUnusedParameters. A test that imports a sanitizer or guard helper but forgets to invoke it would compile and "pass" with the call missing.',
    rationale:
      'Concrete failure mode: `import { sanitizePath } from "../sanitizer"` followed by `await ipcCall(rawUserPath)` (sanitizer never used) yields a green test that does NOT actually exercise the security boundary it claims to test. Unused-locals is a cheap canary against this exact class of bug.',
    proposedFix:
      'Re-enable `noUnusedLocals: true` (keep noUnusedParameters relaxed for Vitest mock signatures). Fix the small number of legitimate unused-import sites. If retaining the relaxation, add a code comment in tsconfig.tests.json documenting the security trade-off so it is considered when adding new test files.',
    scope: 'cross-file',
    status: 'open',
    commandment: 16,
  },
  {
    id: 'SUG-1',
    title: 'ProvenanceInfo.filePath and ruleId are added but not yet rendered — flag sanitization rule before first consumer',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/types/flint-api.d.ts',
        line: 2457,
        excerpt: 'filePath?: string',
        note: 'New optional field on ProvenanceInfo.',
      },
      {
        file: 'src/components/ui/governance/ViolationCard.tsx',
        line: 636,
        excerpt: 'filePath={activeFilePath ?? undefined}',
        note: 'Current consumer reads from renderer state, NOT from provenance.filePath.',
      },
    ],
    observed:
      'The new optional fields are dead-data today — no UI render path consumes ProvenanceInfo.filePath or .ruleId. Verified across ViolationCard, GovernanceDashboard, useGovernanceDefer, ViolationsList.',
    rationale:
      'Today there is no risk. Tomorrow, a consumer will render these. The MCP source (mutationProvenanceService) returns sanitized SQLite rows, but tooltip/aria-label rendering should still treat filePath as untrusted text (no path-traversal characters in display) and ruleId as plain text (no dangerouslySetInnerHTML).',
    proposedFix:
      'Add a JSDoc note on the new fields in flint-api.d.ts explaining the rendering contract: text-only, no HTML interpolation, basename-only display when shown to users.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: '@ts-expect-error → @ts-ignore in tokenStore.protoPollution.test.ts removes the type-system canary',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/store/__tests__/tokenStore.protoPollution.test.ts',
        line: 20,
        excerpt: '// @ts-ignore — test-only injection',
        note: 'Was @ts-expect-error before the cleanup.',
      },
    ],
    observed:
      'The runtime security assertion (flattenDTCG rejects __proto__/constructor/prototype keys) is unchanged and continues to execute. Only the TS suppression style changed: @ts-expect-error fails the build if the underlying error disappears; @ts-ignore silently ignores forever.',
    rationale:
      'Coverage of the security guard is unchanged. The lost canary value is "if global.window injection ever becomes type-safe, we want to know so we can remove the suppression." Low impact.',
    proposedFix:
      'Revert to @ts-expect-error. The surrounding `global.window` assignment is genuinely a TS error today and will stay one for the foreseeable future, so the directive is correct.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: 'LegacyFlintContract relaxes validator to optional — needs a sunset list + date',
    severity: 'suggestion',
    evidence: [
      {
        file: 'shared/contract-schema.ts',
        line: 237,
        excerpt: 'export interface LegacyIPCChannelContract extends Omit<IPCChannelContract, "validator"> { validator?: string | null; }',
      },
    ],
    observed:
      'LegacyFlintContract makes the v2.1-required validator field optional for grandfathered contracts. Verified the live preload DOES validate every renderer→main channel referenced by the four legacy contracts (mcp:call-tool, governance:approve-mutation, tokens:*, etc.) — so the relaxation does NOT correspond to a live IPC gap.',
    rationale:
      'No present-day vulnerability. Risk is drift: without a sunset, the legacy escape hatch persists and new contracts could be backdated to dodge the v2.1 requirement.',
    proposedFix:
      'Add a JSDoc block on LegacyFlintContract listing the four grandfathered contract files (CHRON.1, MINT.5-phase1, MINT.5-phase3, sprint-2-glass-ui-fixes) and a target date by which they must migrate to FlintContract. Phase 1.5 contract linter should warn on new uses of LegacyFlintContract.',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'SUG-4',
    title: 'Cast change in canvasStore/autoResume narrows the error type — small security improvement worth documenting',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/store/canvasStore.ts',
        line: 833,
        excerpt: "const code = (err as { code?: string })?.code ?? 'unknown'",
      },
      {
        file: 'src/lib/autoResume.ts',
        line: 168,
        excerpt: "const code = (err as { code?: string })?.code ?? 'unknown'",
      },
    ],
    observed:
      'Replacing NodeJS.ErrnoException (which advertises message/stack/path/syscall) with the inline { code?: string } shape strictly narrows what TS will let downstream code reach for. Original m1 intent (log only the code, never the raw message) is preserved.',
    rationale:
      'This is a small win, not a regression. Worth a code comment so the next refactor does not "helpfully" widen the cast back to ErrnoException to gain access to more fields.',
    proposedFix:
      'Add a one-line comment above each cast: `// Narrow cast — Security m1 keeps err.message out of logs.`',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-5',
    title: 'Zod 4 z.record migration verified equivalent — record-keeping note',
    severity: 'suggestion',
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        line: 274,
        excerpt: 'z.record(z.string(), z.unknown()),',
        note: 'mcp:call-tool args schema, second tuple element.',
      },
      {
        file: 'node_modules/zod/package.json',
        line: 1,
        excerpt: '"version": "4.3.6"',
        note: 'Zod 4 confirmed.',
      },
    ],
    observed:
      'Zod 4 dropped the single-arg z.record(valueSchema). z.record(z.string(), z.unknown()) is the canonical replacement and validates exactly what JS plain objects always have (string keys, any values). No loosening — z.record still rejects arrays and null.',
    rationale:
      'No vulnerability. Logging this as a passed-control entry so the audit trail explicitly records that the Zod 4 migration was reviewed and equivalence verified.',
    proposedFix: 'No action needed.',
    scope: 'one-line',
    status: 'wontfix',
    resolution: 'Verified equivalent during this review — keeping for audit trail.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'TSC-CLEANUP',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-25',
    round: 1,
    scope: [
      'electron/autoUpdater.ts',
      'shared/ipc-validators.ts',
      'electron/preload.ts:830-870',
      'electron/main.ts:3855-3890',
      'src/main.tsx',
      'src/types/flint-api.d.ts',
      'src/store/__tests__/tokenStore.protoPollution.test.ts',
      'src/lib/autoResume.ts',
      'src/store/canvasStore.ts',
      'tsconfig.tests.json',
      'shared/contract-schema.ts',
      '.flint-context/contracts/MINT.5-phase3.contract.ts',
      '.flint-context/contracts/CHRON.1.contract.ts',
    ],
    markdownFile: 'TSC-CLEANUP-security-review-2026-04-25.md',
  },
  rubric: [
    { criterion: 'mcp:call-tool IPC channel validates payload at preload bridge via Zod', result: 'pass' },
    { criterion: 'Per-tool MCP argument schemas (MCP_TOOL_ARG_SCHEMAS) still gate sync tools', result: 'pass' },
    { criterion: 'Zod 4 z.record migration preserves validation strictness', result: 'pass' },
    { criterion: 'flattenDTCG prototype-pollution runtime guard unchanged', result: 'pass' },
    { criterion: 'Error-code redaction (Security m1) preserved in canvasStore + autoResume', result: 'pass' },
    {
      criterion: 'autoUpdater bypass cannot be triggered in production builds',
      result: 'fail',
      evidence: 'electron/autoUpdater.ts:70 — env var honoured regardless of NODE_ENV',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'Test tsconfig still catches unused security-helper imports',
      result: 'fail',
      evidence: 'tsconfig.tests.json:5 — noUnusedLocals: false',
      relatedFindings: ['WARN-3'],
    },
    {
      criterion: 'Production code uses single-cast typed wrappers, not double-cast escape hatches',
      result: 'fail',
      evidence: 'src/main.tsx:19, src/components/ui/GovernanceDashboard.tsx, src/components/ui/LaunchScreen.tsx',
      relatedFindings: ['WARN-2'],
    },
    { criterion: 'New ProvenanceInfo optional fields not yet rendered (no XSS/path-traversal exposure)', result: 'pass' },
    { criterion: 'CHRON.1 grandfathered IPC channels have live Zod validators despite optional contract field', result: 'pass' },
    { criterion: 'No new IPC channels added without validator entries', result: 'pass' },
    { criterion: 'No fs/child_process/crypto imports introduced into src/', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'electron/autoUpdater.ts',
      'shared/ipc-validators.ts',
      'electron/preload.ts:830-870',
      'electron/main.ts:3855-3890',
      'src/main.tsx',
      'src/types/flint-api.d.ts:2440-2480',
      'src/store/__tests__/tokenStore.protoPollution.test.ts',
      'src/lib/autoResume.ts:160-190',
      'src/store/canvasStore.ts:820-844',
      'tsconfig.tests.json',
      'shared/contract-schema.ts:220-250',
      '.flint-context/contracts/MINT.5-phase3.contract.ts',
      '.flint-context/contracts/CHRON.1.contract.ts:220-260',
    ],
    skipped: [
      'Remaining ~7 test-file double-cast sites — sampled 2, pattern uniform',
      'electron/__tests__/autoUpdater.test.ts — test file, not a production attack surface',
      'flint-mcp/ — out of scope for this branch (no engine changes)',
    ],
  },
};
