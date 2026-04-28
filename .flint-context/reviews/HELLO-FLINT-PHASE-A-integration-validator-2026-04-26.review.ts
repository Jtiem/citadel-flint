/**
 * Integration Validator (Canary) Review — HELLO-FLINT-PHASE-A
 *
 * Sibling to HELLO-FLINT-PHASE-A-integration-validator-2026-04-26.md.
 * Run AFTER the three scoped domain reviewers (UX, code, security) per the
 * cheaper-pilot canary protocol. Findings are net-new (not duplicates of
 * scoped reviewers) but cross-reference scoped findings where relevant.
 */

import type {
  ReviewFinding,
  ReviewMeta,
  RubricItem,
  ScopeCoverage,
  FindingCounts,
} from '../../shared/review-schema';

export const meta: ReviewMeta = {
  phase: 'HELLO-FLINT-A',
  dimension: 'code', // canary doubles as a code-level cross-cutting check
  reviewer: 'flint-integration-validator',
  date: '2026-04-26',
  round: 1,
  scope: [
    'Phase A diff coherence with the consent-dialog gate added earlier this session',
    'betaWelcomeDone alias correctness against new hasSeenWelcome state',
    'localStorage key proliferation (welcome state)',
    'electron/ legacy path drift (web-transport-first contract)',
    'shared/ipc-validators.{ts,js} mirror sync',
    'Working-tree merge cleanliness between Phase A edits and prior consent dialog work',
    'Test isolation across server/__tests__/helloFlintIpc.test.ts and component tests',
    'IPC mocking patchwork consistency',
    'Contract risk #2 → testBoundary binding',
    'Coverage gaps in testBoundaries that allowed security BLK-1/BLK-2',
  ],
  markdownFile:
    '.flint-context/reviews/HELLO-FLINT-PHASE-A-integration-validator-2026-04-26.md',
};

