/**
 * TokenGrid — src/components/ui/TokenGrid.tsx
 *
 * MINT.1b: Visual grid view for design tokens.
 * MINT.1c: Mode columns (light/dark side-by-side).
 * MINT.1e: Accessibility — aria-labels on swatches, grid semantics.
 *
 * Visual rendering per token_type:
 *   color      — 32x32 circle swatch + name + hex value
 *   fontFamily — "Aa" specimen in the actual font
 *   fontWeight — "Aa" specimen at the actual weight
 *   lineHeight — "Aa" specimen at the actual line height
 *   dimension  — proportional ruler bar at actual pixel width
 *   shadow     — swatch with shadow applied
 *   opacity    — swatch at the specified opacity
 *   others     — value as text badge
 *
 * Renderer Process only — no Node.js imports.
 */

import type { DesignToken, TokenType, TokenUsageResult, ContrastPair } from '../../types/flint-api'
import type { TokenDrift } from '../../hooks/useTokenUsage'
import { SeverityChip } from './governance/SeverityChip'

// ── Sync badge types (shared with TokenManager) ─────────────────────────────

export type SyncBadgeStatus = 'synced' | 'local-only' | 'drifted' | 'figma-only'

const SYNC_BADGE_STYLES: Record<SyncBadgeStatus, string> = {
    'synced': 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    'local-only': 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
    'drifted': 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    'figma-only': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
}

const SYNC_BADGE_LABELS: Record<SyncBadgeStatus, string> = {
    'synced': 'Synced',
    'local-only': 'Local only',
    'drifted': 'Drifted',
    'figma-only': 'Figma only',
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: SyncBadgeStatus }) {
    return (
        <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${SYNC_BADGE_STYLES[status]}`}
            data-testid="sync-badge"
        >
            {SYNC_BADGE_LABELS[status]}
        </span>
    )
}

// ── MINT.2b: Usage badge ───────────────────────────────────────────────────

interface UsageBadgeProps {
    usageCount: number
    files: string[]
}

function UsageBadge({ usageCount, files }: UsageBadgeProps) {
    if (usageCount === 0) {
        return (
            <SeverityChip
                severity="advisory"
                label="dead"
                data-testid="dead-token-badge"
                aria-label="Dead token: not used in any file"
            />
        )
    }
    const isHighUsage = usageCount > 10
    return (
        <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                isHighUsage
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400'
                    : 'border-zinc-600/40 bg-zinc-800/60 text-zinc-400'
            }`}
            data-testid="usage-badge"
            aria-label={`Used in ${usageCount} file${usageCount !== 1 ? 's' : ''}`}
            title={files.length > 0 ? `Files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? ` and ${files.length - 5} more` : ''}` : undefined}
        >
            {usageCount} file{usageCount !== 1 ? 's' : ''}
        </span>
    )
}

// ── MINT.2c: Drift indicator badge ────────────────────────────────────────

interface DriftBadgeProps {
    drift: TokenDrift
}

function DriftBadge({ drift }: DriftBadgeProps) {
    return (
        <span
            data-testid="drift-badge"
            title={`Local: ${drift.localValue}\nFigma: ${drift.figmaValue}`}
        >
            <SeverityChip
                severity="amber"
                label="drifted"
                aria-label={`Drifted from Figma: local ${drift.localValue}, Figma ${drift.figmaValue}`}
            />
        </span>
    )
}

// ── MINT.3b: Contrast badge ──────────────────────────────────────────────────

export type ContrastBadgeGrade = 'aa' | 'aaa' | 'fail' | null

export interface ContrastBadgeProps {
    grade: ContrastBadgeGrade
    ratio?: number
}

