/**
 * LaunchScreen — src/components/ui/LaunchScreen.tsx
 *
 * FORGE.1 Sprint 1: 3-channel entry system (replaces the 4-tile JTBD layout).
 *
 * Layout (top → bottom):
 *   1. Header  — gradient brand + subtitle
 *   2. MCP context banner  — shown when MCP is already connected
 *   3. Three primary channels (Start from idea / Start from Figma / Start from existing code)
 *   4. Inline expanded flow  — renders below channels when one is active
 *   5. Demo section  — DemoScenarioPicker (unchanged persistent surface)
 *   6. Recent projects  — conditional; only when records exist
 *   7. Paste-Audit tertiary action
 *   8. Footer escape hatch  — "Open any folder..." + "Connect to IDE"
 *
 * The primary "New Project" CTA has been replaced by the three-channel set.
 * DemoScenarioPicker, Recent Projects, and Paste-Audit are NOT channels —
 * they are persistent surfaces and are not counted in the channel invariant.
 *
 * Contract: FORGE.1 — ForgeChannel type (FORGE.1.contract.ts)
 * Commandments respected: 2 (no hallucinated styling), 4 (local-first).
 */

import { useState, useEffect, useCallback } from 'react';
import { BRAND } from '../../../shared/brand';
import { resolveWebOpenFolder, cancelWebOpenFolder, hasWebOpenFolderPending } from '../../adapters/web-api';
import { FolderOpen, Clock, Trash2, Lightbulb, Figma, GitBranch, ArrowRight, Loader2, CheckCircle, ChevronRight, Link2, X, Clipboard } from 'lucide-react';
import type { RecentProject, ProjectEnvironment } from '../../types/flint-api';
import { DemoScenarioPicker } from './DemoScenarioPicker';
import { PasteAuditModal } from './PasteAuditModal';
import { DetectionPreview } from './DetectionPreview';

// ── Types ─────────────────────────────────────────────────────────────────────

/** 3-channel discriminator — replaces the legacy 4-tile JTBDPath. */
type ForgeChannel = 'from-idea' | 'from-figma' | 'from-existing-code' | null;
type FlowStep = 'choose' | 'input' | 'detecting' | 'detected' | 'progress' | 'done';

// Health grade colour mapping — A→green, B→teal, C→yellow, D→orange, F→red
const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-teal-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400'
};
function gradeColor(grade: string | undefined): string {
  if (!grade) return 'text-zinc-500';
  const letter = grade[0]?.toUpperCase() ?? '';
  return GRADE_COLORS[letter] ?? 'text-zinc-500';
}

// ── Channel definitions ───────────────────────────────────────────────────────

// UX-W1 (deferred): "audit only" users currently route through "Start from
// existing code" → Detect → Confirm. Sprint 2 should consider a discoverable
// shortcut (e.g. a tertiary "Audit only, don't open" link) so non-builder
// users have a one-click path. Tracked in the FORGE.1 Phase 2 review.
const CHANNELS = [{
  id: 'from-idea' as const,
  icon: Lightbulb,
  label: 'Start from idea',
  description: 'Describe what you want — MUI default, canvas opens immediately'
}, {
  id: 'from-figma' as const,
  icon: Figma,
  label: 'Start from Figma',
  description: 'Paste a Figma URL — Figma MCP converts design to governed code'
}, {
  id: 'from-existing-code' as const,
  icon: GitBranch,
  label: 'Start from existing code',
  description: 'Folder path or git URL — auto-detects your stack before opening'
}] as const;

// ── Detect web mode ──────────────────────────────────────────────────────────
const isWebMode = typeof (globalThis as Record<string, unknown>).__FLINT_WEB__ !== 'undefined';

// ── Props ─────────────────────────────────────────────────────────────────────

