/**
 * BetaFeedbackModal — src/components/ui/BetaFeedbackModal.tsx
 *
 * In-app feedback form for beta testers. Collects structured feedback
 * (category, severity, description) and saves it locally via IPC.
 *
 * Triggered from the StatusBar "Beta" chip or via Cmd+Shift+F.
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Send, MessageSquare, AlertTriangle, CheckCircle } from 'lucide-react'
import type { BetaFeedbackCategory, BetaFeedbackSeverity } from '../../types/flint-api'

interface BetaFeedbackModalProps {
    open: boolean
    onClose: () => void
}

const CATEGORIES: { value: BetaFeedbackCategory; label: string }[] = [
    { value: 'bug', label: 'Bug' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'usability', label: 'Usability' },
    { value: 'other', label: 'Other' },
]

const SEVERITIES: { value: BetaFeedbackSeverity; label: string; color: string }[] = [
    { value: 'cosmetic', label: 'Cosmetic', color: 'text-zinc-400 border-zinc-600' },
    { value: 'annoying', label: 'Annoying', color: 'text-amber-400 border-amber-600' },
    { value: 'blocker', label: 'Blocker', color: 'text-red-400 border-red-600' },
]

export function BetaFeedbackModal({ open, onClose }: BetaFeedbackModalProps) {
    const [category, setCategory] = useState<BetaFeedbackCategory>('bug')
    const [severity, setSeverity] = useState<BetaFeedbackSeverity>('annoying')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [betaInfo, setBetaInfo] = useState<{
        buildId: string
        daysRemaining: number | null
    } | null>(null)

    // Fetch beta info on mount
    useEffect(() => {
        if (!open) return
        window.flintAPI.beta?.getInfo()
            .then(setBetaInfo)
            .catch(() => { /* beta API may not be available */ })
    }, [open])

    // Reset form when reopened
    useEffect(() => {
        if (open) {
            setDescription('')
            setSubmitted(false)
        }
    }, [open])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open, onClose])

    const handleSubmit = useCallback(async () => {
        if (!description.trim() || submitting) return
        setSubmitting(true)

        try {
            const result = await window.flintAPI.beta?.submitFeedback({
                category,
                description: description.trim(),
                severity,
                context: `Build: ${betaInfo?.buildId || 'unknown'}`,
            })

            if (result?.saved) {
                setSubmitted(true)
                setTimeout(() => onClose(), 1500)
            }
        } catch {
            // Feedback save failed — silent, the form stays open for retry
        } finally {
            setSubmitting(false)
        }
    }, [category, severity, description, betaInfo, submitting, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="beta-feedback-title"
                className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-400" />
                        <h2 id="beta-feedback-title" className="text-sm font-semibold text-zinc-100">Beta Feedback</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                        aria-label="Close feedback modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {submitted ? (
                    /* Success state */
                    <div className="flex flex-col items-center gap-3 px-5 py-10">
                        <CheckCircle className="h-10 w-10 text-emerald-400" />
                        <p className="text-sm text-zinc-300">Thanks! Feedback saved.</p>
                    </div>
                ) : (
                    /* Form */
                    <div className="space-y-4 px-5 py-4">
                        {/* Beta info banner */}
                        {betaInfo?.daysRemaining != null && (
                            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                <span>
                                    Build <code className="font-mono text-zinc-300">{betaInfo.buildId}</code>
                                    {' '}&middot;{' '}
                                    {betaInfo.daysRemaining} day{betaInfo.daysRemaining === 1 ? '' : 's'} remaining
                                </span>
                            </div>
                        )}

                        {/* Category */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Category</label>
                            <div className="flex gap-2">
                                {CATEGORIES.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setCategory(c.value)}
                                        className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                                            category === c.value
                                                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                                                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                                        }`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Severity */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Severity</label>
                            <div className="flex gap-2">
                                {SEVERITIES.map((s) => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setSeverity(s.value)}
                                        className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                                            severity === s.value
                                                ? `${s.color} bg-opacity-10`
                                                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                                What happened?
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe what you were doing, what happened, and what you expected..."
                                rows={4}
                                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                autoFocus
                            />
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSubmit()}
                                disabled={!description.trim() || submitting}
                                className="flex items-center gap-1.5 rounded-lg border border-indigo-500 bg-indigo-500/10 px-4 py-2 text-xs text-indigo-300 transition-colors hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Send className="h-3 w-3" />
                                {submitting ? 'Sending...' : 'Send Feedback'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
