# Contract Lint Report: PHASE1 — Tailwind Config + Class Composition Expansion

---

## Pass 1 — 2026-04-18 (REVISE)

### Verdict: REVISE

| Check | Result | Issues |
|-------|--------|--------|
| 1. Compiles | PASS | 0 errors |
| 2. Completeness | FAIL | `meta.status` = `'DRAFT'`, must be `'APPROVED'` |
| 3. Impact Map | PASS | All files correct; all agents valid |
| 4. IPC Triangles | PASS | `ipc: []` genuinely empty |
| 5. Store Coherence | PASS | `stores: []` |
| 6. Test Boundaries | PASS | 18 boundaries; all `then` verbs valid |
| 7. Commandments | FAIL | C14 in markdown but absent from `.contract.ts` array |
| 8. Parallelism Safety | WARN | `flint-code-reviewer` in markdown Group C not a known agent |
| 9. MD ↔ TS Consistency | FAIL | Markdown: 5 commandments. TypeScript: 4. C14 missing from array |
| 10. Falsifiable Invariants | PASS | All 6 have operators + named harnesses |
| 11. Non-Goals | PASS | 8 entries |
| 12. Audience | PASS | `'engine'` |

### Blocking Issues (Pass 1)
1. `meta.status` must be `'APPROVED'`
2. C14 absent from `.contract.ts` `commandments` array — markdown/TypeScript diverge
3. Sandbox-violation error path has no dedicated test boundary — most security-critical path lacks executable contract

---

## Pass 2 — 2026-04-18 (APPROVED)

### Verdict: APPROVED

| Check | Result | Issues |
|-------|--------|--------|
| 1. Compiles | PASS | 0 errors (TSC clean) |
| 2. Completeness | PASS | `meta.status: 'APPROVED'`; all required sections populated |
| 3. Impact Map | PASS | All MODIFY files exist on disk; all CREATE files absent; all 3 owners in `.claude/agents/` |
| 4. IPC Triangles | PASS | `ipc: []` — genuinely empty; no validators needed |
| 5. Store Coherence | PASS | `stores: []` |
| 6. Test Boundaries | PASS | 21 boundaries; all 21 `then` fields start with `returns` (valid); all `given`/`when`/`then` non-empty |
| 7. Commandments | PASS | `[2, 8, 9, 13, 14]` — C14 now in TypeScript array with concrete `vm.runInNewContext` rationale |
| 8. Parallelism Safety | PASS | `flint-code-reviewer` removed; replaced with `/review` gate note in markdown |
| 9. MD ↔ TS Consistency | PASS | 0 IPC ↔ 0 IPC; 21 boundaries ↔ 21 boundaries; 5 commandments ↔ 5 commandments; `APPROVED` ↔ `APPROVED` |
| 10. Falsifiable Invariants | PASS | All 6 have comparison operators and units; `tailwindConfigLoader-cache-hit` now names specific bench case `cache-hit warm` with measurement protocol |
| 11. Non-Goals | PASS | 8 entries, all real scope exclusions |
| 12. Audience | PASS | `'engine'` — single valid enum value |

### Sandbox Mechanism Assessment (Check 7 deep probe)

The architect specified `vm.runInNewContext` with a frozen sandbox. This is evaluated against known escape vectors:

**Covered by the contract:**
- `process` / `fs` / `http` / `fetch` absent from sandbox object — `ReferenceError` on access, caught and mapped to `sandbox-violation`.
- Custom `require` allowlist blocks all non-Tailwind packages — `sandbox-violation` on any blocked specifier.
- Allowed presets re-evaluated inside the same sandbox — prevents escape via a preset that holds a pre-loaded `fs` reference from the parent process.
- 2000ms CPU timeout (`vm` option) + wall-clock `AbortController` race — handles infinite loops and event-loop starvation.
- Details redaction rule — call arguments stripped before surfacing to caller.
- Three dedicated test boundaries (fs, env, network) each with executable `given/when/then`.

**Residual risk the contract correctly acknowledges (not blocking):**
- `vm.runInNewContext` in Node.js is not a hardened security boundary against a determined adversary exploiting prototype pollution or native module escape via C++ addon calls. The risks section now explicitly states "esbuild alone only TRANSPILES — it does not sandbox the Node runtime" — this is the correct acknowledgment. The contract's sandbox is adequate for the threat model (Tailwind config files from a developer's own project), not for adversarial untrusted code. The use-case is legitimate. No additional invariant is required, but Phase 2 agents should note the scope boundary.
- The `tailwindcss-*` lexical allowlist permits any npm package whose name begins with that prefix. A malicious package named `tailwindcss-evil` could match. This is an acceptable risk for the stated threat model (developer's own project) but should be tracked as a Phase 3 concern.

Both residual items are acknowledged in the risks table at appropriate severity. They are informational, not blocking.

### What Phase 2 Agents Can Rely On

- Types in `.contract.ts` compile cleanly — `ResolvedTailwindTheme`, `TailwindConfigLoadResult`, `ExpandedClassExpression`, `ClassifierInputV2`, `AuditAllOptionsV2Additive` are all well-formed and importable.
- `ipc: []` is genuinely empty — no IPC validators needed, no preload changes.
- All 4 MODIFY files confirmed on disk; all 5 CREATE files confirmed absent — no collision risk.
- All 3 agent owners (`flint-mcp-specialist`, `flint-ast-surgeon`, `flint-test-writer`) are valid; no file conflicts between Group A agents.
- 21 test boundaries are executable with valid `then` verbs — `flint-test-writer` can scaffold from them immediately.
- 3 dedicated sandbox-violation boundaries provide implementation spec for the security-critical path.
- `vm.runInNewContext` sandbox mechanism is fully specified in the risk mitigation comment block — Phase 2 has a 6-step enforcement checklist to implement.
- All 6 invariants are falsifiable with named measurement harnesses; `tailwindConfigLoader-cache-hit` names the specific bench case.
- 8 non-goals provide clear scope walls including v4 CSS-first deferral, no auto-fix, and no Glass UI changes.