interface LaunchScreenProps {
  onOpenFolder: () => Promise<void>;
  onNewProject: () => Promise<void>;
  onOpenRecent: (projectPath: string) => Promise<void>;
  onLoadDemo: (demoName: string) => Promise<void>;
  /** Opens the SetupWizard as a non-blocking modal for IDE/MCP configuration */
  onConnectIDE?: () => void;
  /** Error message to surface when demo project load fails */
  demoError?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LaunchScreen({
  onOpenFolder,
  onNewProject,
  onOpenRecent,
  onLoadDemo,
  onConnectIDE,
  demoError
}: LaunchScreenProps) {
  const [activeChannel, setActiveChannel] = useState<ForgeChannel>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>('choose');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [mcpConnected, setMcpConnected] = useState(false);

  // Existing-code channel: text input for folder path or git URL
  const [codeInput, setCodeInput] = useState('');
  const [codeInputError, setCodeInputError] = useState<string | null>(null);

  // Web mode: standalone text input for project path
  const [webPathInput, setWebPathInput] = useState('');
  const [webPathError, setWebPathError] = useState<string | null>(null);

  // UX-W4: Figma channel — inline URL input (not modal). Reuses the existing
  // /figma slash-command path via Mason's Figma MCP entry. The actual fetch
  // happens after onNewProject opens the canvas, so for Sprint 1 this just
  // captures the URL and hands off to the host IDE for the design-to-code call.
  const [figmaUrlInput, setFigmaUrlInput] = useState('');
  const [figmaUrlError, setFigmaUrlError] = useState<string | null>(null);

  // Detection results from project:smart-open
  const [detectedEnvironment, setDetectedEnvironment] = useState<ProjectEnvironment | null>(null);
  const [detectedProjectPath, setDetectedProjectPath] = useState<string | null>(null);

  // Demo load error banner
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  // Double-click guard for from-idea channel
  const [creatingIdea, setCreatingIdea] = useState(false);

  // FORGE.4b: Map of project path → health grade letter
  const [healthGrades, setHealthGrades] = useState<Map<string, string>>(new Map());

  // FORGE.4a: Paste and Audit modal
  const [showPasteAudit, setShowPasteAudit] = useState(false);

  // ── Web-mode open-folder signal listener ─────────────────────────────────
  const handleOpenFolderRequest = useCallback(() => {
    setActiveChannel('from-existing-code');
    setFlowStep('input');
  }, []);
  useEffect(() => {
    if (!isWebMode) return;
    window.addEventListener('flint:open-folder-request', handleOpenFolderRequest);
    return () => {
      window.removeEventListener('flint:open-folder-request', handleOpenFolderRequest);
      cancelWebOpenFolder();
    };
  }, [handleOpenFolderRequest]);

  // ── Context detection — runs once on mount ────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    Promise.allSettled([window.flintAPI.mcp?.status(), window.flintAPI.registry.getRecent()]).then(([mcpResult, recentsResult]) => {
      clearTimeout(timeout);
      if (mcpResult.status === 'fulfilled' && mcpResult.value?.connected) {
        setMcpConnected(true);
      }
      if (recentsResult.status === 'fulfilled') {
        setRecentProjects(recentsResult.value ?? []);
      }
      setLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // ── FORGE.4b: Fetch health grades for recent projects ─────────────────────
  useEffect(() => {
    if (recentProjects.length === 0) return;
    const getGrade = window.flintAPI.project?.getHealthGrade;
    if (!getGrade) return;
    let cancelled = false;
    const gradeMap = new Map<string, string>();
    Promise.allSettled(recentProjects.slice(0, 5).map(async p => {
      const result = await getGrade(p.path);
      if (result?.grade && !cancelled) {
        gradeMap.set(p.path, result.grade);
      }
    })).then(() => {
      if (!cancelled && gradeMap.size > 0) {
        setHealthGrades(new Map(gradeMap));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [recentProjects]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    void window.flintAPI.registry.removeProject(id).then(() => {
      setRecentProjects(prev => prev.filter(p => p.id !== id));
    });
  };
  const handleOpenRecent = async (project: RecentProject) => {
    setOpeningPath(project.path);
    try {
      await onOpenRecent(project.path);
    } finally {
      setOpeningPath(null);
    }
  };
  const handleChannelSelect = (channelId: ForgeChannel) => {
    if (activeChannel === channelId) {
      // Deselect
      setActiveChannel(null);
      setFlowStep('choose');
      setCodeInput('');
      setCodeInputError(null);
      setDetectedEnvironment(null);
      setDetectedProjectPath(null);
      return;
    }
    setActiveChannel(channelId);
    setCodeInput('');
    setCodeInputError(null);
    setDetectedEnvironment(null);
    setDetectedProjectPath(null);
    if (channelId === 'from-existing-code') {
      setFlowStep('input');
    } else {
      setFlowStep('choose');
    }
  };

  /** "Start from idea" — calls project:create-scratchpad with MUI default. No folder picker. */
  const handleFromIdea = async () => {
    if (creatingIdea) return;
    setCreatingIdea(true);
    setFlowStep('progress');
    setProgressMessage('Creating your project...');
    try {
      // Scratchpad creates a ready-to-use project with MUI default (CONS-1).
      // The libraryDefault is persisted to detected-environment.json so the
      // subsequent auto-configure pass picks MUI as the active component kit.
      // The caller (App.tsx) handles the FileTreeNode response.
      await window.flintAPI.project.createScratchpad({ libraryDefault: 'mui' });
      // After createScratchpad resolves, onNewProject opens the canvas.
      await onNewProject();
    } catch {
      setFlowStep('choose');
      setActiveChannel(null);
    } finally {
      setCreatingIdea(false);
    }
  };

  /**
   * UX-W4: "Start from Figma" submit — accepts a figma.com URL inline and
   * hands off to the existing Figma MCP path the `/figma` slash command uses.
   *
   * For Sprint 1, the URL is captured here and the canvas is opened via the
   * existing onNewProject path; the host IDE can then call the Figma MCP
   * `get_design_context` tool with the URL. No new infra is invented — Mason's
   * existing entry point owns the design-to-code call.
   */
  const handleFromFigmaSubmit = async () => {
    const trimmed = figmaUrlInput.trim();
    if (!trimmed) {
      setFigmaUrlError('Paste a figma.com URL');
      return;
    }
    if (!/^https?:\/\/(www\.)?figma\.com\//.test(trimmed)) {
      setFigmaUrlError('That does not look like a figma.com URL');
      return;
    }
    setFigmaUrlError(null);
    setFlowStep('progress');
    setProgressMessage('Opening canvas — paste the URL in the IDE chat to convert the design...');
    try {
      // Persist the URL on the window so the host IDE / Mason adapter can
      // pick it up when the canvas mounts. No new IPC channel — reuses the
      // existing onNewProject path.
      (window as unknown as { __FLINT_PENDING_FIGMA_URL?: string }).__FLINT_PENDING_FIGMA_URL = trimmed;
      await onNewProject();
    } catch {
      setFlowStep('choose');
      setActiveChannel(null);
    }
  };

  /** "Start from existing code" — submits the folder path or git URL to project:smart-open. */
  const handleExistingCodeSubmit = async () => {
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setCodeInputError('Enter a folder path or git URL');
      return;
    }
    setCodeInputError(null);

    // In web mode with pending open-folder signal, resolve it
    if (isWebMode && hasWebOpenFolderPending()) {
      setFlowStep('progress');
      setProgressMessage('Opening project...');
      try {
        await resolveWebOpenFolder(trimmed);
      } catch {
        setCodeInputError('Could not open that path. Check it exists and try again.');
        setFlowStep('input');
      }
      return;
    }
    setFlowStep('detecting');
    setProgressMessage('Detecting project environment...');
    try {
      // project:smart-open is provided by Group A (window.flintAPI.project.smartOpen).
      // If Group A hasn't landed yet, fall back to onOpenFolder for the folder path.
      const smartOpen = (window.flintAPI.project as Record<string, unknown>).smartOpen as ((input: string) => Promise<{
        projectPath: string;
        environment: ProjectEnvironment;
        source: 'folder' | 'git-clone';
      }>) | undefined;
      if (smartOpen) {
        const result = await smartOpen(trimmed);
        setDetectedEnvironment(result.environment);
        setDetectedProjectPath(result.projectPath);
        setFlowStep('detected');
      } else {
        // Graceful degradation: treat as folder path, open directly
        setFlowStep('progress');
        setProgressMessage('Opening project...');
        await onOpenFolder();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open that path.';
      setCodeInputError(message);
      setFlowStep('input');
    }
  };

  /** DetectionPreview confirmed — call project:auto-configure then open canvas. */
  const handleDetectionConfirm = async (overrides?: Partial<ProjectEnvironment>) => {
    setFlowStep('progress');
    setProgressMessage('Configuring project...');
    try {
      // CONS-2: thread the user's DetectionPreview overrides into the configure
      // call so a corrected library/framework/CSS choice actually reaches the
      // pipeline. The IPC schema accepts `{ overrides?: { framework?, componentLibrary?, cssFramework? } }`.
      const ipcOverrides = overrides
        ? {
            framework: overrides.framework?.name,
            componentLibrary: overrides.componentLibrary?.name,
            cssFramework: overrides.cssFramework?.name,
          }
        : undefined;
      // Strip undefined fields so the .strict() Zod schema accepts the payload.
      const filteredOverrides = ipcOverrides
        ? Object.fromEntries(Object.entries(ipcOverrides).filter(([, v]) => v !== undefined))
        : undefined;
      const payload = filteredOverrides && Object.keys(filteredOverrides).length > 0
        ? { overrides: filteredOverrides as { framework?: string; componentLibrary?: string; cssFramework?: string } }
        : undefined;
      if (window.flintAPI.project.autoConfigureProject) {
        await window.flintAPI.project.autoConfigureProject(payload);
      }
      await onOpenRecent(detectedProjectPath!);
    } catch {
      setFlowStep('detected');
    }
  };
  const handleDetectionCancel = () => {
    setFlowStep('input');
    setDetectedEnvironment(null);
    setDetectedProjectPath(null);
  };
  const handleWebPathSubmit = async () => {
    const trimmed = webPathInput.trim();
    if (!trimmed) {
      setWebPathError('Please enter a project path');
      return;
    }
    setWebPathError(null);
    setFlowStep('progress');
    setProgressMessage('Opening project...');
    try {
      if (hasWebOpenFolderPending()) {
        await resolveWebOpenFolder(trimmed);
      } else {
        await onOpenRecent(trimmed);
      }
    } catch {
      setWebPathError('Could not open that path. Check that it exists and try again.');
      setFlowStep('choose');
    }
  };
  const handleOpenFolderFooter = async () => {
    if (isWebMode) {
      setActiveChannel('from-existing-code');
      setFlowStep('input');
      return;
    }
    await onOpenFolder();
  };

  // Resolved project name for MCP context banner
  const connectedProjectName = mcpConnected && recentProjects.length > 0 ? recentProjects[0].name : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return <div className="flex h-screen flex-col bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">

            {/* Demo load error banner */}
            {demoError && !demoBannerDismissed && <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-900/20 px-4 py-2.5">
                    <p className="text-xs text-amber-300">
                        Demo project couldn't load. Try opening your own project below.
                    </p>
                    <button type="button" aria-label="Dismiss" onClick={() => setDemoBannerDismissed(true)} className="shrink-0 rounded p-0.5 text-amber-400 transition-colors hover:text-amber-200">
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>}

            {/* 1. Header */}
            <header aria-label={`${BRAND.product} launch screen`} className="flex shrink-0 items-center border-b border-zinc-800 px-6 py-4">
                <div>
                    <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                        {BRAND.product}
                    </h1>
                    <p className="mt-0.5 text-xs text-zinc-400">AI governance for your design system</p>
                </div>
            </header>

            {/* Main scroll container */}
            <main className="flex flex-1 items-start justify-center overflow-y-auto pt-10 pb-10">
                <div className="w-full max-w-md px-4">

                    {/* 2. MCP context banner */}
                    {mcpConnected && <div role="status" aria-label="MCP connection status" className="mb-6 flex items-center justify-between rounded-xl border border-indigo-500/40 bg-indigo-900/25 px-4 py-3">
                            <div className="flex items-center gap-2.5">
                                <span className="h-2 w-2 rounded-full bg-indigo-400" aria-hidden="true" />
                                <span className="text-sm text-zinc-300">
                                    MCP connected
                                    {connectedProjectName && <> · <span className="font-semibold text-zinc-100">{connectedProjectName}</span></>}
                                </span>
                            </div>
                            <button type="button" aria-label={connectedProjectName ? `Open ${connectedProjectName}` : 'Open connected project'} onClick={() => {
            if (recentProjects[0]) {
              void handleOpenRecent(recentProjects[0]);
            }
          }} className="flex items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300">
                                Open this project
                                <ArrowRight size={11} aria-hidden="true" />
                            </button>
                        </div>}

                    {/* 3. Section label */}
                    <p className="mb-3 text-xs font-medium text-zinc-500">How do you want to start?</p>

                    {/* 4. Three primary channels */}
                    <div className="flex flex-col gap-2">
                        {CHANNELS.map(channel => {
            const isActive = activeChannel === channel.id;
            return <button key={channel.id} type="button" data-testid={`channel-${channel.id}`} onClick={() => {
              if (channel.id === 'from-idea') {
                handleChannelSelect(channel.id);
                void handleFromIdea();
              } else if (channel.id === 'from-figma') {
                // UX-W4: expand to inline URL input instead of auto-progressing.
                handleChannelSelect(channel.id);
                setFlowStep('input');
              } else {
                handleChannelSelect(channel.id);
              }
            }} aria-expanded={isActive} aria-controls={isActive ? 'launch-flow-panel' : undefined} className={['flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all', isActive ? 'border-indigo-500/40 bg-indigo-950/30' : 'border-zinc-800 hover:border-zinc-700/50 hover:bg-zinc-800/40'].join(' ')}>
                                    <div className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors', isActive ? 'bg-indigo-600/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400'].join(' ')}>
                                        {channel.id === 'from-idea' && creatingIdea ? <Loader2 size={15} aria-hidden="true" className="motion-safe:animate-spin" /> : <channel.icon size={15} aria-hidden="true" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={['text-xs font-medium leading-none', isActive ? 'text-zinc-100' : 'text-zinc-300'].join(' ')}>
                                            {channel.label}
                                        </p>
                                        <p className="mt-1 text-xs leading-none text-zinc-500">
                                            {channel.description}
                                        </p>
                                    </div>
                                    <ChevronRight size={13} aria-hidden="true" className={['shrink-0 transition-transform', isActive ? 'rotate-90 text-indigo-400' : 'text-zinc-700'].join(' ')} />
                                </button>;
          })}
                    </div>

                    {/* 5. Inline expanded flow */}
                    {activeChannel !== null && <div id="launch-flow-panel" className="mt-4">

                            {/* UX-W4: from-figma — inline figma.com URL input (no modal). */}
                            {activeChannel === 'from-figma' && flowStep === 'input' && <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                                    <p className="mb-1.5 text-xs font-medium text-zinc-300">Figma URL</p>
                                    <p className="mb-3 text-xs text-zinc-500">
                                        Paste a figma.com link — Figma MCP converts the design to governed code.
                                    </p>
                                    <div className="flex gap-2">
                                        <input type="text" data-testid="figma-url-input" value={figmaUrlInput} aria-label="Figma URL" onChange={e => {
                                            setFigmaUrlInput(e.target.value);
                                            setFigmaUrlError(null);
                                        }} onKeyDown={e => {
                                            if (e.key === 'Enter') void handleFromFigmaSubmit();
                                        }} placeholder="https://www.figma.com/design/..." autoFocus className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/50" />
                                        <button type="button" data-testid="figma-url-submit" onClick={() => {
                                            void handleFromFigmaSubmit();
                                        }} className="shrink-0 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-4 py-2.5 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30">
                                            Open
                                        </button>
                                    </div>
                                    {figmaUrlError && <p role="alert" className="mt-1.5 text-xs text-red-400">{figmaUrlError}</p>}
                                </div>}

                            {/* from-existing-code: text input for folder or git URL */}
                            {activeChannel === 'from-existing-code' && flowStep === 'input' &&<div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                                    <p className="mb-1.5 text-xs font-medium text-zinc-300">
                                        Folder path or git URL
                                    </p>
                                    <p className="mb-3 text-xs text-zinc-500">
                                        {BRAND.product} will detect your stack before opening.
                                    </p>
                                    <div className="flex gap-2">
                                        <input type="text" data-testid="existing-code-input" value={codeInput} aria-label="Folder path or git URL" onChange={e => {
                setCodeInput(e.target.value);
                setCodeInputError(null);
              }} onKeyDown={e => {
                if (e.key === 'Enter') void handleExistingCodeSubmit();
              }} placeholder={isWebMode ? '/Users/you/my-project' : '/path/to/project or https://github.com/…'} autoFocus className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/50" />
                                        <button type="button" data-testid="existing-code-submit" onClick={() => {
                void handleExistingCodeSubmit();
              }} className="shrink-0 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-4 py-2.5 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30">
                                            Detect
                                        </button>
                                    </div>
                                    {!isWebMode && <button type="button" onClick={() => {
              void onOpenFolder();
            }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-700/50 hover:text-zinc-400">
                                            <FolderOpen size={13} aria-hidden="true" />
                                            Or choose folder...
                                        </button>}
                                    {codeInputError && <p role="alert" className="mt-1.5 text-xs text-red-400">{codeInputError}</p>}
                                </div>}

                            {/* Detecting step */}
                            {flowStep === 'detecting' && <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col items-center py-8">
                                    <Loader2 size={28} className="motion-safe:animate-spin text-indigo-400" />
                                    <p className="mt-4 text-sm text-zinc-300">{progressMessage}</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        Reading package.json, checking for tokens and components...
                                    </p>
                                </div>}

                            {/* DetectionPreview step */}
                            {flowStep === 'detected' && detectedEnvironment && detectedProjectPath && <DetectionPreview environment={detectedEnvironment} projectPath={detectedProjectPath} onConfirm={overrides => {
            void handleDetectionConfirm(overrides);
          }} onCancel={handleDetectionCancel} />}

                            {/* Progress step */}
                            {flowStep === 'progress' && <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col items-center py-8">
                                    <Loader2 size={28} className="motion-safe:animate-spin text-indigo-400" />
                                    <p className="mt-4 text-sm text-zinc-300">{progressMessage}</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        Detecting stack, extracting tokens, indexing components...
                                    </p>
                                </div>}

                            {/* Done step */}
                            {flowStep === 'done' && <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-col items-center py-8">
                                    <CheckCircle size={36} className="text-emerald-400" />
                                    <p className="mt-4 text-sm font-medium text-zinc-200">You're all set.</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {BRAND.product} is ready. Your canvas is loading...
                                    </p>
                                </div>}
                        </div>}

                    {/* 6. Demo section — unchanged persistent surface */}
                    <div className="mt-8">
                        <DemoScenarioPicker onLoadDemo={onLoadDemo} />
                    </div>

                    {/* 7. Recent projects */}
                    {!loading && recentProjects.length > 0 && <section aria-labelledby="recent-projects-label" className="mt-8">
                            <div className="mb-2 flex items-center gap-2">
                                <Clock size={11} aria-hidden="true" className="text-zinc-600" />
                                <span id="recent-projects-label" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                                    Reopen a project
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                {recentProjects.slice(0, 5).map(project => {
              const isOpening = openingPath === project.path;
              const displayPath = project.path.length > 40 ? '...' + project.path.slice(-37) : project.path;
              const grade = healthGrades.get(project.path);
              return <div key={project.id} className="group flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 transition-colors hover:border-zinc-700/50 hover:bg-zinc-800/30">
                                            <FolderOpen size={13} aria-hidden="true" className="shrink-0 text-zinc-600 group-hover:text-indigo-400/70 transition-colors" />
                                            <button type="button" aria-label={`Open ${project.name}`} onClick={() => {
                  void handleOpenRecent(project);
                }} disabled={isOpening} className="flex flex-1 min-w-0 items-center gap-2 text-left">
                                                <span className="text-xs font-medium text-zinc-300 truncate">
                                                    {isOpening ? 'Opening...' : project.name}
                                                </span>
                                                {grade && <span className={`shrink-0 text-xs font-bold tabular-nums ${gradeColor(grade)}`} aria-label={`Health grade: ${grade}`}>
                                                        {grade}
                                                    </span>}
                                                <span className="text-xs text-zinc-600 truncate min-w-0">
                                                    {displayPath}
                                                </span>
                                            </button>
                                            <ArrowRight size={12} aria-hidden="true" className="shrink-0 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <button type="button" aria-label={`Remove ${project.name} from recent projects`} onClick={e => handleRemove(e, project.id)} className="shrink-0 rounded p-0.5 text-zinc-700 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100">
                                                <Trash2 size={11} aria-hidden="true" />
                                            </button>
                                        </div>;
            })}
                            </div>
                        </section>}

                    {/* 8. FORGE.4a: Paste and Audit tertiary action */}
                    <div className="mt-4 flex justify-center">
                        <button type="button" onClick={() => setShowPasteAudit(true)} className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-indigo-400" data-testid="paste-audit-trigger">
                            <Clipboard size={12} aria-hidden="true" />
                            Paste code to audit
                        </button>
                    </div>

                    {/* 9. Footer actions */}
                    <div className="mt-6 flex flex-col items-center gap-3">
                        {/* Web mode: standalone path input when no channel is expanded */}
                        {isWebMode && !activeChannel && <div className="w-full">
                                <div className="flex gap-2">
                                    <input type="text" aria-label="Project folder path (absolute path)" value={webPathInput} onChange={e => {
                setWebPathInput(e.target.value);
                setWebPathError(null);
              }} onKeyDown={e => {
                if (e.key === 'Enter') void handleWebPathSubmit();
              }} placeholder="Enter project path..." className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/40" />
                                    <button type="button" aria-label="Open project at entered path" onClick={() => {
                void handleWebPathSubmit();
              }} className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800/40 px-3 py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-300">
                                        Open
                                    </button>
                                </div>
                                {webPathError && !activeChannel && <p role="alert" className="mt-1 text-center text-xs text-red-400">{webPathError}</p>}
                            </div>}
                        <div className="flex items-center gap-3">
                            {!isWebMode && <button type="button" onClick={() => {
              void handleOpenFolderFooter();
            }} className="text-xs text-zinc-600 transition-colors hover:text-zinc-400">
                                    Open any folder...
                                </button>}
                            {onConnectIDE && <>
                                    {!isWebMode && <span className="text-zinc-700" aria-hidden="true">|</span>}
                                    <button type="button" onClick={onConnectIDE} className="flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-indigo-400">
                                        <Link2 size={11} aria-hidden="true" />
                                        Connect to IDE
                                    </button>
                                </>}
                        </div>
                    </div>

                </div>
            </main>

            {/* FORGE.4a: Paste and Audit modal */}
            {showPasteAudit && <PasteAuditModal onClose={() => setShowPasteAudit(false)} />}
        </div>;
}