/**
 * consensusGateService.ts — V.4 Epistemic Consensus Gate
 *
 * For AST mutations that score Amber or Red on the MRS, this service
 * routes the proposed mutation to a stateless secondary LLM agent for
 * independent safety evaluation before surfacing the approval UI.
 *
 * Key design principles:
 * - Stateless: the secondary agent has zero context about the primary agent's reasoning
 * - Fail-open: any error/timeout produces outcome='error' with proceed=true
 * - Persistent: every evaluation is written to the consensus_records SQLite table
 * - Domain-aware: enabled/disabled per governance domain via policy.json
 */

import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { BRAND } from '../shared/brand.ts'

// ── Per-project consensus database ───────────────────────────────────────────
// Matches the MCP query service pattern: each project gets its own
// .flint/consensus.db so that MCP reads and Electron writes are in the same file.

const dbCache = new Map<string, Database.Database>()

function getDb(projectRoot: string): Database.Database {
    if (dbCache.has(projectRoot)) return dbCache.get(projectRoot)!
    const dir = join(projectRoot, BRAND.configDir)
    mkdirSync(dir, { recursive: true })
    const dbPath = join(dir, 'consensus.db')
    const instance = new Database(dbPath)
    instance.exec(`
        CREATE TABLE IF NOT EXISTS consensus_records (
            id                    TEXT    PRIMARY KEY,
            mutation_id           TEXT,
            tool_name             TEXT    NOT NULL,
            tool_input_json       TEXT    NOT NULL DEFAULT '{}',
            mrs_score             REAL    NOT NULL CHECK (mrs_score >= 0 AND mrs_score <= 1),
            mrs_tier              TEXT    NOT NULL CHECK (mrs_tier IN ('amber', 'red')),
            primary_judgment      TEXT    NOT NULL CHECK (primary_judgment IN ('approve', 'reject', 'abstain')),
            primary_reasoning     TEXT    NOT NULL DEFAULT '',
            primary_confidence    REAL,
            primary_duration_ms   INTEGER NOT NULL DEFAULT 0,
            secondary_judgment    TEXT    NOT NULL CHECK (secondary_judgment IN ('approve', 'reject', 'abstain')),
            secondary_reasoning   TEXT    NOT NULL DEFAULT '',
            secondary_confidence  REAL,
            secondary_duration_ms INTEGER NOT NULL DEFAULT 0,
            outcome               TEXT    NOT NULL CHECK (outcome IN (
                'agree_approve', 'agree_reject', 'disagree', 'error', 'skipped'
            )),
            session_id            TEXT,
            agent_id              TEXT    NOT NULL DEFAULT 'orchestrator',
            domain                TEXT    NOT NULL DEFAULT 'general',
            timestamp             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_consensus_outcome    ON consensus_records(outcome);
        CREATE INDEX IF NOT EXISTS idx_consensus_timestamp  ON consensus_records(timestamp);
        CREATE INDEX IF NOT EXISTS idx_consensus_mrs_tier   ON consensus_records(mrs_tier);
        CREATE INDEX IF NOT EXISTS idx_consensus_session    ON consensus_records(session_id);
        CREATE INDEX IF NOT EXISTS idx_consensus_agent      ON consensus_records(agent_id);
    `)
    dbCache.set(projectRoot, instance)
    return instance
}

// ── Re-export types needed by orchestrator.ts ─────────────────────────────────
export type ConsensusJudgment = 'approve' | 'reject' | 'abstain'
export type ConsensusOutcome = 'agree_approve' | 'agree_reject' | 'disagree' | 'error' | 'skipped'

export interface EvaluatorVerdict {
    evaluator: 'primary' | 'secondary'
    judgment: ConsensusJudgment
    reasoning: string
    confidence: number | null
    durationMs: number
}

export interface ConsensusGateInput {
    toolName: string
    toolInput: Record<string, unknown>
    /** The MRS assessment object from computeMRS() */
    mrs: {
        score: number
        tier: string
        factors?: Record<string, unknown>
    }
    astSnapshot: string
    domain: string
    sessionId?: string
    /** Project root directory — used to open .flint/consensus.db */
    projectRoot: string
}

export interface ConsensusGateResult {
    proceed: boolean
    outcome: ConsensusOutcome
    secondaryVerdict: EvaluatorVerdict
    recordId: string
}

export interface ConsensusConfig {
    enabled: boolean
    minimumTier: 'amber' | 'red'
    timeoutMs: number
    secondaryModel: string
}

// ── Domain defaults ───────────────────────────────────────────────────────────

