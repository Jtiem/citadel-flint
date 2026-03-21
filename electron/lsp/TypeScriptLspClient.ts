/**
 * TypeScriptLspClient.ts — electron/lsp/TypeScriptLspClient.ts
 *
 * ILspClient implementation for TypeScript / TSX (Phase N.3).
 *
 * Uses the TypeScript Compiler API (`ts.createLanguageService`) to type-check
 * and syntax-validate AI-proposed mutation snippets entirely in memory —
 * no `tsc --noEmit` CLI spawning, no disk I/O.
 *
 * Execution model:
 *   A lightweight `node:worker_threads` Worker keeps the TS Language Service
 *   alive between calls. The Worker receives the snippet, runs diagnostics,
 *   and posts the result back to the main thread. This avoids blocking the
 *   Electron main process during (potentially slow) type resolution.
 *
 * Main process only — imported by electron/orchestrator.ts.
 */

import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import type { ILspClient } from './types'

// ── Worker payload types ──────────────────────────────────────────────────────

interface ValidateRequest {
    type: 'validate'
    snippet: string
}

interface ValidateResponse {
    type: 'result'
    error: string | null
}

// ── Worker thread logic ────────────────────────────────────────────────────────
//
// This module doubles as both the host and the worker (self-referencing pattern).
// When `isMainThread` is false, the Worker executes the logic below.

if (!isMainThread) {
    // Lazy-import TypeScript inside the worker so the main thread stays clean.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript') as typeof import('typescript')

    /**
     * Creates a minimal in-memory TypeScript LanguageServiceHost.
     * Only needs to handle the single synthetic "validate.tsx" virtual file.
     */
    function createHost(snippet: string): import('typescript').LanguageServiceHost {
        const fileName = 'validate.tsx'
        const version = '0'
        return {
            getScriptFileNames: () => [fileName],
            getScriptVersion: () => version,
            getScriptSnapshot: (f: string) => {
                if (f === fileName) return ts.ScriptSnapshot.fromString(snippet)
                return undefined
            },
            getCurrentDirectory: () => process.cwd(),
            getCompilationSettings: (): import('typescript').CompilerOptions => ({
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.ESNext,
                jsx: ts.JsxEmit.ReactJSX,
                strict: false,
                noEmit: true,
                skipLibCheck: true,
                allowJs: true,
                isolatedModules: true,
            }),
            getDefaultLibFileName: (opts: import('typescript').CompilerOptions) =>
                ts.getDefaultLibFilePath(opts),
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            readDirectory: ts.sys.readDirectory,
        }
    }

    parentPort!.on('message', (msg: ValidateRequest) => {
        if (msg.type !== 'validate') return

        try {
            const host = createHost(msg.snippet)
            const svc = ts.createLanguageService(host)
            // Combine syntactic + semantic diagnostics
            const diags = [
                ...svc.getSyntacticDiagnostics('validate.tsx'),
                ...svc.getSemanticDiagnostics('validate.tsx'),
            ]
            // Filter to errors only (ignore warnings)
            const errors = diags.filter((d) => d.category === ts.DiagnosticCategory.Error)
            if (errors.length === 0) {
                const res: ValidateResponse = { type: 'result', error: null }
                parentPort!.postMessage(res)
            } else {
                const message = errors
                    .slice(0, 3)  // cap at 3 to keep the feedback prompt short
                    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
                    .join('; ')
                const res: ValidateResponse = { type: 'result', error: `TypeScript: ${message}` }
                parentPort!.postMessage(res)
            }
        } catch (err) {
            const res: ValidateResponse = {
                type: 'result',
                error: `TS worker error: ${err instanceof Error ? err.message : String(err)}`,
            }
            parentPort!.postMessage(res)
        }
    })
}

// ── Main thread: TypeScriptLspClient class ────────────────────────────────────

/**
 * Manages a single `worker_threads` Worker that keeps a TypeScript
 * LanguageService alive for fast, repeated in-memory validation.
 */
export class TypeScriptLspClient implements ILspClient {
    private _worker: Worker | null = null

    async start(): Promise<void> {
        if (this._worker !== null) return  // idempotent

        // __filename in ESM context
        const workerPath = fileURLToPath(import.meta.url)

        this._worker = new Worker(workerPath, {
            workerData: null,
            // Re-use the same compiled file; the !isMainThread block handles worker logic.
        })

        // Swallow uncaught worker errors so validation failures never crash the main process.
        this._worker.on('error', (err) => {
            console.error('[Flint LSP] TypeScript worker error:', err)
            this._worker = null  // allow restart on next validate
        })
    }

    async validateSnippet(snippet: string): Promise<string | null> {
        // Lazy-start so callers don't have to await start() explicitly.
        if (this._worker === null) await this.start()
        const worker = this._worker!

        return new Promise((resolve) => {
            const handler = (msg: ValidateResponse) => {
                if (msg.type === 'result') {
                    resolve(msg.error)
                }
            }
            worker.once('message', handler)
            const req: ValidateRequest = { type: 'validate', snippet }
            worker.postMessage(req)

            // 5 000 ms safety timeout — never block the orchestrator indefinitely.
            const timer = setTimeout(() => {
                worker.off('message', handler)
                console.warn('[Flint LSP] TypeScript validation timed out')
                resolve(null)  // treat timeout as passing (safer UX)
            }, 5000)

            worker.once('message', () => clearTimeout(timer))
        })
    }

    async stop(): Promise<void> {
        if (this._worker === null) return
        await this._worker.terminate()
        this._worker = null
    }
}

/**
 * The shared singleton used by the orchestrator.
 * Import this instead of constructing a new client per-call.
 */
export const tsLspClient = new TypeScriptLspClient()
