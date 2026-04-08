import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toolError, HINTS } from "../errorResponse.js";

describe("toolError", () => {
    describe("basic error formatting", () => {
        it("returns isError: true", () => {
            const result = toolError("test_tool", new Error("oops"));
            expect(result.isError).toBe(true);
        });

        it("includes the tool name and error message", () => {
            const result = toolError("audit_ui_component", new Error("File not found"));
            expect(result.content[0].text).toContain("audit_ui_component failed: File not found");
        });

        it("returns content array with a text item", () => {
            const result = toolError("test_tool", new Error("msg"));
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");
        });

        it("handles non-Error values — strings", () => {
            const result = toolError("test_tool", "something went wrong");
            expect(result.content[0].text).toContain("something went wrong");
        });

        it("handles non-Error values — objects", () => {
            const result = toolError("test_tool", { code: 42 });
            expect(result.content[0].text).toContain("test_tool failed:");
        });

        it("handles null", () => {
            const result = toolError("test_tool", null);
            expect(result.content[0].text).toContain("test_tool failed:");
        });

        it("handles undefined", () => {
            const result = toolError("test_tool", undefined);
            expect(result.content[0].text).toContain("test_tool failed:");
        });
    });

    describe("causes hints", () => {
        it("includes 'Common causes:' section when causes provided", () => {
            const result = toolError("test_tool", new Error("oops"), {
                causes: ["Bad path", "Wrong format"],
            });
            const text = result.content[0].text;
            expect(text).toContain("Common causes:");
            expect(text).toContain("• Bad path");
            expect(text).toContain("• Wrong format");
        });

        it("does not include causes section when empty array", () => {
            const result = toolError("test_tool", new Error("oops"), { causes: [] });
            expect(result.content[0].text).not.toContain("Common causes:");
        });

        it("does not include causes section when omitted", () => {
            const result = toolError("test_tool", new Error("oops"));
            expect(result.content[0].text).not.toContain("Common causes:");
        });
    });

    describe("recovery hints", () => {
        it("includes 'Try:' section when recovery provided", () => {
            const result = toolError("test_tool", new Error("oops"), {
                recovery: ["Run step A", "Check file B"],
            });
            const text = result.content[0].text;
            expect(text).toContain("Try:");
            expect(text).toContain("• Run step A");
            expect(text).toContain("• Check file B");
        });

        it("does not include Try section when empty array", () => {
            const result = toolError("test_tool", new Error("oops"), { recovery: [] });
            expect(result.content[0].text).not.toContain("Try:");
        });

        it("does not include Try section when omitted", () => {
            const result = toolError("test_tool", new Error("oops"));
            expect(result.content[0].text).not.toContain("Try:");
        });
    });

    describe("combined hints", () => {
        it("includes both sections when both provided", () => {
            const result = toolError("test_tool", new Error("fail"), {
                causes: ["Cause one"],
                recovery: ["Try this"],
            });
            const text = result.content[0].text;
            expect(text).toContain("Common causes:");
            expect(text).toContain("Try:");
        });

        it("produces structured output with blank lines between sections", () => {
            const result = toolError("test_tool", new Error("fail"), {
                causes: ["C1"],
                recovery: ["R1"],
            });
            const text = result.content[0].text;
            // Should have blank lines separating sections
            expect(text).toMatch(/\n\n/);
        });
    });

    describe("dev logging", () => {
        let originalEnv: string | undefined;
        let consoleSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            originalEnv = process.env.NODE_ENV;
            consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        });

        afterEach(() => {
            process.env.NODE_ENV = originalEnv;
            consoleSpy.mockRestore();
        });

        it("logs to console.error in non-production", () => {
            process.env.NODE_ENV = "test";
            toolError("test_tool", new Error("boom"));
            expect(consoleSpy).toHaveBeenCalled();
        });

        it("does not log in production", () => {
            process.env.NODE_ENV = "production";
            toolError("test_tool", new Error("boom"));
            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });
});

describe("HINTS pre-built hint sets", () => {
    it("fileNotFound has causes and recovery", () => {
        expect(HINTS.fileNotFound.causes.length).toBeGreaterThan(0);
        expect(HINTS.fileNotFound.recovery.length).toBeGreaterThan(0);
    });

    it("fileNotFound recovery references flint_get_context", () => {
        const recoveryText = HINTS.fileNotFound.recovery.join(" ");
        expect(recoveryText).toContain("flint_get_context");
    });

    it("missingParam is a factory function returning hints", () => {
        const hints = HINTS.missingParam("flint_fix filePath='...'");
        expect(hints.causes.length).toBeGreaterThan(0);
        expect(hints.recovery.join(" ")).toContain("flint_fix filePath=");
    });

    it("missingParam works without example", () => {
        const hints = HINTS.missingParam();
        expect(hints.recovery.join(" ")).toContain("flint_status");
    });

    it("parseError has causes and recovery", () => {
        expect(HINTS.parseError.causes.length).toBeGreaterThan(0);
        expect(HINTS.parseError.recovery.length).toBeGreaterThan(0);
    });

    it("noTokens recovery references flint_sync_pull", () => {
        expect(HINTS.noTokens.recovery.join(" ")).toContain("flint_sync_pull");
    });

    it("noTokens recovery references flint_ingest_figma", () => {
        expect(HINTS.noTokens.recovery.join(" ")).toContain("flint_ingest_figma");
    });

    it("libraryNotSet recovery references flint_set_library", () => {
        expect(HINTS.libraryNotSet.recovery.join(" ")).toContain("flint_set_library");
    });

    it("noFigmaConnection recovery references flint_figma_connect", () => {
        expect(HINTS.noFigmaConnection.recovery.join(" ")).toContain("flint_figma_connect");
    });

    it("registryEmpty recovery references flint_reindex_registry", () => {
        expect(HINTS.registryEmpty.recovery.join(" ")).toContain("flint_reindex_registry");
    });

    describe("integration: HINTS work with toolError", () => {
        it("fileNotFound hint produces well-formed error response", () => {
            const result = toolError("audit_ui_component", new Error("Banner.tsx not found"), HINTS.fileNotFound);
            const text = result.content[0].text;
            expect(text).toContain("audit_ui_component failed:");
            expect(text).toContain("Common causes:");
            expect(text).toContain("Try:");
            expect(text).toContain("flint_get_context");
        });

        it("noTokens hint produces actionable recovery", () => {
            const result = toolError("flint_fix", new Error("No design tokens loaded"), HINTS.noTokens);
            const text = result.content[0].text;
            expect(text).toContain("flint_sync_pull");
            expect(text).toContain("flint_ingest_figma");
        });
    });
});

describe("edge cases", () => {
    it("empty tool name is handled gracefully", () => {
        const result = toolError("", new Error("error"));
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("failed:");
    });

    it("very long error message is not truncated", () => {
        const longMsg = "x".repeat(5000);
        const result = toolError("test_tool", new Error(longMsg));
        expect(result.content[0].text).toContain(longMsg);
    });

    it("single cause renders correctly", () => {
        const result = toolError("test_tool", new Error("e"), { causes: ["Only cause"] });
        expect(result.content[0].text).toContain("• Only cause");
    });

    it("single recovery renders correctly", () => {
        const result = toolError("test_tool", new Error("e"), { recovery: ["Only step"] });
        expect(result.content[0].text).toContain("• Only step");
    });
});
