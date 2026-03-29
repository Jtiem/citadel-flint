import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildGreeting, detectReturningUser } from "../server.js";

// ---------------------------------------------------------------------------
// Strategy 1: The Greeter — context-aware welcome message
// ---------------------------------------------------------------------------

describe("buildGreeting", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flint-greeting-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // -- Size constraints -------------------------------------------------

    it("returns string under 2KB for new user", () => {
        const greeting = buildGreeting(tmpDir);
        expect(Buffer.byteLength(greeting, "utf-8")).toBeLessThan(2048);
    });

    it("returns string under 2KB for returning user", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "B", healthScore: 82 }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(Buffer.byteLength(greeting, "utf-8")).toBeLessThan(2048);
    });

    it("returning user version is shorter than new user version", () => {
        // New user
        const newGreeting = buildGreeting(tmpDir);

        // Set up returning user
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "A", healthScore: 95 }),
        );
        const returningGreeting = buildGreeting(tmpDir);

        expect(returningGreeting.length).toBeLessThan(newGreeting.length);
    });

    // -- Trigger words ----------------------------------------------------

    it("includes trigger words in new user greeting", () => {
        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("audit");
        expect(greeting).toContain("accessibility");
        expect(greeting).toContain("WCAG");
        expect(greeting).toContain("design tokens");
        expect(greeting).toContain("violations");
        expect(greeting).toContain("Tailwind");
    });

    it("includes trigger words in returning user greeting", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "C" }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("audit");
        expect(greeting).toContain("accessibility");
        expect(greeting).toContain("WCAG");
    });

    // -- Top-5 tool names -------------------------------------------------

    it("includes top-5 tool names", () => {
        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("flint_get_context");
        expect(greeting).toContain("audit_ui_component");
        expect(greeting).toContain("flint_fix");
        expect(greeting).toContain("flint_debt_report");
        expect(greeting).toContain("flint_plan");
    });

    // -- New user greeting ------------------------------------------------

    it("returns new-user greeting when .flint directory does not exist", () => {
        const greeting = buildGreeting(tmpDir);

        expect(greeting).toContain("Flint is connected");
        expect(greeting).toContain("governance tools ready");
        expect(greeting).toContain("flint://capabilities");
    });

    it("new user greeting includes top-5 entry point trigger phrases", () => {
        const greeting = buildGreeting(tmpDir);

        expect(greeting).toContain("audit my component");
        expect(greeting).toContain("fix it");
        expect(greeting).toContain("check accessibility");
        expect(greeting).toContain("show health");
        expect(greeting).toContain("what can you do?");
    });

    it("new user greeting includes dynamic tool count (non-zero number)", () => {
        const greeting = buildGreeting(tmpDir);
        // Should contain a number followed by "governance tools ready"
        expect(greeting).toMatch(/\d+ governance tools ready/);
    });

    it("returns new-user greeting when .flint exists but context.json is missing", () => {
        fs.mkdirSync(path.join(tmpDir, ".flint"), { recursive: true });
        const greeting = buildGreeting(tmpDir);

        expect(greeting).toContain("governance tools ready");
        expect(greeting).not.toContain("flint://session-context");
    });

    it("returns new-user greeting when context.json has null healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: null, activeFile: "Button.tsx" }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("governance tools ready");
    });

    it("returns new-user greeting when context.json has empty string healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "" }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("governance tools ready");
    });

    // -- Returning user greeting ------------------------------------------

    it("returns returning-user greeting when context.json has a non-null healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "B", healthScore: 82 }),
        );

        const greeting = buildGreeting(tmpDir);

        expect(greeting).toContain("Flint is connected");
        expect(greeting).toContain("Grade: B");
        expect(greeting).toContain("flint://session-context");
        // Should NOT contain new-user quick-start phrases
        expect(greeting).not.toContain("governance tools ready");
    });

    it("returning user greeting includes remediation call-to-action", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "C" }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("audit");
        expect(greeting).toContain("fix");
        expect(greeting).toContain("debt report");
    });

    it.each(["A", "B", "C", "D", "F"])(
        "returning user greeting includes grade letter = %s",
        (grade) => {
            const flintDir = path.join(tmpDir, ".flint");
            fs.mkdirSync(flintDir, { recursive: true });
            fs.writeFileSync(
                path.join(flintDir, "context.json"),
                JSON.stringify({ healthGrade: grade }),
            );

            const greeting = buildGreeting(tmpDir);
            expect(greeting).toContain("flint://session-context");
            expect(greeting).toContain(`Grade: ${grade}`);
            expect(greeting).not.toContain("governance tools ready");
        },
    );

    // -- No phase codes ---------------------------------------------------

    it("new user greeting contains no phase codes", () => {
        const greeting = buildGreeting(tmpDir);
        // Phase codes look like: V.2-mp, GOV.4, AGV.2, EXP.3, etc.
        expect(greeting).not.toMatch(/[A-Z]{2,}\.\d+/);
    });

    it("returning user greeting contains no phase codes", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "B" }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).not.toMatch(/[A-Z]{2,}\.\d+/);
    });

    // -- Malformed context.json -------------------------------------------

    it("returns new-user greeting when context.json is malformed JSON", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(path.join(flintDir, "context.json"), "not valid json {{{");

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("governance tools ready");
    });

    it("returns new-user greeting when context.json is not an object", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(path.join(flintDir, "context.json"), "[]");

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("governance tools ready");
    });

    it("returns new-user greeting when healthGrade is a number", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: 82 }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("governance tools ready");
    });

    // -- Catalog reference ------------------------------------------------

    it("references the workflow guide prompt", () => {
        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("flint-workflow-guide");
    });
});

// ---------------------------------------------------------------------------
// detectReturningUser
// ---------------------------------------------------------------------------

describe("detectReturningUser", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flint-detect-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns false when no context.json exists", () => {
        expect(detectReturningUser(tmpDir)).toBe(false);
    });

    it("returns false when .flint dir exists but no context.json", () => {
        fs.mkdirSync(path.join(tmpDir, ".flint"), { recursive: true });
        expect(detectReturningUser(tmpDir)).toBe(false);
    });

    it("returns true when context.json has healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "B" }),
        );
        expect(detectReturningUser(tmpDir)).toBe(true);
    });

    it("returns false when context.json has empty healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "" }),
        );
        expect(detectReturningUser(tmpDir)).toBe(false);
    });

    it("returns false when context.json has null healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: null }),
        );
        expect(detectReturningUser(tmpDir)).toBe(false);
    });

    it("returns false when context.json is malformed", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(path.join(flintDir, "context.json"), "not json");
        expect(detectReturningUser(tmpDir)).toBe(false);
    });
});
