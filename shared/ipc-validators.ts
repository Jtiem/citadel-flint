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

  'tokens:update': {
    payload: z.object({
      id: z.number().int().positive(),
      token_value: z.string(),
      description: z.string().optional(),
    }),
    response: z.object({
      success: z.boolean(),
    }),
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

} satisfies Record<string, { payload: z.ZodType; response: z.ZodType }>;

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
