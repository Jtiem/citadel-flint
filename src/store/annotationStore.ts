/**
 * Annotation Store — src/store/annotationStore.ts
 *
 * Zustand v5 store for Bridge annotation state (Phase COLLAB.4).
 *
 * Annotations originate in the MCP tool (bridge_annotate) which writes them to
 * .bridge/annotations.json on the local filesystem. The main process watches
 * that file via fs.watch and pushes a 'bridge:annotations-changed' IPC event to
 * the renderer whenever the file changes. This store reacts to that event by
 * re-fetching via 'annotations:read-all'.
 *
 * State:
 *   annotations       — All BridgeAnnotation records read from the file. The
 *                        list is unfiltered; derived views (annotationsForNode)
 *                        are implemented as store actions, not stored state.
 *
 * Actions:
 *   fetchAnnotations   — Calls window.bridgeAPI.annotations.readAll() and
 *                        replaces the in-memory list. Safe to call on every
 *                        'bridge:annotations-changed' IPC event.
 *   resolveAnnotation  — Calls window.bridgeAPI.annotations.resolve(id), then
 *                        immediately re-fetches so the UI is consistent without
 *                        waiting for the fs.watch round-trip.
 *   annotationsForNode — Derived selector: returns unresolved annotations for
 *                        a given nodeId. Filters the in-memory list; no IPC.
 *
 * Separation of concerns:
 *   This store is orthogonal to all existing stores. Embedding it in canvasStore
 *   or editorStore would violate single-responsibility (the JTBD spec, line 252).
 *   The store has no awareness of canvasStore or editorStore — cross-store
 *   coordination happens in components/hooks, not inside stores.
 *
 * Renderer process only — no Node.js imports.
 */

import { create } from 'zustand'
import type { BridgeAnnotation } from '../types/bridge-api'

// ── Store shape ────────────────────────────────────────────────────────────────

interface AnnotationState {
    /** Full annotation list as read from .bridge/annotations.json via IPC. */
    annotations: BridgeAnnotation[]
}

interface AnnotationActions {
    /**
     * Re-fetches all annotations from the main process and replaces the
     * in-memory list. Called on mount and on every 'bridge:annotations-changed'
     * push event.
     *
     * No-ops gracefully when window.bridgeAPI is unavailable (test / headless).
     */
    fetchAnnotations: () => Promise<void>

    /**
     * Marks the annotation with `id` as resolved via IPC, then re-fetches so
     * the UI reflects the change immediately without waiting for the fs.watch
     * round-trip.
     *
     * No-ops when window.bridgeAPI is unavailable.
     */
    resolveAnnotation: (id: string) => Promise<void>

    /**
     * Returns all unresolved annotations anchored to `nodeId`.
     *
     * This is a derived selector — it filters the in-memory list and returns
     * a new array on every call. Callers should memoize if needed.
     * Private annotations from other authors are excluded (single-user v1 scope).
     */
    annotationsForNode: (nodeId: string) => BridgeAnnotation[]
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAnnotationStore = create<AnnotationState & AnnotationActions>(
    (set, get) => ({
        annotations: [],

        fetchAnnotations: async () => {
            if (typeof window === 'undefined' || !window.bridgeAPI?.annotations) return
            try {
                const data = await window.bridgeAPI.annotations.readAll()
                // The IPC layer returns BridgeAnnotation[] passed through preload as
                // unknown[] (contextBridge serialisation). Re-cast here — the main
                // process handler guarantees the shape (reads from the typed JSON file).
                set({ annotations: data as BridgeAnnotation[] })
            } catch (err) {
                console.error('[Bridge] annotationStore.fetchAnnotations failed:', err)
            }
        },

        resolveAnnotation: async (id: string) => {
            if (typeof window === 'undefined' || !window.bridgeAPI?.annotations) return
            try {
                await window.bridgeAPI.annotations.resolve(id)
                // Optimistic: re-fetch immediately rather than waiting for fs.watch
                await get().fetchAnnotations()
            } catch (err) {
                console.error('[Bridge] annotationStore.resolveAnnotation failed:', err)
            }
        },

        annotationsForNode: (nodeId: string) => {
            return get().annotations.filter(
                (a) => a.nodeId === nodeId && a.status === 'open'
            )
        },
    })
)

/**
 * Named selector hook — subscribes only to the annotations array.
 * Use this in components that render lists to avoid re-rendering on action changes.
 */
export const useAnnotations = () => useAnnotationStore((s) => s.annotations)
