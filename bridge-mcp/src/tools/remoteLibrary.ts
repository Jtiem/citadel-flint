/**
 * remoteLibrary — bridge-mcp/src/tools/remoteLibrary.ts
 *
 * Implements bridge_add_remote_library: fetch a component library manifest
 * from a GitHub repository URL, merge it into the in-memory RAG cache, and
 * persist metadata to .bridge/remote-libraries.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { setRegistryCache } from '../core/ragRegistryService.js';
import type { ComponentEntry } from '../core/registryService.js';

// ── Tool descriptor ───────────────────────────────────────────────────────────

export const BRIDGE_ADD_REMOTE_LIBRARY_TOOL = {
    name: 'bridge_add_remote_library',
    description:
        'Fetch and cache a component library from a GitHub repository URL. ' +
        'Makes all components instantly available via bridge_query_registry.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            githubUrl: {
                type: 'string',
                description: 'GitHub repository URL, e.g. https://github.com/shadcn-ui/ui',
            },
            branch: {
                type: 'string',
                description: 'Branch name (default: "main").',
            },
            manifestPath: {
                type: 'string',
                description:
                    'Path within the repository to bridge-manifest.json ' +
                    '(default: "bridge-manifest.json").',
            },
            alias: {
                type: 'string',
                description: 'Local alias for this library (defaults to repo name).',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root.',
            },
        },
        required: ['githubUrl', 'projectRoot'],
    },
} as const;

// ── Args / Result types ───────────────────────────────────────────────────────

export interface AddRemoteLibraryArgs {
    githubUrl: string;
    branch?: string;
    manifestPath?: string;
    alias?: string;
    projectRoot: string;
}

export interface AddRemoteLibraryResult {
    added: number;
    libraryName: string;
    components: string[];
    cachedAt: string;
}

// ── Parsed GitHub URL ─────────────────────────────────────────────────────────

interface GitHubCoords {
    owner: string;
    repo: string;
}

/**
 * Extract owner and repo from a GitHub URL.
 * Accepts HTTPS URLs with or without a trailing .git suffix.
 *
 * @throws if the URL cannot be parsed as a GitHub repository URL
 */
export function parseGitHubUrl(url: string): GitHubCoords {
    const match = url.match(
        /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    );
    if (!match) {
        throw new Error(
            `Invalid GitHub URL: "${url}". Expected format: https://github.com/owner/repo`,
        );
    }
    return { owner: match[1], repo: match[2] };
}

/**
 * Build the raw.githubusercontent.com URL for a file inside a repo.
 */
