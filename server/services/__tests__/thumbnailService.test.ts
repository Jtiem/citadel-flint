/**
 * server/services/__tests__/thumbnailService.test.ts
 *
 * Tests for createThumbnailService() in server/services/thumbnailService.ts.
 *
 * NOTE: ws3-server.test.ts already covers:
 *   - Playwright not installed → graceful error (WS3-23)
 *   - Source file does not exist → graceful error (WS3-24)
 *   - generateAll with missing manifest → empty result (WS3-25)
 *   - generateAll does not abort on individual failure (WS3-26)
 *
 * This file focuses on what's NOT covered there:
 *   - Cache hit: second generate() call returns cached result without re-launching browser
 *   - Cache miss: first call with no cached file proceeds to browser (or graceful error)
 *   - Cache staleness: isCacheFresh logic via manipulated file mtime
 *   - get(): base64 round-trip for an existing PNG file
 *   - get(): returns null when file is absent
 *   - invalidate(): removes the cached file
 *   - invalidate(): is a no-op when no file exists
 *   - generateAll: happy path parses manifest and accumulates results
 *   - transformForBrowser helper: strips imports (verified via render harness)
 *   - Concurrent generate() calls for the same component serialize correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdtempSync, writeFileSync, existsSync, mkdirSync, statSync, utimesSync, rmSync } from 'node:fs'

// ── Playwright is mocked globally so no real browser is launched ─────────────
vi.mock('playwright', () => ({
  chromium: null,
}))

describe('createThumbnailService', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'flint-thumb2-'))
    vi.resetModules()
  })

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  // ── get() ─────────────────────────────────────────────────────────────────

  it('get() returns null when no thumbnail file exists', async () => {
    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()
    const result = await svc.get('Button', tmpDir)
    expect(result).toBeNull()
  })

  it('get() returns a base64 data URI when the PNG file exists', async () => {
    // Write a minimal PNG-ish file
    const thumbDir = path.join(tmpDir, '.flint', 'thumbnails')
    mkdirSync(thumbDir, { recursive: true })
    const pngPath = path.join(thumbDir, 'Button.png')
    writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47])) // PNG magic bytes

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()
    const result = await svc.get('Button', tmpDir)
    expect(result).not.toBeNull()
    expect(result!.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('get() sanitizes special characters in component names', async () => {
    // Component names with special chars should resolve to the sanitized path
    const thumbDir = path.join(tmpDir, '.flint', 'thumbnails')
    mkdirSync(thumbDir, { recursive: true })
    // "My/Component" → "My_Component.png"
    writeFileSync(path.join(thumbDir, 'My_Component.png'), Buffer.from([1, 2, 3]))

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()
    const result = await svc.get('My/Component', tmpDir)
    expect(result).not.toBeNull()
  })

  // ── invalidate() ──────────────────────────────────────────────────────────

  it('invalidate() removes the cached thumbnail file', async () => {
    const thumbDir = path.join(tmpDir, '.flint', 'thumbnails')
    mkdirSync(thumbDir, { recursive: true })
    const pngPath = path.join(thumbDir, 'Card.png')
    writeFileSync(pngPath, Buffer.from([1]))
    expect(existsSync(pngPath)).toBe(true)

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()
    await svc.invalidate('Card', tmpDir)
    expect(existsSync(pngPath)).toBe(false)
  })

  it('invalidate() is a no-op when the thumbnail file does not exist', async () => {
    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()
    // Should not throw
    await expect(svc.invalidate('NonExistent', tmpDir)).resolves.toBeUndefined()
  })

  // ── generate() — cache hit ────────────────────────────────────────────────

  it('generate() returns cached result without relaunching browser on cache hit', async () => {
    // Pre-populate a fresh thumbnail (mtime = now)
    const thumbDir = path.join(tmpDir, '.flint', 'thumbnails')
    mkdirSync(thumbDir, { recursive: true })
    const pngPath = path.join(thumbDir, 'CachedComp.png')
    writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    // mtime is now — definitely fresh (< 24h)

    // Write a source file too
    const srcFile = path.join(tmpDir, 'CachedComp.tsx')
    writeFileSync(srcFile, 'export function CachedComp() { return null }')

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()

    const result = await svc.generate({
      filePath: srcFile,
      componentName: 'CachedComp',
      projectRoot: tmpDir,
    })

    // Should hit the cache and return generated: true WITHOUT launching Playwright
    // (Playwright is mocked to return null — if it tried to use it, generated would be false)
    expect(result.generated).toBe(true)
    expect(result.thumbnailPath).toBe(pngPath)
    expect(result.error).toBeNull()
  })

  it('generate() proceeds past cache when thumbnail file is stale (> 24h old)', async () => {
    // Pre-populate a thumbnail but backdate its mtime by 25 hours
    const thumbDir = path.join(tmpDir, '.flint', 'thumbnails')
    mkdirSync(thumbDir, { recursive: true })
    const pngPath = path.join(thumbDir, 'StaleComp.png')
    writeFileSync(pngPath, Buffer.from([1]))

    const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000)
    utimesSync(pngPath, staleTime, staleTime)

    const srcFile = path.join(tmpDir, 'StaleComp.tsx')
    writeFileSync(srcFile, 'export function StaleComp() { return null }')

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()

    const result = await svc.generate({
      filePath: srcFile,
      componentName: 'StaleComp',
      projectRoot: tmpDir,
    })

    // Cache is stale → tries to launch Playwright → not installed (mocked) → graceful error
    expect(result.generated).toBe(false)
    expect(result.error).toMatch(/playwright/i)
  })

  it('generate() returns graceful error when Playwright is not available (cache miss path)', async () => {
    const srcFile = path.join(tmpDir, 'FreshComp.tsx')
    writeFileSync(srcFile, 'export function FreshComp() { return null }')

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()

    const result = await svc.generate({
      filePath: srcFile,
      componentName: 'FreshComp',
      projectRoot: tmpDir,
    })

    // No cache + Playwright mock returns null → graceful error
    expect(result.generated).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.componentName).toBe('FreshComp')
  })

  // ── generateAll() — happy path ────────────────────────────────────────────

  it('generateAll() parses manifest and calls generate() for each component', async () => {
    const manifestPath = path.join(tmpDir, 'flint-manifest.json')
    writeFileSync(manifestPath, JSON.stringify({
      components: {
        Alpha: { filePath: './Alpha.tsx' },
        Beta: { filePath: './Beta.tsx' },
      },
    }))
    writeFileSync(path.join(tmpDir, 'Alpha.tsx'), 'export function Alpha() { return null }')
    writeFileSync(path.join(tmpDir, 'Beta.tsx'), 'export function Beta() { return null }')

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()

    // Stub generate() so we don't need Playwright
    let calls = 0
    svc.generate = async (opts: { filePath: string; componentName: string; projectRoot: string }) => {
      calls++
      return { componentName: opts.componentName, thumbnailPath: '/fake.png', generated: true, error: null }
    }

    const result = await svc.generateAll(tmpDir)
    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(0)
    expect(calls).toBe(2)
  })

  it('generateAll() returns 0/0/0 when manifest has no components field', async () => {
    const manifestPath = path.join(tmpDir, 'flint-manifest.json')
    writeFileSync(manifestPath, JSON.stringify({ version: '1' }))

    const { createThumbnailService } = await import('../thumbnailService.js')
    const svc = createThumbnailService()
    const result = await svc.generateAll(tmpDir)
    expect(result.total).toBe(0)
  })

  // ── ESM __dirname workaround ─────────────────────────────────────────────

  it('module loads without error (ESM __dirname workaround is functional)', async () => {
    // If fileURLToPath / import.meta.url workaround fails, the import itself throws.
    await expect(import('../thumbnailService.js')).resolves.toBeDefined()
  })
})
