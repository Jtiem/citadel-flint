/**
 * InheritanceChain — src/components/ui/InheritanceChain.tsx
 *
 * Visual representation of the flint.config.yaml extends[] chain.
 * Rendered in GovernanceDashboard (Health tab) below the CoverageBar.
 *
 * Layout:
 *   Section header
 *   Horizontal chain: [base preset] → [team config] → [project config]
 *   Each node shows the source ref and whether it is the project's own config.
 *
 * When the chain is empty (no project open, no extends[]):
 *   Shows a minimal "(no extends)" state.
 *
 * Data comes from governanceStore.inheritanceChain (populated by useGovernanceConfig).
 *
 * Mithril Safety: all classes from the Flint token palette only.
 */

import { ChevronRight } from 'lucide-react';

// ── Props ──────────────────────────────────────────────────────────────────

interface InheritanceChainProps {
  /**
   * The full extends[] chain from flint.config.yaml, ordered from base to most-derived.
   * Last entry is implicitly the project's own config.
   */
  chain: string[];
  /** True while the IPC fetch is in progress */
  isLoading?: boolean;
}

// ── Node kinds for styling ─────────────────────────────────────────────────

type NodeKind = 'preset' | 'local' | 'project';
function classifyNode(nodeRef: string): NodeKind {
  if (nodeRef.startsWith('@flint/') || nodeRef.startsWith('@')) return 'preset';
  return 'local';
}
const NODE_BORDER: Record<NodeKind, string> = {
  preset: 'border-indigo-500/30',
  local: 'border-zinc-700/50',
  project: 'border-emerald-500/30'
};
const NODE_BG: Record<NodeKind, string> = {
  preset: 'bg-indigo-900/10',
  local: 'bg-zinc-800/60',
  project: 'bg-emerald-900/10'
};
const NODE_TEXT: Record<NodeKind, string> = {
  preset: 'text-indigo-300',
  local: 'text-zinc-400',
  project: 'text-emerald-400'
};
const NODE_LABEL: Record<NodeKind, string> = {
  preset: 'preset',
  local: 'local',
  project: 'project'
};

// ── Single chain node ──────────────────────────────────────────────────────

interface ChainNodeProps {
  /** The raw config ref string (e.g. "@flint/healthcare", "./team.yaml", "(project)") */
  nodeRef: string;
  kind: NodeKind;
}
function ChainNode({
  nodeRef,
  kind
}: ChainNodeProps) {
  // Shorten display: "@flint/healthcare" → "healthcare", "./team.yaml" → "team.yaml"
  const displayName = nodeRef.startsWith('@flint/') ? nodeRef.slice('@flint/'.length) : nodeRef.startsWith('./') ? nodeRef.slice(2) : nodeRef;
  return <div className={`flex flex-col items-start rounded border px-2 py-1.5 ${NODE_BORDER[kind]} ${NODE_BG[kind]}`} title={nodeRef}>
            <span className={`font-mono text-[10px] font-medium ${NODE_TEXT[kind]}`}>
                {displayName}
            </span>
            <span className="text-[var(--spacing.2, 8px)] text-zinc-600 uppercase tracking-wider">
                {NODE_LABEL[kind]}
            </span>
        </div>;
}

// ── InheritanceChain ───────────────────────────────────────────────────────

export function InheritanceChain({
  chain,
  isLoading
}: InheritanceChainProps) {
  const nodes = chain.length > 0 ? chain : [];
  return <>
            {/* ── Section header ── */}
            <div className="border-b border-t border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Config Inheritance
                </h3>
            </div>

            {/* ── Content ── */}
            <div className="px-3 py-3">
                {isLoading ? <p className="text-center text-xs text-zinc-600">Loading…</p> : nodes.length === 0 ? <div className="flex items-center gap-1.5">
                        <div className="flex flex-col items-start rounded border border-emerald-500/30 bg-emerald-900/10 px-2 py-1.5">
                            <span className="font-mono text-[var(--spacing.2, 8px)] font-medium text-emerald-400">
                                project
                            </span>
                            <span className="text-[var(--spacing.2, 8px)] uppercase tracking-wider text-zinc-600">
                                no extends
                            </span>
                        </div>
                    </div> : <div className="flex flex-wrap items-center gap-1.5">
                        {nodes.map((nodeRef, index) => {
          const kind = classifyNode(nodeRef);
          return <div key={`${nodeRef}-${index}`} className="flex items-center gap-1.5">
                                    {index > 0 && <ChevronRight size={10} className="shrink-0 text-zinc-600" aria-hidden="true" />}
                                    <ChainNode nodeRef={nodeRef} kind={kind} />
                                </div>;
        })}

                        {/* Implicit final "(project)" terminal node */}
                        {nodes.length > 0 && <>
                                <ChevronRight size={10} className="shrink-0 text-zinc-600" aria-hidden="true" />
                                <ChainNode nodeRef="(project)" kind="project" />
                            </>}
                    </div>}

                {/* Tighten-only note */}
                {nodes.length > 0 && <p className="mt-2 text-[var(--spacing.2, 8px)] text-zinc-600">
                        Inherited presets use tighten-only mode — project config can only tighten, not relax.
                    </p>}
            </div>
        </>;
}