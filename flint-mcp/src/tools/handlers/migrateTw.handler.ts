/**
 * Sprint 4 — D2: flint_migrate_tw extracted handler.
 *
 * Tailwind v3 → v4 AST-level class migration with optional post-migration audit.
 * Body lifted verbatim from server.ts.
 *
 * Contract: .flint-context/contracts/sprint-4-mcp-server.contract.ts (D2)
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ResolvedToolContext } from './types.js'
import { migrateFile } from '../../core/tailwindMigrator.js'
import type { MigrateResult } from '../../core/tailwindMigrator.js'
import { handleFlintAudit } from '../audit.js'
import { toolError, HINTS } from '../../core/errorResponse.js'

export interface FlintMigrateTwArgs {
    filePaths: string[]
    glob?: string
    dryRun?: boolean
    from?: '3'
    to?: '4'
}

export async function handleMigrateTw(
    twArgs: FlintMigrateTwArgs,
    ctx: ResolvedToolContext,
) {
    const { flintConfig } = ctx

    // Prevent path traversal in glob patterns.
    if (twArgs.glob && (twArgs.glob.includes('..') || path.isAbsolute(twArgs.glob))) {
        return toolError(
            'flint_migrate_tw',
            new Error('Invalid glob: path traversal and absolute paths are not permitted'),
            HINTS.missingParam("flint_migrate_tw filePaths=['src/**/*.tsx']"),
        )
    }

    if (!Array.isArray(twArgs.filePaths) || twArgs.filePaths.length === 0) {
        return toolError(
            'flint_migrate_tw',
            new Error("'filePaths' must be a non-empty array of absolute file paths."),
            HINTS.missingParam("flint_migrate_tw filePaths=['/abs/path/to/component.tsx']"),
        )
    }

    const dryRun = twArgs.dryRun !== false // default true
    const perFileReports: Array<{
        filePath: string
        fileChanged: boolean
        changeCount: number
        changes: MigrateResult['changes']
        auditViolationCount: number | null
        error?: string
    }> = []

    for (const filePath of twArgs.filePaths) {
        if (!fs.existsSync(filePath)) {
            perFileReports.push({
                filePath,
                fileChanged: false,
                changeCount: 0,
                changes: [],
                auditViolationCount: null,
                error: `File not found: ${filePath}`,
            })
            continue
        }

        let migResult: MigrateResult
        try {
            const source = fs.readFileSync(filePath, 'utf-8')
            migResult = migrateFile(source, { dryRun, filePath, from: twArgs.from, to: twArgs.to })
            if (!dryRun && migResult.fileChanged) {
                fs.writeFileSync(filePath, migResult.migratedSource, 'utf-8')
            }
        } catch (err) {
            perFileReports.push({
                filePath,
                fileChanged: false,
                changeCount: 0,
                changes: [],
                auditViolationCount: null,
                error: err instanceof Error ? err.message : String(err),
            })
            continue
        }

        // Post-migration audit on migrated source.
        let auditViolationCount: number | null = null
        if (migResult.fileChanged || !dryRun) {
            try {
                const sourceToAudit = migResult.fileChanged
                    ? migResult.migratedSource
                    : fs.readFileSync(filePath, 'utf-8')
                const auditResult = await handleFlintAudit(
                    { source: sourceToAudit, filePath },
                    flintConfig,
                )
                auditViolationCount = auditResult.violations
                    ? (auditResult.violations as unknown[]).length
                    : 0
            } catch {
                // Audit is best-effort — never block migration result
            }
        }

        perFileReports.push({
            filePath,
            fileChanged: migResult.fileChanged,
            changeCount: migResult.changes.length,
            changes: migResult.changes,
            auditViolationCount,
        })
    }

    const totalChanged = perFileReports.filter((r) => r.fileChanged).length
    const totalChanges = perFileReports.reduce((acc, r) => acc + r.changeCount, 0)
    const summary = dryRun
        ? `Dry-run complete. ${totalChanges} class replacement(s) found across ${totalChanged}/${twArgs.filePaths.length} file(s). No files were written.`
        : `Migration complete. ${totalChanges} class replacement(s) applied across ${totalChanged}/${twArgs.filePaths.length} file(s).`

    const twRecommendation =
        totalChanges > 0
            ? dryRun
                ? `${totalChanges} class(es) ready to migrate. Run again without dry-run to apply.`
                : `Migration complete. Run 'audit' to check for remaining drifts.`
            : 'No Tailwind v3 classes found — already up to date.'

    return {
        content: [{
            type: 'text',
            text: JSON.stringify(
                { summary, dryRun, files: perFileReports, recommendation: twRecommendation },
                null,
                2,
            ),
        }],
    }
}