export const findings: ReviewFinding[] = [
  {
    id: 'BLK-INT-1',
    title:
      'dist-web bundles are stale; closed-beta package would ship without Phase A wired in',
    severity: 'blocking',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'dist-web/assets/index-jgT4Ysmo.js',
        note: 'Built 2026-04-26 20:02; contains zero matches for "Welcome to Flint", "HelloFlintWelcome", "alreadyConnected", "detectEditors", "writeMcpConfigBulk".',
      },
      {
        file: 'shared/ipc-validators.ts',
        note: 'Last modified 2026-04-26 21:53 — ~2 hours after the dist-web bundle was built.',
      },
      {
        file: 'src/components/ui/BetaWelcome.tsx',
        note: 'Source file deleted in working tree; bundle still references the deleted component shape.',
      },
    ],
    observed:
      'The committed dist-web bundle does not contain any HELLO-FLINT-PHASE-A code. Source files added the welcome surface, the hello namespace, and the schemas roughly two hours after the last bundle build. The bundle that would ship to a closed-beta tester carries the OLD BetaWelcome flow, not the new HelloFlintWelcome one.',
    rationale:
      "Closed-beta-blocking. If a tester opens the web build (the install guide is the first surface they see), they will land on the deleted BetaWelcome UI shape, the install guide will describe nothing they can use, and the entire Phase A effort is invisible. None of the three domain reviewers had build-artifact freshness in scope, so this slipped through the ceremony.",
    proposedFix:
      "Re-run `npm run build:web` and commit the new dist-web bundles in the same commit as the Phase A source changes. Or remove dist-web/ from the working tree and add it to .gitignore. Add a pre-commit hook that warns when src/ source has been modified more recently than dist-web/assets/*.js.",
  },

  {
    id: 'BLK-INT-2',
    title:
      'betaWelcomeDone legacy alias breaks one-way persistence; returning beta tester can have welcome re-open mid-session',
    severity: 'blocking',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 151,
        excerpt:
          "const setHasSeenWelcome = useCallback((value: boolean) => { setHasSeenWelcomeRaw(value); if (value) { try { localStorage.setItem(HELLO_WELCOME_KEY, 'true') } catch {} } }, [])",
        note: 'One-way ratchet: only persists "true"; calling with false updates React state but writes nothing.',
      },
      {
        file: 'src/App.tsx',
        line: 159,
        excerpt: 'const betaWelcomeDone = hasSeenWelcome\nconst setBetaWelcomeDone = setHasSeenWelcome',
        note: 'Alias to the same one-way ratchet, but used as a two-way toggle.',
      },
      {
        file: 'src/App.tsx',
        line: 819,
        excerpt: 'setBetaWelcomeDone(false)',
        note: 'Beta info effect flips the gate to false after IPC resolves.',
      },
      {
        file: 'src/App.tsx',
        line: 1028,
        excerpt: 'if (!hasSeenWelcome) { return <HelloFlintWelcome ... /> }',
        note: 'Gate fires on every flip to false — re-opens welcome mid-session.',
      },
    ],
    observed:
      'A returning beta tester whose v1 key is set in localStorage: (1) hasSeenWelcome initialises true on mount; (2) beta-info IPC resolves ~20-200ms later, info.isBeta is true, calls setBetaWelcomeDone(false); (3) React state flips to false → welcome screen pops up over LaunchScreen; (4) user dismisses, v1 key is re-persisted as "true" but the sequence repeats next launch.',
    rationale:
      "Code review's W-2 caught the storage-key duplication symptom; this finding identifies the deeper cause. The alias is a two-way toggle while the underlying setter is a one-way ratchet, and Phase A inherited the prior code's toggle semantics without checking whether they still apply. Pre-Phase-A the gate was `if (!betaWelcomeDone && betaInfo)` — gated on BOTH conditions so the IPC effect couldn't reopen mid-session. Phase A simplified to `if (!hasSeenWelcome)` and the prior IPC flip became a regression.",
    proposedFix:
      'Smallest fix: delete the setBetaWelcomeDone(false) call at App.tsx:819. The beta-info effect should ONLY populate betaInfo for the welcome footer; gate ownership belongs to HelloFlintWelcome onComplete/onSkip. Cleaner fix: drop the legacy alias entirely (rename betaWelcomeDone → hasSeenWelcome at lines 872, 934).',
  },

  {
    id: 'BLK-INT-3',
    title:
      'Four hello* Zod schemas exist as orphan named exports; not registered in ipcSchemas registry; createValidatedInvoker cannot dispatch hello channels',
    severity: 'blocking',
    scope: 'architectural',
    status: 'open',
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        line: 39,
        excerpt: "export const ipcSchemas = { 'tokens:create': { ... }, ... }",
        note: 'Registry contains 15 channels: tokens:*, figma:*, saveFile, readFile, server:get-status, ping, governance:*, flint:getCoverageSummary, runtime:run-axe, mcp:call-tool. No hello:* keys.',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 608,
        excerpt: 'export const helloDetectEditorsSchema = z.object({ ... })',
        note: 'Defined OUTSIDE ipcSchemas at line 608, after the `} satisfies …` close at line 279.',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 671,
        excerpt: 'const schema = ipcSchemas[channel];',
        note: "createValidatedInvoker returns undefined for channel='hello:detect-editors' — no registry entry.",
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 643,
        excerpt: "hello: { detectEditors: () => invoke('hello:detect-editors') as Promise<...>, ... }",
        note: 'Renderer adapter calls invoke() with bare type casts; never imports any hello schema; never calls validateIPC.',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 288,
        excerpt: "export const getCoverageSummaryPayloadSchema = ipcSchemas['flint:getCoverageSummary'].payload",
        note: 'Established pattern (Phase 0, RUNTIME.1, MINT.5): register inside ipcSchemas, then re-export an alias by name to satisfy the contract linter grep. HELLO-FLINT-A skipped this.',
      },
    ],
    observed:
      "The four named exports satisfy the Phase 1.5 contract linter's grep, but they are architecturally orphaned. They cannot be reached through the standard createValidatedInvoker path because the registry lookup returns undefined for any hello:* channel. The renderer adapter doesn't import them. The server uses helloWriteMcpConfigBulkSchema directly via dynamic import (server/index.ts:3352), which works but bypasses the standard validation pipeline every other phase wires through.",
    rationale:
      'Architectural-scope failure with two consequences. (1) The contract IPC table named hello*Schema exports as the channel `validator` field; future agents extending Phase A in Phase B will follow that pattern and either duplicate the orphan-schema mistake or have to refactor. (2) Phase 1.5 linter rule "validator export name on every renderer→main / bidirectional IPC channel linking to shared/ipc-validators.ts" passed because the export exists, but the linter does not check registry membership. Phase A is the first phase to exploit this gap (likely unintentionally). Code review W-1 caught the symptom (web-api.ts skips validateIPC); this finding identifies the structural cause that prevents the W-1 fix from being applied without also fixing the registry.',
    proposedFix:
      "Move the four hello* schemas INTO ipcSchemas as `'hello:detect-editors': { payload: z.undefined(), response: helloDetectEditorsSchema }`, `'hello:write-mcp-config-bulk': { payload: helloWriteMcpConfigBulkSchema, response: helloWriteMcpConfigBulkResponseSchema }`, `'hello:already-connected': { payload: z.undefined(), response: helloAlreadyConnectedSchema }`. Keep the existing named exports (they will reference the same schema objects). Then update web-api.ts:643-689 to use `validateIPC(channel, payload, ipcSchemas[channel].payload)` — both fixes must land together. Lift the Phase 1.5 contract linter to also assert `validator export ∈ ipcSchemas`.",
  },

  {
    id: 'WARN-INT-1',
    title:
      'Tests mirror handler logic instead of invoking it; testBoundary "given the WS server is running" downgraded to a unit re-implementation',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 413,
        excerpt:
          "given: 'the WebSocket IPC server is running with hello:detect-editors registered',",
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        line: 728,
        excerpt:
          "describe('hello:detect-editors handler (mirror logic)', () => { async function helloDetectEditorsHandler(...) { ... } it('returns ...', async () => { const result = await helloDetectEditorsHandler(tmpDir) } })",
        note: 'Mirror function defined in the test file; production handler in server/index.ts is never invoked.',
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        line: 779,
        excerpt:
          "it('rejects empty editors array', () => { const schema = z.object({ editors: ...nonempty(), mcpServerPath: z.string().min(1) }); ... })",
        note: "Constructs an inline Zod schema instead of importing the production helloWriteMcpConfigBulkSchema. The justification at line 776 ('Zod v4 named-export resolution quirk') is suspect because server/index.ts:3352 dynamic-imports the same schema successfully at runtime.",
      },
      {
        file: 'src/__tests__/App.renderOrder.test.tsx',
        line: 36,
        excerpt:
          'function computeInitialHasSeenWelcome(): boolean { try { if (localStorage.getItem(COMPONENT_STORAGE_KEY) === "true") return true } catch {} ... }',
        note: 'Simulates the App.tsx state initialiser instead of testing the real component.',
      },
    ],
    observed:
      "The contract testBoundary intent (the IPC server is running, the renderer invokes the channel, the round-trip returns the contract-shaped response) has been weakened across three test files into 'the test re-implements what the handler is supposed to do, then asserts the re-implementation is consistent with itself.' If the production handler drifts from the test mirror, the test passes while production breaks.",
    rationale:
      'Contract risk #2 (security review BLK-1) is the canonical example: the contract told the architect that JSONC parse failure needed a test fixture, the test added covers the happy path, and the actual mitigation requirement (refuse-to-write on parse failure) was never exercised. When the handler under test is a simulation, the gaps the security reviewer found have nowhere to fall through. This compounds with WARN-INT-2 (no adapter tests) — the renderer→server boundary is exercised only at the component level (mock IPC) and the server level (mirror handler). Nothing tests the wire.',
    proposedFix:
      'Add a true integration test that boots server/index.ts on a test port and makes real /api/ipc POST requests against the registered handlers (server/__tests__/index.test.ts may already have the harness). Replace the inline-Zod test at helloFlintIpc.test.ts:779-790 with one that imports helloWriteMcpConfigBulkSchema from the production module. If the import truly fails in vitest, file the bundler issue and document it; do not paper over with a different schema.',
  },

  {
    id: 'WARN-INT-2',
    title: 'web-api.ts adapter has zero unit tests for the hello namespace',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/adapters/__tests__/web-api.test.ts',
        note: "grep 'hello\\|detect-editors\\|write-mcp-config' returns 0 matches.",
      },
      {
        file: 'src/components/ui/__tests__/HelloFlintWelcome.test.tsx',
        line: 78,
        excerpt: "(window as any).flintAPI.hello = makeHelloAPI();",
        note: 'Component tests bypass the adapter entirely by mocking window.flintAPI.hello with vi.fn objects directly.',
      },
    ],
    observed:
      'The renderer-side adapter (the only thing wrapping wire-format invoke() into the typed window.flintAPI.hello.* surface) has zero test coverage for any of its three new methods. Combined with WARN-INT-1, there is exactly zero automated coverage of the actual round-trip from renderer to server.',
    rationale:
      'A future agent could remove a method from web-api.ts:643-689 entirely and the test suite would still report 3600/3600 passing. The architectural seam between renderer and server is invisible to the test suite. This is the kind of gap the Lever A scope ("code reviewer = modified files + tests + callers") was supposed to cover; the code reviewer did flag the validateIPC bypass (W-1) but had no tests to point to for evidence of behaviour.',
    proposedFix:
      'Add src/adapters/__tests__/web-api.hello.test.ts (or extend web-api.test.ts) with five to seven tests: each window.flintAPI.hello.* method calls invoke() with the expected channel, the typed return shape is preserved for typical responses, and rejections propagate correctly (the component depends on this for the error state path).',
  },

  {
    id: 'WARN-INT-3',
    title:
      'Implementation files redeclare contract types instead of importing them; only HelloFlintWelcome.tsx imports from the contract',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 13,
        excerpt:
          'Phase 2 agents: import the type aliases below directly. Do not redeclare them in implementation files — the contract is the source of truth.',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 34,
        excerpt:
          "} from '../../../.flint-context/contracts/HELLO-FLINT-PHASE-A.contract';",
        note: 'Correctly imports types from the executable contract.',
      },
      {
        file: 'server/services/ideDetection.ts',
        line: 22,
        excerpt: '// ── Types (mirrors HELLO-FLINT-PHASE-A.contract.ts) ─────────',
        note: 'Redeclares EditorName, DetectedEditor, DetectEditorsResponse locally instead of importing.',
      },
      {
        file: 'server/services/mcpConfigWriter.ts',
        note: 'Same pattern — redeclares interface WriteMcpConfigResult locally.',
      },
      {
        file: 'src/types/flint-api.d.ts',
        line: 2125,
        note: 'hello namespace declaration inlines all type signatures verbatim.',
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 643,
        note: 'Inlines types in invoke() casts.',
      },
    ],
    observed:
      'Of the five files in scope that touch the hello surface, only HelloFlintWelcome.tsx imports types from the executable contract. The other four duplicated declarations. The contract preamble explicitly forbade this.',
    rationale:
      'Phase 1.5 contract linting and Phase 3 integration validation are predicated on the assumption that "the contract is the source of truth and Phase 2 imports it." When implementation files drift to local declarations, a rename in the contract no longer surfaces as a TS error in the implementation. The contract becomes documentation rather than executable; future agents see four "valid" places to declare a type and pick one based on proximity. This is the long-tail erosion the v2 contract framework was designed to prevent.',
    proposedFix:
      'Replace redeclared types in ideDetection.ts, mcpConfigWriter.ts, flint-api.d.ts, and web-api.ts with imports from .flint-context/contracts/HELLO-FLINT-PHASE-A.contract. For the .d.ts ambient declaration, match the existing pattern used by other contract-derived types in flint-api.d.ts.',
  },

  {
    id: 'WARN-INT-4',
    title:
      "Server `await import('../shared/ipc-validators.js')` couples runtime to the .js mirror; any drift between .ts and .js becomes a server-side runtime failure",
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'server/index.ts',
        line: 3352,
        excerpt:
          "const { helloWriteMcpConfigBulkSchema } = await import('../shared/ipc-validators.js')",
        note: 'Explicit .js extension forces Node ESM resolution to the mirror.',
      },
      {
        file: 'shared/ipc-validators.ts',
        note: '685 lines, last modified 2026-04-26 21:53.',
      },
      {
        file: 'shared/ipc-validators.js',
        note: '521 lines, last modified 2026-04-26 21:46. 7-minute mtime gap.',
      },
      {
        file: 'package.json',
        note: 'No validators:sync script, no prebuild step that emits .js from .ts.',
      },
    ],
    observed:
      'Code review W-5 named the dual-file mirror drift as a future risk. The integration validator can confirm it is more than future risk: the server runtime explicitly depends on the .js mirror (not the .ts source). For the renderer adapter (TypeScript build pipeline), .ts is the source of truth. Two consumers, two source files, hand-maintained — and the consumer that needs the most immediate correctness (the server) is bound to the file that lacks compile-time checks.',
    rationale:
      'Phase A happened to remember to update both files. Phase B will be a different agent in a different session who reads only the .ts and assumes a build step emits the .js. When that agent adds a schema and ships, the server will throw on the missing helloFooSchema import at runtime — never at build, never in tests (which run TypeScript). This is the structural failure W-5 was warning about.',
    proposedFix:
      'Pick one: (a) delete shared/ipc-validators.js and configure the server TS pipeline to import .ts directly, or (b) add a "sync:validators" npm script + pre-commit hook that regenerates .js from .ts. If the .js exists because the server runtime cannot consume .ts directly, the build step should be authoritative and the .js should NOT be hand-edited.',
  },

  {
    id: 'WARN-INT-5',
    title:
      'AppMountGate.test.tsx beforeEach uses conditional mock setup that leaks state across tests',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/__tests__/AppMountGate.test.tsx',
        line: 189,
        excerpt:
          'beforeEach(() => { if ((window as any).flintAPI && !(window as any).flintAPI.hello) { ;(window as any).flintAPI.hello = { ... } } })',
      },
    ],
    observed:
      'The hello mock is only installed when flintAPI.hello is absent. Once a prior test installs it (or another test mutates its methods), the conditional skips re-installation. If a test mutates window.flintAPI.hello.alreadyConnected to reject, the next test inherits the rejected mock instead of a fresh connected:true resolution.',
    rationale:
      'The contract testBoundary HelloFlintWelcome:already-connected fast path requires deterministic mock state per test (must-not-double-trigger and rejects edge cases). The conditional pattern works while no test mutates the mock, but Phase B will inevitably need to test rejection paths and the leak surfaces only when a prior failure leaves the mock in a non-default state. vi.restoreAllMocks() restores spies but does not reassign the namespace.',
    proposedFix:
      'Drop the conditional; always reinstall a fresh mock object in beforeEach. Apply the same pattern HelloFlintWelcome.test.tsx:72-79 already uses correctly.',
  },

  {
    id: 'WARN-INT-6',
    title:
      'Contract risk #2 mitigation requirement is not exercised by any test; the contract→test binding broke',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md',
        line: 191,
        excerpt:
          'Atomic merge corrupts existing config when file is JSONC with comments. Severity: high. Mitigation: mcpConfigWriter.test.ts MUST include a fixture with JSONC comments. Reuse stripJsoncComments helper. Round-trip the parse → merge → serialize chain in the test.',
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        line: 466,
        excerpt:
          "it('does not throw when config has // comments', async () => { ... // happy-path only })",
        note: 'JSONC tests cover comments + valid JSON. The actual high-severity risk (parse throws on malformed JSONC → silent overwrite) is not tested.',
      },
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 121,
        excerpt:
          'function readExistingConfig(configPath) { ... try { return JSON.parse(stripped) } catch { return {} /* start fresh */ } }',
        note: "Implementation swallows parse errors and starts fresh — destroys user's other settings. Security review BLK-1.",
      },
    ],
    observed:
      'The contract said "round-trip the parse → merge → serialize chain in the test" and the implementation tested the happy chain. The actual high-severity risk (parse fails → user data destroyed) was not made into a test fixture. Security review BLK-1 found the bug; this finding identifies the upstream cause: the contract risk-to-test binding was not enforced. The Phase 1.5 linter rule "every risk has a corresponding testBoundary" did not catch it because there IS a JSONC testBoundary — it just doesn't test the actual mitigation.',
    rationale:
      "This is the integration validator's specific value-add over the scoped reviewers. Security found the corruption bug. The architect named it. The test author added the fixture but reduced scope. The integration validator is the only role positioned to detect that the chain broke — none of the three are looking at all four artifacts at once.",
    proposedFix:
      "(1) Fix the implementation per security BLK-1 proposed fix (refuse-to-overwrite on parse failure). (2) Add a test fixture mcpConfigWriter:refuses-to-overwrite-unparseable-config that asserts byte-identical preservation of the original file after a write attempt against malformed JSON. (3) Lift the Phase 1.5 contract linter with a new rule: 'every Risk with severity:high references at least one testBoundaries[i].target by name' so the architect cannot ship a contract whose high-severity risks are linked to nothing testable.",
  },

  {
    id: 'SUG-INT-1',
    title:
      'detection-latency test reads the developer\'s real homedir; non-deterministic across machines',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        line: 250,
        excerpt:
          "it('includes a non-empty mcpServerPath string', () => { const result = detectInstalled({ platformOverride: 'darwin' }); ... })",
        note: 'No homeDir override; existsSync probes ~/.claude, ~/Library/Application Support/Cursor/User/settings.json on the developer\'s real filesystem.',
      },
      {
        file: 'server/services/ideDetection.ts',
        line: 86,
        excerpt: 'const home = options?.homeDir ?? os.homedir()',
      },
    ],
    observed:
      'detectInstalled with no homeDir override falls through to os.homedir() and probes the developer\'s real filesystem. The asserted property (mcpServerPath nonempty) is independent of editor configuration so the assertion is stable, but the test does cause real disk I/O against the developer\'s home directory.',
    rationale:
      "Not destructive (existsSync does not modify), but creates flaky-test risk if a developer's machine has unusual permissions on those paths. The test surfaces nothing the homeDir:tmpDir variant doesn't already cover.",
    proposedFix:
      "Change to detectInstalled({ homeDir: tmpDir, platformOverride: 'darwin' }). Same assertion holds, no developer homedir touched.",
  },

  {
    id: 'SUG-INT-2',
    title:
      'setBetaWelcomeDone legacy alias is documented as compat-shim but is the active wire connection between the beta-info IPC and the welcome gate',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 157,
        excerpt:
          '// Legacy alias — used by the beta info effect and auto-resume dependency below. Kept to avoid touching code outside the scope of this group.',
      },
      {
        file: 'src/App.tsx',
        line: 819,
        excerpt: 'setBetaWelcomeDone(false)',
        note: 'Only call site — modified by Phase A in the same diff (line 813 in the diff vs HEAD).',
      },
    ],
    observed:
      'The alias is not actually a legacy compat shim — the only consumer was specifically modified by Phase A (the change point at line 813 of the diff). Calling it a "legacy alias" hides that this is the active integration with the beta-info IPC.',
    rationale:
      'Comments that describe code as "legacy / preserved as-is" but were modified in the same change set are a smell. They lead future agents to assume they shouldn\'t touch the alias, and the structural defect at BLK-INT-2 is hidden behind the comment.',
    proposedFix:
      'Either rename setBetaWelcomeDone → setBetaInfoLoaded (or just inline the only call site) OR rewrite the comment to honestly describe the wiring.',
  },

  {
    id: 'SUG-INT-3',
    title:
      'Test files collapsed to one file contradicting the contract impact map; explicit two-file split was specified',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 148,
        excerpt:
          "{ file: 'server/services/__tests__/ideDetection.test.ts', changeType: 'CREATE', ... } { file: 'server/services/__tests__/mcpConfigWriter.test.ts', changeType: 'CREATE', ... }",
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        note: '916 lines; contains every domain (ideDetection, mcpConfigWriter, handlers). server/services/__tests__/ does not exist.',
      },
    ],
    observed:
      'Contract specified two files; implementation collapsed to one. Code review S-3 noted this. From canary scope: discoverability is also impacted — future agents looking for tests in server/services/__tests__/ will not find them, even though tests exist.',
    rationale: 'Not a correctness issue — coverage is preserved.',
    proposedFix:
      'Split helloFlintIpc.test.ts at section boundaries (each describe block is already domain-scoped). Mechanical change.',
  },

  {
    id: 'SUG-INT-4',
    title:
      'setup:detect-ides legacy handler bypasses the detection service for Antigravity; subtle two-source-of-truth pattern',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'server/index.ts',
        line: 3229,
        excerpt:
          "const antigravityPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json')",
        note: 'Inline path-probing for Antigravity inside the legacy handler instead of going through detectInstalled().',
      },
    ],
    observed:
      'Phase A delegated 3 of 4 legacy editors to detectInstalled() but left Antigravity with inline path-probing. Consistent with contract Q3 (Antigravity remains in legacy SetupWizard) but means future agents who add Antigravity to the new hello surface must remember to also remove the inline probing in this handler.',
    rationale: 'Documentation, not defect.',
    proposedFix:
      'Add a // TODO comment on line 3229 referencing contract Q3 so the next agent knows the carve-out is deliberate.',
  },
];

