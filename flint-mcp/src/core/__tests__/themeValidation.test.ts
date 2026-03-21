import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { validateThemes, validateSingleTheme, loadTokenFile } from "../themeValidationService.js";

// ── Helpers ────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "theme-val-"));
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content: string): string {
    const p = path.join(tmpDir, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf-8");
    return p;
}

function makeTokenFile(name: string, tokens: Array<{ token_path: string; token_type: string; token_value: string }>): string {
    return writeFile(name, JSON.stringify(tokens));
}

function makeDTCGTokenFile(name: string, obj: Record<string, unknown>): string {
    return writeFile(name, JSON.stringify(obj));
}

function makeComponent(name: string, content: string): string {
    return writeFile(name, content);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("themeValidationService", () => {
    describe("loadTokenFile", () => {
        it("loads flat array format", () => {
            const f = makeTokenFile("flat.json", [
                { token_path: "color.primary", token_type: "color", token_value: "#ff0000" },
            ]);
            const tokens = loadTokenFile(f);
            expect(tokens).toHaveLength(1);
            expect(tokens[0].token_path).toBe("color.primary");
            expect(tokens[0].token_value).toBe("#ff0000");
        });

        it("loads nested DTCG format", () => {
            const f = makeDTCGTokenFile("dtcg.json", {
                color: {
                    primary: { $value: "#00ff00", $type: "color" },
                    secondary: { $value: "#0000ff", $type: "color" },
                },
            });
            const tokens = loadTokenFile(f);
            expect(tokens).toHaveLength(2);
            expect(tokens[0].token_path).toBe("color.primary");
            expect(tokens[1].token_path).toBe("color.secondary");
        });
    });

    describe("validateThemes", () => {
        it("returns empty report for empty themes array", () => {
            const report = validateThemes(tmpDir, [], ["some-file.tsx"]);
            expect(report.themes).toEqual([]);
            expect(report.files).toEqual([]);
            expect(report.matrix).toEqual({});
            expect(report.crossThemeDelta).toEqual([]);
        });

        it("validates single theme correctly", () => {
            const tokenFile = makeTokenFile("brand-a.json", [
                { token_path: "color.primary", token_type: "color", token_value: "#3b82f6" },
            ]);
            const comp = makeComponent("SingleTheme.tsx", `
export default function Card() {
    return <div data-flint-id="card-1" className="bg-[#3b82f6]">Hello</div>;
}
`);
            const report = validateThemes(tmpDir, [tokenFile], [comp]);
            expect(report.themes).toHaveLength(1);
            expect(report.themes[0].tokenCount).toBe(1);
            expect(report.files).toHaveLength(1);
            expect(report.files[0].results).toHaveLength(1);
            // Color matches the token exactly, so no violations
            expect(report.files[0].results[0].violations).toHaveLength(0);
            expect(report.files[0].results[0].score).toBe(100);
            expect(report.matrix[report.themes[0].name].complianceScore).toBe(100);
        });

        it("detects cross-theme delta for theme-specific violations", () => {
            // Brand A has a matching color token, Brand B does not
            const tokenA = makeTokenFile("brand-match.json", [
                { token_path: "color.primary", token_type: "color", token_value: "#ff0000" },
            ]);
            const tokenB = makeTokenFile("brand-nomatch.json", [
                { token_path: "color.primary", token_type: "color", token_value: "#00ff00" },
            ]);
            // Component uses #ff0000 — matches Brand A but drifts from Brand B
            const comp = makeComponent("CrossDelta.tsx", `
export default function Alert() {
    return <div data-flint-id="alert-1" className="bg-[#ff0000]">Warning</div>;
}
`);
            const report = validateThemes(tmpDir, [tokenA, tokenB], [comp]);
            expect(report.themes).toHaveLength(2);
            // Brand A should have 0 violations (exact match), Brand B should have 1+
            const brandAResult = report.files[0].results.find((r) => r.themeName === "brand-match");
            const brandBResult = report.files[0].results.find((r) => r.themeName === "brand-nomatch");
            expect(brandAResult!.violations).toHaveLength(0);
            expect(brandBResult!.violations.length).toBeGreaterThan(0);
            // Cross-theme delta should show the violation affects only Brand B
            expect(report.crossThemeDelta.length).toBeGreaterThan(0);
            const delta = report.crossThemeDelta[0];
            expect(delta.affectedThemes).toContain("brand-nomatch");
            expect(delta.notAffectedThemes).toContain("brand-match");
        });

        it("handles file not found gracefully", () => {
            const tokenFile = makeTokenFile("brand-grace.json", [
                { token_path: "color.primary", token_type: "color", token_value: "#000000" },
            ]);
            const report = validateThemes(tmpDir, [tokenFile], ["/nonexistent/file.tsx"]);
            expect(report.files).toHaveLength(1);
            // Unparseable file → no violations, score 100
            expect(report.files[0].results[0].violations).toHaveLength(0);
            expect(report.files[0].results[0].score).toBe(100);
        });

        it("computes compliance scores correctly", () => {
            const tokenFile = makeTokenFile("brand-score.json", [
                { token_path: "color.primary", token_type: "color", token_value: "#0000ff" },
            ]);
            // Use a color far from the token to trigger a violation
            const comp = makeComponent("ScoreTest.tsx", `
export default function Box() {
    return <div data-flint-id="box-1" className="bg-[#ff0000]">Red</div>;
}
`);
            const report = validateThemes(tmpDir, [tokenFile], [comp]);
            const entry = report.matrix[report.themes[0].name];
            expect(entry.totalViolations).toBeGreaterThan(0);
            expect(entry.complianceScore).toBeLessThan(100);
        });
    });

    describe("validateSingleTheme", () => {
        it("returns theme info and file results", () => {
            const tokenFile = makeTokenFile("single-brand.json", [
                { token_path: "color.bg", token_type: "color", token_value: "#ffffff" },
            ]);
            const comp = makeComponent("Single.tsx", `
export default function Page() {
    return <div data-flint-id="page-1" className="bg-[#ffffff]">White</div>;
}
`);
            const result = validateSingleTheme(tmpDir, tokenFile, [comp]);
            expect(result.theme.name).toBe("single-brand");
            expect(result.theme.tokenCount).toBe(1);
            expect(result.files).toHaveLength(1);
            expect(result.files[0].score).toBe(100);
        });
    });
});
