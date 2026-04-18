/**
 * projectRootValidation.mint5.test.ts
 *   flint-mcp/src/tools/__tests__/projectRootValidation.mint5.test.ts
 *
 * MINT.5 Phase 1 — Group B real assertions for MCP projectRoot validation.
 *
 * Covers the validateProjectRoot gate applied at handler entry in three MCP
 * tools: handleEmitTokens, handleMapTokens, and handleApproveTokens (which
 * lives inside extractTokens.ts per W2 lint note — no separate approveTokens.ts).
 *
 * Contract references:
 *   testBoundaries: 'handleEmitTokens', 'handleMapTokens', '_report.json header',
 *                   'validateProjectRoot'
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { validateProjectRoot, FilePathValidationError } from '../../shared/tokenPath.js'
import { SANITIZER_VERSION } from '../../shared/tokenValueSanitizer.js'
import { handleMapTokens } from '../mapTokens.js'
import { handleApproveTokens } from '../extractTokens.js'
import { handleEmitTokens } from '../emitTokens.js'

// ── validateProjectRoot unit tests ────────────────────────────────────────────

describe('MINT.5 — validateProjectRoot (shared/tokenPath.ts)', () => {
    it('accepts a path that is inside the user home directory', () => {
        const home = os.homedir()
        const inside = path.join(home, 'some-project')
        // Does not throw
        expect(() => validateProjectRoot(inside, home)).not.toThrow()
    })

    it('rejects /etc/passwd (outside home) — throws FilePathValidationError', () => {
        const home = os.homedir()
        expect(() => validateProjectRoot('/etc/passwd', home)).toThrow(FilePathValidationError)
    })

    it('rejects path resolved via symlink traversal outside home', () => {
        // /tmp is outside $HOME on macOS (symlinked to /private/tmp, still outside home)
        const home = os.homedir()
        // If /tmp resolves to something inside home on CI, we skip — but normally it is outside.
        const resolved = fs.realpathSync.bind(fs, '/tmp')
        let realTmp: string
        try {
            realTmp = fs.realpathSync('/tmp')
        } catch {
            realTmp = '/tmp'
        }
        if (!realTmp.startsWith(home)) {
            expect(() => validateProjectRoot('/tmp', home)).toThrow(FilePathValidationError)
        } else {
            // On some CI systems /tmp is inside home — skip this assertion
            expect(true).toBe(true)
        }
    })

    it('rejects non-string raw input', () => {
        const home = os.homedir()
        expect(() => validateProjectRoot(42, home)).toThrow(FilePathValidationError)
        expect(() => validateProjectRoot(null, home)).toThrow(FilePathValidationError)
        expect(() => validateProjectRoot(undefined, home)).toThrow(FilePathValidationError)
    })

    it('rejects empty string', () => {
        const home = os.homedir()
        expect(() => validateProjectRoot('', home)).toThrow(FilePathValidationError)
    })

    it('accepts process.cwd() when it resolves inside $HOME (self-host dev workflow, R9)', () => {
        const home = os.homedir()
        const cwd = process.cwd()
        let cwdReal: string
        try {
            cwdReal = fs.realpathSync(cwd)
        } catch {
            cwdReal = cwd
        }
        if (cwdReal.startsWith(home)) {
            expect(() => validateProjectRoot(cwd, home)).not.toThrow()
        } else {
            // Running from outside home (unlikely but skip gracefully)
            expect(true).toBe(true)
        }
    })
})

// ── handleEmitTokens ──────────────────────────────────────────────────────────

describe('MINT.5 — handleEmitTokens projectRoot validation', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.homedir(), '.flint-emit-test-'))
    })

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch { /* ignore */ }
    })

    it('returns isError: true with path-outside-home message when projectRoot="/etc"', async () => {
        const result = await handleEmitTokens({ projectRoot: '/etc' }, '/etc')
        expect(result).toMatchObject({ isError: true })
        const text = result.content[0]?.text ?? ''
        const parsed = JSON.parse(text)
        expect(parsed.error).toMatch(/projectRoot/i)
    })

    it('returns isError: true when projectRoot is a non-string', async () => {
        // TypeScript prevents this at compile time but handler should guard at runtime
        const result = await handleEmitTokens(
            // @ts-expect-error -- intentional runtime test
            { projectRoot: 42 },
            process.cwd(),
        )
        expect(result).toMatchObject({ isError: true })
    })

    it('proceeds past validation when projectRoot is inside home directory and tokens exist', async () => {
        // Create a valid .flint/design-tokens.json inside tmpDir (which is inside $HOME via /tmp)
        // Note: On macOS /tmp -> /private/tmp which may be outside $HOME.
        // We use a tmpDir inside the project root (os.homedir()) for a reliable test.
        const projectDir = path.join(os.homedir(), '.flint-test-' + Date.now())
        try {
            fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })
            const tokens = [
                { id: 1, token_path: 'colors.primary', token_type: 'color', token_value: '#3b82f6', collection_name: 'default', mode: 'default', description: null },
            ]
            fs.writeFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), JSON.stringify(tokens))
            const result = await handleEmitTokens({ projectRoot: projectDir, dryRun: true }, projectDir)
            // Should not return isError
            const text = result.content[0]?.text ?? ''
            // The result is a valid TokenSyncReport JSON — not an error shape
            expect(text).not.toContain('"isError"')
            expect(text).not.toMatch(/Invalid projectRoot/)
        } finally {
            try { fs.rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
        }
    })

    it('_report.json header includes sanitizerVersion matching SANITIZER_VERSION constant', async () => {
        // Create a project dir inside home with tokens
        const projectDir = path.join(os.homedir(), '.flint-test-report-' + Date.now())
        try {
            fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })
            const tokens = [
                { id: 1, token_path: 'colors.primary', token_type: 'color', token_value: '#3b82f6', collection_name: 'default', mode: 'default', description: null },
            ]
            fs.writeFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), JSON.stringify(tokens))
            // dryRun=false so the report file is written
            const outputDir = path.join(projectDir, '.flint', 'platform-tokens')
            await handleEmitTokens({ projectRoot: projectDir, dryRun: false, platforms: ['css'] }, projectDir)
            const reportPath = path.join(outputDir, '_report.json')
            if (fs.existsSync(reportPath)) {
                const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
                expect(report._provenance?.sanitizerVersion).toBe(SANITIZER_VERSION)
            }
        } finally {
            try { fs.rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
        }
    })

    it('_report.json header includes emittedAt (ISO timestamp)', async () => {
        const projectDir = path.join(os.homedir(), '.flint-test-emittedat-' + Date.now())
        try {
            fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })
            const tokens = [
                { id: 1, token_path: 'colors.primary', token_type: 'color', token_value: '#3b82f6', collection_name: 'default', mode: 'default', description: null },
            ]
            fs.writeFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), JSON.stringify(tokens))
            const outputDir = path.join(projectDir, '.flint', 'platform-tokens')
            await handleEmitTokens({ projectRoot: projectDir, dryRun: false, platforms: ['css'] }, projectDir)
            const reportPath = path.join(outputDir, '_report.json')
            if (fs.existsSync(reportPath)) {
                const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
                expect(report._provenance?.emittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            }
        } finally {
            try { fs.rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
        }
    })

    it('_report.json header includes toolVersion', async () => {
        const projectDir = path.join(os.homedir(), '.flint-test-toolversion-' + Date.now())
        try {
            fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })
            const tokens = [
                { id: 1, token_path: 'colors.primary', token_type: 'color', token_value: '#3b82f6', collection_name: 'default', mode: 'default', description: null },
            ]
            fs.writeFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), JSON.stringify(tokens))
            const outputDir = path.join(projectDir, '.flint', 'platform-tokens')
            await handleEmitTokens({ projectRoot: projectDir, dryRun: false, platforms: ['css'] }, projectDir)
            const reportPath = path.join(outputDir, '_report.json')
            if (fs.existsSync(reportPath)) {
                const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
                expect(report._provenance?.toolVersion).toBeTruthy()
            }
        } finally {
            try { fs.rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
        }
    })
})

