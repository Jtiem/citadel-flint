/**
 * server/services/__tests__/previewServer.test.ts
 *
 * Regression tests for the start/stop loop bug.
 *
 * Root cause: `previewServer.start()` called `this.stop()` whenever viteServer
 * was non-null, even when called with the same projectRoot that was already
 * running. This caused an indefinite restart loop when LivePreview.tsx called
 * start() on re-mount or React Strict Mode double-invoke.
 *
 * Fix: idempotency guard in start() — if viteServer is alive and activeRoot
 * matches the requested projectRoot, return the existing URL immediately.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'

// ── Minimal Vite server mock ───────────────────────────────────────────────

function makeMockViteServer(port = 54321) {
  const server = {
    _closed: false,
    listen: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockImplementation(async function (this: typeof server) {
      this._closed = true
    }),
    config: { server: { port } },
    resolvedUrls: {
      local: [`http://127.0.0.1:${port}/`],
      network: [],
    },
    httpServer: null as null,
  }
  return server
}

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}))

// We need to intercept the dynamic import('vite') inside createPreviewServer.
// vitest can mock dynamic imports via vi.mock with a factory.
let mockViteServer = makeMockViteServer()

vi.mock('vite', () => ({
  createServer: vi.fn().mockImplementation(async () => {
    // Return a fresh reference to the current mockViteServer.
    // The test can swap mockViteServer between calls to simulate different servers.
    return mockViteServer
  }),
}))

// ── Helper ─────────────────────────────────────────────────────────────────

// createPreviewServer is an ESM module. Re-import fresh for each test group
// by re-requiring it via a module-level import.
import { createPreviewServer } from '../previewServer.js'

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createPreviewServer — idempotency guard', () => {
  const ROOT = '/fake/project'

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock server to a fresh instance for each test
    mockViteServer = makeMockViteServer()
  })

  it('starts the server and returns a url on first call', async () => {
    const preview = createPreviewServer()
    const result = await preview.start(ROOT)

    expect(result).toEqual({ url: 'http://127.0.0.1:54321/' })
    expect(mockViteServer.listen).toHaveBeenCalledTimes(1)
    expect(mockViteServer.close).not.toHaveBeenCalled()
  })

  it('returns existing url without restarting on second call with same root (idempotency guard)', async () => {
    const preview = createPreviewServer()

    // First call — starts server
    const first = await preview.start(ROOT)
    expect(first).toEqual({ url: 'http://127.0.0.1:54321/' })
    expect(mockViteServer.listen).toHaveBeenCalledTimes(1)

    // Second call with same root — must NOT stop/restart
    const second = await preview.start(ROOT)
    expect(second).toEqual({ url: 'http://127.0.0.1:54321/' })

    // listen should still only have been called once — no restart
    expect(mockViteServer.listen).toHaveBeenCalledTimes(1)
    expect(mockViteServer.close).not.toHaveBeenCalled()
  })

  it('stops old server and starts new one when projectRoot changes', async () => {
    const preview = createPreviewServer()
    const firstServer = mockViteServer

    await preview.start(ROOT)
    expect(firstServer.listen).toHaveBeenCalledTimes(1)

    // Swap in a new mock server for the second root
    const secondServer = makeMockViteServer(54322)
    mockViteServer = secondServer

    const result = await preview.start('/different/project')
    expect(result).toEqual({ url: 'http://127.0.0.1:54322/' })

    // Old server must have been stopped
    expect(firstServer.close).toHaveBeenCalledTimes(1)
    // New server must have been started
    expect(secondServer.listen).toHaveBeenCalledTimes(1)
  })

  it('getUrl returns null before any start call', () => {
    const preview = createPreviewServer()
    expect(preview.getUrl()).toBeNull()
  })

  it('getUrl returns the active url after start', async () => {
    const preview = createPreviewServer()
    await preview.start(ROOT)
    expect(preview.getUrl()).toBe('http://127.0.0.1:54321/')
  })

  it('getUrl returns null after stop', async () => {
    const preview = createPreviewServer()
    await preview.start(ROOT)
    await preview.stop()
    expect(preview.getUrl()).toBeNull()
  })

  it('stop is a no-op when server is not running', async () => {
    const preview = createPreviewServer()
    // Should not throw
    await expect(preview.stop()).resolves.toBeUndefined()
    expect(mockViteServer.close).not.toHaveBeenCalled()
  })

  it('restarting after stop calls listen again (not idempotent after stop)', async () => {
    const preview = createPreviewServer()
    const firstServer = mockViteServer

    await preview.start(ROOT)
    await preview.stop()
    expect(firstServer.close).toHaveBeenCalledTimes(1)

    // After stop, a new server must be started on the next start() call
    const secondServer = makeMockViteServer()
    mockViteServer = secondServer

    const result = await preview.start(ROOT)
    expect(result).toEqual({ url: 'http://127.0.0.1:54321/' })
    expect(secondServer.listen).toHaveBeenCalledTimes(1)
  })

  it('returns error when projectRoot does not exist', async () => {
    vi.mocked(existsSync).mockReturnValueOnce(false)

    const preview = createPreviewServer()
    const result = await preview.start('/nonexistent')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toContain('does not exist')
  })
})