export function ContrastBadge({ grade, ratio }: ContrastBadgeProps) {
    if (!grade) return null

    if (grade === 'fail') {
        return (
            <span data-testid="contrast-inline-badge" title={ratio ? `Contrast ratio ${ratio.toFixed(1)}:1 — fails WCAG AA` : 'Fails WCAG AA contrast'}>
                <SeverityChip
                    severity="critical"
                    label="contrast fail"
                    aria-label={`Contrast: ${ratio ? `${ratio.toFixed(1)}:1` : ''} FAIL`}
                />
            </span>
        )
    }

    return (
        <span
            className="shrink-0 rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400"
            data-testid="contrast-inline-badge"
            aria-label={`Contrast: ${ratio ? `${ratio.toFixed(1)}:1` : ''} ${grade.toUpperCase()}`}
            title={ratio ? `Contrast ratio ${ratio.toFixed(1)}:1 — passes WCAG ${grade.toUpperCase()}` : `Passes WCAG ${grade.toUpperCase()}`}
        >
            {grade.toUpperCase()}
        </span>
    )
}

/** Compute the best contrast grade for a token from its contrast pairs. */
export function getBestContrastGrade(tokenPath: string, contrastMap: Map<string, ContrastPair[]>): { grade: ContrastBadgeGrade; ratio: number | undefined } {
    const pairs = contrastMap.get(tokenPath)
    if (!pairs || pairs.length === 0) return { grade: null, ratio: undefined }

    // Find the best pair (highest ratio)
    let bestPair: ContrastPair | null = null
    for (const p of pairs) {
        if (!bestPair || p.ratio > bestPair.ratio) bestPair = p
    }
    if (!bestPair) return { grade: null, ratio: undefined }

    if (bestPair.passAAA) return { grade: 'aaa', ratio: bestPair.ratio }
    if (bestPair.passAA) return { grade: 'aa', ratio: bestPair.ratio }
    return { grade: 'fail', ratio: bestPair.ratio }
}

// ── MINT.3d: Motion token preview ───────────────────────────────────────────

/** Detect if a token is a motion/duration/easing token by name heuristics. */
function isMotionToken(token: DesignToken): boolean {
    const path = token.token_path.toLowerCase()
    return (
        path.includes('duration') ||
        path.includes('easing') ||
        path.includes('motion') ||
        path.includes('transition') ||
        path.includes('animation')
    )
}

/** Small easing curve preview: a dot that animates using the token value. */
function MotionPreview({ token }: { token: DesignToken }) {
    if (!isMotionToken(token)) return null

    const value = token.token_value
    const isDuration = /^\d+m?s$/.test(value)
    const isEasing = value.includes('cubic-bezier') || ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'].includes(value)

    if (!isDuration && !isEasing) return null

    const duration = isDuration ? value : '300ms'
    const easing = isEasing ? value : 'ease'

    return (
        <span
            className="relative inline-block h-3 w-8 rounded-full bg-zinc-700/50"
            data-testid="motion-preview"
            aria-label={`Motion preview: ${value}`}
            title={`Motion: ${value}`}
        >
            <span
                className="absolute left-0 top-0 h-3 w-3 rounded-full bg-indigo-400"
                style={{
                    animation: `flint-motion-preview ${duration} ${easing} infinite alternate`,
                }}
            />
            <style>{`
                @keyframes flint-motion-preview {
                    from { transform: translateX(0); }
                    to { transform: translateX(20px); }
                }
            `}</style>
        </span>
    )
}

// ── MINT.3d: Scale gap analysis ─────────────────────────────────────────────

export interface ScaleGap {
    before: number
    after: number
    expectedGap: number
}