export const rubric: RubricItem[] = [
  {
    criterion: 'Phase A diff does not touch electron/main.ts or electron/preload.ts',
    result: 'pass',
    evidence: 'git diff --stat shows zero electron/ modifications',
  },
  {
    criterion:
      'Welcome gate and consent gate ordering is correct (consent → welcome → resume → launch)',
    result: 'pass',
    evidence: 'App.tsx:1014 → 1028 → 1043 → 1055',
  },
  {
    criterion:
      'Both gates use mutually consistent state shape (consent state separate from welcome state)',
    result: 'pass',
  },
  {
    criterion:
      'betaWelcomeDone alias preserves prior persistence semantics',
    result: 'fail',
    evidence: 'one-way ratchet on a two-way alias',
    relatedFindings: ['BLK-INT-2'],
  },
  {
    criterion:
      'ipc-validators.ts and ipc-validators.js mirrors are byte-equivalent for the four hello schemas',
    result: 'pass',
    evidence:
      'matched at lines 467-498 of .js and 608-651 of .ts (today; structural drift risk per WARN-INT-4)',
  },
  {
    criterion:
      'All four hello*Schema named exports are reachable through ipcSchemas[channel]',
    result: 'fail',
    evidence: 'schemas exist as orphan exports outside the registry',
    relatedFindings: ['BLK-INT-3'],
  },
  {
    criterion:
      'Phase A does not introduce a third localStorage key for the welcome state',
    result: 'pass',
  },
  {
    criterion:
      "Phase A's App.tsx changes do not undo the prior consent-dialog timing fix in TelemetryConsentDialog.tsx",
    result: 'pass',
    evidence: 'TelemetryConsentDialog.tsx is unmodified in working tree',
  },
  {
    criterion:
      'Test isolation: each test gets a fresh tmpdir, no leak across describe blocks',
    result: 'pass',
    evidence: 'helloFlintIpc.test.ts:70-83 implements per-test tmpdir + cleanup',
  },
  {
    criterion:
      'Test isolation: window.flintAPI.hello mock state is reset per test',
    result: 'fail',
    evidence:
      'AppMountGate.test.tsx:189-197 uses conditional mock setup that leaks state',
    relatedFindings: ['WARN-INT-5'],
  },
  {
    criterion:
      'Mocking patchwork: tests use a consistent IPC mock pattern across files',
    result: 'fail',
    evidence:
      'HelloFlintWelcome.test.tsx (correct) and AppMountGate.test.tsx (conditional) diverge',
    relatedFindings: ['WARN-INT-5'],
  },
  {
    criterion:
      'Contract risk #2 (JSONC parse failure) has a test fixture that exercises the mitigation',
    result: 'fail',
    evidence:
      'only happy-path tests exist; security BLK-1 is the consequence',
    relatedFindings: ['WARN-INT-6'],
  },
  {
    criterion: 'Contract risk #3 (file-doesn\'t-exist) has a test fixture',
    result: 'pass',
    evidence: 'helloFlintIpc.test.ts:443-461',
  },
  {
    criterion:
      'Implementation files import types from the executable contract',
    result: 'fail',
    evidence:
      'HelloFlintWelcome.tsx imports correctly; ideDetection.ts, mcpConfigWriter.ts, flint-api.d.ts, web-api.ts all redeclare',
    relatedFindings: ['WARN-INT-3'],
  },
  {
    criterion: 'dist-web/ bundles include Phase A source changes',
    result: 'fail',
    evidence: 'bundle was built before source landed',
    relatedFindings: ['BLK-INT-1'],
  },
];

