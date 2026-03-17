/**
 * Live Regions rules — bridge-mcp/src/core/a11y/rules/live-regions.ts
 *
 * TODO EXP.6b: A11Y-080 through A11Y-083
 *
 * A11Y-080: Status messages must use role="status" or aria-live
 * A11Y-081: Alert dialogs must use role="alertdialog"
 *
 * These rules require runtime behavior analysis (detecting when content
 * changes) and are deferred to EXP.6b.
 *
 * WCAG: 4.1.3 Status Messages
 */

import type { A11yRule } from '../types.js'

// TODO EXP.6b: Implement live-region rules
// These rules detect patterns like:
//   - A11Y-080: toast/notification elements missing aria-live or role="status"
//   - A11Y-081: modal dialogs using role="dialog" instead of role="alertdialog" for alerts
//   - A11Y-082: aria-live="assertive" overuse (should be role="alert")
//   - A11Y-083: aria-atomic missing on live regions with partial updates

export const liveRegionsRules: A11yRule[] = []
