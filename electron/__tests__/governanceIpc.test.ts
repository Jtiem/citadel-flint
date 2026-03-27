/**
 * governanceIpc.test.ts — electron/__tests__/governanceIpc.test.ts
 *
 * Unit tests for the two new ERM IPC handler logic functions extracted from
 * electron/main.ts: governance:get-resolved-config and governance:toggle-pack.
 *
 * Pattern: pure handler logic is reproduced as standalone functions so no
 * Electron APIs (ipcMain, BrowserWindow) are needed in the test process.
 *
 * Covers:
 *   GIPC-01 — getResolvedConfig: returns null when projectRoot is null
 *   GIPC-02 — getResolvedConfig: returns null when flint.config.yaml is absent
 *   GIPC-03 — getResolvedConfig: parses extends[] correctly
 *   GIPC-04 — getResolvedConfig: activePresets filters only @flint/ entries
 *   GIPC-05 — getResolvedConfig: empty extends[] → empty activePresets
 *   GIPC-06 — getResolvedConfig: missing extends key → empty chains
 *   GIPC-07 — togglePack: returns error when packId is empty string
 *   GIPC-08 — togglePack: returns error when packId is not a string
 *   GIPC-09 — togglePack: returns error when enable is not boolean
 *   GIPC-10 — togglePack: returns error when no active project
 *   GIPC-11 — togglePack: enable=true adds packId to extends[]
 *   GIPC-12 — togglePack: enable=true is idempotent (no duplicate)
 *   GIPC-13 — togglePack: enable=false removes packId from extends[]
 *   GIPC-14 — togglePack: enable=false is idempotent when not present
 *   GIPC-15 — togglePack: preserves other extends entries when adding
 *   GIPC-16 — togglePack: preserves other extends entries when removing
 *   GIPC-17 — togglePack: creates extends[] when config has none
 */

import { describe, it, expect } from 'vitest'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ResolvedConfigResult {
    config: Record<string, unknown>
    extendsChain: string[]
    activePresets: string[]
    projectRoot: string
}

interface TogglePackResult {
    success: boolean
    extends?: string[]
    error?: string
}

// ── Handler logic reproductions ───────────────────────────────────────────────
//
// These functions mirror the core logic of the ipcMain.handle callbacks in
// electron/main.ts without Electron dependencies. They operate on plain data.

/**
 * Pure implementation of the governance:get-resolved-config handler logic.
 * In production, `readYaml` is provided by the main process fs + js-yaml stack.
 */
function getResolvedConfigLogic(
    projectRoot: string | null,
    /** Returns parsed YAML config or null if file absent */
    readYaml: (yamlPath: string) => Record<string, unknown> | null,
): ResolvedConfigResult | null {
    if (!projectRoot) return null

    const yamlPath = `${projectRoot}/flint.config.yaml`
    const config = readYaml(yamlPath)
    if (!config) return null

    const extendsChain = Array.isArray(config.extends)
        ? (config.extends as string[])
        : []
    const activePresets = extendsChain.filter((e: string) => e.startsWith('@flint/'))

    return { config, extendsChain, activePresets, projectRoot }
}

/**
 * Pure implementation of the governance:toggle-pack handler logic.
 * In production, `readYaml` / `dumpYaml` / `writeFile` / `broadcastChange`
 * are provided by the main process stack.
 */
function togglePackLogic(
    projectRoot: string | null,
    packId: unknown,
    enable: unknown,
    /** Returns parsed YAML config or null if file absent */
    readYaml: (yamlPath: string) => Record<string, unknown> | null,
    /** Records what was written for assertion purposes */
    captureWrite: (path: string, config: Record<string, unknown>) => void,
): TogglePackResult {
    if (typeof packId !== 'string' || packId.trim() === '') {
        return { success: false, error: 'governance:toggle-pack — packId must be a non-empty string' }
    }
    if (typeof enable !== 'boolean') {
        return { success: false, error: 'governance:toggle-pack — enable must be a boolean' }
    }
    if (!projectRoot) {
        return { success: false, error: 'No active project' }
    }

    const yamlPath = `${projectRoot}/flint.config.yaml`
    const config: Record<string, unknown> = readYaml(yamlPath) ?? {}

    const currentExtends: string[] = Array.isArray(config.extends)
        ? (config.extends as string[])
        : []

    let updatedExtends: string[]
    if (enable) {
        updatedExtends = currentExtends.includes(packId as string)
            ? currentExtends
            : [...currentExtends, packId as string]
    } else {
        updatedExtends = currentExtends.filter((e) => e !== packId)
    }

    config.extends = updatedExtends
    captureWrite(yamlPath, config)

    return { success: true, extends: updatedExtends }
}

// ── Tests: getResolvedConfig ──────────────────────────────────────────────────

