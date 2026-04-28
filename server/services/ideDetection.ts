/**
 * server/services/ideDetection.ts
 *
 * IDE detection service for the Hello, Flint welcome screen (HELLO-FLINT-PHASE-A).
 *
 * Detects which editors are installed by probing known filesystem paths.
 * Closed beta is macOS (darwin) only — Linux and Windows return present:false
 * with configPath:null for every editor, leaving the manual-snippet fallback
 * path as the recovery option.
 *
 * Pure function — no IPC, no side effects, no writes.
 *
 * Types are declared here as the canonical local source; the contract file
 * (.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts) declares them
 * as the spec source — these must be kept in sync.
 */

import os from 'node:os'
import path from 'node:path'
import { existsSync } from 'node:fs'

// ── Types (mirrors HELLO-FLINT-PHASE-A.contract.ts) ─────────────────────────

/** The three editors Phase A targets. Antigravity is intentionally excluded. */
export type EditorName = 'claude-code' | 'cursor' | 'vscode'

/** A single editor detection result. */
export interface DetectedEditor {
  editor: EditorName
  /** True iff the editor's primary settings file exists on disk. */
  present: boolean
  /**
   * Resolved absolute path to the editor's MCP config file.
   * `null` when the platform is not supported or when path resolution fails.
   */
  configPath: string | null
}

/** Response from `hello:detect-editors`. */
export interface DetectEditorsResponse {
  /** Always 3 entries in fixed order: claude-code, cursor, vscode. */
  editors: DetectedEditor[]
  /** Absolute path to flint-mcp/dist/server.js (dev or packaged). */
  mcpServerPath: string
  /** Detected platform; non-darwin platforms return present:false for all editors. */
  platform: 'darwin' | 'linux' | 'win32'
}

// ── MCP server path resolver ─────────────────────────────────────────────────

/**
 * Resolves the canonical MCP server path.
 *
 * Resolves relative to the current working directory (the repo root when
 * running `npm run dev:web` or in tests). Callers can pass an explicit
 * `repoRoot` for test isolation.
 */
export function getMCPServerPath(repoRoot?: string): string {
  const root = repoRoot ?? process.cwd()
  return path.resolve(root, 'flint-mcp', 'dist', 'server.js')
}

// ── Detection ────────────────────────────────────────────────────────────────

/**
 * Detects which editors are installed on the host machine.
 *
 * Always returns exactly 3 entries in fixed order:
 *   [0] claude-code
 *   [1] cursor
 *   [2] vscode
 *
 * On non-darwin platforms all entries return present:false and configPath:null.
 *
 * @param options - Optional overrides for testing (homeDir, platformOverride, repoRoot).
 */
export function detectInstalled(options?: {
  homeDir?: string
  platformOverride?: string
  repoRoot?: string
}): DetectEditorsResponse {
  const platform = (options?.platformOverride ?? process.platform) as
    | 'darwin'
    | 'linux'
    | 'win32'
  const home = options?.homeDir ?? os.homedir()

  const editors: DetectedEditor[] = []

  if (platform !== 'darwin') {
    // Non-darwin stub: return present:false / configPath:null for all editors.
    // Manual-snippet fallback path remains usable for these users.
    const STUB_EDITORS: EditorName[] = ['claude-code', 'cursor', 'vscode']
    for (const editor of STUB_EDITORS) {
      editors.push({ editor, present: false, configPath: null })
    }
    return {
      editors,
      mcpServerPath: getMCPServerPath(options?.repoRoot),
      platform,
    }
  }

  // ── Claude Code ─────────────────────────────────────────────────────────────
  // Claude Code stores MCP config in ~/.claude/mcp.json (preferred) with
  // ~/.claude/settings.json as fallback. The presence check uses either file.
  {
    const mcpJsonPath = path.join(home, '.claude', 'mcp.json')
    const settingsJsonPath = path.join(home, '.claude', 'settings.json')
    const mcpExists = existsSync(mcpJsonPath)
    const settingsExists = existsSync(settingsJsonPath)
    const present = mcpExists || settingsExists
    // Prefer mcp.json for the write target; fall back to settings.json.
    const configPath = present ? (mcpExists ? mcpJsonPath : settingsJsonPath) : null
    editors.push({ editor: 'claude-code', present, configPath })
  }

  // ── Cursor ───────────────────────────────────────────────────────────────────
  // Cursor stores settings at ~/Library/Application Support/Cursor/User/settings.json
  {
    const cursorSettingsPath = path.join(
      home,
      'Library',
      'Application Support',
      'Cursor',
      'User',
      'settings.json',
    )
    const present = existsSync(cursorSettingsPath)
    editors.push({
      editor: 'cursor',
      present,
      configPath: present ? cursorSettingsPath : null,
    })
  }

  // ── VS Code ──────────────────────────────────────────────────────────────────
  // VS Code stores settings at ~/Library/Application Support/Code/User/settings.json
  {
    const vscodeSettingsPath = path.join(
      home,
      'Library',
      'Application Support',
      'Code',
      'User',
      'settings.json',
    )
    const present = existsSync(vscodeSettingsPath)
    editors.push({
      editor: 'vscode',
      present,
      configPath: present ? vscodeSettingsPath : null,
    })
  }

  return {
    editors,
    mcpServerPath: getMCPServerPath(options?.repoRoot),
    platform,
  }
}
