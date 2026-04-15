/**
 * FixPreviewDrawerHost.tsx — C17
 *
 * Wires the FixPreviewDrawer into the dashboard context.
 * Renders only when fixPreviewItems is non-null.
 * Pure presentational — all state and callbacks passed as props.
 */

import { FixPreviewDrawer, type FixableItem } from '../FixPreviewDrawer'

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface FixPreviewDrawerHostProps {
    /** Items queued for preview, or null when the drawer is closed. */
    fixPreviewItems: FixableItem[] | null
    /** Called when the user confirms the fix. */
    onApply: () => void
    /** Called when the user cancels/closes the drawer. */
    onCancel: () => void
    /** Called when "Open Settings" is invoked inside the drawer. */
    onOpenSettings: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FixPreviewDrawerHost({
    fixPreviewItems,
    onApply,
    onCancel,
    onOpenSettings,
}: FixPreviewDrawerHostProps) {
    if (!fixPreviewItems) return null

    return (
        <FixPreviewDrawer
            items={fixPreviewItems}
            onApply={onApply}
            onCancel={onCancel}
            onOpenSettings={onOpenSettings}
        />
    )
}
