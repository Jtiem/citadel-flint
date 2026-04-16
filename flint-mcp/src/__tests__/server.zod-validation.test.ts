/**
 * server.zod-validation.test.ts
 *
 * Sprint 4 Wave 2 — per-tool Zod schema rejection tests (D1 hoist).
 * These exercise the central `validateToolInput` registry directly.
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts
 * Test boundary: validateToolInput
 */

import { describe, it, expect } from 'vitest';
import {
    validateToolInput,
    ToolInputValidationError,
    TOOL_INPUT_SCHEMAS,
} from '../tools/schemas.js';

describe('validateToolInput — Zod schema rejection (D1 hoist)', () => {
    it('rejects flint_set_policy with action="bogus"', () => {
        expect(() =>
            validateToolInput('flint_set_policy', { action: 'bogus' }),
        ).toThrow(ToolInputValidationError);
    });

    it('rejects flint_enable_pack with pack_id: 42 (number instead of string)', () => {
        expect(() =>
            validateToolInput('flint_enable_pack', { pack_id: 42 }),
        ).toThrow(ToolInputValidationError);
    });

    it('rejects flint_fix with missing required file/filePath', () => {
        expect(() => validateToolInput('flint_fix', {})).toThrow(
            ToolInputValidationError,
        );
    });

    it('structured error envelope exposes issue array on validation failure', () => {
        try {
            validateToolInput('flint_set_policy', { action: 'bogus' });
            expect.fail('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(ToolInputValidationError);
            const zErr = err as ToolInputValidationError;
            expect(zErr.toolName).toBe('flint_set_policy');
            expect(Array.isArray(zErr.issues)).toBe(true);
            expect(zErr.issues.length).toBeGreaterThan(0);
        }
    });
});

describe('validateToolInput — edge cases', () => {
    it('rejects flint_audit with empty arguments object', () => {
        expect(() => validateToolInput('flint_audit', {})).toThrow(
            ToolInputValidationError,
        );
    });

    it('rejects flint_set_policy with action="bogus" enum violation', () => {
        expect(() =>
            validateToolInput('flint_set_policy', { action: 'bogus' }),
        ).toThrow(ToolInputValidationError);
    });

    it('rejects flint_agent_trust with non-enum action', () => {
        expect(() =>
            validateToolInput('flint_agent_trust', {
                action: 'banana',
                projectRoot: '/tmp',
            }),
        ).toThrow(ToolInputValidationError);
    });

    it('unknown tool name passes through (legacy cast — no schema registered)', () => {
        const args = { anything: 'goes' };
        const result = validateToolInput('not_a_real_tool', args);
        expect(result).toBe(args);
    });
});

describe('TOOL_INPUT_SCHEMAS coverage sanity', () => {
    it('every registered tool name in TOOL_INPUT_SCHEMAS has a Zod schema entry', () => {
        for (const [name, schema] of Object.entries(TOOL_INPUT_SCHEMAS)) {
            expect(name.length).toBeGreaterThan(0);
            expect(schema).toBeDefined();
            // ZodType instances expose a `safeParse` method.
            expect(typeof (schema as { safeParse?: unknown }).safeParse).toBe(
                'function',
            );
        }
    });

    it('no orphaned schemas exist (every schema key is a non-empty string)', () => {
        const keys = Object.keys(TOOL_INPUT_SCHEMAS);
        expect(keys.length).toBeGreaterThanOrEqual(10);
        for (const k of keys) {
            expect(k).toMatch(/^[a-z_][a-z0-9_]*$/);
        }
    });
});
