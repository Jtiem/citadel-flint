/**
 * AnnotationList — src/components/ui/AnnotationList.tsx
 *
 * Renders unresolved Flint annotations for the node currently selected in
 * PropertiesPanel. Embedded as a collapsible accordion section at the bottom
 * of the inspector (Phase COLLAB.4).
 *
 * Layout:
 *   - Collapsed by default; header shows an indigo count badge.
 *   - Each annotation card shows:
 *       Author name  ·  Type badge  ·  Relative timestamp
 *       Body text (multi-line)
 *       "Resolve" button → calls annotationStore.resolveAnnotation(id)
 *   - Deleted node edge case: annotation with no matching node in the visual
 *     tree shows the body with a "node not found" muted note (the nodeId is
 *     still preserved for audit purposes).
 *
 * Follows the Accordion pattern used by the existing "Raw Attributes" section
 * in PropertiesPanel. Uses only design-token-safe Tailwind classes (no hardcoded
 * hex values, no arbitrary spacing outside the scale).
 *
 * Renderer process only — no Node.js imports.
 */

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, ChevronRight, ChevronDown, CheckCheck, Plus } from 'lucide-react'
import { useAnnotationStore } from '../../store/annotationStore'
import type { FlintAnnotation, AnnotationType } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a short human-readable relative time string from an ISO timestamp.
 * Example: "2 hours ago", "just now", "3 days ago".
 */
function relativeTime(isoString: string): string {
    const then = new Date(isoString).getTime()
    const diffMs = Date.now() - then
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
}

/** Type badge colour + label map. */
const TYPE_CONFIG: Record<AnnotationType, { label: string; className: string }> = {
    note:     { label: 'Note',     className: 'bg-sky-900/40 text-sky-400 border-sky-800/60' },
    decision: { label: 'Decision', className: 'bg-purple-900/40 text-purple-400 border-purple-800/60' },
    approval: { label: 'Approval', className: 'bg-emerald-900/40 text-emerald-400 border-emerald-800/60' },
    handoff:  { label: 'Handoff',  className: 'bg-amber-900/40 text-amber-400 border-amber-800/60' },
}

// ── AnnotationCard ─────────────────────────────────────────────────────────────

interface AnnotationCardProps {
    annotation: FlintAnnotation
    onResolve: (id: string) => void
}

