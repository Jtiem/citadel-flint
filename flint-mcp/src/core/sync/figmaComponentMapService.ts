/**
 * figmaComponentMapService — flint-mcp/src/core/sync/figmaComponentMapService.ts
 *
 * FIGMA-MAP.1: Persistent mapping between Figma component IDs and project
 * component names. Backed by SQLite for durability across sessions.
 *
 * The mapping is project-scoped (keyed by projectRoot) and supports:
 *   - Single upsert (link one Figma component to one project component)
 *   - Batch upsert (bulk import from ingestion pipeline)
 *   - Lookup by Figma ID (deterministic component resolution)
 *   - Lookup by project component name (reverse mapping for export)
 *   - List all mappings (for UI display and audit)
 *   - Delete (unlink a mapping)
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FigmaComponentMapping {
    figmaComponentId: string
    figmaFileKey: string
    figmaComponentName: string
    projectComponentName: string
    importPath: string
    confidence: 'manual' | 'auto-name' | 'auto-id'
    updatedAt: string
}

// ── Service ──────────────────────────────────────────────────────────────────

export class FigmaComponentMapService {
    private db: Database.Database

    constructor(projectRoot: string) {
        const dbDir = path.join(projectRoot, '.flint')
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
        const dbPath = path.join(dbDir, 'figma-component-map.db')
        this.db = new Database(dbPath)
        this.ensureTable()
    }

    private ensureTable(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS figma_component_mappings (
                figma_component_id TEXT PRIMARY KEY,
                figma_file_key TEXT NOT NULL,
                figma_component_name TEXT NOT NULL,
                project_component_name TEXT NOT NULL,
                import_path TEXT NOT NULL DEFAULT '',
                confidence TEXT NOT NULL DEFAULT 'auto-name',
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `)
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_fcm_project_name
            ON figma_component_mappings(project_component_name)
        `)
    }

    /**
     * Upsert a single mapping. Overwrites if figmaComponentId already exists.
     */
    upsert(mapping: FigmaComponentMapping): void {
        const stmt = this.db.prepare(`
            INSERT INTO figma_component_mappings
                (figma_component_id, figma_file_key, figma_component_name, project_component_name, import_path, confidence, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(figma_component_id) DO UPDATE SET
                figma_file_key = excluded.figma_file_key,
                figma_component_name = excluded.figma_component_name,
                project_component_name = excluded.project_component_name,
                import_path = excluded.import_path,
                confidence = excluded.confidence,
                updated_at = datetime('now')
        `)
        stmt.run(
            mapping.figmaComponentId,
            mapping.figmaFileKey,
            mapping.figmaComponentName,
            mapping.projectComponentName,
            mapping.importPath,
            mapping.confidence,
        )
    }

    /**
     * Batch upsert from an ingestion payload. Uses a transaction for atomicity.
     */
    batchUpsert(mappings: FigmaComponentMapping[]): number {
        const upsertMany = this.db.transaction((items: FigmaComponentMapping[]) => {
            let count = 0
            for (const m of items) {
                this.upsert(m)
                count++
            }
            return count
        })
        return upsertMany(mappings)
    }

    /**
     * Look up a project component by Figma component ID.
     * Returns null if no mapping exists.
     */
    lookupByFigmaId(figmaComponentId: string): FigmaComponentMapping | null {
        const stmt = this.db.prepare(`
            SELECT figma_component_id as figmaComponentId,
                   figma_file_key as figmaFileKey,
                   figma_component_name as figmaComponentName,
                   project_component_name as projectComponentName,
                   import_path as importPath,
                   confidence,
                   updated_at as updatedAt
            FROM figma_component_mappings
            WHERE figma_component_id = ?
        `)
        return (stmt.get(figmaComponentId) as FigmaComponentMapping) ?? null
    }

    /**
     * Reverse lookup: find all Figma components mapped to a project component.
     */
    lookupByProjectComponent(projectComponentName: string): FigmaComponentMapping[] {
        const stmt = this.db.prepare(`
            SELECT figma_component_id as figmaComponentId,
                   figma_file_key as figmaFileKey,
                   figma_component_name as figmaComponentName,
                   project_component_name as projectComponentName,
                   import_path as importPath,
                   confidence,
                   updated_at as updatedAt
            FROM figma_component_mappings
            WHERE project_component_name = ?
        `)
        return stmt.all(projectComponentName) as FigmaComponentMapping[]
    }

    /**
     * List all mappings, optionally filtered by file key.
     */
    listAll(figmaFileKey?: string): FigmaComponentMapping[] {
        if (figmaFileKey) {
            const stmt = this.db.prepare(`
                SELECT figma_component_id as figmaComponentId,
                       figma_file_key as figmaFileKey,
                       figma_component_name as figmaComponentName,
                       project_component_name as projectComponentName,
                       import_path as importPath,
                       confidence,
                       updated_at as updatedAt
                FROM figma_component_mappings
                WHERE figma_file_key = ?
                ORDER BY project_component_name
            `)
            return stmt.all(figmaFileKey) as FigmaComponentMapping[]
        }
        const stmt = this.db.prepare(`
            SELECT figma_component_id as figmaComponentId,
                   figma_file_key as figmaFileKey,
                   figma_component_name as figmaComponentName,
                   project_component_name as projectComponentName,
                   import_path as importPath,
                   confidence,
                   updated_at as updatedAt
            FROM figma_component_mappings
            ORDER BY project_component_name
        `)
        return stmt.all() as FigmaComponentMapping[]
    }

    /**
     * Delete a mapping by Figma component ID.
     */
    delete(figmaComponentId: string): boolean {
        const stmt = this.db.prepare('DELETE FROM figma_component_mappings WHERE figma_component_id = ?')
        return stmt.run(figmaComponentId).changes > 0
    }

    /**
     * Auto-map: given a list of Figma component names from an ingestion payload
     * and a project component registry, create mappings by exact name match.
     * Returns the number of new mappings created.
     */
    autoMapByName(
        figmaComponents: Array<{ id: string; name: string; fileKey: string }>,
        projectComponents: Record<string, { importPath: string }>
    ): number {
        let mapped = 0
        for (const fc of figmaComponents) {
            // Exact name match (case-insensitive)
            const match = Object.entries(projectComponents).find(
                ([name]) => name.toLowerCase() === fc.name.toLowerCase()
            )
            if (match) {
                this.upsert({
                    figmaComponentId: fc.id,
                    figmaFileKey: fc.fileKey,
                    figmaComponentName: fc.name,
                    projectComponentName: match[0],
                    importPath: match[1].importPath,
                    confidence: 'auto-name',
                    updatedAt: new Date().toISOString(),
                })
                mapped++
            }
        }
        return mapped
    }

    close(): void {
        this.db.close()
    }
}
