/**
 * PasteAuditModal — src/components/ui/PasteAuditModal.tsx
 *
 * FORGE.4a: "Paste code" entry point. User pastes JSX code, Flint creates
 * a temp file, runs audit, and shows results. Quick compliance check
 * without opening a full project.
 *
 * Triggered from LaunchScreen as a tertiary action.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useCallback, useEffect } from 'react';
import { X, Clipboard, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, ChevronRight } from 'lucide-react';
import { FocusTrap } from './FocusTrap';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditResult {
  violations: number;
  warnings: string[];
  grade?: string;
}

/** Structured audit error — message shown by default, detail only on expand. */
interface AuditError {
  /** User-facing message. Never contains a raw stack trace. */
  message: string;
  /** Technical detail for debugging. Hidden behind the expandable toggle. */
  detail?: string;
}
export interface PasteAuditModalProps {
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PasteAuditModal({
  onClose
}: PasteAuditModalProps) {
  const [code, setCode] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<AuditError | null>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  const handleAudit = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsAuditing(true);
    setError(null);
    setResult(null);
    try {
      const mcp = window.flintAPI.mcp;
      if (!mcp?.callTool) {
        throw new Error('MCP not connected. Open a project first.');
      }

      // Write a temp file and audit it via MCP
      // We use flint_universal_audit which can audit inline code snippets
      const auditResult = await mcp.callTool('flint_universal_audit', {
        code: trimmed,
        language: 'tsx'
      });

      // Parse the result
      const content = (auditResult as {
        content?: Array<{
          type: string;
          text: string;
        }>;
      })?.content;
      const text = Array.isArray(content) ? content[0]?.text ?? '{}' : '{}';
      try {
        const parsed = JSON.parse(text);
        const violations = parsed.violations ?? parsed.totalViolations ?? 0;
        const warnings: string[] = [];

        // Extract violation messages
        if (Array.isArray(parsed.diagnostics)) {
          for (const d of parsed.diagnostics.slice(0, 20)) {
            warnings.push(d.message ?? d.ruleId ?? 'Unknown issue');
          }
        } else if (Array.isArray(parsed.violations)) {
          for (const v of parsed.violations.slice(0, 20)) {
            warnings.push(typeof v === 'string' ? v : v.message ?? v.ruleId ?? 'Unknown');
          }
        }
        setResult({
          violations: typeof violations === 'number' ? violations : warnings.length,
          warnings,
          grade: parsed.grade ?? undefined
        });
      } catch {
        // If we can't parse JSON, show the raw text as a single warning
        setResult({
          violations: 1,
          warnings: [text.slice(0, 500)]
        });
      }
    } catch (err) {
      if (err instanceof Error) {
        setError({
          message: err.message,
          detail: err.stack
        });
      } else {
        setError({
          message: 'Audit failed. Please try again.'
        });
      }
    } finally {
      setIsAuditing(false);
    }
  }, [code]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => {
    if (e.target === e.currentTarget) onClose();
  }}>
            <FocusTrap>
                <div role="dialog" aria-modal="true" aria-labelledby="paste-audit-title" className="relative flex max-h-[var(--spacing.1, 4px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="paste-audit-modal">
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-3">
                        <div className="flex items-center gap-2">
                            <Clipboard size={16} className="text-indigo-400" aria-hidden="true" />
                            <h2 id="paste-audit-title" className="text-sm font-semibold text-zinc-100">
                                Paste and Audit
                            </h2>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close paste audit modal" className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300" data-testid="paste-audit-close">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
                        {!result && <>
                                <p className="text-xs text-zinc-400">
                                    Paste JSX code below to check design system compliance, accessibility, and token usage.
                                </p>
                                <textarea value={code} onChange={e => setCode(e.target.value)} placeholder={'export function MyComponent() {\n  return (\n    <div className="bg-[#ff0000] p-4">\n      Hello\n    </div>\n  )\n}'} rows={12} spellCheck={false} autoFocus className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-200 placeholder-zinc-700 outline-none transition-colors focus:border-indigo-500/50" aria-label="Paste JSX code to audit" data-testid="paste-audit-textarea" />
                            </>}

                        {/* Results */}
                        {result && <div data-testid="paste-audit-results">
                                <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 ${result.violations === 0 ? 'border border-emerald-500/30 bg-emerald-900/15' : 'border border-amber-500/30 bg-amber-900/15'}`}>
                                    {result.violations === 0 ? <ShieldCheck size={18} className="text-emerald-400" aria-hidden="true" /> : <ShieldAlert size={18} className="text-amber-400" aria-hidden="true" />}
                                    <div>
                                        <p className={`text-sm font-medium ${result.violations === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                                            {result.violations === 0 ? 'All clear — no issues found' : `${result.violations} issue${result.violations !== 1 ? 's' : ''} found`}
                                        </p>
                                        {result.grade && <p className="text-xs text-zinc-400">
                                                Health grade: <span className="font-bold">{result.grade}</span>
                                            </p>}
                                    </div>
                                </div>

                                {result.warnings.length > 0 && <ul className="mt-3 space-y-1" data-testid="paste-audit-warnings">
                                        {result.warnings.map((w, i) => <li key={i} className="rounded border border-zinc-800 bg-zinc-800/40 px-2.5 py-1.5 text-xs text-zinc-300">
                                                {w}
                                            </li>)}
                                    </ul>}

                                <button type="button" onClick={() => {
              setResult(null);
              setCode('');
            }} className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-300" data-testid="paste-audit-reset">
                                    Audit another snippet
                                </button>
                            </div>}

                        {error && <AuditErrorCard error={error} />}
                    </div>

                    {/* Footer */}
                    {!result && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
                            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-300">
                                Cancel
                            </button>
                            <button type="button" onClick={() => {
            void handleAudit();
          }} disabled={!code.trim() || isAuditing} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40" data-testid="paste-audit-submit">
                                {isAuditing ? <>
                                        <Loader2 size={12} className="motion-safe:animate-spin" aria-hidden="true" />
                                        Auditing...
                                    </> : 'Audit'}
                            </button>
                        </div>}
                </div>
            </FocusTrap>
        </div>;
}

// ── AuditErrorCard ────────────────────────────────────────────────────────────

/**
 * Structured error card for audit failures.
 *
 * Default view: icon + user-facing message only.
 * Expandable "Show details" toggle reveals technical detail for debugging.
 * Stack traces are never visible in the default (collapsed) state.
 */
function AuditErrorCard({
  error
}: {
  error: AuditError;
}) {
  const [expanded, setExpanded] = useState(false);
  return <div className="rounded-lg border border-red-700/40 bg-red-900/10 px-3 py-2.5" role="alert" data-testid="paste-audit-error">
            <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
                <p className="text-xs text-red-300" data-testid="paste-audit-error-message">
                    {error.message}
                </p>
            </div>

            {error.detail && <div className="mt-2">
                    <button type="button" onClick={() => setExpanded(v => !v)} className="flex items-center gap-1 text-[var(--spacing.3, 12px)] text-zinc-500 transition-colors hover:text-zinc-300" aria-expanded={expanded} data-testid="paste-audit-error-details-toggle">
                        <ChevronRight size={10} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
                        {expanded ? 'Hide details' : 'Show details'}
                    </button>

                    {expanded && <pre className="mt-1.5 max-h-32 overflow-auto rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[var(--spacing.2, 8px)] text-zinc-500" data-testid="paste-audit-error-detail">
                            {error.detail}
                        </pre>}
                </div>}
        </div>;
}