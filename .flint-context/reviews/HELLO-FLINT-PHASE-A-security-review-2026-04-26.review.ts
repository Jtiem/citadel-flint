/**
 * Machine-readable security review — HELLO-FLINT-PHASE-A
 *
 * Sibling of HELLO-FLINT-PHASE-A-security-review-2026-04-26.md.
 * Compiles against shared/review-schema.ts; verdict is derived, not assigned.
 */

import type { ReviewFinding, ReviewReport } from '../../shared/review-schema'
import { countFindings, deriveVerdict } from '../../shared/review-schema'

const findings: ReviewFinding[] = [
  {
    id: 'BLK-1',
    title:
      'Malformed JSONC config is silently overwritten, destroying user editor settings',
    severity: 'blocking',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 121,
        excerpt:
          'try { ... return JSON.parse(stripped) ... } catch { return {} }',
        note: 'readExistingConfig swallows parse errors and returns an empty object',
      },
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 188,
        excerpt: 'await fileTransactionManager.write(configPath, serialized)',
        note: 'Writer proceeds to atomically rename a fresh { mcpServers: { flint: {...} } } over the original — destroying every other setting',
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        line: 625,
        note: 'Property test only covers valid-JSON fixtures; no malformed-source fixture asserts non-overwrite',
      },
    ],
    observed:
      'When the existing editor config file exists but cannot be parsed (trailing comma, unterminated string, encoding issue, or any JSONC pattern stripJsoncComments cannot handle), readExistingConfig() catches the parse error and returns {}. writeMcpConfig() then writes a config containing only the flint entry and atomically renames it over the original file. Every other editor setting (themes, keybindings, MCP servers, language preferences) is destroyed. The verify UI shows preservedEntries: 0 — indistinguishable from "the user had no entries to preserve."',
    rationale:
      'This is the worst-case first-launch failure mode for a closed-beta tester. The contract risk #2 explicitly names this scenario ("What happens on parse failure — do we refuse to write, or silently overwrite?"); the implementation chose silently overwrite without surfacing the choice in either the UI or the test fixtures. There is no undo because the write is atomic. VS Code settings.json and Cursor settings.json routinely contain JSONC syntax including trailing commas that the hand-rolled stripJsoncComments does not handle.',
    proposedFix:
      'Refuse to write when the source file exists but cannot be parsed. Return { failed: [{ editor, reason: "Couldn\'t read your existing config — I won\'t overwrite it. Use the manual snippet path instead." }] } and route the user to the manual fallback. Add a test fixture mcpConfigWriter:refuses to overwrite unparseable config that asserts the original bytes are byte-for-byte unchanged after a write attempt.',
  },
  {
    id: 'BLK-2',
    title:
      'Non-object `mcpServers` value is silently corrupted via TypeScript type-assertion lie',
    severity: 'blocking',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 169,
        excerpt:
          'const existingServers = (config.mcpServers ?? {}) as Record<string, unknown>',
        note: 'TypeScript cast with no runtime type guard',
      },
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 175,
        excerpt: "existingServers['flint'] = { ... }",
        note: 'Mutates existingServers regardless of underlying runtime type',
      },
    ],
    observed:
      'If config.mcpServers is an array ([]), property assignment sets a named property on the array; JSON.stringify drops named props on arrays so the flint entry is invisible in the output. If it is a string, number, or boolean, Object.keys may return character indices or [], and assignment may throw or silently fail in strict mode. Only null is handled correctly because of the ?? operator; false/0/""/[] all slip through.',
    rationale:
      'The cast is a compile-time promise, not a runtime check. Today this is a low-probability path; in a closed beta of designers using diverse editor setups (plugin-managed configs, partial migrations, third-party tooling) it will be exercised eventually. The failure is silent — preservedEntries reports a number, the user sees "Done" in the UI, but the flint MCP entry is not actually present.',
    proposedFix:
      'Replace the cast with a runtime type guard:\n  const rawServers = config.mcpServers\n  const existingServers: Record<string, unknown> =\n    rawServers !== null && typeof rawServers === "object" && !Array.isArray(rawServers)\n      ? { ...(rawServers as Record<string, unknown>) }\n      : {}\nIf rawServers was a non-object truthy value, refuse to overwrite (same path as BLK-1). Add unit fixtures for each malformed type.',
  },
  {
    id: 'WARN-1',
    title:
      '`helloWriteMcpConfigBulkSchema` JSDoc claims constraints the Zod schema does not enforce',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        line: 623,
        excerpt:
          'editors: z.array(z.enum([...])),  // no .nonempty(); mcpServerPath: z.string()  // no .min(1)',
        note: 'Comment above says "non-empty array... 1..3" and "min 1 char" — schema enforces neither',
      },
      {
        file: 'shared/ipc-validators.js',
        line: 478,
        note: 'Compiled mirror has the same drift',
      },
      {
        file: 'server/__tests__/helloFlintIpc.test.ts',
        line: 779,
        note: 'Test "rejects empty editors array" builds its own inline schema with .nonempty() instead of importing the production schema — false confidence',
      },
    ],
    observed:
      'The JSDoc on helloWriteMcpConfigBulkSchema declares "editors: non-empty array of editor names (1..3; handler dedupes). mcpServerPath: absolute path string, min 1 char." The actual Zod definitions are z.array(z.enum(...)) and z.string() — both accept the empty case. The accompanying test file imports zod inline and asserts .nonempty() works, but does not exercise the real exported schema, so the test passes while the production constraint is missing.',
    rationale:
      'When the validator at the process boundary diverges from its own documentation, the document becomes a trap for future readers and the test becomes a false signal. If a future regression caused getMCPServerPath() to return "", the empty-string mcpServerPath mismatch check ("" === "") would silently pass and the bulk writer would proceed with no editors / stale path.',
    proposedFix:
      'export const helloWriteMcpConfigBulkSchema = z.object({\n  editors: z.array(z.enum(["claude-code", "cursor", "vscode"])).min(1).max(3),\n  mcpServerPath: z.string().min(1),\n})\nUpdate shared/ipc-validators.js mirror in the same commit. Update the test to import the production schema instead of constructing an inline copy.',
  },
  {
    id: 'WARN-2',
    title:
      '`/api/ipc` route has no per-request auth; asymmetric with WS upgrade gating',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'server/index.ts',
        line: 4582,
        excerpt: 'app.post("/api/ipc", async (req, res) => { ... })',
        note: 'No header check, no token check, no Origin check before dispatching to handlers',
      },
      {
        file: 'server/index.ts',
        line: 707,
        excerpt: 'app.get("/api/ws-token", (_req, res) => { res.json({ token: wsSessionToken }) })',
        note: 'Token is returned unauthenticated to anyone on localhost',
      },
      {
        file: 'server/index.ts',
        line: 714,
        excerpt: 'if (token !== wsSessionToken) { socket.write("HTTP/1.1 401..."); }',
        note: 'WS upgrade path enforces token — REST IPC does not, creating asymmetry',
      },
      {
        file: 'server/index.ts',
        line: 4938,
        excerpt: 'server.listen(port, "127.0.0.1", ...)',
        note: 'Bound to loopback only — closes the LAN attacker but not local-process attacker',
      },
    ],
    observed:
      'The new hello:write-mcp-config-bulk channel is reachable over HTTP from any localhost-bound process — another browser tab on the same port, a malicious npm postinstall script, or a curl from the user\'s terminal — without authentication. The WebSocket upgrade path enforces a session token, but the REST IPC POST does not. A malicious dev-dependency postinstall script could call hello:detect-editors (to learn the canonical mcpServerPath) and then hello:write-mcp-config-bulk, planting an MCP entry that points at a malicious binary path. Today the canonical-path check makes the attack two-step but trivially scriptable.',
    rationale:
      'Closed-beta-blocking? Not on its own — Phase A explicitly scopes the threat model to "browser tab in the user\'s own session," and 127.0.0.1 binding excludes the LAN attacker. But the asymmetry is the smell: if the WS channel is worth gating, so is the REST IPC. This pattern will recur in later phases that introduce more sensitive write channels (Phase B: token writes, drift overrides, etc.). Cheaper to fix once now than under fire later.',
    proposedFix:
      'Require the wsSessionToken on /api/ipc requests via an X-Flint-Session header. The web-api adapter fetches the token once (already does, for WS) and attaches it to every IPC POST. Reject requests missing/mismatching the header with 401. Approximately 20 lines in server/index.ts and a small change in src/adapters/web-api.ts. Out-of-scope for Phase A as a blocker; queue before Phase B.',
  },
  {
    id: 'WARN-3',
    title:
      '`FLINT_PROJECT_ROOT` baked into the editor config goes stale when the user opens a different project',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 178,
        excerpt: "env: { FLINT_PROJECT_ROOT: projectRoot ?? '' }",
        note: 'Project root snapshotted at write time',
      },
      {
        file: 'server/index.ts',
        line: 3378,
        excerpt:
          'return writeMcpConfigBulk(payload, editorConfigPaths as Map<...>, activeProjectRoot)',
        note: 'activeProjectRoot is mutable — reassigned on project open/create',
      },
      {
        file: 'server/index.ts',
        line: 1222,
        note: 'activeProjectRoot mutation site (one of several)',
      },
    ],
    observed:
      'The Hello flow runs once on first launch and bakes the current activeProjectRoot into the editor MCP config as FLINT_PROJECT_ROOT. When the user opens a different project later, the editor\'s MCP server keeps using the FIRST project the user happened to be in when auto-connect ran. The Flint MCP server may then audit / index / write to a project the user isn\'t actively working on.',
    rationale:
      'Not strictly a security issue — the user opened both projects intentionally — but it is incorrect-state with security-flavored consequences (MCP server may surface tokens or violations from the wrong project, leak file paths in error messages that don\'t match what the user is looking at, etc.). The legacy setup:write-mcp-config handler has the same behavior, so this is not a regression. But Phase A is the right time to decide whether FLINT_PROJECT_ROOT should be set at all — flint-mcp can probably derive it from process.cwd() at the time the editor invokes the server, which would track the editor\'s working directory.',
    proposedFix:
      'Either (a) omit FLINT_PROJECT_ROOT entirely and have flint-mcp derive the project root from cwd / nearest .flint/ ancestor, or (b) document explicitly that re-running the connection flow (Help → "Re-run the connection") is the supported way to update the baked-in path. Probably (a). Out-of-scope for Phase A; flag as a Phase B item.',
  },
  {
    id: 'WARN-4',
    title:
      '`mcpConfigWriter` accepts a relative `mcpServerPath` despite the contract\'s "absolute path" promise',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        line: 625,
        excerpt: 'mcpServerPath: z.string()',
        note: 'No path-shape constraint',
      },
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 177,
        excerpt: 'args: [mcpServerPath]',
        note: 'Whatever the renderer sent (after the canonical-path mismatch check) is written verbatim',
      },
      {
        file: 'server/services/ideDetection.ts',
        line: 60,
        excerpt: "return path.resolve(root, 'flint-mcp', 'dist', 'server.js')",
        note: 'Today the canonical path is always absolute, so the mismatch check closes the loop in practice — but the schema does not enforce the invariant',
      },
    ],
    observed:
      'The bulk handler rejects mismatches between renderer-supplied mcpServerPath and the server-canonical one. The canonical path is absolute today via path.resolve. But the schema does not assert "absolute path" and the writer does not check either. A future refactor that returns a relative path (e.g., during packaging) would silently end up in the editor config, breaking MCP startup.',
    rationale:
      'Defense in depth. The current mismatch check is correct, but it is one regression away from a footgun. An explicit constraint in the schema makes the invariant load-bearing.',
    proposedFix:
      'Add .refine(path.isAbsolute, "mcpServerPath must be absolute") to the Zod schema. Requires importing node:path into shared/ipc-validators.ts (already a Node-only module).',
  },
  {
    id: 'SUG-1',
    title:
      'ManualPanel renders the user\'s home directory path inside a code block (screenshot leak surface)',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 648,
        excerpt: '<code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">{mcpServerPath || \'not detected — run flint-mcp separately\'}</code>',
        note: 'mcpServerPath includes /Users/<username>/...',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 462,
        note: 'EditorDetectionRow renders only labels (no path) — good',
      },
    ],
    observed:
      'The connect-confirm panel hides paths (only labels are shown). The manual panel intentionally exposes the resolved server path so the user can copy the snippet. React string-children auto-escape, so XSS via the path is not exploitable. The path includes /Users/<username>/... — a screenshot of the manual panel posted to a support channel leaks the username.',
    rationale:
      'Low-impact privacy nit. Path is already on the user\'s machine in a file they can read; rendering in their own UI does not create new exposure. Concern is screenshot-driven leakage in support flows. Phase C introduces telemetry — that is when to revisit.',
    proposedFix:
      'Optionally render ~/path/to/flint-mcp/dist/server.js using ~ for os.homedir() and copy the absolute version to the clipboard. Defer to Phase C.',
  },
  {
    id: 'SUG-2',
    title:
      '`alreadyConnected` race: response can resolve and call onComplete() while a write is mid-flight',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 130,
        excerpt: 'cancelled flag only blocks onComplete after unmount, not after user advanced past welcome',
      },
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 175,
        note: 'handleLetsGo does not cancel or await the in-flight alreadyConnected() call',
      },
      {
        file: '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
        line: 246,
        excerpt:
          "edgeCases: ['alreadyConnected resolves after user clicks Let\\'s go (must not double-trigger)'",
        note: 'Contract testBoundary names the case; implementation does not guard it',
      },
    ],
    observed:
      'On a slow filesystem (encrypted homedir, fuse mount, NFS), alreadyConnected() may take longer than the user takes to click "Let\'s go." If the user clicks first, both code paths run: writer starts, then alreadyConnected() resolves connected:true and calls onComplete(). Component unmounts mid-write. Writer\'s promise resolves to nobody. The atomic rename either completes or doesn\'t — the user\'s editor config state is non-deterministic from their POV.',
    rationale:
      'Low-likelihood, low-impact (writer is idempotent, atomic write is atomic). Worth a single guard so the contract test boundary actually passes the edge case it names.',
    proposedFix:
      'Track a userAdvanced ref that flips to true on handleLetsGo. If alreadyConnected resolves after userAdvanced.current === true, ignore the result.',
  },
  {
    id: 'SUG-3',
    title:
      'ManualPanel snippet omits FLINT_PROJECT_ROOT, diverging from the auto-write path',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/components/ui/HelloFlintWelcome.tsx',
        line: 69,
        excerpt:
          "const config = { mcpServers: { flint: { command: 'node', args: [mcpServerPath] } } }",
        note: 'No env field',
      },
      {
        file: 'server/services/mcpConfigWriter.ts',
        line: 175,
        excerpt: "existingServers['flint'] = { command: 'node', args: [mcpServerPath], env: { FLINT_PROJECT_ROOT: projectRoot ?? '' } }",
        note: 'Auto-write includes env',
      },
    ],
    observed:
      'A user who picks "I\'ll do this manually" gets a snippet without FLINT_PROJECT_ROOT. A user who picks the auto path gets the env baked in. The MCP server then has to fall back to deriving the project root from cwd in the manual case but uses the baked value in the auto case — two slightly different configs ship from the same first-launch screen.',
    rationale:
      'Not a security issue — manual path is a user choice — but it is an inconsistency. If WARN-3 is fixed by removing FLINT_PROJECT_ROOT from the auto path entirely, this resolves itself.',
    proposedFix:
      'Either remove FLINT_PROJECT_ROOT from the auto-write path (preferred — see WARN-3) or include it in buildManualSnippet. Don\'t let the two paths diverge.',
  },
]

