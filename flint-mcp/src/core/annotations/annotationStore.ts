/**
 * AnnotationStore — flint-mcp/src/core/annotations/annotationStore.ts
 *
 * MCP-side file I/O layer for Flint annotations (COLLAB.1).
 *
 * Responsibilities:
 *   - Read / write .flint/annotations.json atomically
 *   - Provide readAll(), append(), and resolve() operations
 *   - All writes use a tmp→rename pattern matching the FileTransactionManager
 *     contract (Commandment 12 — Atomic Queuing).
 *
 * This module has NO knowledge of IPC, Zustand, or the renderer. It is the
 * pure data layer consumed by the MCP tools (COLLAB.3) and the main-process
 * IPC handlers (COLLAB.4).
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { FlintAnnotation } from './types.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the absolute path to .flint/annotations.json for `projectRoot`.
 * Uses the HOME-relative `.flint` directory when no project root is provided
 * so the MCP tools can always resolve a default location.
 */
export function annotationsFilePath(projectRoot?: string): string {
    const base = projectRoot ?? process.env['HOME'] ?? '.'
    return path.join(base, '.flint', 'annotations.json')
}

/**
 * Reads all annotations from `filePath`. Returns an empty array if the file
 * does not exist or cannot be parsed — never throws on missing files.
 */
export async function readAnnotations(filePath: string): Promise<FlintAnnotation[]> {
    try {
        const raw = await readFile(filePath, 'utf-8')
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed as FlintAnnotation[]
    } catch {
        return []
    }
}

/**
 * Atomically writes `annotations` to `filePath` using a .tmp → rename pattern.
 *
 * Steps:
 *   1. Ensure the parent directory exists.
 *   2. Write JSON to `<filePath>.tmp`.
 *   3. fs.rename() overwrites the target in a single kernel operation.
 *
 * Concurrent writes to the same path are NOT serialised at this layer — that
 * responsibility belongs to the caller (main-process IPC handlers run serially
 * per Electron's single-thread IPC queue).
 */
export async function writeAnnotations(filePath: string, annotations: FlintAnnotation[]): Promise<void> {
    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
    }
    const tmp = `${filePath}.tmp`
    await writeFile(tmp, JSON.stringify(annotations, null, 2), 'utf-8')
    await rename(tmp, filePath)
}

/**
 * Appends a single annotation to the store. Reads the current list, pushes
 * the new entry, and writes the updated list atomically.
 */
export async function appendAnnotation(filePath: string, annotation: FlintAnnotation): Promise<void> {
    const current = await readAnnotations(filePath)
    current.push(annotation)
    await writeAnnotations(filePath, current)
}

/**
 * Marks the annotation with `id` as resolved. Sets status → 'resolved' and
 * resolvedAt → current ISO timestamp. Returns false if the id was not found.
 */
export async function resolveAnnotation(filePath: string, id: string): Promise<boolean> {
    const current = await readAnnotations(filePath)
    const idx = current.findIndex((a) => a.id === id)
    if (idx === -1) return false
    current[idx] = {
        ...current[idx]!,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
    }
    await writeAnnotations(filePath, current)
    return true
}
