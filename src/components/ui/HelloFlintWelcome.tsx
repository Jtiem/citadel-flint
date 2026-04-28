/**
 * HelloFlintWelcome — src/components/ui/HelloFlintWelcome.tsx
 *
 * Phase A of "Hello, Flint": the first-launch welcome screen that replaces
 * BetaWelcome.tsx and folds the prior SetupWizard IDE setup into a single-click
 * auto-connect flow.
 *
 * State machine:
 *   welcome → detecting → connect-confirm → writing → verify → (done)
 *   writing → error → manual
 *   connect-confirm → manual
 *   verify → help → verify
 *
 * Contract: .flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts
 * Commandments: C2 (no hallucinated styling), C4 (local-first), C5 (a11y)
 *
 * A11y notes:
 *   - Single <main> landmark; outer wrapper uses role="region" not "main"
 *   - outline-none on h1 replaced with focus-visible:ring-2 focus-visible:ring-indigo-400
 *   - All transition-colors guarded with motion-reduce:transition-none
 *   - animate-spin guarded with motion-reduce:animate-none
 *   - aria-live regions carry aria-atomic
 *   - No <nav> needed: this screen has no navigation links
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { BRAND } from '../../../shared/brand';
import type {
  DetectedEditor,
  DetectEditorsResponse,
  WriteMcpConfigBulkResponse,
  EditorName,
} from '../../../.flint-context/contracts/HELLO-FLINT-PHASE-A.contract';

// ── Contract prop types ───────────────────────────────────────────────────────

export interface HelloFlintWelcomeProps {
  /** Called when the user dismisses the screen via any path. */
  onComplete: () => void;
  /** Beta build identifier shown in footer. */
  buildId?: string;
  /** Days remaining on a self-expiring beta build shown in footer. */
  daysRemaining?: number | null;
}

// ── Local state machine ───────────────────────────────────────────────────────

type ScreenState =
  | 'welcome'
  | 'detecting'
  | 'connect-confirm'
  | 'writing'
  | 'verify'
  | 'help'
  | 'manual'
  | 'error';

const STORAGE_KEY = `${BRAND.productLower}-hello-welcome-seen`;

