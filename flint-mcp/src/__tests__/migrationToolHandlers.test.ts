/**
 * Handler-level validation tests for flint_migrate_ds and flint_validate_themes.
 *
 * Mirrors the pattern from riskScoreTool.test.ts: extract handler validation
 * logic and test without spinning up the full MCP server.
 */

import { describe, it, expect } from 'vitest'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Simulated handler logic — extracted from server.ts validation branches
// ---------------------------------------------------------------------------

function simulateMigrateDsHandler(args: {
    projectRoot?: string;
    oldTokens?: string;
    newTokens?: string;
    filePaths?: string[];
}): { isError?: boolean; text: string } {
    if (!args.projectRoot) {
        return { isError: true, text: "flint_migrate_ds: 'projectRoot' must be an existing directory." };
    }

    const resolvedRoot = path.resolve(args.projectRoot);

    if (!args.oldTokens) {
        return { isError: true, text: "flint_migrate_ds: 'oldTokens' is required." };
    }
    if (!args.newTokens) {
        return { isError: true, text: "flint_migrate_ds: 'newTokens' is required." };
    }

    const oldPath = path.resolve(resolvedRoot, args.oldTokens);
    const newPath = path.resolve(resolvedRoot, args.newTokens);

    if (!oldPath.startsWith(resolvedRoot + path.sep) && oldPath !== resolvedRoot) {
        return { isError: true, text: `flint_migrate_ds: oldTokens path '${args.oldTokens}' escapes projectRoot.` };
    }
    if (!newPath.startsWith(resolvedRoot + path.sep) && newPath !== resolvedRoot) {
        return { isError: true, text: `flint_migrate_ds: newTokens path '${args.newTokens}' escapes projectRoot.` };
    }

    if (args.filePaths) {
        for (const fp of args.filePaths) {
            const resolved = path.resolve(resolvedRoot, fp);
            if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
                return { isError: true, text: `flint_migrate_ds: filePath '${fp}' escapes projectRoot.` };
            }
        }
    }

    return { text: 'ok' };
}

function simulateValidateThemesHandler(args: {
    projectRoot?: string;
    themeFiles?: string[];
    filePaths?: string[];
}): { isError?: boolean; text: string } {
    if (!args.projectRoot) {
        return { isError: true, text: "flint_validate_themes: 'projectRoot' must be an existing directory." };
    }
    if (!Array.isArray(args.themeFiles)) {
        return { isError: true, text: "flint_validate_themes: 'themeFiles' must be an array of token file paths." };
    }

    const resolvedRoot = path.resolve(args.projectRoot);

    for (const tf of args.themeFiles) {
        const resolved = path.resolve(resolvedRoot, tf);
        if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
            return { isError: true, text: `flint_validate_themes: path '${tf}' escapes projectRoot.` };
        }
    }

    if (args.filePaths) {
        for (const fp of args.filePaths) {
            const resolved = path.resolve(resolvedRoot, fp);
            if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
                return { isError: true, text: `flint_validate_themes: path '${fp}' escapes projectRoot.` };
            }
        }
    }

    return { text: 'ok' };
}

// ---------------------------------------------------------------------------
// Tests — flint_migrate_ds
// ---------------------------------------------------------------------------

describe('flint_migrate_ds handler — validation', () => {
    it('rejects missing projectRoot', () => {
        const res = simulateMigrateDsHandler({});
        expect(res.isError).toBe(true);
        expect(res.text).toContain('projectRoot');
    });

    it('rejects missing oldTokens', () => {
        const res = simulateMigrateDsHandler({ projectRoot: '/tmp/project' });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('oldTokens');
    });

    it('rejects missing newTokens', () => {
        const res = simulateMigrateDsHandler({ projectRoot: '/tmp/project', oldTokens: 'old.json' });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('newTokens');
    });

    it('rejects path traversal in oldTokens', () => {
        const res = simulateMigrateDsHandler({
            projectRoot: '/tmp/project',
            oldTokens: '../../etc/passwd',
            newTokens: 'new.json',
        });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('escapes projectRoot');
    });

    it('rejects path traversal in newTokens', () => {
        const res = simulateMigrateDsHandler({
            projectRoot: '/tmp/project',
            oldTokens: 'old.json',
            newTokens: '../../../secrets.json',
        });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('escapes projectRoot');
    });

    it('rejects path traversal in filePaths', () => {
        const res = simulateMigrateDsHandler({
            projectRoot: '/tmp/project',
            oldTokens: 'old.json',
            newTokens: 'new.json',
            filePaths: ['src/App.tsx', '../../etc/shadow'],
        });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('escapes projectRoot');
    });

    it('accepts valid paths within projectRoot', () => {
        const res = simulateMigrateDsHandler({
            projectRoot: '/tmp/project',
            oldTokens: 'tokens/v1.json',
            newTokens: 'tokens/v2.json',
            filePaths: ['src/App.tsx', 'src/components/Button.tsx'],
        });
        expect(res.isError).toBeUndefined();
        expect(res.text).toBe('ok');
    });
});

// ---------------------------------------------------------------------------
// Tests — flint_validate_themes
// ---------------------------------------------------------------------------

describe('flint_validate_themes handler — validation', () => {
    it('rejects missing projectRoot', () => {
        const res = simulateValidateThemesHandler({});
        expect(res.isError).toBe(true);
        expect(res.text).toContain('projectRoot');
    });

    it('rejects missing themeFiles', () => {
        const res = simulateValidateThemesHandler({ projectRoot: '/tmp/project' });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('themeFiles');
    });

    it('rejects non-array themeFiles', () => {
        const res = simulateValidateThemesHandler({
            projectRoot: '/tmp/project',
            themeFiles: 'not-an-array' as unknown as string[],
        });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('must be an array');
    });

    it('rejects path traversal in themeFiles', () => {
        const res = simulateValidateThemesHandler({
            projectRoot: '/tmp/project',
            themeFiles: ['themes/light.json', '../../../etc/passwd'],
        });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('escapes projectRoot');
    });

    it('rejects path traversal in filePaths', () => {
        const res = simulateValidateThemesHandler({
            projectRoot: '/tmp/project',
            themeFiles: ['themes/light.json'],
            filePaths: ['../../outside.tsx'],
        });
        expect(res.isError).toBe(true);
        expect(res.text).toContain('escapes projectRoot');
    });

    it('accepts valid paths within projectRoot', () => {
        const res = simulateValidateThemesHandler({
            projectRoot: '/tmp/project',
            themeFiles: ['themes/light.json', 'themes/dark.json'],
            filePaths: ['src/App.tsx'],
        });
        expect(res.isError).toBeUndefined();
        expect(res.text).toBe('ok');
    });
});
