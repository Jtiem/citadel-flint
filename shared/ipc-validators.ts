/**
 * IPC Runtime Validation — Zod schemas for the Electron ↔ Renderer boundary.
 *
 * Design by Contract (Meyer) adapted for Electron IPC:
 * - Preconditions:  Renderer validates payload BEFORE sending
 * - Postconditions: Renderer validates response AFTER receiving
 * - Invariants:     Main process validates incoming payload shape
 *
 * This catches at runtime what TSC catches at compile time — because
 * IPC serialization can silently drop methods, class instances, and
 * undefined values. The preload bridge is the highest-risk seam in
 * the entire architecture.
 *
 * Usage in preload.ts:
 *   import { ipcSchemas, validateIPC } from '../shared/ipc-validators'
 *
 *   tokens: {
 *     create: (token: unknown): Promise<{ id: number }> =>
 *       validateIPC('tokens:create', token, ipcSchemas['tokens:create'].payload)
 *         .then(valid => ipcRenderer.invoke('tokens:create', valid))
 *         .then(res => ipcSchemas['tokens:create'].response.parse(res)),
 *   }
 *
 * Usage in main.ts:
 *   ipcMain.handle('tokens:create', async (_event, raw) => {
 *     const token = ipcSchemas['tokens:create'].payload.parse(raw);
 *     // ... safe to use `token` with full type narrowing
 *   });
 */

import { z } from 'zod';

// ─── Schema Definitions ─────────────────────────────────────────────
//
// Add schemas here as new IPC channels are created.
// Each entry defines payload (what the renderer sends) and
// response (what main returns). Both are validated at runtime.