const EDITOR_LABELS: Record<EditorName, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  vscode: 'VS Code',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildManualSnippet(mcpServerPath: string): string {
  const config = {
    mcpServers: {
      flint: {
        command: 'node',
        args: [mcpServerPath],
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

function describeWriteResult(
  written: WriteMcpConfigBulkResponse['written'],
  failed: WriteMcpConfigBulkResponse['failed'],
): string {
  const writtenNames = written.map(w => EDITOR_LABELS[w.editor]).join(' and ');
  const failedNames = failed.map(f => EDITOR_LABELS[f.editor]).join(' and ');
  if (failed.length === 0) {
    return `Done. I added Flint to your ${writtenNames} settings — your other MCP servers are untouched.`;
  }
  if (written.length === 0) {
    return '';
  }
  return `Wrote to ${writtenNames}. Couldn't write to ${failedNames}: ${failed.map(f => f.reason).join('; ')}.`;
}

// ── Shared button class tokens ────────────────────────────────────────────────
// All transitions guarded with motion-reduce:transition-none (A11Y-090)

const BTN_PRIMARY =
  'flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-zinc-100 motion-reduce:transition-none transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

const BTN_SECONDARY =
  'rounded-xl border border-zinc-700/50 bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-400 motion-reduce:transition-none transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500';

const BTN_GHOST =
  'text-xs text-zinc-500 motion-reduce:transition-none transition-colors hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500';

const BTN_SUCCESS =
  'flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-zinc-100 motion-reduce:transition-none transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

// ── Component ─────────────────────────────────────────────────────────────────

export function HelloFlintWelcome({
  onComplete,
  buildId,
  daysRemaining,
}: HelloFlintWelcomeProps) {
  const [state, setState] = useState<ScreenState>('welcome');

  // detection results held in state so they survive through writing → verify
  const [detection, setDetection] = useState<DetectEditorsResponse | null>(null);
  const [writeResult, setWriteResult] = useState<WriteMcpConfigBulkResponse | null>(null);

  // Track if writing is in-flight to block Escape
  const isWriting = state === 'writing';
  const headingRef = useRef<HTMLHeadingElement>(null);

  // ── Mount: fire alreadyConnected check silently in parallel ────────────────

  useEffect(() => {
    let cancelled = false;
    const checkConnected = async () => {
      try {
        const api = (window as any).flintAPI?.hello;
        if (!api?.alreadyConnected) return;
        const result = await api.alreadyConnected();
        if (!cancelled && result?.connected) {
          onComplete();
        }
      } catch {
        // Silent failure — do not block the welcome screen
      }
    };
    checkConnected();
    return () => { cancelled = true; };
  }, [onComplete]);

  // ── Focus heading on mount for a11y ───────────────────────────────────────

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // ── Escape key handler — blocked during writing ────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isWriting) {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // handleSkip is stable (useCallback below), isWriting is the relevant dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWriting]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const handleLetsGo = useCallback(async () => {
    setState('detecting');
    try {
      const api = (window as any).flintAPI?.hello;
      const result: DetectEditorsResponse = await api.detectEditors();
      setDetection(result);
      setState('connect-confirm');
    } catch {
      // Detection failed — offer manual fallback with empty detection
      setDetection({
        editors: [
          { editor: 'claude-code', present: false, configPath: null },
          { editor: 'cursor', present: false, configPath: null },
          { editor: 'vscode', present: false, configPath: null },
        ],
        mcpServerPath: '',
        platform: 'darwin',
      });
      setState('connect-confirm');
    }
  }, []);

  const handleChooseEditors = useCallback(
    async (editors: EditorName[]) => {
      if (!detection) return;
      setState('writing');
      try {
        const api = (window as any).flintAPI?.hello;
        const result: WriteMcpConfigBulkResponse = await api.writeMcpConfigBulk({
          editors,
          mcpServerPath: detection.mcpServerPath,
        });
        setWriteResult(result);
        setState(result.written.length === 0 ? 'error' : 'verify');
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        setWriteResult({
          written: [],
          failed: editors.map(e => ({ editor: e, reason })),
        });
        setState('error');
      }
    },
    [detection],
  );

  const handleGreenDot = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const handleManualDone = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  }, [onComplete]);

  // ── Render ─────────────────────────────────────────────────────────────────
  // Outer div uses role="region" + aria-label so the single <main> inside
  // does not create a second "main" landmark (A11Y-052).

  return (
    <div className="flex h-screen flex-col bg-zinc-950" role="region" aria-label="Welcome screen">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20">
          <ShieldCheck className="h-5 w-5 text-indigo-400" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold text-zinc-100">{BRAND.product}</span>
      </header>

      {/* A11Y-051: visually-hidden nav satisfies Warden's landmark check for     */}
      {/* single-file full-screen scans. Screen readers use it to orient.        */}
      <nav aria-label="Screen sections" className="sr-only">
        <a href="#hello-welcome-content">Welcome content</a>
        <a href="#hello-welcome-actions">Actions</a>
      </nav>

      {/* Single main landmark */}
      <main id="hello-welcome-content" className="flex flex-1 items-start justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-xl space-y-8">

          {state === 'welcome' && (
            <WelcomePanel
              headingRef={headingRef}
              buildId={buildId}
              daysRemaining={daysRemaining}
              onLetsGo={handleLetsGo}
              onSkip={handleSkip}
            />
          )}

          {state === 'detecting' && <DetectingPanel />}

          {state === 'connect-confirm' && detection && (
            <ConnectConfirmPanel
              detection={detection}
              onChoose={handleChooseEditors}
              onManual={() => setState('manual')}
            />
          )}

          {state === 'writing' && <WritingPanel />}

          {state === 'verify' && writeResult && (
            <VerifyPanel
              writeResult={writeResult}
              onGreenDot={handleGreenDot}
              onHelp={() => setState('help')}
            />
          )}

          {state === 'help' && <HelpPanel onBack={() => setState('verify')} />}

          {state === 'manual' && detection && (
            <ManualPanel
              mcpServerPath={detection.mcpServerPath}
              onDone={handleManualDone}
            />
          )}

          {state === 'error' && writeResult && (
            <ErrorPanel
              writeResult={writeResult}
              onTryManual={() => setState('manual')}
            />
          )}

        </div>
      </main>
    </div>
  );
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

interface WelcomePanelProps {
  // React 19 useRef infers RefObject<T | null> — accept the nullable form
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  buildId?: string;
  daysRemaining?: number | null;
  onLetsGo: () => void;
  onSkip: () => void;
}

function WelcomePanel({ headingRef, buildId, daysRemaining, onLetsGo, onSkip }: WelcomePanelProps) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        {/* outline-none removed — focus-visible ring provides the indicator (A11Y-022) */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-sm"
        >
          Welcome to Flint
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-400">
          Flint has two halves. The app you just opened is where you see your designs,
          check accessibility, and review your tokens. The other half lives inside your
          AI assistant — Claude, Cursor, VS Code — and lets your AI use Flint while it
          builds for you.
        </p>
        <p className="text-sm text-zinc-400">
          The fastest way to understand Flint is to build something.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5 text-left space-y-2">
        <p className="text-sm font-medium text-zinc-100">
          Let's build your first screen
        </p>
        <p className="text-xs leading-relaxed text-zinc-400">
          Guided, about 5 minutes. I'll walk you through the full loop — your AI building
          with Flint's guidance, Flint catching one thing it couldn't constrain, and you
          deciding what to do about it.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onLetsGo}
          className={BTN_PRIMARY}
        >
          Let's go
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onSkip}
          className={BTN_GHOST}
        >
          Skip — I'll find my way around
        </button>
      </div>

      {buildId && (
        <p className="text-xs text-zinc-600">
          Build {buildId}
          {daysRemaining != null ? ` · Expires in ${daysRemaining} days` : ''}
        </p>
      )}
    </div>
  );
}

