/**
 * FocusTrap — src/components/ui/FocusTrap.tsx
 *
 * GLASS.2.2: Keyboard focus trap for modal dialogs.
 *
 * Wraps children in a container that intercepts Tab / Shift+Tab to cycle
 * focus within the trapped region. Handles dynamic content by re-querying
 * focusable elements on each Tab press rather than caching on mount.
 *
 * On mount: focuses the first focusable element (or `initialFocusRef` if
 * provided) and captures `document.activeElement` so focus can be restored
 * on unmount.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

// ── Focusable element selector ───────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not(:disabled)',
    'textarea:not(:disabled)',
    'input:not(:disabled)',
    'select:not(:disabled)',
    '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Query focusable elements in document order. Sorts the result explicitly
 * because some DOM implementations (notably jsdom) may return compound
 * selector matches in selector-match order rather than document order.
 */
function queryFocusable(container: HTMLElement): HTMLElement[] {
    const elements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    )
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    elements.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    )
    return elements
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface FocusTrapProps {
    children: ReactNode
    /**
     * Optional ref to the element that should receive initial focus.
     * Falls back to the first focusable element inside the container.
     */
    initialFocusRef?: RefObject<HTMLElement | null>
    /**
     * Called when the user presses Escape while the trap is active.
     * Typically used to close the modal/dialog containing the trap.
     */
    onClose?: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function FocusTrap({ children, initialFocusRef, onClose }: FocusTrapProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const previousFocusRef = useRef<Element | null>(null)

    // Capture the element that was focused before the trap mounted,
    // set initial focus, and restore focus on unmount.
    useEffect(() => {
        previousFocusRef.current = document.activeElement

        // Defer initial focus to the next microtask so the container's
        // children have mounted and are queryable.
        const timer = setTimeout(() => {
            if (initialFocusRef?.current) {
                initialFocusRef.current.focus()
                return
            }

            const container = containerRef.current
            if (!container) return

            const focusable = queryFocusable(container)
            focusable[0]?.focus()
        }, 0)

        return () => {
            clearTimeout(timer)
            // Restore focus to the element that triggered the modal
            const prev = previousFocusRef.current
            if (prev && prev instanceof HTMLElement) {
                prev.focus()
            }
        }
    // initialFocusRef is a ref — stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Intercept Tab / Shift+Tab to keep focus within the trap, and Escape to
    // close. Re-queries focusable elements on every keydown so dynamic content
    // (elements added/removed while the trap is active) is handled correctly.
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            // Escape — dismiss the trap owner
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose?.()
                return
            }

            if (e.key !== 'Tab') return

            const container = containerRef.current
            if (!container) return

            const focusableElements = queryFocusable(container)

            if (focusableElements.length === 0) return

            const first = focusableElements[0]
            const last = focusableElements[focusableElements.length - 1]

            if (e.shiftKey) {
                // Shift+Tab on the first element -> wrap to last
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                // Tab on the last element -> wrap to first
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    // onClose is intentionally stable at the call site; lint suppressed to
    // match the existing pattern for this file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose])

    // LOW-02: If focus leaves the container (e.g. screen reader virtual
    // cursor or programmatic focus elsewhere), redirect back to the first
    // focusable element inside the trap.
    useEffect(() => {
        function handleFocusIn(e: FocusEvent) {
            const container = containerRef.current
            if (!container) return
            if (e.target instanceof Node && container.contains(e.target)) return
            // Focus has escaped — pull it back to the first focusable element
            const focusable = queryFocusable(container)
            focusable[0]?.focus()
        }

        document.addEventListener('focusin', handleFocusIn)
        return () => document.removeEventListener('focusin', handleFocusIn)
    }, [])

    return (
        <div ref={containerRef} data-focus-trap aria-modal="true">
            {children}
        </div>
    )
}
