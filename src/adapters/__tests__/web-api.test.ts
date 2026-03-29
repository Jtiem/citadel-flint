/**
 * web-api.test.ts — src/adapters/__tests__/web-api.test.ts
 *
 * Tests for WS3 client-side gaps in the web adapter:
 *   WA-01 — openFolder() dispatches flint:open-folder-request and returns a pending Promise
 *   WA-02 — resolveWebOpenFolder() calls project:openPath IPC and resolves the deferred promise
 *   WA-03 — resolveWebOpenFolder() resolves with null when project:openPath throws
 *   WA-04 — cancelWebOpenFolder() resolves the deferred promise with null
 *   WA-05 — hasWebOpenFolderPending() returns true while pending, false otherwise
 *   WA-06 — openFolder() cancels any previous pending promise before creating a new one
 *   WA-07 — thumbnails.get routes through POST /api/ipc with correct channel
 *   WA-08 — thumbnails.get returns base64 data URL string from server response
 *   WA-09 — thumbnails.get returns null gracefully when server returns null (404/miss)
 *   WA-10 — thumbnails.get returns null gracefully when fetch throws
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resolveWebOpenFolder,
  cancelWebOpenFolder,
  hasWebOpenFolderPending,
  createWebFlintAPI,
} from '../web-api'

// ── fetch mock ────────────────────────────────────────────────────────────────

function mockFetchResponse(result: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result }),
  } as Response)
}

function mockFetchError(message: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ result: null }),
  } as Response)
}

// ── WebSocket mock (prevent real connection attempts in jsdom) ────────────────

class MockWebSocket {
  readyState = 1 // OPEN
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  send() {}
  close() {}
}

beforeEach(() => {
  // Prevent WebSocket from trying to connect to a real server
  ;(globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocket
})

afterEach(() => {
  vi.restoreAllMocks()
  // Cancel any pending open-folder promise to avoid test leakage
  cancelWebOpenFolder()
})

// ── WA-01: openFolder dispatches event and returns pending promise ─────────────

describe('openFolder() — web-mode signal', () => {
  it('WA-01: dispatches flint:open-folder-request custom event on window', () => {
    const api = createWebFlintAPI()
    const listener = vi.fn()
    window.addEventListener('flint:open-folder-request', listener)

    // Intentionally not awaiting — we just want to check the event fires
    void api.openFolder()

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener('flint:open-folder-request', listener)
  })

  it('WA-01b: openFolder() returns a Promise (not null immediately)', () => {
    const api = createWebFlintAPI()
    const result = api.openFolder()
    expect(result).toBeInstanceOf(Promise)
  })

  it('WA-01c: the returned Promise does not resolve until resolveWebOpenFolder is called', async () => {
    const api = createWebFlintAPI()
    let settled = false
    const promise = api.openFolder().then(() => { settled = true })

    // Flush microtasks — promise should still be pending
    await Promise.resolve()
    expect(settled).toBe(false)

    // Now cancel so the promise resolves and we don't leak
    cancelWebOpenFolder()
    await promise
  })
})

// ── WA-02 / WA-03: resolveWebOpenFolder calls project:openPath ────────────────

describe('resolveWebOpenFolder()', () => {
  it('WA-02: calls POST /api/ipc with channel=project:openPath and resolves the promise with the tree', async () => {
    const tree = { name: 'my-app', path: '/Users/dev/my-app', type: 'directory' as const, children: [] }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: tree }),
    } as Response)
    globalThis.fetch = fetchMock

    const api = createWebFlintAPI()
    const promise = api.openFolder()

    await resolveWebOpenFolder('/Users/dev/my-app')
    const result = await promise

    expect(fetchMock).toHaveBeenCalledWith('/api/ipc', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"project:openPath"'),
    }))
    expect(result).toEqual(tree)
  })

  it('WA-03: resolves with null when project:openPath throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
    globalThis.fetch = fetchMock

    const api = createWebFlintAPI()
    const promise = api.openFolder()

    await resolveWebOpenFolder('/bad/path')
    const result = await promise

    expect(result).toBeNull()
  })

  it('WA-03b: resolveWebOpenFolder is a no-op when no promise is pending', async () => {
    // No openFolder() call before resolveWebOpenFolder — should not throw
    await expect(resolveWebOpenFolder('/any/path')).resolves.toBeUndefined()
  })
})

// ── WA-04: cancelWebOpenFolder resolves with null ─────────────────────────────

describe('cancelWebOpenFolder()', () => {
  it('WA-04: resolves the pending promise with null', async () => {
    const api = createWebFlintAPI()
    const promise = api.openFolder()

    cancelWebOpenFolder()
    const result = await promise

    expect(result).toBeNull()
  })

  it('WA-04b: cancelWebOpenFolder is a no-op when no promise is pending', () => {
    expect(() => cancelWebOpenFolder()).not.toThrow()
  })
})

// ── WA-05: hasWebOpenFolderPending ────────────────────────────────────────────

describe('hasWebOpenFolderPending()', () => {
  it('WA-05: returns false when no openFolder() is pending', () => {
    expect(hasWebOpenFolderPending()).toBe(false)
  })

  it('WA-05b: returns true immediately after openFolder() is called', () => {
    const api = createWebFlintAPI()
    void api.openFolder()
    expect(hasWebOpenFolderPending()).toBe(true)
  })

  it('WA-05c: returns false after cancelWebOpenFolder is called', () => {
    const api = createWebFlintAPI()
    void api.openFolder()
    cancelWebOpenFolder()
    expect(hasWebOpenFolderPending()).toBe(false)
  })

  it('WA-05d: returns false after resolveWebOpenFolder resolves the promise', async () => {
    const tree = { name: 'proj', path: '/p', type: 'directory' as const }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: tree }),
    } as Response)

    const api = createWebFlintAPI()
    const promise = api.openFolder()

    await resolveWebOpenFolder('/p')
    await promise

    expect(hasWebOpenFolderPending()).toBe(false)
  })
})

// ── WA-06: second openFolder() cancels the first ──────────────────────────────

describe('openFolder() — sequential calls', () => {
  it('WA-06: calling openFolder() a second time cancels the first pending promise with null', async () => {
    const api = createWebFlintAPI()
    const first = api.openFolder()

    // Second call should cancel first
    const _second = api.openFolder()

    const firstResult = await first
    expect(firstResult).toBeNull()

    // Clean up second
    cancelWebOpenFolder()
    await _second
  })
})

// ── WA-07 / WA-08 / WA-09: thumbnails adapter ─────────────────────────────────

describe('thumbnails.get() — web adapter', () => {
  it('WA-07: calls POST /api/ipc with channel=thumbnails:get and the componentName as arg', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: null }),
    } as Response)
    globalThis.fetch = fetchMock

    const api = createWebFlintAPI()
    await api.thumbnails.get('Button')

    expect(fetchMock).toHaveBeenCalledWith('/api/ipc', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"thumbnails:get"'),
    }))

    // The args array should include the component name
    const call = fetchMock.mock.calls[0]
    const body = JSON.parse(call[1].body as string) as { channel: string; args: string[] }
    expect(body.channel).toBe('thumbnails:get')
    expect(body.args).toEqual(['Button'])
  })

  it('WA-08: returns the base64 data URL string when the server responds with one', async () => {
    const dataUrl = 'data:image/png;base64,abc123=='
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: dataUrl }),
    } as Response)

    const api = createWebFlintAPI()
    const result = await api.thumbnails.get('MyCard')

    expect(result).toBe(dataUrl)
  })

  it('WA-09: returns null when the server responds with null (cache miss / 404)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: null }),
    } as Response)

    const api = createWebFlintAPI()
    const result = await api.thumbnails.get('Unknown')

    expect(result).toBeNull()
  })

  it('WA-10: throws when the HTTP call fails (server error)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    const api = createWebFlintAPI()
    await expect(api.thumbnails.get('Broken')).rejects.toThrow('IPC call failed')
  })
})
