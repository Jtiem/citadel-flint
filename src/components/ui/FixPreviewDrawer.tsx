/**
 * FixPreviewDrawer.tsx — src/components/ui/FixPreviewDrawer.tsx
 *
 * Intent-first fix preview panel. Shown before applying any auto-fix so the
 * user can see exactly what will change. Supports single and batch mode.
 *
 * UX design (per user spec, OPP-08):
 *   1. Slide-up inline panel (not a modal) — no context loss.
 *   2. Diff view reuses DiffBlock visual language from DiffCard.tsx.
 *   3. "Always auto-fix" checkbox — sets fixMode: 'auto' in useUserPrefs.
 *   4. When "Always auto-fix" is checked, a helper text says:
 *      "You can change this in Policy Settings →" (links to open PolicySettings).
 *   5. Batch mode: shows a scrollable list of all proposed changes.
 *
 * Mithril compliance:
 *   - No hardcoded hex colours — all classes from Flint token palette.
 *   - All interactive elements have accessible names (Commandment 5).
 */

import { useState, useCallback } from 'react'
import { X, Wand2, CheckCircle2, Settings2, AlertTriangle } from 'lucide-react'
import { diffLines } from './DiffCard'
import { useUserPrefs } from '../../hooks/useUserPrefs'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * A single fixable item — the "before → after" data for one auto-fix.
 * Constructed from a LinterWarning when the user clicks Fix.
 */
export interface FixableItem {
    /** data-flint-id of the element to fix */
    nodeId: string
    /** Human-readable label, e.g. "MITHRIL-COL-001 — Button#cta" */
    label: string
    /** The hardcoded class/value being replaced, e.g. "bg-[#3b82f6]" */
    hardcodedClass: string
    /** The token class to replace it with, e.g. "bg-blue-500" */
    tokenClass: string
}

// ── DiffBlock (local, identical visual to DiffCard.DiffBlock) ─────────────────

type DiffLine =
    | { kind: 'addition'; text: string }
    | { kind: 'removal'; text: string }
    | { kind: 'context'; text: string }

function DiffBlock({ lines }: { lines: DiffLine[] }) {
    return (
        <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 font-mono text-[10px] leading-5">
            {lines.map((line, i) => {
                const prefix = line.kind === 'addition' ? '+' : line.kind === 'removal' ? '-' : ' '
                const rowClass =
                    line.kind === 'addition'
                        ? 'bg-emerald-900/30 text-emerald-300'
                        : line.kind === 'removal'
                            ? 'bg-red-900/30 text-red-300'
                            : 'text-zinc-400'
                return (
                    <div key={i} className={`flex gap-2 px-2 ${rowClass}`}>
                        <span className="w-3 shrink-0 select-none opacity-60">{prefix}</span>
                        <span className="whitespace-pre">{line.text}</span>
                    </div>
                )
            })}
        </div>
    )
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface FixPreviewDrawerProps {
    /** One or more items to fix. Batch mode when length > 1. */
    items: FixableItem[]
    /** Called when user confirms the fix(es). */
    onApply: () => void
    /** Called when user dismisses without fixing. */
    onCancel: () => void
    /** Called when user clicks "Policy Settings →" helper text. */
    onOpenSettings: () => void
}

// ── FixPreviewDrawer ───────────────────────────────────────────────────────────

export function FixPreviewDrawer({
    items,
    onApply,
    onCancel,
    onOpenSettings,
}: FixPreviewDrawerProps) {
    const [prefs, setPrefs] = useUserPrefs()
    const [alwaysAuto, setAlwaysAuto] = useState(prefs.fixMode === 'auto')

    const handleAlwaysAutoChange = useCallback(
        (checked: boolean) => {
            setAlwaysAuto(checked)
            setPrefs({ fixMode: checked ? 'auto' : 'preview' })
        },
        [setPrefs],
    )

    const handleApply = useCallback(() => {
        onApply()
    }, [onApply])

    const isBatch = items.length > 1

    return (
        <div
            className="border-t border-indigo-500/30 bg-zinc-900"
            role="region"
            aria-label={isBatch ? `Batch fix preview — ${items.length} changes` : 'Fix preview'}
        >
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <Wand2 size={12} className="shrink-0 text-indigo-400" aria-hidden="true" />
                <span className="flex-1 text-xs font-medium text-zinc-200">
                    {isBatch
                        ? `Preview ${items.length} fixes`
                        : 'Preview fix'}
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Dismiss fix preview"
                    className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                >
                    <X size={12} />
                </button>
            </div>

            {/* ── Body ─────────────────────────────────────────────────── */}
            <div className="max-h-64 overflow-y-auto">
                {isBatch ? (
                    // Batch mode: compact list
                    <ol className="divide-y divide-zinc-800/50">
                        {items.map((item, idx) => {
                            const diffResult = diffLines(
                                `className="${item.hardcodedClass}"`,
                                `className="${item.tokenClass}"`,
                            )
                            return (
                                <li key={item.nodeId + idx} className="px-3 py-2 space-y-1">
                                    <p className="text-[10px] text-zinc-500 truncate" title={item.label}>
                                        <span className="font-medium text-zinc-400">{idx + 1}.</span>{' '}
                                        {item.label}
                                    </p>
                                    <DiffBlock lines={diffResult} />
                                </li>
                            )
                        })}
                    </ol>
                ) : (
                    // Single mode: full diff
                    <div className="px-3 py-2 space-y-1.5">
                        {items[0] && (
                            <>
                                <p className="text-[10px] text-zinc-500 truncate" title={items[0].label}>
                                    {items[0].label}
                                </p>
                                <DiffBlock
                                    lines={diffLines(
                                        `className="${items[0].hardcodedClass}"`,
                                        `className="${items[0].tokenClass}"`,
                                    )}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── "Always auto-fix" preference ─────────────────────────── */}
            <div className="border-t border-zinc-800 px-3 py-2 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={alwaysAuto}
                        onChange={(e) => handleAlwaysAutoChange(e.target.checked)}
                        className="h-3 w-3 rounded border-zinc-600 bg-zinc-800 accent-indigo-500"
                        aria-label="Always auto-fix without preview"
                    />
                    <span className="text-[11px] text-zinc-400">
                        Always auto-fix (skip preview)
                    </span>
                </label>
                {alwaysAuto && (
                    <p className="flex items-center gap-1 text-[10px] text-zinc-600">
                        <AlertTriangle size={9} className="text-amber-500 shrink-0" aria-hidden="true" />
                        Auto-fixes will apply immediately.{' '}
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                            aria-label="Open Policy Settings to change fix behavior"
                        >
                            <Settings2 size={8} aria-hidden="true" />
                            Change in Settings →
                        </button>
                    </p>
                )}
            </div>

            {/* ── Action buttons ────────────────────────────────────────── */}
            <div className="flex gap-2 border-t border-zinc-800 px-3 py-2">
                <button
                    type="button"
                    onClick={handleApply}
                    className="flex items-center gap-1 rounded bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-600/30"
                    aria-label={isBatch ? `Apply all ${items.length} fixes` : 'Apply fix'}
                >
                    <CheckCircle2 size={11} aria-hidden="true" />
                    {isBatch ? `Apply all (${items.length})` : 'Apply fix'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded px-3 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                    aria-label="Cancel and discard fix"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}
