/**
 * server/services/mcpConfigWriter.ts
 *
 * Per-editor MCP config writer for the Hello, Flint welcome screen
 * (HELLO-FLINT-PHASE-A).
 *
 * Reads the editor's existing config file, merges the Flint MCP entry while
 * preserving every other entry, and writes atomically via FileTransactionManager.
 *
 * Commandment 14 (Bypass Prohibition): ALL disk writes go through
 * fileTransactionManager.write() — never raw Node.js fs write calls directly.
 * The atomic-write-routing invariant in the contract asserts this is true.
 *
 * Handles JSONC (JSON with comments) by stripping comments before parsing.
 * Comments are not preserved in the output — this is acceptable per the contract.
 */

import path from 'node:path'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { fileTransactionManager } from './fileTransactionManager.js'
import type { EditorName } from './ideDetection.js'

// Re-export for callers
export type { EditorName }

// ── Types ────────────────────────────────────────────────────────────────────

export interface WriteMcpConfigResult {
  editor: EditorName
  configPath: string
  /** Number of MCP entries preserved (excluding the new flint entry). */
  preservedEntries: number
}

export interface WriteMcpConfigBulkPayload {
  /** 1..3 editor names. Handler dedupes. */
  editors: EditorName[]
  /** Must equal the mcpServerPath returned by hello:detect-editors. */
  mcpServerPath: string
}

export interface WriteMcpConfigBulkResponse {
  written: Array<WriteMcpConfigResult>
  failed: Array<{
    editor: EditorName
    /** Human-readable reason. Never includes raw fs error stack. */
    reason: string
    /**
     * Machine-readable failure code. Present when the writer refuses to
     * overwrite a config file due to a data-safety check:
     *   'malformed-config'    — the file exists but JSON.parse failed after
     *                           comment-stripping. The writer refuses to
     *                           overwrite to avoid destroying user settings.
     *   'unexpected-schema'   — config.mcpServers exists but is not a plain
     *                           object (e.g. an array or a string). The writer
     *                           refuses to mutate an unknown shape.
     */
    code?: 'malformed-config' | 'unexpected-schema'
    /** Raw parse/shape error message. Never an fs stack — always a brief string. */
    detail?: string
  }>
}

// ── Typed refusal errors ──────────────────────────────────────────────────────

/**
 * Thrown when an existing config file cannot be parsed as JSON after
 * JSONC comment-stripping. We refuse to overwrite in this case to avoid
 * silently destroying the user's editor settings.
 */
export class MalformedConfigError extends Error {
  readonly code = 'malformed-config' as const
  constructor(
    readonly filePath: string,
    readonly parseError: string,
  ) {
    super(
      `Could not parse your existing config at "${filePath}" — ` +
        `refusing to overwrite to protect your settings. ` +
        `Please fix the JSON manually and try again. (${parseError})`,
    )
    this.name = 'MalformedConfigError'
  }
}

/**
 * Thrown when config.mcpServers exists but is not a plain object. We refuse
 * to mutate an unknown shape to avoid silently corrupting the user's config.
 */
export class UnexpectedSchemaError extends Error {
  readonly code = 'unexpected-schema' as const
  constructor(
    readonly filePath: string,
    readonly actualType: string,
  ) {
    super(
      `Your editor config at "${filePath}" has an unexpected "mcpServers" field ` +
        `(found ${actualType} instead of an object). ` +
        `Please fix it manually and try again.`,
    )
    this.name = 'UnexpectedSchemaError'
  }
}

// ── JSONC comment stripper ────────────────────────────────────────────────────

/**
 * Strips single-line (//) and multi-line (/* *\/) comments from JSON-like
 * text so it can be safely passed to JSON.parse.
 *
 * This deliberately simple implementation handles the common editor config
 * patterns. It does not handle comments inside string values correctly (it
 * will strip them) — for the MCP config files we target this is acceptable
 * because config values never contain comment syntax in practice.
 */
