/**
 * resetOnboarding.ts — src/utils/resetOnboarding.ts
 *
 * Clears all onboarding-related localStorage keys so that tips,
 * walkthroughs, and overlays re-appear on the next page load.
 *
 * Exported for use by the CommandPalette "Reset tips" action.
 */

import { ONBOARDING_STORAGE_KEY } from '../components/ui/OnboardingOverlay'

/** localStorage key used by DemoWalkthrough. */
const DEMO_WALKTHROUGH_KEY = 'flint-demo-walkthrough-complete'

/** Prefix used by useOnboardingTooltip for per-feature tips. */
const TOOLTIP_PREFIX = 'flint:tooltip:'

/**
 * Clears every onboarding / tooltip localStorage entry so the user
 * sees all tips again on their next interaction.
 *
 * Safe to call at any time — if localStorage is unavailable (e.g.
 * private browsing with storage blocked), failures are silently ignored.
 */
export function resetOnboardingTips(): void {
    try {
        // 1. OnboardingOverlay 3-step tooltip
        localStorage.removeItem(ONBOARDING_STORAGE_KEY)

        // 2. DemoWalkthrough 5-step guided tour
        localStorage.removeItem(DEMO_WALKTHROUGH_KEY)

        // 3. All useOnboardingTooltip per-feature keys (flint:tooltip:*)
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(TOOLTIP_PREFIX)) {
                keysToRemove.push(key)
            }
        }
        for (const key of keysToRemove) {
            localStorage.removeItem(key)
        }
    } catch {
        // localStorage unavailable — nothing to clear
    }
}
