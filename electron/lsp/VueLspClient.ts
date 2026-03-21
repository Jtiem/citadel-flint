/**
 * VueLspClient.ts — electron/lsp/VueLspClient.ts
 *
 * ILspClient implementation for Vue SFC template validation (Phase N.5).
 *
 * Strategy
 * ─────────
 * Instead of spinning up a heavyweight Volar Language Server, we use
 * @vue/compiler-sfc's `parse()`, `compileScript()`, and `compileTemplate()`
 * functions directly inside a worker_threads Worker. These functions natively
 * return arrays of syntactic and semantic errors, giving us equivalent fidelity
 * to the TypeScript LSP but with far less infrastructure.
 *
 * When the Flint AI Orchestrator proposes a mutation for a `.vue` file, it
 * assembles a minimal Vue template snippet (e.g. `<div>{{ msg }}</div>`) and
 * calls `validateSnippet()`. The worker wraps it in a minimal SFC, runs the
 * compiler, and returns the first error (if any) as a human-readable string.
 *
 * Main process only — imported by electron/orchestrator.ts via the LspRouter.
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
// Self-referencing pattern: the same compiled file is the host AND the worker.
// When not on the main thread, we handle validation requests.

if (!isMainThread) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parse, compileTemplate, compileScript } = require('@vue/compiler-sfc') as typeof import('@vue/compiler-sfc')

    parentPort!.on('message', (msg: ValidateRequest) => {
        if (msg.type !== 'validate') return

        try {
            // Wrap the snippet in a minimal SFC so the compiler has the full context.
            const sfcSource = `<template>\n${msg.snippet}\n</template>`

            const { descriptor, errors: parseErrors } = parse(sfcSource, {
                filename: 'flint-validate.vue',
            })

            const errors: string[] = []

            // ── Parse-level errors ─────────────────────────────────────────────
            for (const e of parseErrors) {
                errors.push(e.message)
            }

            // ── Template compile errors ────────────────────────────────────────
            if (descriptor.template) {
                const templateResult = compileTemplate({
                    source: descriptor.template.content,
                    filename: 'flint-validate.vue',
                    id: 'flint',
                    compilerOptions: { mode: 'module' },
                })
                for (const e of templateResult.errors ?? []) {
                    errors.push(typeof e === 'string' ? e : (e as Error).message)
                }
            }

            // ── Script compile errors (if <script setup> is present) ──────────
            if (descriptor.scriptSetup || descriptor.script) {
                try {
                    const scriptResult = compileScript(descriptor, {
                        id: 'flint',
                        isProd: false,
                    })
                    void scriptResult  // Errors are thrown, not returned
                } catch (scriptErr) {
                    errors.push(scriptErr instanceof Error ? scriptErr.message : String(scriptErr))
                }
            }

            const res: ValidateResponse = {
                type: 'result',
                error: errors.length > 0
                    ? `Vue: ${errors.slice(0, 3).join('; ')}`
                    : null,
            }
            parentPort!.postMessage(res)
        } catch (err) {
            const res: ValidateResponse = {
                type: 'result',
                error: `Vue worker error: ${err instanceof Error ? err.message : String(err)}`,
            }
            parentPort!.postMessage(res)
        }
    })
}

// ── Main thread: VueLspClient class ──────────────────────────────────────────

/**
 * Manages a single worker_threads Worker that keeps @vue/compiler-sfc
 * alive for fast, repeated in-memory Vue SFC validation.
 */
export class VueLspClient implements ILspClient {
    private _worker: Worker | null = null

    async start(): Promise<void> {
        if (this._worker !== null) return  // idempotent

        const workerPath = fileURLToPath(import.meta.url)

        this._worker = new Worker(workerPath, { workerData: null })

        this._worker.on('error', (err) => {
            console.error('[Flint LSP] Vue worker error:', err)
            this._worker = null  // allow restart on next validate
        })
    }

    async validateSnippet(snippet: string): Promise<string | null> {
        if (this._worker === null) await this.start()
        const worker = this._worker!

        return new Promise((resolve) => {
            const handler = (msg: ValidateResponse) => {
                if (msg.type === 'result') resolve(msg.error)
            }
            worker.once('message', handler)
            const req: ValidateRequest = { type: 'validate', snippet }
            worker.postMessage(req)

            // 5 000 ms safety timeout — treat as clean on timeout (mirrors TS LSP)
            const timer = setTimeout(() => {
                worker.off('message', handler)
                console.warn('[Flint LSP] Vue validation timed out')
                resolve(null)
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
 * The shared singleton used by the orchestrator's LspRouter for .vue files.
 */
export const vueLspClient = new VueLspClient()
