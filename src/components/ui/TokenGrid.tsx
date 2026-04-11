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

import type { DesignToken, TokenType } from '../../types/flint-api'

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

export function TokenRow({ token, syncStatus, figmaConnected }: TokenRowProps) {
    return (
        <div
            className="flex items-center gap-2 border-b border-zinc-800/40 px-3 py-1.5 hover:bg-zinc-800/30"
            role="row"
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
}

function TokenGridCard({ token, darkModeToken, syncStatus }: TokenGridCardProps) {
    return (
        <div
            className="flex flex-col items-center gap-1.5 rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700"
            data-testid="token-grid-card"
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

            {/* MINT.1c: Missing dark mode indicator */}
            {token.token_type === 'color' && !darkModeToken && token.mode !== 'dark' && hasMultipleModes(token) && (
                <div className="flex items-center gap-1" data-testid="missing-dark-mode">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="text-[9px] text-amber-400">No dark mode</span>
                </div>
            )}

            {/* Token path + value */}
            <p className="w-full truncate text-center font-mono text-[10px] text-zinc-500" title={token.token_path}>
                {token.token_path}
            </p>
            <p className="w-full truncate text-center font-mono text-[10px] text-zinc-400">
                {token.token_value}
            </p>

            {/* Sync badge */}
            {syncStatus && (
                <div className="mt-0.5">
                    <SyncBadge status={syncStatus} />
                </div>
            )}
        </div>
    )
}

/** Check if the token collection has multiple modes (heuristic). */
function hasMultipleModes(_token: DesignToken): boolean {
    // This is a placeholder — in practice, we would check if other tokens
    // in the same collection have a dark mode. The parent component passes
    // darkModeToken explicitly, so if it's undefined AND other tokens have
    // dark mode, the caller should set a flag. For now, we return false
    // to avoid false positives.
    return false
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
}

export function TokenGroupSection({
    collectionName,
    byType,
    viewMode,
    getSyncStatus,
    figmaConnected,
    allCollectionTokens,
}: TokenGroupSectionProps) {
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

                        {/* Grid or List rendering */}
                        {viewMode === 'grid' && isGridFriendly(tokenType) ? (
                            <div
                                className="grid gap-2 p-2"
                                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
                                role="grid"
                                aria-label={`${TYPE_LABEL[tokenType] ?? tokenType} tokens grid`}
                            >
                                {primaryTokens.map((token) => (
                                    <TokenGridCard
                                        key={token.id}
                                        token={token}
                                        darkModeToken={darkTokensByPath.get(token.token_path)}
                                        syncStatus={getSyncStatus(token)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div role="grid" aria-label={`${TYPE_LABEL[tokenType] ?? tokenType} tokens list`}>
                                {group.map((token) => (
                                    <TokenRow
                                        key={token.id}
                                        token={token}
                                        syncStatus={getSyncStatus(token)}
                                        figmaConnected={figmaConnected}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