/** Detect gaps in a spacing/sizing scale. */
export function detectScaleGaps(dimensionTokens: DesignToken[]): ScaleGap[] {
    const nums = dimensionTokens
        .map((t) => {
            const m = /^(\d+(?:\.\d+)?)/.exec(t.token_value)
            return m ? parseFloat(m[1]) : NaN
        })
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b)

    // Need at least 3 values to detect a gap pattern
    if (nums.length < 3) return []

    // Detect the most common step size
    const steps: number[] = []
    for (let i = 1; i < nums.length; i++) {
        steps.push(Math.round((nums[i] - nums[i - 1]) * 100) / 100)
    }

    // Find the mode (most common step)
    const stepCounts = new Map<number, number>()
    for (const s of steps) {
        stepCounts.set(s, (stepCounts.get(s) ?? 0) + 1)
    }
    let modeStep = steps[0]
    let modeCount = 0
    for (const [step, count] of stepCounts) {
        if (count > modeCount) {
            modeStep = step
            modeCount = count
        }
    }

    // Detect where the gap is larger than expected
    const gaps: ScaleGap[] = []
    for (let i = 1; i < nums.length; i++) {
        const actualStep = nums[i] - nums[i - 1]
        if (actualStep > modeStep * 1.5 && modeStep > 0) {
            gaps.push({
                before: nums[i - 1],
                after: nums[i],
                expectedGap: modeStep,
            })
        }
    }

    return gaps
}

function ScaleGapWarning({ gaps }: { gaps: ScaleGap[] }) {
    if (gaps.length === 0) return null

    return (
        <div
            className="flex flex-wrap items-center gap-1 px-3 py-1 border-b border-amber-500/10 bg-amber-500/5"
            data-testid="scale-gap-warning"
            role="alert"
            aria-label="Scale gap detected"
        >
            {gaps.map((gap, i) => (
                <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-400"
                >
                    Gap: {gap.before}px to {gap.after}px
                </span>
            ))}
        </div>
    )
}

/** Extracts the leading numeric value from a CSS dimension string. */
function parseDimensionNumber(value: string): number {
    const m = /^(\d+(?:\.\d+)?)/.exec(value)
    return m ? parseFloat(m[1]) : 0
}

// ── Mode pair detection ──────────────────────────────────────────────────────

interface ModePair {
    path: string
    light: DesignToken | undefined
    dark: DesignToken | undefined
}

/** Groups tokens by path to detect light/dark mode pairs. */
export function groupByModePair(tokens: DesignToken[]): ModePair[] {
    const byPath = new Map<string, { light?: DesignToken; dark?: DesignToken; default?: DesignToken }>()

    for (const token of tokens) {
        const modeKey = token.mode.toLowerCase()
        if (!byPath.has(token.token_path)) {
            byPath.set(token.token_path, {})
        }
        const entry = byPath.get(token.token_path)!
        if (modeKey === 'dark') {
            entry.dark = token
        } else if (modeKey === 'light') {
            entry.light = token
        } else {
            entry.default = token
        }
    }

    const result: ModePair[] = []
    for (const [path, entry] of byPath) {
        // If we have both light and dark, show as pair
        if (entry.light || entry.dark) {
            result.push({
                path,
                light: entry.light ?? entry.default,
                dark: entry.dark,
            })
        } else if (entry.default) {
            result.push({
                path,
                light: entry.default,
                dark: undefined,
            })
        }
    }
    return result
}

// ── Color swatch (32x32 for grid, smaller for list) ─────────────────────────

function ColorSwatchLarge({ value, label }: { value: string; label: string }) {
    return (
        <span
            className="inline-block h-8 w-8 shrink-0 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: value }}
            aria-label={`Color swatch: ${label}, ${value}`}
            role="img"
        />
    )
}

function ColorSwatchSmall({ value, label }: { value: string; label: string }) {
    return (
        <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: value }}
            aria-label={`Color swatch: ${label}, ${value}`}
            role="img"
        />
    )
}

function TypographySpecimen({ token }: { token: DesignToken }) {
    const style: React.CSSProperties = {}
    if (token.token_type === 'fontFamily') style.fontFamily = token.token_value
    if (token.token_type === 'fontWeight') style.fontWeight = token.token_value
    if (token.token_type === 'lineHeight') style.lineHeight = token.token_value

    return (
        <span
            className="text-lg text-zinc-300"
            style={style}
            aria-label={`Typography specimen for ${token.token_path}: ${token.token_value}`}
        >
            Aa
        </span>
    )
}

