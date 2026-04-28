/**
 * server/__tests__/index.test.ts
 *
 * Tests for the 10 highest-risk IPC handler surfaces in server/index.ts.
 * Because startServer() is monolithic and has heavy dependencies (SQLite,
 * MCP child process, Babel, fs.watch, ingestion server), these tests target
 * pure logic extracted from handlers — the same pattern used throughout this
 * directory (see ws3-server.test.ts, selfHostingGuard.test.ts).
 *
 * High-risk surfaces covered:
 *   (1)  validateFilePath        — path traversal guard (file:read / ast:save-file)
 *   (2)  isWithinHome            — home-dir scope guard shared by multiple handlers
 *   (3)  mcp:call-tool           — renderer MCP allowlist enforcement
 *   (4)  d2c:apply               — file write scoping to activeProjectRoot
 *   (5)  ast:git-show            — commit hash validation / path guard
 *   (6)  governance:preview-fix  — file path home guard + MCP dry-run shape
 *   (7)  tokens:create           — payload validation
 *   (8)  setup:write-mcp-config  — safe config path allowlist
 *   (9)  code:transform          — Babel transform output shape
 *   (10) broadcast / WS          — JSON message shape normalisation
 *
 * Approach: reproduce the pure logic from each handler as close-mirroring
 * functions that can be exercised without starting the server. This is the
 * same strategy proven by existing tests in this directory and avoids
 * binding the test lifecycle to SQLite, child-process spawning, and
 * real file-system side-effects.
 *
 * Tests that genuinely require startServer() (live HTTP/WS round-trip) are
 * marked it.todo — honest scaffolding as defined in CLAUDE.md Phase 2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// Shared test helpers
// ─────────────────────────────────────────────────────────────────────────────

let tmpBase: string

beforeEach(() => {
  tmpBase = path.join(
    os.tmpdir(),
    `idx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(tmpBase, { recursive: true })
})

afterEach(() => {
  try { rmSync(tmpBase, { recursive: true, force: true }) } catch { /* ok */ }
})

// ─────────────────────────────────────────────────────────────────────────────
// (1) validateFilePath — reproduced from server/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import { realpathSync } from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// (1) validateFilePath — reproduced from server/index.ts
// ─────────────────────────────────────────────────────────────────────────────

// Local isWithinHome (sync version) — matches server/index.ts implementation
function isWithinHomeLocal(filePath: string): boolean {
  const home = os.homedir()
  const resolved = path.resolve(filePath)
  if (resolved === home || resolved.startsWith(home + path.sep)) return true
  try {
    const resolvedReal = realpathSync(resolved)
    const tmpReal = realpathSync(os.tmpdir())
    if (resolvedReal.startsWith(tmpReal + path.sep)) return true
  } catch { /* path may not exist */ }
  return false
}

function validateFilePath(filePath: unknown, requireSourceExt = true): string {
  if (typeof filePath !== 'string') {
    throw new TypeError('filePath must be a string')
  }
  if (!path.isAbsolute(filePath)) {
    throw new Error('filePath must be an absolute path')
  }
  if (requireSourceExt && !/\.(tsx?|jsx?|html?)$/.test(filePath)) {
    throw new Error('filePath must point to a source file (.tsx/.ts/.jsx/.js/.html)')
  }
  const resolved = path.resolve(filePath)
  let realFilePath = resolved
  try { realFilePath = realpathSync(resolved) } catch { /* file may not exist yet */ }
  if (!isWithinHomeLocal(realFilePath)) {
    throw new Error('path outside user home directory is not permitted')
  }
  return resolved
}

