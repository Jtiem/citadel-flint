/**
 * Motion rules — bridge-mcp/src/core/a11y/rules/motion.ts
 *
 * TODO EXP.6b: A11Y-090 through A11Y-091
 *
 * A11Y-090: Animations must respect prefers-reduced-motion
 * A11Y-091: Autoplay media must have controls
 *
 * These rules require CSS analysis (detecting animation classes/keyframes)
 * and are deferred to EXP.6b.
 *
 * WCAG: 2.3.1 Three Flashes or Below Threshold, 2.3.3 Animation from Interactions
 */

import type { A11yRule } from '../types.js'

// TODO EXP.6b: Implement motion rules
// These rules detect patterns like:
//   - A11Y-090: Tailwind animate-* classes without motion-safe:/ motion-reduce: guards
//   - A11Y-091: <video> or <audio> elements without controls attribute
//              and without muted+autoplay combination check

export const motionRules: A11yRule[] = []
