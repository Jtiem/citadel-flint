/**
 * TabUnlockTooltip — src/components/ui/TabUnlockTooltip.tsx
 *
 * Sprint CLARITY-2, Item 2: Shows a one-time narration tooltip below a
 * dynamically-unlocked tab button, explaining what it does and why it appeared.
 * Uses useOnboardingTooltip for localStorage-based dismissal persistence.
 */

import React from 'react'
import { X } from 'lucide-react'
import { useOnboardingTooltip } from '../../hooks/useOnboardingTooltip'
import type { TabUnlockTooltipProps } from '../../../docs/contracts/sprint-clarity-2.contract'

export const TabUnlockTooltip: React.FC<TabUnlockTooltipProps> = ({
    tooltipKey,
    text,
    children,
}) => {
    const { shouldShow, dismiss } = useOnboardingTooltip(tooltipKey)

    return (
        <div className="relative" data-testid="tab-unlock-tooltip-wrapper">
            {children}
            {shouldShow && (
                <div
                    className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 shadow-lg border border-zinc-700"
                    role="status"
                    data-testid="tab-unlock-tooltip"
                >
                    <span>{text}</span>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="ml-2 inline-flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                        aria-label="Dismiss tooltip"
                        data-testid="tab-unlock-tooltip-dismiss"
                    >
                        <X size={10} />
                    </button>
                </div>
            )}
        </div>
    )
}
