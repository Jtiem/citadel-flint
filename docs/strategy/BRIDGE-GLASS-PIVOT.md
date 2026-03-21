# Flint Glass Pivot: Spatial Code Observability Strategy

**Status:** ADOPTED
**Date:** 2026-03-13
**Supersedes:** Any previous plans for a permanent split-pane Monaco Editor in the Flint Glass shell.

---

## 1. Vision: Visual-First Governance

Flint Glass is the "observability layer" for the headless Flint MCP server. To maximize its effectiveness for UX designers and design system teams, the interface must prioritize high-fidelity visual real-state over legacy IDE panels.

### Key Pillars
- **Zero Truth Conflict:** Glass does not compete with the primary IDE (VS Code/Cursor). It serves as a visual augmentation field.
- **Ghost Code Snippets:** Code is ephemeral and contextual. It exists as an overlay spatialized to visual components.
- **Surface Area for Success:** 100% of the viewport is dedicated to the visual canvas, with floating glass-morphic HUDs for telemetry and governance.

---

## 2. Architectural Pivot

### Deprecation of split-pan Monaco
The fixed `CodeEditorPanel` and `TerminalPanel` at the bottom of the screen are being removed. This recovers ~40% of the vertical real estate for design interaction.

### Contextual Observability HUDs
- **Selection Snppets:** When a node is selected on the `XYCanvas`, a glassy "Source HUD" appears. 
- **Drift Intelligence:** When a `ShieldOverlay` badge is hovered, the problematic line of code is displayed in-situ with a "Heal" trigger.
- **Terminal as Status:** The terminal moves to a minimized sidebar or collapsible overlay, focusing on logs and ingestion status rather than manual command entry.

---

## 3. Implementation Phases (U.3 - U.6)

### Phase U.3: Immersive Canvas
- Refactor `App.tsx` to remove the bottom horizontal split.
- Set `XYCanvas` to occupy the full height of the viewport.

### Phase U.4: Ghost Code Snippets
- Implement `GhostCodeSnippet.tsx` using a lightweight highlighter (`react-syntax-highlighter`).
- Integrate with `ShieldOverlay.tsx` to show "Hover-to-Source".

### Phase U.5: In-Situ Healing
- Connect "Pinch-to-Fix" gestures directly to the Ghost Code Snippets.
- Visualize the AST mutation as a "Ripple Diff" on the canvas.

---

## 4. Interaction Model

| Trigger | Legacy Behavior | Glass Pivot Behavior |
|---------|-----------------|----------------------|
| **Select Node** | Scrolls Monaco to line | Shows Ghost HUD & syncs VS Code |
| **Hover Violation** | Highlight in side panel | Floating HUD with fix suggestion |
| **Pinch Gesture** | Unsupported | Triggers AST-level auto-heal ripple |
| **File Browse** | Panel nav | Immersive Tree HUD |