function DimensionRuler({ value }: { value: string }) {
    const num = parseDimensionNumber(value)
    const barWidth = Math.max(4, Math.min(num, 80))
    return (
        <span
            className="inline-block h-2 shrink-0 rounded-full bg-blue-400/50"
            style={{ width: barWidth }}
            aria-label={`Spacing ruler: ${value}`}
            role="img"
        />
    )
}

function ShadowSwatch({ value, label }: { value: string; label: string }) {
    return (
        <span
            className="inline-block h-8 w-8 shrink-0 rounded-lg bg-zinc-700"
            style={{ boxShadow: value }}
            aria-label={`Shadow swatch: ${label}, ${value}`}
            role="img"
        />
    )
}

function OpacitySwatch({ value, label }: { value: string; label: string }) {
    const opacityNum = parseFloat(value) / 100
    return (
        <span
            className="inline-block h-8 w-8 shrink-0 rounded-lg bg-indigo-400"
            style={{ opacity: isNaN(opacityNum) ? 1 : opacityNum }}
            aria-label={`Opacity swatch: ${label}, ${value}%`}
            role="img"
        />
    )
}

// ── List view row (MINT.1e: semantic table row) ──────────────────────────────

interface TokenRowProps {
    token: DesignToken
    syncStatus?: SyncBadgeStatus | null
    figmaConnected?: boolean
    usageResult?: TokenUsageResult | null
    drift?: TokenDrift | null
    /** MINT.3b: Contrast grade for this token. */
    contrastGrade?: ContrastBadgeGrade
    /** MINT.3b: Contrast ratio for this token. */
    contrastRatio?: number
    /** MINT.4d: Click handler to open token detail panel. */
    onClick?: () => void
}

function DimensionBar({ value }: { value: string }) {
    const num = parseDimensionNumber(value)
    const barWidth = Math.max(2, Math.min(num, 64))
    return (
        <span
            className="inline-block h-1.5 shrink-0 rounded-full bg-blue-400/50"
            style={{ width: barWidth }}
            aria-label={`Spacing: ${value}`}
            role="img"
        />
    )
}

export function TokenRow({ token, syncStatus, figmaConnected, usageResult, drift, contrastGrade, contrastRatio, onClick }: TokenRowProps) {
    return (
        <div
            className="flex cursor-pointer items-center gap-2 border-b border-zinc-800/40 px-3 py-1.5 hover:bg-zinc-800/30"
            role="row"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick() } }}
            aria-label={`Token ${token.token_path}: ${token.token_value}. Click for details.`}
        >
            {/* Type-specific visual indicator */}
            {token.token_type === 'color' && (
                <ColorSwatchSmall value={token.token_value} label={token.token_path} />
            )}
            {token.token_type === 'dimension' && <DimensionBar value={token.token_value} />}

            {/* Path + value */}
            <div className="min-w-0 flex-1" role="gridcell">
                <p className="truncate font-mono text-[10px] text-zinc-500" title={token.token_path}>
                    {token.token_path}
                </p>
                {/* Read-only value — tooltip explains how to edit */}
                <p
                    className="mt-0.5 truncate font-mono text-[11px] text-zinc-300"
                    title={
                        figmaConnected
                            ? 'Token values are managed through Figma. Use Envoy sync to update.'
                            : 'Token values are managed in design-tokens.json. Use MCP tools to update.'
                    }
                    style={
                        token.token_type === 'fontFamily'
                            ? { fontFamily: token.token_value }
                            : undefined
                    }
                >
                    {token.token_value}
                </p>
            </div>

            {/* MINT.2b: Usage badge */}
            {usageResult && (
                <UsageBadge usageCount={usageResult.usageCount} files={usageResult.files} />
            )}

            {/* MINT.2c: Drift indicator */}
            {drift && <DriftBadge drift={drift} />}

            {/* MINT.3b: Contrast badge */}
            {contrastGrade && <ContrastBadge grade={contrastGrade} ratio={contrastRatio} />}

            {/* MINT.3d: Motion preview */}
            <MotionPreview token={token} />

            {/* Sync badge — only when Figma is connected */}
            {syncStatus && <SyncBadge status={syncStatus} />}

            {/* Mode badge — only when non-default */}
            {token.mode !== 'default' && (
                <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase text-zinc-400 ring-1 ring-zinc-700">
                    {token.mode}
                </span>
            )}
        </div>
    )
}

