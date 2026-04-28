/**
 * Machine-readable code review for HELLO-FLINT-PHASE-A.
 *
 * Sibling to: HELLO-FLINT-PHASE-A-code-review-2026-04-26.md
 *
 * Verdict is derived from finding-severity counts via deriveVerdict().
 * Do not hardcode the verdict — let the math assign it.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  // ── W-1: validateIPC bypass at the renderer adapter ──────────────────────
  {
    id: 'W-1',
    title: 'web-api.ts `hello` namespace bypasses validateIPC at the renderer boundary',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/adapters/web-api.ts',
        line: 643,
        excerpt: "hello: { detectEditors: () => invoke('hello:detect-editors') as Promise<...>, ...",
        note: 'No validateIPC / validateIPCResponse in the entire namespace; payload + response are raw casts.',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 608,
        note: 'helloDetectEditorsSchema, helloWriteMcpConfigBulkSchema, helloAlreadyConnectedSchema all exist as named exports but are never invoked at the renderer boundary.',
      },
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md',
        line: 38,
        excerpt:
          "Add `hello` namespace on `window.flintAPI` (`detectEditors`, `writeMcpConfigBulk`, `alreadyConnected`) routed through `validateIPC`",
        note: 'Contract impact-map row mandates validateIPC routing.',
      },
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 188,
        note: "IPC table assigns named validators ('helloDetectEditorsSchema' etc.) to all 3 channels; the renderer adapter does not invoke them.",
      },
    ],
    observed:
      'The exported Zod validators satisfy the contract linter via grep, but src/adapters/web-api.ts:643-689 invokes the IPC channels with `invoke(...) as Promise<...>` casts, never calling validateIPC on payload nor validateIPCResponse on result.',
    rationale:
      'The contract uses Design by Contract at the preload bridge as a deliberate safety boundary — renderer pre-validates payload, main re-validates as an independent invariant. Skipping renderer-side validation weakens the boundary and breaks consistency with other namespaces (tokens:*, runtime:run-axe, flint:getCoverageSummary) that do route through validateIPC. The validators become decorative — present at lint time, absent at runtime.',
    proposedFix:
      'In src/adapters/web-api.ts:643-689, import the four Zod schemas from shared/ipc-validators and wrap each call: `helloDetectEditorsSchema.parse(await invoke(...))` for response validation, `helloWriteMcpConfigBulkSchema.parse(payload)` before sending. Removes the `as Promise<...>` casts and gives the contract its actual runtime gate.',
  },

  // ── W-2: Beta useEffect re-opens welcome for returning testers ───────────
  {
    id: 'W-2',
    title: 'Beta useEffect re-opens welcome for returning beta testers (storage-key blind spot)',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 144,
        excerpt: "const HELLO_WELCOME_KEY = 'flint:has-seen-hello-welcome:v1'",
        note: 'Gate state initialiser at line 145-150 reads BOTH this key AND the component-own key.',
      },
      {
        file: 'src/App.tsx',
        line: 814,
        excerpt: 'if (getHasSeenHelloWelcome()) return',
        note: 'Beta effect short-circuit reads ONLY the component-own key, not the v1 sentinel.',
      },
      {
        file: 'src/App.tsx',
        line: 819,
        excerpt: 'setBetaWelcomeDone(false)',
        note: 'Unconditionally re-opens the welcome gate when info.isBeta is true.',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 700,
        excerpt: "return localStorage.getItem(STORAGE_KEY) === 'true'",
        note: "hasSeenHelloWelcome() reads only 'flint-hello-welcome-seen', not the v1 sentinel.",
      },
    ],
    observed:
      'A returning user whose flint:has-seen-hello-welcome:v1 is set but whose flint-hello-welcome-seen is unset will have hasSeenWelcome initialise to true, then have setBetaWelcomeDone(false) called by the beta effect, which re-opens the welcome screen.',
    rationale:
      'Acceptance criterion #1 in the contract intends "first-time tester opening Flint sees HelloFlintWelcome (not BetaWelcome)" with the implicit "returning users do not". The beta-effect inverts the gate based on a single key while the gate state itself reads two — a returning beta tester whose v1 key is set will see the welcome flash open on the second launch.',
    proposedFix:
      'Either (a) gate the beta useEffect on the same dual-key check the state initialiser uses, or (b) collapse to one source of truth — drop HELLO_WELCOME_V1_KEY entirely and have App.tsx only consult hasSeenHelloWelcome(). Option (b) also resolves W-3.',
  },

  // ── W-3: Storage-key duplication ─────────────────────────────────────────
  {
    id: 'W-3',
    title: 'Two distinct localStorage keys for the same welcome-seen state',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 59,
        excerpt: "const STORAGE_KEY = `${BRAND.productLower}-hello-welcome-seen`;",
        note: "Resolves to 'flint-hello-welcome-seen'.",
      },
      {
        file: 'src/App.tsx',
        line: 144,
        excerpt: "const HELLO_WELCOME_KEY = 'flint:has-seen-hello-welcome:v1'",
      },
      {
        file: 'src/App.tsx',
        line: 154,
        excerpt: "try { localStorage.setItem(HELLO_WELCOME_KEY, 'true') } catch { }",
        note: 'App.tsx writes only the v1 key on setHasSeenWelcome(true).',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 171,
        excerpt: "localStorage.setItem(STORAGE_KEY, 'true');",
        note: 'Component writes only its own key on skip / verify / manual-done.',
      },
    ],
    observed:
      'Two distinct localStorage keys (one with hyphens, one with colons + v1 suffix) persist the same welcome-dismissed state. App.tsx writes one, the component writes the other, and only one of them participates in the v1 versioning scheme.',
    rationale:
      'Future-drift trap. Phase B will touch this flow; the next agent has two keys to keep in sync, two callers to update for any naming-convention change, and no comment explaining why both exist. Bumping to v2 will leave returning users half-migrated unless the component key is also bumped — but only the App.tsx key is named with version suffix.',
    proposedFix:
      'Pick one. Cleanest: delete HELLO_WELCOME_V1_KEY from App.tsx and have the gate consult only hasSeenHelloWelcome() from the component. The component is the only place the welcome is dismissed; centralising persistence there matches Zustand-store conventions used elsewhere. If versioning matters, embed it in the component key (flint-hello-welcome-seen-v1) and bump there.',
  },

  // ── W-4: Schema vs JSDoc divergence ──────────────────────────────────────
  {
    id: 'W-4',
    title: 'helloWriteMcpConfigBulkSchema does not enforce the constraints documented in its JSDoc',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        line: 619,
        excerpt:
          '* editors: non-empty array of editor names (1..3; handler dedupes).\n * mcpServerPath: absolute path string, min 1 char.',
        note: 'JSDoc documents non-empty + min 1.',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 624,
        excerpt:
          'editors: z.array(z.enum([\'claude-code\', \'cursor\', \'vscode\'])),\n  mcpServerPath: z.string(),',
        note: 'Schema is missing .nonempty()/.min(1)/.max(3) and .min(1).',
      },
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 422,
        excerpt: "edgeCases: ['empty editors array rejected by Zod', ...]",
        note: 'Contract testBoundary explicitly requires Zod-level rejection of empty array.',
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        line: 779,
        excerpt:
          'const schema = z.object({ editors: z.array(z.enum([...])).nonempty(), mcpServerPath: z.string().min(1) })',
        note: 'The test that "verifies" empty-array rejection constructs an inline schema with .nonempty() instead of importing the production helloWriteMcpConfigBulkSchema. False confidence.',
      },
    ],
    observed:
      'Production helloWriteMcpConfigBulkSchema accepts {editors: [], mcpServerPath: ""} via safeParse. The test that purports to verify empty-array rejection uses an inline schema with nonempty() rather than the production export.',
    rationale:
      'The Zod gate is supposed to be the first line of defense at the IPC boundary. Documented intent diverging from runtime behavior is the failure mode IPC validation is supposed to prevent. The handler\'s mcpServerPath !== canonicalMcpPath check (server/index.ts:3365) catches the empty string downstream, but the gate is open. The misleading test compounds the issue.',
    proposedFix:
      'Tighten the schema to `editors: z.array(z.enum(...)).min(1).max(3), mcpServerPath: z.string().min(1)` with .strict() at the object level. Update server/__tests__/helloFlintIpc.test.ts:779-790 to import and use helloWriteMcpConfigBulkSchema directly so the test exercises the real gate.',
  },

  // ── W-5: ipc-validators.js mirror drift risk ─────────────────────────────
  {
    id: 'W-5',
    title: 'ipc-validators.js mirror is hand-maintained with no automated sync',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        note: 'Last modified 2026-04-26 21:53; 685 lines.',
      },
      {
        file: 'shared/ipc-validators.js',
        note: 'Last modified 2026-04-26 21:46; 521 lines. Phase A schemas at 467-498 are present but the 7-minute mtime gap is the visible artifact of manual sync.',
      },
      {
        file: 'package.json',
        note: 'No script syncs or validates the .ts/.js parity. grep on package.json scripts/ for ipc-validators returns empty.',
      },
    ],
    observed:
      'Two source files for the same IPC contract, hand-maintained, with no compile-time or pre-commit gate that the .js matches the .ts. Phase A landed in sync, but the next phase that adds a schema may not.',
    rationale:
      'A schema present in .ts but missing from .js fails at runtime in any consumer that loads the .js (Node ESM without TS loader, build tooling). Silent drift means a phase that "passes TSC and tests" can ship a runtime failure.',
    proposedFix:
      'Either (a) delete shared/ipc-validators.js and import the .ts everywhere via the project\'s existing TS transpile path, or (b) generate the .js from the .ts at build time via a `validators:sync` step pre-commit. Option (a) is structurally cleaner if no consumer requires the pre-built .js — a 30-second investigation would confirm whether anything actually imports the .js.',
  },

  // ── W-6: as any casts in HelloFlintWelcome ───────────────────────────────
  {
    id: 'W-6',
    title: 'Three (window as any) casts in HelloFlintWelcome bypass the typed flintAPI surface',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 134,
        excerpt: 'const api = (window as any).flintAPI?.hello;',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 178,
        excerpt: 'const api = (window as any).flintAPI?.hello;',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 202,
        excerpt: 'const api = (window as any).flintAPI?.hello;',
      },
      {
        file: 'src/types/flint-api.d.ts',
        line: 2125,
        note: 'window.flintAPI.hello is fully typed including all 3 method signatures. The casts are unnecessary.',
      },
    ],
    observed:
      'Component casts window to any to access flintAPI.hello, even though the property is declared on the global FlintAPI interface and TypeScript would resolve it without any cast.',
    rationale:
      'The casts hide future type errors. If a contract change removes a method or alters its signature, the consumer code in this component will not surface the breakage at the TS layer — it will only appear at runtime. This is the exact category of error flint-api.d.ts exists to catch.',
    proposedFix:
      'Use `window.flintAPI.hello` directly and rely on optional chaining (`window.flintAPI?.hello`) for graceful degradation in pre-A2-landed environments. No `any` cast needed.',
  },

  // ── S-1: Manual snippet missing FLINT_PROJECT_ROOT env ───────────────────
  {
    id: 'S-1',
    title: 'Manual-snippet output diverges from server-written output (missing env block)',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 69,
        excerpt:
          "function buildManualSnippet(mcpServerPath: string): string { const config = { mcpServers: { flint: { command: 'node', args: [mcpServerPath] } } }; ... }",
        note: 'No env field.',
      },
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 175,
        excerpt:
          "existingServers['flint'] = { command: 'node', args: [mcpServerPath], env: { FLINT_PROJECT_ROOT: projectRoot ?? '' } }",
        note: 'Writer always includes the env block.',
      },
    ],
    observed:
      'A user copy-pasting the manual snippet gets a config without FLINT_PROJECT_ROOT env. Behavior diverges from the auto-written path.',
    rationale:
      'Whether the MCP server requires that env at boot determines whether this is a real bug or cosmetic. Either way, the manual-snippet path should produce the same config the writer would produce — that is the contract\'s "manual fallback covers any user the detector misses" guarantee.',
    proposedFix:
      'Either include `env: { FLINT_PROJECT_ROOT: "/your/project" }` in the snippet with a placeholder + comment, or document below the snippet that env is optional. Confirm with the MCP server whether env is required to escalate this to a warning.',
  },

  // ── S-2: "Both" button label mismatch when 3 editors present ─────────────
  {
    id: 'S-2',
    title: '"Both" button sends all 3 editors when all are present (label/action mismatch)',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 409,
        excerpt:
          "const hasBoth = present.some(e => e.editor === 'cursor') && present.some(e => e.editor === 'claude-code');",
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 443,
        excerpt: 'onClick={() => onChoose(present.map(e => e.editor))}',
        note: 'Sends ALL present editors, not just cursor + claude-code, despite "Both" label.',
      },
      {
        file: 'src/components/ui/__tests__/HelloFlintWelcome.test.tsx',
        line: 357,
        excerpt: 'expect(payload.editors.length).toBeGreaterThanOrEqual(2)',
        note: 'Test masks the issue with a >= 2 assertion.',
      },
    ],
    observed:
      'With cursor, claude-code, and vscode all present, clicking "Both" sends 3 editors. The label says Both but the action is "All".',
    rationale:
      'Cosmetic copy issue. No correctness problem — writing to all 3 is the user\'s likely intent — but the label is wrong.',
    proposedFix:
      'Either change the label to dynamic ("Both" when 2 present, "All" when 3), or change the click handler to onChoose([\'cursor\', \'claude-code\']) so label and action match. Former is more user-friendly.',
  },

  // ── S-3: Test files collapsed contrary to contract impact map ────────────
  {
    id: 'S-3',
    title: 'Test files collapsed into one file instead of two as the contract impact map specifies',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 148,
        excerpt:
          "{ file: 'server/services/__tests__/ideDetection.test.ts', changeType: 'CREATE', ... }, { file: 'server/services/__tests__/mcpConfigWriter.test.ts', ... }",
        note: 'Contract impact map calls for two separate test files.',
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        note: '916-line single file containing all ideDetection + mcpConfigWriter + handler-mirror tests. Coverage is correct; layout differs from contract.',
      },
    ],
    observed:
      'A single-file test layout instead of the contract\'s two-file layout. The 47 tests cover the same boundaries.',
    rationale:
      'Not a correctness issue, but the integration validator and future test writers will look for the contract-named files first. A 916-line mixed-domain file is also harder to scan than two focused ones.',
    proposedFix:
      'Split into the two files the contract names. Each section is already labelled by domain (`ideDetection`, `mcpConfigWriter — writeMcpConfig`, etc.) — the split is mechanical.',
  },

  // ── S-4: helloDetectEditorsSchema name vs validator-field semantics ──────
  {
    id: 'S-4',
    title: 'helloDetectEditorsSchema is named as a payload validator but defines the response shape',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 195,
        excerpt: "validator: 'helloDetectEditorsSchema'",
        note: 'IPC table assigns this as the channel validator. Convention: validator field names a payload validator.',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 606,
        excerpt: '/** HELLO-FLINT-A — response validator for `hello:detect-editors`. */',
        note: 'Schema validates the response shape, not the (undefined) payload.',
      },
    ],
    observed:
      'The contract\'s `validator` field by convention names a payload validator; this export is named ambiguously and validates the response shape. Contract linter only greps for the export name so the lint passes.',
    rationale:
      'A future reader following the contract\'s `validator` reference will load this schema expecting payload semantics and find response semantics. Cosmetic but trips up linters and docs.',
    proposedFix:
      'Rename to helloDetectEditorsResponseSchema and either add a payload schema (z.undefined()) for the contract\'s validator field, or update the contract schema to allow a `responseValidator` field where appropriate.',
  },
];