export function stripJsoncComments(text: string): string {
  let result = ''
  let i = 0
  const len = text.length

  while (i < len) {
    // Inside a string — walk to the closing quote, handling escapes.
    if (text[i] === '"') {
      const start = i
      i++
      while (i < len) {
        if (text[i] === '\\') {
          i += 2 // skip escaped character
          continue
        }
        if (text[i] === '"') {
          i++
          break
        }
        i++
      }
      result += text.slice(start, i)
      continue
    }

    // Check for single-line comment: //
    if (text[i] === '/' && text[i + 1] === '/') {
      // Skip to end of line
      while (i < len && text[i] !== '\n') i++
      continue
    }

    // Check for block comment: /* ... */
    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2
      while (i < len) {
        if (text[i] === '*' && text[i + 1] === '/') {
          i += 2
          break
        }
        i++
      }
      continue
    }

    result += text[i]
    i++
  }

  return result
}

// ── Config read helpers ──────────────────────────────────────────────────────

/**
 * Reads and parses an existing MCP config file.
 *
 * Returns an empty object when the file does not exist (new config path).
 *
 * Throws `MalformedConfigError` when the file exists but cannot be parsed
 * after JSONC comment-stripping — we refuse to start fresh in that case
 * because overwriting with a blank config would silently destroy the user's
 * other editor settings.
 */
function readExistingConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {}
  }
  let raw: string
  try {
    raw = readFileSync(configPath, 'utf-8')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new MalformedConfigError(configPath, `Could not read file: ${msg}`)
  }
  const stripped = stripJsoncComments(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new MalformedConfigError(configPath, msg)
  }
  // The top-level value must be a plain object
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new MalformedConfigError(
      configPath,
      `Top-level value is ${Array.isArray(parsed) ? 'array' : typeof parsed}, expected object`,
    )
  }
  return parsed as Record<string, unknown>
}

// ── Core write function ──────────────────────────────────────────────────────

/**
 * Writes a Flint MCP entry into the editor's config file.
 *
 * - Reads the existing config (creates if absent).
 * - Strips JSONC comments, parses, merges the flint entry.
 * - Creates the parent directory if missing.
 * - Writes atomically via fileTransactionManager (Commandment 14).
 * - Returns the count of MCP entries that were preserved (excluding flint).
 *
 * Throws a human-readable error on failure (never exposes raw fs stack).
 */
export async function writeMcpConfig(
  _editor: EditorName,
  configPath: string,
  mcpServerPath: string,
  projectRoot?: string,
): Promise<WriteMcpConfigResult> {
  const editor = _editor

  // Ensure parent directory exists before writing
  try {
    const parentDir = path.dirname(configPath)
    mkdirSync(parentDir, { recursive: true })
  } catch {
    throw new Error(`Could not create directory for ${editor} config`)
  }

  // Read existing config (empty object if absent; throws MalformedConfigError
  // when the file exists but is unparseable — we never silently overwrite).
  const config = readExistingConfig(configPath)

  // Runtime type guard for config.mcpServers (BLK-2):
  // Only null / undefined / a plain object are safe to merge into.
  // Arrays, strings, numbers, booleans are an unknown shape — refuse.
  const rawServers = config.mcpServers
  if (
    rawServers !== null &&
    rawServers !== undefined &&
    (typeof rawServers !== 'object' || Array.isArray(rawServers))
  ) {
    throw new UnexpectedSchemaError(
      configPath,
      Array.isArray(rawServers) ? 'array' : typeof rawServers,
    )
  }

  // Safe to spread — rawServers is either absent, null, or a plain object.
  const existingServers: Record<string, unknown> = {
    ...(rawServers as Record<string, unknown> | null | undefined),
  }
  const preservedEntries = Object.keys(existingServers).filter(
    (k) => k !== 'flint',
  ).length

  // Merge the flint entry
  existingServers['flint'] = {
    command: 'node',
    args: [mcpServerPath],
    env: { FLINT_PROJECT_ROOT: projectRoot ?? '' },
  }
  config.mcpServers = existingServers

  // Serialize and write atomically (Commandment 14)
  const serialized = JSON.stringify(config, null, 2)

  // fileTransactionManager.write is the ONLY allowed disk write path.
  // Commandment 14 invariant: the atomic-write-routing test verifies no direct
  // fs write calls exist in this file (see server/__tests__/helloFlintIpc.test.ts).
  await fileTransactionManager.write(configPath, serialized)

  return { editor, configPath, preservedEntries }
}

