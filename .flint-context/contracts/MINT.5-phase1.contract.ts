/**
 * MINT.5 Phase 1 — Mint Surface Foundation
 * Executable Contract
 *
 * Phase: MINT.5 (Phase 1 of 4)
 * Status: APPROVED
 * Date: 2026-04-17
 * Binds against: .flint-context/reviews/mint-{ux,code,security}-review-2026-04-17.md
 *
 * Phase 2 agents import these types directly. No implementation lives here.
 * This file must compile cleanly with `npx tsc --noEmit`.
 *
 * Scope: security hardening (sanitizer + path + project-root + emitter escape),
 * drift re-enable, canonical health score in Mint, shared severity chip,
 * dual-queue (MCP + Glass) approval push channel.
 *
 * Explicit non-goals: TokenPanel deletion (UX C2), hasMultipleModes placeholder (M1),
 * sync action buttons (A2), emit dropdown (A3), detail-panel impact embed (A5),
 * read-only identity banner (A6), ApprovalStagingArea collapse (A7), aria-live
 * sync announcements (A9). See contract .md for full list.
 */

import type { FlintContract } from '../../shared/contract-schema.js'
import type { HealthGrade, HealthScoreInput } from '../../shared/healthScore.js'
import type { SanitizeReasonResult } from '../../shared/reasonSanitizer.js'

// ─── Sanitizer API ─────────────────────────────────────────────────────────────

/**
 * Absolute upper bound on stored token_value length. Mirror of
 * CHRON.1's REASON_MAX_LENGTH shape.
 */
export const TOKEN_VALUE_MAX_LENGTH = 1000 as const

/**
 * Absolute upper bound on stored description length. Descriptions are free
 * text and can legitimately be longer than token values (migration notes,
 * usage hints, etc.).
 */
export const TOKEN_DESCRIPTION_MAX_LENGTH = 4096 as const

/**
 * Sanitizer version stamped into `_report.json` headers produced by emitters.
 * Bump on every material change to sanitize() behavior so emitter output is
 * traceable to the sanitizer revision that produced it.
 */
export const SANITIZER_VERSION = 'mint5.1.0' as const

/**
 * The canonical set of token-type categories understood by the shape-allowlist
 * validator. Matches the DTCG subset Flint already emits.
 */
export type TokenShapeCategory =
    | 'color'
    | 'dimension'
    | 'fontFamily'
    | 'fontWeight'
    | 'fontSize'
    | 'lineHeight'
    | 'letterSpacing'
    | 'shadow'
    | 'opacity'
    | 'string'
    | 'boolean'

/**
 * Result shape returned by sanitizeTokenValue. Callers (and tests) read the
 * `rejected` flag before writing to SQLite / disk. `sanitized: null` means
 * post-sanitize content is empty — caller treats it the same as rejected.
 */
export interface SanitizeTokenValueResult {
    /** The sanitized value, or null when post-sanitize content is empty. */
    sanitized: string | null
    /** True when the value fails the per-type shape allowlist. */
    rejected: boolean
    /** Human-readable rejection reason, null when not rejected. */
    rejectionReason: string | null
    /** True if the input was truncated at TOKEN_VALUE_MAX_LENGTH. */
    truncated: boolean
    /** True if one or more secret patterns were redacted. */
    redacted: boolean
    /** True if control or format characters (\p{Cc}, \p{Cf}) were stripped. */
    strippedControlChars: boolean
}

/**
 * Sanitize a single token_value against the CHRON.1 ingress bar
 * (length cap → control/format strip → secret redaction → trim)
 * plus a per-type shape allowlist. Pure function — no I/O.
 *
 * Rejection is loud (caller decides what to surface); sanitization is silent.
 *
 * Implementation lives in shared/tokenValueSanitizer.ts.
 */
export type SanitizeTokenValueFn = (
    value: unknown,
    tokenType: TokenShapeCategory,
) => SanitizeTokenValueResult

/**
 * Sanitize a token description. Reuses CHRON.1's SanitizeReasonResult shape
 * because descriptions and reasons share the same threat model (free text,
 * may leak secrets, audit-log readable).
 *
 * Length cap: TOKEN_DESCRIPTION_MAX_LENGTH.
 */
export type SanitizeTokenDescriptionFn = (value: unknown) => SanitizeReasonResult

// ─── Path Validator ────────────────────────────────────────────────────────────

/**
 * Extracted from electron/main.ts:1115. Moving it into shared/tokenPath.ts so
 * every writer (Electron, web server, MCP sync/extract, ingestion server)
 * binds to ONE regex. Phase 1.5 lint: reject re-declarations anywhere else.
 *
 * Pattern: dot-separated identifier segments; each segment must start with
 * a letter and contain only [a-zA-Z0-9_-]. Rejects __proto__, constructor,
 * prototype, empty segments, whitespace, Unicode.
 */
