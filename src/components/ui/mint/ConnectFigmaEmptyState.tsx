/**
 * ConnectFigmaEmptyState — MINT.5 Phase 2 §2.3
 *
 * Full-panel empty state rendered when the TokenManager has no tokens. Three
 * variants (contract-defined):
 *   1. figmaConnected=false, tokenCount=0  → "Connect Figma" primary CTA +
 *      "Import tokens manually" text link
 *   2. figmaConnected=true, tokenCount=0   → "Pull tokens from Figma" primary CTA
 *   3. tokenCount > 0                      → returns null (suppressed — caller
 *      renders real token UI via TokenManager)
 *
 * Commandments:
 *   4. Local-First — no external URLs. The leading icon is a local SVG
 *      rendered inline; no network fetches.
 *   5. A11y — rendered as role="region" with aria-labelledby binding to the
 *      internal heading. Primary CTA uses semantic <button type="button">
 *      with a concrete accessible name ("Connect Figma" / "Pull tokens from
 *      Figma"). Secondary action is a <button> styled as a text link so it
 *      does not navigate.
 */

import type { ReactNode } from 'react';
import type { ConnectFigmaEmptyStateProps } from '../../../../.flint-context/contracts/MINT.5-phase2.contract';

// ── Local Figma mark icon (Commandment 4 — no external fetch) ────────────────

function FigmaMark(): ReactNode {
  return <svg aria-hidden="true" viewBox="0 0 38 57" className="h-8 w-8" fill="none">
            <title>Figma</title>
            {/* Five-circle simplification of the official Figma mark, inline-rendered */}
            <rect x="0" y="0" width="19" height="19" rx="9.5" fill="#F24E1E" />
            <rect x="19" y="0" width="19" height="19" rx="9.5" fill="#FF7262" />
            <rect x="0" y="19" width="19" height="19" rx="9.5" fill="#A259FF" />
            <rect x="19" y="19" width="19" height="19" rx="9.5" fill="#1ABCFE" />
            <rect x="0" y="38" width="19" height="19" rx="9.5" fill="#0ACF83" />
        </svg>;
}

// ── Component ─────────────────────────────────────────────────────────────────

const HEADING_ID = 'connect-figma-empty-state-heading';
export function ConnectFigmaEmptyState({
  figmaConnected,
  tokenCount,
  syncOp,
  onConnect,
  onPullFromFigma,
  onOpenImport
}: ConnectFigmaEmptyStateProps): ReactNode {
  // Variant 3: tokens exist → component is inactive.
  if (tokenCount > 0) {
    return null;
  }
  const isConnecting = syncOp === 'connect';
  const isPulling = syncOp === 'pull';

  // Variant 2: connected but no tokens yet → Pull CTA.
  if (figmaConnected) {
    return <div role="region" aria-labelledby={HEADING_ID} data-testid="connect-figma-empty-state" data-variant="connected-no-tokens" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <FigmaMark />
                <h2 id={HEADING_ID} className="text-sm font-medium text-zinc-200">
                    Figma is connected. No tokens imported yet.
                </h2>
                <p className="max-w-[var(--spacing.12, 48px)] text-xs text-zinc-500">
                    Pull your design tokens to start governing them.
                </p>
                <button type="button" onClick={onPullFromFigma} disabled={isPulling} data-testid="connect-figma-pull-cta" aria-label="Pull tokens from Figma" className={['mt-1 inline-flex items-center gap-1.5 rounded', 'border border-indigo-500/40 bg-indigo-500/10', 'px-3 py-1.5 text-xs font-medium text-indigo-300', 'hover:bg-indigo-500/20 focus:outline-none focus:ring-1 focus:ring-indigo-400', 'disabled:cursor-not-allowed disabled:opacity-50'].join(' ')}>
                    {isPulling ? 'Pulling…' : 'Pull tokens from Figma'}
                </button>
            </div>;
  }

  // Variant 1: disconnected → Connect CTA + Import link.
  return <div role="region" aria-labelledby={HEADING_ID} data-testid="connect-figma-empty-state" data-variant="disconnected" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <FigmaMark />
            <h2 id={HEADING_ID} className="text-sm font-medium text-zinc-200">
                Connect Figma to sync your design tokens
            </h2>
            <p className="max-w-[var(--spacing.12, 48px)] text-xs text-zinc-500">
                Your design system will appear here automatically once Figma is
                connected.
            </p>
            <button type="button" onClick={onConnect} disabled={isConnecting} data-testid="connect-figma-connect-cta" aria-label="Connect Figma" className={['mt-1 inline-flex items-center gap-1.5 rounded', 'border border-indigo-500/40 bg-indigo-500/10', 'px-3 py-1.5 text-xs font-medium text-indigo-300', 'hover:bg-indigo-500/20 focus:outline-none focus:ring-1 focus:ring-indigo-400', 'disabled:cursor-not-allowed disabled:opacity-50'].join(' ')}>
                {isConnecting ? 'Connecting…' : 'Connect Figma'}
            </button>
            <button type="button" onClick={onOpenImport} data-testid="connect-figma-import-link" aria-label="Import tokens manually from a JSON file" className={['text-[11px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline', 'focus:outline-none focus:ring-1 focus:ring-indigo-400/50 rounded'].join(' ')}>
                Import tokens manually
            </button>
        </div>;
}