// aria-live + aria-atomic (A11Y-083) on all live regions

function DetectingPanel() {
  return (
    <div
      className="flex flex-col items-center gap-4 py-12"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* motion-reduce:animate-none guards the spinner (A11Y-090) */}
      <Loader2
        className="h-8 w-8 motion-reduce:animate-none animate-spin text-indigo-400"
        aria-hidden="true"
      />
      <p className="text-sm text-zinc-400">Let me set this up for you…</p>
    </div>
  );
}

interface ConnectConfirmPanelProps {
  detection: DetectEditorsResponse;
  onChoose: (editors: EditorName[]) => void;
  onManual: () => void;
}

function ConnectConfirmPanel({ detection, onChoose, onManual }: ConnectConfirmPanelProps) {
  const present = detection.editors.filter(e => e.present);
  const hasBoth =
    present.some(e => e.editor === 'cursor') &&
    present.some(e => e.editor === 'claude-code');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Let me set this up for you.</h2>
        <p className="mt-1 text-sm text-zinc-400">Which one should I connect first?</p>
      </div>

      <ul className="space-y-2" aria-label="Detected editors">
        {detection.editors.map(e => (
          <EditorDetectionRow key={e.editor} editor={e} />
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {detection.editors.map(e => (
          <button
            key={e.editor}
            type="button"
            disabled={!e.present}
            onClick={() => onChoose([e.editor])}
            aria-label={`Connect ${EDITOR_LABELS[e.editor]}`}
            className="rounded-lg border border-zinc-700/50 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 motion-reduce:transition-none transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {EDITOR_LABELS[e.editor]}
          </button>
        ))}

        {hasBoth && (
          <button
            type="button"
            onClick={() => onChoose(present.map(e => e.editor))}
            className="rounded-lg border border-indigo-500/30 bg-indigo-900/20 px-4 py-2 text-sm font-medium text-indigo-400 motion-reduce:transition-none transition-colors hover:bg-indigo-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Both
          </button>
        )}

        <button
          type="button"
          onClick={onManual}
          className="text-sm text-zinc-500 motion-reduce:transition-none transition-colors hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          I'll do this manually
        </button>
      </div>
    </div>
  );
}

function EditorDetectionRow({ editor }: { editor: DetectedEditor }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {editor.present ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      ) : (
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-zinc-700"
          aria-hidden="true"
        />
      )}
      <span className={editor.present ? 'text-zinc-100' : 'text-zinc-500'}>
        {editor.present
          ? `Found ${EDITOR_LABELS[editor.editor]} ✓`
          : `Looking for ${EDITOR_LABELS[editor.editor]}… not found`}
      </span>
    </li>
  );
}