describe('governance:get-resolved-config handler logic', () => {
    it('GIPC-01: returns null when projectRoot is null', () => {
        const result = getResolvedConfigLogic(null, () => null)
        expect(result).toBeNull()
    })

    it('GIPC-02: returns null when flint.config.yaml is absent (readYaml returns null)', () => {
        const result = getResolvedConfigLogic('/some/project', () => null)
        expect(result).toBeNull()
    })

    it('GIPC-03: parses extends[] correctly from the config', () => {
        const yaml = { project: 'MyApp', extends: ['@flint/wcag-aa', './team.yaml'] }
        const result = getResolvedConfigLogic('/project', () => yaml)

        expect(result).not.toBeNull()
        expect(result!.extendsChain).toEqual(['@flint/wcag-aa', './team.yaml'])
    })

    it('GIPC-04: activePresets contains only @flint/ prefixed entries', () => {
        const yaml = {
            extends: ['@flint/healthcare', './local.yaml', '@flint/wcag-aa', '../shared.yaml'],
        }
        const result = getResolvedConfigLogic('/project', () => yaml)

        expect(result!.activePresets).toEqual(['@flint/healthcare', '@flint/wcag-aa'])
    })

    it('GIPC-05: empty extends[] → empty extendsChain and empty activePresets', () => {
        const yaml = { project: 'EmptyProject', extends: [] }
        const result = getResolvedConfigLogic('/project', () => yaml)

        expect(result!.extendsChain).toEqual([])
        expect(result!.activePresets).toEqual([])
    })

    it('GIPC-06: missing extends key → empty chains', () => {
        const yaml = { project: 'NoExtends' }
        const result = getResolvedConfigLogic('/project', () => yaml)

        expect(result!.extendsChain).toEqual([])
        expect(result!.activePresets).toEqual([])
    })
})

// ── Tests: togglePack ─────────────────────────────────────────────────────────

describe('governance:toggle-pack handler logic', () => {
    it('GIPC-07: returns error when packId is an empty string', () => {
        const result = togglePackLogic('/project', '', true, () => null, () => { })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/packId/)
    })

    it('GIPC-08: returns error when packId is not a string (number)', () => {
        const result = togglePackLogic('/project', 42, true, () => null, () => { })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/packId/)
    })

    it('GIPC-09: returns error when enable is not a boolean (string "true")', () => {
        const result = togglePackLogic('/project', '@flint/healthcare', 'true', () => null, () => { })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/enable/)
    })

    it('GIPC-10: returns error when no active project (projectRoot is null)', () => {
        const result = togglePackLogic(null, '@flint/healthcare', true, () => null, () => { })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/No active project/)
    })

    it('GIPC-11: enable=true adds packId to extends[]', () => {
        const yaml = { extends: ['@flint/wcag-aa'] }
        const writes: Record<string, unknown>[] = []

        const result = togglePackLogic(
            '/project',
            '@flint/healthcare',
            true,
            () => yaml,
            (_path, config) => { writes.push(config) },
        )

        expect(result.success).toBe(true)
        expect(result.extends).toEqual(['@flint/wcag-aa', '@flint/healthcare'])
        expect(writes[0].extends).toEqual(['@flint/wcag-aa', '@flint/healthcare'])
    })

    it('GIPC-12: enable=true is idempotent — does not duplicate an existing preset', () => {
        const yaml = { extends: ['@flint/healthcare'] }
        const writes: Record<string, unknown>[] = []

        const result = togglePackLogic(
            '/project',
            '@flint/healthcare',
            true,
            () => yaml,
            (_path, config) => { writes.push(config) },
        )

        expect(result.success).toBe(true)
        expect(result.extends).toEqual(['@flint/healthcare'])
        // Length must be exactly 1 — no duplicate
        expect((writes[0].extends as string[]).length).toBe(1)
    })

    it('GIPC-13: enable=false removes packId from extends[]', () => {
        const yaml = { extends: ['@flint/wcag-aa', '@flint/healthcare'] }
        const writes: Record<string, unknown>[] = []

        const result = togglePackLogic(
            '/project',
            '@flint/healthcare',
            false,
            () => yaml,
            (_path, config) => { writes.push(config) },
        )

        expect(result.success).toBe(true)
        expect(result.extends).toEqual(['@flint/wcag-aa'])
        expect(writes[0].extends).toEqual(['@flint/wcag-aa'])
    })

    it('GIPC-14: enable=false is idempotent when packId is not present', () => {
        const yaml = { extends: ['@flint/wcag-aa'] }
        const writes: Record<string, unknown>[] = []

        const result = togglePackLogic(
            '/project',
            '@flint/healthcare',
            false,
            () => yaml,
            (_path, config) => { writes.push(config) },
        )

        expect(result.success).toBe(true)
        expect(result.extends).toEqual(['@flint/wcag-aa'])
    })

    it('GIPC-15: enable=true preserves all other extends entries', () => {
        const yaml = { extends: ['./team.yaml', '@flint/wcag-aa', '../shared.yaml'] }
        const result = togglePackLogic(
            '/project',
            '@flint/finance',
            true,
            () => yaml,
            () => { },
        )

        expect(result.extends).toEqual(['./team.yaml', '@flint/wcag-aa', '../shared.yaml', '@flint/finance'])
    })

    it('GIPC-16: enable=false preserves all other extends entries', () => {
        const yaml = {
            extends: ['./team.yaml', '@flint/healthcare', '@flint/wcag-aa', '../shared.yaml'],
        }
        const result = togglePackLogic(
            '/project',
            '@flint/healthcare',
            false,
            () => yaml,
            () => { },
        )

        expect(result.extends).toEqual(['./team.yaml', '@flint/wcag-aa', '../shared.yaml'])
    })

    it('GIPC-17: creates extends[] when config has no extends key (new config)', () => {
        const yaml = { project: 'NewProject' }
        const writes: Record<string, unknown>[] = []

        const result = togglePackLogic(
            '/project',
            '@flint/wcag-aa',
            true,
            () => yaml,
            (_path, config) => { writes.push(config) },
        )

        expect(result.success).toBe(true)
        expect(result.extends).toEqual(['@flint/wcag-aa'])
        expect(writes[0].extends).toEqual(['@flint/wcag-aa'])
    })
})