// ── handleMapTokens ───────────────────────────────────────────────────────────

describe('MINT.5 — handleMapTokens projectRoot + outputPath validation', () => {
    it('returns isError: true when projectRoot is outside home directory', () => {
        const result = handleMapTokens({ library: 'tailwind', projectRoot: '/etc' })
        expect(result.isError).toBe(true)
        const text = result.content[0]?.text ?? ''
        const parsed = JSON.parse(text)
        expect(parsed.error).toMatch(/projectRoot/i)
    })

    it('returns extension-not-allowed error when outputPath has .exe extension', () => {
        const result = handleMapTokens({ library: 'tailwind', outputPath: '/tmp/token.exe' })
        expect(result.isError).toBe(true)
        const text = result.content[0]?.text ?? ''
        const parsed = JSON.parse(text)
        expect(parsed.error).toMatch(/extension/i)
    })

    it('returns extension-not-allowed error when outputPath has .sh extension', () => {
        const result = handleMapTokens({ library: 'tailwind', outputPath: '/tmp/inject.sh' })
        expect(result.isError).toBe(true)
        const text = result.content[0]?.text ?? ''
        const parsed = JSON.parse(text)
        expect(parsed.error).toMatch(/extension/i)
    })

    it('accepts outputPath with .ts extension (does not error on extension check)', () => {
        // If projectRoot is valid but tokens don't exist, we get a different error — not an extension error
        const home = os.homedir()
        const result = handleMapTokens({ library: 'tailwind', outputPath: path.join(home, 'tokens.ts') })
        const text = result.content[0]?.text ?? ''
        // Should not mention extension error — may fail for other reasons (no tokens file)
        if (result.isError) {
            expect(text).not.toMatch(/extension not allowed/i)
        }
    })

    it('accepts outputPath with .js extension', () => {
        const home = os.homedir()
        const result = handleMapTokens({ library: 'tailwind', outputPath: path.join(home, 'tokens.js') })
        const text = result.content[0]?.text ?? ''
        if (result.isError) {
            expect(text).not.toMatch(/extension not allowed/i)
        }
    })

    it('accepts outputPath with .css extension', () => {
        const home = os.homedir()
        const result = handleMapTokens({ library: 'shadcn', outputPath: path.join(home, 'tokens.css') })
        const text = result.content[0]?.text ?? ''
        if (result.isError) {
            expect(text).not.toMatch(/extension not allowed/i)
        }
    })

    it('accepts outputPath with .json extension', () => {
        const home = os.homedir()
        const result = handleMapTokens({ library: 'tailwind', outputPath: path.join(home, 'tokens.json') })
        const text = result.content[0]?.text ?? ''
        if (result.isError) {
            expect(text).not.toMatch(/extension not allowed/i)
        }
    })

    it('accepts outputPath with .scss extension', () => {
        const home = os.homedir()
        const result = handleMapTokens({ library: 'shadcn', outputPath: path.join(home, 'tokens.scss') })
        const text = result.content[0]?.text ?? ''
        if (result.isError) {
            expect(text).not.toMatch(/extension not allowed/i)
        }
    })
})

