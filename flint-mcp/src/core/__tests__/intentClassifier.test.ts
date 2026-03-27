import { describe, it, expect } from "vitest";
import { detectPersona, classifyIntent, containsAny } from "../intentClassifier.js";
import type { Persona, IntentFamily } from "../intentClassifier.js";

// ---------------------------------------------------------------------------
// containsAny (shared utility)
// ---------------------------------------------------------------------------

describe("containsAny", () => {
    it("returns true when text contains a keyword", () => {
        expect(containsAny("hello world", ["world"])).toBe(true);
    });

    it("returns false when text contains no keywords", () => {
        expect(containsAny("hello world", ["foo", "bar"])).toBe(false);
    });

    it("returns false for empty keyword list", () => {
        expect(containsAny("hello world", [])).toBe(false);
    });

    it("returns false for empty text", () => {
        expect(containsAny("", ["hello"])).toBe(false);
    });

    it("matches partial words (substring match)", () => {
        expect(containsAny("accessibility", ["access"])).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// detectPersona (Strategy 2)
// ---------------------------------------------------------------------------

describe("detectPersona", () => {
    // Designer signals
    const designerMessages: Array<[string, string]> = [
        ["Does this match our brand?", "brand"],
        ["Is this component accessible?", "accessible"],
        ["The spacing looks off", "spacing"],
        ["Does this look right?", "look right"],
        ["Check the color palette", "color"],
        ["Does this match the design system?", "design system"],
        ["The typography feels wrong", "typography"],
        ["does this look good visually?", "visual"],
    ];

    it.each(designerMessages)(
        "detects designer persona for: %s (signal: %s)",
        (message, _signal) => {
            expect(detectPersona(message)).toBe("designer" satisfies Persona);
        },
    );

    // Developer signals
    const developerMessages: Array<[string, string]> = [
        ["Run an audit on this file", "audit"],
        ["What are the lint errors?", "lint"],
        ["Check MITH-001 violations", "mith"],
        ["Are there any A11Y issues?", "a11y"],
        ["Generate a SARIF report", "sarif"],
        ["Will this pass CI?", "ci"],
        ["What's blocking my PR?", "pr"],
        ["Check the export gate", "export gate"],
        ["Fix the errors in this file", "fix the errors"],
        ["Show all violations", "violations"],
        ["Check WCAG compliance", "wcag"],
    ];

    it.each(developerMessages)(
        "detects developer persona for: %s (signal: %s)",
        (message, _signal) => {
            expect(detectPersona(message)).toBe("developer" satisfies Persona);
        },
    );

    // Ambiguous / unknown
    it("returns unknown when message has no signals", () => {
        expect(detectPersona("hello")).toBe("unknown");
        expect(detectPersona("what can you do?")).toBe("unknown");
        expect(detectPersona("help me with this project")).toBe("unknown");
    });

    it("returns unknown when both designer and developer signals are present", () => {
        // "brand" is a designer signal, "audit" is a developer signal
        expect(detectPersona("audit the brand colors")).toBe("unknown");
    });

    it("is case-insensitive", () => {
        expect(detectPersona("CHECK THE BRAND COLORS")).toBe("designer");
        expect(detectPersona("RUN AN AUDIT")).toBe("developer");
    });

    it("handles empty string", () => {
        expect(detectPersona("")).toBe("unknown");
    });
});

// ---------------------------------------------------------------------------
// classifyIntent (Strategy 5)
// ---------------------------------------------------------------------------

describe("classifyIntent", () => {
    // audit-accessibility
    it("classifies accessibility-related questions", () => {
        expect(classifyIntent("Is this accessible?")).toBe("audit-accessibility" satisfies IntentFamily);
        expect(classifyIntent("Check WCAG compliance")).toBe("audit-accessibility" satisfies IntentFamily);
        expect(classifyIntent("will screen readers understand this?")).toBe("audit-accessibility" satisfies IntentFamily);
        expect(classifyIntent("check a11y issues")).toBe("audit-accessibility" satisfies IntentFamily);
        expect(classifyIntent("does this have proper aria labels?")).toBe("audit-accessibility" satisfies IntentFamily);
        expect(classifyIntent("check the tab order")).toBe("audit-accessibility" satisfies IntentFamily);
    });

    // audit-mithril
    it("classifies brand/design system questions", () => {
        expect(classifyIntent("Does this match our brand?")).toBe("audit-mithril" satisfies IntentFamily);
        expect(classifyIntent("Check brand compliance")).toBe("audit-mithril" satisfies IntentFamily);
        expect(classifyIntent("is this on brand?")).toBe("audit-mithril" satisfies IntentFamily);
        expect(classifyIntent("there is color drift in the header")).toBe("audit-mithril" satisfies IntentFamily);
        expect(classifyIntent("run mithril linter")).toBe("audit-mithril" satisfies IntentFamily);
    });

    // export-gate-check
    it("classifies export/PR gate questions", () => {
        expect(classifyIntent("What's blocking export?")).toBe("export-gate-check" satisfies IntentFamily);
        expect(classifyIntent("what's blocking my PR?")).toBe("export-gate-check" satisfies IntentFamily);
        expect(classifyIntent("can i ship this?")).toBe("export-gate-check" satisfies IntentFamily);
        expect(classifyIntent("is the export gate open?")).toBe("export-gate-check" satisfies IntentFamily);
        expect(classifyIntent("will this pass the gate?")).toBe("export-gate-check" satisfies IntentFamily);
    });

    // audit-then-fix
    it("classifies fix requests", () => {
        expect(classifyIntent("fix this")).toBe("audit-then-fix" satisfies IntentFamily);
        expect(classifyIntent("fix everything")).toBe("audit-then-fix" satisfies IntentFamily);
        expect(classifyIntent("clean this up")).toBe("audit-then-fix" satisfies IntentFamily);
        expect(classifyIntent("auto-fix the violations")).toBe("audit-then-fix" satisfies IntentFamily);
        expect(classifyIntent("resolve the issues")).toBe("audit-then-fix" satisfies IntentFamily);
    });

    // health-overview
    it("classifies health/status questions", () => {
        expect(classifyIntent("How is the project doing?")).toBe("health-overview" satisfies IntentFamily);
        expect(classifyIntent("show me the health score")).toBe("health-overview" satisfies IntentFamily);
        expect(classifyIntent("what's the design debt situation?")).toBe("health-overview" satisfies IntentFamily);
        expect(classifyIntent("project status overview")).toBe("health-overview" satisfies IntentFamily);
    });

    // provenance-query
    it("classifies provenance/history questions", () => {
        expect(classifyIntent("What did we ship last sprint?")).toBe("provenance-query" satisfies IntentFamily);
        expect(classifyIntent("what changed recently?")).toBe("provenance-query" satisfies IntentFamily);
        expect(classifyIntent("show mutation history")).toBe("provenance-query" satisfies IntentFamily);
        expect(classifyIntent("what was fixed last week?")).toBe("provenance-query" satisfies IntentFamily);
    });

    // token-migration
    it("classifies token migration requests", () => {
        expect(classifyIntent("migrate tokens to the new system")).toBe("token-migration" satisfies IntentFamily);
        expect(classifyIntent("update tokens from Figma")).toBe("token-migration" satisfies IntentFamily);
        expect(classifyIntent("sync tokens with the remote")).toBe("token-migration" satisfies IntentFamily);
        expect(classifyIntent("run tailwind migration")).toBe("token-migration" satisfies IntentFamily);
    });

    // full-audit
    it("classifies full audit requests", () => {
        expect(classifyIntent("check everything")).toBe("full-audit" satisfies IntentFamily);
        expect(classifyIntent("audit everything")).toBe("full-audit" satisfies IntentFamily);
        expect(classifyIntent("run a full audit")).toBe("full-audit" satisfies IntentFamily);
        expect(classifyIntent("scan everything for issues")).toBe("full-audit" satisfies IntentFamily);
    });

    // unknown fallback
    it("returns unknown for unrecognized intents", () => {
        expect(classifyIntent("hello")).toBe("unknown" satisfies IntentFamily);
        expect(classifyIntent("what time is it?")).toBe("unknown" satisfies IntentFamily);
        expect(classifyIntent("write a unit test")).toBe("unknown" satisfies IntentFamily);
        expect(classifyIntent("deploy to production")).toBe("unknown" satisfies IntentFamily);
        expect(classifyIntent("")).toBe("unknown" satisfies IntentFamily);
    });

    // Specificity: more specific rules should win over general ones
    it("prefers audit-accessibility over audit-then-fix for 'is this accessible?'", () => {
        // "accessible" is an accessibility keyword, not a fix keyword
        expect(classifyIntent("is this accessible?")).toBe("audit-accessibility");
    });

    it("prefers export-gate-check over audit-then-fix for 'what is blocking export?'", () => {
        expect(classifyIntent("what is blocking export?")).toBe("export-gate-check");
    });

    it("is case-insensitive", () => {
        expect(classifyIntent("FIX EVERYTHING")).toBe("audit-then-fix");
        expect(classifyIntent("CHECK WCAG COMPLIANCE")).toBe("audit-accessibility");
    });
});
