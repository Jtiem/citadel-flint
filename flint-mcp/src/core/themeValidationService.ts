/**
 * ThemeValidationService — flint-mcp/src/core/themeValidationService.ts
 *
 * EXP.4: White-Label / Multi-Brand Theming
 *
 * Validates a single codebase against multiple brand token sets, producing
 * a cross-theme compliance matrix. Each "theme" is a DTCG token file (.json).
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { auditAll } from "./MithrilLinter.js";
import type { DesignToken, LinterWarning } from "../types.js";
import type { File as BabelFile } from "@babel/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ThemeInfo {
    name: string;
    tokenFile: string;
    tokenCount: number;
}

export interface FileThemeResult {
    themeName: string;
    violations: LinterWarning[];
    score: number;
}

export interface FileValidationResult {
    filePath: string;
    results: FileThemeResult[];
}

export interface ThemeMatrixEntry {
    totalViolations: number;
    uniqueViolations: number;
    complianceScore: number;
}

export interface CrossThemeDelta {
    ruleId: string;
    message: string;
    affectedThemes: string[];
    notAffectedThemes: string[];
}

export interface ThemeValidationReport {
    themes: ThemeInfo[];
    files: FileValidationResult[];
    matrix: Record<string, ThemeMatrixEntry>;
    crossThemeDelta: CrossThemeDelta[];
}

// ── Token loading ──────────────────────────────────────────────────────────

/**
 * Load a DTCG token file and flatten it into DesignToken[].
 * Supports both flat arrays and nested DTCG objects with $value/$type.
 */
export function loadTokenFile(filePath: string): DesignToken[] {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    // If it's already an array of DesignToken-shaped objects, use directly
    if (Array.isArray(parsed)) {
        return parsed.map((entry: Record<string, unknown>, i: number) => ({
            id: i,
            token_path: (entry.token_path as string) ?? (entry.name as string) ?? `token-${i}`,
            token_type: (entry.token_type as DesignToken["token_type"]) ?? (entry.$type as DesignToken["token_type"]) ?? "color",
            token_value: (entry.token_value as string) ?? (entry.$value as string) ?? "",
            description: (entry.description as string) ?? null,
            collection_name: (entry.collection_name as string) ?? path.basename(filePath, ".json"),
            mode: (entry.mode as string) ?? "default",
        }));
    }

    // Flatten nested DTCG object format
    const tokens: DesignToken[] = [];
    let idCounter = 0;
    const collectionName = path.basename(filePath, ".json");

    function walk(obj: Record<string, unknown>, prefix: string) {
        for (const [key, val] of Object.entries(obj)) {
            if (key.startsWith("$")) continue;
            const record = val as Record<string, unknown>;
            if (record.$value !== undefined) {
                tokens.push({
                    id: idCounter++,
                    token_path: prefix ? `${prefix}.${key}` : key,
                    token_type: (record.$type as DesignToken["token_type"]) ?? "color",
                    token_value: String(record.$value),
                    description: (record.$description as string) ?? null,
                    collection_name: collectionName,
                    mode: "default",
                });
            } else if (typeof record === "object" && record !== null) {
                walk(record, prefix ? `${prefix}.${key}` : key);
            }
        }
    }

    walk(parsed, "");
    return tokens;
}

// ── File parsing ──────────────────────────────────────────────────────────

function parseFile(filePath: string): BabelFile | null {
    try {
        const source = fs.readFileSync(filePath, "utf-8");
        return parse(source, {
            sourceType: "module",
            plugins: ["jsx", "typescript"],
        });
    } catch {
        return null;
    }
}

// ── Compliance score ──────────────────────────────────────────────────────

function computeScore(violations: LinterWarning[]): number {
    if (violations.length === 0) return 100;
    const criticalCount = violations.filter((v) => v.severity === "critical").length;
    const amberCount = violations.filter((v) => v.severity === "amber").length;
    const advisoryCount = violations.filter((v) => v.severity === "advisory").length;
    // Weighted penalty: critical=10, amber=5, advisory=1
    const penalty = criticalCount * 10 + amberCount * 5 + advisoryCount * 1;
    return Math.max(0, Math.round(100 - penalty));
}