export function buildRawUrl(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

// ── Manifest parsing ──────────────────────────────────────────────────────────

/**
 * Try to extract a component map from arbitrary JSON.
 *
 * Accepted shapes:
 *   1. { "components": { "Button": { ... } } }       — bridge-manifest.json
 *   2. { "bridge": { "components": { ... } } }       — package.json bridge section
 *   3. { "Button": { "importPath": "..." }, ... }    — flat component map
 */
function extractComponents(json: unknown): Record<string, ComponentEntry> {
    if (typeof json !== 'object' || json === null) return {};

    const obj = json as Record<string, unknown>;

    // Shape 1 — bridge-manifest.json
    if (obj.components && typeof obj.components === 'object') {
        return obj.components as Record<string, ComponentEntry>;
    }

    // Shape 2 — package.json with bridge section
    if (
        obj.bridge &&
        typeof obj.bridge === 'object' &&
        (obj.bridge as Record<string, unknown>).components
    ) {
        return (obj.bridge as Record<string, unknown>).components as Record<
            string,
            ComponentEntry
        >;
    }

    // Shape 3 — flat map where values look like ComponentEntry (have importPath)
    const flat: Record<string, ComponentEntry> = {};
    for (const [key, val] of Object.entries(obj)) {
        if (
            typeof val === 'object' &&
            val !== null &&
            typeof (val as Record<string, unknown>).importPath === 'string'
        ) {
            flat[key] = val as ComponentEntry;
        }
    }

    return flat;
}

// ── Persistence ───────────────────────────────────────────────────────────────

const REMOTE_LIBRARIES_FILE = '.bridge/remote-libraries.json';

interface RemoteLibraryMeta {
    url: string;
    branch: string;
    fetchedAt: string;
    componentCount: number;
    components: string[];
}

interface RemoteLibrariesStore {
    libraries: Record<string, RemoteLibraryMeta>;
}

function readLibrariesStore(projectRoot: string): RemoteLibrariesStore {
    const filePath = path.join(projectRoot, REMOTE_LIBRARIES_FILE);
    if (!fs.existsSync(filePath)) {
        return { libraries: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RemoteLibrariesStore;
    } catch {
        return { libraries: {} };
    }
}

function writeLibrariesStore(
    projectRoot: string,
    store: RemoteLibrariesStore,
): void {
    const bridgeDir = path.join(projectRoot, '.bridge');
    if (!fs.existsSync(bridgeDir)) {
        fs.mkdirSync(bridgeDir, { recursive: true });
    }
    fs.writeFileSync(
        path.join(projectRoot, REMOTE_LIBRARIES_FILE),
        JSON.stringify(store, null, 2),
        'utf-8',
    );
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * Fetch a remote component library and register it in the RAG cache.
 *
 * Steps:
 *  1. Parse the GitHub URL → owner/repo.
 *  2. Fetch bridge-manifest.json from raw.githubusercontent.com.
 *  3. On failure, attempt package.json as a fallback.
 *  4. Extract component entries from the fetched JSON.
 *  5. Tag each entry as remote + set remoteUrl.
 *  6. Merge into the RAG in-memory cache via setRegistryCache.
 *  7. Persist metadata to .bridge/remote-libraries.json.
 *  8. Return summary result.
 */
export async function handleBridgeAddRemoteLibrary(
    args: AddRemoteLibraryArgs,
): Promise<AddRemoteLibraryResult> {
    const {
        githubUrl,
        branch = 'main',
        manifestPath = 'bridge-manifest.json',
        projectRoot,
    } = args;

    const { owner, repo } = parseGitHubUrl(githubUrl);
    const libraryName = args.alias ?? repo;

    // ── Step 1-3: Fetch manifest ───────────────────────────────────────────────
    let rawJson: unknown = null;
    const primaryUrl = buildRawUrl(owner, repo, branch, manifestPath);

    try {
        const res = await fetch(primaryUrl);
        if (res.ok) {
            rawJson = await res.json();
        } else if (res.status === 404 && manifestPath === 'bridge-manifest.json') {
            // Fallback: try package.json
            const fallbackUrl = buildRawUrl(owner, repo, branch, 'package.json');
            const fallbackRes = await fetch(fallbackUrl);
            if (fallbackRes.ok) {
                rawJson = await fallbackRes.json();
            }
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
            `Failed to fetch remote library from ${primaryUrl}: ${message}`,
        );
    }

    if (rawJson === null) {
        throw new Error(
            `Remote library manifest not found at ${primaryUrl} (branch: ${branch}). ` +
            `Ensure the repository contains a bridge-manifest.json or package.json ` +
            `with a 'components' section.`,
        );
    }

    // ── Step 4-5: Extract + tag components ────────────────────────────────────
    const components = extractComponents(rawJson);
    const componentNames = Object.keys(components);

    if (componentNames.length === 0) {
        throw new Error(
            `No components found in the manifest fetched from ${githubUrl}. ` +
            `The manifest must expose a 'components' object keyed by component name.`,
        );
    }

    // Tag every entry as remote
    const tagged: Record<string, ComponentEntry> = {};
    for (const [name, entry] of Object.entries(components)) {
        tagged[name] = {
            ...entry,
            name: entry.name ?? name,
            source: 'remote',
            remoteUrl: githubUrl,
        };
    }

    // ── Step 6: Merge into RAG cache ───────────────────────────────────────────
    setRegistryCache(tagged);

    // ── Step 7: Persist metadata ───────────────────────────────────────────────
    const cachedAt = new Date().toISOString();
    const store = readLibrariesStore(projectRoot);

    store.libraries[libraryName] = {
        url: githubUrl,
        branch,
        fetchedAt: cachedAt,
        componentCount: componentNames.length,
        components: componentNames,
    };

    writeLibrariesStore(projectRoot, store);

    // ── Step 8: Return result ──────────────────────────────────────────────────
    return {
        added: componentNames.length,
        libraryName,
        components: componentNames,
        cachedAt,
    };
}
