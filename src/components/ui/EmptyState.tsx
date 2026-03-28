/**
 * EmptyState — reusable zero-data state for all Glass panels.
 *
 * Renders a centered icon + title + optional description + optional CTA.
 * Callers style the icon externally (e.g. `<Layers className="h-6 w-6 text-zinc-600" />`).
 *
 * @module GLASS.2.3
 */

import type { ReactNode } from 'react'

export interface EmptyStateProps {
    /** Lucide icon element — already styled by the caller */
    icon: ReactNode
    /** Primary label (text-sm text-zinc-400) */
    title: string
    /** Secondary guidance (text-xs text-zinc-500) */
    description?: string
    /** Optional CTA button */
    action?: {
        label: string
        onClick: () => void
    }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            {icon}
            <p className="text-sm text-zinc-400">{title}</p>
            {description && (
                <p className="max-w-[240px] text-xs text-zinc-500">{description}</p>
            )}
            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="mt-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                    {action.label}
                </button>
            )}
        </div>
    )
}
