/**
 * Modal — src/components/ui/Modal.tsx
 *
 * Reusable accessible modal dialog primitive.
 *
 * Accessibility:
 *   - role="dialog" + aria-modal="true" + aria-labelledby on the dialog panel
 *   - Backdrop has aria-hidden="true" (mouse-only layout surface)
 *   - Escape key closes via FocusTrap.onClose
 *   - Focus trap: cycles Tab/Shift+Tab within the dialog only
 *   - On open: focuses the close button (or initialFocus ref if provided)
 *   - On close: FocusTrap restores focus to the element that opened the dialog
 *
 * NOTE: No backdrop click-to-close. The COUNSEL.1.7 accessibility audit found
 * that <div onClick> backdrop dismissal is mouse-only and fails WCAG 2.1 SC 2.1.1.
 * Keyboard users close via Escape or the explicit close button.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { FocusTrap } from './FocusTrap'

// ── Size map ─────────────────────────────────────────────────────────────────

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface ModalProps {
    isOpen: boolean
    onClose: () => void
    /** Rendered as the dialog heading; also used for aria-labelledby. */
    title: string
    /** Override the auto-generated title element ID for aria-labelledby. */
    titleId?: string
    /** Controls max-width of the dialog panel. Defaults to 'md' (max-w-xl). */
    size?: 'sm' | 'md' | 'lg'
    children: ReactNode
    /** Optional footer slot rendered below the body, separated by a border. */
    footer?: ReactNode
    /** Hide the × close button for flows that need programmatic-only close. */
    hideCloseButton?: boolean
    /** Element to receive focus when the modal opens (falls back to close button). */
    initialFocus?: RefObject<HTMLElement>
    'data-testid'?: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function Modal({
    isOpen,
    onClose,
    title,
    titleId: titleIdProp,
    size = 'md',
    children,
    footer,
    hideCloseButton = false,
    initialFocus,
    'data-testid': testId,
}: ModalProps) {
    // Generate a stable ID for aria-labelledby. If the caller provides titleId,
    // use that instead (useful when the same modal is rendered in multiple places).
    const autoId = useId()
    const titleId = titleIdProp ?? `modal-title-${autoId}`

    // The close button is the default initial-focus target when no initialFocus
    // ref is provided.
    const closeBtnRef = useRef<HTMLButtonElement>(null)
    const focusRef = (initialFocus ?? closeBtnRef) as RefObject<HTMLElement>

    if (!isOpen) return null

    return (
        // Outer portal layer: positions the backdrop and dialog in the viewport.
        // This div is NOT aria-hidden — it is a neutral layout container.
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop — purely visual, aria-hidden so screen readers skip it.
                No onClick: COUNSEL.1.7 audit found backdrop-click-to-close is
                mouse-only and fails WCAG 2.1 SC 2.1.1. Escape handles keyboard. */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                aria-hidden="true"
            />

            {/* FocusTrap wraps the dialog to intercept Tab/Shift+Tab and Escape. */}
            <FocusTrap initialFocusRef={focusRef} onClose={onClose}>
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    data-testid={testId}
                    className={`relative flex w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl`}
                >
                    {/* ── Header ── */}
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-700 px-5 py-4">
                        <h2
                            id={titleId}
                            className="text-sm font-semibold text-white"
                        >
                            {title}
                        </h2>
                        {!hideCloseButton && (
                            <button
                                ref={closeBtnRef}
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    {/* ── Body ── */}
                    <div className="overflow-y-auto px-5 py-4">
                        {children}
                    </div>

                    {/* ── Footer (optional) ── */}
                    {footer && (
                        <div className="shrink-0 border-t border-zinc-700 px-5 py-3">
                            {footer}
                        </div>
                    )}
                </div>
            </FocusTrap>
        </div>
    )
}
