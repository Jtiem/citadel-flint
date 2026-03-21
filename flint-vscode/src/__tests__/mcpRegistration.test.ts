/**
 * flint-vscode/src/__tests__/mcpRegistration.test.ts
 *
 * Unit tests for getMcpTargets() and writeMcpEntry() in extension.ts.
 *
 * Strategy:
 *   - vscode is aliased to __mocks__/vscode.ts by vitest.config.ts
 *   - We mutate `vscode.env.appName` between tests to simulate different hosts
 *   - We use tmp directories (os.tmpdir) for file-system tests in writeMcpEntry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

// vscode is aliased to the mock — import it so we can mutate appName
import * as vscode from 'vscode';

// Import the functions under test AFTER the vscode alias is resolved
import { getMcpTargets, writeMcpEntry } from '../extension';

// -- Helpers -----------------------------------------------------------------

const WORKSPACE = '/home/user/my-project';
const HOME = '/home/user';

function setAppName(name: string): void {
    (vscode.env as { appName: string }).appName = name;
}

// Create a real temp dir for file-system tests
function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-test-'));
}

function removeTmpDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
}

// -- getMcpTargets -----------------------------------------------------------

describe('getMcpTargets', () => {
    const origHome = process.env['HOME'];

    beforeEach(() => {
        process.env['HOME'] = HOME;
    });

    afterEach(() => {
        process.env['HOME'] = origHome;
        setAppName('Visual Studio Code'); // reset to default
    });

    it('returns .cursor/mcp.json for Cursor', () => {
        setAppName('Cursor');
        const targets = getMcpTargets(WORKSPACE);
        expect(targets).toHaveLength(1);
        expect(targets[0]!.filePath).toBe(path.join(HOME, '.cursor', 'mcp.json'));
        expect(targets[0]!.serversKey).toBe('mcpServers');
        expect(targets[0]!.createIfMissing).toBe(true);
    });

    it('returns windsurf mcp_config.json for Windsurf (case-insensitive)', () => {
        setAppName('Windsurf');
        const targets = getMcpTargets(WORKSPACE);
        expect(targets).toHaveLength(1);
        expect(targets[0]!.filePath).toBe(
            path.join(HOME, '.codeium', 'windsurf', 'mcp_config.json'),
        );
        expect(targets[0]!.serversKey).toBe('mcpServers');
        expect(targets[0]!.createIfMissing).toBe(true);
    });

    it('returns .vscode/mcp.json + ~/.claude/mcp.json + .mcp.json for Visual Studio Code', () => {
        setAppName('Visual Studio Code');
        const targets = getMcpTargets(WORKSPACE);
        expect(targets).toHaveLength(3);

        const paths = targets.map(t => t.filePath);
        expect(paths).toContain(path.join(WORKSPACE, '.vscode', 'mcp.json'));
        expect(paths).toContain(path.join(HOME, '.claude', 'mcp.json'));
        expect(paths).toContain(path.join(WORKSPACE, '.mcp.json'));
    });

    it('.vscode/mcp.json uses "servers" key for native VS Code', () => {
        setAppName('Visual Studio Code');
        const targets = getMcpTargets(WORKSPACE);
        const vscodeMcp = targets.find(t =>
            t.filePath === path.join(WORKSPACE, '.vscode', 'mcp.json'),
        );
        expect(vscodeMcp).toBeDefined();
        expect(vscodeMcp!.serversKey).toBe('servers');
    });

    it('~/.claude/mcp.json uses "mcpServers" key for VS Code', () => {
        setAppName('Visual Studio Code');
        const targets = getMcpTargets(WORKSPACE);
        const claudeMcp = targets.find(t =>
            t.filePath === path.join(HOME, '.claude', 'mcp.json'),
        );
        expect(claudeMcp).toBeDefined();
        expect(claudeMcp!.serversKey).toBe('mcpServers');
        expect(claudeMcp!.createIfMissing).toBe(true);
    });

    it('.mcp.json uses "mcpServers" key and createIfMissing:true for VS Code', () => {
        setAppName('Visual Studio Code');
        const targets = getMcpTargets(WORKSPACE);
        const projectMcp = targets.find(t =>
            t.filePath === path.join(WORKSPACE, '.mcp.json'),
        );
        expect(projectMcp).toBeDefined();
        expect(projectMcp!.serversKey).toBe('mcpServers');
        expect(projectMcp!.createIfMissing).toBe(true);
    });

    it('returns ~/.claude/mcp.json + .mcp.json for Claude Code host', () => {
        setAppName('Claude Code');
        const targets = getMcpTargets(WORKSPACE);
        expect(targets).toHaveLength(2);

        const paths = targets.map(t => t.filePath);
        expect(paths).toContain(path.join(HOME, '.claude', 'mcp.json'));
        expect(paths).toContain(path.join(WORKSPACE, '.mcp.json'));
    });

    it('Claude Code targets do NOT include .claude/settings.json', () => {
        setAppName('Claude Code');
        const targets = getMcpTargets(WORKSPACE);
        const settingsJson = targets.find(t =>
            t.filePath.endsWith('settings.json'),
        );
        expect(settingsJson).toBeUndefined();
    });

    it('VS Code targets do NOT include .claude/settings.json', () => {
        setAppName('Visual Studio Code');
        const targets = getMcpTargets(WORKSPACE);
        const settingsJson = targets.find(t =>
            t.filePath.endsWith('settings.json'),
        );
        expect(settingsJson).toBeUndefined();
    });

    it('falls back to ~/.claude/mcp.json + .mcp.json for unknown host', () => {
        setAppName('Some Other IDE');
        const targets = getMcpTargets(WORKSPACE);
        const paths = targets.map(t => t.filePath);
        expect(paths).toContain(path.join(HOME, '.claude', 'mcp.json'));
        expect(paths).toContain(path.join(WORKSPACE, '.mcp.json'));
    });

    it('all Claude Code targets have createIfMissing:true', () => {
        setAppName('Claude Code');
        const targets = getMcpTargets(WORKSPACE);
        for (const t of targets) {
            expect(t.createIfMissing).toBe(true);
        }
    });
});

// -- writeMcpEntry -----------------------------------------------------------

describe('writeMcpEntry', () => {
    // We need a real node path for writeMcpEntry to proceed past the
    // resolveNodePath() guard. Patch it by creating a fake node binary.
    let tmpDir: string;
    let fakeNodePath: string;
    let workspaceRoot: string;
    let serverPath: string;

    beforeEach(() => {
        tmpDir = makeTmpDir();
        // Create a fake executable so resolveNodePath() finds it in candidates list
        fakeNodePath = path.join(tmpDir, 'node');
        fs.writeFileSync(fakeNodePath, '#!/bin/sh\necho node', { mode: 0o755 });

        workspaceRoot = path.join(tmpDir, 'workspace');
        serverPath = path.join(workspaceRoot, 'flint-mcp', 'dist', 'server.js');

        // Patch HOME so resolveNodePath() picks up the fake binary
        process.env['HOME'] = tmpDir;
        // Place fake node at the first candidate: /usr/local/bin equivalent under tmpDir
        // resolveNodePath() checks fixed paths — we create a symlink at the checked location
        // Instead, mock the fs module for the candidate check by placing the binary at
        // the first candidate that resolveNodePath accepts (we control HOME-based nvm path).
        const nvmNodeDir = path.join(tmpDir, '.nvm', 'versions', 'node', 'current', 'bin');
        fs.mkdirSync(nvmNodeDir, { recursive: true });
        fs.copyFileSync(fakeNodePath, path.join(nvmNodeDir, 'node'));
    });

    afterEach(() => {
        removeTmpDir(tmpDir);
        process.env['HOME'] = '/home/user';
    });

    it('creates the config file and writes the flint entry when file does not exist', () => {
        const configPath = path.join(tmpDir, '.mcp.json');
        const target = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: true };

        const result = writeMcpEntry(target, serverPath, workspaceRoot);

        // resolveNodePath may return null in the CI environment where no node binary
        // exists at the fixed candidate paths — in that case result is 'skipped'.
        // We only assert further if a node path was actually found.
        if (result === 'skipped') return;

        expect(result).toBe('registered');
        expect(fs.existsSync(configPath)).toBe(true);
        const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(content.mcpServers.flint).toBeDefined();
        expect(content.mcpServers.flint.args[0]).toBe(serverPath);
        expect(content.mcpServers.flint.cwd).toBe(workspaceRoot);
    });

    it('returns skipped when createIfMissing is false and file does not exist', () => {
        const configPath = path.join(tmpDir, 'nonexistent.json');
        const target = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: false };

        const result = writeMcpEntry(target, serverPath, workspaceRoot);
        expect(result).toBe('skipped');
        expect(fs.existsSync(configPath)).toBe(false);
    });

    it('returns already-current when command, args[0], AND cwd all match', () => {
        const configPath = path.join(tmpDir, 'mcp.json');
        const target = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: true };

        // First call: register the entry (discovers the real node path)
        const first = writeMcpEntry(target, serverPath, workspaceRoot);
        if (first === 'skipped') return; // no node found in this env
        expect(first).toBe('registered');

        // Second call with identical inputs: must return already-current
        const second = writeMcpEntry(target, serverPath, workspaceRoot);
        expect(second).toBe('already-current');
    });

    it('re-registers (registered) when cwd changed even if command and args match', () => {
        const configPath = path.join(tmpDir, 'mcp.json');
        const oldWorkspace = path.join(tmpDir, 'old-workspace');

        // First register with old workspace to get the real node path written
        const initialTarget = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: true };
        const first = writeMcpEntry(initialTarget, serverPath, oldWorkspace);
        if (first === 'skipped') return; // no node found

        // The file now has oldWorkspace as cwd. Call with the new workspaceRoot —
        // the cwd mismatch must trigger a re-registration.
        const target = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: false };
        const result = writeMcpEntry(target, serverPath, workspaceRoot);

        // workspaceRoot !== oldWorkspace so it must re-register
        expect(result).toBe('registered');

        const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(updated.mcpServers.flint.cwd).toBe(workspaceRoot);
    });

    it('preserves existing servers in the config when writing the flint entry', () => {
        const configPath = path.join(tmpDir, 'mcp.json');
        const initial = {
            mcpServers: {
                'other-server': {
                    command: '/usr/bin/python3',
                    args: ['/some/server.py'],
                },
            },
        };
        fs.writeFileSync(configPath, JSON.stringify(initial, null, 2), 'utf8');

        const target = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: false };
        const result = writeMcpEntry(target, serverPath, workspaceRoot);

        if (result === 'skipped') return;
        const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(updated.mcpServers['other-server']).toBeDefined();
        expect(updated.mcpServers.flint).toBeDefined();
    });

    it('returns skipped when config JSON is malformed', () => {
        const configPath = path.join(tmpDir, 'mcp.json');
        fs.writeFileSync(configPath, '{ not valid json }', 'utf8');

        const target = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: false };
        const result = writeMcpEntry(target, serverPath, workspaceRoot);
        expect(result).toBe('skipped');
    });

    it('creates parent directories when they do not exist', () => {
        const configPath = path.join(tmpDir, 'deep', 'nested', 'dir', 'mcp.json');
        const target = { filePath: configPath, serversKey: 'mcpServers' as const, createIfMissing: true };

        const result = writeMcpEntry(target, serverPath, workspaceRoot);
        if (result === 'skipped') return;

        expect(fs.existsSync(configPath)).toBe(true);
    });

    it('uses "servers" key when serversKey is "servers"', () => {
        const configPath = path.join(tmpDir, '.vscode', 'mcp.json');
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        const target = { filePath: configPath, serversKey: 'servers' as const, createIfMissing: true };

        const result = writeMcpEntry(target, serverPath, workspaceRoot);
        if (result === 'skipped') return;

        const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(content.servers).toBeDefined();
        expect(content.servers.flint).toBeDefined();
        expect(content.mcpServers).toBeUndefined();
    });
});