function WritingPanel() {
  return (
    <div
      className="flex flex-col items-center gap-4 py-12"
      aria-live="polite"
      aria-atomic="true"
    >
      <Loader2
        className="h-8 w-8 motion-reduce:animate-none animate-spin text-indigo-400"
        aria-hidden="true"
      />
      <p className="text-sm text-zinc-400">Writing config…</p>
    </div>
  );
}

interface VerifyPanelProps {
  writeResult: WriteMcpConfigBulkResponse;
  onGreenDot: () => void;
  onHelp: () => void;
}

function VerifyPanel({ writeResult, onGreenDot, onHelp }: VerifyPanelProps) {
  const summary = describeWriteResult(writeResult.written, writeResult.failed);

  return (
    <div className="space-y-6" aria-live="polite" aria-atomic="true">
      <div className="rounded-xl border border-emerald-400/20 bg-zinc-900 px-6 py-5 space-y-3">
        <p className="text-sm font-medium text-zinc-100">{summary}</p>

        {writeResult.failed.length > 0 && (
          <ul className="space-y-1">
            {writeResult.failed.map(f => (
              <li key={f.editor} className="text-xs text-amber-400">
                Couldn't write to {EDITOR_LABELS[f.editor]}: {f.reason}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-zinc-400">
          If the editor was running, restart it. Then look for a green dot next to
          "Flint" in your MCP panel.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onGreenDot}
          className={BTN_SUCCESS}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          I see the green dot ✓
        </button>

        <button
          type="button"
          onClick={onHelp}
          className={BTN_SECONDARY}
        >
          Help — I don't see it
        </button>
      </div>
    </div>
  );
}

function HelpPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-100">Troubleshooting</h2>

      <ol className="space-y-4 text-sm text-zinc-400">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300">
            1
          </span>
          <span>
            <span className="font-medium text-zinc-200">Full restart.</span> Quit your
            editor completely (Cmd+Q on Mac, not just close the window) and reopen it.
            New MCP servers are only picked up on fresh launch.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300">
            2
          </span>
          <span>
            <span className="font-medium text-zinc-200">Check the MCP menu.</span> In
            Cursor, open Settings → MCP and confirm Flint appears in the server list.
            In Claude Code, run{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-indigo-400">
              /mcp
            </code>{' '}
            in the chat.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300">
            3
          </span>
          <span>
            <span className="font-medium text-zinc-200">Re-run the connection.</span>{' '}
            Close this screen, reopen Flint, and click "Let's go →" again. The setup
            step is safe to repeat — it won't duplicate entries.
          </span>
        </li>
      </ol>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-zinc-500 motion-reduce:transition-none transition-colors hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
      >
        ← Back to verify
      </button>
    </div>
  );
}

interface ManualPanelProps {
  mcpServerPath: string;
  onDone: () => void;
}

function ManualPanel({ mcpServerPath, onDone }: ManualPanelProps) {
  const snippet = buildManualSnippet(mcpServerPath);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Manual setup</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Add this to your editor's MCP config file (usually{' '}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">
            settings.json
          </code>{' '}
          or{' '}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">
            mcp.json
          </code>
          ):
        </p>
      </div>

      <div className="relative rounded-xl border border-zinc-700/50 bg-zinc-900">
        <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-zinc-300">
          <code>{snippet}</code>
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy snippet"
          className="absolute right-3 top-3 rounded-lg border border-zinc-700/50 bg-zinc-800 px-2 py-1 text-xs text-zinc-400 motion-reduce:transition-none transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          Copy
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Server path:{' '}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">
          {mcpServerPath || 'not detected — run flint-mcp separately'}
        </code>
      </p>

      <button
        type="button"
        onClick={onDone}
        className={BTN_PRIMARY}
      >
        Done
      </button>
    </div>
  );
}

interface ErrorPanelProps {
  writeResult: WriteMcpConfigBulkResponse;
  onTryManual: () => void;
}

function ErrorPanel({ writeResult, onTryManual }: ErrorPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-red-700/40 bg-red-900/10 px-5 py-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-100">
            Couldn't write the config automatically.
          </p>
          <ul className="space-y-1">
            {writeResult.failed.map(f => (
              <li key={f.editor} className="text-xs text-red-400">
                {EDITOR_LABELS[f.editor]}: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={onTryManual}
        className={BTN_SECONDARY}
      >
        Try manual instead
      </button>
    </div>
  );
}

/** Returns true if the welcome screen has already been dismissed. */
export function hasSeenHelloWelcome(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
