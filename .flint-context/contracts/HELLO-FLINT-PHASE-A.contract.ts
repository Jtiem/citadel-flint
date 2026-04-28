/**
 * Executable Contract — HELLO-FLINT-PHASE-A
 *
 * Phase A of the "Hello, Flint" guided first-screen experience: the welcome
 * surface that replaces BetaWelcome.tsx, plus the smart IDE auto-connect that
 * folds the prior multi-step SetupWizard into a single click.
 *
 * Phase B (the guided walkthrough) and Phase C (polish + persistence) are
 * out of scope and are explicitly enumerated in `CONTRACT.nonGoals`.
 *
 * Source spec: docs/strategy/FEATURE-SPEC-GUIDED-FIRST-SCREEN.md
 *
 * Phase 2 agents: import the type aliases below directly. Do not redeclare
 * them in implementation files — the contract is the source of truth.
 */

import type { FlintContract } from '../../shared/contract-schema';

// ─── Domain Types (Phase 2 imports these) ───────────────────────────

/** The three editors Phase A targets. Antigravity is intentionally excluded. */
export type EditorName = 'claude-code' | 'cursor' | 'vscode';

/** A single editor detection result. */
export interface DetectedEditor {
  editor: EditorName;
  /** True iff the editor's primary settings file exists on disk. */
  present: boolean;
  /**
   * Resolved absolute path to the editor's MCP config file.
   * `null` when the platform is not supported (linux/win32 in closed beta)
   * or when path resolution fails.
   */
  configPath: string | null;
}

/** Response from `hello:detect-editors`. */
export interface DetectEditorsResponse {
  /** Always 3 entries in fixed order: claude-code, cursor, vscode. */
  editors: DetectedEditor[];
  /** Absolute path to flint-mcp/dist/server.js (dev or packaged). */
  mcpServerPath: string;
  /** Detected platform; non-darwin platforms return present:false for all editors. */
  platform: 'darwin' | 'linux' | 'win32';
}

/** Payload for `hello:write-mcp-config-bulk`. */
export interface WriteMcpConfigBulkPayload {
  /** 1..3 editor names. Handler dedupes. */
  editors: EditorName[];
  /** Must equal the `mcpServerPath` returned by `hello:detect-editors`. */
  mcpServerPath: string;
}

/** Response from `hello:write-mcp-config-bulk`. */
export interface WriteMcpConfigBulkResponse {
  written: Array<{
    editor: EditorName;
    configPath: string;
    /** Number of MCP entries preserved (excluding the new flint entry). */
    preservedEntries: number;
  }>;
  failed: Array<{
    editor: EditorName;
    /** Human-readable reason. Never includes raw fs error stack. */
    reason: string;
  }>;
}

/** Response from `hello:already-connected`. */
export interface AlreadyConnectedResponse {
  /** True if at least one editor already has a `flint` MCP entry. */
  connected: boolean;
  /** Editors where flint was found. Empty array if none. */
  editors: EditorName[];
}

/** Component props for the new welcome surface. */
export interface HelloFlintWelcomeProps {
  /** Called when the user dismisses the screen via any path (skip, success, manual done). */
  onComplete: () => void;
  /** Beta build identifier — shown in footer. */
  buildId?: string;
  /** Days remaining on a self-expiring beta build — shown in footer. */
  daysRemaining?: number | null;
}