export const SAFE_TOKEN_PATH_RE: RegExp = /^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z][a-zA-Z0-9_-]*)*$/

export class TokenPathValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'TokenPathValidationError'
    }
}

/**
 * Validate and return a token path. Throws TokenPathValidationError on failure
 * so callers can surface structured errors to the IPC boundary.
 *
 * Implementation lives in shared/tokenPath.ts.
 */
export type ValidateTokenPathFn = (raw: unknown) => string

/**
 * MCP-side projectRoot validator. Mirrors shared/validateFilePath with
 * allowedExtensions=[] (directory) and no self-host check (MCP runs
 * outside the Flint source tree by design).
 *
 * Implementation lives in shared/tokenPath.ts (grouped with path semantics).
 */
export type ValidateProjectRootFn = (raw: unknown, homeDir: string) => string

// ─── Emitter Egress Escape ─────────────────────────────────────────────────────

/**
 * Pure string-transform helpers used by each emitter to escape user-controlled
 * token values before they are interpolated into the target language literal.
 *
 * Each function takes the raw value and returns the escaped representation
 * WITHOUT surrounding quote characters (callers add quotes). This matches the
 * existing emitter pattern where the emitter controls quote placement.
 *
 * Implementation lives in flint-mcp/src/core/emitters/escape.ts.
 */
export interface EmitterEscapeHelpers {
    // CSS value escape. Blocks:
    //   - declaration breakout: close-brace and comment-close sequence
    //   - url(javascript:...) / expression(...) via scheme allowlist on url()
    //   - backslash double-escape
    //   - newline / CR (collapsed to space)
    //   - bidi override chars (stripped)
    escapeCssValue(raw: string): string

    // Swift string-literal escape:
    //   - double-quote -> backslash double-quote
    //   - backslash -> double backslash
    //   - backslash open-paren (Swift string interpolation) -> escaped literal
    //   - triple-quote sequence -> fallback to normal escape
    //   - CR/LF -> \n / \r
    escapeSwiftStringLiteral(raw: string): string

    // Kotlin string-literal escape:
    //   - double-quote -> backslash double-quote
    //   - backslash -> double backslash
    //   - dollar-sign -> backslash dollar-sign (blocks Kotlin $identifier template)
    //   - dollar-sign open-brace -> escaped literal (blocks Kotlin ${expr} template)
    //   - triple-quote sequence -> fallback to normal escape
    //   - CR/LF -> \n / \r
    escapeKotlinStringLiteral(raw: string): string

    // TypeScript string-literal escape, used by both Tailwind and React Native
    // emitters (they both produce TypeScript output). Extends the current
    // tailwindEmitter.escapeValue (only backslash and single-quote) with:
    //   - double-quote -> backslash double-quote
    //   - newline -> \n
    //   - CR -> \r
    //   - tab -> \t
    //   - bidi/control char strip
    escapeTypescriptStringLiteral(raw: string): string
}

// ─── Drift IPC ────────────────────────────────────────────────────────────────

/**
 * Single drift row returned by the new tokens:read-figma-drift IPC.
 *
 * `tokenName` is the dot-separated token path (matches DesignToken.token_path).
 * `localValue` is the value currently stored in the project's design_tokens.
 * `figmaValue` is the value currently declared in .flint/figma-tokens.json.
 * `deltaE` is CIEDE2000 perceptual distance for color tokens (undefined
 * for non-color types — Phase 2 may threshold > 2.0 to amber the pill).
 *
 * Empty array from the IPC means "no drift detected" OR "figma-tokens.json
 * is missing". Callers treat both as "no drift" — the distinction is not
 * surfaced in Phase 1.
 */
export interface TokenDrift {
    tokenName: string
    localValue: string
    figmaValue: string
    deltaE?: number
}

/**
 * IPC signature for the new channel. Renderer → main, no payload, returns
 * the full drift array resolved main-side. Supersedes the disabled
 * .flint/figma-tokens.json readFile path in useTokenUsage.
 */
export type ReadFigmaDriftIPC = () => Promise<TokenDrift[]>

// ─── Dual-Queue Push Channel ───────────────────────────────────────────────────

/**
 * The source that approved a token. Differentiates so ApprovalStagingArea
 * can (in future phases) show a flash on the Glass-side row being cleared
 * by an MCP-side approval, vs. the user clicking Approve directly.
 */
export type TokenApprovedSource = 'glass' | 'mcp'

/**
 * Event body broadcast on the new governance:on-token-approved channel.
 * Listener signature matches the existing window.flintAPI.figma.onConnected
 * pattern so the web adapter mirror is trivial.
 */
export interface TokenApprovedEvent {
    tokenName: string
    source: TokenApprovedSource
    /** Unix epoch milliseconds. */
    timestamp: number
}

export type TokenApprovedListener = (event: TokenApprovedEvent) => void