export const ipcSchemas = {

  // ── Token CRUD ──────────────────────────────────────────────────

  'tokens:create': {
    payload: z.object({
      token_path: z.string().min(1),
      token_type: z.string().min(1),
      token_value: z.string(),
      description: z.string().optional(),
    }),
    response: z.object({
      id: z.number().int().positive(),
    }),
  },

  // MINT.5 W3 fix: align schema with the live handler signature.
  // Live handler: ipcMain.handle('tokens:update', (_event, tokenPath, updates))
  // The schema is for single-arg channels; multi-arg channels are documented
  // here for reference. The actual validation happens in the handler body.
  // Updated response from { success } → { changes } to match reality.
  'tokens:update': {
    payload: z.object({
      token_type: z.string().optional(),
      token_value: z.string().optional(),
      description: z.string().nullable().optional(),
    }),
    response: z.object({
      changes: z.number().int().nonnegative(),
    }),
  },

  'tokens:seed-from-project': {
    payload: z.string().min(1),
    response: z.object({
      seeded: z.number().int().nonnegative(),
      source: z.enum(['project', 'none']),
      sourcePath: z.string().optional(),
      error: z.string().optional(),
    }),
  },

  // MINT.5: New channel — reads Figma↔local design token drift.
  // payload: no args (undefined), response: TokenDrift array.
  'tokens:read-figma-drift': {
    payload: z.undefined(),
    response: z.array(z.object({
      tokenName: z.string(),
      localValue: z.string(),
      figmaValue: z.string(),
      deltaE: z.number().optional(),
    })),
  },

  'tokens:delete': {
    payload: z.object({
      id: z.number().int().positive(),
    }),
    response: z.object({
      success: z.boolean(),
    }),
  },

  // ── Figma Status ────────────────────────────────────────────────

  'figma:status': {
    payload: z.undefined(),
    response: z.object({
      running: z.boolean(),
      lastWebhookAt: z.number().nullable(),
      tokenCount: z.number().int().nonnegative(),
      port: z.number().int().positive(),
    }),
  },

  // ── File Operations ─────────────────────────────────────────────

  'saveFile': {
    payload: z.object({
      filePath: z.string().min(1),
      content: z.string(),
    }),
    response: z.object({
      success: z.boolean(),
    }),
  },

  'readFile': {
    payload: z.object({
      filePath: z.string().min(1),
    }),
    response: z.object({
      content: z.string(),
    }),
  },

  // ── Server Status ───────────────────────────────────────────────

  'server:get-status': {
    payload: z.undefined(),
    response: z.object({
      running: z.boolean(),
      port: z.number().int().positive(),
    }),
  },

  'ping': {
    payload: z.undefined(),
    response: z.string(),
  },

  // ── CHRON.1: Governance approval reason ─────────────────────────
  //
  // Both the pre-approved ledger flow (renderer → main writes justification)
  // and the orchestrator flow (no ledger row yet, writes a governance_events
  // entry) land at the same validation boundary.

  'governance:approve-mutation': {
    payload: z.object({
      id: z.number().int().nonnegative(),
      reason: z.string().max(1000).optional(),
    }),
    response: z.undefined(),
  },

  'governance:record-approval-reason': {
    payload: z.object({
      // CHRON.1 A+ polish (code review v2 Major): reject control chars and
      // format chars in filePath to prevent audit-log pollution via crafted
      // paths. The path never reaches `fs` but gets rendered in audit UIs
      // and SARIF output — unambiguous text is required.
      filePath: z.string().min(1).max(4096).refine(
        (p) => !/[\p{Cc}\p{Cf}]/u.test(p),
        { message: 'filePath must not contain control or format characters' }
      ),
      toolName: z.string().min(1).max(200),
      reason: z.string().min(1).max(1000),
    }),
    response: z.undefined(),
  },

  // ── PHASE 0: Coverage Honesty ──────────────────────────────────
  //
  // `flint:getCoverageSummary` returns the aggregate CoverageSummary
  // owned by the main-process DebtReportService. The response shape is
  // the wire format for the renderer badge, `flint://dashboard`, and
  // `flint://session-context`. The enum values are serialized into
  // `.flint/debt-history.json` and are append-only — do not rename.

  'flint:getCoverageSummary': {
    payload: z.undefined(),
    response: z.object({
      governedSurfacePercent: z.number().min(0).max(100),
      totalFiles: z.number().int().nonnegative(),
      parsedFiles: z.number().int().nonnegative(),
      partialFiles: z.number().int().nonnegative(),
      skippedFiles: z.number().int().nonnegative(),
      skippedFilesByReason: z.object({
        'css-in-js-detected': z.number().int().nonnegative(),
        'external-stylesheet-imported': z.number().int().nonnegative(),
        'css-modules-reference': z.number().int().nonnegative(),
        'dynamic-class-expression': z.number().int().nonnegative(),
        'unresolvable-var': z.number().int().nonnegative(),
        'tailwind-config-extension': z.number().int().nonnegative(),
        'non-jsx-framework': z.number().int().nonnegative(),
        'non-literal-ternary-branch': z.number().int().nonnegative(),
        'parse-failure': z.number().int().nonnegative(),
      }),
      timestamp: z.string().min(1),
    }),
  },

  // ── RUNTIME.1: axe-core Runtime Adapter ────────────────────────
  //
  // `runtime:run-axe` spawns a sandboxed BrowserWindow (Electron) or
  // hidden Playwright page (web) with a tight CSP scoped to the axe-core
  // bundle, renders the provided `previewHtml`, runs `axe.run()`, and
  // returns a normalized RuntimeAuditResult. The IPC handler is ALWAYS
  // live, but the user-facing UI surfaces are gated behind
  // `runtime.axe.enabled` in flint.config.yaml (default: false).
  //
  // Payload maps to RuntimeAuditRequest in RUNTIME.1.contract.ts.
  // Response maps to RuntimeAuditResult in RUNTIME.1.contract.ts.

  'runtime:run-axe': {
    payload: z.object({
      previewHtml: z.string(),
      previewUrl: z.string().optional(),
      rules: z.array(z.string()).optional(),
    }),
    response: z.object({
      status: z.enum([
        'idle',
        'running',
        'passed',
        'violations',
        'no-preview',
        'version-mismatch',
        'error',
      ]),
      timestamp: z.string().min(1),
      axeVersion: z.string(),
      nodeCount: z.number().int().nonnegative(),
      durationMs: z.number().nonnegative(),
      violations: z.array(z.object({
        ruleId: z.string(),
        elementId: z.string(),
        message: z.string(),
        severity: z.enum(['critical', 'warning', 'info', 'advisory']),
        wcag: z.string(),
        fixable: z.boolean(),
        explanation: z.string().optional(),
        recovery: z.string().optional(),
      })),
      error: z.object({
        code: z.string(),
        message: z.string(),
      }).optional(),
    }),
  },

  /**
   * mcp:call-tool — Invoke an MCP tool by name with an arguments object.
   *
   * Shape notes (matches `electron/main.ts:3515` handler):
   *   - name: non-empty string (checked against SEC.3 renderer allowlist + AGV.1 per-agent ACL)
   *   - args: plain object (no arrays, no null). `_agentId` is stripped before forwarding.
   *
   * Response is the MCP tool's raw output — intentionally unknown here because the shape
   * varies per tool. Callers already narrow the response at the call site via
   * per-tool TypeScript types.
   */
  'mcp:call-tool': {
    payload: z.tuple([
      z.string().min(1),
      z.record(z.string(), z.unknown()),
    ]),
    response: z.unknown(),
  },

  // ── HELLO-FLINT-PHASE-A: Welcome Screen + Smart IDE Auto-Connect ──────────
  //
  // Three channels for the Hello, Flint welcome surface.
  // Registered IN the registry so createValidatedInvoker / web-api.ts can
  // dispatch them through the standard validated pipeline (fixes BLK-INT-3).
  //
  // hello:detect-editors     — void payload, DetectEditorsResponse
  // hello:write-mcp-config-bulk — WriteMcpConfigBulkPayload, WriteMcpConfigBulkResponse
  // hello:already-connected  — void payload, AlreadyConnectedResponse

  'hello:detect-editors': {
    payload: z.undefined(),
    response: z.object({
      editors: z.array(z.object({
        editor: z.enum(['claude-code', 'cursor', 'vscode']),
        present: z.boolean(),
        configPath: z.string().nullable(),
      })),
      mcpServerPath: z.string(),
      platform: z.enum(['darwin', 'linux', 'win32']),
    }),
  },

  'hello:write-mcp-config-bulk': {
    /**
     * editors: non-empty array of editor names (1..3; handler dedupes).
     * mcpServerPath: absolute path string, min 1 char.
     * Both constraints now enforced at the Zod level (fixes WARN-1).
     */
    payload: z.object({
      editors: z.array(z.enum(['claude-code', 'cursor', 'vscode'])).min(1).max(3),
      mcpServerPath: z.string().min(1),
    }),
    response: z.object({
      written: z.array(z.object({
        editor: z.enum(['claude-code', 'cursor', 'vscode']),
        configPath: z.string(),
        preservedEntries: z.number(),
      })),
      failed: z.array(z.object({
        editor: z.enum(['claude-code', 'cursor', 'vscode']),
        reason: z.string(),
        code: z.enum(['malformed-config', 'unexpected-schema']).optional(),
        detail: z.string().optional(),
      })),
    }),
  },

  'hello:already-connected': {
    payload: z.undefined(),
    response: z.object({
      connected: z.boolean(),
      editors: z.array(z.enum(['claude-code', 'cursor', 'vscode'])),
    }),
  },

} satisfies Record<string, { payload: z.ZodType; response: z.ZodType }>;

