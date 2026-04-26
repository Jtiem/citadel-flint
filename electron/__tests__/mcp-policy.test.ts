/**
 * mcp-policy.test.ts
 *
 * Tests for the SEC.3 MCP Tool Allowlist.
 *
 * Coverage:
 *   SEC3-01 — RENDERER_ALLOWED_MCP_TOOLS is a frozen array
 *   SEC3-02 — The allowlist contains all expected allowed tools
 *   SEC3-03 — The allowlist does NOT contain write-oriented/agent-only tools
 *   SEC3-04 — Allowed tool would pass the allowlist check
 *   SEC3-05 — Disallowed tool would be rejected with a descriptive error
 *   SEC3-06 — Unknown tool (not in MCP server at all) is rejected
 */

import { describe, it, expect } from 'vitest'
import { RENDERER_ALLOWED_MCP_TOOLS } from '../mcp-policy'

// ── Helper: simulate the main.ts allowlist guard logic ────────────────────────
// This is the exact guard from the mcp:call-tool handler in main.ts.
// Testing it inline here avoids needing to import main.ts (which has
// Electron API dependencies that are unavailable in Node test environments).

function allowlistGuard(name: string): { allowed: true } | { allowed: false; error: string } {
    if (!RENDERER_ALLOWED_MCP_TOOLS.includes(name)) {
        return {
            allowed: false,
            error:
                `mcp:call-tool — tool "${name}" is not in the renderer allowlist. ` +
                `Only these tools can be called from Glass: ${RENDERER_ALLOWED_MCP_TOOLS.join(', ')}`,
        }
    }
    return { allowed: true }
}

// ── SEC3-01: RENDERER_ALLOWED_MCP_TOOLS is a frozen array ─────────────────────

describe('SEC3-01 — RENDERER_ALLOWED_MCP_TOOLS structure', () => {
    it('is a frozen array', () => {
        expect(Array.isArray(RENDERER_ALLOWED_MCP_TOOLS)).toBe(true)
        expect(Object.isFrozen(RENDERER_ALLOWED_MCP_TOOLS)).toBe(true)
    })

    it('has at least one entry', () => {
        expect(RENDERER_ALLOWED_MCP_TOOLS.length).toBeGreaterThan(0)
    })

    it('contains only non-empty strings', () => {
        for (const tool of RENDERER_ALLOWED_MCP_TOOLS) {
            expect(typeof tool).toBe('string')
            expect(tool.length).toBeGreaterThan(0)
        }
    })
})

// ── SEC3-02: The allowlist contains expected allowed tools ─────────────────────

describe('SEC3-02 — expected tools are present in the allowlist', () => {
    const EXPECTED_ALLOWED = [
        // SEC.3 original
        'flint_status',
        'flint_audit',
        'flint_debt_report',
        'flint_query_registry',
        'flint_generate_dbom',
        'flint_accessibility_report',
        'flint_audit_report',
        // MINT.5 Phase 2 — user-invoked sync actions
        'flint_sync_pull',
        'flint_sync_push',
        'flint_resolve_all',
        'flint_sync_check',
        'flint_figma_connect',
        // MINT.5 Phase 3 — Scout emit (dryRun-default, read-shaped from renderer)
        'flint_emit_tokens',
    ]

    for (const tool of EXPECTED_ALLOWED) {
        it(`includes '${tool}'`, () => {
            expect(RENDERER_ALLOWED_MCP_TOOLS).toContain(tool)
        })
    }

    // boundary: emit-renderer-allowlist-frozen invariant
    it('has exactly the expected count of 13 tools (7 SEC.3 + 5 MINT.5.2 sync + 1 MINT.5.3 emit)', () => {
        expect(RENDERER_ALLOWED_MCP_TOOLS.length).toBe(13)
    })

    it('includes flint_emit_tokens (MINT.5 Phase 3 Scout addition)', () => {
        // boundary: emit-renderer-allowlist-frozen — flint_emit_tokens is in the set
        expect(RENDERER_ALLOWED_MCP_TOOLS).toContain('flint_emit_tokens')
    })
})

// ── SEC3-03: Write-oriented / agent-only tools are NOT in the allowlist ────────

describe('SEC3-03 — write-oriented and agent-only tools are excluded', () => {
    const EXCLUDED_TOOLS = [
        'flint_ast_mutate',
        'flint_fix',
        'flint_ingest_figma',
        'flint_sync_tokens',
        'flint_swarm_audit_fix',
        'flint_add_remote_library',
        'flint_annotate',
    ]

    for (const tool of EXCLUDED_TOOLS) {
        it(`does NOT include '${tool}'`, () => {
            expect(RENDERER_ALLOWED_MCP_TOOLS).not.toContain(tool)
        })
    }
})

// ── SEC3-04: Allowed tool passes the guard ────────────────────────────────────

describe('SEC3-04 — allowed tools pass the allowlist guard', () => {
    it('flint_status passes through', () => {
        const result = allowlistGuard('flint_status')
        expect(result.allowed).toBe(true)
    })

    it('flint_audit passes through', () => {
        const result = allowlistGuard('flint_audit')
        expect(result.allowed).toBe(true)
    })

    it('flint_generate_dbom passes through', () => {
        const result = allowlistGuard('flint_generate_dbom')
        expect(result.allowed).toBe(true)
    })
})

// ── SEC3-05: Disallowed tool is rejected with a descriptive error ──────────────

describe('SEC3-05 — disallowed tool is rejected with descriptive error', () => {
    it('flint_ast_mutate is rejected', () => {
        const result = allowlistGuard('flint_ast_mutate')
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            expect(result.error).toContain('not in the renderer allowlist')
            expect(result.error).toContain('flint_ast_mutate')
        }
    })

    it('flint_ingest_figma is rejected', () => {
        const result = allowlistGuard('flint_ingest_figma')
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            expect(result.error).toContain('not in the renderer allowlist')
            expect(result.error).toContain('flint_ingest_figma')
        }
    })

    it('flint_fix is rejected', () => {
        const result = allowlistGuard('flint_fix')
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            expect(result.error).toContain('not in the renderer allowlist')
        }
    })

    it('error message includes list of allowed tools', () => {
        const result = allowlistGuard('flint_ast_mutate')
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            // The error message should name the tools the renderer IS allowed to call
            expect(result.error).toContain('flint_status')
            expect(result.error).toContain('flint_audit')
        }
    })
})

// ── SEC3-06: Unknown tool is rejected ─────────────────────────────────────────

describe('SEC3-06 — unknown tool is rejected', () => {
    it('nonexistent_tool is rejected', () => {
        const result = allowlistGuard('nonexistent_tool')
        expect(result.allowed).toBe(false)
        if (!result.allowed) {
            expect(result.error).toContain('not in the renderer allowlist')
            expect(result.error).toContain('nonexistent_tool')
        }
    })

    it('empty string is rejected', () => {
        // The main.ts handler guards against empty strings with a TypeError,
        // but the allowlist check itself also rejects them.
        const result = allowlistGuard('')
        expect(result.allowed).toBe(false)
    })

    it('tool with correct prefix but wrong name is rejected', () => {
        const result = allowlistGuard('flint_super_admin_nuke')
        expect(result.allowed).toBe(false)
    })
})
