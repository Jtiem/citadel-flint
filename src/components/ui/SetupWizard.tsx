import { useState, useEffect, useCallback } from 'react'
import { BRAND } from '../../../shared/brand'
import {
    CheckCircle,
    XCircle,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Copy,
    Check,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectedIDE {
    name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
    settingsPath: string
    detected: boolean
}

type WizardStep = 'welcome' | 'ide-detect' | 'mcp-snippet' | 'verify' | 'done'
type VerifyStatus = 'idle' | 'checking' | 'connected' | 'error'
type WriteStatus = 'writing' | 'written' | 'error'

export interface SetupWizardProps {
    onComplete: () => void
}

// ── Step dot indices ──────────────────────────────────────────────────────────

const STEP_ORDER: WizardStep[] = ['welcome', 'ide-detect', 'mcp-snippet', 'verify', 'done']

function stepIndex(step: WizardStep): number {
    return STEP_ORDER.indexOf(step)
}

// ── Config snippet builder ────────────────────────────────────────────────────

function buildConfigSnippet(ideName: DetectedIDE['name'], mcpServerPath: string): string {
    // VS Code and Cursor use mcp.servers; Claude Code and Antigravity use mcpServers
    if (ideName === 'VS Code' || ideName === 'Cursor') {
        return JSON.stringify(
            {
                'mcp.servers': {
                    flint: {
                        command: 'node',
                        args: [mcpServerPath],
                    },
                },
            },
            null,
            2,
        )
    }
    return JSON.stringify(
        {
            mcpServers: {
                flint: {
                    command: 'node',
                    args: [mcpServerPath],
                },
            },
        },
        null,
        2,
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

// R-10: Progress dots with non-color distinction (filled checkmark / current ring / empty)
function StepDots({ current }: { current: WizardStep }) {
    const currentIdx = stepIndex(current)
    return (
        <div
            className="flex items-center justify-center gap-2 pt-6"
            aria-hidden="true"
            data-testid="step-dots"
        >
            {STEP_ORDER.map((s, i) => {
                const isCompleted = i < currentIdx
                const isCurrent = i === currentIdx

                if (isCompleted) {
                    // Completed: solid indigo dot with checkmark inside
                    return (
                        <span
                            key={s}
                            data-step-state="completed"
                            data-step-index={i + 1}
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white"
                        >
                            <span className="text-[8px] font-bold leading-none">&#10003;</span>
                        </span>
                    )
                }

                if (isCurrent) {
                    // Current: outlined ring with filled inner dot
                    return (
                        <span
                            key={s}
                            data-step-state="current"
                            data-step-index={i + 1}
                            className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-indigo-500"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        </span>
                    )
                }

                // Future: hollow outlined ring
                return (
                    <span
                        key={s}
                        data-step-state="upcoming"
                        data-step-index={i + 1}
                        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600"
                    />
                )
            })}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SetupWizard({ onComplete }: SetupWizardProps) {
    const [step, setStep] = useState<WizardStep>('welcome')
    const [detectedIDEs, setDetectedIDEs] = useState<DetectedIDE[] | null>(null)
    const [mcpServerPath, setMcpServerPath] = useState<string>('')
    const [selectedIDE, setSelectedIDE] = useState<DetectedIDE | null>(null)
    const [writeStatus, setWriteStatus] = useState<WriteStatus | null>(null)
    const [writeError, setWriteError] = useState<string | null>(null)
    const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
    const [verifyError, setVerifyError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // R-4: Escape key blocked during active writes
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                // Block dismissal while a write is in progress
                if (writeStatus === 'writing') return
                onComplete()
                return
            }
            if (e.key === 'Enter') {
                // Enter triggers the primary CTA for the current step.
                const primary = document.querySelector<HTMLButtonElement>(
                    '[data-wizard-primary]',
                )
                primary?.click()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onComplete, writeStatus])

    // ── IDE detection (runs when entering ide-detect step) ───────────────────
    useEffect(() => {
        if (step !== 'ide-detect') return
        if (detectedIDEs !== null) return // already fetched

        window.flintAPI.setup
            ?.detectIDEs()
            .then(
                (result: {
                    ides: DetectedIDE[]
                    mcpServerPath: string
                }) => {
                    setDetectedIDEs(result.ides)
                    setMcpServerPath(result.mcpServerPath)
                    // Auto-select first detected IDE, or none
                    const firstDetected = result.ides.find((ide) => ide.detected) ?? null
                    setSelectedIDE(firstDetected)
                },
            )
            .catch(() => {
                // On IPC failure, show empty list so user can skip
                setDetectedIDEs([])
            })
    }, [step, detectedIDEs])

    // R-1: NO auto-write useEffect. Write is triggered by user clicking "Install MCP Config".

    // ── Navigation helpers ────────────────────────────────────────────────────
    const goBack = useCallback(() => {
        const idx = stepIndex(step)
        if (idx > 0) setStep(STEP_ORDER[idx - 1])
    }, [step])

    const goNext = useCallback(() => {
        const idx = stepIndex(step)
        if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1])
    }, [step])

    // R-1: User-initiated MCP config write
    const handleInstall = useCallback(async () => {
        if (!selectedIDE) return
        setWriteStatus('writing')
        setWriteError(null)
        try {
            await window.flintAPI.setup.writeMCPConfig(
                selectedIDE.name,
                selectedIDE.settingsPath,
                mcpServerPath,
            )
            setWriteStatus('written')
        } catch (err) {
            setWriteStatus('error')
            setWriteError(err instanceof Error ? err.message : 'Unknown error writing config.')
        }
    }, [selectedIDE, mcpServerPath])

    // R-2: Copy config snippet to clipboard
    const handleCopySnippet = useCallback(async () => {
        if (!selectedIDE) return
        const snippet = buildConfigSnippet(selectedIDE.name, mcpServerPath)
        await navigator.clipboard.writeText(snippet)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [selectedIDE, mcpServerPath])

    // ── Verify connection ─────────────────────────────────────────────────────
    const handleVerify = useCallback(async () => {
        setVerifyStatus('checking')
        setVerifyError(null)
        try {
            const result = await window.flintAPI.mcp?.callTool('flint_status', {})
            // Treat any successful return as connected — flint_status returns
            // an object with a `status` key when the server is alive.
            if (result && typeof result === 'object') {
                setVerifyStatus('connected')
            } else {
                setVerifyStatus('error')
                setVerifyError('Server registered but not responding correctly.')
            }
        } catch (err) {
            setVerifyStatus('error')
            const message = err instanceof Error ? err.message : ''
            if (
                message.toLowerCase().includes('connect') ||
                message.toLowerCase().includes('econnrefused') ||
                message.toLowerCase().includes('not found')
            ) {
                setVerifyError(
                    'MCP server not found. Make sure you saved the config and restarted your IDE.',
                )
            } else {
                setVerifyError('Server registered but not responding correctly.')
            }
        }
    }, [])

    // ── Complete first launch (only called from the done step) ────────────────
    const handleDone = useCallback(async () => {
        await window.flintAPI.setup?.completeFirstLaunch()
        onComplete()
    }, [onComplete])

    // ── Shared card wrapper ───────────────────────────────────────────────────
    const canGoBack = step !== 'welcome' && step !== 'done'

    // Config snippet for preview / copy (computed when we have both IDE and path)
    const configSnippet =
        selectedIDE && mcpServerPath
            ? buildConfigSnippet(selectedIDE.name, mcpServerPath)
            : ''

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
            <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
                {/* Back button */}
                {canGoBack && (
                    <button
                        type="button"
                        onClick={goBack}
                        className="mb-4 flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                        <ChevronLeft size={12} />
                        Back
                    </button>
                )}

                {/* ── Step: Welcome ─────────────────────────────────────── */}
                {step === 'welcome' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-2xl font-bold text-zinc-100">
                                Get {BRAND.product} running in 2 minutes
                            </h1>
                            <p className="text-sm text-zinc-400">
                                {BRAND.product} connects to your IDE via MCP. We&apos;ll help you set it up.
                            </p>
                        </div>
                        <button
                            data-wizard-primary
                            type="button"
                            onClick={goNext}
                            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                        >
                            Let's go
                            <ChevronRight size={14} />
                        </button>
                        <StepDots current={step} />
                    </div>
                )}

                {/* ── Step: IDE Detection ───────────────────────────────── */}
                {step === 'ide-detect' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-xl font-bold text-zinc-100">
                                Which IDE do you use?
                            </h2>
                            <p className="text-sm text-zinc-400">
                                We checked for installed IDEs. Select one to configure.
                            </p>
                        </div>

                        {detectedIDEs === null ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={24} className="animate-spin text-zinc-500" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {detectedIDEs.map((ide) => {
                                    const isSelected = selectedIDE?.name === ide.name
                                    return (
                                        <button
                                            key={ide.name}
                                            type="button"
                                            onClick={() => {
                                                setSelectedIDE(ide)
                                                // R-6: Reset write status when IDE selection changes
                                                setWriteStatus(null)
                                                setWriteError(null)
                                            }}
                                            className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                                                isSelected
                                                    ? 'border-indigo-500/60 bg-indigo-900/20'
                                                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/40'
                                            }`}
                                        >
                                            <span className="text-sm font-medium text-zinc-100">
                                                {ide.name}
                                            </span>
                                            {ide.detected ? (
                                                <span className="flex items-center gap-1 text-xs text-emerald-400">
                                                    <CheckCircle size={12} />
                                                    Found
                                                </span>
                                            ) : (
                                                <span className="text-xs text-zinc-500">
                                                    — Not found
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                                {detectedIDEs.length === 0 && (
                                    <p className="py-4 text-center text-sm text-zinc-500">
                                        No IDEs detected. You can still set up manually.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                data-wizard-primary
                                type="button"
                                onClick={goNext}
                                disabled={selectedIDE === null}
                                className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Continue
                                <ChevronRight size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={onComplete}
                                className="text-center text-xs text-zinc-500 underline transition-colors hover:text-zinc-400"
                            >
                                Skip setup
                            </button>
                        </div>

                        <StepDots current={step} />
                    </div>
                )}

                {/* ── Step: MCP Config (consent-first) ─────────────────── */}
                {step === 'mcp-snippet' && selectedIDE && (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-xl font-bold text-zinc-100">
                                Connecting {BRAND.product} to {selectedIDE.name}
                            </h2>
                            <p className="text-sm text-zinc-400">
                                {BRAND.product} will add the following to{' '}
                                <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-300">
                                    {selectedIDE.settingsPath}
                                </code>
                            </p>
                        </div>

                        {/* R-1: Config preview block (always shown before write) */}
                        <pre className="max-h-40 overflow-y-auto rounded-lg border border-zinc-700/50 bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                            {configSnippet}
                        </pre>

                        {/* R-9: aria-live so screen readers announce status changes */}
                        <div
                            aria-live="polite"
                            className="min-h-[72px] rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-4"
                        >
                            {/* Pre-install: show prompt to click Install */}
                            {writeStatus === null && (
                                <p className="text-center text-sm text-zinc-500">
                                    Review the config above, then click "Install MCP Config".
                                </p>
                            )}

                            {writeStatus === 'writing' && (
                                <div className="flex items-center justify-center gap-3 text-zinc-400">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span className="text-sm">Installing…</span>
                                </div>
                            )}

                            {writeStatus === 'written' && (
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <CheckCircle size={18} />
                                        <span className="text-sm font-medium">Config written</span>
                                    </div>
                                    <p className="font-mono text-xs text-zinc-500">
                                        {selectedIDE.settingsPath}
                                    </p>
                                </div>
                            )}

                            {/* R-2: Error state with copy-paste fallback */}
                            {writeStatus === 'error' && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-center gap-2 text-red-400">
                                        <XCircle size={18} />
                                        <span className="text-sm font-medium">Write failed</span>
                                    </div>
                                    <p className="text-center text-xs text-zinc-500">{writeError}</p>
                                    <p className="text-center text-xs text-zinc-500">
                                        Paste this into{' '}
                                        <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-300">
                                            {selectedIDE.settingsPath}
                                        </code>{' '}
                                        manually.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleCopySnippet}
                                        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700/50 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={12} className="text-emerald-400" />
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={12} />
                                                Copy config snippet
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* R-1: Install button — only triggers write on click */}
                            {writeStatus === null && (
                                <button
                                    data-wizard-primary
                                    type="button"
                                    onClick={handleInstall}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                                >
                                    Install MCP Config
                                    <ChevronRight size={14} />
                                </button>
                            )}

                            {/* Writing: disabled Install button with spinner */}
                            {writeStatus === 'writing' && (
                                <button
                                    data-wizard-primary
                                    type="button"
                                    disabled
                                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
                                >
                                    <Loader2 size={14} className="animate-spin" />
                                    Installing…
                                </button>
                            )}

                            {/* R-3: Continue after success advances to verify, not done */}
                            {writeStatus === 'written' && (
                                <button
                                    data-wizard-primary
                                    type="button"
                                    onClick={goNext}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                                >
                                    Continue
                                    <ChevronRight size={14} />
                                </button>
                            )}

                            {writeStatus === 'error' && (
                                <button
                                    data-wizard-primary
                                    type="button"
                                    onClick={() => {
                                        setWriteStatus(null)
                                        setWriteError(null)
                                    }}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                                >
                                    Retry
                                </button>
                            )}

                            {/* R-3: Skip advances to verify (not done) */}
                            <button
                                type="button"
                                onClick={goNext}
                                className="text-center text-xs text-zinc-500 underline transition-colors hover:text-zinc-400"
                            >
                                Skip
                            </button>
                        </div>

                        <StepDots current={step} />
                    </div>
                )}

                {/* ── Step: Verify Connection ───────────────────────────── */}
                {step === 'verify' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-xl font-bold text-zinc-100">
                                Test your connection
                            </h2>
                            {/* R-5: Accurate copy — this tests the internal MCP connection */}
                            <p className="text-sm text-zinc-400">
                                {BRAND.product} is checking its internal connection. No changes to your
                                IDE are needed at this point.
                            </p>
                        </div>

                        {/* Verify status display */}
                        <div className="flex min-h-[56px] items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3">
                            {verifyStatus === 'idle' && (
                                <p className="text-sm text-zinc-500">
                                    Click "Test Connection" to verify
                                </p>
                            )}
                            {verifyStatus === 'checking' && (
                                <div className="flex items-center gap-2 text-zinc-400">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-sm">Connecting…</span>
                                </div>
                            )}
                            {verifyStatus === 'connected' && (
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <CheckCircle size={16} />
                                    <span className="text-sm font-medium">{BRAND.product} is live</span>
                                </div>
                            )}
                            {verifyStatus === 'error' && (
                                <div className="flex items-center gap-2 text-red-400">
                                    <XCircle size={16} />
                                    <span className="text-sm">{verifyError}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            {verifyStatus !== 'connected' && (
                                <button
                                    data-wizard-primary
                                    type="button"
                                    onClick={handleVerify}
                                    disabled={verifyStatus === 'checking'}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {verifyStatus === 'error' ? 'Retry' : 'Test Connection'}
                                </button>
                            )}
                            {verifyStatus === 'connected' && (
                                <button
                                    data-wizard-primary
                                    type="button"
                                    onClick={goNext}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                                >
                                    Continue
                                    <ChevronRight size={14} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={goNext}
                                className="text-center text-xs text-zinc-500 underline transition-colors hover:text-zinc-400"
                            >
                                Skip
                            </button>
                        </div>

                        <StepDots current={step} />
                    </div>
                )}

                {/* ── Step: Done ────────────────────────────────────────── */}
                {step === 'done' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col items-center gap-3 py-4 text-center">
                            <CheckCircle size={48} className="text-emerald-400" />
                            <h2 className="text-2xl font-bold text-zinc-100">You're ready.</h2>
                            <p className="text-sm text-zinc-400">
                                {BRAND.product} will audit your code and enforce your design system
                                automatically.
                            </p>
                        </div>

                        {/* R-3: Only the done step's primary button calls handleDone */}
                        <button
                            data-wizard-primary
                            type="button"
                            onClick={handleDone}
                            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                        >
                            Start building
                            <ChevronRight size={14} />
                        </button>

                        <StepDots current={step} />
                    </div>
                )}
            </div>
        </div>
    )
}
