/**
 * componentScope.test.ts — CR.4: Component Scope Management IPC Handler Tests
 *
 * These tests exercise the pure handler logic mirrored from electron/main.ts.
 * No Electron APIs (ipcMain, app, BrowserWindow) are imported — those cannot
 * run in a plain Node.js test environment. Each handler's core logic is
 * reproduced here as a standalone function that accepts injected file-system
 * dependencies, matching the exact algorithmic contract of the real handlers.
 *
 * Coverage (contract section 10):
 *   SCOPE-01 — scope:get-registry-and-scope: full registry + null scope when
 *              policy.json has no componentScope
 *   SCOPE-02 — scope:get-registry-and-scope: scope array when policy.json has
 *              componentScope
 *   SCOPE-03 — scope:get-registry-and-scope: registryAvailable: false when
 *              flint-manifest.json is missing
 *   SCOPE-04 — scope:get-registry-and-scope: empty registry when manifest has
 *              empty components object
 *   SCOPE-05 — scope:set-scope: writes componentScope array to policy.json and
 *              returns ok
 *   SCOPE-06 — scope:set-scope: null removes componentScope key from policy.json
 *   SCOPE-07 — scope:set-scope: empty array removes componentScope key
 *              (normalised to null per CR.3 semantics)
 *   SCOPE-08 — scope:set-scope: returns error when no project is open
 */

import { describe, it, expect } from 'vitest'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrors the contract types from CR.4-contract.md / flint-api.d.ts
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentRegistryEntry {
    name: string
    props: Record<string, { type: string; required: boolean }>
    variants: string[]
    consumedTokens: string[]
    description: string
}