// ── Grid view card ───────────────────────────────────────────────────────────

interface TokenGridCardProps {
    token: DesignToken
    darkModeToken?: DesignToken
    syncStatus?: SyncBadgeStatus | null
    usageResult?: TokenUsageResult | null
    drift?: TokenDrift | null
    /** MINT.3b: Contrast grade for this token. */
    contrastGrade?: ContrastBadgeGrade
    /** MINT.3b: Contrast ratio for this token. */
    contrastRatio?: number
    /** MINT.4d: Click handler to open token detail panel. */
    onClick?: () => void
}

function TokenGridCard({ token, darkModeToken, syncStatus, usageResult, drift, contrastGrade, contrastRatio, onClick }: TokenGridCardProps) {
    const isDead = usageResult != null && usageResult.usageCount === 0
    return (
        <div
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors hover:border-zinc-700 ${
                isDead
                    ? 'border-red-500/20 bg-red-950/20'
                    : 'border-zinc-800/60 bg-zinc-900/50'
            }`}
            data-testid="token-grid-card"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick() } }}
            role="button"
            aria-label={`Token ${token.token_path}: ${token.token_value}. Click for details.`}
        >
            {/* Visual specimen */}
            <div className="flex items-center gap-2">
                {token.token_type === 'color' && (
                    <>
                        <ColorSwatchLarge value={token.token_value} label={`${token.token_path} light`} />
                        {darkModeToken && (
                            <ColorSwatchLarge
                                value={darkModeToken.token_value}
                                label={`${token.token_path} dark`}
                            />
                        )}
                    </>
                )}
                {(token.token_type === 'fontFamily' ||
                    token.token_type === 'fontWeight' ||
                    token.token_type === 'lineHeight') && (
                    <TypographySpecimen token={token} />
                )}
                {token.token_type === 'dimension' && (
                    <DimensionRuler value={token.token_value} />
                )}
                {token.token_type === 'shadow' && (
                    <ShadowSwatch value={token.token_value} label={token.token_path} />
                )}
                {token.token_type === 'opacity' && (
                    <OpacitySwatch value={token.token_value} label={token.token_path} />
                )}
                {token.token_type === 'letterSpacing' && (
                    <span
                        className="text-lg text-zinc-300"
                        style={{ letterSpacing: token.token_value }}
                        aria-label={`Letter spacing specimen: ${token.token_value}`}
                    >
                        Aa
                    </span>
                )}
                {token.token_type === 'string' && (
                    <span className="text-xs text-zinc-400">{token.token_value}</span>
                )}
                {token.token_type === 'boolean' && (
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            token.token_value === 'true'
                                ? 'bg-emerald-400/10 text-emerald-400'
                                : 'bg-zinc-700 text-zinc-400'
                        }`}
                    >
                        {token.token_value}
                    </span>
                )}
            </div>

            {/* MINT.1c: Mode columns for color tokens */}
            {token.token_type === 'color' && darkModeToken && (
                <div className="flex w-full items-center gap-2 text-[9px]" data-testid="mode-columns">
                    <span className="flex-1 truncate text-center text-zinc-500">{token.token_value}</span>
                    <span className="flex-1 truncate text-center text-zinc-500">{darkModeToken.token_value}</span>
                </div>
            )}

            {/* MINT.1c: Missing-dark-mode indicator removed 2026-04-17 (Mint code review M1).
                The hasMultipleModes() heuristic was a placeholder that always returned false,
                so this row was permanently unreachable. Re-add when collection-level mode
                coverage is plumbed through from the parent. */}

            {/* Token path + value */}
            <p className="w-full truncate text-center font-mono text-[10px] text-zinc-500" title={token.token_path}>
                {token.token_path}
            </p>
            <p className="w-full truncate text-center font-mono text-[10px] text-zinc-400">
                {token.token_value}
            </p>

            {/* MINT.2b: Usage badge */}
            {usageResult && (
                <div className="mt-0.5">
                    <UsageBadge usageCount={usageResult.usageCount} files={usageResult.files} />
                </div>
            )}

            {/* MINT.2c: Drift indicator */}
            {drift && (
                <div className="mt-0.5">
                    <DriftBadge drift={drift} />
                </div>
            )}

            {/* MINT.3b: Contrast badge */}
            {contrastGrade && (
                <div className="mt-0.5">
                    <ContrastBadge grade={contrastGrade} ratio={contrastRatio} />
                </div>
            )}

            {/* MINT.3d: Motion preview */}
            {isMotionToken(token) && (
                <div className="mt-0.5">
                    <MotionPreview token={token} />
                </div>
            )}

            {/* Sync badge */}
            {syncStatus && (
                <div className="mt-0.5">
                    <SyncBadge status={syncStatus} />
                </div>
            )}
        </div>
    )
}


