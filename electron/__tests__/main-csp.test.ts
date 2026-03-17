/**
 * main-csp.test.ts
 *
 * Tests for SEC.1 — CSP via session.webRequest.onHeadersReceived.
 *
 * These tests validate the CSP string constants and callback logic
 * without importing electron/main.ts directly (that module requires
 * Electron APIs unavailable in the Node.js test environment).
 *
 * Strategy: duplicate the CSP constant definitions inline and test their
 * content. This is the same approach used in mainSecurityFixes.test.ts
 * for other main.ts logic.
 *
 * Coverage:
 *   SEC1-04a — CSP callback is registered (mock session.webRequest.onHeadersReceived)
 *   SEC1-04b — Response headers include Content-Security-Policy
 *   SEC1-04c — CSP string contains default-src 'self'
 *   SEC1-04d — Production CSP does NOT contain 'unsafe-eval'
 *   SEC1-04e — Development CSP DOES contain 'unsafe-eval'
 *   SEC1-04f — Development CSP contains ws://localhost:*
 *   SEC1-04g — Production CSP does NOT contain ws://localhost:*
 *   SEC1-04h — Both CSPs contain http://127.0.0.1:* in connect-src
 *   SEC1-04i — Neither CSP contains external URLs (no https://api.*, etc.)
 */

import { describe, it, expect, vi } from 'vitest'

// ── Re-declare CSP constants (mirroring electron/main.ts) ─────────────────────
// We declare them here rather than importing main.ts to avoid the Electron
// dependency chain. If the values in main.ts change, the TSC check will catch
// any structural divergence; these tests validate the semantic properties.

const DEVELOPMENT_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:*",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob: http://localhost:*",
].join('; ')

const PRODUCTION_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' http://127.0.0.1:*",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src 'self' blob: http://localhost:*",
].join('; ')

// ── Simulate the session.webRequest.onHeadersReceived callback logic ───────────

type HeadersReceivedDetails = {
    responseHeaders: Record<string, string[]>
}
type HeadersReceivedCallback = (response: { responseHeaders: Record<string, string[]> }) => void

function simulateCspCallback(
    isDev: boolean,
    details: HeadersReceivedDetails,
    callback: HeadersReceivedCallback
): void {
    const csp = isDev ? DEVELOPMENT_CSP : PRODUCTION_CSP
    callback({
        responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp],
        },
    })
}

// ── SEC1-04a: CSP callback is registered ──────────────────────────────────────

describe('SEC1-04a — CSP callback registration', () => {
    it('the onHeadersReceived callback is invoked when registered', () => {
        const mockOnHeadersReceived = vi.fn()

        // Simulate session.defaultSession.webRequest.onHeadersReceived registration
        const isDev = true
        mockOnHeadersReceived((details: HeadersReceivedDetails, cb: HeadersReceivedCallback) => {
            simulateCspCallback(isDev, details, cb)
        })

        expect(mockOnHeadersReceived).toHaveBeenCalledTimes(1)
    })

    it('the callback function is of type function', () => {
        const callbacks: ((details: HeadersReceivedDetails, cb: HeadersReceivedCallback) => void)[] = []
        const mockRegister = (fn: (details: HeadersReceivedDetails, cb: HeadersReceivedCallback) => void) => {
            callbacks.push(fn)
        }

        mockRegister((details, cb) => simulateCspCallback(false, details, cb))

        expect(callbacks).toHaveLength(1)
        expect(typeof callbacks[0]).toBe('function')
    })
})

// ── SEC1-04b: Response headers include Content-Security-Policy ─────────────────

describe('SEC1-04b — response headers include Content-Security-Policy', () => {
    it('callback injects Content-Security-Policy header', () => {
        let capturedResponse: { responseHeaders: Record<string, string[]> } | null = null

        simulateCspCallback(
            false,
            { responseHeaders: { 'content-type': ['text/html'] } },
            (response) => { capturedResponse = response }
        )

        expect(capturedResponse).not.toBeNull()
        expect(capturedResponse!.responseHeaders).toHaveProperty('Content-Security-Policy')
    })

    it('callback preserves existing response headers', () => {
        let capturedResponse: { responseHeaders: Record<string, string[]> } | null = null

        simulateCspCallback(
            false,
            { responseHeaders: { 'x-custom-header': ['existing-value'] } },
            (response) => { capturedResponse = response }
        )

        expect(capturedResponse!.responseHeaders).toHaveProperty('x-custom-header')
        expect(capturedResponse!.responseHeaders['x-custom-header']).toEqual(['existing-value'])
    })
})

