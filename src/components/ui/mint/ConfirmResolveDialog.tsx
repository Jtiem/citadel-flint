/**
 * ConfirmResolveDialog — src/components/ui/mint/ConfirmResolveDialog.tsx
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Modal confirmation shown before Resolve fires. Resolve is destructive —
 * it applies a bulk strategy (prefer-figma OR prefer-local) across all pending
 * conflicts. The dialog lets the user pick a strategy via radio group before
 * confirming. Default selection: prefer-figma.
 *
 * Contract satisfied:
 *   - role="dialog" + aria-modal="true" + radiogroup
 *   - FocusTrap cycles Tab/Shift+Tab within the dialog
 *   - Escape closes via FocusTrap.onClose (wired to onCancel)
 *   - onConfirm returns the selected strategy (ResolveStrategy)
 *
 * Renderer Process only — no Node.js imports.
 */

import { useId, useRef, useState } from 'react'
import { GitMerge } from 'lucide-react'
import { FocusTrap } from '../FocusTrap'
import type {
    ConfirmResolveDialogProps,
    ResolveStrategy,
} from '../../../.flint-context/contracts/MINT.5-phase2.contract'

// ── Component ────────────────────────────────────────────────────────────────

export function ConfirmResolveDialog({
    isOpen,
    conflictCount,
    onConfirm,
    onCancel,
}: ConfirmResolveDialogProps) {
    const titleId = useId()
    const radiogroupId = useId()
    const confirmBtnRef = useRef<HTMLButtonElement>(null)

    // Local selection — default is 'prefer-figma' per contract §"Strategy radio
    // + confirm returns selected strategy". The Confirm button forwards this
    // value via onConfirm.
    const [strategy, setStrategy] = useState<ResolveStrategy>('prefer-figma')

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            data-testid="confirm-resolve-dialog-root"
        >
            {/* Backdrop — aria-hidden, layout only. */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                aria-hidden="true"
            />

            <FocusTrap initialFocusRef={confirmBtnRef as React.RefObject<HTMLElement>} onClose={onCancel}>
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    data-testid="confirm-resolve-dialog"
                    className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
                >
                    {/* ── Header ── */}
                    <div className="flex shrink-0 items-start gap-3 border-b border-zinc-800 px-5 py-4">
                        <GitMerge
                            className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400"
                            aria-hidden="true"
                        />
                        <div className="flex-1">
                            <h2 id={titleId} className="text-sm font-semibold text-white">
                                Resolve {conflictCount} conflict{conflictCount === 1 ? '' : 's'}?
                            </h2>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="px-5 py-4">
                        <p className="mb-3 text-sm text-zinc-300">
                            Choose a strategy to apply to all pending conflicts.
                        </p>
                        <div
                            role="radiogroup"
                            aria-labelledby={radiogroupId}
                            data-testid="confirm-resolve-strategy-group"
                            className="flex flex-col gap-2"
                        >
                            <span id={radiogroupId} className="sr-only">
                                Resolution strategy
                            </span>

                            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-600/10">
                                <input
                                    type="radio"
                                    name="resolve-strategy"
                                    value="prefer-figma"
                                    checked={strategy === 'prefer-figma'}
                                    onChange={() => setStrategy('prefer-figma')}
                                    data-testid="confirm-resolve-strategy-figma"
                                    aria-label="Prefer Figma"
                                />
                                <span className="flex-1">
                                    <span className="font-medium">Prefer Figma</span>
                                    <span className="ml-2 text-xs text-zinc-500">
                                        Overwrite local values with Figma variables.
                                    </span>
                                </span>
                            </label>

                            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 has-[:checked]:border-indigo-600 has-[:checked]:bg-indigo-600/10">
                                <input
                                    type="radio"
                                    name="resolve-strategy"
                                    value="prefer-local"
                                    checked={strategy === 'prefer-local'}
                                    onChange={() => setStrategy('prefer-local')}
                                    data-testid="confirm-resolve-strategy-local"
                                    aria-label="Prefer Local"
                                />
                                <span className="flex-1">
                                    <span className="font-medium">Prefer Local</span>
                                    <span className="ml-2 text-xs text-zinc-500">
                                        Push local values up to Figma.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            data-testid="confirm-resolve-cancel"
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            ref={confirmBtnRef}
                            type="button"
                            onClick={() => onConfirm(strategy)}
                            data-testid="confirm-resolve-confirm"
                            className="rounded-md border border-indigo-600 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition-colors hover:bg-indigo-600/30"
                        >
                            {/* FIX-8 (UX WARN-5): button label reflects the
                                chosen strategy so reflex-pressing Enter does
                                not silently bulk-overwrite — the label itself
                                telegraphs the consequence. */}
                            {strategy === 'prefer-figma' ? 'Use Figma values' : 'Keep local values'}
                        </button>
                    </div>
                </div>
            </FocusTrap>
        </div>
    )
}