const counts = countFindings(findings)
const verdict = deriveVerdict(findings, 'security')

export const REPORT: ReviewReport = {
  meta: {
    phase: 'HELLO-FLINT-A',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-26',
    round: 1,
    scope: [
      'server/services/ideDetection.ts',
      'server/services/mcpConfigWriter.ts',
      'server/services/fileTransactionManager.ts',
      'server/__tests__/helloFlintIpc.test.ts',
      'server/index.ts:hello:* handlers (3329-3401)',
      'server/index.ts:/api/ipc + WS auth (4582-4621, 700-730)',
      'shared/ipc-validators.ts (594-651)',
      'shared/ipc-validators.js mirror (466-498)',
      'src/adapters/web-api.ts (642-689)',
      'src/types/flint-api.d.ts (2117-2171)',
      'src/components/ui/HelloFlintWelcome.tsx',
    ],
    markdownFile: 'HELLO-FLINT-PHASE-A-security-review-2026-04-26.md',
  },
  rubric: [
    {
      criterion:
        'helloWriteMcpConfigBulkSchema enforces editors.length >= 1 and mcpServerPath.length >= 1',
      result: 'fail',
      evidence:
        'shared/ipc-validators.ts:623 — schema is z.array(...) and z.string() with no min/nonempty constraints, contradicting the JSDoc above',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion:
        'Renderer-supplied config paths are not used; bulk handler derives paths from detectInstalled() server-side',
      result: 'pass',
    },
    {
      criterion:
        'Renderer-supplied mcpServerPath is rejected unless it equals server-canonical path',
      result: 'pass',
    },
    {
      criterion:
        'mcpConfigWriter.ts contains zero direct fs.writeFile/writeFileSync calls (Commandment 14)',
      result: 'pass',
    },
    {
      criterion:
        'All disk writes route through FileTransactionManager (atomic .tmp -> rename)',
      result: 'pass',
    },
    {
      criterion:
        'Existing valid JSON config preserves all entries byte-for-byte',
      result: 'pass',
    },
    {
      criterion:
        'Existing JSONC config (with comments) parses without throwing',
      result: 'pass',
    },
    {
      criterion:
        'Existing INVALID JSON config is NOT silently overwritten with a fresh flint-only config',
      result: 'fail',
      evidence:
        'server/services/mcpConfigWriter.ts:121-134 — bare catch returns {} and writer proceeds to atomic-rename a fresh config over the original',
      relatedFindings: ['BLK-1'],
    },
    {
      criterion:
        'Existing mcpServers of non-object type is NOT silently corrupted via type-assertion lie',
      result: 'fail',
      evidence:
        'server/services/mcpConfigWriter.ts:169 — `(config.mcpServers ?? {}) as Record<string, unknown>` is a compile-time cast with no runtime guard against arrays, strings, numbers, or booleans',
      relatedFindings: ['BLK-2'],
    },
    {
      criterion:
        'Detection paths are constants based on os.homedir() and known editor locations (no user-controlled path interpolation)',
      result: 'pass',
    },
    {
      criterion:
        'Detection rejects symlink-traversal beyond the home directory',
      result: 'n/a',
      evidence:
        'existsSync does not follow symlinks for stat on macOS for the probe paths used; only known editor locations are queried',
    },
    {
      criterion:
        'Manual snippet rendered through React text content (auto-escaped, no dangerouslySetInnerHTML)',
      result: 'pass',
    },
    {
      criterion: '/api/ipc enforces auth on requests',
      result: 'fail',
      evidence:
        'server/index.ts:4582 — POST /api/ipc has no header/token/Origin check before dispatching to handlers; asymmetric with WS upgrade auth at line 714',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion:
        '/api/ipc is bound to 127.0.0.1 only (LAN attacker excluded)',
      result: 'pass',
    },
    {
      criterion: 'WebSocket upgrade enforces session token',
      result: 'pass',
    },
    {
      criterion:
        'hello:write-mcp-config-bulk Zod parse runs at handler entry, rejects on parse failure',
      result: 'pass',
    },
    {
      criterion:
        'hello:detect-editors and hello:already-connected accept void payload (no payload Zod parse needed)',
      result: 'pass',
    },
    {
      criterion:
        'Error messages returned to renderer never include raw fs error stack',
      result: 'pass',
    },
    {
      criterion:
        'JSON.stringify cannot smuggle attacker-controlled JSON (merged entry built from typed fields, not user-controlled strings)',
      result: 'pass',
    },
  ],
  findings,
  counts,
  scopeCoverage: {
    reviewed: [
      'server/services/ideDetection.ts',
      'server/services/mcpConfigWriter.ts',
      'server/services/fileTransactionManager.ts',
      'server/__tests__/helloFlintIpc.test.ts',
      'server/index.ts:hello:* handlers (3329-3401)',
      'server/index.ts:/api/ipc route + WS auth gate',
      'shared/ipc-validators.ts (594-651)',
      'shared/ipc-validators.js (466-498)',
      'src/adapters/web-api.ts (642-689)',
      'src/types/flint-api.d.ts (2117-2171)',
      'src/components/ui/HelloFlintWelcome.tsx',
      '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md',
      '.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts',
    ],
    skipped: [
      'electron/preload.ts — Phase A is web-transport-first by design',
      'server/index.ts:setup:* legacy handlers (3220-3327) — pre-existing, out of scope',
      'Phase B work — out of scope per review brief',
    ],
  },
  verdict,
}
