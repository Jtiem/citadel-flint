/**
 * useAutoTabSwitch — src/hooks/useAutoTabSwitch.ts
 *
 * Side-effect hook that watches `canvasStore.activeSelection` and fires
 * `setRightTab('properties')` on null→id transitions, UNLESS the user has
 * manually overridden the tab this session (userOverrodeTab === true).
 *
 * On selection clear (id→null), `setActiveSelection(null)` resets
 * `userOverrodeTab` to false inside canvasStore so the NEXT selection is
 * allowed to auto-switch again. The hook observes this as a natural
 * consequence of canvasStore's `setActiveSelection` implementation.
 *
 * Transition semantics:
 *   null  → id           Switch to Properties tab (unless userOverrodeTab).
 *   id    → null         No tab switch; userOverrodeTab resets (in store).
 *   id    → different id No tab switch — user already on Properties from
 *                        the initial selection; don't interrupt.
 *
 * Mount point: once at App root or PropertiesPanel parent.
 * Returns nothing — purely reactive side effect.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store/canvasStore'

export function useAutoTabSwitch(): void {
    const activeSelection  = useCanvasStore((s) => s.activeSelection)
    const userOverrodeTab  = useCanvasStore((s) => s.userOverrodeTab)
    const setRightTab      = useCanvasStore((s) => s.setRightTab)

    // Track previous selection to detect null→id transitions.
    const prevSelectionRef = useRef<string | null>(activeSelection)

    useEffect(() => {
        const prev = prevSelectionRef.current
        const curr = activeSelection

        // null → id: first time a node is selected (or re-selected after clear)
        if (prev === null && curr !== null) {
            if (!userOverrodeTab) {
                setRightTab('properties')
            }
        }

        // Update ref for next render
        prevSelectionRef.current = curr
    }, [activeSelection, userOverrodeTab, setRightTab])
}
