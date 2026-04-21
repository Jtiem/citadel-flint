/**
 * TokenDriftRow — MINT.5 Phase 2 §2.2
 *
 * Single-row renderer for a drifted token. Shown inside DriftGroupSection when
 * TokenManager ViewMode === 'drift'.
 *
 * Layout:
 *   [localSwatch] → [figmaSwatch]  [ΔE chip (color only)]  [Pull-this]
 *
 * For color tokens: renders two circular swatches with style.backgroundColor
 * bound to the raw value, plus a SeverityChip tiered by deltaE (≤4 amber,
 * >4 critical). For non-color tokens: renders the raw string values as text
 * and omits the ΔE chip.
 *
 * Commandments:
 *   4. Local-First — no external URLs. Colors are rendered via inline style,
 *      text values rendered as plain strings.
 *   5. A11y — row is role="button" with accessible name "Open detail for <path>".
 *      Enter/Space activate onSelect. Pull button has aria-label
 *      "Pull <tokenName> from Figma" (not just "Pull").
 */

import type { ReactNode } from 'react';
import { SeverityChip } from '../governance/SeverityChip';
import type { TokenDriftRowProps } from '../../../../.flint-context/contracts/MINT.5-phase2.contract';
import type { ChipSeverity } from '../../../../.flint-context/contracts/MINT.5-phase1.contract';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isColorType(tokenType: string): boolean {
  return tokenType === 'color';
}

/**
 * Severity tier for a ΔE value. Matches SYNC.3 thresholds:
 *   advisory  ≤ 2.0
 *   amber     ≤ 4.0
 *   critical  > 4.0
 */
function deltaEToSeverity(deltaE: number): ChipSeverity {
  if (deltaE > 4) return 'critical';
  if (deltaE > 2) return 'amber';
  return 'advisory';
}
function formatDeltaE(deltaE: number): string {
  // One decimal place matches existing Mithril conventions in Counsel.
  return deltaE.toFixed(1);
}

// ── Swatch sub-component ──────────────────────────────────────────────────────

function ColorSwatch({
  value,
  role,
  tokenName
}: {
  value: string;
  role: 'local' | 'figma';
  tokenName: string;
}): ReactNode {
  const label = role === 'local' ? 'Local' : 'Figma';
  return <span role="img" aria-label={`${label} swatch for ${tokenName}: ${value}`} className="inline-block h-5 w-5 shrink-0 rounded-full border border-white/20 shadow-sm" style={{
    backgroundColor: value
  }} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TokenDriftRow({
  drift,
  tokenType,
  onPullOne,
  onSelect,
  isPulling
}: TokenDriftRowProps): ReactNode {
  const tokenName = drift.tokenName;
  const isColor = isColorType(tokenType);
  const hasDeltaE = typeof drift.deltaE === 'number';

  // Row-level Enter/Space → onSelect.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(tokenName);
    }
  }
  function handleRowClick(event: React.MouseEvent<HTMLDivElement>): void {
    // Ignore clicks that originated inside the Pull button (it handles
    // its own onClick + stopPropagation).
    if ((event.target as HTMLElement).closest('[data-role="pull-one"]')) {
      return;
    }
    onSelect(tokenName);
  }
  function handlePull(event: React.MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    if (isPulling) return;
    onPullOne(tokenName);
  }
  return <div role="button" tabIndex={0} aria-label={`Open detail for ${tokenName}`} data-testid={`drift-row-${tokenName}`} data-token-name={tokenName} onClick={handleRowClick} onKeyDown={handleKeyDown} className={['flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/40', 'px-2 py-1.5 text-xs text-zinc-300', 'hover:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-400/50', 'cursor-pointer'].join(' ')}>
            {/* Token path — leading column. Truncates if long. */}
            <span className="min-w-0 flex-1 truncate font-mono text-[var(--spacing.3, 12px)] text-zinc-400">
                {tokenName}
            </span>

            {/* Local value: swatch for colors, text for others */}
            {isColor ? <ColorSwatch value={drift.localValue} role="local" tokenName={tokenName} /> : <span className="shrink-0 font-mono text-[var(--spacing.3, 12px)] text-zinc-500" aria-label={`Local value: ${drift.localValue}`}>
                    {drift.localValue}
                </span>}

            {/* Arrow separator */}
            <span aria-hidden="true" className="shrink-0 text-zinc-600">→</span>

            {/* Figma value: swatch for colors, text for others */}
            {isColor ? <ColorSwatch value={drift.figmaValue} role="figma" tokenName={tokenName} /> : <span className="shrink-0 font-mono text-[var(--spacing.3, 12px)] text-zinc-500" aria-label={`Figma value: ${drift.figmaValue}`}>
                    {drift.figmaValue}
                </span>}

            {/* ΔE chip — color only, requires deltaE defined */}
            {isColor && hasDeltaE && <SeverityChip severity={deltaEToSeverity(drift.deltaE as number)} label={`ΔE ${formatDeltaE(drift.deltaE as number)}`} data-testid={`drift-delta-${tokenName}`} />}

            {/* Pull-this button */}
            <button type="button" data-role="pull-one" data-testid={`drift-pull-${tokenName}`} onClick={handlePull} disabled={isPulling} aria-label={`Pull ${tokenName} from Figma`} className={['shrink-0 rounded border border-indigo-500/30 bg-indigo-500/10', 'px-2 py-0.5 text-[11px] font-medium text-indigo-300', 'hover:bg-indigo-500/20 focus:outline-none focus:ring-1 focus:ring-indigo-400', 'disabled:cursor-not-allowed disabled:opacity-50'].join(' ')}>
                {isPulling ? 'Pulling…' : 'Pull'}
            </button>
        </div>;
}