export const scope: ScopeCoverage = {
  reviewed: [
    'src/App.tsx (gates, alreadyConnected effect, beta info effect, consent gate, render returns, sibling modal block)',
    'src/components/ui/HelloFlintWelcome.tsx (storage key, useEffects, handlers)',
    'src/__tests__/App.renderOrder.test.tsx',
    'src/components/__tests__/AppMountGate.test.tsx (mock setup region)',
    'src/components/ui/__tests__/HelloFlintWelcome.test.tsx (mock setup region)',
    'src/adapters/web-api.ts (hello namespace + validateIPC usage grep)',
    'src/adapters/__tests__/web-api.test.ts (full file — confirmed zero hello coverage)',
    'src/types/flint-api.d.ts (hello namespace declaration)',
    'server/index.ts (legacy setup handlers + new hello handlers, lines 3217-3402)',
    'server/services/ideDetection.ts',
    'server/services/mcpConfigWriter.ts',
    'server/__tests__/helloFlintIpc.test.ts',
    'shared/ipc-validators.ts (registry, named exports, hello schemas)',
    'shared/ipc-validators.js (mirror match)',
    'dist-web/assets/ directory listing + grep on the new bundle files',
    'electron/main.ts, electron/preload.ts (greps to confirm Phase A did not touch them)',
    'All three prior reviewer reports (UX, code, security)',
    '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md and .contract.ts',
  ],
  skipped: [
    'Phase B / Phase C work — not built yet, out of scope',
    'Tailwind-token-only static-grep test — code review verified, not re-checked',
    'electron/ legacy setup:* handlers — confirmed unmodified, no further audit',
    'Pre-existing TSC errors in electron/thumbnailGenerator.ts and electron/visualAuditor.ts — explicitly excluded by canary brief',
    "Re-running the full vitest suite — scoped reviewers reported 3600/3600; canary trusts pending fix to WARN-INT-1 since the suite passing does not, in this case, prove what the contract said it should prove",
  ],
};

export const counts: FindingCounts = {
  blocking: 3,
  warning: 6,
  suggestion: 4,
};