const DOMAIN_DEFAULTS: Record<string, ConsensusConfig> = {
    general:           { enabled: false, minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-haiku-4-5-20251001' },
    healthcare:        { enabled: true,  minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-haiku-4-5-20251001' },
    fintech:           { enabled: true,  minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-haiku-4-5-20251001' },
    'e-commerce':      { enabled: false, minimumTier: 'red',   timeoutMs: 15000, secondaryModel: 'claude-haiku-4-5-20251001' },
    government:        { enabled: true,  minimumTier: 'amber', timeoutMs: 15000, secondaryModel: 'claude-haiku-4-5-20251001' },
    'enterprise-saas': { enabled: false, minimumTier: 'red',   timeoutMs: 15000, secondaryModel: 'claude-haiku-4-5-20251001' },
}

const FALLBACK_CONFIG: ConsensusConfig = {
    enabled: false,
    minimumTier: 'amber',
    timeoutMs: 15000,
    secondaryModel: 'claude-haiku-4-5-20251001',
}

// ── Secondary agent prompt ────────────────────────────────────────────────────

function buildSystemPrompt(domain: string): string {
    return `You are an independent safety evaluator for the ${BRAND.product} governance system.

Your task: evaluate whether a proposed AST mutation is safe to execute on a UI component.

Domain context: ${domain}

You will receive:
1. The current source code of the file being modified
2. The proposed mutation (tool name and parameters)
3. The Mutation Risk Score (MRS) assessment

You must respond with ONLY a JSON object (no markdown, no code fences):
{
  "judgment": "approve" | "reject",
  "reasoning": "one paragraph explaining your decision",
  "confidence": 0.0-1.0
}

Safety criteria:
- Reject if the mutation would break accessibility (missing alt text, aria-label, role)
- Reject if the mutation would introduce hardcoded colors that violate the design system
- Reject if the mutation would remove required safety attributes (tabIndex, keyboard handlers)
- Reject if the mutation appears to delete critical UI structure without justification
- Approve if the mutation is a reasonable, bounded change with clear intent
- Approve if the MRS factors show primarily low-risk contributors

Be conservative: if in doubt, reject with clear reasoning. You are the last safety check before human review.`
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve the consensus configuration for the current domain.
 * Merges domain defaults with any explicit policy overrides.
 */
export function resolveConfig(
    domain: string,
    policyOverrides?: Partial<ConsensusConfig>,
): ConsensusConfig {
    const base = DOMAIN_DEFAULTS[domain] ?? FALLBACK_CONFIG
    if (!policyOverrides) return base
    return { ...base, ...policyOverrides }
}

/**
 * Determine whether the consensus gate should fire for the given MRS tier.
 */
export function shouldFireGate(
    mrsTier: string,
    config: ConsensusConfig,
): boolean {
    if (!config.enabled) return false
    if (mrsTier === 'red') return true
    if (mrsTier === 'amber' && config.minimumTier === 'amber') return true
    return false
}

/**
 * Run the consensus gate: send the proposed mutation to a secondary agent
 * for independent safety evaluation.
 *
 * Fail-open: any error/timeout produces outcome='error' with proceed=true.
 */
export async function evaluate(input: ConsensusGateInput): Promise<ConsensusGateResult> {
    const recordId = randomUUID()
    const startTime = Date.now()

    // Build the secondary agent's user message
    const userMessage = `Current source code:
\`\`\`tsx
${input.astSnapshot}
\`\`\`

Proposed mutation:
- Tool: ${input.toolName}
- Parameters: ${JSON.stringify(input.toolInput, null, 2)}

MRS Assessment:
- Score: ${input.mrs.score.toFixed(3)} (${input.mrs.tier.toUpperCase()} tier)
- Factors: ${JSON.stringify(input.mrs.factors ?? {}, null, 2)}

Evaluate whether this mutation is safe to execute.`

    let secondaryVerdict: EvaluatorVerdict
    let outcome: ConsensusOutcome

    try {
        // Get API key from environment (same pattern as orchestrator.ts)
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not set')
        }

        const client = new Anthropic({ apiKey })
        const config = resolveConfig(input.domain)

        // Race: secondary agent vs timeout
        const response = await Promise.race([
            client.messages.create({
                model: config.secondaryModel,
                max_tokens: 512,
                system: buildSystemPrompt(input.domain),
                messages: [{ role: 'user', content: userMessage }],
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('consensus_timeout')), config.timeoutMs),
            ),
        ])

        const durationMs = Date.now() - startTime
        const rawText = response.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join('')
            .trim()

        // Parse the JSON response
        const parsed = JSON.parse(rawText) as {
            judgment: ConsensusJudgment
            reasoning: string
            confidence: number
        }

        if (!['approve', 'reject'].includes(parsed.judgment)) {
            throw new Error(`invalid judgment: ${parsed.judgment}`)
        }

        secondaryVerdict = {
            evaluator: 'secondary',
            judgment: parsed.judgment,
            reasoning: parsed.reasoning ?? '',
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
            durationMs,
        }

        // Primary verdict is inferred: if MRS is amber/red, primary approved (it passed MRS)
        const primaryJudgment: ConsensusJudgment = 'approve'

        if (primaryJudgment === parsed.judgment) {
            outcome = parsed.judgment === 'approve' ? 'agree_approve' : 'agree_reject'
        } else {
            outcome = 'disagree'
        }
    } catch (err) {
        const durationMs = Date.now() - startTime
        const isTimeout = err instanceof Error && err.message === 'consensus_timeout'

        secondaryVerdict = {
            evaluator: 'secondary',
            judgment: 'abstain',
            reasoning: isTimeout
                ? 'Secondary agent evaluation timed out.'
                : `Secondary agent error: ${err instanceof Error ? err.message : String(err)}`,
            confidence: null,
            durationMs,
        }
        outcome = isTimeout ? 'skipped' : 'error'
    }

    // Persist to SQLite (Commandment 12)
    const primaryVerdict: EvaluatorVerdict = {
        evaluator: 'primary',
        judgment: 'approve',
        reasoning: 'Primary agent proposed this mutation (passed MRS gating).',
        confidence: null,
        durationMs: 0,
    }

    persistRecord({
        id: recordId,
        mutationId: null,
        toolName: input.toolName,
        toolInputJson: JSON.stringify(input.toolInput),
        mrsScore: input.mrs.score,
        mrsTier: input.mrs.tier as 'amber' | 'red',
        primaryVerdict,
        secondaryVerdict,
        outcome,
        sessionId: input.sessionId ?? null,
        agentId: 'orchestrator',
        domain: input.domain,
        projectRoot: input.projectRoot,
    })

    // Fail-open: error/skipped => proceed; agree_reject => do not proceed
    const proceed = outcome !== 'agree_reject'

    return { proceed, outcome, secondaryVerdict, recordId }
}

/**
 * Persist a consensus record to the consensus_records SQLite table.
 * Exported for testing.
 */
export function persistRecord(record: {
    id: string
    mutationId: string | null
    toolName: string
    toolInputJson: string
    mrsScore: number
    mrsTier: 'amber' | 'red'
    primaryVerdict: EvaluatorVerdict
    secondaryVerdict: EvaluatorVerdict
    outcome: ConsensusOutcome
    sessionId: string | null
    agentId: string
    domain: string
    projectRoot: string
}): void {
    const stmt = getDb(record.projectRoot).prepare(`
        INSERT INTO consensus_records (
            id, mutation_id, tool_name, tool_input_json,
            mrs_score, mrs_tier,
            primary_judgment, primary_reasoning, primary_confidence, primary_duration_ms,
            secondary_judgment, secondary_reasoning, secondary_confidence, secondary_duration_ms,
            outcome, session_id, agent_id, domain
        ) VALUES (
            @id, @mutationId, @toolName, @toolInputJson,
            @mrsScore, @mrsTier,
            @primaryJudgment, @primaryReasoning, @primaryConfidence, @primaryDurationMs,
            @secondaryJudgment, @secondaryReasoning, @secondaryConfidence, @secondaryDurationMs,
            @outcome, @sessionId, @agentId, @domain
        )
    `)

    stmt.run({
        id: record.id,
        mutationId: record.mutationId,
        toolName: record.toolName,
        toolInputJson: record.toolInputJson,
        mrsScore: record.mrsScore,
        mrsTier: record.mrsTier,
        primaryJudgment: record.primaryVerdict.judgment,
        primaryReasoning: record.primaryVerdict.reasoning,
        primaryConfidence: record.primaryVerdict.confidence,
        primaryDurationMs: record.primaryVerdict.durationMs,
        secondaryJudgment: record.secondaryVerdict.judgment,
        secondaryReasoning: record.secondaryVerdict.reasoning,
        secondaryConfidence: record.secondaryVerdict.confidence,
        secondaryDurationMs: record.secondaryVerdict.durationMs,
        outcome: record.outcome,
        sessionId: record.sessionId,
        agentId: record.agentId,
        domain: record.domain,
    })
}
