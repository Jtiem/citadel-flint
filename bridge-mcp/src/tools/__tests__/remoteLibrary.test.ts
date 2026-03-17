/**
 * remoteLibrary — Unit Tests
 *
 * Scope:
 *   - parseGitHubUrl  — URL parsing
 *   - buildRawUrl     — URL construction
 *   - handleBridgeAddRemoteLibrary — happy path + 404 fallback + error path
 *   - Persistence to .bridge/remote-libraries.json
 *   - RAG cache population
 *
 * All network calls are intercepted via globalThis.fetch mock.
 * All file-system writes go to a tmp directory that is cleaned up after each test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// We import these before mocking so the module is loaded
import {
    parseGitHubUrl,
    buildRawUrl,
    handleBridgeAddRemoteLibrary,
} from '../remoteLibrary.js';

import {
    clearRegistryCache,
    getRegistryCache,
} from '../../core/ragRegistryService.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a minimal bridge-manifest.json payload */
function makeManifest(components: Record<string, unknown>) {
    return JSON.stringify({ components });
}

/** Create a temporary directory and return its path */
function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'));
}

/** Read and parse .bridge/remote-libraries.json from a project root */
function readLibrariesFile(projectRoot: string) {
    const fp = path.join(projectRoot, '.bridge', 'remote-libraries.json');
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

// ── Fixture manifest ──────────────────────────────────────────────────────────

const FIXTURE_COMPONENTS = {
    Button: {
        name: 'Button',
        importPath: 'shadcn/ui/button',
        description: 'A button component',
        variants: ['default', 'destructive'],
    },
    Card: {
        name: 'Card',
        importPath: 'shadcn/ui/card',
        description: 'A card container',
    },
};

// ── parseGitHubUrl ────────────────────────────────────────────────────────────

describe('parseGitHubUrl', () => {
    it('parses a standard HTTPS URL', () => {
        const { owner, repo } = parseGitHubUrl('https://github.com/shadcn-ui/ui');
        expect(owner).toBe('shadcn-ui');
        expect(repo).toBe('ui');
    });

    it('strips trailing .git suffix', () => {
        const { owner, repo } = parseGitHubUrl('https://github.com/owner/repo.git');
        expect(owner).toBe('owner');
        expect(repo).toBe('repo');
    });

    it('strips trailing slash', () => {
        const { owner, repo } = parseGitHubUrl('https://github.com/owner/repo/');
        expect(owner).toBe('owner');
        expect(repo).toBe('repo');
    });

    it('throws for a non-GitHub URL', () => {
        expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
            'Invalid GitHub URL',
        );
    });

    it('throws for a URL that is missing the repo segment', () => {
        expect(() => parseGitHubUrl('https://github.com/owner')).toThrow(
            'Invalid GitHub URL',
        );
    });
});

// ── buildRawUrl ───────────────────────────────────────────────────────────────

describe('buildRawUrl', () => {
    it('builds the correct raw URL', () => {
        const url = buildRawUrl('shadcn-ui', 'ui', 'main', 'bridge-manifest.json');
        expect(url).toBe(
            'https://raw.githubusercontent.com/shadcn-ui/ui/main/bridge-manifest.json',
        );
    });

    it('respects a custom branch', () => {
        const url = buildRawUrl('owner', 'repo', 'develop', 'src/manifest.json');
        expect(url).toBe(
            'https://raw.githubusercontent.com/owner/repo/develop/src/manifest.json',
        );
    });
});

// ── handleBridgeAddRemoteLibrary ──────────────────────────────────────────────

