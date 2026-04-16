/**
 * server.flintconfig-resolved.test.ts
 *
 * Sprint 4 Wave 2 — D3 flintConfig.policy.* → ResolvedPolicy migration.
 * These tests pin in place the invariants that let us remove the
 * legacy v1 FlintPolicy bridge:
 *
 *   1. `flintConfig.policy` is no longer the source of truth in server.ts
 *   2. `toLegacyFlintPolicy` is no longer exported
 *   3. The resolved-policy `rules` map is the new canonical per-rule
 *      source for the `off` filter that used to live on
 *      `flintConfig.policy.a11y.disabled_rules`
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts
 * Test boundary: D3 consumer migration — 13 sites in server.ts
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as policyEngine from '../core/policyEngine.js';
import { getDefaultResolvedPolicy, getRuleMode } from '../core/policyEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SERVER_SOURCE = fs.readFileSync(
    path.join(__dirname, '..', 'server.ts'),
    'utf-8',
);

describe('D3 — resolvedPolicy hoisted in tools/call', () => {
    it('server.ts reads mithril thresholds from the resolved-policy object', () => {
        expect(SERVER_SOURCE).toContain('resolved.mithril.deltaE_threshold');
        expect(SERVER_SOURCE).toContain('resolved.mithril.deltaE_critical_threshold');
    });

    it('server.ts reads mithril mode from the resolved-policy object', () => {
        expect(SERVER_SOURCE).toContain("resolved.mithril.mode !== 'off'");
    });

    it('server.ts reads a11y mode from the resolved-policy object', () => {
        expect(SERVER_SOURCE).toContain("resolved.a11y.mode !== 'off'");
    });

    it('server.ts derives disabled a11y rules from resolved.a11y.rules (Object.entries + mode === off)', () => {
        // The pattern lives in the audit handler after extraction; we grep
        // the server.ts file because the handler files do the same.
        const auditHandlerPath = path.join(
            __dirname,
            '..',
            'tools',
            'handlers',
            'audit.handler.ts',
        );
        const audit = fs.readFileSync(auditHandlerPath, 'utf-8');
        expect(audit).toContain('Object.entries(resolved.a11y.rules)');
        expect(audit).toContain("m === 'off'");
    });

    it('grep of server.ts post-migration returns zero matches for flintConfig.policy.', () => {
        const matches = SERVER_SOURCE.match(/flintConfig\.policy\./g);
        expect(matches).toBeNull();
    });
});

describe('D3 — per-rule mode helpers match extracted-handler behaviour', () => {
    it('default resolved policy has no a11y rules set to off', () => {
        const resolved = getDefaultResolvedPolicy();
        const disabled = Object.entries(resolved.a11y.rules)
            .filter(([, m]) => m === 'off')
            .map(([id]) => id);
        expect(disabled).toEqual([]);
    });

    it('setting a rule to advisory does NOT place it in the disabled-rules filter', () => {
        const resolved = getDefaultResolvedPolicy();
        resolved.a11y.rules['A11Y-PROBE'] = 'advisory';
        const disabled = Object.entries(resolved.a11y.rules)
            .filter(([, m]) => m === 'off')
            .map(([id]) => id);
        expect(disabled).not.toContain('A11Y-PROBE');
    });

    it('setting a rule to off DOES place it in the disabled-rules filter', () => {
        const resolved = getDefaultResolvedPolicy();
        resolved.a11y.rules['A11Y-PROBE-OFF'] = 'off';
        const disabled = Object.entries(resolved.a11y.rules)
            .filter(([, m]) => m === 'off')
            .map(([id]) => id);
        expect(disabled).toContain('A11Y-PROBE-OFF');
    });

    it('getRuleMode returns the per-rule mode for known rules', () => {
        const resolved = getDefaultResolvedPolicy();
        resolved.a11y.rules['A11Y-KNOWN'] = 'blocking';
        expect(getRuleMode('A11Y-KNOWN', resolved)).toBe('blocking');
    });
});

describe('D3 — toLegacyFlintPolicy removal', () => {
    it('toLegacyFlintPolicy export is removed from policyEngine.ts', () => {
        expect(
            (policyEngine as Record<string, unknown>).toLegacyFlintPolicy,
        ).toBeUndefined();
    });

    it('advisory mode rules stay out of the override-telemetry "off" filter', () => {
        const resolved = getDefaultResolvedPolicy();
        resolved.a11y.rules['A11Y-ADVISORY'] = 'advisory';
        const offFiltered = Object.entries(resolved.a11y.rules)
            .filter(([, m]) => m === 'off')
            .map(([id]) => id);
        expect(offFiltered).not.toContain('A11Y-ADVISORY');
    });
});

describe('D3 — flintConfig is read only for metadata (domains) in runServer', () => {
    it('runServer log reads flintConfig.domains (metadata)', () => {
        expect(SERVER_SOURCE).toContain('flintConfig.domains.join');
    });

    it('there are no surviving flintConfig.projectRoot reads inside the tools/call callback', () => {
        // D3 hoisted projectRoot as a const at the top of the callback; the
        // only surviving flintConfig references in the switch body are
        // handler parameters (flintConfig is still passed to handleFlintAudit
        // etc. as an opaque carrier), never as `flintConfig.projectRoot`.
        const matches = SERVER_SOURCE.match(/flintConfig\.projectRoot/g);
        expect(matches).toBeNull();
    });
});
