/**
 * DiffCard.tsx — src/components/ui/DiffCard.tsx
 *
 * Enhanced mutation diff card shown in the AgentChatPanel when the AI proposes
 * a structural or styling change.
 *
 * Features:
 *   - Tool name badge + risk tier badge (green / amber / red)
 *   - Reasoning text from the AI
 *   - Human-readable mutation summary (what will change)
 *   - Before/after code snippets of the targeted AST node with diff highlighting:
 *       + additions highlighted bg-emerald-900/30
 *       - removals highlighted bg-red-900/30
 *   - Accept / Reject action buttons
 *
 * Mithril compliance:
 *   - No hardcoded hex colours — all classes use Flint token palette.
 *   - No arbitrary spacing — all spacing from the 4 px grid scale.
 *   - data-flint-id is not required (this component is not canvas-selectable).
 */

import { useMemo, useState } from 'react';
import { Zap, CheckCircle2, XCircle, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { PendingToolCall } from '../../store/orchestratorStore';

// ── CHRON.1 UX A+: Red-tier framing text per AST tool ────────────────────────
// Describes *what* is risky about a mutation so the reason input reads as a
// response to a stated risk, not an arbitrary gate.
function framingForTool(toolName: string): string {
  switch (toolName) {
    case 'flint_delete_node':
      return "This change removes an element and can't be easily undone.";
    case 'flint_wrap_node':
      return "This change restructures the DOM and can't be easily undone.";
    case 'flint_insert_node':
      return "This change adds structure to the page and can't be easily undone.";
    case 'flint_compose_slot':
      return "This change rewires compound component composition and can't be easily undone.";
    case 'flint_emit_map':
      return "This change introduces rendering logic and can't be easily undone.";
    default:
      return "This change has high impact and can't be easily undone.";
  }
}

// ── Risk tier ─────────────────────────────────────────────────────────────────

export type RiskTier = 'green' | 'amber' | 'red';

// NOTE (CHRON.1-repair / M2): a prior `inferRiskTier(toolName)` function lived
// here that guessed the tier from a naive tool-name allowlist. The UX review
// (2026-04-16) caught that a dangerous `flint_update_props` on a root element
// rendered "Low risk" and bypassed CHRON.1's reason gate entirely. Risk tier
// is now a required prop — the orchestrator must pass the MRS-derived tier
// from the tool_call chunk. No silent fallback. If the orchestrator can't
// determine a tier, callers should explicitly pass "amber" (conservative).

function RiskBadge({
  tier
}: {
  tier: RiskTier;
}) {
  if (tier === 'green') {
    return <span className="flex items-center gap-1 rounded bg-emerald-900/30 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-emerald-400">
                <ShieldCheck size={10} />
                Low risk
            </span>;
  }
  if (tier === 'amber') {
    return <span className="flex items-center gap-1 rounded bg-amber-900/20 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-amber-400">
                <AlertTriangle size={10} />
                Review
            </span>;
  }
  return <span className="flex items-center gap-1 rounded bg-red-900/10 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-red-400">
            <ShieldAlert size={10} />
            High risk
        </span>;
}

// ── Diff line highlighting ─────────────────────────────────────────────────────

type DiffLine = {
  kind: 'addition';
  text: string;
} | {
  kind: 'removal';
  text: string;
} | {
  kind: 'context';
  text: string;
};

/**
 * Produce a line-by-line diff between `before` and `after` strings.
 *
 * Implementation uses a simple LCS-based approach on lines.  For the small
 * 3-10 line snippets shown in the diff card this is more than sufficient and
 * avoids pulling in an external diff library (Mithril commandment C2 — no
 * unnecessary dependencies that bypass the design system constraint layer).
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  // Build LCS table
  const m = beforeLines.length;
  const n = afterLines.length;
  const dp: number[][] = Array.from({
    length: m + 1
  }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      result.unshift({
        kind: 'context',
        text: beforeLines[i - 1]
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        kind: 'addition',
        text: afterLines[j - 1]
      });
      j--;
    } else {
      result.unshift({
        kind: 'removal',
        text: beforeLines[i - 1]
      });
      i--;
    }
  }
  return result;
}

// ── Snippet extraction ────────────────────────────────────────────────────────

/**
 * Extracts the JSX element identified by `targetId` (a data-flint-id value)
 * from the raw source string, returning up to `maxLines` lines of context.
 *
 * Returns null when the ID is not present in the source.
 */
export function extractSnippet(source: string, targetId: string, maxLines = 6): string | null {
  if (!source || !targetId) return null;
  const lines = source.split('\n');
  const idPattern = `data-flint-id="${targetId}"`;
  const anchorIndex = lines.findIndex(l => l.includes(idPattern));
  if (anchorIndex === -1) return null;

  // Walk forward to find the end of the opening tag or self-closing element
  let depth = 0;
  let end = anchorIndex;
  for (let i = anchorIndex; i < Math.min(lines.length, anchorIndex + maxLines); i++) {
    for (const ch of lines[i]) {
      if (ch === '<') depth++;
      if (ch === '>') depth--;
    }
    end = i;
    if (depth <= 0) break;
  }
  return lines.slice(anchorIndex, end + 1).join('\n');
}

/**
 * Produce the "after" snippet by applying a textual description of the
 * mutation onto the before snippet.
 *
 * This is intentionally a lightweight heuristic — it covers the common cases
 * (className add/remove, prop update, text update) without running a full
 * Babel pass in the renderer.  For structural ops (insert/wrap/delete) we
 * return a descriptive placeholder because the structural shape cannot be
 * trivially derived from the before snippet alone.
 */
export function deriveAfterSnippet(beforeSnippet: string, toolName: string, input: Record<string, unknown>): string {
  if (!beforeSnippet) return '';
  if (toolName === 'flint_add_class') {
    const cls = typeof input.className === 'string' ? input.className : '';
    // Append the class to the first className="..." attribute found
    return beforeSnippet.replace(/className="([^"]*)"/, (_, existing: string) => `className="${[existing, cls].filter(Boolean).join(' ')}"`);
  }
  if (toolName === 'flint_remove_class') {
    const cls = typeof input.className === 'string' ? input.className : '';
    return beforeSnippet.replace(/className="([^"]*)"/, (_, existing: string) => `className="${existing.split(' ').filter((c: string) => c !== cls).join(' ')}"`);
  }
  if (toolName === 'flint_update_props') {
    let result = beforeSnippet;
    const props = input.props as Record<string, string> ?? {};
    for (const [propName, value] of Object.entries(props)) {
      const existing = new RegExp(`${propName}="[^"]*"`);
      if (existing.test(result)) {
        result = result.replace(existing, `${propName}="${value}"`);
      } else {
        // Prop not yet present — insert before closing >
        result = result.replace(/(\s*\/?>)/, ` ${propName}="${value}"$1`);
      }
    }
    return result;
  }
  if (toolName === 'flint_update_text') {
    const text = typeof input.text === 'string' ? input.text : '';
    // Replace content between > and </
    return beforeSnippet.replace(/>([^<]*)<\//, `>${text}</`);
  }
  if (toolName === 'flint_delete_node') {
    return '(element will be removed)';
  }
  if (toolName === 'flint_insert_node') {
    const nodeType = typeof input.nodeType === 'string' ? input.nodeType : 'element';
    const children = typeof input.children === 'string' ? input.children : '';
    return children ? `${beforeSnippet}\n  <${nodeType}>${children}</${nodeType}>` : `${beforeSnippet}\n  <${nodeType} />`;
  }
  if (toolName === 'flint_wrap_node') {
    const wrapperType = typeof input.wrapperType === 'string' ? input.wrapperType : 'div';
    return `<${wrapperType}>\n  ${beforeSnippet}\n</${wrapperType}>`;
  }
  return beforeSnippet;
}