// ─── Named Zod Exports (referenced by contract `validator` fields) ─
//
// Contracts reference Zod validators by export name. These aliases
// point at the live schemas above so flint-contract-linter can grep
// for the export and confirm the validator exists at lint time.

/** Phase 0 — payload validator for `flint:getCoverageSummary` (undefined). */
export const getCoverageSummaryPayloadSchema = ipcSchemas['flint:getCoverageSummary'].payload;

/** Phase 0 — response validator for `flint:getCoverageSummary` (CoverageSummary shape). */
export const getCoverageSummaryResponseSchema = ipcSchemas['flint:getCoverageSummary'].response;

/** RUNTIME.1 — payload validator for `runtime:run-axe` (RuntimeAuditRequest shape). */
export const runtimeRunAxePayloadSchema = ipcSchemas['runtime:run-axe'].payload;

/** RUNTIME.1 — response validator for `runtime:run-axe` (RuntimeAuditResult shape). */
export const runtimeRunAxeResponseSchema = ipcSchemas['runtime:run-axe'].response;

/**
 * MINT.5 Phase 2 — combined validator for `mcp:call-tool` payload tuple
 * `[name: string, args: Record<string, unknown>]`. Used by the preload bridge
 * to pre-validate MCP tool calls before they reach `mcpClient.callTool`.
 */
export const mcpCallToolSchema = ipcSchemas['mcp:call-tool'].payload;

/** MINT.5 Phase 2 — response validator (unknown — per-tool shape). */
export const mcpCallToolResponseSchema = ipcSchemas['mcp:call-tool'].response;

// ─── Type Exports ───────────────────────────────────────────────────
//
// These are derived from the Zod schemas — single source of truth.
// Use these instead of manually writing IPC payload interfaces.

export type IPCSchemas = typeof ipcSchemas;
export type IPCChannel = keyof IPCSchemas;

