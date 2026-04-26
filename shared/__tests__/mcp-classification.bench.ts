/**
 * mcp-classification.bench.ts — shared/__tests__/mcp-classification.bench.ts
 *
 * MINT.5 Phase 3 — Vitest bench for classifyMCPError performance.
 *
 * Invariant: classification-attach-overhead
 *   Measurable: time spent in classifyMCPError per MCP call
 *   Threshold:  < 5ms per call at p95
 *   Measured by: 1000-call loop
 *
 * The bench runs 1000 iterations of classifyMCPError across a representative
 * set of inputs (all 5 classification branches) and asserts that the p95
 * latency per call stays under 5ms.
 */

import { bench, describe, expect } from 'vitest'
import { classifyMCPError } from '../mcp-classification'

// Representative inputs covering all classification branches
const BENCH_INPUTS = [
    { rawText: 'auth-expired: re-authenticate with figma', isError: true },
    { rawText: 'rate limit exceeded: 429 from figma api', isError: true },
    { rawText: 'econnrefused 127.0.0.1:7000', isError: true },
    { rawText: 'validation failed: projectRoot is required', isError: true },
    { rawText: 'ok', isError: false },
    { rawText: 'token expired: session invalidated', isError: true },
    { rawText: 'too many requests', isError: true },
    { rawText: 'enotfound api.figma.com', isError: true },
    { rawText: 'request timeout after 30000ms', isError: true },
    { rawText: 'some other tool error occurred', isError: true },
] as const

// ── Bench: classification-attach-overhead invariant ───────────────────────────
//
// Vitest bench runs the function many times and reports min/max/mean/p75/p99.
// The invariant requires p95 < 5ms. Since we're running 1000 iterations per
// bench round, Vitest samples across many rounds.

describe('classifyMCPError performance', () => {
    bench(
        'classification-attach-overhead: 1000 calls across all branches',
        () => {
            // Run 1000 invocations per bench iteration to measure bulk throughput.
            // Vitest bench reports timing per *iteration* (the entire block below),
            // so we divide by 1000 mentally. Each individual call should be << 5ms.
            for (let i = 0; i < 1000; i++) {
                const input = BENCH_INPUTS[i % BENCH_INPUTS.length]
                classifyMCPError(input)
            }
        },
        {
            iterations: 50, // Run the 1000-call block 50 times for reliable stats
            warmupIterations: 10,
        }
    )

    bench(
        'single call: auth-expired classification',
        () => {
            classifyMCPError({ rawText: 'auth-expired', isError: true })
        },
        { iterations: 1000, warmupIterations: 100 }
    )

    bench(
        'single call: successful result (unknown branch)',
        () => {
            classifyMCPError({ rawText: 'ok', isError: false })
        },
        { iterations: 1000, warmupIterations: 100 }
    )

    bench(
        'single call: network-error classification',
        () => {
            classifyMCPError({ rawText: 'econnrefused 127.0.0.1:3000', isError: true })
        },
        { iterations: 1000, warmupIterations: 100 }
    )
})

// ── Programmatic latency assertion ────────────────────────────────────────────
// In addition to the bench (which surfaces stats), we also do a direct timing
// loop to programmatically verify the p95 < 5ms invariant at test-time.

describe('classifyMCPError — classification-attach-overhead invariant', () => {
    bench(
        'p95 < 5ms: 1000 calls timed via performance.now()',
        () => {
            const CALL_COUNT = 1000
            const timings: number[] = []

            for (let i = 0; i < CALL_COUNT; i++) {
                const input = BENCH_INPUTS[i % BENCH_INPUTS.length]
                const start = performance.now()
                classifyMCPError(input)
                const end = performance.now()
                timings.push(end - start)
            }

            // Sort to get p95
            timings.sort((a, b) => a - b)
            const p95Index = Math.floor(CALL_COUNT * 0.95)
            const p95 = timings[p95Index]!

            // Contract invariant: < 5ms per call at p95
            expect(p95).toBeLessThan(5)
        },
        { iterations: 1, warmupIterations: 1 }
    )
})