// ── Mutation summary builder ──────────────────────────────────────────────────

function buildMutationSummary(toolName: string, input: Record<string, unknown>): string {
  const targetId = typeof input.targetId === 'string' ? input.targetId.slice(0, 8) : '—';
  switch (toolName) {
    case 'flint_update_props':
      {
        const props = input.props as Record<string, string> ?? {};
        return Object.entries(props).map(([k, v]) => `${k} → "${v}"`).join(', ');
      }
    case 'flint_update_text':
      return `text → "${input.text ?? ''}"`;
    case 'flint_insert_node':
      return `insert <${input.nodeType ?? 'element'}> ${input.position ?? ''} #${targetId}`;
    case 'flint_wrap_node':
      return `wrap #${targetId} in <${input.wrapperType ?? 'div'}>`;
    case 'flint_delete_node':
      return `delete #${targetId}`;
    case 'flint_add_class':
      return `+ class "${input.className ?? ''}"`;
    case 'flint_remove_class':
      return `- class "${input.className ?? ''}"`;
    default:
      return toolName;
  }
}

// ── DiffBlock ─────────────────────────────────────────────────────────────────

function DiffBlock({
  lines
}: {
  lines: DiffLine[];
}) {
  return <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 font-mono text-[var(--spacing.2, 8px)] leading-5">
            {lines.map((line, i) => {
      const prefix = line.kind === 'addition' ? '+' : line.kind === 'removal' ? '-' : ' ';
      const rowClass = line.kind === 'addition' ? 'bg-emerald-900/30 text-emerald-300' : line.kind === 'removal' ? 'bg-red-900/30 text-red-300' : 'text-zinc-400';
      return <div key={i} className={`flex gap-2 px-2 ${rowClass}`}>
                        <span className="w-3 shrink-0 select-none opacity-60">{prefix}</span>
                        <span className="whitespace-pre">{line.text}</span>
                    </div>;
    })}
        </div>;
}