const counts = countFindings(findings);
const verdict = deriveVerdict(findings, 'code');

export const REPORT: ReviewReport = {
  meta: {
    phase: 'HELLO-FLINT-A',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-26',
    round: 1,
    scope: [
      'src/components/ui/HelloFlintWelcome.tsx (NEW, 707 lines)',
      'src/components/ui/__tests__/HelloFlintWelcome.test.tsx (NEW, 585 lines, 39 tests)',
      'src/App.tsx (MODIFIED render-gate region + alreadyConnected useEffect)',
      'src/__tests__/App.renderOrder.test.tsx (NEW, 15 tests)',
      'src/components/__tests__/AppMountGate.test.tsx (mock updates)',
      'server/services/ideDetection.ts (NEW, 162 lines)',
      'server/services/mcpConfigWriter.ts (NEW, 278 lines)',
      'server/services/fileTransactionManager.ts (NEW, 67 lines)',
      'server/__tests__/helloFlintIpc.test.ts (NEW, 916 lines, 47 tests)',
      'server/index.ts (MODIFIED handler region 3220-3402)',
      'shared/ipc-validators.ts and shared/ipc-validators.js (HELLO-FLINT region)',
      'src/adapters/web-api.ts (hello namespace)',
      'src/types/flint-api.d.ts (hello namespace)',
      'Contract artifacts (.md + .ts)',
    ],
    markdownFile: 'HELLO-FLINT-PHASE-A-code-review-2026-04-26.md',
  },
  rubric: [
    {
      criterion:
        'Process boundary holds: no fs/path/electron/sqlite imports under src/',
      result: 'pass',
      evidence:
        'grep on src/components/ui/HelloFlintWelcome.tsx and src/App.tsx returns no fs/path/electron/sqlite imports',
    },
    {
      criterion:
        'mcpConfigWriter.ts contains zero direct fs.writeFile / writeFileSync calls (Commandment 14)',
      result: 'pass',
      evidence:
        'server/services/mcpConfigWriter.ts:1-278 — only readFileSync, mkdirSync, existsSync used. Source-grep test at server/__tests__/helloFlintIpc.test.ts:522-539 enforces the invariant.',
    },
    {
      criterion: 'Existing-config preservation: 0 entries lost across randomized fixtures',
      result: 'pass',
      evidence:
        'server/__tests__/helloFlintIpc.test.ts:625-649 — 20-fixture property test verifies preservation count exactly matches inserted count.',
    },
    {
      criterion: 'JSONC comment stripping handled before parse',
      result: 'pass',
      evidence:
        'server/services/mcpConfigWriter.ts:62-112 implementation; tests at lines 290-328 (helper) and 466-505 (integrated through writeMcpConfig).',
    },
    {
      criterion: 'File-doesn\'t-exist atomic merge tested',
      result: 'pass',
      evidence:
        'server/__tests__/helloFlintIpc.test.ts:443-461 — non-existent nested path creates parent dirs and produces preservedEntries:0.',
    },
    {
      criterion: 'mcpServerPath mismatch rejected server-side',
      result: 'pass',
      evidence:
        'server/index.ts:3362-3367 throws when payload.mcpServerPath !== getMCPServerPath().',
    },
    {
      criterion:
        'Render gate ordering: setupComplete → consent → HelloFlintWelcome → RestoringSplash → LaunchScreen',
      result: 'pass',
      evidence: 'src/App.tsx:1000-1069 — gates evaluated in correct order.',
    },
    {
      criterion: 'Already-connected fast-path runs on mount before any user interaction',
      result: 'pass',
      evidence:
        'src/App.tsx:792-808 + tests at src/__tests__/App.renderOrder.test.tsx:111-147.',
    },
    {
      criterion: 'All 3 hello channels declare a Zod validator named in the contract',
      result: 'pass',
      evidence:
        'shared/ipc-validators.ts:608, 623, 648 — helloDetectEditorsSchema, helloWriteMcpConfigBulkSchema, helloAlreadyConnectedSchema all exported.',
    },
    {
      criterion: 'web-api.ts hello namespace routes through validateIPC per the contract',
      result: 'fail',
      evidence:
        'src/adapters/web-api.ts:643-689 — invoke() called directly with `as Promise<...>` casts; no validateIPC anywhere in the namespace.',
      relatedFindings: ['W-1'],
    },
    {
      criterion:
        'helloWriteMcpConfigBulkSchema enforces its documented constraints (non-empty editors, non-empty mcpServerPath)',
      result: 'fail',
      evidence:
        'shared/ipc-validators.ts:623-626 — neither .nonempty() nor .min(1) on editors; no .min(1) on mcpServerPath. The handler test at helloFlintIpc.test.ts:779-790 builds an inline schema with these constraints rather than importing the production schema, masking the gap.',
      relatedFindings: ['W-4'],
    },
    {
      criterion: 'Beta-effect respects the welcome\'s persistence on returning launches',
      result: 'fail',
      evidence:
        'src/App.tsx:813-824 — only consults the component\'s flint-hello-welcome-seen key; can re-open welcome for users who have only the v1 sentinel set.',
      relatedFindings: ['W-2'],
    },
    {
      criterion: 'Component uses typed window.flintAPI.hello surface, not (window as any)',
      result: 'fail',
      evidence:
        'src/components/ui/HelloFlintWelcome.tsx:134, 178, 202 — three `(window as any).flintAPI?.hello` casts despite full typing in flint-api.d.ts:2125-2171.',
      relatedFindings: ['W-6'],
    },
    {
      criterion: 'Token-only styling — zero raw hex, zero arbitrary bracket color values',
      result: 'pass',
      evidence:
        'Tests at src/components/ui/__tests__/HelloFlintWelcome.test.tsx:499-514 enforce static-grep against #RGB/#RRGGBB/#RRGGBBAA and [#hex] patterns.',
    },
    {
      criterion: 'npx tsc -b exits 0',
      result: 'pass',
      evidence: 'Clean run, zero diagnostics.',
    },
  ],
  findings,
  counts,
  verdict,
  scopeCoverage: {
    reviewed: [
      'src/components/ui/HelloFlintWelcome.tsx',
      'src/components/ui/__tests__/HelloFlintWelcome.test.tsx',
      'src/App.tsx (render-gate + alreadyConnected useEffect + storage-key region)',
      'src/__tests__/App.renderOrder.test.tsx',
      'src/components/__tests__/AppMountGate.test.tsx (mock updates)',
      'server/services/ideDetection.ts',
      'server/services/mcpConfigWriter.ts',
      'server/services/fileTransactionManager.ts',
      'server/__tests__/helloFlintIpc.test.ts',
      'server/index.ts (handler region 3220-3402)',
      'shared/ipc-validators.ts (HELLO-FLINT region)',
      'shared/ipc-validators.js (HELLO-FLINT region — drift check)',
      'src/adapters/web-api.ts (hello namespace, lines 642-689)',
      'src/types/flint-api.d.ts (hello namespace, lines 2117-2171)',
      '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md',
      '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
    ],
    skipped: [
      'electron/preload.ts — Phase A is web-transport-first by design (contract section 1)',
      'electron/main.ts — legacy setup:* channels kept as-is, out of scope per Phase 2.5 brief',
      'electron/thumbnailGenerator.ts and electron/visualAuditor.ts — pre-existing TSC errors flagged out of scope (full tsc -b actually passes here)',
      'src/components/ui/SetupWizard.tsx — explicitly retained for menu Reset State path (contract resolved Q1)',
      'Phase B walkthrough work — separate spec, not built yet',
    ],
  },
};
