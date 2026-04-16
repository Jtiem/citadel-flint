/**
 * server.handler-extraction.test.ts
 *
 * Sprint 4 Wave 2 — round-trip tests for the 5 extracted tool handlers.
 * Each handler is imported directly and called with a mock
 * ResolvedToolContext, bypassing the MCP dispatch layer.
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts
 * Test boundaries: handleAudit, handleFix, handleMigrateTw,
 *                  handleAgentTrust, handleSetPolicy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { handleSetPolicy } from '../tools/handlers/setPolicy.handler.js';
import { handleAgentTrust } from '../tools/handlers/agentTrust.handler.js';
import { handleMigrateTw } from '../tools/handlers/migrateTw.handler.js';
import { handleAudit } from '../tools/handlers/audit.handler.js';
import { handleFix } from '../tools/handlers/fix.handler.js';
import type { ResolvedToolContext } from '../tools/handlers/types.js';
import { getDefaultResolvedPolicy } from '../core/policyEngine.js';
import { DEFAULT_CONFIG } from '../core/config.js';

function makeCtx(projectRoot: string): ResolvedToolContext {
    return {
        projectRoot,
        flintConfig: { ...DEFAULT_CONFIG, projectRoot },
        resolved: getDefaultResolvedPolicy(),
        reloadFlintConfig: () => ({ ...DEFAULT_CONFIG, projectRoot }),
    };
}

// ── flint_audit ────────────────────────────────────────────────────────────

describe('handleAudit (extracted handler)', () => {
    it('handleAudit is a callable async function', () => {
        expect(typeof handleAudit).toBe('function');
    });

    it('rejects missing source AND missing filePaths with structured error', async () => {
        const ctx = makeCtx('/tmp');
        const result = await handleAudit({}, ctx);
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it('batch mode returns a content array (smoke)', async () => {
        const ctx = makeCtx('/tmp');
        // Empty filePaths arr triggers the early return with missing-params
        // message, which is the structured error envelope we assert shape of.
        const result = await handleAudit({ filePaths: [] }, ctx);
        expect(Array.isArray((result as { content: unknown[] }).content)).toBe(
            true,
        );
    });
});

// ── flint_fix ──────────────────────────────────────────────────────────────

describe('handleFix (extracted handler)', () => {
    it('handleFix is a callable async function', () => {
        expect(typeof handleFix).toBe('function');
    });

    it('dry_run=true on a missing file/source rejects at the underlying tool boundary', async () => {
        const ctx = makeCtx('/tmp');
        // The extracted handler is a thin wrapper — if the underlying
        // tool requires either `file` or both `source` + `filePath`,
        // passing neither should surface a clear error rather than a
        // silent success. We accept either a thrown error or an isError
        // result envelope.
        let caught = false;
        try {
            const result = await handleFix({}, ctx);
            if ((result as { isError?: boolean }).isError) caught = true;
        } catch {
            caught = true;
        }
        expect(caught).toBe(true);
    });
});

// ── flint_migrate_tw ───────────────────────────────────────────────────────

describe('handleMigrateTw (extracted handler)', () => {
    it('handleMigrateTw is a callable async function', () => {
        expect(typeof handleMigrateTw).toBe('function');
    });

    it('empty filePaths returns structured error', async () => {
        const ctx = makeCtx('/tmp');
        const result = await handleMigrateTw(
            { filePaths: [] },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it('traversal glob returns structured error', async () => {
        const ctx = makeCtx('/tmp');
        const result = await handleMigrateTw(
            { filePaths: ['/tmp/x.tsx'], glob: '../../etc' },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it('non-existent file is reported in perFileReports, not thrown', async () => {
        const ctx = makeCtx('/tmp');
        const result = await handleMigrateTw(
            { filePaths: ['/tmp/__nope_xyz.tsx'], dryRun: true },
            ctx,
        );
        const text = (result as { content: Array<{ text: string }> }).content[0].text;
        expect(text).toContain('File not found');
    });
});

// ── flint_agent_trust ──────────────────────────────────────────────────────

describe('handleAgentTrust (extracted handler)', () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-trust-handler-'));
        fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('handleAgentTrust is a callable async function', () => {
        expect(typeof handleAgentTrust).toBe('function');
    });

    it('missing projectRoot returns structured error', async () => {
        const ctx = makeCtx('/tmp');
        const result = await handleAgentTrust(
            { action: 'list', projectRoot: '/definitely/not/a/dir/xyz' },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it('action=list returns an array body', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleAgentTrust(
            { action: 'list', projectRoot: tmpDir },
            ctx,
        );
        expect(Array.isArray((result as { content: unknown[] }).content)).toBe(
            true,
        );
    });

    it('action=profile without agentId returns structured error', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleAgentTrust(
            { action: 'profile', projectRoot: tmpDir },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it('action=demote without agentId returns structured error', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleAgentTrust(
            { action: 'demote', projectRoot: tmpDir },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it('unknown action returns structured error', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleAgentTrust(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { action: 'bogus' as any, projectRoot: tmpDir },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
    });
});

// ── flint_set_policy ───────────────────────────────────────────────────────

describe('handleSetPolicy (extracted handler)', () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-setpol-handler-'));
        fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('handleSetPolicy is a callable async function', () => {
        expect(typeof handleSetPolicy).toBe('function');
    });

    it('action="read" returns ResolvedPolicy JSON in content[0].text', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleSetPolicy({ action: 'read' }, ctx);
        const text = (result as { content: Array<{ text: string }> }).content[0]
            .text;
        const parsed = JSON.parse(text);
        expect(parsed.mithril).toBeDefined();
        expect(parsed.a11y).toBeDefined();
    });

    it('action="update" without policy body returns structured error', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleSetPolicy({ action: 'update' }, ctx);
        expect((result as { isError?: boolean }).isError).toBe(true);
    });

    it('action="update" with invalid deltaE_threshold is rejected, no disk write', async () => {
        const ctx = makeCtx(tmpDir);
        const policyPath = path.join(tmpDir, '.flint', 'policy.json');
        const beforeExists = fs.existsSync(policyPath);
        const result = await handleSetPolicy(
            {
                action: 'update',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                policy: { mithril: { deltaE_threshold: -5 } } as any,
            },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
        // No disk write on validation failure.
        expect(fs.existsSync(policyPath)).toBe(beforeExists);
    });

    it('action="reset" restores defaults and returns confirmation', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleSetPolicy({ action: 'reset' }, ctx);
        const text = (result as { content: Array<{ text: string }> }).content[0]
            .text;
        expect(text).toContain('Policy reset');
    });

    it('action="bogus" returns structured error response', async () => {
        const ctx = makeCtx(tmpDir);
        const result = await handleSetPolicy(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { action: 'bogus' as any },
            ctx,
        );
        expect((result as { isError?: boolean }).isError).toBe(true);
    });
});
