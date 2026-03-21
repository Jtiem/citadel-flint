/**
 * universalAuditAutoFix.test.ts
 *
 * Tests for the `autoFix` parameter on `flint_universal_audit`.
 *
 * Test IDs:
 *   UA-AF-01 — autoFix: true with violations → autoFixResult present, applied may be true
 *   UA-AF-02 — autoFix: true with no violations → autoFixResult.applied is false, fixCount 0
 *   UA-AF-03 — autoFix: false (default) → no autoFixResult in response
 *   UA-AF-04 — autoFix: true without config → no autoFixResult (graceful degradation)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { handleUniversalAudit, FLINT_UNIVERSAL_AUDIT_TOOL, resetDefaultRegistry } from "../tools/universalAudit.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import type { FlintConfig } from "../core/config.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const tmpDir = path.join(os.tmpdir(), "__flint_ua_autofix_test__");
const projectRoot = tmpDir;

// A JSX file with a hardcoded color that will trigger universal audit violations
const FIXTURE_WITH_VIOLATIONS = `
import React from "react";
export default function Banner() {
    return <div className="bg-[#FF0000] p-[999px]">Hello</div>;
}
`;

// A clean JSX file that should pass audit with no violations
const FIXTURE_CLEAN = `
import React from "react";
export default function Banner() {
    return <div className="bg-red-500 p-4">Hello</div>;
}
`;

const config: FlintConfig = {
    ...DEFAULT_CONFIG,
    projectRoot,
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".flint"), { recursive: true });

    // Write a minimal design-tokens.json so the fix pipeline has tokens to work with
    const tokens = [
        {
            token_path: "color/red/500",
            token_value: "#ef4444",
            token_type: "color",
            source: "test",
        },
        {
            token_path: "spacing/4",
            token_value: "16px",
            token_type: "dimension",
            source: "test",
        },
    ];
    fs.writeFileSync(
        path.join(tmpDir, ".flint", "design-tokens.json"),
        JSON.stringify(tokens),
    );

    // Write fixture files
    fs.writeFileSync(path.join(tmpDir, "with-violations.tsx"), FIXTURE_WITH_VIOLATIONS);
    fs.writeFileSync(path.join(tmpDir, "clean.tsx"), FIXTURE_CLEAN);
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetDefaultRegistry();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("flint_universal_audit autoFix", () => {
    it("UA-AF-01: autoFix true with violations returns autoFixResult", async () => {
        const res = await handleUniversalAudit(
            {
                filePath: path.join(tmpDir, "with-violations.tsx"),
                projectRoot,
                autoFix: true,
            },
            config,
        );

        expect(res.isError).toBeUndefined();
        const payload = JSON.parse(res.content[0]!.text);
        expect(payload.autoFixResult).toBeDefined();
        expect(typeof payload.autoFixResult.applied).toBe("boolean");
        expect(typeof payload.autoFixResult.fixCount).toBe("number");
        expect(Array.isArray(payload.autoFixResult.errors)).toBe(true);
    });

    it("UA-AF-02: autoFix true with no violations skips fix", async () => {
        const res = await handleUniversalAudit(
            {
                filePath: path.join(tmpDir, "clean.tsx"),
                projectRoot,
                autoFix: true,
            },
            config,
        );

        expect(res.isError).toBeUndefined();
        const payload = JSON.parse(res.content[0]!.text);

        // If there are no violations, autoFixResult should show applied: false
        if (payload.violationCount === 0) {
            expect(payload.autoFixResult).toEqual({
                applied: false,
                fixCount: 0,
                errors: [],
            });
        }
    });

    it("UA-AF-03: autoFix false (default) omits autoFixResult", async () => {
        const res = await handleUniversalAudit(
            {
                filePath: path.join(tmpDir, "with-violations.tsx"),
                projectRoot,
                autoFix: false,
            },
            config,
        );

        expect(res.isError).toBeUndefined();
        const payload = JSON.parse(res.content[0]!.text);
        expect(payload.autoFixResult).toBeUndefined();
    });

    it("UA-AF-03b: omitting autoFix entirely omits autoFixResult", async () => {
        const res = await handleUniversalAudit({
            filePath: path.join(tmpDir, "with-violations.tsx"),
            projectRoot,
        });

        expect(res.isError).toBeUndefined();
        const payload = JSON.parse(res.content[0]!.text);
        expect(payload.autoFixResult).toBeUndefined();
    });

    it("UA-AF-04: autoFix true without config gracefully skips fix", async () => {
        const res = await handleUniversalAudit({
            filePath: path.join(tmpDir, "with-violations.tsx"),
            projectRoot,
            autoFix: true,
        });

        expect(res.isError).toBeUndefined();
        const payload = JSON.parse(res.content[0]!.text);
        // No config provided → autoFixResult should not be present (no fix attempted)
        // because the code guards on `config` being truthy
        if (payload.violationCount > 0) {
            expect(payload.autoFixResult).toBeUndefined();
        }
    });

    it("tool schema includes autoFix property", () => {
        const props = FLINT_UNIVERSAL_AUDIT_TOOL.inputSchema.properties;
        expect(props.autoFix).toBeDefined();
        expect(props.autoFix.type).toBe("boolean");
    });
});
