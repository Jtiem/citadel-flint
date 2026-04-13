/**
 * Shared MRS (Mutation Risk Scoring) weight tables.
 *
 * Canonical source for op weights and tier floors used by both:
 * - electron/mrsEngine.ts (orchestrator tool names)
 * - flint-mcp/src/core/governance/riskScoringService.ts (AST modifier names)
 *
 * Both pipelines MUST produce identical risk assessments for the same operation.
 */

export type MRSTier = 'green' | 'amber' | 'red'

/**
 * Canonical op risk weights (0.0-1.0).
 * Keys use AST modifier names (lowercase, no prefix).
 * The Electron orchestrator maps its `flint_*` tool names to these canonical names.
 */
export const CANONICAL_OP_WEIGHTS: Record<string, number> = {
    updateText:         0.15,
    updateTextContent:  0.15,   // alias used by mutations_ledger
    updateProp:         0.20,
    addClass:           0.10,
    removeClass:        0.10,
    updateClassName:    0.10,
    fixToken:           0.10,
    insertNode:         0.55,
    inject:             0.55,   // alias for insertNode
    injectNode:         0.55,   // alias for insertNode
    wrapNode:           0.60,
    wrap:               0.60,   // alias for wrapNode
    deleteNode:         0.90,
    delete:             0.90,   // alias for deleteNode
    moveNode:           0.60,
    move:               0.60,   // alias for moveNode
    assembleLayout:     0.70,
    crossFileMove:      0.85,
    emitHook:           0.35,
    emitHandler:        0.30,
    emitCallback:       0.25,
    emitImport:         0.10,
    emitConditional:    0.40,
    emitMap:            0.50,
    composeSlot:        0.45,
}

export const CANONICAL_UNKNOWN_OP_WEIGHT = 0.50

/**
 * Minimum tier floors for specific operations.
 * Ensures destructive operations always reach a baseline tier regardless
 * of blast radius or violation context.
 * Keys use canonical (AST modifier) names.
 */
export const CANONICAL_TIER_FLOORS: Record<string, MRSTier> = {
    insertNode:      'amber',
    inject:          'amber',
    injectNode:      'amber',
    wrapNode:        'amber',
    wrap:            'amber',
    deleteNode:      'red',
    delete:          'red',
    emitHook:        'amber',
    emitHandler:     'amber',
    emitConditional: 'amber',
    emitMap:         'amber',
    composeSlot:     'amber',
}

/**
 * Map orchestrator tool names (flint_*) to canonical names.
 */
export const ORCHESTRATOR_TO_CANONICAL: Record<string, string> = {
    flint_update_text:       'updateText',
    flint_update_props:      'updateProp',
    flint_add_class:         'addClass',
    flint_remove_class:      'removeClass',
    flint_insert_node:       'insertNode',
    flint_wrap_node:         'wrapNode',
    flint_delete_node:       'deleteNode',
    flint_emit_hook:         'emitHook',
    flint_emit_handler:      'emitHandler',
    flint_emit_callback:     'emitCallback',
    flint_emit_import:       'emitImport',
    flint_emit_conditional:  'emitConditional',
    flint_emit_map:          'emitMap',
    flint_compose_slot:      'composeSlot',
}