/** Extract the payload type for a given IPC channel */
export type IPCPayload<T extends IPCChannel> = z.infer<IPCSchemas[T]['payload']>;

/** Extract the response type for a given IPC channel */
export type IPCResponse<T extends IPCChannel> = z.infer<IPCSchemas[T]['response']>;

// ─── Validation Helpers ─────────────────────────────────────────────

/**
 * Validates an IPC payload at runtime. Throws a descriptive error
 * if the payload doesn't match the schema — far better than a
 * silent data corruption across the process boundary.
 *
 * Use in preload.ts before calling ipcRenderer.invoke().
 */
export function validateIPC<T extends IPCChannel>(
  channel: T,
  data: unknown,
  schema: IPCSchemas[T]['payload']
): z.infer<IPCSchemas[T]['payload']> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `[Flint IPC] Validation failed for "${channel}":\n${issues}\n` +
      `Payload: ${JSON.stringify(data, null, 2)}`
    );
  }
  return result.data as z.infer<IPCSchemas[T]['payload']>;
}

/**
 * Validates an IPC response at runtime. Use after ipcRenderer.invoke()
 * returns to catch main-process response shape drift.
 */
export function validateIPCResponse<T extends IPCChannel>(
  channel: T,
  data: unknown,
  schema: IPCSchemas[T]['response']
): z.infer<IPCSchemas[T]['response']> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `[Flint IPC] Response validation failed for "${channel}":\n${issues}\n` +
      `Response: ${JSON.stringify(data, null, 2)}`
    );
  }
  return result.data as z.infer<IPCSchemas[T]['response']>;
}

// ─── MINT.5 Phase 3 — Per-Tool MCP Argument Schemas ───────────────────────────
//
// Five Zod schemas for the renderer-callable sync tools. These are APPEND-ONLY
// additions — the existing `ipcSchemas`, `mcpCallToolSchema`, and all named
// exports above are untouched.
//
// Shape derived directly from the case blocks in flint-mcp/src/server.ts:3224-3298
// so the Zod gate never rejects calls the engine actually accepts (R4 mitigation).
//
// The `MCP_TOOL_ARG_SCHEMAS` lookup is consulted by `electron/preload.ts` and
// `server/index.ts` before forwarding the mcp:call-tool IPC to the MCP server.
// Unknown tool names fall through (no schema → no gate → pass through unchanged).
//
// Coordinate with RUNTIME.1: that phase appends inside the `ipcSchemas` object and
// named-export region above. Phase 3 adds top-level exports at the bottom — no
// textual overlap, no merge conflict.

/** Arguments for `flint_sync_pull`. */
export const flintSyncPullArgsSchema = z.object({
  projectRoot: z.string().min(1),
  scope: z.literal('token').optional(),
  tokenPath: z.string().optional(),
}).strict()

/** Arguments for `flint_sync_push`. */
export const flintSyncPushArgsSchema = z.object({
  projectRoot: z.string().min(1),
}).strict()

/** Arguments for `flint_resolve_all`. */
export const flintResolveAllArgsSchema = z.object({
  projectRoot: z.string().min(1),
  resolution: z.enum(['local', 'remote']),
}).strict()

/** Arguments for `flint_resolve_conflict`. */
export const flintResolveConflictArgsSchema = z.object({
  conflictId: z.string().min(1),
  resolution: z.enum(['local', 'remote', 'merged']),
  mergedValue: z.string().optional(),
}).strict()

/** Arguments for `flint_sync_check`. */
export const flintSyncCheckArgsSchema = z.object({
  projectRoot: z.string().min(1),
}).strict()

/**
 * Lookup map from MCP tool name → Zod argument schema.
 *
 * The preload bridge (`electron/preload.ts`) and the web bridge (`server/index.ts`)
 * consult this map before forwarding `mcp:call-tool` IPC. If the tool name is
 * present, the args are validated; failures return a `validation-error` envelope
 * without calling `ipcRenderer.invoke` / `mcpClient.callTool`.
 * If the tool name is absent (not in the map), the call passes through unchanged.
 *
 * To register a new tool: add the Zod schema export above and add an entry here.
 * Also append the tool name to `MCP_TOOL_ARG_SCHEMA_NAMES` in the contract.
 */
export const MCP_TOOL_ARG_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  flint_sync_pull: flintSyncPullArgsSchema,
  flint_sync_push: flintSyncPushArgsSchema,
  flint_resolve_all: flintResolveAllArgsSchema,
  flint_resolve_conflict: flintResolveConflictArgsSchema,
  flint_sync_check: flintSyncCheckArgsSchema,
}