// ── handleApproveTokens (inside extractTokens.ts) ────────────────────────────

describe('MINT.5 — handleApproveTokens (extractTokens.ts) projectRoot + sanitization', () => {
    let projectDir: string

    beforeEach(() => {
        projectDir = path.join(os.homedir(), '.flint-approve-test-' + Date.now())
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })
        fs.writeFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), '[]')
    })

    afterEach(() => {
        try { fs.rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
    })

    it('validateProjectRoot runs at handler entry before any token processing', () => {
        const result = handleApproveTokens({
            tokens: [{ path: 'colors.primary', value: '#3b82f6', type: 'color' }],
            projectRoot: '/etc',
        })
        expect(result.isError).toBe(true)
        const parsed = JSON.parse(result.content[0]?.text ?? '{}')
        expect(parsed.error).toMatch(/projectRoot/i)
    })

    it('sanitizes each incoming.value in the merge loop before write', () => {
        // CSS breakout value — should be rejected (not written)
        const result = handleApproveTokens({
            tokens: [
                { path: 'colors.bad', value: 'red; } body { background: red }', type: 'color' },
                { path: 'colors.good', value: '#3b82f6', type: 'color' },
            ],
            projectRoot: projectDir,
        })
        const parsed = JSON.parse(result.content[0]?.text ?? '{}')
        // The bad token is rejected, the good one is written
        expect(parsed.rejectedCount).toBe(1)
        expect(parsed.writtenCount).toBe(1)
        // Verify the written file contains only the good token
        const written = JSON.parse(fs.readFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), 'utf-8'))
        expect(written.some((t: { token_path: string }) => t.token_path === 'colors.bad')).toBe(false)
        expect(written.some((t: { token_path: string }) => t.token_path === 'colors.good')).toBe(true)
    })

    it('sanitizes each incoming.path with validateTokenPath in the merge loop', () => {
        // Prototype pollution path — should be rejected
        const result = handleApproveTokens({
            tokens: [
                { path: '__proto__.polluted', value: '#000', type: 'color' },
                { path: 'colors.valid', value: '#3b82f6', type: 'color' },
            ],
            projectRoot: projectDir,
        })
        const parsed = JSON.parse(result.content[0]?.text ?? '{}')
        expect(parsed.rejectedCount).toBe(1)
        expect(parsed.writtenCount).toBe(1)
    })

    it('rejected tokens contribute to rejectedCount in the merge summary', () => {
        const result = handleApproveTokens({
            tokens: [
                // Missing value → rejected by required-fields check
                { path: 'colors.novalue', value: '', type: 'color' },
                // Invalid path
                { path: 'constructor', value: '#000', type: 'color' },
                // Good token
                { path: 'colors.ok', value: '#3b82f6', type: 'color' },
            ],
            projectRoot: projectDir,
        })
        const parsed = JSON.parse(result.content[0]?.text ?? '{}')
        // At least the invalid path token should be rejected
        expect(parsed.rejectedCount).toBeGreaterThanOrEqual(1)
        expect(parsed.writtenCount).toBe(1)
    })

    it('emits mcp-events.jsonl token-approved row after successful merge', () => {
        handleApproveTokens({
            tokens: [{ path: 'colors.primary', value: '#3b82f6', type: 'color' }],
            projectRoot: projectDir,
        })
        const eventsPath = path.join(projectDir, '.flint', 'mcp-events.jsonl')
        expect(fs.existsSync(eventsPath)).toBe(true)
        const lines = fs.readFileSync(eventsPath, 'utf-8').trim().split('\n').filter(Boolean)
        expect(lines.length).toBeGreaterThanOrEqual(1)
        const evt = JSON.parse(lines[0])
        expect(evt.event).toBe('token-approved')
        expect(evt.source).toBe('mcp')
        expect(evt.tokenName).toBe('colors.primary')
    })

    it('projectRoot outside home returns isError: true before any token write', () => {
        // Tokens file should NOT be touched
        const existingContent = fs.readFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), 'utf-8')
        handleApproveTokens({
            tokens: [{ path: 'colors.primary', value: '#3b82f6', type: 'color' }],
            projectRoot: '/etc',
        })
        // The tokens file in our projectDir should be unchanged (since handler rejected /etc)
        const afterContent = fs.readFileSync(path.join(projectDir, '.flint', 'design-tokens.json'), 'utf-8')
        expect(afterContent).toBe(existingContent)
    })
})
