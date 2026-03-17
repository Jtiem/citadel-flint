/**
 * rateLimiter.ts — SEC.6: Token-Bucket Rate Limiter
 *
 * Pure in-memory rate limiting with zero external dependencies and zero
 * Electron/SQLite imports.  Extracted into its own module so:
 *   1. Tests can import it without triggering the Electron `app.getPath()`
 *      call that happens at the top of ingestion-server.ts → store.ts.
 *   2. ingestion-server.ts can import the shared logic without circular deps.
 *
 * All state is in-memory only: resets when the process restarts (Commandment 12).
 */

// ── TokenBucket ───────────────────────────────────────────────────────────────

/**
 * TokenBucket — a simple in-memory token-bucket rate limiter.
 *
 * Tokens accumulate at `refillRate` tokens per millisecond up to `capacity`.
 * Each call to `consume()` tries to spend one token.  If the bucket is empty
 * the call is rejected and `retryAfterMs` tells the caller how long to wait.
 *
 * Implementation is O(1) per call and adds < 1 ms of overhead.
 *
 * @param requestsPerMinute  Maximum sustained request rate (e.g. 10 for /ingest)
 * @param nowFn              Optional clock override — injected by tests for time travel
 */
export class TokenBucket {
    private capacity: number
    /** Tokens per millisecond (= requestsPerMinute / 60_000). */
    private refillRate: number
    private tokens: number
    private lastRefillTime: number

    constructor(
        requestsPerMinute: number,
        private nowFn: () => number = Date.now,
    ) {
        this.capacity = requestsPerMinute
        this.refillRate = requestsPerMinute / 60_000   // tokens per ms
        this.tokens = requestsPerMinute                // start full
        this.lastRefillTime = nowFn()
    }

    /** Refill tokens based on elapsed wall-clock time since the last call. */
    private refill(): void {
        const now = this.nowFn()
        const elapsed = now - this.lastRefillTime
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate)
        this.lastRefillTime = now
    }

    /**
     * Attempt to consume one token.
     * @returns `{ allowed: true }` when a token is available,
     *          `{ allowed: false, retryAfterMs: number }` when the bucket is empty.
     */
    consume(): { allowed: true } | { allowed: false; retryAfterMs: number } {
        this.refill()
        if (this.tokens >= 1) {
            this.tokens -= 1
            return { allowed: true }
        }
        // How long until at least 1 token is available
        const retryAfterMs = Math.ceil((1 - this.tokens) / this.refillRate)
        return { allowed: false, retryAfterMs }
    }
}

// ── Per-route buckets ─────────────────────────────────────────────────────────

/**
 * Route capacity limits (from SEC.6 spec):
 *   /ingest       10 req/min  — SQLite batch-upsert is heavy; tight limit
 *   /ingest-ast   60 req/min  — AST dispatch is lighter; 1 req/sec steady rate
 *   /ingest-asset 30 req/min  — base64 writes are moderate cost
 */
const ROUTE_LIMITS: Record<string, number> = {
    '/ingest':       10,
    '/ingest-ast':   60,
    '/ingest-asset': 30,
}

const routeBuckets: Record<string, TokenBucket> = {}
for (const [route, limit] of Object.entries(ROUTE_LIMITS)) {
    routeBuckets[route] = new TokenBucket(limit)
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Check whether a request to `url` is within the rate limit.
 *
 * Returns `{ allowed: true }` if the route has capacity, or
 * `{ allowed: false, retryAfterSecs: number }` if it is exhausted.
 *
 * Unknown routes (e.g. /health) are always allowed — only the three
 * registered ingestion routes are rate-controlled.
 *
 * `OPTIONS` requests should be exempted by the caller before reaching this
 * function (CORS preflight must always succeed).
 */
export function checkRateLimit(url: string | undefined): { allowed: true } | { allowed: false; retryAfterSecs: number } {
    const path = url?.split('?')[0] ?? ''
    const bucket = routeBuckets[path]
    if (!bucket) return { allowed: true }
    const result = bucket.consume()
    if (result.allowed) return { allowed: true }
    const retryAfterSecs = Math.ceil(result.retryAfterMs / 1000)
    return { allowed: false, retryAfterSecs }
}

/**
 * Reset all per-route buckets to their full capacity.
 *
 * Intended for testing only.  In production the buckets live for the duration
 * of the process — a server restart is the natural reset.
 */
export function resetRateLimiter(): void {
    for (const [route, limit] of Object.entries(ROUTE_LIMITS)) {
        routeBuckets[route] = new TokenBucket(limit)
    }
}