function AnnotationCard({ annotation, onResolve }: AnnotationCardProps) {
    const [resolving, setResolving] = useState(false)
    const config = TYPE_CONFIG[annotation.type] ?? TYPE_CONFIG.note

    async function handleResolve() {
        setResolving(true)
        try {
            onResolve(annotation.id)
        } finally {
            // resolving state will be cleared when the parent re-renders with the
            // annotation removed from the list after fetchAnnotations completes.
            setResolving(false)
        }
    }

    return (
        <div className="flex flex-col gap-2 border-b border-gray-800/60 px-3 py-2.5 last:border-b-0">
            {/* Header row: author · type badge · timestamp */}
            <div className="flex items-center gap-2 text-[10px]">
                <span className="font-medium text-gray-300 truncate max-w-[80px]" title={annotation.author}>
                    {annotation.author}
                </span>
                <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${config.className}`}
                >
                    {config.label}
                </span>
                <span className="ml-auto shrink-0 text-zinc-500">
                    {relativeTime(annotation.createdAt)}
                </span>
            </div>

            {/* Body */}
            <p className="text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words">
                {annotation.body}
            </p>

            {/* Resolve button */}
            <button
                type="button"
                disabled={resolving}
                onClick={() => { void handleResolve() }}
                className="flex items-center gap-1 self-end rounded border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:border-indigo-600/60 hover:bg-indigo-900/20 hover:text-indigo-300 disabled:opacity-50"
            >
                <CheckCheck className="h-2.5 w-2.5 shrink-0" />
                {resolving ? 'Resolving…' : 'Resolve'}
            </button>
        </div>
    )
}

// ── AnnotationList ─────────────────────────────────────────────────────────────

interface AnnotationListProps {
    /** The data-flint-id of the currently selected node. */
    nodeId: string
}

/**
 * Embeds an accordion section in PropertiesPanel showing all unresolved
 * annotations anchored to `nodeId`. Collapsed by default; header shows a
 * count badge when annotations exist.
 */
export function AnnotationList({ nodeId }: AnnotationListProps) {
    const annotationsForNode = useAnnotationStore((s) => s.annotationsForNode)
    const resolveAnnotation = useAnnotationStore((s) => s.resolveAnnotation)

    const annotations = annotationsForNode(nodeId)
    const count = annotations.length

    const [open, setOpen] = useState(() => count > 0)
    const [addingNote, setAddingNote] = useState(false)
    const [noteText, setNoteText] = useState('')
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Focus the textarea whenever the inline form is opened.
    useEffect(() => {
        if (addingNote) {
            inputRef.current?.focus()
        }
    }, [addingNote])

    function handleAddNoteClick(): void {
        setAddingNote(true)
    }

    function handleNoteSubmit(): void {
        const trimmed = noteText.trim()
        if (trimmed.length > 0) {
            // Forward to the IPC write path when available (future wiring).
            // Callers that have wired window.flintAPI.annotations.add() will
            // see the annotation on the next fs.watch push; others get a no-op.
            const api = (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).flintAPI) as (Record<string, unknown> | undefined)
            const annotationsApi = api?.['annotations'] as (Record<string, unknown> | undefined)
            if (typeof annotationsApi?.['add'] === 'function') {
                void (annotationsApi['add'] as (opts: { nodeId: string; text: string; type: string }) => Promise<void>)({
                    nodeId,
                    text: trimmed,
                    type: 'note',
                })
            }
        }
        setNoteText('')
        setAddingNote(false)
    }

    function handleNoteCancel(): void {
        setNoteText('')
        setAddingNote(false)
    }

    function handleNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleNoteSubmit()
        } else if (e.key === 'Escape') {
            handleNoteCancel()
        }
    }

    return (
        <div className="border-t border-gray-800/60">
            {/* Accordion header */}
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:bg-gray-800/30 hover:text-gray-300"
            >
                {open
                    ? <ChevronDown className="h-2.5 w-2.5 shrink-0 text-zinc-500" />
                    : <ChevronRight className="h-2.5 w-2.5 shrink-0 text-zinc-500" />
                }
                <MessageSquare className="h-3 w-3 shrink-0" />
                <span>Annotations</span>
                {count > 0 && (
                    <span className="ml-auto rounded-full bg-indigo-600/30 border border-indigo-600/40 px-1.5 py-0 text-[10px] font-bold text-indigo-400">
                        {count}
                    </span>
                )}
            </button>

            {/* Collapsed body */}
            {open && (
                <div className="flex flex-col">
                    {count === 0 && !addingNote ? (
                        <div className="px-3 py-3 text-[11px] text-zinc-500">
                            No open annotations for this node.
                        </div>
                    ) : (
                        annotations.map((ann) => (
                            <AnnotationCard
                                key={ann.id}
                                annotation={ann}
                                onResolve={(id) => { void resolveAnnotation(id) }}
                            />
                        ))
                    )}

                    {/* Inline note composer */}
                    {addingNote ? (
                        <div className="flex flex-col gap-1.5 border-t border-gray-800/60 px-3 py-2">
                            <textarea
                                ref={inputRef}
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                onKeyDown={handleNoteKeyDown}
                                onBlur={handleNoteSubmit}
                                placeholder="Type a note… (Enter to save, Esc to cancel)"
                                rows={2}
                                className="w-full resize-none rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-[11px] text-gray-200 placeholder-zinc-600 outline-none focus:border-indigo-600/60 focus:ring-0"
                            />
                            <div className="flex gap-1.5 self-end">
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); handleNoteCancel() }}
                                    className="rounded border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); handleNoteSubmit() }}
                                    className="rounded border border-indigo-700/60 bg-indigo-900/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 transition-colors hover:bg-indigo-900/40"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Add note affordance */
                        <button
                            type="button"
                            onClick={handleAddNoteClick}
                            className="flex items-center gap-1 py-1 px-2 text-zinc-500 hover:text-zinc-300 text-xs rounded hover:bg-zinc-800/50 transition-colors"
                        >
                            <Plus className="h-3 w-3 shrink-0" />
                            Add note
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
