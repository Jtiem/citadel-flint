/**
 * MCP JSON-RPC Synthetic CallToolRequest Harness
 *
 * Constructs a minimal CallToolRequest envelope and dispatches it directly
 * through the server's internal _requestHandlers map (Protocol base class).
 * This exercises the full registered handler body — including any validation
 * hoisted at the top of the tools/call case — without requiring a live
 * stdio transport.
 *
 * Usage:
 *   import { callTool, makeServer } from './harness.js'
 *   const server = makeServer()
 *   const result = await callTool(server, 'flint_status', {})
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Call a registered MCP tool by name, bypassing the transport layer.
 *
 * Reaches into `server._requestHandlers` (Protocol base class internal map,
 * keyed by method string) to invoke the 'tools/call' handler directly with a
 * synthetic request envelope. The SDK does not expose a public request() API
 * that works without a live transport, so the internal map is the only option.
 */
export async function callTool(
  server: Server,
  toolName: string,
  args: unknown
): Promise<CallToolResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = (server as any)._requestHandlers as Map<string, Function>;
  const handler = handlers.get('tools/call');
  if (!handler) {
    throw new Error('No tools/call handler registered on server instance');
  }

  const syntheticRequest = {
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  // The handler receives (request, extra). Pass an empty extra object.
  const result = await handler(syntheticRequest, {});
  return result as CallToolResult;
}

/**
 * Create a fresh server instance using the same module-level constant that
 * server.ts exports. Since server.ts does not export `server` directly,
 * callers that need the live registered server must import it from server.ts
 * via a dynamic import workaround, or use this factory for isolated tests.
 *
 * For Wave 2 integration tests that need all handlers registered, import the
 * live `server` constant via:
 *   const { server } = await import('../server.js')
 * after ensuring server.ts module side-effects are acceptable in the test env.
 */
export function makeServer(): Server {
  return new Server(
    { name: 'flint-test-harness', version: '0.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
}
