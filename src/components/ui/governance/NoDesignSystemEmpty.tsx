/**
 * NoDesignSystemEmpty.tsx — C18 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Empty state shown when no design system / tokens are loaded.
 * Prompts the user to import tokens. Pure presentational.
 *
 * Source lines: GovernanceDashboard.tsx ~1688-1704
 */

import { ShieldOff } from 'lucide-react';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NoDesignSystemEmptyProps {
  /** Show the empty state (true when tokenCount === 0). */
  visible: boolean;
  /** Called when the user clicks "Import Tokens". */
  onImportTokens: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NoDesignSystemEmpty({
  visible,
  onImportTokens
}: NoDesignSystemEmptyProps) {
  if (!visible) return null;
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center border-b border-zinc-800">
            <ShieldOff className="h-8 w-8 mb-3" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
            <p className="leading-relaxed max-w-xs" style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)' }}>
                Health score measures against your design tokens. Connect Figma or import tokens to start measuring.
            </p>
            <button type="button" onClick={onImportTokens} data-schema-role="cta-secondary" className="mt-4 rounded border border-indigo-500/40 bg-indigo-900/20 px-3 py-1.5 [font-size:var(--text-label)] [color:var(--text-accent)] transition-colors hover:bg-indigo-900/40">
                Import Tokens
            </button>
        </div>;
}