// ── Bulk writer ──────────────────────────────────────────────────────────────

/**
 * Writes Flint MCP entries to multiple editors' config files.
 * Processes each editor independently — a failure for one does not prevent others.
 * Dedupes the editors array before processing.
 */
export async function writeBulk(
  payload: WriteMcpConfigBulkPayload,
  editorConfigPaths: Map<EditorName, string>,
  projectRoot?: string,
): Promise<WriteMcpConfigBulkResponse> {
  // Dedupe editors while preserving order
  const seen = new Set<EditorName>()
  const uniqueEditors: EditorName[] = []
  for (const editor of payload.editors) {
    if (!seen.has(editor)) {
      seen.add(editor)
      uniqueEditors.push(editor)
    }
  }

  const written: WriteMcpConfigBulkResponse['written'] = []
  const failed: WriteMcpConfigBulkResponse['failed'] = []

  await Promise.all(
    uniqueEditors.map(async (editor) => {
      const configPath = editorConfigPaths.get(editor)
      if (!configPath) {
        failed.push({
          editor,
          reason: `No config path resolved for ${editor}`,
        })
        return
      }
      try {
        const result = await writeMcpConfig(
          editor,
          configPath,
          payload.mcpServerPath,
          projectRoot,
        )
        written.push(result)
      } catch (err) {
        // Surface typed refusal codes (MalformedConfigError / UnexpectedSchemaError)
        // so the UI can route the user to the manual-snippet fallback path.
        if (err instanceof MalformedConfigError) {
          failed.push({
            editor,
            reason: err.message,
            code: 'malformed-config',
            detail: err.parseError,
          })
          return
        }
        if (err instanceof UnexpectedSchemaError) {
          failed.push({
            editor,
            reason: err.message,
            code: 'unexpected-schema',
            detail: err.actualType,
          })
          return
        }
        // All other errors — never surface raw fs stack.
        const reason =
          err instanceof Error
            ? err.message.replace(/^Error:\s*/i, '').slice(0, 200)
            : 'Unknown error writing config'
        failed.push({ editor, reason })
      }
    }),
  )

  return { written, failed }
}

// ── Already-connected check ──────────────────────────────────────────────────

/**
 * Checks whether any of the given editor config files already contain
 * a `flint` MCP entry. Best-effort — failures are silently skipped.
 */
export function checkAlreadyConnected(
  editorConfigPaths: Map<EditorName, string>,
): { connected: boolean; editors: EditorName[] } {
  const connectedEditors: EditorName[] = []

  for (const [editor, configPath] of editorConfigPaths) {
    try {
      const config = readExistingConfig(configPath)
      const rawServers = config.mcpServers
      // Only treat it as a server map when it's a plain object.
      if (
        rawServers !== null &&
        rawServers !== undefined &&
        typeof rawServers === 'object' &&
        !Array.isArray(rawServers)
      ) {
        const servers = rawServers as Record<string, unknown>
        if ('flint' in servers) {
          connectedEditors.push(editor)
        }
      }
    } catch {
      // Unreadable or malformed config — skip silently (best-effort check)
    }
  }

  return {
    connected: connectedEditors.length > 0,
    editors: connectedEditors,
  }
}