// ── Consensus badge ───────────────────────────────────────────────────────────

interface ConsensusBadgeProps {
  outcome: string;
  reasoning?: string;
}
function ConsensusBadge({
  outcome,
  reasoning
}: ConsensusBadgeProps) {
  if (outcome === 'disagree') {
    return <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 rounded bg-amber-900/20 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-amber-400 border border-amber-500/30">
                    <AlertTriangle size={9} />
                    Consensus: Disagreement
                </span>
                {reasoning && <span className="truncate text-[var(--spacing.2, 8px)] text-zinc-500" title={reasoning}>
                        {reasoning}
                    </span>}
            </div>;
  }
  if (outcome === 'agree_reject') {
    return <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 rounded bg-red-900/10 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-red-400 border border-red-700/30">
                    <XCircle size={9} />
                    Consensus: Both agents rejected
                </span>
                {reasoning && <span className="truncate text-[var(--spacing.2, 8px)] text-zinc-500" title={reasoning}>
                        {reasoning}
                    </span>}
            </div>;
  }
  if (outcome === 'agree_approve') {
    return <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 rounded bg-emerald-900/20 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-emerald-400 border border-emerald-700/30">
                    <CheckCircle2 size={9} />
                    Consensus: Approved
                </span>
                {reasoning && <span className="truncate text-[var(--spacing.2, 8px)] text-zinc-500" title={reasoning}>
                        {reasoning}
                    </span>}
            </div>;
  }
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DiffCardProps {
  call: PendingToolCall;
  /**
   * CHRON.1: `reason` is the user-supplied justification captured by the
   * risk-tiered input. Green tier passes no reason; amber passes an empty
   * string or free text; red passes non-empty free text (Apply is disabled
   * until non-empty).
   */
  onApprove: (id: string, reason?: string) => void;
  onReject: (id: string) => void;
  /**
   * Risk tier from the orchestrator's MRS score. Required — no inference
   * fallback (CHRON.1-repair / M2). Conservative default is "amber" if the
   * orchestrator cannot determine a tier.
   */
  riskTier: RiskTier;
  /** Consensus gate outcome for this mutation (e.g. 'agree_approve', 'agree_reject', 'disagree'). */
  consensusOutcome?: string;
  /** Natural-language explanation from the secondary evaluator. */
  consensusReasoning?: string;
}

// ── DiffCard ──────────────────────────────────────────────────────────────────

export function DiffCard({
  call,
  onApprove,
  onReject,
  riskTier,
  consensusOutcome,
  consensusReasoning
}: DiffCardProps) {
  const {
    toolName,
    input,
    status,
    beforeSnapshot
  } = call;
  const isPending = status === 'pending';
  const tier = riskTier;
  const reasoning = typeof input.reasoning === 'string' ? input.reasoning : '';
  const targetId = typeof input.targetId === 'string' ? input.targetId : '';

  // CHRON.1: risk-tiered reason input. Green → no input, amber → optional,
  // red → required (Apply disabled until trim().length > 0).
  const [reasonText, setReasonText] = useState('');
  const trimmedReason = reasonText.trim();
  const redApplyDisabled = tier === 'red' && trimmedReason.length === 0;
  const inputBorderClass = tier === 'red' ? 'border-red-500/40 focus:border-red-500/60 focus:outline-none' : tier === 'amber' ? 'border-amber-500/30 focus:border-amber-500/60 focus:outline-none' : 'border-zinc-700';
  const amberPlaceholder = 'Why this change? (optional, for teammates)';
  const redPlaceholder = 'Required: reason for this high-risk change';
  const handleApprove = () => {
    if (tier === 'green') {
      onApprove(call.id);
      return;
    }
    if (tier === 'amber') {
      // CHRON.1 UX A+: empty amber sends '' (not the legacy 'skipped' sentinel)
      onApprove(call.id, trimmedReason);
      return;
    }
    // red: disabled until non-empty; forward typed reason
    if (!redApplyDisabled) onApprove(call.id, trimmedReason);
  };

  // Derive before/after snippets
  const beforeSnippet = useMemo(() => {
    if (!beforeSnapshot || !targetId) return null;
    return extractSnippet(beforeSnapshot, targetId);
  }, [beforeSnapshot, targetId]);
  const afterSnippet = useMemo(() => {
    if (!beforeSnippet) return null;
    return deriveAfterSnippet(beforeSnippet, toolName, input);
  }, [beforeSnippet, toolName, input]);
  const diffResult = useMemo(() => {
    if (!beforeSnippet || !afterSnippet || beforeSnippet === afterSnippet) return null;
    return diffLines(beforeSnippet, afterSnippet);
  }, [beforeSnippet, afterSnippet]);
  const summary = buildMutationSummary(toolName, input);

  // Border/background by status
  const containerClass = isPending ? 'border-indigo-500/40 bg-indigo-950/40' : status === 'approved' ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-red-500/30 bg-red-950/20';
  return <div className={`rounded border text-[11px] transition-colors ${containerClass}`}>
            {/* Header: tool name + risk badge */}
            <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
                <Zap size={11} className="text-yellow-400" />
                <span className="font-mono font-medium text-yellow-400">{toolName}</span>
                <span className="ml-auto">
                    <RiskBadge tier={tier} />
                </span>
            </div>

            {/* Consensus badge — shown when consensusOutcome is provided */}
            {consensusOutcome && <div className="border-b border-white/5 px-3 py-1.5">
                    <ConsensusBadge outcome={consensusOutcome} reasoning={consensusReasoning} />
                </div>}

            {/* Mutation summary */}
            <div aria-label="Mutation summary" className="border-b border-white/5 px-3 py-1.5 font-mono text-[var(--spacing.2, 8px)] text-indigo-300">
                {summary}
            </div>

            {/* Reasoning */}
            {reasoning && <p aria-label="AI reasoning" className="border-b border-white/5 px-3 py-1.5 italic text-zinc-400">
                    {reasoning}
                </p>}

            {/* Before/After diff — shown only when we have a valid snippet */}
            {diffResult && diffResult.length > 0 && <div className="border-b border-white/5 px-3 py-2 space-y-1">
                    <p className="text-[var(--spacing.2, 8px)] font-medium uppercase tracking-wider text-zinc-500">Diff</p>
                    <DiffBlock lines={diffResult} />
                </div>}

            {/* Fallback: show before snippet alone when diff is not computable */}
            {beforeSnippet && (!diffResult || diffResult.length === 0) && <div className="border-b border-white/5 px-3 py-2 space-y-1">
                    <p className="text-[var(--spacing.2, 8px)] font-medium uppercase tracking-wider text-zinc-500">Before</p>
                    <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 font-mono text-[var(--spacing.2, 8px)] leading-5">
                        <div className="whitespace-pre px-2 py-1 text-zinc-400">{beforeSnippet}</div>
                    </div>
                </div>}

            {/* CHRON.1 reason input (pending + amber/red only) */}
            {isPending && (tier === 'amber' || tier === 'red') && <div className="flex flex-col gap-1 border-t border-white/5 px-3 py-2">
                    {tier === 'red' && <p className="text-[var(--spacing.2, 8px)] text-zinc-500">{framingForTool(toolName)}</p>}
                    <input type="text" aria-label="Why is this change needed?" placeholder={tier === 'red' ? redPlaceholder : amberPlaceholder} maxLength={500} value={reasonText} onChange={e => setReasonText(e.target.value)} className={`w-full rounded border bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 ${inputBorderClass}`} />
                    {tier === 'red' && <p className="text-[var(--spacing.2, 8px)] text-zinc-600">
                            Examples: &ldquo;Approved by brand team&rdquo;, &ldquo;Required by WCAG exception&rdquo;, &ldquo;Temporary fix&rdquo;
                        </p>}
                </div>}

            {/* Action buttons (pending only) */}
            {isPending && <div className="flex gap-2 border-t border-white/5 px-3 py-2">
                    <button type="button" aria-label="Accept mutation" onClick={handleApprove} disabled={redApplyDisabled} className="flex items-center gap-1 rounded bg-emerald-600/20 px-2.5 py-1 text-[var(--spacing.2, 8px)] font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600/20">
                        <CheckCircle2 size={11} />
                        Apply
                    </button>
                    <button type="button" aria-label="Reject mutation" onClick={() => onReject(call.id)} className="flex items-center gap-1 rounded bg-red-600/10 px-2.5 py-1 text-[var(--spacing.2, 8px)] font-medium text-red-400 transition-colors hover:bg-red-600/20">
                        <XCircle size={11} />
                        Reject
                    </button>
                </div>}

            {/* Applied / rejected badge */}
            {!isPending && <div className="px-3 py-1.5 text-[var(--spacing.2, 8px)]">
                    {status === 'approved' ? <span className="text-emerald-400">Applied</span> : <span className="text-red-400">Rejected</span>}
                </div>}
        </div>;
}