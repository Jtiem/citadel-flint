/**
 * vscode-extension/src/bridgeClient.ts
 *
 * Spawns the Bridge MCP server as a child process and communicates via
 * JSON-RPC 2.0 over stdio.
 *
 * Lifecycle:
 *   start(serverPath, projectRoot) -- spawn MCP server
 *   stop()                         -- graceful SIGTERM + SIGKILL fallback
 *   callTool(name, args)           -- JSON-RPC tools/call
 *   isConnected()                  -- connection check
 */
export interface MCPCallResult {
    content: Array<{
        type: string;
        text?: string;
    }>;
    isError?: boolean;
}
export declare class BridgeClient {
    private proc;
    private connected;
    private nextId;
    private pendingCalls;
    private onLog;
    constructor(options?: {
        onLog?: (msg: string) => void;
    });
    /**
     * Resolves the MCP server entry point. Checks, in order:
     * 1. Explicit `customServerPath` from settings
     * 2. `<workspaceRoot>/bridge-mcp/dist/server.js`
     * 3. `<workspaceRoot>/node_modules/bridge-mcp/dist/server.js`
     */
    static resolveServerPath(workspaceRoot: string, customServerPath?: string): string | null;
    /**
     * Spawns the MCP server child process.
     */
    start(serverPath: string, projectRoot: string): Promise<void>;
    stop(): Promise<void>;
    callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult>;
    isConnected(): boolean;
    private sendHandshake;
    private handleResponse;
    private handleExit;
    private rpc;
    private send;
    private assertConnected;
    private rejectAllPending;
}
//# sourceMappingURL=bridgeClient.d.ts.map