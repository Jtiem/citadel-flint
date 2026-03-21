# Journey 10: Create New Project — Architect Review

**Date:** 2026-03-15
**Status:** IMPLEMENTING
**Priority:** HIGH

## Summary

Journey 10 fills the gap where "New Project" on LaunchScreen routes to J2 (Open Existing Project) which rejects empty folders. The 7-step journey covers: folder selection → scaffolding → validation → hydration → canvas render → git init → onboarding nudge.

## Design Decisions Made

1. **No-tokens StatusBar state:** Amber "No design system connected" (not green — green would be misleading)
2. **Template selection:** Single starter template for v1. Architecture allows future expansion.
3. **Project naming:** Folder name is sufficient. No explicit name input.
4. **Starter template:** Must be lint-clean (0 Mithril, 0 A11y), use token-friendly classes, have 5+ selectable nodes.
5. **Non-empty folder:** Show confirmation dialog, don't silently fail.

## Test Coverage

9 new tests (#33-41) covering: scaffolding IPC, template validity, lint cleanliness, OnboardingNudge rendering/suppression.

## Full Proposal

See the user-provided proposal document for complete step-by-step journey with system traces, IPC calls, commandment compliance, and appendix updates.
