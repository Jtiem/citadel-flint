/**
 * A11y engine barrel export — flint-mcp/src/core/a11y/index.ts
 *
 * Public API for the EXP.6 accessibility engine.
 */

export * from './types.js'
export * from './helpers.js'
export * from './contrast-utils.js'
export { audit, auditSync, registerRules, resetRules, getRegisteredRules } from './runner.js'
export type { RunnerOptions } from './runner.js'
export { applyFixes, applyFixMutationToAst, generateCode } from './fixer.js'
export type { FixApplicationResult } from './fixer.js'

// Rule modules
export { namesLabelsRules } from './rules/names-labels.js'
export { keyboardRules } from './rules/keyboard.js'
export { structureRules } from './rules/structure.js'
export { ariaRules } from './rules/aria.js'
export { landmarksRules } from './rules/landmarks.js'
export { contrastRules } from './rules/contrast.js'
export { formsRules } from './rules/forms.js'
export { liveRegionsRules } from './rules/live-regions.js'
export { motionRules } from './rules/motion.js'
