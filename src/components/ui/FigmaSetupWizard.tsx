/**
 * FigmaSetupWizard — src/components/ui/FigmaSetupWizard.tsx
 *
 * 3-step guided wizard for connecting the Figma plugin to Flint's loopback
 * ingestion server. Mounts inline below the "Connect Figma" button on the
 * LaunchScreen.
 *
 * Step flow:
 *   checking  — mount: polls figma.status(); auto-advances or shows error
 *   configure — server is running; shows endpoint copy field (secret is server-side only)
 *   waiting   — user confirmed plugin config; subscribes to onConnected()
 *   success   — first POST /ingest received; auto-closes after 2s
 *   error     — server not running or IPC call failed
 *
 * Phase W.3 (Figma Connect UX Overhaul)
 */

import { useState, useEffect, useRef } from 'react'
import { Check, Copy, Loader2, AlertTriangle, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import type { FigmaStatus } from '../../types/flint-api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FigmaSetupWizardProps {
    /**
     * Whether the wizard panel is open/visible.
     * Controlled by LaunchScreen's figmaSetupOpen state.
     */
    visible: boolean

    /**
     * Called when the wizard should close (after success, or user dismissal).
     */
    onClose: () => void
}

/**
 * Internal wizard step state. Not exported -- lives in component useState.
 *
 * 'checking'   -- Step 1: polling server status on mount
 * 'configure'  -- Step 2: showing endpoint copy field
 * 'waiting'    -- Step 3: waiting for first POST /ingest from Figma plugin
 * 'success'    -- Step 3 complete: first sync received, auto-close in 2s
 * 'error'      -- Server not running or connection failed
 */
type WizardStep = 'checking' | 'configure' | 'waiting' | 'success' | 'error'

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StepIndicatorProps {
    index: number
    label: string
    status: 'completed' | 'current' | 'upcoming'
}

function StepIndicator({ index, label, status }: StepIndicatorProps) {
    return (
        <div className="flex items-center gap-2.5">
            <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                {status === 'completed' ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                ) : status === 'current' ? (
                    <>
                        <div className="absolute h-5 w-5 motion-safe:animate-pulse rounded-full bg-indigo-500/30" />
                        <div className="h-3 w-3 rounded-full bg-indigo-400" />
                    </>
                ) : (
                    <div className="h-3 w-3 rounded-full bg-zinc-700" />
                )}
            </div>
            <span
                className={
                    status === 'completed'
                        ? 'text-xs text-emerald-400'
                        : status === 'current'
                          ? 'text-xs font-medium text-zinc-100'
                          : 'text-xs text-zinc-500'
                }
            >
                {index}. {label}
            </span>
        </div>
    )
}

// ── Copy field ─────────────────────────────────────────────────────────────────

interface CopyFieldProps {
    label: string
    value: string
    copied: boolean
    onCopy: () => void
}

function CopyField({ label, value, copied, onCopy }: CopyFieldProps) {
    return (
        <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
            <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5">
                <code className="flex-1 truncate font-mono text-xs text-zinc-200">{value}</code>
                <button
                    type="button"
                    onClick={onCopy}
                    className="shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    title={copied ? 'Copied!' : `Copy ${label}`}
                    aria-label={copied ? 'Copied!' : `Copy ${label}`}
                >
                    {copied ? (
                        <Check size={13} className="text-emerald-400" />
                    ) : (
                        <Copy size={13} />
                    )}
                </button>
            </div>
            {copied && (
                <p className="text-[10px] text-emerald-400">Copied!</p>
            )}
        </div>
    )
}

// ── Troubleshooting section ────────────────────────────────────────────────────