/** Returned by onTokenApproved for useEffect cleanup. */
export type UnsubscribeFn = () => void

/**
 * Method to add to the TokensAPI (window.flintAPI.tokens) surface.
 * Implementation in electron/preload.ts, mirrored in src/adapters/web-api.ts.
 */
export type OnTokenApprovedMethod = (
    callback: TokenApprovedListener,
) => UnsubscribeFn

// ─── Token Health Hook ────────────────────────────────────────────────────────

/**
 * Pre-bucketed counts surfaced to UI for the breakdown row. Mirrors the
 * structure Counsel already consumes for CompactScoreSummary.
 */
export interface TokenHealthBuckets {
    /** Dead tokens (zero usage across project). Penalty: advisory ×1. */
    dead: number
    /** Drifted tokens (figma vs. local mismatch). Penalty: amber ×3. */
    drifted: number
    /** Scale gaps (detected in dimension / typography scales). Penalty: advisory ×1. */
    scaleGaps: number
    /** Contrast failures from auditContrast. Penalty: critical ×10. */
    contrastFails: number
    /** Pending approval queue entries that have a drift warning. Penalty: amber ×3. */
    pendingConflicts: number
}

/**
 * Return shape of useTokenHealth. `input` is exported for debugging and test
 * assertions — not intended for rendering.
 */
export interface TokenHealthData {
    score: number
    grade: HealthGrade
    buckets: TokenHealthBuckets
    input: HealthScoreInput
}

/** Hook signature. Implementation in src/hooks/useTokenHealth.ts. */
export type UseTokenHealthHook = () => TokenHealthData

// ─── Severity Chip ────────────────────────────────────────────────────────────

/**
 * Counsel's canonical severity vocabulary. Extending Mint to match so both
 * surfaces share one language. Phase 1 scope: replace Mint ad-hoc colored
 * pills in TokenHealthBar + TokenGrid only. Counsel is NOT refactored in
 * Phase 1 (do not break existing Counsel tests).
 */
export type ChipSeverity = 'critical' | 'amber' | 'advisory'

/**
 * SeverityChip props. The component lives at
 * src/components/ui/governance/SeverityChip.tsx and is consumed by both
 * surfaces.
 */
export interface SeverityChipProps {
    severity: ChipSeverity
    /** Short descriptive label ("dead", "drifted", "contrast fails"). */
    label: string
    /** Count to render alongside the label. Omit for boolean states. */
    count?: number
    /** Optional leading icon. The chip provides its own severity dot otherwise. */
    icon?: React.ReactNode
    /** Test id for data-testid. */
    'data-testid'?: string
    /** a11y override; default computed as `${count} ${severity} ${label}`. */
    'aria-label'?: string
}

// ─── IPC Payload Contracts (new + modified) ───────────────────────────────────

/**
 * Existing tokens:create payload. Phase 1 does not change the shape — it
 * changes what the handler does with it (sanitize + validate + reject).
 * Documented here for completeness so Phase 2 agents see the full ingress
 * set at one glance.
 */
export interface TokensCreatePayload {
    token_path: string
    token_type: string
    token_value: string
    description?: string
    mode?: string
    collection_name?: string
}

export interface TokensCreateResponse {
    id: number | bigint
}

/**
 * Existing tokens:update handler is variadic: (tokenPath, updates).
 * The updates object has optional fields. Phase 1 wires sanitization for
 * token_value and description, and validateTokenPath on tokenPath.
 */
export interface TokensUpdatePayload {
    token_type?: string
    token_value?: string
    description?: string
}

export interface TokensUpdateResponse {
    changes: number | bigint
}

