import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildGreeting } from "../server.js";

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

    // ── New user (no .flint directory) ──────────────────────────────────

    it("returns new-user greeting when .flint directory does not exist", () => {
        const greeting = buildGreeting(tmpDir);

        expect(greeting).toContain("Flint is connected");
        expect(greeting).toContain("45 governance tools available");
        expect(greeting).toContain("You're new here");
        expect(greeting).toContain("what can Flint do?");
        expect(greeting).toContain("flint://capabilities");
        expect(greeting).toContain("flint://session-context");
    });

    // ── New user (no context.json) ──────────────────────────────────────

    it("returns new-user greeting when .flint exists but context.json is missing", () => {
        fs.mkdirSync(path.join(tmpDir, ".flint"), { recursive: true });
        const greeting = buildGreeting(tmpDir);

        expect(greeting).toContain("You're new here");
        expect(greeting).toContain("45 governance tools available");
    });

    // ── New user (context.json with null healthGrade) ───────────────────

    it("returns new-user greeting when context.json has null healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: null, activeFile: "Button.tsx" }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("You're new here");
    });

    // ── New user (context.json with empty healthGrade) ──────────────────

    it("returns new-user greeting when context.json has empty string healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "" }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("You're new here");
    });

    // ── Returning user ──────────────────────────────────────────────────

    it("returns returning-user greeting when context.json has a non-null healthGrade", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: "B", healthScore: 82 }),
        );

        const greeting = buildGreeting(tmpDir);

        expect(greeting).toContain("Flint is connected");
        expect(greeting).toContain("flint://session-context");
        expect(greeting).toContain("current state");
        expect(greeting).toContain("what's changed since your last session");
        // Should NOT contain new-user elements
        expect(greeting).not.toContain("You're new here");
        expect(greeting).not.toContain("45 governance tools available");
    });

    // ── Returning user with various grades ──────────────────────────────

    it.each(["A", "B", "C", "D", "F"])(
        "detects returning user for healthGrade = %s",
        (grade) => {
            const flintDir = path.join(tmpDir, ".flint");
            fs.mkdirSync(flintDir, { recursive: true });
            fs.writeFileSync(
                path.join(flintDir, "context.json"),
                JSON.stringify({ healthGrade: grade }),
            );

            const greeting = buildGreeting(tmpDir);
            expect(greeting).not.toContain("You're new here");
            expect(greeting).toContain("flint://session-context");
        },
    );

    // ── Malformed context.json ──────────────────────────────────────────

    it("returns new-user greeting when context.json is malformed JSON", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(path.join(flintDir, "context.json"), "not valid json {{{");

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("You're new here");
    });

    // ── context.json is an array (unexpected shape) ─────────────────────

    it("returns new-user greeting when context.json is not an object", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(path.join(flintDir, "context.json"), "[]");

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("You're new here");
    });

    // ── context.json has healthGrade as non-string ──────────────────────

    it("returns new-user greeting when healthGrade is a number", () => {
        const flintDir = path.join(tmpDir, ".flint");
        fs.mkdirSync(flintDir, { recursive: true });
        fs.writeFileSync(
            path.join(flintDir, "context.json"),
            JSON.stringify({ healthGrade: 82 }),
        );

        const greeting = buildGreeting(tmpDir);
        expect(greeting).toContain("You're new here");
    });
});
