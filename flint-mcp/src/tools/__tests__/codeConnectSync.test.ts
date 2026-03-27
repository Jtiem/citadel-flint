/**
 * codeConnectSync.test.ts
 *
 * Tests for handleCodeConnectSync — the flint_code_connect_sync MCP tool handler.
 *
 * Coverage:
 *  - generate action returns mappings without writing any file
 *  - write action creates .figma/code-connect.json
 *  - library read from policy.json when not specified
 *  - unknown library returns isError response
 *  - no library and no policy → error
 *  - generate is the default action when action omitted
 *  - all three libraries produce correct mapping counts
 *  - written JSON is valid and contains expected fields
 *  - write creates .figma/ directory if missing
 *  - subsequent writes overwrite previous file
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { handleCodeConnectSync } from '../codeConnectSync.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-cc-test-'))
    fs.mkdirSync(path.join(dir, '.flint'), { recursive: true })
    return dir
}

function cleanup(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
}

function writePolicy(projectRoot: string, policy: Record<string, unknown>): void {
    fs.writeFileSync(
        path.join(projectRoot, '.flint', 'policy.json'),
        JSON.stringify(policy, null, 2),
        'utf-8',
    )
}

function readConnectFile(projectRoot: string): Record<string, unknown> {
    const p = path.join(projectRoot, '.figma', 'code-connect.json')
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>
}

function parseResult(result: ReturnType<typeof handleCodeConnectSync>): Record<string, unknown> {
    return JSON.parse(result.content[0].text) as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// generate action (dry run)
// ---------------------------------------------------------------------------

describe('handleCodeConnectSync — generate action', () => {
    let projectRoot: string

    beforeEach(() => { projectRoot = makeTmpProject() })
    afterEach(() => { cleanup(projectRoot) })

    it('returns mappings for shadcn without writing a file', () => {
        const result = handleCodeConnectSync({
            library: 'shadcn',
            action: 'generate',
            projectRoot,
        })

        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect(data.library).toBe('shadcn')
        expect(Array.isArray(data.mappings)).toBe(true)
        expect((data.mappings as unknown[]).length).toBe(15)
        expect((data.note as string).toLowerCase()).toContain('dry run')

        // Must NOT have written .figma/code-connect.json
        expect(fs.existsSync(path.join(projectRoot, '.figma', 'code-connect.json'))).toBe(false)
    })

    it('returns mappings for mui without writing a file', () => {
        const result = handleCodeConnectSync({
            library: 'mui',
            action: 'generate',
            projectRoot,
        })

        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect(data.library).toBe('mui')
        expect((data.mappings as unknown[]).length).toBe(12)
        expect(fs.existsSync(path.join(projectRoot, '.figma', 'code-connect.json'))).toBe(false)
    })

    it('returns mappings for primeng without writing a file', () => {
        const result = handleCodeConnectSync({
            library: 'primeng',
            action: 'generate',
            projectRoot,
        })

        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect(data.library).toBe('primeng')
        expect((data.mappings as unknown[]).length).toBe(10)
        expect(fs.existsSync(path.join(projectRoot, '.figma', 'code-connect.json'))).toBe(false)
    })

    it('defaults to generate action when action is omitted', () => {
        const result = handleCodeConnectSync({ library: 'shadcn', projectRoot })
        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect((data.note as string).toLowerCase()).toContain('dry run')
        expect(fs.existsSync(path.join(projectRoot, '.figma', 'code-connect.json'))).toBe(false)
    })

    it('includes a summary string', () => {
        const result = handleCodeConnectSync({ library: 'shadcn', action: 'generate', projectRoot })
        const data = parseResult(result)
        expect(typeof data.summary).toBe('string')
        expect((data.summary as string).length).toBeGreaterThan(0)
    })

    it('includes generatedAt timestamp', () => {
        const result = handleCodeConnectSync({ library: 'mui', action: 'generate', projectRoot })
        const data = parseResult(result)
        expect(typeof data.generatedAt).toBe('string')
        expect(() => new Date(data.generatedAt as string)).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// write action
// ---------------------------------------------------------------------------

describe('handleCodeConnectSync — write action', () => {
    let projectRoot: string

    beforeEach(() => { projectRoot = makeTmpProject() })
    afterEach(() => { cleanup(projectRoot) })

    it('creates .figma/code-connect.json for shadcn', () => {
        const result = handleCodeConnectSync({
            library: 'shadcn',
            action: 'write',
            projectRoot,
        })

        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect(data.written).toBe(true)
        expect(data.mappingCount).toBe(15)

        // File must exist
        expect(fs.existsSync(path.join(projectRoot, '.figma', 'code-connect.json'))).toBe(true)
    })

    it('written JSON contains library, mappings, generatedAt', () => {
        handleCodeConnectSync({ library: 'shadcn', action: 'write', projectRoot })
        const json = readConnectFile(projectRoot)
        expect(json.library).toBe('shadcn')
        expect(Array.isArray(json.mappings)).toBe(true)
        expect((json.mappings as unknown[]).length).toBe(15)
        expect(typeof json.generatedAt).toBe('string')
    })

    it('creates .figma/ directory when missing', () => {
        // projectRoot has no .figma dir at this point
        expect(fs.existsSync(path.join(projectRoot, '.figma'))).toBe(false)

        handleCodeConnectSync({ library: 'mui', action: 'write', projectRoot })

        expect(fs.existsSync(path.join(projectRoot, '.figma'))).toBe(true)
        expect(fs.existsSync(path.join(projectRoot, '.figma', 'code-connect.json'))).toBe(true)
    })

    it('overwrites an existing code-connect.json on second write', () => {
        // First write: shadcn
        handleCodeConnectSync({ library: 'shadcn', action: 'write', projectRoot })
        const first = readConnectFile(projectRoot)
        expect(first.library).toBe('shadcn')

        // Second write: mui
        handleCodeConnectSync({ library: 'mui', action: 'write', projectRoot })
        const second = readConnectFile(projectRoot)
        expect(second.library).toBe('mui')
        expect((second.mappings as unknown[]).length).toBe(12)
    })

    it('response contains outputPath pointing to .figma/code-connect.json', () => {
        const result = handleCodeConnectSync({ library: 'primeng', action: 'write', projectRoot })
        const data = parseResult(result)
        expect(typeof data.outputPath).toBe('string')
        expect((data.outputPath as string).endsWith('code-connect.json')).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// library resolution from policy.json
// ---------------------------------------------------------------------------

describe('handleCodeConnectSync — library resolution from policy.json', () => {
    let projectRoot: string

    beforeEach(() => { projectRoot = makeTmpProject() })
    afterEach(() => { cleanup(projectRoot) })

    it('reads selectedLibrary from policy.json when library param is omitted', () => {
        writePolicy(projectRoot, { selectedLibrary: 'mui' })

        const result = handleCodeConnectSync({ action: 'generate', projectRoot })
        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect(data.library).toBe('mui')
        expect((data.mappings as unknown[]).length).toBe(12)
    })

    it('reads shadcn from policy.json', () => {
        writePolicy(projectRoot, { selectedLibrary: 'shadcn' })

        const result = handleCodeConnectSync({ projectRoot })
        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect(data.library).toBe('shadcn')
    })

    it('explicit library param overrides policy.json', () => {
        // policy says mui, param says primeng
        writePolicy(projectRoot, { selectedLibrary: 'mui' })

        const result = handleCodeConnectSync({ library: 'primeng', action: 'generate', projectRoot })
        expect(result.isError).toBeFalsy()
        const data = parseResult(result)
        expect(data.library).toBe('primeng')
    })

    it('returns error when neither param nor policy provides a library', () => {
        // No policy.json written — no .flint/policy.json exists
        const result = handleCodeConnectSync({ action: 'generate', projectRoot })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('No library specified')
    })

    it('returns error when policy.json has no selectedLibrary', () => {
        writePolicy(projectRoot, { someOtherKey: 'value' })

        const result = handleCodeConnectSync({ action: 'generate', projectRoot })
        expect(result.isError).toBe(true)
    })

    it('returns error when policy.json has malformed JSON', () => {
        fs.writeFileSync(
            path.join(projectRoot, '.flint', 'policy.json'),
            '{ bad json !!!',
            'utf-8',
        )
        const result = handleCodeConnectSync({ action: 'generate', projectRoot })
        expect(result.isError).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('handleCodeConnectSync — error cases', () => {
    let projectRoot: string

    beforeEach(() => { projectRoot = makeTmpProject() })
    afterEach(() => { cleanup(projectRoot) })

    it('returns error for unknown library', () => {
        const result = handleCodeConnectSync({
            library: 'bootstrap',
            action: 'generate',
            projectRoot,
        })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Unknown library')
        expect(result.content[0].text).toContain('bootstrap')
    })

    it('error message lists supported libraries', () => {
        const result = handleCodeConnectSync({
            library: 'vuetify',
            action: 'generate',
            projectRoot,
        })
        expect(result.isError).toBe(true)
        const text = result.content[0].text
        // should mention at least one known library
        const mentionsSomething = text.includes('shadcn') || text.includes('mui') || text.includes('primeng')
        expect(mentionsSomething).toBe(true)
    })
})
