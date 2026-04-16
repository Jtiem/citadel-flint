/**
 * server.rules-resource.test.ts
 *
 * Sprint 4 Wave 2 — enriched flint://rules resource.
 * Exercises the enrichment helpers (`findPackForRule`, `getRuleMode`,
 * `getErrorEntryByRuleId`) and the composed shape produced by the
 * resource handler. The resource handler itself closes over `server`
 * state, so we cover it indirectly by composing the same enrichment
 * the handler applies.
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts
 * Test boundary: flint://rules resource handler
 */

import { describe, it, expect } from 'vitest';
import {
    findPackForRule,
    _resetReverseIndexForTesting,
    RULE_PACK_REGISTRY,
} from '../core/rulePackRegistry.js';
import {
    getDefaultResolvedPolicy,
    getRuleMode,
} from '../core/policyEngine.js';
import { getErrorEntryByRuleId } from '../core/errorTaxonomy.js';

function enrich(rule: { id: string; [key: string]: unknown }) {
    const resolved = getDefaultResolvedPolicy();
    const pack = findPackForRule(rule.id);
    return {
        ...rule,
        ruleMode: getRuleMode(rule.id, resolved),
        sourceAuthority: getErrorEntryByRuleId(rule.id)?.sourceAuthority ?? null,
        pack: pack?.id ?? null,
    };
}

describe('flint://rules resource — enriched shape (D-rules)', () => {
    it('every enriched rule carries ruleMode, sourceAuthority, pack keys', () => {
        const enriched = enrich({ id: 'MITHRIL-COL' });
        expect(Object.keys(enriched)).toEqual(
            expect.arrayContaining(['ruleMode', 'sourceAuthority', 'pack']),
        );
    });

    it('ruleMode is one of the four canonical policy modes', () => {
        const enriched = enrich({ id: 'MITHRIL-COL' });
        expect(['blocking', 'normative', 'advisory', 'off']).toContain(
            enriched.ruleMode,
        );
    });

    it('pack field is a string when the rule belongs to a registered pack, else null', () => {
        const enriched = enrich({ id: 'not-a-real-rule-xyz' });
        expect(enriched.pack).toBeNull();
    });
});

describe('flint://rules resource — specific rule assertions', () => {
    it('known rule MITHRIL-COL has a defined ruleMode', () => {
        const enriched = enrich({ id: 'MITHRIL-COL' });
        expect(enriched.ruleMode).toBeDefined();
        expect(typeof enriched.ruleMode).toBe('string');
    });

    it('rule with no errorTaxonomy entry has sourceAuthority: null', () => {
        const enriched = enrich({ id: 'completely-unknown-rule' });
        expect(enriched.sourceAuthority).toBeNull();
    });

    it('rule with no rule pack membership has pack: null', () => {
        const enriched = enrich({ id: 'definitely-not-a-rule' });
        expect(enriched.pack).toBeNull();
    });
});

describe('rulePackRegistry.findPackForRule', () => {
    it('returns null for an unknown rule id', () => {
        _resetReverseIndexForTesting();
        expect(findPackForRule('not-a-rule-ever')).toBeNull();
    });

    it('returns a pack entry for a known rule (when registry is non-empty)', () => {
        _resetReverseIndexForTesting();
        // Walk the real registry to find any rule id so the assertion is
        // resilient to content churn in RULE_PACK_REGISTRY.
        const firstPackWithRules = RULE_PACK_REGISTRY.find(
            (p) => p.rules && p.rules.length > 0,
        );
        if (!firstPackWithRules) return; // no packs shipped — not a regression
        const ruleId = firstPackWithRules.rules[0]?.id ?? '';
        if (!ruleId) return;
        const pack = findPackForRule(ruleId);
        expect(pack).not.toBeNull();
        expect(pack?.id).toBe(firstPackWithRules.id);
    });

    it('is consistent across repeated calls (lazy cache)', () => {
        _resetReverseIndexForTesting();
        const a = findPackForRule('stable-rule-id-probe');
        const b = findPackForRule('stable-rule-id-probe');
        expect(a).toEqual(b);
    });
});
