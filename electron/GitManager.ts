/**
 * GitManager — electron/GitManager.ts
 *
 * Provides git-backed shadow history for the Flint Macro-Recovery Engine.
 *
 * Three public methods:
 *   ensureRepo    — initialises a git repository at projectPath if one is absent.
 *   shadowCommit  — stages all working-tree changes and creates a labelled commit.
 *   getGitNode    — retrieves a specific JSX node from a historical commit by
 *                   its data-flint-id attribute.
 *
 * All git operations use execFile with array arguments — no shell interpolation.
 *
 * Commandment 11 (Surgical Git Transplants): Only git show for historical reads;
 *   never git checkout.
 * Commandment 13 (Deterministic Surgery): shadowCommit must only be called after
 *   fileTransactionManager resolves so the disk state is flushed first.
 *
 * Main Process only — no imports from src/.
 */

import { execFile } from 'node:child_process'
import { writeFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { parse } from '@babel/parser'
import type { Node } from '@babel/types'

const execFileAsync = promisify(execFile)

const GITIGNORE_CONTENT = 'node_modules\n.flint/tmp\n'

// ── AST Walker ────────────────────────────────────────────────────────────────

/**
 * Recursively walks a Babel AST node looking for a JSXElement whose
 * JSXOpeningElement carries a `data-flint-id` attribute equal to `targetId`.
 *
 * Returns the [start, end] character offsets of the matching JSXElement in the
 * original source string, or null if no match is found.
 */
function findFlintIdOffsets(node: Node, targetId: string): [number, number] | null {
    if (node.type === 'JSXElement') {
        for (const attr of node.openingElement.attributes) {
            if (
                attr.type === 'JSXAttribute' &&
                attr.name.type === 'JSXIdentifier' &&
                attr.name.name === 'data-flint-id' &&
                attr.value?.type === 'StringLiteral' &&
                attr.value.value === targetId &&
                node.start != null &&
                node.end != null
            ) {
                return [node.start, node.end]
            }
        }
    }

    // Recurse into all child properties that are nodes or arrays of nodes
    for (const key of Object.keys(node)) {
        const child = (node as unknown as Record<string, unknown>)[key]
        if (Array.isArray(child)) {
            for (const item of child) {
                if (item != null && typeof item === 'object' && 'type' in item) {
                    const found = findFlintIdOffsets(item as Node, targetId)
                    if (found) return found
                }
            }
        } else if (child != null && typeof child === 'object' && 'type' in child) {
            const found = findFlintIdOffsets(child as Node, targetId)
            if (found) return found
        }
    }

    return null
}

// ── GitManager ────────────────────────────────────────────────────────────────

export class GitManager {
    /**
     * Ensures `projectPath` has an initialised git repository.
     *
     * If `.git` is absent:
     *   1. Runs `git init`
     *   2. Writes `.gitignore` (node_modules, .flint/tmp)
     *   3. Configures repo-local identity (flint@local / Flint Glass) so commits
     *      work in environments with no global git user config.
     *   4. Stages all files with `git add .`
     *   5. Creates an initial `flint:init` commit (--allow-empty for safety).
     *
     * Idempotent — if `.git` already exists the method returns immediately.
     */
    async ensureRepo(projectPath: string): Promise<void> {
        try {
            // If this succeeds, we are already inside a git repository.
            await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: projectPath })
            return
        } catch {
            // Not a repo — fall through to initialisation.
        }

        await execFileAsync('git', ['init'], { cwd: projectPath })
        await writeFile(path.join(projectPath, '.gitignore'), GITIGNORE_CONTENT, 'utf8')

        // Configure repo-local identity so `git commit` succeeds without global config.
        await execFileAsync('git', ['config', 'user.email', 'flint@local'], { cwd: projectPath })
        await execFileAsync('git', ['config', 'user.name', 'Flint'], { cwd: projectPath })

        // Stage everything (including template files when called after initializeProject).
        await execFileAsync('git', ['add', '.'], { cwd: projectPath })
        await execFileAsync(
            'git', ['commit', '-m', 'flint:init', '--allow-empty'],
            { cwd: projectPath }
        )

        console.log(`[Flint] GitManager: initialised git repo at ${projectPath}`)
    }

    /**
     * Stages all working-tree changes under the git root containing `cwd` and
     * creates a shadow commit labelled "flint:sync:{batchId}".
     *
     * Silent no-op when:
     *   - `cwd` is not inside a git repository.
     *   - The working tree has no staged or unstaged changes to commit.
     *
     * MUST be called only after `fileTransactionManager` resolves (Commandment 13)
     * so the disk state is flushed before the commit is generated.
     *
     * @param cwd     — Any directory within the target project (used to find git root).
     * @param batchId — Optional label appended to the commit message.
     *                  Defaults to a random UUID if omitted.
     */
    async shadowCommit(cwd: string, batchId?: string): Promise<void> {
        const gitRoot = await this._getGitRoot(cwd)
        if (!gitRoot) return

        const id = batchId ?? randomUUID()
        // Stage .flint/ metadata files (always).
        // Guard: if .flint/ does not exist yet, git add will throw — skip.
        try {
            await execFileAsync('git', ['add', '.flint/'], { cwd: gitRoot })
        } catch {
            // .flint/ not present or nothing to add — treat as no-op
        }

        // Stage source files so Rewind/Time Machine can recover code changes.
        // We use targeted glob patterns instead of `git add .` to avoid staging
        // vite.config.ts (which would trigger Vite's file watcher → restart loop).
        const sourcePatterns = ['src/', '*.tsx', '*.ts', '*.jsx', '*.js', '*.css']
        for (const pattern of sourcePatterns) {
            try {
                await execFileAsync('git', ['add', pattern], { cwd: gitRoot })
            } catch {
                // Pattern didn't match any files — harmless, continue
            }
        }

        // Avoid empty commits — check for staged changes first.
        const { stdout: status } = await execFileAsync(
            'git', ['status', '--porcelain'],
            { cwd: gitRoot }
        )
        if (!status.trim()) return

        await execFileAsync(
            'git', ['commit', '-m', `flint:sync:${id}`],
            { cwd: gitRoot }
        )
        console.log(`[Flint] GitManager: shadow commit flint:sync:${id}`)
    }

    /**
     * Returns the JSX source text of the element with `dataFlintId` from
     * `filePath` at `commitHash`.
     *
     * Steps:
     *   1. Resolves the git root from `filePath`'s directory.
     *   2. Runs `git show <commitHash>:<relPath>` to retrieve historical content.
     *   3. Parses with @babel/parser (TypeScript + JSX plugins).
     *   4. Walks the AST to locate the JSXElement with the matching flint ID.
     *   5. Returns the raw source slice for that element.
     *
     * Returns null when:
     *   - `filePath` is not in a git repository.
     *   - The commit or file does not exist in git history.
     *   - No element with the given flint ID exists in the historical file.
     *   - The file cannot be parsed as TypeScript/JSX.
     *
     * Read-only — never calls `git checkout` (Commandment 11).
     */
    async getGitNode(
        commitHash: string,
        filePath: string,
        dataFlintId: string
    ): Promise<string | null> {
        const gitRoot = await this._getGitRoot(path.dirname(filePath))
        if (!gitRoot) return null

        const realFilePath = await realpath(filePath).catch(() => filePath)
        const relPath = path.relative(gitRoot, realFilePath)
        let content: string
        try {
            const { stdout } = await execFileAsync(
                'git', ['show', `${commitHash}:${relPath}`],
                { cwd: gitRoot, maxBuffer: 2 * 1024 * 1024 }
            )
            content = stdout
        } catch (e) {
            console.error('git show failed:', e)
            return null
        }

        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
            })
            const offsets = findFlintIdOffsets(ast.program, dataFlintId)
            return offsets ? content.slice(offsets[0], offsets[1]) : null
        } catch (e) {
            console.error('parse failed:', e)
            return null
        }
    }

    /**
     * Clones a remote git repository into `destDir`.
     *
     * Uses execFile with array arguments — no shell interpolation (Commandment 14).
     * The URL is validated by the caller's anchored-regex heuristic before this
     * method is invoked; GitManager does not re-validate the URL shape.
     *
     * Hardening (Phase 2 fix-forward):
     *   - SEC-HIGH-2: `core.symlinks=false` blocks symlink-based escape attacks.
     *     A malicious repo can ship symlinks that point at ~/.ssh/, ~/.aws/, etc.;
     *     disabling symlinks at clone time means the working tree only contains
     *     plain files even if the upstream history references symlinks.
     *   - SEC-MED-1: `--depth=1 --single-branch` reduces clone surface and time;
     *     the 120s `timeout` aborts hanging clones (slow network, huge mono-repo).
     *   - SEC-MED-4: env scrubs `GIT_TERMINAL_PROMPT`/`GIT_ASKPASS`/`SSH_ASKPASS`
     *     so a private repo cannot block the main process waiting on credentials.
     *
     * Errors:
     *   - `clone-timeout` — kill signal SIGTERM after 120s (rethrown with code).
     *   - `auth-required` — non-zero exit with credential-related stderr.
     *   - other — original error rethrown unchanged.
     *
     * @param url     — A git-cloneable URL (https://, git@, or ssh://).
     * @param destDir — Absolute path to the directory that will contain the clone.
     *                  The parent must already exist; `git clone` creates `destDir`.
     */
    async clone(url: string, destDir: string): Promise<void> {
        try {
            await execFileAsync(
                'git',
                [
                    '-c', 'core.symlinks=false',
                    '-c', 'core.askPass=true',
                    'clone',
                    '--depth=1',
                    '--single-branch',
                    '--',
                    url,
                    destDir,
                ],
                {
                    timeout: 120_000,
                    env: {
                        ...process.env,
                        GIT_TERMINAL_PROMPT: '0',
                        GIT_ASKPASS: 'echo',
                        SSH_ASKPASS: 'echo',
                    },
                },
            )
        } catch (err) {
            const e = err as NodeJS.ErrnoException & { signal?: string; stderr?: string }
            if (e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT') {
                throw new Error(`[Flint] GitManager: clone-timeout — git clone exceeded 120s for ${url}`)
            }
            const stderr = String(e.stderr ?? '')
            if (
                /could not read/i.test(stderr) ||
                /authentication failed/i.test(stderr) ||
                /permission denied/i.test(stderr) ||
                /terminal prompts disabled/i.test(stderr)
            ) {
                throw new Error(`[Flint] GitManager: auth-required — credentials needed for ${url}`)
            }
            throw err
        }
        console.log(`[Flint] GitManager: cloned ${url} → ${destDir}`)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Returns the absolute git root for `cwd`, or null if the directory is not
     * inside a git repository.
     */
    private async _getGitRoot(cwd: string): Promise<string | null> {
        try {
            const { stdout } = await execFileAsync(
                'git', ['rev-parse', '--show-toplevel'],
                { cwd }
            )
            return stdout.trim()
        } catch {
            return null
        }
    }
}

/** Module-level singleton — import this in electron/main.ts IPC handlers. */
export const gitManager = new GitManager()