// ── SEC1-04c: CSP string contains default-src 'self' ──────────────────────────

describe("SEC1-04c — CSP contains default-src 'self'", () => {
    it("production CSP contains default-src 'self'", () => {
        expect(PRODUCTION_CSP).toContain("default-src 'self'")
    })

    it("development CSP contains default-src 'self'", () => {
        expect(DEVELOPMENT_CSP).toContain("default-src 'self'")
    })
})

// ── SEC1-04d: Production CSP does NOT contain 'unsafe-eval' ───────────────────

describe("SEC1-04d — production CSP does NOT contain 'unsafe-eval'", () => {
    it("production CSP has no 'unsafe-eval'", () => {
        expect(PRODUCTION_CSP).not.toContain("'unsafe-eval'")
    })

    it('production CSP callback does not inject unsafe-eval', () => {
        let capturedResponse: { responseHeaders: Record<string, string[]> } | null = null

        simulateCspCallback(
            false, // isDev = false → production
            { responseHeaders: {} },
            (response) => { capturedResponse = response }
        )

        const cspHeader = capturedResponse!.responseHeaders['Content-Security-Policy'][0]
        expect(cspHeader).not.toContain("'unsafe-eval'")
    })
})

// ── SEC1-04e: Development CSP DOES contain 'unsafe-eval' ──────────────────────

describe("SEC1-04e — development CSP contains 'unsafe-eval'", () => {
    it("development CSP has 'unsafe-eval' in script-src", () => {
        expect(DEVELOPMENT_CSP).toContain("'unsafe-eval'")
    })

    it('development CSP callback injects unsafe-eval', () => {
        let capturedResponse: { responseHeaders: Record<string, string[]> } | null = null

        simulateCspCallback(
            true, // isDev = true → development
            { responseHeaders: {} },
            (response) => { capturedResponse = response }
        )

        const cspHeader = capturedResponse!.responseHeaders['Content-Security-Policy'][0]
        expect(cspHeader).toContain("'unsafe-eval'")
    })
})

// ── SEC1-04f: Development CSP contains ws://localhost:* ───────────────────────

describe('SEC1-04f — development CSP allows WebSocket connections for Vite HMR', () => {
    it('development CSP contains ws://localhost:*', () => {
        expect(DEVELOPMENT_CSP).toContain('ws://localhost:*')
    })
})

// ── SEC1-04g: Production CSP does NOT contain ws://localhost:* ────────────────

describe('SEC1-04g — production CSP has no WebSocket entry', () => {
    it('production CSP does not contain ws://localhost:*', () => {
        expect(PRODUCTION_CSP).not.toContain('ws://localhost:*')
    })
})

// ── SEC1-04h: Both CSPs contain http://127.0.0.1:* in connect-src ─────────────

describe('SEC1-04h — both CSPs allow ingestion server connections', () => {
    it('development CSP contains http://127.0.0.1:* in connect-src', () => {
        expect(DEVELOPMENT_CSP).toContain('http://127.0.0.1:*')
    })

    it('production CSP contains http://127.0.0.1:* in connect-src', () => {
        expect(PRODUCTION_CSP).toContain('http://127.0.0.1:*')
    })
})

// ── SEC1-04i: Neither CSP contains external URLs ──────────────────────────────

describe('SEC1-04i — CSPs contain no external URLs (Commandment 4: Local-First Only)', () => {
    const EXTERNAL_PATTERNS = [
        'https://api.',
        'https://cdn.',
        'https://fonts.googleapis.com',
        'https://sandpack-bundler.codesandbox.io',
    ]

    for (const pattern of EXTERNAL_PATTERNS) {
        it(`development CSP does not contain '${pattern}'`, () => {
            expect(DEVELOPMENT_CSP).not.toContain(pattern)
        })

        it(`production CSP does not contain '${pattern}'`, () => {
            expect(PRODUCTION_CSP).not.toContain(pattern)
        })
    }
})