// ── Type labels ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<TokenType, string> = {
    color: 'Color',
    dimension: 'Dimension',
    fontFamily: 'Font Family',
    fontWeight: 'Font Weight',
    lineHeight: 'Line Height',
    letterSpacing: 'Letter Spacing',
    shadow: 'Shadow',
    opacity: 'Opacity',
    string: 'String',
    boolean: 'Boolean',
}

const TYPE_DOT: Record<TokenType, string> = {
    color: 'bg-purple-400',
    dimension: 'bg-blue-400',
    fontFamily: 'bg-amber-400',
    fontWeight: 'bg-amber-400',
    lineHeight: 'bg-amber-400',
    letterSpacing: 'bg-amber-400',
    shadow: 'bg-indigo-400',
    opacity: 'bg-indigo-400',
    string: 'bg-emerald-400',
    boolean: 'bg-amber-400',
}

// Token types that benefit from grid view
const GRID_FRIENDLY_TYPES = new Set<TokenType>([
    'color', 'shadow', 'opacity', 'fontFamily', 'fontWeight', 'lineHeight',
    'letterSpacing', 'dimension',
])

export function isGridFriendly(tokenType: TokenType): boolean {
    return GRID_FRIENDLY_TYPES.has(tokenType)
}

// ── Exported grid section ────────────────────────────────────────────────────

export type ViewMode = 'list' | 'grid'

interface TokenGroupSectionProps {
    collectionName: string
    byType: Map<TokenType, DesignToken[]>
    viewMode: ViewMode
    getSyncStatus: (token: DesignToken) => SyncBadgeStatus | null
    figmaConnected: boolean
    /** All tokens in this collection, used for mode pairing. */
    allCollectionTokens: DesignToken[]
    /** MINT.2b: Usage data map (token_path -> usage result). */
    usageMap?: Map<string, TokenUsageResult>
    /** MINT.2c: Tokens that have drifted from Figma values. */
    driftedTokens?: TokenDrift[]
    /** MINT.3b: Contrast data map (token_path -> pairs). */
    contrastMap?: Map<string, ContrastPair[]>
    /** MINT.4d: Callback when a token is clicked to open detail panel. */
    onTokenSelect?: (token: DesignToken) => void
}

