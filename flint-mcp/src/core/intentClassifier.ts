/**
 * intentClassifier.ts — Shared intent classification and persona detection.
 *
 * Extracted from the pattern in `workflow-guide.ts` to support:
 *   - Strategy 2 (Persona Handshake): detect designer vs developer voice
 *   - Strategy 5 (Natural Language Router): map natural language to workflow intents
 *
 * Pure functions, no side effects, deterministic string matching.
 */

// ---------------------------------------------------------------------------
// Persona Detection (Strategy 2)
// ---------------------------------------------------------------------------

export type Persona = 'designer' | 'developer' | 'unknown';

/** Vocabulary signal sets for persona classification. */
const DESIGNER_SIGNALS: string[] = [
    'brand',
    'accessible',
    'look right',
    'match',
    'color',
    'spacing',
    'component looks',
    'design system',
    'does this look',
    'visual',
    'looks off',
    'looks wrong',
    'on brand',
    'off brand',
    'match the design',
    'match the mockup',
    'typography',
    'font',
    'palette',
];

const DEVELOPER_SIGNALS: string[] = [
    'audit',
    'lint',
    'mith',
    'a11y',
    'sarif',
    'ci ',
    ' ci',
    'ci/',
    ' pr ',
    ' pr?',
    ' pr.',
    'my pr',
    'the pr',
    'export gate',
    'fix the errors',
    'violations',
    'wcag',
    'linter',
    'blocking',
    'pipeline',
    'deploy',
    'type error',
    'typescript',
];

/**
 * Detect whether a user message signals a designer or developer persona.
 *
 * Uses vocabulary matching against known signal sets. When both signal sets
 * match (or neither matches), returns 'unknown'.
 *
 * @param message - The user's natural language message
 * @returns The detected persona
 */
export function detectPersona(message: string): Persona {
    const lower = message.toLowerCase();

    const designerMatch = containsAny(lower, DESIGNER_SIGNALS);
    const developerMatch = containsAny(lower, DEVELOPER_SIGNALS);

    if (designerMatch && !developerMatch) return 'designer';
    if (developerMatch && !designerMatch) return 'developer';
    return 'unknown';
}

// ---------------------------------------------------------------------------
// Intent Classification (Strategy 5)
// ---------------------------------------------------------------------------

export type IntentFamily =
    | 'audit-accessibility'
    | 'audit-mithril'
    | 'export-gate-check'
    | 'audit-then-fix'
    | 'health-overview'
    | 'provenance-query'
    | 'token-migration'
    | 'full-audit'
    | 'unknown';

/** Intent classification rules, ordered by specificity (most specific first). */
const INTENT_RULES: Array<{ family: IntentFamily; keywords: string[] }> = [
    {
        family: 'audit-accessibility',
        keywords: [
            'accessible',
            'accessibility',
            'screen reader',
            'a11y',
            'wcag',
            'aria',
            'keyboard nav',
            'tab order',
            'focus',
        ],
    },
    {
        family: 'audit-mithril',
        keywords: [
            'match our brand',
            'brand compliance',
            'design system',
            'color drift',
            'on brand',
            'off brand',
            'token drift',
            'does this match',
            'mithril',
            'mith-',
        ],
    },
    {
        family: 'export-gate-check',
        keywords: [
            'blocking export',
            'blocking my pr',
            'export gate',
            'can i ship',
            'ready to ship',
            'blocking ci',
            'will this pass',
            'gate status',
            "what's blocking",
        ],
    },
    {
        family: 'audit-then-fix',
        keywords: [
            'fix this',
            'fix it',
            'fix everything',
            'fix all',
            'clean this up',
            'clean up',
            'auto-fix',
            'autofix',
            'heal on',
            'heal it',
            'heal the',
            'resolve',
            'fix the errors',
            'fix what',
        ],
    },
    {
        family: 'health-overview',
        keywords: [
            'how is the project',
            'project health',
            'health score',
            'debt report',
            'design debt',
            'how are we doing',
            'project status',
            'overview',
        ],
    },
    {
        family: 'provenance-query',
        keywords: [
            'what did we ship',
            'what changed',
            'mutation history',
            'provenance',
            'what was fixed',
            'last sprint',
            'recent changes',
        ],
    },
    {
        family: 'token-migration',
        keywords: [
            'migrate token',
            'update token',
            'token migration',
            'upgrade tokens',
            'sync tokens',
            'tailwind migration',
            'tw migration',
        ],
    },
    {
        family: 'full-audit',
        keywords: [
            'check everything',
            'audit everything',
            'audit all',
            'full audit',
            'run all checks',
            'scan everything',
        ],
    },
];

/**
 * Classify a user message into an intent family.
 *
 * Matches against known intent keyword sets. First match wins (rules are
 * ordered by specificity). Returns 'unknown' when no rule matches.
 *
 * @param message - The user's natural language message
 * @returns The classified intent family
 */
export function classifyIntent(message: string): IntentFamily {
    const lower = message.toLowerCase();

    for (const rule of INTENT_RULES) {
        if (containsAny(lower, rule.keywords)) {
            return rule.family;
        }
    }

    return 'unknown';
}

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------

/**
 * Returns true if `text` contains any of the given `keywords`.
 * Exported for reuse by workflow-guide.ts.
 */
export function containsAny(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
}
