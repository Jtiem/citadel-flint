/**
 * DriftGroupSection — MINT.5 Phase 2 §2.2
 *
 * Container rendered when TokenManager ViewMode === 'drift'. Groups drifted
 * tokens by collection_name (alphabetical) and renders a TokenDriftRow for
 * each drift entry.
 *
 * Empty state: "No drift detected · Your local tokens match Figma" (no rows).
 *
 * Commandments:
 *   5. A11y — each collection group uses <section> with aria-labelledby
 *      pointing to an <h3> heading (level 3 matches testBoundary assertion).
 *   3. Composite keys — rows keyed on drift.tokenName (stable dot-path).
 */

import type { ReactNode } from 'react';
import { TokenDriftRow } from './TokenDriftRow';
import type { DriftGroupSectionProps } from '../../../../.flint-context/contracts/MINT.5-phase2.contract';
import type { TokenDrift } from '../../../../.flint-context/contracts/MINT.5-phase1.contract';

// ── Helpers ──────────────────────────────────────────────────────────────────

const UNKNOWN_COLLECTION = 'Ungrouped';
interface GroupedDrift {
  collection: string;
  drifts: TokenDrift[];
}

/**
 * Group drifted tokens by collection_name derived from tokensByPath.
 * Tokens without a corresponding entry land in the "Ungrouped" bucket so the
 * section remains defensive against missing Map entries.
 *
 * Group order is alphabetical to match TokenGroupSection convention.
 */
function groupDriftsByCollection(drifts: readonly TokenDrift[], tokensByPath: DriftGroupSectionProps['tokensByPath']): GroupedDrift[] {
  const buckets = new Map<string, TokenDrift[]>();
  for (const drift of drifts) {
    const entry = tokensByPath.get(drift.tokenName);
    const collection = entry?.collection_name ?? UNKNOWN_COLLECTION;
    const bucket = buckets.get(collection);
    if (bucket !== undefined) {
      bucket.push(drift);
    } else {
      buckets.set(collection, [drift]);
    }
  }

  // Sort: ungrouped last, everything else alphabetical.
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    if (a === UNKNOWN_COLLECTION) return 1;
    if (b === UNKNOWN_COLLECTION) return -1;
    return a.localeCompare(b);
  });
  return keys.map(collection => ({
    collection,
    drifts: buckets.get(collection) ?? []
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DriftGroupSection({
  driftedTokens,
  tokensByPath,
  onPullOne,
  onSelect,
  currentPullingPath
}: DriftGroupSectionProps): ReactNode {
  // Empty state — no drift rows to render.
  if (driftedTokens.length === 0) {
    return <div data-testid="drift-group-empty" className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
                <p className="text-sm text-zinc-400">No drift detected</p>
                <p className="max-w-[var(--spacing.12, 48px)] text-xs text-zinc-500">
                    Your local tokens match Figma
                </p>
            </div>;
  }
  const groups = groupDriftsByCollection(driftedTokens, tokensByPath);
  return <div data-testid="drift-group-section" className="flex flex-col gap-3">
            {groups.map(({
      collection,
      drifts
    }) => {
      const headingId = `drift-group-${collection}`;
      return <section key={collection} aria-labelledby={headingId} data-testid={`drift-group-${collection}`} className="flex flex-col gap-1">
                        <h3 id={headingId} className="text-[var(--spacing.3, 12px)] font-semibold uppercase tracking-wider text-zinc-500">
                            {collection}
                        </h3>
                        <div className="flex flex-col gap-1">
                            {drifts.map(drift => {
            const entry = tokensByPath.get(drift.tokenName);
            const tokenType = entry?.token_type ?? 'string';
            return <TokenDriftRow key={drift.tokenName} drift={drift} tokenType={tokenType} onPullOne={onPullOne} onSelect={onSelect} isPulling={currentPullingPath === drift.tokenName} />;
          })}
                        </div>
                    </section>;
    })}
        </div>;
}