interface ComponentScopeData {
    registry: Record<string, ComponentRegistryEntry>
    scope: string[] | null
    registryAvailable: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_MANIFEST = {
    components: {
        Button: {
            name: 'Button',
            importPath: '@ds/Button',
            description: 'Primary action button',
            props: {
                variant: { type: 'string', required: true },
                size: { type: 'string', required: false },
            },
            variants: ['primary', 'secondary'],
            tokens: ['color.primary'],
        },
        Card: {
            name: 'Card',
            importPath: '@ds/Card',
            props: { title: { type: 'string', required: false } },
        },
    },
}

const MOCK_POLICY_WITH_SCOPE = {
    domain: 'ecommerce',
    componentScope: ['Button'],
}

const MOCK_POLICY_WITHOUT_SCOPE = {
    domain: 'ecommerce',
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror implementation: getRegistryAndScope
//
// Faithful reproduction of the ipcMain.handle('scope:get-registry-and-scope')
// callback in electron/main.ts. Dependencies are injected so tests can control
// file-system state without touching the real disk.
// ─────────────────────────────────────────────────────────────────────────────

interface GetRegistryDeps {
    activeProjectRoot: string | null
    existsSync: (p: string) => boolean
    readFile: (p: string) => Promise<string>
}

async function getRegistryAndScope(deps: GetRegistryDeps): Promise<ComponentScopeData> {
    const { activeProjectRoot, existsSync, readFile } = deps

    if (!activeProjectRoot) {
        return { registry: {}, scope: null, registryAvailable: false }
    }

    try {
        // 1. Read flint-manifest.json
        const manifestPath = path.join(activeProjectRoot, 'flint-manifest.json')
        if (!existsSync(manifestPath)) {
            return { registry: {}, scope: null, registryAvailable: false }
        }

        let manifest: Record<string, unknown>
        try {
            const raw = await readFile(manifestPath)
            manifest = JSON.parse(raw) as Record<string, unknown>
        } catch {
            return { registry: {}, scope: null, registryAvailable: false }
        }

        // 2. Normalise registry entries
        //    Field mapping: manifest's `tokens` array → `consumedTokens`.
        //    Missing fields get safe defaults.
        const rawComponents = (manifest.components ?? {}) as Record<string, unknown>
        const registry: Record<string, ComponentRegistryEntry> = {}

        for (const [componentName, entry] of Object.entries(rawComponents)) {
            const e = (entry ?? {}) as Record<string, unknown>

            const propsRaw = (e.props ?? {}) as Record<string, unknown>
            const props: Record<string, { type: string; required: boolean }> = {}
            for (const [propName, propDef] of Object.entries(propsRaw)) {
                const p = (propDef ?? {}) as Record<string, unknown>
                props[propName] = {
                    type: typeof p.type === 'string' ? p.type : 'unknown',
                    required: typeof p.required === 'boolean' ? p.required : false,
                }
            }

            registry[componentName] = {
                name: componentName,
                props,
                variants: Array.isArray(e.variants) ? (e.variants as string[]) : [],
                consumedTokens: Array.isArray(e.tokens) ? (e.tokens as string[]) : [],
                description: typeof e.description === 'string' ? e.description : '',
            }
        }

        // 3. Read componentScope from .flint/policy.json
        let scope: string[] | null = null
        const policyPath = path.join(activeProjectRoot, '.flint', 'policy.json')
        if (existsSync(policyPath)) {
            try {
                const policyRaw = await readFile(policyPath)
                const policy = JSON.parse(policyRaw) as Record<string, unknown>
                if (Array.isArray(policy.componentScope) && policy.componentScope.length > 0) {
                    scope = policy.componentScope as string[]
                }
                // Empty array treated as null per CR.3 semantics.
            } catch {
                // Malformed policy — treat as missing.
            }
        }

        return { registry, scope, registryAvailable: true }
    } catch {
        return { registry: {}, scope: null, registryAvailable: false }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mirror implementation: setScope
//
// Faithful reproduction of the ipcMain.handle('scope:set-scope') callback in
// electron/main.ts. The FileTransactionManager write call is replaced with an
// injectable write function so tests never touch the real disk.
// ─────────────────────────────────────────────────────────────────────────────

interface SetScopeDeps {
    activeProjectRoot: string | null
    existsSync: (p: string) => boolean
    readFile: (p: string) => Promise<string>
    /**
     * Stands in for fileTransactionManager.write(path, content).
     * Capture calls with a vi.fn() to assert what was written.
     */
    writeFile: (p: string, content: string) => Promise<void>
    /**
     * Stands in for mkdirSync(dir, { recursive: true }).
     * Capture calls with a vi.fn() to assert directory creation.
     */
    mkdirSync: (dir: string) => void
}

async function setScope(
    payload: unknown,
    deps: SetScopeDeps,
): Promise<{ ok: boolean; error?: string }> {
    const { activeProjectRoot, existsSync, readFile, writeFile, mkdirSync } = deps

    if (!activeProjectRoot) {
        return { ok: false, error: 'No project open' }
    }

    try {
        // 1. Validate payload
        if (
            typeof payload !== 'object' ||
            payload === null ||
            !('scope' in payload)
        ) {
            return { ok: false, error: 'Invalid payload: expected { scope: string[] | null }' }
        }
        const { scope } = payload as { scope: unknown }
        if (scope !== null && !Array.isArray(scope)) {
            return { ok: false, error: 'Invalid payload: scope must be string[] or null' }
        }

        // 2. Ensure .flint/ directory exists
        const flintDir = path.join(activeProjectRoot, '.flint')
        if (!existsSync(flintDir)) {
            mkdirSync(flintDir)
        }

        // 3. Read existing policy.json (create empty object if missing)
        const policyPath = path.join(flintDir, 'policy.json')
        let policy: Record<string, unknown> = {}
        if (existsSync(policyPath)) {
            try {
                const raw = await readFile(policyPath)
                policy = JSON.parse(raw) as Record<string, unknown>
            } catch {
                policy = {}
            }
        }

        // 4. Apply scope mutation
        //    null or empty array → remove componentScope key (all components allowed).
        //    non-empty array → set explicit allow-list.
        if (scope === null || (Array.isArray(scope) && scope.length === 0)) {
            delete policy.componentScope
        } else {
            policy.componentScope = scope
        }

        // 5. Write atomically (mirrors FileTransactionManager.write)
        await writeFile(policyPath, JSON.stringify(policy, null, 2) + '\n')

        return { ok: true }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a fake readFile that returns fixture JSON for known paths and
// throws ENOENT for anything else.
// ─────────────────────────────────────────────────────────────────────────────

function makeReadFile(
    fileMap: Record<string, unknown>,
): (p: string) => Promise<string> {
    return async (p: string) => {
        if (Object.prototype.hasOwnProperty.call(fileMap, p)) {
            return JSON.stringify(fileMap[p])
        }
        const err = Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), {
            code: 'ENOENT',
        })
        throw err
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = '/tmp/flint-test-project'
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'flint-manifest.json')
const POLICY_PATH = path.join(PROJECT_ROOT, '.flint', 'policy.json')
const FLINT_DIR = path.join(PROJECT_ROOT, '.flint')

describe('scope:get-registry-and-scope', () => {
    it('SCOPE-01: returns full registry and null scope when policy.json has no componentScope', async () => {
        const files: Record<string, unknown> = {
            [MANIFEST_PATH]: MOCK_MANIFEST,
            [POLICY_PATH]: MOCK_POLICY_WITHOUT_SCOPE,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        expect(result.registryAvailable).toBe(true)
        expect(result.scope).toBeNull()

        // Both components must be present in the registry
        expect(Object.keys(result.registry)).toHaveLength(2)
        expect(result.registry).toHaveProperty('Button')
        expect(result.registry).toHaveProperty('Card')
    })

    it('SCOPE-01: Button entry is normalised correctly (tokens → consumedTokens)', async () => {
        const files: Record<string, unknown> = {
            [MANIFEST_PATH]: MOCK_MANIFEST,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        const button = result.registry['Button']
        expect(button.name).toBe('Button')
        expect(button.description).toBe('Primary action button')
        expect(button.variants).toEqual(['primary', 'secondary'])
        expect(button.consumedTokens).toEqual(['color.primary'])
        expect(button.props['variant']).toEqual({ type: 'string', required: true })
        expect(button.props['size']).toEqual({ type: 'string', required: false })
    })

    it('SCOPE-01: Card entry gets safe defaults for missing optional fields', async () => {
        const files: Record<string, unknown> = {
            [MANIFEST_PATH]: MOCK_MANIFEST,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        const card = result.registry['Card']
        expect(card.name).toBe('Card')
        expect(card.description).toBe('')          // missing → empty string default
        expect(card.variants).toEqual([])            // missing → empty array default
        expect(card.consumedTokens).toEqual([])      // missing → empty array default
    })

    it('SCOPE-02: returns scope array when policy.json has componentScope', async () => {
        const files: Record<string, unknown> = {
            [MANIFEST_PATH]: MOCK_MANIFEST,
            [POLICY_PATH]: MOCK_POLICY_WITH_SCOPE,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        expect(result.registryAvailable).toBe(true)
        expect(result.scope).toEqual(['Button'])

        // Full registry is still returned regardless of the scope filter
        expect(Object.keys(result.registry)).toHaveLength(2)
    })

    it('SCOPE-03: returns registryAvailable: false when flint-manifest.json is missing', async () => {
        // No MANIFEST_PATH in the files map — existsSync returns false for it.
        const files: Record<string, unknown> = {
            [POLICY_PATH]: MOCK_POLICY_WITHOUT_SCOPE,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        expect(result.registryAvailable).toBe(false)
        expect(result.registry).toEqual({})
        expect(result.scope).toBeNull()
    })

    it('SCOPE-04: returns empty registry when manifest has empty components object', async () => {
        const emptyManifest = { components: {} }
        const files: Record<string, unknown> = {
            [MANIFEST_PATH]: emptyManifest,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        expect(result.registryAvailable).toBe(true)
        expect(result.registry).toEqual({})
        expect(result.scope).toBeNull()
    })

    it('SCOPE-04: returns empty registry when manifest has no components key', async () => {
        const manifestNoComponents = { version: '1.0' }
        const files: Record<string, unknown> = {
            [MANIFEST_PATH]: manifestNoComponents,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        expect(result.registryAvailable).toBe(true)
        expect(result.registry).toEqual({})
    })

    it('returns registryAvailable: false when no project is open (activeProjectRoot is null)', async () => {
        const result = await getRegistryAndScope({
            activeProjectRoot: null,
            existsSync: () => true,
            readFile: async () => '{}',
        })

        expect(result.registryAvailable).toBe(false)
        expect(result.registry).toEqual({})
        expect(result.scope).toBeNull()
    })

    it('treats empty componentScope array in policy.json as null (CR.3 semantics)', async () => {
        const policyWithEmptyScope = { domain: 'ecommerce', componentScope: [] }
        const files: Record<string, unknown> = {
            [MANIFEST_PATH]: MOCK_MANIFEST,
            [POLICY_PATH]: policyWithEmptyScope,
        }

        const result = await getRegistryAndScope({
            activeProjectRoot: PROJECT_ROOT,
            existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
            readFile: makeReadFile(files),
        })

        expect(result.scope).toBeNull()
    })
})

describe('scope:set-scope', () => {
    it('SCOPE-05: writes componentScope array to policy.json and returns ok', async () => {
        const existingPolicy = { domain: 'ecommerce' }
        const files: Record<string, unknown> = {
            [POLICY_PATH]: existingPolicy,
        }

        const written: Array<{ path: string; content: string }> = []

        const result = await setScope(
            { scope: ['Button'] },
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: (p) =>
                    p === FLINT_DIR || Object.prototype.hasOwnProperty.call(files, p),
                readFile: makeReadFile(files),
                writeFile: async (p, content) => {
                    written.push({ path: p, content })
                },
                mkdirSync: () => {},
            },
        )

        expect(result.ok).toBe(true)
        expect(result.error).toBeUndefined()

        expect(written).toHaveLength(1)
        expect(written[0].path).toBe(POLICY_PATH)

        const saved = JSON.parse(written[0].content) as Record<string, unknown>
        expect(saved.componentScope).toEqual(['Button'])
        // Existing fields are preserved
        expect(saved.domain).toBe('ecommerce')
    })

    it('SCOPE-05: writes multiple component names to the scope array', async () => {
        const files: Record<string, unknown> = {
            [POLICY_PATH]: MOCK_POLICY_WITHOUT_SCOPE,
        }

        const written: Array<{ path: string; content: string }> = []

        const result = await setScope(
            { scope: ['Button', 'Card'] },
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: (p) =>
                    p === FLINT_DIR || Object.prototype.hasOwnProperty.call(files, p),
                readFile: makeReadFile(files),
                writeFile: async (p, content) => {
                    written.push({ path: p, content })
                },
                mkdirSync: () => {},
            },
        )

        expect(result.ok).toBe(true)
        const saved = JSON.parse(written[0].content) as Record<string, unknown>
        expect(saved.componentScope).toEqual(['Button', 'Card'])
    })

    it('SCOPE-06: null removes componentScope key from policy.json', async () => {
        const files: Record<string, unknown> = {
            [POLICY_PATH]: MOCK_POLICY_WITH_SCOPE,   // has componentScope: ['Button']
        }

        const written: Array<{ path: string; content: string }> = []

        const result = await setScope(
            { scope: null },
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: (p) =>
                    p === FLINT_DIR || Object.prototype.hasOwnProperty.call(files, p),
                readFile: makeReadFile(files),
                writeFile: async (p, content) => {
                    written.push({ path: p, content })
                },
                mkdirSync: () => {},
            },
        )

        expect(result.ok).toBe(true)

        const saved = JSON.parse(written[0].content) as Record<string, unknown>
        expect(Object.prototype.hasOwnProperty.call(saved, 'componentScope')).toBe(false)
        // Other fields are preserved
        expect(saved.domain).toBe('ecommerce')
    })

    it('SCOPE-07: empty array removes componentScope key (normalised to null)', async () => {
        const files: Record<string, unknown> = {
            [POLICY_PATH]: MOCK_POLICY_WITH_SCOPE,   // has componentScope: ['Button']
        }

        const written: Array<{ path: string; content: string }> = []

        const result = await setScope(
            { scope: [] },
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: (p) =>
                    p === FLINT_DIR || Object.prototype.hasOwnProperty.call(files, p),
                readFile: makeReadFile(files),
                writeFile: async (p, content) => {
                    written.push({ path: p, content })
                },
                mkdirSync: () => {},
            },
        )

        expect(result.ok).toBe(true)

        const saved = JSON.parse(written[0].content) as Record<string, unknown>
        expect(Object.prototype.hasOwnProperty.call(saved, 'componentScope')).toBe(false)
    })

    it('SCOPE-08: returns error when no project is open (activeProjectRoot is null)', async () => {
        const result = await setScope(
            { scope: ['Button'] },
            {
                activeProjectRoot: null,
                existsSync: () => false,
                readFile: async () => '{}',
                writeFile: async () => {},
                mkdirSync: () => {},
            },
        )

        expect(result.ok).toBe(false)
        expect(result.error).toBe('No project open')
    })

    it('creates policy.json from scratch when no existing policy file is present', async () => {
        // Neither .flint/ dir nor policy.json exist initially
        const written: Array<{ path: string; content: string }> = []
        const madeDir: string[] = []

        const result = await setScope(
            { scope: ['Button'] },
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: () => false,    // neither .flint/ nor policy.json exist
                readFile: async () => { throw new Error('ENOENT') },
                writeFile: async (p, content) => {
                    written.push({ path: p, content })
                },
                mkdirSync: (dir) => { madeDir.push(dir) },
            },
        )

        expect(result.ok).toBe(true)
        expect(madeDir).toContain(FLINT_DIR)

        const saved = JSON.parse(written[0].content) as Record<string, unknown>
        expect(saved.componentScope).toEqual(['Button'])
    })

    it('returns error for invalid payload (missing scope key)', async () => {
        const result = await setScope(
            { notScope: ['Button'] },
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: () => false,
                readFile: async () => '{}',
                writeFile: async () => {},
                mkdirSync: () => {},
            },
        )

        expect(result.ok).toBe(false)
        expect(result.error).toContain('Invalid payload')
    })

    it('returns error for invalid payload (scope is not an array or null)', async () => {
        const result = await setScope(
            { scope: 'Button' },           // string, not string[] | null
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: () => false,
                readFile: async () => '{}',
                writeFile: async () => {},
                mkdirSync: () => {},
            },
        )

        expect(result.ok).toBe(false)
        expect(result.error).toContain('Invalid payload')
    })

    it('output JSON is terminated with a trailing newline (Commandment 12 format)', async () => {
        const written: Array<{ path: string; content: string }> = []

        await setScope(
            { scope: ['Button'] },
            {
                activeProjectRoot: PROJECT_ROOT,
                existsSync: (p) => p === FLINT_DIR,
                readFile: async () => '{}',
                writeFile: async (p, content) => { written.push({ path: p, content }) },
                mkdirSync: () => {},
            },
        )

        expect(written[0].content.endsWith('\n')).toBe(true)
    })
})