export function TokenGroupSection({
    collectionName,
    byType,
    viewMode,
    getSyncStatus,
    figmaConnected,
    allCollectionTokens,
    usageMap,
    driftedTokens,
    contrastMap,
    onTokenSelect,
}: TokenGroupSectionProps) {
    // MINT.2c: Build a drift lookup by token name
    const driftByName = new Map<string, TokenDrift>()
    if (driftedTokens) {
        for (const d of driftedTokens) {
            driftByName.set(d.tokenName, d)
        }
    }
    // Build a dark-mode lookup for this collection
    const darkTokensByPath = new Map<string, DesignToken>()
    for (const token of allCollectionTokens) {
        if (token.mode.toLowerCase() === 'dark') {
            darkTokensByPath.set(token.token_path, token)
        }
    }

    return (
        <div>
            {/* Collection header */}
            <div className="sticky top-0 z-[1] border-b border-zinc-700 bg-zinc-950/95 px-3 py-1.5 backdrop-blur-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {collectionName}
                </span>
            </div>

            {[...byType.entries()].map(([tokenType, group]) => {
                // Deduplicate for grid: only show light/default tokens, pair with dark
                const primaryTokens = viewMode === 'grid'
                    ? group.filter((t) => t.mode.toLowerCase() !== 'dark')
                    : group

                // MINT.3d: Detect scale gaps for dimension tokens
                const scaleGaps = tokenType === 'dimension' ? detectScaleGaps(group) : []

                return (
                    <div key={tokenType}>
                        {/* Type sub-header */}
                        <div className="flex items-center gap-1.5 border-b border-zinc-800/60 bg-zinc-900/40 px-3 py-1">
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${TYPE_DOT[tokenType] ?? 'bg-zinc-500'}`}
                            />
                            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
                                {TYPE_LABEL[tokenType] ?? tokenType}
                            </span>
                            <span className="ml-auto text-[10px] text-zinc-500">
                                {group.length}
                            </span>
                        </div>

                        {/* MINT.3d: Scale gap warnings for dimension tokens */}
                        {scaleGaps.length > 0 && <ScaleGapWarning gaps={scaleGaps} />}

                        {/* Grid or List rendering */}
                        {viewMode === 'grid' && isGridFriendly(tokenType) ? (
                            <div
                                className="grid gap-2 p-2"
                                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
                                role="grid"
                                aria-label={`${TYPE_LABEL[tokenType] ?? tokenType} tokens grid`}
                            >
                                {primaryTokens.map((token) => {
                                    const contrast = contrastMap ? getBestContrastGrade(token.token_path, contrastMap) : { grade: null, ratio: undefined }
                                    return (
                                        <TokenGridCard
                                            key={token.id}
                                            token={token}
                                            darkModeToken={darkTokensByPath.get(token.token_path)}
                                            syncStatus={getSyncStatus(token)}
                                            usageResult={usageMap?.get(token.token_path) ?? null}
                                            drift={driftByName.get(token.token_path) ?? null}
                                            contrastGrade={contrast.grade}
                                            contrastRatio={contrast.ratio}
                                            onClick={onTokenSelect ? () => onTokenSelect(token) : undefined}
                                        />
                                    )
                                })}
                            </div>
                        ) : (
                            <div role="grid" aria-label={`${TYPE_LABEL[tokenType] ?? tokenType} tokens list`}>
                                {group.map((token) => {
                                    const contrast = contrastMap ? getBestContrastGrade(token.token_path, contrastMap) : { grade: null, ratio: undefined }
                                    return (
                                        <TokenRow
                                            key={token.id}
                                            token={token}
                                            syncStatus={getSyncStatus(token)}
                                            figmaConnected={figmaConnected}
                                            usageResult={usageMap?.get(token.token_path) ?? null}
                                            drift={driftByName.get(token.token_path) ?? null}
                                            contrastGrade={contrast.grade}
                                            contrastRatio={contrast.ratio}
                                            onClick={onTokenSelect ? () => onTokenSelect(token) : undefined}
                                        />
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
