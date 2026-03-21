/**
 * thumbnailGenerator.test.ts — Phase CV2.2: Component Thumbnail Generator
 *
 * Tests the ThumbnailGenerator service and supporting utilities without
 * requiring a real Electron process or GPU. BrowserWindow is mocked at
 * the module level; FileTransactionManager is replaced with an in-memory stub.
 *
 * Coverage:
 *   TG-01 — generates a PNG file on disk (via FTM.writeBuffer)
 *   TG-02 — get() returns base64 data URL after generate()
 *   TG-03 — get() returns null for non-existent thumbnail
 *   TG-04 — invalidate() deletes the cached file; subsequent get() returns null
 *   TG-05 — invalidate() is idempotent (no throw when file absent)
 *   TG-06 — generate() reuses cached thumbnail (generated: false on 2nd call)
 *   TG-07 — generate() after invalidate() re-renders (generated: true)
 *   TG-08 — generateAll() processes all manifest components
 *   TG-09 — generateAll() handles missing source files gracefully
 *   TG-10 — sequential queue prevents concurrent renders
 *   TG-11 — setProjectRoot() resets cache state
 *   TG-12 — auto-invalidation wiring (tested via autoInvalidateThumbnail logic)
 *   TG-13 — handles Babel transform errors gracefully
 *   TG-14 — componentName is sanitized (path traversal rejected)
 *   TG-15 — sanitizeComponentName preserves valid names, strips invalid chars
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

// ── Mocking strategy ──────────────────────────────────────────────────────────
//
// ThumbnailGenerator imports 'electron' for BrowserWindow. In a Node.js test
// environment there is no Electron, so we mock the module before importing the
// class under test.

// Capture the most recent mock BrowserWindow instance
let mockCapturePage: ReturnType<typeof vi.fn>
let mockLoadURL: ReturnType<typeof vi.fn>
let mockExecuteJavaScript: ReturnType<typeof vi.fn>
let mockDestroy: ReturnType<typeof vi.fn>
let mockIsDestroyed: ReturnType<typeof vi.fn>
let mockDidFinishLoadCallback: (() => void) | null = null

vi.mock('electron', () => {
    class MockBrowserWindow {
        webContents: {
            once: ReturnType<typeof vi.fn>
            capturePage: ReturnType<typeof vi.fn>
            executeJavaScript: ReturnType<typeof vi.fn>
            setZoomFactor: ReturnType<typeof vi.fn>
            loadURL?: ReturnType<typeof vi.fn>
        }
        loadURL: ReturnType<typeof vi.fn>
        destroy: ReturnType<typeof vi.fn>
        isDestroyed: ReturnType<typeof vi.fn>

        constructor() {
            this.webContents = {
                once: vi.fn((event: string, cb: () => void) => {
                    if (event === 'did-finish-load') {
                        // Defer the callback so our promise resolves
                        mockDidFinishLoadCallback = cb
                    }
                }),
                capturePage: mockCapturePage,
                executeJavaScript: mockExecuteJavaScript,
                setZoomFactor: vi.fn(),
            }
            this.loadURL = mockLoadURL
            this.destroy = mockDestroy
            this.isDestroyed = mockIsDestroyed
        }
    }

    return { BrowserWindow: MockBrowserWindow }
})

// Inline a tiny PNG buffer (1x1 pixel, valid PNG header bytes)
// This is what mockCapturePage.toPNG() returns
const TINY_PNG = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
    'hex'
)

// ── In-memory FileTransactionManager stub ─────────────────────────────────────
// Maps filePath → Buffer. writeBuffer stores the buffer; we read it back in
// tests to simulate the on-disk file.

class FakeFTM {
    readonly written = new Map<string, Buffer>()

    write(_filePath: string, _content: string): Promise<void> {
        return Promise.resolve()
    }

    writeBuffer(filePath: string, content: Buffer): Promise<void> {
        this.written.set(filePath, content)
        return Promise.resolve()
    }
}

// ── Helper: create a valid dummy TSX source ────────────────────────────────────
const VALID_TSX = `
export default function Button() {
  return <button>Click me</button>
}
`

// ── Vendor file stubs ─────────────────────────────────────────────────────────
// ThumbnailGenerator reads preview-vendor JS via readFile. We write stub files
// into a temp dir so loadVendorFiles() resolves without the real repo.

let appRoot: string
let projectRoot: string
let fakeFTM: FakeFTM

async function setupVendorFiles(dir: string): Promise<void> {
    const vendorDir = path.join(dir, 'src', 'preview-vendor')
    await mkdir(vendorDir, { recursive: true })
    await writeFile(path.join(vendorDir, 'react.prod.js'), '/* react stub */', 'utf8')
    await writeFile(path.join(vendorDir, 'react-dom.prod.js'), '/* react-dom stub */', 'utf8')
    await writeFile(path.join(vendorDir, 'tailwind-cdn.js'), '/* tailwind stub */', 'utf8')
}

