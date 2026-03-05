---
description: Run a full Mithril compliance audit and generate a session-end BRIDGE-PULSE
---

# /audit — Mithril Safety Audit & Session-End Pulse

Run this workflow before ending a session or before a major commit.

## Steps

1. Read `.bridge-context/BRIDGE-PULSE.md` for the current session state.

// turbo
2. Run `npx tsc --noEmit` to verify zero TypeScript errors.

3. Scan all files modified during this session. For each file under `src/`:
   - Verify all new JSX elements have a `data-bridge-id` attribute (or are handled by `injectBridgeIds`).
   - Cross-reference any new `className` values against the token store. Log any unresolved classes as potential Mithril Violations.

4. Calculate the **ΔE Perception Drift** for any style changes made during the session. Report violations where ΔE > 2.0.

5. Update `.bridge-context/BRIDGE-PULSE.md` with:
   - Final "Active Buffer" state.
   - Updated Mithril Violation Count and ΔE drift value.
   - "Last Session Synchronization" block with all files modified.

6. Generate the final `[BRIDGE-PULSE-v5.7]` block and report it to the user.
