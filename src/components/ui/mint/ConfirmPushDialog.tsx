/**
 * ConfirmPushDialog — src/components/ui/mint/ConfirmPushDialog.tsx
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Modal confirmation shown before Push fires. Push is destructive — it
 * overwrites Figma variables with the local token values — so the dialog
 * blocks the action until the user explicitly confirms.
 *
 * Contract satisfied:
 *   - role="dialog" + aria-modal="true" (inherited from FocusTrap container)
 *   - FocusTrap cycles Tab/Shift+Tab within the dialog
 *   - Escape closes via FocusTrap.onClose (wired to onCancel)
 *   - ENTER on the Confirm button submits (native form button behavior)
 *   - Body text reflects localEditCount with singular/plural copy
 *
 * Renderer Process only — no Node.js imports.
 */

import { useId, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { FocusTrap } from '../FocusTrap'
import type { ConfirmPushDialogProps } from '../../../../.flint-context/contracts/MINT.5-phase2.contract'

// ── Component ────────────────────────────────────────────────────────────────

export function ConfirmPushDialog({
    isOpen,
    localEditCount,
    onConfirm,
    onCancel,
}: ConfirmPushDialogProps) {
    const titleId = useId()
    const descriptionId = useId()
    const confirmBtnRef = useRef<HTMLButtonElement>(null)

    if (!isOpen) return null

    const plural = localEditCount === 1 ? 'change' : 'changes'
    const bodyText =
        localEditCount === 1
            ? 'This will overwrite Figma variables with 1 local token change. Continue?'
            : `Send ${localEditCount} token changes to Figma? This will overwrite Figma variables with ${localEditCount} local token ${plural}. Continue?`

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            data-testid="confirm-push-dialog-root"
        >
            {/* Backdrop — aria-hidden, layout only (no click-to-close per
                COUNSEL.1.7 audit). */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                aria-hidden="true"
            />

            <FocusTrap initialFocusRef={confirmBtnRef as React.RefObject<HTMLElement>} onClose={onCancel}>
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={descriptionId}
                    data-testid="confirm-push-dialog"
                    className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
                >
                    {/* ── Header ── */}
                    <div className="flex shrink-0 items-start gap-3 border-b border-zinc-800 px-5 py-4">
                        <AlertTriangle
                            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
                            aria-hidden="true"
                        />
                        <div className="flex-1">
                            <h2 id={titleId} className="text-sm font-semibold text-white">
                                Push to Figma?
                            </h2>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="px-5 py-4" id={descriptionId}>
                        <p
                            className="text-sm text-zinc-300"
                            data-testid="confirm-push-body"
                        >
                            {bodyText}
                        </p>
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            data-testid="confirm-push-cancel"
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            ref={confirmBtnRef}
                            type="button"
                            onClick={onConfirm}
                            data-testid="confirm-push-confirm"
                            className="rounded-md border border-amber-600 bg-amber-600/20 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-600/30"
                        >
                            Push to Figma
                        </button>
                    </div>
                </div>
            </FocusTrap>
        </div>
    )
}