/**
 * Per-tool MCP argument validation gate — single source of truth.
 *
 * Both `electron/preload.ts` and `server/index.ts` consult this gate before
 * forwarding a tool call. Returning `{ ok: false, envelope }` short-circuits
 * the IPC/MCP path with a `validation-error` classification envelope; callers
 * MUST NOT proceed to the underlying transport on failure.
 *
 * Unknown tools (not registered in `MCP_TOOL_ARG_SCHEMAS`) pass through with
 * `{ ok: true, args }` unchanged — that's the documented behavior of the gate.
 *
 * Resolves W5 (code review 2026-04-20): the structurally-identical validation
 * blocks in preload + server were correct but duplicated. This helper keeps
 * the gate logic colocated with the schema map so they can never drift.
 */
export type MCPValidationResult =
  | { ok: true; args: Record<string, unknown> }
  | {
      ok: false;
      envelope: {
        content: Array<{ type: 'text'; text: string }>;
        isError: true;
        classification: 'validation-error';
      };
    }

export function validateMcpToolArgs(
  name: string,
  args: Record<string, unknown> | undefined,
): MCPValidationResult {
  const resolvedArgs = (args ?? {}) as Record<string, unknown>
  const perToolSchema = MCP_TOOL_ARG_SCHEMAS[name]
  if (perToolSchema === undefined) {
    return { ok: true, args: resolvedArgs }
  }
  const parseResult = perToolSchema.safeParse(resolvedArgs)
  if (parseResult.success) {
    return { ok: true, args: resolvedArgs }
  }
  const issue = parseResult.error.issues[0]
  const sanitized = issue
    ? `${issue.path.join('.') || 'args'}: ${issue.message}`
    : 'Invalid arguments'
  return {
    ok: false,
    envelope: {
      content: [{ type: 'text', text: sanitized }],
      isError: true,
      classification: 'validation-error',
    },
  }
}

// ─── End of MINT.5 Phase 3 additions ──────────────────────────────────────────

// ─── FORGE.1 — Channel Consolidation + Smart Detection ───────────────────────
//
// Append-only Zod exports referenced by `.flint-context/contracts/FORGE.1.contract.ts`.
//
// Shapes match the live handler signatures in `electron/main.ts` and
// `server/index.ts` (verified 2026-04-19):
//   - project:detect-environment, project:auto-configure, project:run-baseline
//     all derive their target from the main-process `activeProjectRoot` and
//     accept NO renderer payload. The validator is therefore `z.undefined()`.
//   - project:get-health-grade takes a single string `projectPath` arg
//     (electron/main.ts:2401) — validated as `z.string().min(1)`.
//   - project:smart-open is the new FORGE.1 channel; payload `{ input: string }`
//     where `input` is either an absolute folder path or a git URL.

/**
 * FORGE.1 — payload validator for `project:smart-open`. Folder path or git URL.
 *
 * SEC-MED-3: hardened against control / format characters and unbounded length.
 * Mirrors the CHRON.1 `governance:record-approval-reason` filePath rule above.
 * The 4096-char ceiling is well above any sane filesystem path or git URL while
 * blocking blob payloads from sneaking through the IPC boundary.
 */
export const projectSmartOpenSchema = z.object({
  input: z.string().min(1).max(4096).refine(
    (s) => !/[\p{Cc}\p{Cf}]/u.test(s),
    { message: 'input must not contain control or format characters' }
  ),
}).strict()

/**
 * FORGE.1 — payload validator for `project:detect-environment`.
 * Handler reads main-process `activeProjectRoot`; renderer sends no payload.
 */
export const projectDetectEnvironmentSchema = z.undefined()

/**
 * FORGE.1 — payload validator for `project:auto-configure`.
 *
 * Phase 2 fix-forward (CONS-2): now accepts an optional overrides object so the
 * DetectionPreview can pass user-corrected detection values into the configure
 * pipeline. `undefined` payload is still accepted for the legacy call site.
 */
export const projectAutoConfigureSchema = z.union([
  z.undefined(),
  z.object({
    overrides: z.object({
      framework: z.string().min(1).max(200).optional(),
      componentLibrary: z.string().min(1).max(200).optional(),
      cssFramework: z.string().min(1).max(200).optional(),
    }).strict().optional(),
  }).strict(),
])

