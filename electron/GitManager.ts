/**
 * GitManager — electron/GitManager.ts
 *
 * Provides git-backed shadow history for the Bridge Macro-Recovery Engine.
 *
 * Three public methods:
 *   ensureRepo    — initialises a git repository at projectPath if one is absent.
 *   shadowCommit  — stages all working-tree changes and creates a labelled commit.
 *   getGitNode    — retrieves a specific JSX node from a historical commit by
 *                   its data-bridge-id attribute.
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

const GITIGNORE_CONTENT = 'node_modules\n.bridge/tmp\n'

// ── AST Walker ────────────────────────────────────────────────────────────────

/**
 * Recursively walks a Babel AST node looking for a JSXElement whose
 * JSXOpeningElement carries a `data-bridge-id` attribute equal to `targetId`.
 *
 * Returns the [start, end] character offsets of the matching JSXElement in the
 * original source string, or null if no match is found.
 */
function findBridgeIdOffsets(node: Node, targetId: string): [number, number] | null {
    if (node.type === 'JSXElement') {
        for (const attr of node.openingElement.attributes) {
            if (
                attr.type === 'JSXAttribute' &&
                attr.name.type === 'JSXIdentifier' &&
                attr.name.name === 'data-bridge-id'
            ) {
                console.log('found data-bridge-id attr:', attr.value)
            }
            if (
                attr.type === 'JSXAttribute' &&
                attr.name.type === 'JSXIdentifier' &&
                attr.name.name === 'data-bridge-id' &&
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
                    const found = findBridgeIdOffsets(item as Node, targetId)
                    if (found) return found
                }
            }
        } else if (child != null && typeof child === 'object' && 'type' in child) {
            const found = findBridgeIdOffsets(child as Node, targetId)
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
     *   2. Writes `.gitignore` (node_modules, .bridge/tmp)
     *   3. Configures repo-local identity (bridge@local / Bridge IDE) so commits
     *      work in environments with no global git user config.
     *   4. Stages all files with `git add .`
     *   5. Creates an initial `bridge:init` commit (--allow-empty for safety).
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
        await execFileAsync('git', ['config', 'user.email', 'bridge@local'], { cwd: projectPath })
        await execFileAsync('git', ['config', 'user.name', 'Bridge IDE'], { cwd: projectPath })

        // Stage everything (including template files when called after initializeProject).
        await execFileAsync('git', ['add', '.'], { cwd: projectPath })
        await execFileAsync(
            'git', ['commit', '-m', 'bridge:init', '--allow-empty'],
            { cwd: projectPath }
        )

        console.log(`[Bridge] GitManager: initialised git repo at ${projectPath}`)
    }

    /**
     * Stages all working-tree changes under the git root containing `cwd` and
     * creates a shadow commit labelled "bridge:sync:{batchId}".
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
        await execFileAsync('git', ['add', '.'], { cwd: gitRoot })

        // Avoid empty commits — check for staged changes first.
        const { stdout: status } = await execFileAsync(
            'git', ['status', '--porcelain'],
            { cwd: gitRoot }
        )
        if (!status.trim()) return

        await execFileAsync(
            'git', ['commit', '-m', `bridge:sync:${id}`],
            { cwd: gitRoot }
        )
        console.log(`[Bridge] GitManager: shadow commit bridge:sync:${id}`)
    }

    /**
     * Returns the JSX source text of the element with `dataBridgeId` from
     * `filePath` at `commitHash`.
     *
     * Steps:
     *   1. Resolves the git root from `filePath`'s directory.
     *   2. Runs `git show <commitHash>:<relPath>` to retrieve historical content.
     *   3. Parses with @babel/parser (TypeScript + JSX plugins).
     *   4. Walks the AST to locate the JSXElement with the matching bridge ID.
     *   5. Returns the raw source slice for that element.
     *
     * Returns null when:
     *   - `filePath` is not in a git repository.
     *   - The commit or file does not exist in git history.
     *   - No element with the given bridge ID exists in the historical file.
     *   - The file cannot be parsed as TypeScript/JSX.
     *
     * Read-only — never calls `git checkout` (Commandment 11).
     */
    async getGitNode(
        commitHash: string,
        filePath: string,
        dataBridgeId: string
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
            const offsets = findBridgeIdOffsets(ast.program, dataBridgeId)
            return offsets ? content.slice(offsets[0], offsets[1]) : null
        } catch (e) {
            console.error('parse failed:', e)
            return null
        }
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
