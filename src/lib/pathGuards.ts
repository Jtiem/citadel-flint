/**
 * pathGuards.ts — shared renderer-side path predicates.
 *
 * These functions run in the sandboxed renderer (no Node.js). They operate
 * on string patterns only — no fs calls. All callers that previously
 * inlined these checks have been updated to import from here.
 *
 * Windows absolute paths are out of scope for Flint (macOS/Linux only).
 * POSIX absolute paths must start with '/'.
 */

/**
 * Returns true when `p` points to a transient OS-managed directory that
 * Flint should never persist as a workspace root or last-active file.
 *
 * macOS cleans up /var/folders periodically; /tmp content is lost on reboot.
 * Auto-loading these paths causes ENOENT floods after the demo project is
 * partially cleaned up.
 */
export function isTransientPath(p: string): boolean {
    if (typeof p !== 'string' || p.length === 0) return true
    return p.startsWith('/var/folders/') || p.startsWith('/tmp/')
}

/**
 * Returns true when `p` appears to live inside the Flint source tree.
 * Used as a read-side self-hosting guard in the renderer layer.
 *
 * The serverRoot value is injected by callers that have access to it
 * (e.g. tryAutoResume via the `isSelfHostedPath` dep). Pass null when
 * no server root is available — the guard is conservatively disabled.
 *
 * Note: the authoritative self-hosting guard lives in the main process
 * (electron/main.ts `isFlintSourceTree`) and server (server/index.ts
 * `createSelfHostingGuard`). This renderer helper is a belt-and-suspenders
 * check at the tryAutoResume layer only.
 */
export function isSelfHostedPath(p: string, serverRoot: string | null): boolean {
    if (!serverRoot || typeof p !== 'string' || p.length === 0) return false
    return p === serverRoot || p.startsWith(serverRoot + '/')
}