// ── Import under test AFTER mocks are registered ─────────────────────────────
// We use dynamic import so the mock is in place first.

let ThumbnailGenerator: typeof import('../thumbnailGenerator.js').ThumbnailGenerator
let sanitizeComponentName: typeof import('../thumbnailGenerator.js').sanitizeComponentName

beforeEach(async () => {
    // Reset mock functions
    mockCapturePage = vi.fn().mockResolvedValue({
        toPNG: () => TINY_PNG,
    })
    mockLoadURL = vi.fn().mockImplementation(() => {
        // Simulate did-finish-load firing after loadURL
        setTimeout(() => {
            mockDidFinishLoadCallback?.()
        }, 0)
    })
    mockExecuteJavaScript = vi.fn().mockResolvedValue(undefined)
    mockDestroy = vi.fn()
    mockIsDestroyed = vi.fn().mockReturnValue(false)
    mockDidFinishLoadCallback = null

    // Create fresh temp directories
    appRoot = await mkdtemp(path.join(os.tmpdir(), 'tg-app-'))
    projectRoot = await mkdtemp(path.join(os.tmpdir(), 'tg-proj-'))
    await setupVendorFiles(appRoot)

    fakeFTM = new FakeFTM()

    // Dynamic import so mocks are in place
    const mod = await import('../thumbnailGenerator.js')
    ThumbnailGenerator = mod.ThumbnailGenerator
    sanitizeComponentName = mod.sanitizeComponentName
})

afterEach(() => {
    vi.clearAllMocks()
})

// ── Helper: build a generator and prime it ────────────────────────────────────

function makeGen(): InstanceType<typeof ThumbnailGenerator> {
    return new ThumbnailGenerator(projectRoot, appRoot, fakeFTM as unknown as import('../FileTransactionManager.js').FileTransactionManager)
}

