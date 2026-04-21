/**
 * DemoWalkthrough — src/components/ui/DemoWalkthrough.tsx
 *
 * FORGE.1b + FORGE.1c — Workspace orientation step (Step 0) + demo-to-project
 * handoff (Step 4).
 *
 * Step 0: "Welcome to Glass" — no close button, single forward CTA.
 * Steps 1–3: Original violation → fix → gate clears loop.
 * Step 4: "Nice work! Ready to try on your own code?" — conversion CTA.
 *
 * Total steps: 5 (0 through 4).
 *
 * localStorage key: `flint-demo-walkthrough-complete`
 * If already set to 'true', returns null immediately.
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
const STORAGE_KEY = 'flint-demo-walkthrough-complete';
interface ContentStep {
  kind: 'content';
  title: string;
  body: string;
  targetTestId: string;
  buttonLabel: string;
  hideClose?: boolean;
}
interface HandoffStep {
  kind: 'handoff';
}
type Step = ContentStep | HandoffStep;
const STEPS: Step[] = [
// Step 0 — Workspace orientation (no close button)
{
  kind: 'content',
  title: 'Welcome to Glass',
  body: 'This is your canvas. Components live here. Governance results appear on the right. Let\'s see what Flint found.',
  targetTestId: '',
  buttonLabel: 'Let\'s go →',
  hideClose: true
},
// Step 1
{
  kind: 'content',
  title: 'These are drift items',
  body: 'Flint found 8 issues in this form — missing labels, contrast failures, and hardcoded colors.',
  targetTestId: 'governance-dashboard-violations',
  buttonLabel: 'Next →'
},
// Step 2
{
  kind: 'content',
  title: 'Click Fix to resolve them',
  body: 'Each issue has an auto-fix. Click Fix to let Flint correct it automatically.',
  targetTestId: 'fix-all-button',
  buttonLabel: 'Next →'
},
// Step 3
{
  kind: 'content',
  title: 'The gate clears',
  body: 'Once all issues are resolved, the Export Gate opens. Your code is compliant.',
  targetTestId: 'export-gate-indicator',
  buttonLabel: 'Next →'
},
// Step 4 — Handoff (handled separately in render)
{
  kind: 'handoff'
}];

// Content steps only (for positioning logic)
const CONTENT_STEPS = STEPS.filter((s): s is ContentStep => s.kind === 'content');
const TOTAL_STEPS = STEPS.length; // 5

interface TooltipPos {
  top: string;
  left: string;
}
const FALLBACK_POS: TooltipPos = {
  top: '50%',
  left: '50%'
};
export interface DemoWalkthroughProps {
  onDismiss: () => void;
  /** Called when user clicks "Open My Project" on the handoff step */
  onProjectHandoff?: () => void;
}
export function DemoWalkthrough({
  onDismiss,
  onProjectHandoff
}: DemoWalkthroughProps) {
  const [completed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<TooltipPos>(FALLBACK_POS);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = STEPS[step];

  // Reposition tooltip to target element
  useEffect(() => {
    if (current.kind !== 'content' || !current.targetTestId) {
      setPos(FALLBACK_POS);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-testid="${current.targetTestId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 12 + 'px',
        left: rect.left + 'px'
      });
    } else {
      setPos(FALLBACK_POS);
    }
  }, [step, current]);

  // Move focus into the dialog on mount (WCAG 2.4.3 Focus Order)
  useEffect(() => {
    if (!completed) {
      const t = setTimeout(() => {
        dialogRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [completed]);

  // Move focus to the step heading on step transitions
  useEffect(() => {
    if (!completed && step > 0) {
      const t = setTimeout(() => {
        headingRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [step, completed]);
  if (completed) return null;
  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onDismiss();
  };
  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };
  const isFallback = pos === FALLBACK_POS;
  const posStyle: React.CSSProperties = isFallback ? {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)'
  } : {
    top: pos.top,
    left: pos.left
  };

  // ── Step 4: Handoff ────────────────────────────────────────────────────────
  if (current.kind === 'handoff') {
    return <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden="false">
                <div ref={dialogRef} className="absolute w-80 rounded-lg border border-indigo-500 bg-zinc-900 p-5 shadow-xl shadow-black/40 pointer-events-auto" style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }} role="dialog" aria-modal="true" aria-label={`Demo walkthrough: step ${step + 1} of ${TOTAL_STEPS}`} tabIndex={-1}>
                    <p className="mb-2 text-[var(--spacing.2, 8px)] font-medium uppercase tracking-widest text-indigo-400" aria-hidden="true">
                        Step {step + 1} of {TOTAL_STEPS}
                    </p>
                    <h2 ref={headingRef} tabIndex={-1} className="mb-2 text-sm font-semibold text-zinc-100 outline-none">
                        Nice work! Ready to try on your own code?
                    </h2>
                    <p className="mb-4 text-xs leading-relaxed text-zinc-400">
                        You've seen how Flint catches violations and fixes them automatically. Now try it on a real project.
                    </p>
                    <div className="flex flex-col gap-2">
                        <button type="button" data-testid="handoff-open-project" onClick={() => {
            dismiss();
            onProjectHandoff?.();
          }} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-zinc-100 transition-colors hover:bg-indigo-500">
                            Open My Project
                        </button>
                        <button type="button" data-testid="handoff-try-another" onClick={() => setStep(0)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800/40 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70">
                            Try Another Demo
                        </button>
                        <button type="button" data-testid="handoff-keep-exploring" onClick={dismiss} className="w-full text-center text-xs text-zinc-500 transition-colors hover:text-zinc-300">
                            Keep Exploring
                        </button>
                    </div>
                </div>
            </div>;
  }

  // ── Steps 0–3: Content ─────────────────────────────────────────────────────
  const contentStep = current as ContentStep;

  // Dot count reflects only content steps (steps 0–3) for visual progress
  const contentStepIndex = CONTENT_STEPS.indexOf(contentStep);
  return <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden="false">
            <div ref={dialogRef} className="absolute w-72 rounded-lg border border-indigo-500 bg-zinc-900 p-4 shadow-xl shadow-black/40 pointer-events-auto" style={posStyle} role="dialog" aria-modal="true" aria-label={`Demo walkthrough: step ${step + 1} of ${TOTAL_STEPS}`} tabIndex={-1}>
                {/* Close / Skip — hidden on Step 0 (orientation) */}
                {!contentStep.hideClose && <button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors" aria-label="Close demo walkthrough">
                        <X size={14} aria-hidden="true" />
                    </button>}

                {/* Step counter */}
                <p className="mb-2 text-[var(--spacing.2, 8px)] font-medium uppercase tracking-widest text-indigo-400" aria-hidden="true">
                    Step {step + 1} of {TOTAL_STEPS}
                </p>

                {/* Title */}
                <h2 ref={headingRef} tabIndex={-1} className="mb-1.5 text-sm font-semibold text-zinc-100 outline-none">
                    {contentStep.title}
                </h2>

                {/* Body */}
                <p className="text-xs leading-relaxed text-zinc-400">{contentStep.body}</p>

                {/* Step dots + action button */}
                <div className="mt-4 flex items-center justify-between">
                    {/* Dot indicators — show content steps 0–3 */}
                    <div role="tablist" aria-label="Walkthrough progress" className="flex items-center gap-1.5">
                        {CONTENT_STEPS.map((_, i) => <span key={i} role="tab" aria-label={`Step ${i + 1} of ${TOTAL_STEPS}`} aria-current={i === contentStepIndex ? 'step' : undefined} aria-selected={i === contentStepIndex} className={`block h-1.5 rounded-full motion-safe:transition-all ${i === contentStepIndex ? 'w-4 bg-indigo-400' : 'w-1.5 bg-zinc-700'}`} />)}
                    </div>

                    {/* Next / Done */}
                    <button type="button" onClick={handleNext} aria-label={step < STEPS.length - 1 ? `Next step (${step + 1} of ${TOTAL_STEPS})` : 'Done — close walkthrough'} className="rounded px-3 py-1.5 text-xs font-medium bg-indigo-600 text-zinc-100 hover:bg-indigo-500 motion-safe:transition-colors">
                        {contentStep.buttonLabel}
                    </button>
                </div>
            </div>
        </div>;
}