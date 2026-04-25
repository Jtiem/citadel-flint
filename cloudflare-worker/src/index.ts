/**
 * Flint Beta Telemetry Worker
 *
 * Receives telemetry events from the Flint desktop app and forwards them to
 * a Slack webhook so Justin can see them in real time during closed beta.
 *
 * Environment variables (set via `wrangler secret put`):
 *   SLACK_WEBHOOK_URL  — Slack incoming-webhook URL (required for forwarding)
 *   SHARED_SECRET      — REQUIRED. Requests must include it as `X-Flint-Secret`.
 *                        If missing, the Worker fails closed with 503.
 *
 * Bindings (set via wrangler.toml):
 *   TELEMETRY_KV       — Cloudflare KV namespace. Every event is also stored
 *                        here so nothing is ever lost if Slack rate-limits.
 *
 * Endpoints:
 *   POST /events       — Receive a batch of telemetry events
 *   GET  /health       — Liveness probe (returns { ok: true })
 */

import { z } from 'zod'

export interface Env {
    SLACK_WEBHOOK_URL?: string
    SHARED_SECRET?: string
    TELEMETRY_KV: KVNamespace
}

// ─── Schemas ────────────────────────────────────────────────────────────────
//
// Mirror of the discriminated union in
// .flint-context/contracts/BETA-TELEMETRY-WIRING.contract.ts. Adding a new
// event in Glass requires extending this union too — that explicit coupling
// is the privacy contract.

const appLaunchedEvent = z.object({
    name: z.literal('app.launched'),
    payload: z.object({ locale: z.string() }),
})

const appCrashedEvent = z.object({
    name: z.literal('app.crashed'),
    payload: z.object({ message: z.string(), stack: z.string() }),
})

const mcpToolCalledEvent = z.object({
    name: z.literal('mcp.tool_called'),
    payload: z.object({ toolName: z.string() }),
})

const auditCompletedEvent = z.object({
    name: z.literal('audit.completed'),
    payload: z.object({
        fileCount: z.number().nonnegative(),
        violationCount: z.number().nonnegative(),
        durationMs: z.number().nonnegative(),
    }),
})

const sessionEndedEvent = z.object({
    name: z.literal('session.ended'),
    payload: z.object({ durationMs: z.number().nonnegative() }),
})

const telemetryEventSchema = z
    .object({
        id: z.string().min(1),
        ts: z.string().min(1),
        sessionId: z.string().min(1),
        buildId: z.string().min(1),
        appVersion: z.string().min(1),
        platform: z.string().min(1),
    })
    .and(
        z.discriminatedUnion('name', [
            appLaunchedEvent,
            appCrashedEvent,
            mcpToolCalledEvent,
            auditCompletedEvent,
            sessionEndedEvent,
        ]),
    )

const eventBatchSchema = z.object({
    events: z.array(telemetryEventSchema).min(1).max(100),
})

type TelemetryEvent = z.infer<typeof telemetryEventSchema>

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// 14 days. Long enough to spot patterns, short enough to feel privacy-first.
const KV_TTL_SECONDS = 60 * 60 * 24 * 14

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url)

        if (request.method === 'GET' && url.pathname === '/health') {
            return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS })
        }

        if (request.method !== 'POST' || url.pathname !== '/events') {
            return new Response('Not found', { status: 404 })
        }

        // Fail closed: a Worker without a shared secret is an open relay.
        // Refuse to process anything until the operator sets SHARED_SECRET.
        if (!env.SHARED_SECRET || env.SHARED_SECRET.trim() === '') {
            console.error('[flint-telemetry] SHARED_SECRET is not configured — refusing to process requests')
            return new Response('Service unavailable', { status: 503 })
        }

        const provided = request.headers.get('X-Flint-Secret') ?? ''
        if (provided !== env.SHARED_SECRET) {
            return new Response('Unauthorized', { status: 401 })
        }

        let rawBody: unknown
        try {
            rawBody = await request.json()
        } catch {
            return new Response('Invalid JSON', { status: 400 })
        }

        const parsed = eventBatchSchema.safeParse(rawBody)
        if (!parsed.success) {
            // Don't echo Zod's full error tree (it can include attacker-controlled
            // values). Just say which top-level issue blocked the batch.
            const firstIssue = parsed.error.issues[0]
            const reason = firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'invalid payload'
            return new Response(`Invalid event batch (${reason})`, { status: 400 })
        }

        const { events } = parsed.data

        // Persist to KV (fire-and-forget) + forward to Slack (awaited).
        ctx.waitUntil(storeInKV(events, env))

        if (env.SLACK_WEBHOOK_URL) {
            try { await forwardToSlack(events, env.SLACK_WEBHOOK_URL) } catch { /* swallow */ }
        }

        return new Response(JSON.stringify({ received: events.length }), {
            headers: JSON_HEADERS,
        })
    },
}

async function storeInKV(events: TelemetryEvent[], env: Env): Promise<void> {
    // Key format: events:<ts>:<id>. Using the event's own timestamp gives
    // a sortable key you can list chronologically in the KV dashboard.
    await Promise.all(events.map((e) => env.TELEMETRY_KV.put(
        `events:${e.ts}:${e.id}`,
        JSON.stringify(e),
        { expirationTtl: KV_TTL_SECONDS },
    )))
}

async function forwardToSlack(events: TelemetryEvent[], webhookUrl: string): Promise<void> {
    // Compact one-liner per event. Slack rate-limits at 1 message/second per
    // webhook, so we coalesce a batch into a single message.
    //
    // Every dynamic string is wrapped in inline-code (`…`) so Slack treats
    // it as literal text. This neutralises:
    //   • <!channel>, <!here>, <!everyone> broadcast pings
    //   • <@U123|name> user mentions
    //   • <http://evil|click me> link rewrites
    //   • <#C123|chan> channel links
    const lines = events.map(formatEventLine)
    const headerText = `*Flint Beta* — ${events.length} event${events.length === 1 ? '' : 's'}`
    const body = lines.join('\n')

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: headerText,
            blocks: [
                { type: 'section', text: { type: 'mrkdwn', text: headerText } },
                { type: 'section', text: { type: 'mrkdwn', text: body } },
            ],
        }),
    })
}

/**
 * Escape a user-supplied string for safe inclusion inside a Slack inline
 * code span. We strip backticks (which would close the span) and the three
 * Slack control characters `<`, `>`, `&` per Slack's mrkdwn rules.
 */
function escapeForSlackInlineCode(value: string): string {
    return value
        .replace(/`/g, "'")
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function formatEventLine(e: TelemetryEvent): string {
    const short = escapeForSlackInlineCode(e.sessionId.slice(0, 8))
    const name = escapeForSlackInlineCode(e.name)
    const platform = escapeForSlackInlineCode(e.platform)
    const buildId = escapeForSlackInlineCode(e.buildId)
    // Slack code-fence the JSON payload as a block so even @everyone /
    // <!channel> inside payload text renders as literal characters.
    const payloadJson = JSON.stringify(e.payload).slice(0, 200)
    const safePayload = escapeForSlackInlineCode(payloadJson)
    return `• \`${name}\` · \`${platform}\` · build \`${buildId}\` · session \`${short}\` · payload \`${safePayload}\``
}