// ── Single theme validation ──────────────────────────────────────────────

export function validateSingleTheme(
    projectRoot: string,
    themeFile: string,
    filePaths: string[],
): { theme: ThemeInfo; files: { filePath: string; violations: LinterWarning[]; score: number }[] } {
    const tokenPath = path.isAbsolute(themeFile) ? themeFile : path.resolve(projectRoot, themeFile);
    const tokens = loadTokenFile(tokenPath);
    const themeName = path.basename(themeFile, ".json");

    const files: { filePath: string; violations: LinterWarning[]; score: number }[] = [];

    for (const fp of filePaths) {
        const absPath = path.isAbsolute(fp) ? fp : path.resolve(projectRoot, fp);
        const ast = parseFile(absPath);
        if (ast === null) {
            files.push({ filePath: fp, violations: [], score: 100 });
            continue;
        }
        const warningMap = auditAll(ast, tokens);
        const violations = Array.from(warningMap.values());
        files.push({ filePath: fp, violations, score: computeScore(violations) });
    }

    return {
        theme: { name: themeName, tokenFile: themeFile, tokenCount: tokens.length },
        files,
    };
}

// ── Multi-theme validation ───────────────────────────────────────────────

export function validateThemes(
    projectRoot: string,
    themeFiles: string[],
    filePaths: string[],
): ThemeValidationReport {
    if (themeFiles.length === 0) {
        return { themes: [], files: [], matrix: {}, crossThemeDelta: [] };
    }

    // Validate each theme
    const themeResults = themeFiles.map((tf) => validateSingleTheme(projectRoot, tf, filePaths));

    // Build themes array
    const themes: ThemeInfo[] = themeResults.map((r) => r.theme);

    // Build files array (each file has results for each theme)
    const fileMap = new Map<string, FileThemeResult[]>();
    for (const tr of themeResults) {
        for (const fr of tr.files) {
            if (!fileMap.has(fr.filePath)) fileMap.set(fr.filePath, []);
            fileMap.get(fr.filePath)!.push({
                themeName: tr.theme.name,
                violations: fr.violations,
                score: fr.score,
            });
        }
    }
    const files: FileValidationResult[] = Array.from(fileMap.entries()).map(([filePath, results]) => ({
        filePath,
        results,
    }));

    // Build matrix
    const matrix: Record<string, ThemeMatrixEntry> = {};
    for (const tr of themeResults) {
        const allViolations = tr.files.flatMap((f) => f.violations);
        const uniqueRules = new Set(allViolations.map((v) => `${v.id}:${v.ruleId ?? v.type}`));
        const scores = tr.files.map((f) => f.score);
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
        matrix[tr.theme.name] = {
            totalViolations: allViolations.length,
            uniqueViolations: uniqueRules.size,
            complianceScore: avgScore,
        };
    }

    // Build crossThemeDelta — violations that appear in some themes but not all
    const allThemeNames = themes.map((t) => t.name);
    // ruleId -> set of themes that have this violation
    const ruleThemeMap = new Map<string, { themes: Set<string>; message: string }>();
    for (const tr of themeResults) {
        for (const fr of tr.files) {
            for (const v of fr.violations) {
                const key = v.ruleId ?? v.type;
                if (!ruleThemeMap.has(key)) {
                    ruleThemeMap.set(key, { themes: new Set(), message: v.message });
                }
                ruleThemeMap.get(key)!.themes.add(tr.theme.name);
            }
        }
    }

    const crossThemeDelta: CrossThemeDelta[] = [];
    for (const [ruleId, entry] of ruleThemeMap) {
        // Only include if not all themes are affected (that's a universal violation, not a delta)
        if (entry.themes.size < allThemeNames.length) {
            crossThemeDelta.push({
                ruleId,
                message: entry.message,
                affectedThemes: Array.from(entry.themes),
                notAffectedThemes: allThemeNames.filter((t) => !entry.themes.has(t)),
            });
        }
    }

    return { themes, files, matrix, crossThemeDelta };
}