// ─── Machine-readable contract ──────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'HELLO-FLINT-PHASE-A',
    phase: 'HELLO-FLINT-A',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-26',
    audience: 'designer',
  },

  impact: [
    {
      file: 'src/components/ui/HelloFlintWelcome.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary:
        'New single-path welcome surface — welcome state, connect-confirmation, verify, help, manual-snippet, error states. Replaces BetaWelcome.tsx as the first-launch component.',
    },
    {
      file: 'src/components/ui/__tests__/HelloFlintWelcome.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Component tests scaffolded from testBoundaries; covers state transitions, a11y, IPC mocks.',
    },
    {
      file: 'src/App.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary:
        'Replace <BetaWelcome> render gate with <HelloFlintWelcome>; add already-connected fast path that skips the screen entirely; keep telemetry-consent gate ordering.',
    },
    {
      file: 'src/components/ui/BetaWelcome.tsx',
      changeType: 'DELETE',
      owner: 'flint-design-engineer',
      summary: 'Remove legacy welcome surface — replaced by HelloFlintWelcome.',
    },
    {
      file: 'src/components/ui/__tests__/BetaWelcome.test.tsx',
      changeType: 'DELETE',
      owner: 'flint-test-writer',
      summary: 'Remove legacy welcome tests.',
    },
    {
      file: 'server/services/ideDetection.ts',
      changeType: 'CREATE',
      owner: 'flint-electron-ipc',
      summary:
        'IDE detection service — existsSync probes for Claude Code, Cursor, VS Code on darwin. Linux/win32 stub returns present:false. Pure function, no IPC.',
    },
    {
      file: 'server/services/mcpConfigWriter.ts',
      changeType: 'CREATE',
      owner: 'flint-electron-ipc',
      summary:
        'Per-editor adapter that reads existing config, merges flint entry preserving every other entry, writes atomically via fileTransactionManager (Commandment 14). Handles JSONC comments via stripJsoncComments. Returns preservedEntries count.',
    },
    {
      file: 'server/services/__tests__/ideDetection.test.ts',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Detection unit tests: present, absent, alternate path (Claude mcp.json vs settings.json), non-darwin stub.',
    },
    {
      file: 'server/services/__tests__/mcpConfigWriter.test.ts',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary:
        'Merge fixtures: empty file, file with multiple existing MCP entries, non-existent file, JSONC comment preservation, partial-failure bulk path.',
    },
    {
      file: 'server/index.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary:
        'Add 3 handlers: hello:detect-editors, hello:write-mcp-config-bulk, hello:already-connected. Refactor existing setup:detect-ides to delegate to ideDetection.ts so the two paths do not fork.',
    },
    {
      file: 'src/adapters/web-api.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Add `hello` namespace on window.flintAPI; route through validateIPC with the new Zod schemas.',
    },
    {
      file: 'src/types/flint-api.d.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Declare the `hello` namespace shape on FlintAPI.',
    },
    {
      file: 'shared/ipc-validators.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary:
        'Add helloDetectEditorsSchema, helloWriteMcpConfigBulkSchema, helloAlreadyConnectedSchema. Each export is named exactly as referenced from the IPC channel `validator` field.',
    },
  ],

  ipc: [
    {
      channel: 'hello:detect-editors',
      direction: 'renderer→main',
      payloadType: 'undefined',
      returnType: 'DetectEditorsResponse',
      handler: 'server/index.ts',
      validator: 'helloDetectEditorsSchema',
    },
    {
      channel: 'hello:write-mcp-config-bulk',
      direction: 'renderer→main',
      payloadType: 'WriteMcpConfigBulkPayload',
      returnType: 'WriteMcpConfigBulkResponse',
      handler: 'server/index.ts',
      validator: 'helloWriteMcpConfigBulkSchema',
    },
    {
      channel: 'hello:already-connected',
      direction: 'renderer→main',
      payloadType: 'undefined',
      returnType: 'AlreadyConnectedResponse',
      handler: 'server/index.ts',
      validator: 'helloAlreadyConnectedSchema',
    },
  ],

  stores: [],

  components: [
    {
      name: 'HelloFlintWelcome',
      file: 'src/components/ui/HelloFlintWelcome.tsx',
      propsType: 'HelloFlintWelcomeProps',
      consumesStores: [],
      emitsIPC: ['hello:detect-editors', 'hello:write-mcp-config-bulk', 'hello:already-connected'],
    },
  ],

  commandments: [2, 4, 5, 12, 14],

  testBoundaries: [
    // ── Component: HelloFlintWelcome ──────────────────────────────
    {
      target: 'HelloFlintWelcome:renders welcome state on mount',
      kind: 'component',
      behavior: 'Initial mount displays the welcome heading, primary CTA, and skip link.',
      assertion: 'heading "Welcome to Flint" present, "Let\'s go →" button present',
      edgeCases: ['no buildId', 'buildId + daysRemaining', 'daysRemaining null'],
      given: 'HelloFlintWelcome is rendered with onComplete=vi.fn() and no localStorage flag',
      when: 'the component mounts',
      then: 'renders a heading containing "Welcome to Flint", a button labeled "Let\'s go", and a "Skip" text link',
    },
    {
      target: 'HelloFlintWelcome:already-connected fast path',
      kind: 'component',
      behavior: 'When alreadyConnected resolves connected:true before user interacts, onComplete is called and the screen never advances.',
      assertion: 'onComplete called once, no detectEditors call observed',
      edgeCases: ['alreadyConnected resolves after user clicks Let\'s go (must not double-trigger)', 'alreadyConnected rejects'],
      given: 'window.flintAPI.hello.alreadyConnected mocked to resolve { connected: true, editors: ["cursor"] }',
      when: 'HelloFlintWelcome mounts and the alreadyConnected promise resolves',
      then: 'calls onComplete exactly once and does not invoke detectEditors',
    },
    {
      target: 'HelloFlintWelcome:Let\'s go advances to detecting then connect-confirm',
      kind: 'component',
      behavior: 'Clicking "Let\'s go" fires detectEditors and renders the connect-confirmation panel after it resolves.',
      assertion: 'detectEditors called once; "Found Cursor" appears in DOM',
      edgeCases: ['no editors present', 'all 3 present', 'partial detection'],
      given: 'detectEditors mocked to resolve { editors: [{cursor, present:true, configPath:"/home/user/Library/.../Cursor"}, ...], mcpServerPath:"/abs/path", platform:"darwin" }',
      when: 'user clicks the "Let\'s go" button',
      then: 'calls detectEditors once and renders a list item containing "Cursor" with a present indicator',
    },
    {
      target: 'HelloFlintWelcome:undetected editor button is disabled',
      kind: 'component',
      behavior: 'Editors with present:false render disabled; "I\'ll do this manually" remains clickable.',
      assertion: 'button[name="VS Code"] is disabled when present:false',
      edgeCases: ['all undetected'],
      given: 'detectEditors resolves { editors:[{vscode, present:false, configPath:null}, ...] }',
      when: 'the connect-confirm state renders',
      then: 'renders the VS Code button with the disabled attribute set',
    },
    {
      target: 'HelloFlintWelcome:write succeeds and shows verify panel',
      kind: 'component',
      behavior: 'Selecting Cursor calls writeMcpConfigBulk and transitions to verify state on success.',
      assertion: 'writeMcpConfigBulk called with editors:["cursor"]; "I see the green dot" button rendered',
      edgeCases: ['Both selection writes 2 editors', 'rapid double-click does not double-fire'],
      given: 'writeMcpConfigBulk mocked to resolve { written:[{editor:"cursor", configPath:"/p", preservedEntries:2}], failed:[] }',
      when: 'user clicks the Cursor button in connect-confirm state',
      then: 'calls writeMcpConfigBulk with payload { editors:["cursor"], mcpServerPath } and renders the "I see the green dot" button',
    },
    {
      target: 'HelloFlintWelcome:partial failure shows honest result',
      kind: 'component',
      behavior: 'Bulk write with mixed results renders both success and failure lines.',
      assertion: 'DOM contains "Wrote to Cursor" and "Couldn\'t write to VS Code"',
      edgeCases: ['all failed transitions to error state with manual fallback'],
      given: 'writeMcpConfigBulk resolves { written:[{cursor}], failed:[{vscode, reason:"file locked"}] }',
      when: 'user picks "Both"',
      then: 'renders both a success message mentioning Cursor and a failure message mentioning VS Code with the reason "file locked"',
    },
    {
      target: 'HelloFlintWelcome:manual fallback shows snippet',
      kind: 'component',
      behavior: 'Clicking "I\'ll do this manually" renders the JSON snippet inline with the resolved mcpServerPath.',
      assertion: 'pre.code element contains "mcpServers" and the mcpServerPath value',
      edgeCases: ['no editors present at all'],
      given: 'detectEditors resolved with mcpServerPath:"/abs/flint-mcp/dist/server.js"',
      when: 'user clicks "I\'ll do this manually"',
      then: 'renders a code block containing both the literal "mcpServers" key and the path "/abs/flint-mcp/dist/server.js"',
    },
    {
      target: 'HelloFlintWelcome:skip text link calls onComplete',
      kind: 'component',
      behavior: 'Skip link sets the localStorage flag and calls onComplete; no IPC fired.',
      assertion: 'onComplete called once; no IPC mock invoked',
      edgeCases: ['skip during writing state must be blocked'],
      given: 'HelloFlintWelcome rendered in welcome state with onComplete=vi.fn()',
      when: 'user clicks the Skip text link',
      then: 'calls onComplete exactly once and does not call any window.flintAPI.hello method',
    },
    {
      target: 'HelloFlintWelcome:token-only styling',
      kind: 'component',
      behavior: 'The component uses only design-token-mapped Tailwind utilities (zinc/indigo/emerald/red ladder + standard spacing/typography scale). No raw hex, no off-ladder utility values.',
      assertion: 'audit_ui_component on HelloFlintWelcome.tsx returns zero Mithril violations; static grep for hex literals returns 0 matches in the source',
      edgeCases: ['gradient stops use existing token colors', 'border colors come from the token palette'],
      given: 'HelloFlintWelcome.tsx exists and the design-tokens.json palette is the project default',
      when: 'audit_ui_component is run against the component source',
      then: 'returns zero Mithril token-drift violations and zero hardcoded color findings',
    },
    {
      target: 'HelloFlintWelcome:escape blocked during writing',
      kind: 'component',
      behavior: 'Escape keydown is suppressed while writeMcpConfigBulk is in flight.',
      assertion: 'onComplete not called when Escape pressed during writing',
      edgeCases: ['escape allowed in welcome/connect-confirm/verify states'],
      given: 'writeMcpConfigBulk pending (unresolved promise) after user clicked Cursor',
      when: 'user presses the Escape key',
      then: 'blocks the escape handler so onComplete is not called and the writing state stays visible',
    },

    // ── Service: ideDetection ─────────────────────────────────────
    {
      target: 'ideDetection:detects Cursor when settings.json exists',
      kind: 'service',
      behavior: 'Returns present:true with the Cursor settings path on darwin.',
      assertion: 'returns { editor:"cursor", present:true, configPath:"~/Library/Application Support/Cursor/User/settings.json" }',
      edgeCases: ['file exists but is empty', 'file exists but is unreadable'],
      given: 'a tmp HOME directory with Library/Application Support/Cursor/User/settings.json present',
      when: 'detectEditors() is invoked with platform="darwin" and that HOME',
      then: 'returns an editors array whose cursor entry has present:true and configPath ending in /Cursor/User/settings.json',
    },
    {
      target: 'ideDetection:Claude Code prefers mcp.json over settings.json',
      kind: 'service',
      behavior: 'When ~/.claude/mcp.json exists, it is the configPath; settings.json is only the fallback.',
      assertion: 'configPath ends with /.claude/mcp.json',
      edgeCases: ['only settings.json present', 'neither present'],
      given: 'tmp HOME with both ~/.claude/settings.json and ~/.claude/mcp.json present',
      when: 'detectEditors() runs against that HOME',
      then: 'returns the claude-code entry with configPath ending in /.claude/mcp.json and present:true',
    },
    {
      target: 'ideDetection:non-darwin returns stub',
      kind: 'service',
      behavior: 'On linux or win32, all 3 editors return present:false and configPath:null.',
      assertion: 'every editors[i].present === false; every configPath === null',
      edgeCases: ['linux', 'win32'],
      given: 'process.platform is forced to "linux"',
      when: 'detectEditors() runs',
      then: 'returns editors[*].present === false and editors[*].configPath === null for every entry',
    },

    // ── Service: mcpConfigWriter ──────────────────────────────────
    {
      target: 'mcpConfigWriter:preserves existing MCP entries',
      kind: 'service',
      behavior: 'Merging flint into a config with multiple existing servers preserves every other entry byte-for-byte.',
      assertion: 'output config contains all original mcpServers keys plus flint',
      edgeCases: ['existing flint entry is overwritten with new path', 'config root has unrelated top-level keys'],
      given: 'a tmp config file containing mcpServers:{ existing-a:{...}, existing-b:{...} } with no flint entry',
      when: 'writeMcpConfig("cursor", configPath, mcpServerPath) is called',
      then: 'writes a config whose mcpServers contains existing-a, existing-b, and flint, and returns preservedEntries === 2',
    },
    {
      target: 'mcpConfigWriter:creates file when absent',
      kind: 'service',
      behavior: 'When the config file does not exist, the writer creates parent dir and writes a fresh config.',
      assertion: 'output file exists; mcpServers === { flint: {...} }; preservedEntries === 0',
      edgeCases: ['parent directory also missing'],
      given: 'configPath points to a non-existent file inside a non-existent parent directory',
      when: 'writeMcpConfig is called',
      then: 'writes the file with mcpServers containing only flint and returns preservedEntries === 0',
    },
    {
      target: 'mcpConfigWriter:strips JSONC comments before parse',
      kind: 'service',
      behavior: 'Config files with // and /* */ comments parse without throwing; comments are not preserved in output (acceptable).',
      assertion: 'parse does not throw; flint entry written; existing keys preserved',
      edgeCases: ['comment inside string value (must not strip)'],
      given: 'a Cursor settings.json file with // and /* */ comments and an existing mcpServers entry',
      when: 'writeMcpConfig is called',
      then: 'writes a JSON file containing both the original mcpServers entry and the new flint entry without throwing on the comments',
    },
    {
      target: 'mcpConfigWriter:routes through fileTransactionManager',
      kind: 'service',
      behavior: 'Disk write goes through fileTransactionManager.write — never direct fs.writeFileSync.',
      assertion: 'fileTransactionManager.write spy called with (configPath, expectedContent)',
      edgeCases: ['concurrent writes for two editors are serialised per-path'],
      given: 'fileTransactionManager.write is replaced with a vi.fn() spy',
      when: 'writeMcpConfig runs to completion',
      then: 'calls the spy with arguments (configPath, contentString) at least once and never calls fs.writeFileSync directly',
    },

    // ── IPC handlers ──────────────────────────────────────────────
    {
      target: 'hello:detect-editors handler',
      kind: 'ipc-handler',
      behavior: 'Returns DetectEditorsResponse delegating to ideDetection service.',
      assertion: 'response shape matches DetectEditorsResponse exactly',
      edgeCases: ['service throws — handler returns synthetic platform-stub response, not 500'],
      given: 'the WebSocket IPC server is running with hello:detect-editors registered',
      when: 'a renderer invokes hello:detect-editors with no payload',
      then: 'returns an object whose shape matches DetectEditorsResponse with editors.length === 3',
    },
    {
      target: 'hello:write-mcp-config-bulk handler',
      kind: 'ipc-handler',
      behavior: 'Validates payload via Zod, dedupes editors, calls mcpConfigWriter per editor, returns written/failed split.',
      assertion: 'response shape matches WriteMcpConfigBulkResponse',
      edgeCases: ['empty editors array rejected by Zod', 'mcpServerPath mismatch rejected', 'one editor succeeds + one fails'],
      given: 'handler registered with mcpConfigWriter spy that resolves for cursor and rejects for vscode',
      when: 'renderer invokes the handler with payload { editors:["cursor","vscode"], mcpServerPath:resolved }',
      then: 'returns { written:[cursor entry], failed:[vscode entry with reason] }',
    },
    {
      target: 'hello:already-connected handler',
      kind: 'ipc-handler',
      behavior: 'Reads each editor\'s config (best effort) and reports whether a flint entry exists.',
      assertion: 'response shape matches AlreadyConnectedResponse',
      edgeCases: ['no editors present (connected:false, editors:[])', 'one editor has flint, others fail to read'],
      given: 'tmp HOME where ~/.cursor/mcp.json contains mcpServers.flint',
      when: 'renderer invokes hello:already-connected',
      then: 'returns { connected:true, editors:["cursor"] }',
    },
  ],

  invariants: [
    {
      name: 'detection-latency-p95',
      measurable: 'p95 wall-clock of hello:detect-editors handler',
      threshold: '< 50ms at N=100 (cold cache)',
      measuredBy: 'vitest bench in server/services/__tests__/ideDetection.test.ts',
    },
    {
      name: 'config-merge-preservation',
      measurable: 'Number of MCP entries lost during merge across 100 randomized fixtures',
      threshold: '= 0 lost entries across 100 runs',
      measuredBy: 'property test in server/services/__tests__/mcpConfigWriter.test.ts',
    },
    {
      name: 'atomic-write-routing',
      measurable: 'Count of direct fs.writeFileSync calls in server/services/mcpConfigWriter.ts',
      threshold: '= 0 occurrences in source',
      measuredBy: 'grep assertion in mcpConfigWriter.test.ts plus integration validator scan',
    },
    {
      name: 'already-connected-fast-path',
      measurable: 'Time from HelloFlintWelcome mount to onComplete when alreadyConnected resolves connected:true',
      threshold: '< 250ms at N=20',
      measuredBy: 'vitest @testing-library/react timing assertion in HelloFlintWelcome.test.tsx',
    },
  ],

  risks: [
    {
      risk: 'Cross-platform editor paths (linux/win32) not implemented in closed beta',
      severity: 'medium',
      mitigation:
        'Detection service returns present:false / configPath:null on non-darwin. Manual-snippet fallback path remains usable. Documented in nonGoals.',
    },
    {
      risk: 'Atomic merge corrupts existing JSONC config (comments cause parse to throw)',
      severity: 'high',
      commandment: 14,
      mitigation:
        'mcpConfigWriter must call stripJsoncComments before JSON.parse. Test fixture with mixed // and /* */ comments is required (see testBoundaries).',
    },
    {
      risk: 'Atomic merge loses entries when target file does not exist yet',
      severity: 'high',
      commandment: 14,
      mitigation:
        'Required test fixture: configPath points to non-existent file inside non-existent parent dir; writer creates dir, writes fresh config, returns preservedEntries:0.',
    },
    {
      risk: 'User clicks "I see the green dot" before the editor MCP handshake actually completes (false-positive verification)',
      severity: 'medium',
      mitigation:
        'Acceptable for closed beta per spec — user-confirmed verification is the chosen scope. The Help panel\'s "Re-run connection" instruction provides recovery. Real handshake observation is Phase B+.',
    },
    {
      risk: 'Existing SetupWizard render gate in App.tsx collides with new welcome',
      severity: 'medium',
      mitigation:
        'App.tsx integration removes the BetaWelcome render path and inserts HelloFlintWelcome at the same gate position (after telemetry consent, before LaunchScreen). SetupWizard remains addressable only via the OS menu "Reset State" path.',
    },
    {
      risk: 'Bulk writes return partial success (one editor written, another failed) — UI must surface this honestly',
      severity: 'medium',
      commandment: 14,
      mitigation:
        'Handler always returns both `written` and `failed` arrays. Component renders both in verify state. testBoundaries:HelloFlintWelcome:partial-failure enforces this.',
    },
    {
      risk: 'Renderer sends a stale or mismatched mcpServerPath to bulk writer (path-injection vector)',
      severity: 'low',
      mitigation:
        'Bulk handler recomputes the canonical mcpServerPath server-side and rejects payloads where the renderer-supplied path does not match.',
    },
    {
      risk: 'fileTransactionManager currently lives in electron/, not server/ — accessing it from the web server requires a path decision',
      severity: 'medium',
      commandment: 14,
      mitigation:
        'Phase 2 implementer (flint-electron-ipc) chooses between extracting FileTransactionManager to shared/ or creating a sibling at server/services/fileTransactionManager.ts with identical semantics. Integration validator confirms whichever choice was made satisfies Commandment 14.',
    },
    {
      risk: 'Antigravity users on closed beta hit the new welcome and see no Antigravity option',
      severity: 'low',
      mitigation:
        'Phase A intentionally scopes to the 3 editors named in the spec. The legacy SetupWizard reachable via menu "Reset State" still supports Antigravity. Phase C revisits the editor list.',
    },
  ],

  parallelismGroups: {
    A1: ['flint-design-engineer', 'flint-electron-ipc', 'flint-test-writer'],
    A2: ['flint-electron-ipc', 'flint-test-writer'],
    A3: ['flint-design-engineer', 'flint-test-writer'],
  },

  nonGoals: [
    'The four-step guided walkthrough — Phase B',
    'Custom-red drift detection panel and three-choice UI — Phase B',
    'The "add #DC2626 to my tokens as red-danger" affordance — Phase B',
    'Real-time token-highlight animation in the canvas — Phase B',
    'Click-to-source affordance polish — Phase B',
    'Progress save/resume across app restarts — Phase C',
    '"Stuck for 30s" inline help — Phase C',
    'LaunchScreen "Sample Projects" section — Phase C',
    'File menu "Open Sample" item — Phase C',
    'Real-time MCP-handshake observation to auto-confirm the green dot — future',
    'Linux and Windows IDE path tables — closed beta is macOS-only; non-darwin returns present:false',
    'Telemetry events for the welcome flow — Phase C',
    'Localization — English-only',
    'Antigravity support in the new welcome — legacy SetupWizard retains it for now',
    'Deletion of the legacy SetupWizard.tsx and setup:* IPC handlers — kept for the menu Reset State path',
  ],
};
