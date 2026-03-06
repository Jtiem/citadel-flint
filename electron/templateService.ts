/**
 * Template Service — electron/templateService.ts
 *
 * Scaffolds new Bridge workspaces by copying a bundled template into a
 * user-selected, empty directory (Commandment 4 — Local-First Only).
 *
 * Templates are stored under `electron/templates/{templateId}/` in the
 * application source tree. At runtime they are resolved via `app.getAppPath()`
 * so they are accessible in both development and production (.asar) builds.
 *
 * The Empty-Dir Gate ensures `initializeProject` never overwrites existing
 * work: it throws immediately if `targetPath` is non-empty.
 *
 * Security notes:
 *   • The caller (IPC handler) is responsible for validating that `targetPath`
 *     is absolute and strictly within the user's home directory.
 *   • `templateId` is validated against a strict allowlist of known template
 *     IDs before the path is joined, preventing path-traversal attacks.
 *   • `cpSync` with `{ recursive: true }` copies directory contents safely;
 *     no shell interpolation or external commands are used.
 */

import { cpSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/** Allowlist of valid template identifiers. */
const KNOWN_TEMPLATES = new Set(['base-vite-tailwind', 'bridge-demo'])

/** Absolute path to the bundled templates root directory. */
const TEMPLATES_DIR = path.join(app.getAppPath(), 'electron', 'templates')

/**
 * Copies the template identified by `templateId` into the empty `targetPath`.
 *
 * @param targetPath — Absolute path to the (empty) destination directory.
 *                     Validated by the IPC handler before this function is
 *                     called (absolute + inside home dir).
 * @param templateId — One of the values in `KNOWN_TEMPLATES`.
 *
 * @throws {Error} when `targetPath` is non-empty (Empty-Dir Gate).
 * @throws {Error} when `templateId` is not in the allowlist.
 * @throws {Error} when the underlying `cpSync` fails for any I/O reason.
 */
export function initializeProject(targetPath: string, templateId: string): void {
    // ── Template ID allowlist (prevents path traversal) ────────────────────────
    if (!KNOWN_TEMPLATES.has(templateId)) {
        throw new Error(`project:initialize — unknown templateId "${templateId}"`)
    }

    // ── Empty-Dir Gate (Security Boundary / Commandment) ───────────────────────
    // Abort if the target directory is not empty so we never overwrite the
    // user's existing work. readdirSync is synchronous and fine for small dirs.
    const entries = readdirSync(targetPath)
    if (entries.length > 0) {
        throw new Error(
            `project:initialize — target directory must be empty (found ${entries.length} item(s))`
        )
    }

    const templateSrc = path.join(TEMPLATES_DIR, templateId)

    // Recursive copy: mirrors the full template directory tree into targetPath.
    cpSync(templateSrc, targetPath, { recursive: true })
}

/**
 * Resets an existing directory to the known-good 'bridge-demo' state.
 * Unlike `initializeProject`, this purposefully overwrites existing files.
 *
 * @param targetPath — Absolute path to the destination directory.
 *                     Must be validated by the IPC handler (absolute + inside home dir).
 */
export function injectDemoState(targetPath: string): void {
    const templateSrc = path.join(app.getAppPath(), 'electron', 'templates', 'bridge-demo')

    // Copy the base demo over, overwriting existing files
    cpSync(templateSrc, targetPath, { recursive: true, force: true })
}