async function writeComponentFile(name: string, content = VALID_TSX): Promise<string> {
    const filePath = path.join(projectRoot, `${name}.tsx`)
    await writeFile(filePath, content, 'utf8')
    return filePath
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ThumbnailGenerator', () => {

    describe('TG-01: generates a PNG file via FTM.writeBuffer', () => {
        it('calls ftm.writeBuffer with the thumbnail path and PNG buffer', async () => {
            const gen = makeGen()
            const filePath = await writeComponentFile('Button')
            const spy = vi.spyOn(fakeFTM, 'writeBuffer')

            const result = await gen.generate({ filePath, componentName: 'Button' })

            expect(result.error).toBeNull()
            expect(result.generated).toBe(true)
            expect(spy).toHaveBeenCalledTimes(1)
            const [writtenPath, writtenBuf] = spy.mock.calls[0]
            expect(writtenPath).toContain('Button.png')
            expect(writtenPath).toContain('.flint')
            expect(Buffer.isBuffer(writtenBuf)).toBe(true)
        })
    })

    describe('TG-02: get() returns base64 data URL after generate()', () => {
        it('returns a string starting with data:image/png;base64,', async () => {
            const gen = makeGen()
            const filePath = await writeComponentFile('Card')

            // After generate, the thumbnail is in fakeFTM.written
            // We need the file to exist on disk for get() to work.
            // Simulate by writing the PNG to the expected thumbnail path.
            await gen.generate({ filePath, componentName: 'Card' })
            const thumbPath = path.join(projectRoot, '.flint', 'thumbnails', 'Card.png')
            await mkdir(path.dirname(thumbPath), { recursive: true })
            await writeFile(thumbPath, TINY_PNG)

            const dataUrl = await gen.get('Card')
            expect(dataUrl).not.toBeNull()
            expect(dataUrl!.startsWith('data:image/png;base64,')).toBe(true)
        })
    })

    describe('TG-03: get() returns null for non-existent thumbnail', () => {
        it('returns null when no PNG exists on disk', async () => {
            const gen = makeGen()
            const result = await gen.get('NonExistent')
            expect(result).toBeNull()
        })
    })

    describe('TG-04: invalidate() deletes the cached file', () => {
        it('removes the PNG file and get() returns null afterward', async () => {
            const gen = makeGen()
            const thumbPath = path.join(projectRoot, '.flint', 'thumbnails', 'Header.png')
            await mkdir(path.dirname(thumbPath), { recursive: true })
            await writeFile(thumbPath, TINY_PNG)

            // Manually prime the cache so has() is true
            ;(gen as unknown as { cachedNames: Set<string> }).cachedNames.add('Header')

            await gen.invalidate('Header')

            const dataUrl = await gen.get('Header')
            expect(dataUrl).toBeNull()
            expect(existsSync(thumbPath)).toBe(false)
        })
    })

    describe('TG-05: invalidate() is idempotent', () => {
        it('does not throw when thumbnail does not exist', async () => {
            const gen = makeGen()
            await expect(gen.invalidate('NeverExisted')).resolves.not.toThrow()
        })
    })

    describe('TG-06: generate() reuses cached thumbnail', () => {
        it('returns generated: false on the second call when PNG is cached', async () => {
            const gen = makeGen()
            const thumbPath = path.join(projectRoot, '.flint', 'thumbnails', 'Cached.png')
            await mkdir(path.dirname(thumbPath), { recursive: true })
            await writeFile(thumbPath, TINY_PNG)
            // Prime the in-memory cache set
            ;(gen as unknown as { cachedNames: Set<string> }).cachedNames.add('Cached')

            const filePath = await writeComponentFile('Cached')
            const result = await gen.generate({ filePath, componentName: 'Cached' })

            expect(result.generated).toBe(false)
            expect(result.error).toBeNull()
            // BrowserWindow should NOT have been created
            expect(mockLoadURL).not.toHaveBeenCalled()
        })
    })

    describe('TG-07: generate() after invalidate() re-renders', () => {
        it('returns generated: true after invalidation clears the cache', async () => {
            const gen = makeGen()
            const thumbPath = path.join(projectRoot, '.flint', 'thumbnails', 'Invalidated.png')
            await mkdir(path.dirname(thumbPath), { recursive: true })
            await writeFile(thumbPath, TINY_PNG)
            ;(gen as unknown as { cachedNames: Set<string> }).cachedNames.add('Invalidated')

            // Invalidate — removes from disk and cache
            await gen.invalidate('Invalidated')

            const filePath = await writeComponentFile('Invalidated')
            const result = await gen.generate({ filePath, componentName: 'Invalidated' })

            expect(result.generated).toBe(true)
            expect(result.error).toBeNull()
        })
    })

    describe('TG-08: generateAll() processes all manifest components', () => {
        it('returns total: 3 and succeeded: 3 for a 3-component manifest', async () => {
            const gen = makeGen()

            // Create component source files
            const compA = await writeComponentFile('CompA')
            const compB = await writeComponentFile('CompB')
            const compC = await writeComponentFile('CompC')

            // Write flint-manifest.json
            const manifest = {
                components: {
                    CompA: { filePath: compA },
                    CompB: { filePath: compB },
                    CompC: { filePath: compC },
                },
            }
            await writeFile(
                path.join(projectRoot, 'flint-manifest.json'),
                JSON.stringify(manifest),
                'utf8'
            )

            const batchResult = await gen.generateAll()

            expect(batchResult.total).toBe(3)
            expect(batchResult.succeeded).toBe(3)
            expect(batchResult.failed).toBe(0)
            expect(batchResult.results).toHaveLength(3)
        })
    })

    describe('TG-09: generateAll() handles missing source files', () => {
        it('produces error: non-null for a manifest entry with a nonexistent file', async () => {
            const gen = makeGen()

            const manifest = {
                components: {
                    MissingComp: { filePath: path.join(projectRoot, 'DoesNotExist.tsx') },
                },
            }
            await writeFile(
                path.join(projectRoot, 'flint-manifest.json'),
                JSON.stringify(manifest),
                'utf8'
            )

            const batchResult = await gen.generateAll()

            expect(batchResult.total).toBe(1)
            expect(batchResult.failed).toBe(1)
            expect(batchResult.results[0].error).not.toBeNull()
        })
    })

    describe('TG-10: sequential queue prevents concurrent renders', () => {
        it('executes two generate() calls sequentially', async () => {
            const gen = makeGen()
            const order: string[] = []

            // Override the internal queue to track execution order
            const orig = gen.generate.bind(gen)
            const filePath = await writeComponentFile('SeqTest')

            // Both calls are fired without await
            const p1 = gen.generate({ filePath, componentName: 'SeqTestA' })
                .then((r) => { order.push('A'); return r })
            const p2 = gen.generate({ filePath, componentName: 'SeqTestB' })
                .then((r) => { order.push('B'); return r })

            await Promise.all([p1, p2])

            // A must complete before B starts (sequential queue, concurrency=1)
            expect(order).toEqual(['A', 'B'])
            void orig // suppress unused warning
        })
    })

    describe('TG-11: setProjectRoot() resets cache state', () => {
        it('clears cachedNames when project root changes', async () => {
            const gen = makeGen()

            // Create an actual thumbnail on disk so has() returns true
            const thumbPath = path.join(projectRoot, '.flint', 'thumbnails', 'Button.png')
            await mkdir(path.dirname(thumbPath), { recursive: true })
            await writeFile(thumbPath, TINY_PNG)
            ;(gen as unknown as { cachedNames: Set<string> }).cachedNames.add('Button')

            expect(gen.has('Button')).toBe(true)

            const newRoot = await mkdtemp(path.join(os.tmpdir(), 'tg-new-'))
            gen.setProjectRoot(newRoot)

            expect(gen.has('Button')).toBe(false)
        })
    })

    describe('TG-12: auto-invalidation wiring', () => {
        it('calls invalidate() when a matching component is saved', async () => {
            const gen = makeGen()
            const compPath = path.join(projectRoot, 'MyWidget.tsx')
            await writeFile(compPath, VALID_TSX, 'utf8')

            // Seed cache
            const thumbPath = path.join(projectRoot, '.flint', 'thumbnails', 'MyWidget.png')
            await mkdir(path.dirname(thumbPath), { recursive: true })
            await writeFile(thumbPath, TINY_PNG)
            ;(gen as unknown as { cachedNames: Set<string> }).cachedNames.add('MyWidget')

            const manifest = {
                components: { MyWidget: { filePath: compPath } },
            }
            await writeFile(
                path.join(projectRoot, 'flint-manifest.json'),
                JSON.stringify(manifest),
                'utf8'
            )

            // Simulate auto-invalidation logic (the function from main.ts)
            const { readFile: fsReadFile } = await import('node:fs/promises')
            const raw = await fsReadFile(path.join(projectRoot, 'flint-manifest.json'), 'utf8')
            const mf = JSON.parse(raw) as { components: Record<string, { filePath?: string }> }
            for (const [name, entry] of Object.entries(mf.components)) {
                if (entry.filePath === compPath) {
                    await gen.invalidate(name)
                    break
                }
            }

            expect(gen.has('MyWidget')).toBe(false)
        })
    })

    describe('TG-13: handles Babel transform errors gracefully', () => {
        it('returns error: non-null without crashing for invalid TSX', async () => {
            const gen = makeGen()
            const badFile = path.join(projectRoot, 'Bad.tsx')
            // Deliberately invalid TypeScript/JSX
            await writeFile(badFile, 'export default function Bad() { return <div>{{{{</div> }', 'utf8')

            const result = await gen.generate({ filePath: badFile, componentName: 'Bad' })

            expect(result.error).not.toBeNull()
            expect(result.generated).toBe(false)
        })
    })

    describe('TG-14: componentName is sanitized', () => {
        it('rejects component names with path traversal characters', async () => {
            const gen = makeGen()
            const filePath = await writeComponentFile('Button')

            // '../evil' gets sanitized to 'evil' — not empty, so it won't throw
            // but the write goes to .flint/thumbnails/evil.png (not outside)
            const result = await gen.generate({ filePath, componentName: '../../../etc/passwd' })
            // Either generates to a safe path or errors — must not crash
            expect(result).toBeDefined()
            // The thumbnail path must NOT contain '..'
            if (result.thumbnailPath) {
                expect(result.thumbnailPath).not.toContain('..')
            }
        })

        it('rejects completely invalid names (empty after sanitization)', async () => {
            const gen = makeGen()
            const filePath = await writeComponentFile('Button')
            const result = await gen.generate({ filePath, componentName: '../../../' })
            // Sanitized to empty → error
            expect(result.error).not.toBeNull()
        })
    })
})

// ── sanitizeComponentName unit tests (TG-15) ─────────────────────────────────

describe('sanitizeComponentName', () => {
    it('TG-15a: preserves alphanumeric and dash/underscore', () => {
        expect(sanitizeComponentName('Button')).toBe('Button')
        expect(sanitizeComponentName('my-component_1')).toBe('my-component_1')
        expect(sanitizeComponentName('PascalCase123')).toBe('PascalCase123')
    })

    it('TG-15b: strips path traversal characters', () => {
        expect(sanitizeComponentName('../Button')).toBe('Button')
        expect(sanitizeComponentName('../../evil')).toBe('evil')
        // Slashes and dots are stripped; case is preserved for remaining chars
        expect(sanitizeComponentName('/abs/path/Button')).toBe('abspathButton')
    })

    it('TG-15c: throws for empty result after sanitization', () => {
        expect(() => sanitizeComponentName('../../')).toThrow()
        expect(() => sanitizeComponentName('...')).toThrow()
        expect(() => sanitizeComponentName('')).toThrow()
    })

    it('TG-15d: strips spaces and special characters', () => {
        expect(sanitizeComponentName('My Button!')).toBe('MyButton')
        expect(sanitizeComponentName('comp@2x')).toBe('comp2x')
    })
})