describe('handleBridgeAddRemoteLibrary', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = makeTmpDir();
        clearRegistryCache();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        fs.rmSync(projectRoot, { recursive: true, force: true });
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('fetches manifest, populates cache, writes file, returns result', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ components: FIXTURE_COMPONENTS }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const result = await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/shadcn-ui/ui',
            projectRoot,
        });

        // Return shape
        expect(result.added).toBe(2);
        expect(result.libraryName).toBe('ui');
        expect(result.components).toEqual(expect.arrayContaining(['Button', 'Card']));
        expect(result.cachedAt).toBeTruthy();

        // RAG cache populated
        const cache = getRegistryCache();
        expect(cache['Button']).toBeDefined();
        expect(cache['Card']).toBeDefined();
        expect(cache['Button'].source).toBe('remote');
        expect(cache['Button'].remoteUrl).toBe('https://github.com/shadcn-ui/ui');

        // Persistence file written
        const stored = readLibrariesFile(projectRoot);
        expect(stored.libraries['ui']).toBeDefined();
        expect(stored.libraries['ui'].componentCount).toBe(2);
        expect(stored.libraries['ui'].url).toBe('https://github.com/shadcn-ui/ui');
        expect(stored.libraries['ui'].branch).toBe('main');
    });

    it('uses custom alias as library name', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ components: FIXTURE_COMPONENTS }),
        }));

        const result = await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/shadcn-ui/ui',
            alias: 'shadcn',
            projectRoot,
        });

        expect(result.libraryName).toBe('shadcn');

        const stored = readLibrariesFile(projectRoot);
        expect(stored.libraries['shadcn']).toBeDefined();
    });

    it('uses custom branch', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ components: FIXTURE_COMPONENTS }),
        });
        vi.stubGlobal('fetch', mockFetch);

        await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/shadcn-ui/ui',
            branch: 'canary',
            projectRoot,
        });

        // The fetch URL should contain the custom branch
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/canary/'),
        );

        const stored = readLibrariesFile(projectRoot);
        expect(stored.libraries['ui'].branch).toBe('canary');
    });

    it('uses a custom manifestPath', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ components: FIXTURE_COMPONENTS }),
        });
        vi.stubGlobal('fetch', mockFetch);

        await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/owner/repo',
            manifestPath: 'packages/ui/bridge-manifest.json',
            projectRoot,
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('packages/ui/bridge-manifest.json'),
        );
    });

    // ── 404 fallback to package.json ──────────────────────────────────────────

    it('falls back to package.json when bridge-manifest.json returns 404', async () => {
        const mockFetch = vi.fn()
            // First call (bridge-manifest.json) → 404
            .mockResolvedValueOnce({ ok: false, status: 404 })
            // Second call (package.json) → success
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    name: 'my-lib',
                    components: FIXTURE_COMPONENTS,
                }),
            });

        vi.stubGlobal('fetch', mockFetch);

        const result = await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/owner/repo',
            projectRoot,
        });

        expect(result.added).toBe(2);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not attempt package.json fallback when a custom manifestPath is provided and returns 404', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
        vi.stubGlobal('fetch', mockFetch);

        // With a custom manifestPath (not the default), the fallback to package.json
        // does not trigger — we expect a throw about manifest not found.
        await expect(
            handleBridgeAddRemoteLibrary({
                githubUrl: 'https://github.com/owner/repo',
                manifestPath: 'custom/path.json',
                projectRoot,
            }),
        ).rejects.toThrow();
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('throws when the GitHub URL is invalid', async () => {
        await expect(
            handleBridgeAddRemoteLibrary({
                githubUrl: 'https://gitlab.com/owner/repo',
                projectRoot,
            }),
        ).rejects.toThrow('Invalid GitHub URL');
    });

    it('throws when fetch throws a network error', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('Network failure')),
        );

        await expect(
            handleBridgeAddRemoteLibrary({
                githubUrl: 'https://github.com/owner/repo',
                projectRoot,
            }),
        ).rejects.toThrow('Network failure');
    });

    it('throws when the manifest has no components', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ components: {} }),
        }));

        await expect(
            handleBridgeAddRemoteLibrary({
                githubUrl: 'https://github.com/owner/repo',
                projectRoot,
            }),
        ).rejects.toThrow('No components found');
    });

    it('throws when both manifest and fallback return 404', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

        await expect(
            handleBridgeAddRemoteLibrary({
                githubUrl: 'https://github.com/owner/repo',
                projectRoot,
            }),
        ).rejects.toThrow();
    });

    // ── Persistence correctness ───────────────────────────────────────────────

    it('creates the .bridge directory if it does not exist', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ components: FIXTURE_COMPONENTS }),
        }));

        const bridgeDir = path.join(projectRoot, '.bridge');
        expect(fs.existsSync(bridgeDir)).toBe(false);

        await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/owner/repo',
            projectRoot,
        });

        expect(fs.existsSync(bridgeDir)).toBe(true);
    });

    it('merges successive library additions rather than overwriting', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    components: {
                        Button: { name: 'Button', importPath: 'lib-a/button' },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    components: {
                        Input: { name: 'Input', importPath: 'lib-b/input' },
                    },
                }),
            }),
        );

        await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/owner/lib-a',
            alias: 'lib-a',
            projectRoot,
        });

        await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/owner/lib-b',
            alias: 'lib-b',
            projectRoot,
        });

        const stored = readLibrariesFile(projectRoot);
        expect(Object.keys(stored.libraries)).toEqual(
            expect.arrayContaining(['lib-a', 'lib-b']),
        );
    });

    it('handles a flat component map (no nested "components" key)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                Button: { name: 'Button', importPath: 'flat/button' },
                Card: { name: 'Card', importPath: 'flat/card' },
            }),
        }));

        const result = await handleBridgeAddRemoteLibrary({
            githubUrl: 'https://github.com/owner/repo',
            projectRoot,
        });

        expect(result.added).toBe(2);
    });
});
