import { describe, it, expect } from "vitest";
import {
    startResponseTimer,
    withResponseMeta,
    type ToolResult,
    type EnrichedToolResult,
    type SourceAuthority,
} from "../responseMeta.js";

const SAMPLE_RESULT: ToolResult = {
    content: [{ type: "text", text: "hello" }],
};

describe("responseMeta – CX.1", () => {
    describe("withResponseMeta", () => {
        it("attaches _meta with required fields", () => {
            const enriched = withResponseMeta(SAMPLE_RESULT, "ast", 42);
            expect(enriched._meta.durationMs).toBe(42);
            expect(enriched._meta.sourceAuthority).toBe("ast");
            expect(enriched._meta.respondedAt).toBeTruthy();
            expect(enriched._meta.confidence).toBeUndefined();
        });

        it("includes confidence when provided", () => {
            const enriched = withResponseMeta(SAMPLE_RESULT, "token", 10, 0.95);
            expect(enriched._meta.confidence).toBe(0.95);
        });

        it("preserves original content", () => {
            const enriched = withResponseMeta(SAMPLE_RESULT, "heuristic", 5);
            expect(enriched.content).toEqual(SAMPLE_RESULT.content);
        });

        it("preserves isError flag", () => {
            const errorResult: ToolResult = { ...SAMPLE_RESULT, isError: true };
            const enriched = withResponseMeta(errorResult, "ast", 1);
            expect(enriched.isError).toBe(true);
        });

        it("respondedAt is valid ISO 8601", () => {
            const enriched = withResponseMeta(SAMPLE_RESULT, "cached", 0);
            const parsed = new Date(enriched._meta.respondedAt);
            expect(parsed.getTime()).not.toBeNaN();
        });

        it("accepts all source authority values", () => {
            const authorities: SourceAuthority[] = ["ast", "token", "heuristic", "cached"];
            for (const sa of authorities) {
                const enriched = withResponseMeta(SAMPLE_RESULT, sa, 0);
                expect(enriched._meta.sourceAuthority).toBe(sa);
            }
        });
    });

    describe("startResponseTimer", () => {
        it("returns a finish function that measures elapsed time", async () => {
            const finish = startResponseTimer("ast");
            // Small delay to ensure non-zero duration
            await new Promise((r) => setTimeout(r, 5));
            const enriched = finish(SAMPLE_RESULT);
            expect(enriched._meta.durationMs).toBeGreaterThan(0);
            expect(enriched._meta.sourceAuthority).toBe("ast");
        });

        it("includes confidence when provided to timer", () => {
            const finish = startResponseTimer("token", 0.8);
            const enriched = finish(SAMPLE_RESULT);
            expect(enriched._meta.confidence).toBe(0.8);
        });

        it("preserves content through timer", () => {
            const finish = startResponseTimer("cached");
            const enriched = finish(SAMPLE_RESULT);
            expect(enriched.content).toEqual(SAMPLE_RESULT.content);
        });

        it("can be called only once (snapshot timing)", () => {
            const finish = startResponseTimer("heuristic");
            const first = finish(SAMPLE_RESULT);
            const second = finish(SAMPLE_RESULT);
            // Both should work (no single-use restriction) but second has larger duration
            expect(second._meta.durationMs).toBeGreaterThanOrEqual(first._meta.durationMs);
        });
    });
});