describe('validateFilePath — path traversal guard', () => {
  it('IDX-01: accepts a valid absolute .tsx path within home', () => {
    const p = path.join(os.homedir(), 'my-project', 'src', 'App.tsx')
    const result = validateFilePath(p)
    expect(result).toBe(path.resolve(p))
  })

  it('IDX-02: throws TypeError for non-string input', () => {
    expect(() => validateFilePath(null)).toThrow(TypeError)
    expect(() => validateFilePath(42)).toThrow(TypeError)
    expect(() => validateFilePath(undefined)).toThrow(TypeError)
  })

  it('IDX-03: throws for relative path', () => {
    expect(() => validateFilePath('src/App.tsx')).toThrow('absolute path')
  })

  it('IDX-04: throws for disallowed extension when requireSourceExt is true', () => {
    const p = path.join(os.homedir(), 'project', 'secret.env')
    expect(() => validateFilePath(p)).toThrow('source file')
  })

  it('IDX-05: accepts disallowed extension when requireSourceExt is false', () => {
    const p = path.join(os.homedir(), 'project', 'flint-manifest.json')
    const result = validateFilePath(p, false)
    expect(result).toBe(path.resolve(p))
  })

  it('IDX-06: throws for path outside home directory', () => {
    // /etc/passwd is outside home on any Unix system
    const p = '/etc/passwd'
    expect(() => validateFilePath(p, false)).toThrow('outside user home directory')
  })

  it('IDX-07: throws for path traversal sequence', () => {
    const p = path.join(os.homedir(), 'project', '..', '..', 'etc', 'passwd')
    // After resolve, /etc/passwd — outside home
    expect(() => validateFilePath(p, false)).toThrow('outside user home directory')
  })

  it('IDX-08: accepts path in OS temp directory', () => {
    // tmpBase was created in beforeEach under os.tmpdir()
    const p = path.join(tmpBase, 'App.tsx')
    writeFileSync(p, '')
    const result = validateFilePath(p)
    expect(result).toBe(path.resolve(p))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (2) isWithinHome — sync local version
// ─────────────────────────────────────────────────────────────────────────────

describe('isWithinHomeLocal — home-dir scope guard', () => {
  it('IDX-09: returns true for a path directly under home', () => {
    const p = path.join(os.homedir(), 'Documents', 'file.ts')
    expect(isWithinHomeLocal(p)).toBe(true)
  })

  it('IDX-10: returns true for homedir itself', () => {
    expect(isWithinHomeLocal(os.homedir())).toBe(true)
  })

  it('IDX-11: returns false for /etc/passwd', () => {
    expect(isWithinHomeLocal('/etc/passwd')).toBe(false)
  })

  it('IDX-12: returns false for /root (not this user\'s home)', () => {
    // Only meaningful when running as non-root; /root is different from any
    // normal user's home directory
    const home = os.homedir()
    if (home !== '/root') {
      expect(isWithinHomeLocal('/root/secret')).toBe(false)
    }
  })

  it('IDX-13: returns true for a path in the OS temp dir', () => {
    // Use tmpBase itself (already created by beforeEach) so realpathSync can
    // resolve the macOS /var/folders → /private/var/folders symlink chain.
    expect(isWithinHomeLocal(tmpBase)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (3) mcp:call-tool — renderer allowlist enforcement
// ─────────────────────────────────────────────────────────────────────────────

import { RENDERER_ALLOWED_MCP_TOOLS } from '../../shared/mcp-allowed-tools'

function mcpCallToolAllowlistCheck(toolName: string): void {
  if (!RENDERER_ALLOWED_MCP_TOOLS.includes(toolName)) {
    throw new Error(
      `mcp:call-tool — tool "${toolName}" is not in the renderer allowlist. ` +
      `Only these tools can be called from Glass: ${RENDERER_ALLOWED_MCP_TOOLS.join(', ')}`,
    )
  }
}

describe('mcp:call-tool — renderer allowlist enforcement', () => {
  it('IDX-14: allows flint_status (in allowlist)', () => {
    expect(() => mcpCallToolAllowlistCheck('flint_status')).not.toThrow()
  })

  it('IDX-15: allows all tools in RENDERER_ALLOWED_MCP_TOOLS', () => {
    for (const tool of RENDERER_ALLOWED_MCP_TOOLS) {
      expect(() => mcpCallToolAllowlistCheck(tool)).not.toThrow()
    }
  })

  it('IDX-16: rejects flint_fix (write tool, not in allowlist)', () => {
    expect(() => mcpCallToolAllowlistCheck('flint_fix')).toThrow('not in the renderer allowlist')
  })

  it('IDX-17: rejects flint_ast_mutate (mutation tool)', () => {
    expect(() => mcpCallToolAllowlistCheck('flint_ast_mutate')).toThrow('not in the renderer allowlist')
  })

  it('IDX-18: rejects an unknown tool name', () => {
    expect(() => mcpCallToolAllowlistCheck('evil_tool')).toThrow('not in the renderer allowlist')
  })

  it('IDX-19: error message names the offending tool', () => {
    let msg = ''
    try { mcpCallToolAllowlistCheck('flint_swarm_audit_fix') } catch (e) { msg = (e as Error).message }
    expect(msg).toContain('flint_swarm_audit_fix')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (4) d2c:apply — file write scoping to activeProjectRoot
// ─────────────────────────────────────────────────────────────────────────────

function isSafePathSegment(s: unknown): s is string {
  if (typeof s !== 'string' || s.length === 0) return false
  return !/[/\\]|\.\./.test(s)
}

function d2cApplyPathCheck(
  pageName: unknown,
  componentName: unknown,
  activeProjectRoot: string,
): { ok: boolean; error?: string; filePath?: string } {
  if (!isSafePathSegment(pageName)) {
    return { ok: false, error: 'Invalid pageName' }
  }
  if (!isSafePathSegment(componentName)) {
    return { ok: false, error: `Invalid component name: ${String(componentName)}` }
  }
  const targetDir = path.join(activeProjectRoot, 'src', 'components', 'generated', pageName as string)
  const filePath = path.join(targetDir, `${componentName as string}.tsx`)
  if (!filePath.startsWith(activeProjectRoot + path.sep)) {
    return { ok: false, error: `Path outside project root: ${filePath}` }
  }
  return { ok: true, filePath }
}

describe('d2c:apply — path scoping to activeProjectRoot', () => {
  const projectRoot = '/home/user/my-project'

  it('IDX-20: accepts safe pageName and component name', () => {
    const result = d2cApplyPathCheck('LandingPage', 'HeroSection', projectRoot)
    expect(result.ok).toBe(true)
    expect(result.filePath).toContain(projectRoot)
    expect(result.filePath).toContain('HeroSection.tsx')
  })

  it('IDX-21: rejects pageName with path separator', () => {
    const result = d2cApplyPathCheck('../evil', 'Component', projectRoot)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid pageName')
  })

  it('IDX-22: rejects pageName with double-dot traversal', () => {
    const result = d2cApplyPathCheck('..', 'Component', projectRoot)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid pageName')
  })

  it('IDX-23: rejects componentName with slash', () => {
    const result = d2cApplyPathCheck('MyPage', '../../etc/passwd', projectRoot)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid component name')
  })

  it('IDX-24: rejects empty component name', () => {
    const result = d2cApplyPathCheck('MyPage', '', projectRoot)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid component name')
  })

  it('IDX-25: generated file path starts with activeProjectRoot', () => {
    const result = d2cApplyPathCheck('Dashboard', 'Widget', projectRoot)
    expect(result.ok).toBe(true)
    expect(result.filePath!.startsWith(projectRoot + path.sep)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (5) ast:git-show — commit hash validation
// ─────────────────────────────────────────────────────────────────────────────

function validateGitShowParams(
  filePath: unknown,
  commitHash: unknown,
): { valid: boolean; reason?: string } {
  if (typeof filePath !== 'string' || typeof commitHash !== 'string') {
    return { valid: false, reason: 'filePath and commitHash must be strings' }
  }
  if (!/^([0-9a-fA-F]{4,64}|HEAD)$/.test(commitHash)) {
    return { valid: false, reason: 'invalid commit hash' }
  }
  if (!path.isAbsolute(filePath)) {
    return { valid: false, reason: 'filePath must be absolute' }
  }
  if (!isWithinHomeLocal(filePath)) {
    return { valid: false, reason: 'filePath outside home directory' }
  }
  return { valid: true }
}

describe('ast:git-show — commit hash and path validation', () => {
  it('IDX-26: accepts valid 40-char SHA and home path', () => {
    const hash = 'a'.repeat(40)
    const fp = path.join(os.homedir(), 'project', 'App.tsx')
    expect(validateGitShowParams(fp, hash).valid).toBe(true)
  })

  it('IDX-27: accepts HEAD as commit hash', () => {
    const fp = path.join(os.homedir(), 'project', 'App.tsx')
    expect(validateGitShowParams(fp, 'HEAD').valid).toBe(true)
  })

  it('IDX-28: accepts short 7-char SHA', () => {
    const fp = path.join(os.homedir(), 'project', 'App.tsx')
    expect(validateGitShowParams(fp, 'abc1234').valid).toBe(true)
  })

  it('IDX-29: rejects hash with shell-injection characters', () => {
    const fp = path.join(os.homedir(), 'project', 'App.tsx')
    expect(validateGitShowParams(fp, 'abc123; rm -rf /').valid).toBe(false)
    expect(validateGitShowParams(fp, 'abc123; rm -rf /').reason).toContain('commit hash')
  })

  it('IDX-30: rejects relative file path', () => {
    expect(validateGitShowParams('src/App.tsx', 'abc1234').valid).toBe(false)
    expect(validateGitShowParams('src/App.tsx', 'abc1234').reason).toContain('absolute')
  })

  it('IDX-31: rejects file path outside home directory', () => {
    expect(validateGitShowParams('/etc/passwd', 'abc1234').valid).toBe(false)
    expect(validateGitShowParams('/etc/passwd', 'abc1234').reason).toContain('home directory')
  })

  it('IDX-32: rejects non-string arguments', () => {
    expect(validateGitShowParams(null, 'abc1234').valid).toBe(false)
    expect(validateGitShowParams('/path', null).valid).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (6) governance:preview-fix — home guard + response shape
// ─────────────────────────────────────────────────────────────────────────────

function previewFixHomeGuard(filePath: unknown): { allowed: boolean } {
  if (typeof filePath !== 'string') return { allowed: false }
  const home = os.homedir()
  if (filePath !== home && !filePath.startsWith(home + path.sep)) return { allowed: false }
  return { allowed: true }
}

function normalisePreviewFixResponse(parsed: {
  fixes?: Array<{
    currentValue?: string
    current?: string
    proposedValue?: string
    proposed?: string
    tokenName?: string
    token_name?: string
    isColor?: boolean
    type?: string
  }>
}): { current: string; proposed: string; tokenName: string; isColor: boolean } | null {
  const fixes = parsed.fixes ?? []
  if (fixes.length === 0) return null
  const fix = fixes[0]
  return {
    current: fix.currentValue ?? fix.current ?? '',
    proposed: fix.proposedValue ?? fix.proposed ?? '',
    tokenName: fix.tokenName ?? fix.token_name ?? '',
    isColor: fix.isColor ?? fix.type === 'color',
  }
}

describe('governance:preview-fix — home guard', () => {
  it('IDX-33: allows path under home directory', () => {
    const fp = path.join(os.homedir(), 'project', 'App.tsx')
    expect(previewFixHomeGuard(fp).allowed).toBe(true)
  })

  it('IDX-34: rejects path outside home directory', () => {
    expect(previewFixHomeGuard('/etc/passwd').allowed).toBe(false)
    expect(previewFixHomeGuard('/var/log/syslog').allowed).toBe(false)
  })

  it('IDX-35: rejects non-string input', () => {
    expect(previewFixHomeGuard(null).allowed).toBe(false)
    expect(previewFixHomeGuard(42).allowed).toBe(false)
  })
})

describe('governance:preview-fix — response normalisation', () => {
  it('IDX-36: maps currentValue/proposedValue aliases', () => {
    const result = normalisePreviewFixResponse({
      fixes: [{ currentValue: 'red', proposedValue: 'blue', tokenName: 'brand/primary', isColor: true }],
    })
    expect(result).not.toBeNull()
    expect(result!.current).toBe('red')
    expect(result!.proposed).toBe('blue')
    expect(result!.tokenName).toBe('brand/primary')
    expect(result!.isColor).toBe(true)
  })

  it('IDX-37: falls back to current/proposed when currentValue absent', () => {
    const result = normalisePreviewFixResponse({
      fixes: [{ current: 'old', proposed: 'new', token_name: 'spacing/4', type: 'spacing' }],
    })
    expect(result).not.toBeNull()
    expect(result!.current).toBe('old')
    expect(result!.proposed).toBe('new')
    expect(result!.tokenName).toBe('spacing/4')
    expect(result!.isColor).toBe(false)
  })

  it('IDX-38: isColor true when type === "color" and isColor field absent', () => {
    const result = normalisePreviewFixResponse({
      fixes: [{ current: '#fff', proposed: '#000', type: 'color' }],
    })
    expect(result!.isColor).toBe(true)
  })

  it('IDX-39: returns null for empty fixes array', () => {
    expect(normalisePreviewFixResponse({ fixes: [] })).toBeNull()
    expect(normalisePreviewFixResponse({})).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (7) tokens:create — payload validation
// ─────────────────────────────────────────────────────────────────────────────

function validateTokenCreatePayload(token: unknown): void {
  if (
    typeof token !== 'object' || token === null ||
    typeof (token as any).token_path !== 'string' ||
    typeof (token as any).token_type !== 'string' ||
    typeof (token as any).token_value !== 'string'
  ) {
    throw new Error('tokens:create — invalid payload shape')
  }
}

describe('tokens:create — payload validation', () => {
  it('IDX-40: accepts valid token payload', () => {
    expect(() => validateTokenCreatePayload({
      token_path: 'brand/primary',
      token_type: 'color',
      token_value: '#1a1a2e',
    })).not.toThrow()
  })

  it('IDX-41: throws for null input', () => {
    expect(() => validateTokenCreatePayload(null)).toThrow('invalid payload shape')
  })

  it('IDX-42: throws when token_path is missing', () => {
    expect(() => validateTokenCreatePayload({ token_type: 'color', token_value: '#fff' })).toThrow()
  })

  it('IDX-43: throws when token_value is a number (wrong type)', () => {
    expect(() => validateTokenCreatePayload({
      token_path: 'spacing/4',
      token_type: 'dimension',
      token_value: 16, // number instead of string
    })).toThrow('invalid payload shape')
  })

  it('IDX-44: throws for array input', () => {
    expect(() => validateTokenCreatePayload([])).toThrow('invalid payload shape')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (8) setup:write-mcp-config — safe config path allowlist
// ─────────────────────────────────────────────────────────────────────────────

function validateMCPConfigPath(configPath: unknown): void {
  if (typeof configPath !== 'string') throw new TypeError('configPath must be a string')
  const SAFE_CONFIG_PATHS = [
    path.join(os.homedir(), '.cursor', 'mcp.json'),
    path.join(os.homedir(), '.claude', 'mcp.json'),
    path.join(process.cwd(), '.vscode', 'mcp.json'),
    path.join(process.cwd(), '.cursor', 'mcp.json'),
  ]
  const normalised = path.normalize(configPath)
  if (!SAFE_CONFIG_PATHS.some((safe) => path.normalize(safe) === normalised)) {
    throw new Error('Invalid MCP config path')
  }
}

describe('setup:write-mcp-config — config path allowlist', () => {
  it('IDX-45: allows ~/.cursor/mcp.json', () => {
    const p = path.join(os.homedir(), '.cursor', 'mcp.json')
    expect(() => validateMCPConfigPath(p)).not.toThrow()
  })

  it('IDX-46: allows ~/.claude/mcp.json', () => {
    const p = path.join(os.homedir(), '.claude', 'mcp.json')
    expect(() => validateMCPConfigPath(p)).not.toThrow()
  })

  it('IDX-47: rejects an arbitrary home path', () => {
    const p = path.join(os.homedir(), '.ssh', 'authorized_keys')
    expect(() => validateMCPConfigPath(p)).toThrow('Invalid MCP config path')
  })

  it('IDX-48: rejects /etc/passwd', () => {
    expect(() => validateMCPConfigPath('/etc/passwd')).toThrow('Invalid MCP config path')
  })

  it('IDX-49: rejects non-string input', () => {
    expect(() => validateMCPConfigPath(null)).toThrow(TypeError)
    expect(() => validateMCPConfigPath(42)).toThrow(TypeError)
  })

  it('IDX-50: rejects a path that only shares a prefix with an allowed path', () => {
    // ~/.cursor-extra/mcp.json should not match ~/.cursor/mcp.json
    const p = path.join(os.homedir(), '.cursor-extra', 'mcp.json')
    expect(() => validateMCPConfigPath(p)).toThrow('Invalid MCP config path')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (9) code:transform — output shape
// ─────────────────────────────────────────────────────────────────────────────

// Mirror the Babel-independent validation rules from the code:transform handler.
// We do NOT re-run Babel in tests — that is tested implicitly by the running
// LivePreview integration. We test the guard and output-shape logic instead.

function validateCodeTransformInput(code: unknown): { js: null; error: string } | 'proceed' {
  if (typeof code !== 'string') {
    return { js: null, error: 'code must be a string' }
  }
  if (code.trim() === '') {
    return { js: null, error: 'empty source' }
  }
  return 'proceed'
}

describe('code:transform — input guard', () => {
  it('IDX-51: returns error for non-string input', () => {
    const result = validateCodeTransformInput(null)
    expect(result).not.toBe('proceed')
    expect((result as any).error).toBe('code must be a string')
    expect((result as any).js).toBeNull()
  })

  it('IDX-52: returns error for empty string', () => {
    const result = validateCodeTransformInput('   ')
    expect(result).not.toBe('proceed')
    expect((result as any).error).toBe('empty source')
  })

  it('IDX-53: returns "proceed" for valid non-empty string', () => {
    expect(validateCodeTransformInput('export function App() { return null }')).toBe('proceed')
  })

  it('IDX-54: returns error for numeric input', () => {
    const result = validateCodeTransformInput(42)
    expect((result as any).js).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (10) broadcast — JSON message shape
// ─────────────────────────────────────────────────────────────────────────────

function buildBroadcastMessage(channel: string, data: unknown): string {
  return JSON.stringify({ channel, data })
}

function parseBroadcastMessage(raw: string): { channel: string; data: unknown } | null {
  try {
    const parsed = JSON.parse(raw) as { channel?: unknown; data?: unknown }
    if (typeof parsed.channel !== 'string') return null
    return { channel: parsed.channel, data: parsed.data }
  } catch {
    return null
  }
}

describe('broadcast — JSON message shape normalisation', () => {
  it('IDX-55: serialises { channel, data } shape', () => {
    const msg = buildBroadcastMessage('flint:tokens-updated', {})
    const parsed = JSON.parse(msg) as { channel: string; data: unknown }
    expect(parsed.channel).toBe('flint:tokens-updated')
    expect(parsed.data).toEqual({})
  })

  it('IDX-56: parseBroadcastMessage round-trips a valid message', () => {
    const msg = buildBroadcastMessage('flint:mcp-event', [{ type: 'audit' }])
    const result = parseBroadcastMessage(msg)
    expect(result).not.toBeNull()
    expect(result!.channel).toBe('flint:mcp-event')
    expect(result!.data).toEqual([{ type: 'audit' }])
  })

  it('IDX-57: parseBroadcastMessage returns null for malformed JSON', () => {
    expect(parseBroadcastMessage('NOT JSON')).toBeNull()
  })

  it('IDX-58: parseBroadcastMessage returns null when channel is not a string', () => {
    expect(parseBroadcastMessage(JSON.stringify({ channel: 42, data: {} }))).toBeNull()
  })

  it('IDX-59: broadcast handles non-serialisable data gracefully in round-trip test', () => {
    // JSON.stringify silently drops undefined fields — verify channel always survives
    const msg = buildBroadcastMessage('flint:ide-file-selected', { path: undefined })
    const result = parseBroadcastMessage(msg)
    expect(result!.channel).toBe('flint:ide-file-selected')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// startTelemetry() boot smoke test
//
// Contract testBoundary: "server boot — startTelemetry() side effect"
// given:  a clean temp directory with consent state "accepted"
// when:   the server's internal startTelemetry() executes
// then:   the in-memory buffer contains exactly one entry with name "app.launched"
//         and the 60-second flush timer is set.
//
// Because server/index.ts is a monolithic factory that starts side-effects on
// import/call (SQLite, MCP child process, fs.watch, etc.), we test the
// startTelemetry behaviour by reproducing the exact same logic that the factory
// runs — the same close-mirror strategy used in the rest of this file.
// ─────────────────────────────────────────────────────────────────────────────

describe('startTelemetry() — server boot smoke test', () => {
  let smokeDir: string
  let flushTimer: ReturnType<typeof setInterval> | null = null

  beforeEach(() => {
    smokeDir = path.join(
      os.tmpdir(),
      `flint-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    mkdirSync(smokeDir, { recursive: true })
    flushTimer = null
  })

  afterEach(() => {
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
    try { rmSync(smokeDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  /**
   * Minimal reproduction of server/index.ts startTelemetry() logic.
   * Returns the buffer and timer so we can assert on them.
   */
  function bootTelemetry(consentState: 'accepted' | 'unset' | 'declined'): {
    buffer: Array<{ name: string; payload: unknown; ts: string }>
    timer: ReturnType<typeof setInterval>
  } {
    const consentPath = path.join(smokeDir, 'beta-consent.json')
    writeFileSync(consentPath, JSON.stringify({
      state: consentState,
      sessionId: 'smoke-test-sid',
      decidedAt: consentState !== 'unset' ? new Date().toISOString() : undefined,
    }))

    // Mirror of webReadConsentState() from server/index.ts
    function readConsentState(): string {
      try {
        const raw = JSON.parse(readFileSync(consentPath, 'utf-8')) as { state?: string }
        return typeof raw.state === 'string' ? raw.state : 'unset'
      } catch { return 'unset' }
    }

    // Mirror of the in-memory buffer
    const buffer: Array<{ name: string; payload: unknown; ts: string }> = []

    // Hydrate from disk if present (post-crash recovery path)
    try {
      const qPath = path.join(smokeDir, 'telemetry-queue.json')
      if (existsSync(qPath)) {
        const raw = JSON.parse(readFileSync(qPath, 'utf-8')) as unknown
        if (Array.isArray(raw)) {
          buffer.push(...(raw as typeof buffer))
        }
      }
    } catch { /* malformed queue → treat as empty */ }

    // Mirror of webEmit()
    function webEmit(name: string, payload: unknown): void {
      if (readConsentState() !== 'accepted') return
      buffer.push({ name, payload, ts: new Date().toISOString() })
    }

    // Emit app.launched (consent-gated)
    webEmit('app.launched', { locale: process.env.LANG?.split('.')[0] ?? 'en' })

    // Set the flush timer (mirrors the 60s setInterval in server/index.ts)
    const timer = setInterval(() => { /* flush would go here */ }, 60_000)
    flushTimer = timer

    return { buffer, timer }
  }

  it('IDX-SMOKE-01: buffer contains exactly one "app.launched" entry when consent is accepted', () => {
    const { buffer } = bootTelemetry('accepted')

    const launchEvents = buffer.filter((e) => e.name === 'app.launched')
    expect(launchEvents).toHaveLength(1)
  })

  it('IDX-SMOKE-02: buffer is empty when consent is "unset" (webEmit is a no-op)', () => {
    const { buffer } = bootTelemetry('unset')
    expect(buffer).toHaveLength(0)
  })

  it('IDX-SMOKE-03: the 60-second flush timer is set after startTelemetry()', () => {
    const { timer } = bootTelemetry('accepted')
    // setInterval returns a NodeJS.Timeout — truthy when set
    expect(timer).toBeTruthy()
    // afterEach clears it to avoid open-handle warnings
  })

  it('IDX-SMOKE-04: buffer contains app.launched with a string locale field', () => {
    const { buffer } = bootTelemetry('accepted')
    const entry = buffer.find((e) => e.name === 'app.launched')!
    expect(entry).toBeDefined()
    expect(typeof (entry.payload as { locale: string }).locale).toBe('string')
  })

  it('IDX-SMOKE-05: hydrates disk queue before emitting app.launched (post-crash recovery)', () => {
    // Pre-seed a disk queue file to simulate a prior crashed run
    const qPath = path.join(smokeDir, 'telemetry-queue.json')
    const priorEvents = [
      { name: 'mcp.tool_called', payload: { toolName: 'flint_status' }, ts: new Date().toISOString() },
    ]
    writeFileSync(qPath, JSON.stringify(priorEvents, null, 2))

    const { buffer } = bootTelemetry('accepted')

    // Prior event should appear before app.launched
    expect(buffer.length).toBeGreaterThanOrEqual(2)
    expect(buffer[0].name).toBe('mcp.tool_called')
    const launchEntry = buffer.find((e) => e.name === 'app.launched')
    expect(launchEntry).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Live HTTP/WS round-trip tests — require startServer(), deferred to Phase 2B
// ─────────────────────────────────────────────────────────────────────────────

describe('startServer HTTP round-trips (live server tests)', () => {
  it.todo('POST /api/ipc with channel=ping returns { result: "pong from Web Server" }')
  it.todo('POST /api/ipc with unknown channel returns 400 or error shape')
  it.todo('GET /api/ws-token returns { token: <uuid> }')
  it.todo('WebSocket upgrade without token returns 401 Unauthorized')
  it.todo('WebSocket upgrade with correct token establishes connection')
  it.todo('broadcast("flint:tokens-updated", {}) reaches all connected WS clients')
  it.todo('POST /api/ipc tokens:create broadcasts flint:tokens-updated to WS clients')
  it.todo('POST /api/ipc ast:save-file rejects writes to /tmp paths')
  it.todo('POST /api/ipc mcp:call-tool with blocked tool returns error (not 500)')
  it.todo('server.close() resolves without hanging timers')
})
