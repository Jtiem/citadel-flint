/**
 * SYNC.1 — Figma REST API Service.
 *
 * Wraps the Figma Variables endpoint with exponential backoff retry,
 * rate limit detection (429), and injectable HTTP client for testability.
 */

import type {
    FigmaHttpClient,
    FigmaVariablesResponse,
    FigmaVariableUpdateRequest,
    FigmaVariableUpdateResponse,
} from './types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIGMA_API_BASE = 'https://api.figma.com'
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

// ---------------------------------------------------------------------------
// Default HTTP client using global fetch
// ---------------------------------------------------------------------------

const defaultHttpClient: FigmaHttpClient = {
    async get(url, headers) {
        const res = await fetch(url, { method: 'GET', headers })
        return { status: res.status, json: () => res.json() }
    },
    async post(url, headers, body) {
        const res = await fetch(url, { method: 'POST', headers, body })
        return { status: res.status, json: () => res.json() }
    },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FigmaApiService {
    private readonly http: FigmaHttpClient
    private readonly _sleep: (ms: number) => Promise<void>

    constructor(httpClient?: FigmaHttpClient, sleepFn?: (ms: number) => Promise<void>) {
        this.http = httpClient ?? defaultHttpClient
        this._sleep = sleepFn ?? sleep
    }

    /**
     * GET /v1/files/{fileKey}/variables/local
     * Returns all local variables for a Figma file.
     */
    async getFileVariables(
        fileKey: string,
        accessToken: string,
    ): Promise<FigmaVariablesResponse> {
        const url = `${FIGMA_API_BASE}/v1/files/${encodeURIComponent(fileKey)}/variables/local`
        const headers = {
            'X-Figma-Token': accessToken,
            'Accept': 'application/json',
        }

        return this.retryRequest(async () => {
            const res = await this.http.get(url, headers)
            if (res.status === 429) {
                throw new RateLimitError('Figma rate limit exceeded')
            }
            if (res.status !== 200) {
                const body = await res.json() as { message?: string }
                throw new FigmaApiError(
                    `Figma API error ${res.status}: ${body.message ?? 'Unknown error'}`,
                    res.status,
                )
            }
            return (await res.json()) as FigmaVariablesResponse
        })
    }

    /**
     * POST /v1/files/{fileKey}/variables
     * Create, update, or delete variables in a Figma file.
     */
    async updateFileVariables(
        fileKey: string,
        accessToken: string,
        updates: FigmaVariableUpdateRequest,
    ): Promise<FigmaVariableUpdateResponse> {
        const url = `${FIGMA_API_BASE}/v1/files/${encodeURIComponent(fileKey)}/variables`
        const headers = {
            'X-Figma-Token': accessToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }
        const body = JSON.stringify(updates)

        return this.retryRequest(async () => {
            const res = await this.http.post(url, headers, body)
            if (res.status === 429) {
                throw new RateLimitError('Figma rate limit exceeded')
            }
            if (res.status !== 200) {
                const respBody = await res.json() as { message?: string }
                throw new FigmaApiError(
                    `Figma API error ${res.status}: ${respBody.message ?? 'Unknown error'}`,
                    res.status,
                )
            }
            return (await res.json()) as FigmaVariableUpdateResponse
        })
    }

    // -----------------------------------------------------------------------
    // Retry with exponential backoff
    // -----------------------------------------------------------------------

    private async retryRequest<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | undefined
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                return await fn()
            } catch (err) {
                lastError = err as Error
                if (err instanceof RateLimitError || (err instanceof FigmaApiError && err.statusCode >= 500)) {
                    const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
                    await this._sleep(delay)
                    continue
                }
                // Non-retryable error — throw immediately
                throw err
            }
        }
        throw lastError!
    }
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class FigmaApiError extends Error {
    readonly statusCode: number
    constructor(message: string, statusCode: number) {
        super(message)
        this.name = 'FigmaApiError'
        this.statusCode = statusCode
    }
}

export class RateLimitError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'RateLimitError'
    }
}
