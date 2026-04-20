# Flint — Demo Fixtures

Curated demo scenarios for the Flint private beta. Each demo is a self-contained story that shows one or more Citadel capabilities (Mithril, Warden, Gate, Sweep, Mason) working on realistic code.

## Prerequisites

```sh
cd flint-mcp && npm install && npm run build
```

The demos assume Flint MCP is built and running. Connect a client (Claude Code, Cursor, or any MCP-compatible IDE) to the server, or load a demo in Flint Glass via the LaunchScreen picker.

---

## Demo Index

| Location | Name | What it shows |
|----------|------|---------------|
| `build-resources/demos/multi-component-app/` | **Full workflow** | 5-component SaaS dashboard at mixed grades (A → F). Audit → sweep → watch health climb → Export Gate blocks remaining manual a11y fixes. This is the headline beta demo. |
| `build-resources/demos/dashboard-before/` | **AI without governance** | A "brutalist" dashboard AI generated with no rails — hardcoded colors, ignored tokens, broken contrast. |
| `build-resources/demos/dashboard-after/` | **AI with Flint** | Same dashboard prompt, generated with token + a11y + brand constraints on. Compare side-by-side with `dashboard-before`. |
| `demos/03-mithril-shadow-audit/` | **Mithril color drift** | Pricing card whose author eyeballed colors from a Figma screenshot. CIEDE2000 surfaces perceptual drift invisible to the eye. |
| `demos/04-sentinel/` | **Warden UX + a11y** | An AI-generated order form with 31 violations — Hick's Law (10-button toolbar), Miller's Law (16 always-visible fields), and WCAG 2.1 AA failures. |
| `demos/figma-d2c/` | **Mason D2C** | Figma design → library-aware code generation. Top-level `AccountSettings.tsx` now uses Material UI (project default). Variants for shadcn and Tailwind-only preserved at `expected-output/` for reference. |

### In-app demo picker

The LaunchScreen's three demo scenarios (`DemoScenarioPicker`) map to the three `build-resources/demos/` projects:

- **Try the full workflow** → `multi-component-app`
- **AI without governance** → `dashboard-before`
- **AI with Flint** → `dashboard-after`

`demos/03-mithril-shadow-audit/` and `demos/04-sentinel/` are developer-facing sandboxes surfaced via `demos/_preview/DemoPreview.tsx`, not the in-app picker.

---

## Fixture

`demos/01-rag-ui-builder/` is preserved as a **test canary only** for FIXTURE.1.1 — it is no longer a user-facing demo. Do not reference it in beta collateral.

---

## Running a Demo

1. Open the demo folder as a Flint project (via Glass LaunchScreen or `--demo` CLI flag).
2. Let the component file load in the canvas.
3. Invoke the relevant MCP tool from the demo's walkthrough (`audit_ui_component`, `flint_swarm_audit_fix`, `flint_fix`).
4. Observe violations, auto-fixes, and health changes in Flint Glass.

See [RUNBOOKS.md](RUNBOOKS.md) for step-by-step walkthroughs and [DEMO-SCRIPT.md](DEMO-SCRIPT.md) for the 90-second demo-video script.

---

## Shared Token File

`demos/design-tokens.json` is the canonical W3C DTCG token file used across `demos/`. Individual demo subfolders may include a local copy for self-containment.

**Token summary:**

| Group | Tokens |
|-------|--------|
| `color.*` | `primary` (#0066FF), `surface` (#FFFFFF), `on-surface` (#111827), `on-surface-muted`, `border`, `danger`, `success`, `warning` |
| `spacing.*` | 4, 8, 12, 16, 20, 24, 32, 40, 48 px |
| `fontSize.*` | xs (12px), sm (14px), base (16px), lg (20px), xl (24px), 2xl (32px) |
| `fontFamily.*` | `sans` (Inter), `mono` (JetBrains Mono) |
| `borderRadius.*` | sm (4px), md (8px), lg (12px), full |
| `shadow.*` | sm, md, lg, xl |