// ─── Contract Metadata ─────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'MINT.5-phase1-MintFoundation',
        phase: 'MINT.5.1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-17',
    },
    impact: [
        // 1.1 — Sanitization foundation (NEW)
        { file: 'shared/tokenValueSanitizer.ts', changeType: 'CREATE', owner: 'flint-ast-surgeon', summary: 'Port of reasonSanitizer pattern with per-type shape allowlist and per-emitter escape helpers' },
        { file: 'shared/tokenPath.ts', changeType: 'CREATE', owner: 'flint-ast-surgeon', summary: 'SAFE_TOKEN_PATH_RE + validateTokenPath + validateProjectRoot (single source of truth)' },
        { file: 'flint-mcp/src/core/emitters/escape.ts', changeType: 'CREATE', owner: 'flint-ast-surgeon', summary: 'Per-target string-literal escape helpers (CSS, Swift, Kotlin, TypeScript)' },
        { file: 'shared/__tests__/tokenValueSanitizer.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: '60-value fuzz harness + shape-allowlist tests' },
        { file: 'shared/__tests__/tokenPath.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Prototype pollution + unicode + oversized path tests' },

        // 1.1 — Sanitization application (MODIFY)
        { file: 'electron/main.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'tokens:create/update sanitize + validate; new tokens:read-figma-drift handler; broadcastTokenApproved helper' },
        { file: 'server/index.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Web-parity mirror of all main.ts changes (sanitize + drift IPC + token-approved broadcast)' },
        { file: 'electron/ingestion-server.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'batchUpsertTokens applies sanitizer before upsertToken.run; rejected entries logged in Heal summary' },
        { file: 'flint-mcp/src/tools/extractTokens.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Sanitize + validateTokenPath + validateProjectRoot; emit token-approved event on merge success' },
        { file: 'flint-mcp/src/tools/emitTokens.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'validateProjectRoot at entry; _report.json gains sanitizerVersion + emittedAt + toolVersion header' },
        { file: 'flint-mcp/src/tools/mapTokens.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'validateProjectRoot + outputPath extension allowlist' },
        { file: 'flint-mcp/src/core/sync/tokenSyncEngine.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'executePull sanitizes remoteValue; rejected values become conflicts (not auto-merges)' },
        { file: 'flint-mcp/src/core/sync/tokenFileIO.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Apply sanitizer to every $value before JSON.stringify' },
        { file: 'flint-mcp/src/core/emitters/cssEmitter.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'formatCSSValue routes through escapeCssValue; comment sections escape paths' },
        { file: 'flint-mcp/src/core/emitters/tailwindEmitter.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Replace escapeValue with escapeTypescriptStringLiteral (full TS literal escape)' },
        { file: 'flint-mcp/src/core/emitters/swiftEmitter.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Wrap all string-interpolation sites in escapeSwiftStringLiteral' },
        { file: 'flint-mcp/src/core/emitters/kotlinEmitter.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Wrap all string-interpolation sites in escapeKotlinStringLiteral ($ + ${ escape)' },
        { file: 'flint-mcp/src/core/emitters/reactNativeEmitter.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Wrap all string-interpolation sites in escapeTypescriptStringLiteral' },

        // 1.2 — Drift re-enable (MODIFY)
        { file: 'electron/preload.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Expose tokens.readFigmaDrift + tokens.onTokenApproved' },
        { file: 'src/adapters/web-api.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Web adapter mirrors readFigmaDrift + onTokenApproved (WS event)' },
        { file: 'shared/ipc-validators.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Add Zod schema for tokens:read-figma-drift' },
        { file: 'src/types/flint-api.d.ts', changeType: 'MODIFY', owner: 'flint-state-architect', summary: 'Add readFigmaDrift / onTokenApproved to TokensAPI; export TokenDrift + TokenApprovedEvent' },
        { file: 'src/hooks/useTokenUsage.ts', changeType: 'MODIFY', owner: 'flint-state-architect', summary: 'Re-enable drift via new IPC; drop unused localTokens param + setDriftedTokens no-op' },

        // 1.3 — Canonical health score (CREATE + MODIFY)
        { file: 'src/hooks/useTokenHealth.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'New hook: buckets token counts → computeHealthScore → {score, grade, buckets}' },
        { file: 'src/components/ui/TokenHealthBar.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Render HealthGradePill + SeverityChips; delete redundant syncStatuses-based drift pill (lines 82-98)' },
        { file: 'src/components/ui/TokenManager.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Consume useTokenHealth; pass health to <TokenHealthBar>; resolve isUsageScanning unused var' },
        { file: 'src/hooks/__tests__/useTokenHealth.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Bucket mapping correctness + grade bands' },

        // 1.4 — Severity grammar (CREATE + MODIFY)
        { file: 'src/components/ui/governance/SeverityChip.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Shared severity chip for Counsel + Mint' },
        { file: 'src/components/ui/governance/__tests__/SeverityChip.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Render per severity + a11y + count pluralization' },
        { file: 'src/components/ui/TokenGrid.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Replace ad-hoc severity pills with <SeverityChip>' },

        // 1.5 — Dual-queue listener (MODIFY)
        { file: 'src/components/ui/ApprovalStagingArea.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Subscribe to onTokenApproved; clear local row state on matching event' },
        { file: 'src/components/ui/__tests__/ApprovalStagingArea.test.tsx', changeType: 'MODIFY', owner: 'flint-test-writer', summary: 'Chat-path approval clears row without UI click' },
    ],
    ipc: [
        {
            channel: 'tokens:read-figma-drift',
            direction: 'renderer\u2192main',
            payloadType: 'undefined',
            returnType: 'TokenDrift[]',
            handler: 'electron/main.ts + server/index.ts',
        },
        {
            channel: 'governance:on-token-approved',
            direction: 'main\u2192renderer',
            payloadType: 'n/a (push channel)',
            returnType: 'TokenApprovedEvent',
            handler: 'electron/main.ts (broadcastTokenApproved helper)',
        },
        {
            channel: 'tokens:create',
            direction: 'renderer\u2192main',
            payloadType: 'TokensCreatePayload',
            returnType: 'TokensCreateResponse',
            handler: 'electron/main.ts:760 + server/index.ts:762 (MODIFIED — adds sanitization)',
        },
        {
            channel: 'tokens:update',
            direction: 'renderer\u2192main',
            payloadType: '(tokenPath: string, updates: TokensUpdatePayload)',
            returnType: 'TokensUpdateResponse',
            handler: 'electron/main.ts:794 + server/index.ts:791 (MODIFIED — adds sanitization)',
        },
        {
            channel: 'tokens:approve-token',
            direction: 'renderer\u2192main',
            payloadType: 'tokenName: string',
            returnType: '{ ok: boolean }',
            handler: 'electron/main.ts:1117 (MODIFIED — broadcasts governance:on-token-approved on success)',
        },
    ],
    stores: [],
    components: [
        {
            name: 'SeverityChip',
            file: 'src/components/ui/governance/SeverityChip.tsx',
            propsType: 'SeverityChipProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'TokenHealthBar',
            file: 'src/components/ui/TokenHealthBar.tsx',
            propsType: 'TokenHealthBarProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'ApprovalStagingArea',
            file: 'src/components/ui/ApprovalStagingArea.tsx',
            propsType: 'ApprovalStagingAreaProps',
            consumesStores: [],
            emitsIPC: ['governance:on-token-approved'],
        },
        {
            name: 'TokenGrid',
            file: 'src/components/ui/TokenGrid.tsx',
            propsType: 'TokenGridProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'TokenManager',
            file: 'src/components/ui/TokenManager.tsx',
            propsType: 'TokenManagerProps',
            consumesStores: ['tokenStore'],
            emitsIPC: [],
        },
    ],
    commandments: [1, 4, 5, 9, 12, 13, 14],
    testBoundaries: [
        // ── Sanitizer ────────────────────────────────────────────────────────
        {
            target: 'sanitizeTokenValue',
            kind: 'service',
            behavior: 'Rejects token values exceeding TOKEN_VALUE_MAX_LENGTH',
            assertion: 'sanitizeTokenValue("x".repeat(5000), "string").truncated === true && result.sanitized.length <= TOKEN_VALUE_MAX_LENGTH',
            edgeCases: ['Exactly 1000 chars passes untruncated', 'Input of 1001 chars is truncated to 1000'],
        },
        {
            target: 'sanitizeTokenValue',
            kind: 'service',
            behavior: 'Strips bidi override chars from input',
            assertion: 'sanitizeTokenValue("#ff0000\\u202Ebeef", "color").sanitized does not contain \\u202E',
            edgeCases: ['\\u202D (LRO) also stripped', '\\u0000 NUL byte stripped'],
        },
        {
            target: 'sanitizeTokenValue',
            kind: 'service',
            behavior: 'Redacts Anthropic API key embedded in description',
            assertion: 'sanitizeTokenDescription("token from sk-ant-api03-xyz...").sanitized contains "[REDACTED]"',
            edgeCases: ['ghp_ tokens redacted', 'AKIA AWS keys redacted', 'high-entropy strings redacted'],
        },
        {
            target: 'sanitizeTokenValue color allowlist',
            kind: 'service',
            behavior: 'Accepts valid CSS color values',
            assertion: '["#f00", "#ff0000", "rgb(255,0,0)", "hsl(0 100% 50%)", "transparent", "oklch(0.5 0.2 30)"].every(v => !sanitizeTokenValue(v, "color").rejected)',
            edgeCases: ['currentColor passes', 'Named colors pass (e.g., "red")'],
        },
        {
            target: 'sanitizeTokenValue color allowlist',
            kind: 'service',
            behavior: 'Rejects CSS breakout sequences in color values',
            assertion: '["red; } body {", "url(javascript:0)", "expression(alert(1))"].every(v => sanitizeTokenValue(v, "color").rejected)',
            edgeCases: ['Value with trailing /* */ rejected', 'Value containing } rejected'],
        },
        {
            target: 'sanitizeTokenValue dimension allowlist',
            kind: 'service',
            behavior: 'Accepts valid CSS dimensions',
            assertion: '["16px", "1.5rem", "0", "50%", "2em"].every(v => !sanitizeTokenValue(v, "dimension").rejected)',
            edgeCases: ['"16px; }" rejected (breakout)', 'Negative values accepted ("-4px")'],
        },
        {
            target: 'tokenValueSanitizer fuzz harness',
            kind: 'service',
            behavior: '60-value fuzz never produces output containing original breakout sequences',
            assertion: 'For every fuzz input, sanitized output does not contain any of: \\u202E, \\u202D, \\u0000, "}", "*/", "${", "\\(", "url(javascript"',
            edgeCases: ['Oversized values truncate; output length <= TOKEN_VALUE_MAX_LENGTH'],
        },

        // ── Path validator ───────────────────────────────────────────────────
        {
            target: 'validateTokenPath',
            kind: 'service',
            behavior: 'Returns valid dot-separated identifier paths',
            assertion: 'validateTokenPath("colors.primary.500") === "colors.primary.500"',
            edgeCases: ['Single-segment path "colors" passes'],
        },
        {
            target: 'validateTokenPath',
            kind: 'service',
            behavior: 'Rejects prototype pollution vectors',
            assertion: '["__proto__.x", "constructor", "x.prototype.y"].every(p => throws TokenPathValidationError)',
            edgeCases: ['Nested __proto__ ("x.__proto__") rejected', 'Case-insensitive not applicable — constructor with lowercase only'],
        },
        {
            target: 'validateTokenPath',
            kind: 'service',
            behavior: 'Rejects malformed paths',
            assertion: '["colors .primary", "colors.", ".colors", "", "1colors"].every(p => throws)',
            edgeCases: ['Whitespace in segment rejected', 'Trailing dot rejected', 'Leading digit rejected', 'Non-string input throws'],
        },
        {
            target: 'validateProjectRoot',
            kind: 'service',
            behavior: 'Rejects paths outside user home directory',
            assertion: 'validateProjectRoot("/etc/passwd", "/Users/user") throws FilePathValidationError',
            edgeCases: ['Path inside home passes', 'Symlink escape rejected'],
        },

        // ── Emitter escape ──────────────────────────────────────────────────
        {
            target: 'escapeCssValue',
            kind: 'service',
            behavior: 'Neutralizes CSS declaration breakout',
            assertion: 'escapeCssValue("#f00; } body { background: red") does not contain literal "}" or literal "{"',
            edgeCases: ['url(javascript:) neutralized', 'expression() neutralized', '*/ comment-close neutralized'],
        },
        {
            target: 'escapeSwiftStringLiteral',
            kind: 'service',
            behavior: 'Neutralizes Swift string interpolation and literal breakout',
            assertion: 'escapeSwiftStringLiteral(\'Inter")\\nexit(1)\') contains \\" and \\\\(',
            edgeCases: ['\\( (interpolation) escaped to \\\\(', 'Triple-quote sequence escaped'],
        },
        {
            target: 'escapeKotlinStringLiteral',
            kind: 'service',
            behavior: 'Neutralizes Kotlin $ and ${ templates',
            assertion: 'escapeKotlinStringLiteral("Inter${x}") contains "\\\\$" (escaped dollar)',
            edgeCases: ['Single $identifier escaped', '${expr} escaped'],
        },
        {
            target: 'cssEmitter',
            kind: 'service',
            behavior: 'Output contains no unescaped breakout from malicious token value',
            assertion: 'cssEmitter.emit([{ token_value: "#f00; } :root { background:url(javascript:0) } /*", ... }]).code has exactly one :root block',
            edgeCases: ['Brace count balanced', 'No unescaped url(javascript:'],
        },
        {
            target: 'swiftEmitter',
            kind: 'service',
            behavior: 'Font family containing quote does not break Swift string literal',
            assertion: 'swiftEmitter.emit([{ token_value: \'Inter")\\nexit(1)//\', token_type: "fontFamily", ... }]).code line parseable by Swift',
            edgeCases: [],
        },
        {
            target: 'kotlinEmitter',
            kind: 'service',
            behavior: 'Font family containing template does not execute interpolation',
            assertion: 'kotlinEmitter.emit([{ token_value: "Inter${System.exit(0)}", ... }]).code contains literal "\\\\$"',
            edgeCases: [],
        },

        // ── IPC sanitization wiring ─────────────────────────────────────────
        {
            target: 'tokens:create',
            kind: 'ipc-handler',
            behavior: 'Rejects oversized token_value',
            assertion: 'await handler({ token_path: "x", token_type: "string", token_value: "a".repeat(5000) }) throws',
            edgeCases: ['Exactly 1000 chars passes', 'Web server handler produces identical rejection'],
        },
        {
            target: 'tokens:create',
            kind: 'ipc-handler',
            behavior: 'Rejects invalid token_path',
            assertion: 'await handler({ token_path: "__proto__.x", ... }) throws TokenPathValidationError',
            edgeCases: [],
        },
        {
            target: 'tokens:update',
            kind: 'ipc-handler',
            behavior: 'Sanitizes token_value in updates map',
            assertion: 'After update with bidi-laden value, SELECT token_value returns stripped value',
            edgeCases: [],
        },
        {
            target: 'tokens:create parity',
            kind: 'ipc-handler',
            behavior: 'Electron and web handlers produce identical rejection shape',
            assertion: 'Electron error.message === web server error.message for identical malformed input',
            edgeCases: [],
        },
        {
            target: 'tokenSyncEngine.executePull',
            kind: 'service',
            behavior: 'Creates conflict instead of auto-merging rejected remote value',
            assertion: 'After executePull with remoteValue "#f00; }" → conflictSvc.createConflict called, localTokens.set NOT called',
            edgeCases: ['Clean remote value still auto-merges'],
        },
        {
            target: 'handleEmitTokens',
            kind: 'service',
            behavior: 'Rejects projectRoot outside home',
            assertion: 'handleEmitTokens({ projectRoot: "/etc" }) returns isError: true',
            edgeCases: ['projectRoot inside home passes'],
        },
        {
            target: 'handleMapTokens',
            kind: 'service',
            behavior: 'Rejects outputPath with disallowed extension',
            assertion: 'handleMapTokens({ outputPath: "/tmp/token.exe" }) returns isError: true',
            edgeCases: ['.ts / .js / .css / .json / .scss pass'],
        },
        {
            target: '_report.json header',
            kind: 'service',
            behavior: 'Report includes sanitizer version + emittedAt + toolVersion',
            assertion: 'JSON.parse(_report.json).header.sanitizerVersion === SANITIZER_VERSION',
            edgeCases: [],
        },

        // ── Drift IPC ───────────────────────────────────────────────────────
        {
            target: 'tokens:read-figma-drift',
            kind: 'ipc-handler',
            behavior: 'Returns empty array when figma-tokens.json is missing',
            assertion: 'await handler() === []',
            edgeCases: ['Invalid JSON returns [] with warn log, does NOT throw'],
        },
        {
            target: 'tokens:read-figma-drift',
            kind: 'ipc-handler',
            behavior: 'Returns drift row per differing token with CIEDE2000 ΔE for colors',
            assertion: 'result[0] has tokenName + localValue + figmaValue + deltaE (color only)',
            edgeCases: ['Non-color token rows have deltaE undefined', 'Identical local/figma values produce empty array'],
        },
        {
            target: 'useTokenUsage',
            kind: 'hook',
            behavior: 'Drift IPC called exactly once per tokenCount change',
            assertion: 'Rendering with tokenCount=5 invokes readFigmaDrift once; re-render with same count does not re-invoke',
            edgeCases: ['Unmount during in-flight call does not setState (mountedRef guard)'],
        },

        // ── Token health hook ───────────────────────────────────────────────
        {
            target: 'useTokenHealth',
            kind: 'hook',
            behavior: 'Returns score 100 grade A with all buckets empty',
            assertion: 'result.score === 100 && result.grade === "A"',
            edgeCases: [],
        },
        {
            target: 'useTokenHealth',
            kind: 'hook',
            behavior: 'Contrast fail contributes to critical bucket',
            assertion: '1 contrastFail → input.criticalCount === 1 && score === 90',
            edgeCases: ['2 contrast fails + 3 drifted → score === 71, grade === "C"'],
        },
        {
            target: 'useTokenHealth',
            kind: 'hook',
            behavior: 'Dead tokens map to advisory (not critical)',
            assertion: '10 dead tokens → input.advisoryCount >= 10 && grade === "A"',
            edgeCases: [],
        },

        // ── Severity chip ───────────────────────────────────────────────────
        {
            target: 'SeverityChip',
            kind: 'component',
            behavior: 'Critical severity uses red palette',
            assertion: 'getByTestId("severity-chip").className contains "red-400"',
            edgeCases: ['Amber uses amber-400', 'Advisory uses zinc palette'],
        },
        {
            target: 'SeverityChip',
            kind: 'component',
            behavior: 'Default aria-label combines count, severity, label',
            assertion: 'getByLabelText(/3 critical contrast fails/i) is in the document',
            edgeCases: ['aria-label prop overrides default', 'count undefined hides numeric prefix'],
        },

        // ── Dual-queue listener ─────────────────────────────────────────────
        {
            target: 'governance:on-token-approved',
            kind: 'ipc-handler',
            behavior: 'Broadcasts after successful tokens:approve-token',
            assertion: 'After approve-token resolves, all BrowserWindows received governance:on-token-approved with matching tokenName + source="glass"',
            edgeCases: ['Broadcast suppressed when approve-token returns { ok: false }'],
        },
        {
            target: 'governance:on-token-approved',
            kind: 'ipc-handler',
            behavior: 'MCP-path approval emits same event with source="mcp"',
            assertion: 'flint_approve_tokens completion triggers broadcast with source="mcp"',
            edgeCases: [],
        },
        {
            target: 'ApprovalStagingArea',
            kind: 'component',
            behavior: 'Clears matching row on onTokenApproved event',
            assertion: 'Mock onTokenApproved({ tokenName: "colors.primary" }) → queryByText("colors.primary") returns null',
            edgeCases: ['Non-matching tokenName leaves queue unchanged', 'Event during empty queue is a no-op'],
        },
    ],
    risks: [
        {
            risk: 'Over-aggressive color shape allowlist rejects legitimate CSS Color 4 values (oklch, color(display-p3), lab)',
            severity: 'medium',
            commandment: 2,
            mitigation: 'Allowlist explicitly supports rgb, rgba, hsl, hsla, oklch, lab, color(, hex (3/4/6/8-digit), transparent, currentColor, named colors. Fuzz harness asserts 10 modern color values pass.',
        },
        {
            risk: 'Kotlin $ escape breaks legitimate identifier names containing $',
            severity: 'low',
            commandment: 14,
            mitigation: 'Escape values only — not identifiers. toKotlinIdentifier already strips non-alphanumerics.',
        },
        {
            risk: 'Dual-queue listener loops if MCP-path broadcast re-triggers Glass approve, which re-triggers MCP',
            severity: 'medium',
            commandment: 12,
            mitigation: 'TokenApprovedEvent.source distinguishes origins. ApprovalStagingArea filters its own state; it never calls approve-token in response to the event. Listener is idempotent.',
        },
        {
            risk: 'Drift IPC stalls main thread on oversized figma-tokens.json',
            severity: 'medium',
            commandment: 4,
            mitigation: '2MB soft cap on the file read — beyond that, return [] + warn log.',
        },
        {
            risk: 'useTokenHealth re-renders on every token array identity change',
            severity: 'medium',
            mitigation: 'Memoize buckets with useMemo keyed on stable primitives (counts, not arrays).',
        },
        {
            risk: 'Phase 2 agents re-declare SAFE_TOKEN_NAME_RE locally instead of importing shared/tokenPath',
            severity: 'medium',
            mitigation: 'Phase 1.5 linter: grep for SAFE_TOKEN_NAME_RE declarations outside shared/tokenPath.ts → fail.',
        },
        {
            risk: 'Sanitizer version drifts from _report.json header across emitter refactors',
            severity: 'low',
            mitigation: 'Export SANITIZER_VERSION from shared/tokenValueSanitizer.ts. Emitters import and stamp. Bump on every behavior change.',
        },
        {
            risk: 'governance:on-token-approved fires before FTM write resolves → ApprovalStagingArea clears row before tokens:read-all reflects write → race',
            severity: 'medium',
            commandment: 12,
            mitigation: 'Broadcast happens only after fileTransactionManager.write resolves. Test asserts handler-body ordering.',
        },
        {
            risk: 'validateProjectRoot breaks MCP dev workflow when cwd is Flint repo itself',
            severity: 'low',
            commandment: 14,
            mitigation: 'Flint repo is inside $HOME → passes the home-scope check. Self-host check from validateFilePath is intentionally NOT reused here (MCP commonly runs from arbitrary project roots).',
        },
        {
            risk: 'Web-build parity drift — future contributor updates electron/main.ts without server/index.ts',
            severity: 'high',
            mitigation: 'Parity test pattern: every modified IPC gets a shared test suite that imports both handlers via test doubles and asserts identical rejection shapes. Phase 3 validator checks this list explicitly.',
        },
    ],
    parallelismGroups: {
        // Group A: foundation — no cross-deps, pure leaves
        'A': ['flint-ast-surgeon', 'flint-design-engineer', 'flint-test-writer'],
        // Group B: consumers that depend on Group A artifacts
        'B': ['flint-electron-ipc', 'flint-state-architect', 'flint-ast-surgeon', 'flint-design-engineer'],
        // Group C: tests + integration validation
        'C': ['flint-test-writer', 'flint-integration-validator'],
    },
    nonGoals: [
        'No deletion of TokenPanel.tsx or src/components/ui/token/* orphan subtree (deferred to a separate cleanup PR)',
        'No fix for hasMultipleModes() placeholder (MINT code review M1 — deferred)',
        'No Pull / Push / Resolve / Connect Figma buttons in TokenHealthBar (UX A2 — Phase 2)',
        'No Export / emit dropdown in TokenManager toolbar (UX A3 — Phase 3)',
        'No TokenImpactAccordion embed inside TokenDetailPanel (UX A5 — Phase 4)',
        'No read-only identity banner replacing the tooltip at TokenGrid.tsx:478 (UX A6 — Phase 4)',
        'No collapse affordance or count pill for ApprovalStagingArea (UX A7 — Phase 4)',
        'No aria-live announcements on sync event completion (UX A9 — Phase 4)',
        'No MRS approval prompt gating tokenSyncEngine.executePull (Security Round 2 M1 — Phase 3)',
        'No Babel AST mutation — Phase 1 is pure IPC + sanitizer + UI refactor',
        'No new Zustand stores (useTokenHealth is a hook that derives from existing stores)',
        'No Counsel-side severity pill refactor — SeverityChip is introduced in Phase 1 but Counsel continues to render with its current inline styling until a future phase opts in',
    ],
}