function TroubleshootingSection() {
    const [open, setOpen] = useState(false)

    return (
        <div className="mt-3 border-t border-zinc-800 pt-3">
            <button
                type="button"
                onClick={() => { setOpen((v) => !v) }}
                className="flex w-full items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Troubleshooting
            </button>

            {open && (
                <div className="mt-2 space-y-2 text-xs text-zinc-400">
                    <div>
                        <p className="font-medium text-zinc-300">Server won't start</p>
                        <p className="mt-0.5">
                            Restart Flint. The ingestion server starts automatically on app launch.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-300">Port fallback</p>
                        <p className="mt-0.5">
                            If port 4545 was busy, Flint picks the next available port. Use the
                            endpoint shown above — do not hardcode 4545.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-300">Authentication error (401)</p>
                        <p className="mt-0.5">
                            The per-session secret is managed automatically by Flint. Restart Flint
                            to generate a fresh session, then re-configure the Figma plugin with the
                            updated endpoint.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-zinc-300">No tokens after sync</p>
                        <p className="mt-0.5">
                            Ensure you are syncing Figma Variables (not styles). The plugin must
                            be run from a file that contains at least one Variable collection.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FigmaSetupWizard({ visible, onClose }: FigmaSetupWizardProps) {
    const push = useNotificationStore((s) => s.push)

    const [step, setStep] = useState<WizardStep>('checking')
    const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null)

    // Per-field copy feedback: 'endpoint' | null
    const [copied, setCopied] = useState<'endpoint' | null>(null)
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Auto-close timer for success state
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Step 1: Check server on mount ────────────────────────────────────────
    useEffect(() => {
        if (!visible) return

        // Reset wizard state when re-opened
        setStep('checking')
        setFigmaStatus(null)
        setCopied(null)

        let cancelled = false

        window.flintAPI.figma
            .status()
            .then((status) => {
                if (cancelled) return
                setFigmaStatus(status)

                if (status.running) {
                    // If a previous sync already happened, skip straight to success
                    if (status.lastWebhookAt !== null) {
                        setStep('success')
                    } else {
                        setStep('configure')
                    }
                } else {
                    setStep('error')
                }
            })
            .catch(() => {
                if (!cancelled) setStep('error')
            })

        return () => {
            cancelled = true
        }
    }, [visible])

    // ── Step 3: Subscribe to onConnected ─────────────────────────────────────
    useEffect(() => {
        if (step !== 'waiting') return

        const unsubscribe = window.flintAPI.figma.onConnected((event) => {
            setStep('success')
            push({
                type: 'sync',
                title: 'Figma connected',
                message: `${event.tokenCount} design token${event.tokenCount === 1 ? '' : 's'} synced from Figma.`,
                severity: 'success',
                autoDismissMs: 5000,
            })
        })

        return unsubscribe
    }, [step, push])

    // ── Auto-close on success ─────────────────────────────────────────────────
    useEffect(() => {
        if (step !== 'success') return

        closeTimerRef.current = setTimeout(() => {
            onClose()
        }, 2000)

        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current)
            }
        }
    }, [step, onClose])

    // ── Cleanup copy timer on unmount ─────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
        }
    }, [])

    // ── Copy helper ───────────────────────────────────────────────────────────
    const handleCopy = (field: 'endpoint', value: string) => {
        void navigator.clipboard.writeText(value).then(() => {
            setCopied(field)
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
            copyTimerRef.current = setTimeout(() => setCopied(null), 1500)
        })
    }

    if (!visible) return null

    // ── Step indicator config ─────────────────────────────────────────────────
    const stepStatus = (forStep: 1 | 2 | 3): 'completed' | 'current' | 'upcoming' => {
        if (step === 'checking' || step === 'error') {
            if (forStep === 1) return 'current'
            return 'upcoming'
        }
        if (step === 'configure') {
            if (forStep === 1) return 'completed'
            if (forStep === 2) return 'current'
            return 'upcoming'
        }
        if (step === 'waiting') {
            if (forStep <= 2) return 'completed'
            return 'current'
        }
        // success
        return 'completed'
    }

    const endpoint = figmaStatus ? `http://127.0.0.1:${figmaStatus.port}` : 'http://127.0.0.1:4545'

    return (
        <div
            data-testid="figma-setup-wizard"
            className="mt-2 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-left"
        >
            {/* ── Step indicators ───────────────────────────────────────────── */}
            <div className="mb-4 space-y-2">
                <StepIndicator index={1} label="Verify server" status={stepStatus(1)} />
                <StepIndicator index={2} label="Configure Figma plugin" status={stepStatus(2)} />
                <StepIndicator index={3} label="Wait for first sync" status={stepStatus(3)} />
            </div>

            {/* ── Step content ──────────────────────────────────────────────── */}

            {step === 'checking' && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Loader2 size={13} className="motion-safe:animate-spin text-indigo-400" />
                    Checking server status…
                </div>
            )}

            {step === 'error' && (
                <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded border border-red-700/40 bg-red-900/10 px-3 py-2">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-400" />
                        <p className="text-xs text-red-400">
                            The ingestion server is not running. Restart Flint to start it
                            automatically.
                        </p>
                    </div>
                </div>
            )}

            {step === 'configure' && figmaStatus && (
                <div className="space-y-3">
                    <p className="text-xs text-zinc-400">
                        Copy the endpoint below into the Flint Figma plugin settings,
                        then click <strong className="text-zinc-200">Sync Variables</strong>.
                        Authentication is handled automatically — no secret to copy.
                    </p>

                    <CopyField
                        label="Endpoint"
                        value={endpoint}
                        copied={copied === 'endpoint'}
                        onCopy={() => { handleCopy('endpoint', endpoint) }}
                    />

                    <button
                        type="button"
                        onClick={() => { setStep('waiting') }}
                        className="mt-1 w-full rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:border-indigo-500/70 hover:bg-indigo-600/30 hover:text-indigo-200"
                    >
                        I've configured the plugin
                    </button>
                </div>
            )}

            {step === 'waiting' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <Loader2 size={13} className="motion-safe:animate-spin text-indigo-400" />
                        Waiting for first sync from Figma…
                    </div>
                    <p className="text-[11px] text-zinc-500">
                        Open the Flint plugin in Figma and click{' '}
                        <strong className="text-zinc-400">Sync Variables</strong>.
                    </p>
                </div>
            )}

            {step === 'success' && (
                <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-900/10 px-3 py-2">
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                    <p className="text-xs text-emerald-400">
                        Figma connected. Closing wizard…
                    </p>
                </div>
            )}

            {/* ── Troubleshooting ───────────────────────────────────────────── */}
            <TroubleshootingSection />
        </div>
    )
}