/**
 * FORGE.1 fix-forward (CONS-1) — payload validator for `project:create-scratchpad`.
 * Optional `libraryDefault` carries the from-idea channel's MUI default through
 * the IPC boundary so the scratchpad is scaffolded with the right component-kit
 * pre-selection.
 */
export const projectCreateScratchpadSchema = z.union([
  z.undefined(),
  z.object({
    libraryDefault: z.string().min(1).max(200).optional(),
  }).strict(),
])

/**
 * FORGE.1 — payload validator for `project:run-baseline`.
 * Handler reads main-process `activeProjectRoot`; renderer sends no payload.
 */
export const projectRunBaselineSchema = z.undefined()

/**
 * FORGE.1 — payload validator for `project:get-health-grade`.
 * Single positional `projectPath` string (electron/main.ts:2401).
 */
export const projectGetHealthGradeSchema = z.string().min(1)

// ─── End of FORGE.1 additions ────────────────────────────────────────────────

// ─── BETA.TEL: Telemetry Consent IPC Validators ───────────────────────────────
//
// Closes BLK-3 (no IPC contract) from the beta-telemetry review.
// Two renderer→main channels:
//   telemetry:get-consent — void payload, ConsentRecord response
//   telemetry:set-consent — { state: 'accepted' | 'declined' } payload, ConsentRecord response
//
// Named exports are the contract `validator` field values — grep-able by
// the Phase 1.5 contract linter and the Phase 3 integration validator.

/** BETA.TEL — response schema for `telemetry:get-consent` (ConsentRecord shape). */
export const telemetryGetConsentResponseSchema = z.object({
  state: z.enum(['unset', 'accepted', 'declined']),
  decidedAt: z.string().optional(),
  sessionId: z.string().min(1),
})

/** BETA.TEL — payload schema for `telemetry:set-consent`. */
export const telemetrySetConsentPayloadSchema = z.object({
  state: z.enum(['accepted', 'declined']),
})

// ─── End of BETA.TEL additions ────────────────────────────────────────────────

// ─── HELLO-FLINT-PHASE-A: Named aliases (registered in ipcSchemas above) ───────
//
// The schemas are defined INSIDE ipcSchemas (fixes BLK-INT-3).
// These named exports are aliases that point into the registry so the
// Phase 1.5 contract linter's grep and any direct import still work.
//
// Pattern matches Phase 0 / RUNTIME.1 aliases above.

/** HELLO-FLINT-A — response validator for `hello:detect-editors`. */
export const helloDetectEditorsSchema = ipcSchemas['hello:detect-editors'].response;

/**
 * HELLO-FLINT-A — payload validator for `hello:write-mcp-config-bulk`.
 * Enforces: editors min 1, max 3; mcpServerPath min 1 char (WARN-1 fix).
 */
export const helloWriteMcpConfigBulkSchema = ipcSchemas['hello:write-mcp-config-bulk'].payload;

/** HELLO-FLINT-A — response validator for `hello:write-mcp-config-bulk`. */
export const helloWriteMcpConfigBulkResponseSchema = ipcSchemas['hello:write-mcp-config-bulk'].response;

/** HELLO-FLINT-A — response validator for `hello:already-connected`. */
export const helloAlreadyConnectedSchema = ipcSchemas['hello:already-connected'].response;

// ─── End of HELLO-FLINT-PHASE-A additions ────────────────────────────────────

/**
 * Creates a validated IPC invoker for use in preload.ts.
 * Wraps ipcRenderer.invoke with payload + response validation.
 *
 * Usage:
 *   const invoke = createValidatedInvoker(ipcRenderer);
 *   // In contextBridge:
 *   create: (token: unknown) => invoke('tokens:create', token),
 */
export function createValidatedInvoker(
  ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> }
) {
  return async function invoke<T extends IPCChannel>(
    channel: T,
    ...args: IPCSchemas[T]['payload'] extends z.ZodUndefined ? [] : [unknown]
  ): Promise<z.infer<IPCSchemas[T]['response']>> {
    const schema = ipcSchemas[channel];

    // Validate payload (skip for void-payload channels)
    const payload = args.length > 0 ? validateIPC(channel, args[0], schema.payload) : undefined;

    // Invoke across the process boundary
    const raw = payload !== undefined
      ? await ipcRenderer.invoke(channel, payload)
      : await ipcRenderer.invoke(channel);

    // Validate response
    return validateIPCResponse(channel, raw, schema.response);
  };
}
