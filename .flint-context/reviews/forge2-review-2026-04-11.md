# FORGE.2 Code Review — 2026-04-11

**Commit:** d5a9e7f `feat(forge): FORGE.2 — smart project detection + auto-audit on open`
**Verdict: SHIP**

## What changed

Detection logic extracted from duplicated inline code in `electron/main.ts` and `server/index.ts` into `shared/projectDetector.ts`. Richer typed output (structured `{ name, version }` objects instead of flat strings). DetectionBanner updated for new shape. 15 unit tests added. Backward-compat legacy fields preserved.

## Commandment compliance (all clear)

- **C4 (Local-First):** No external URLs. Detection reads local files only.
- **C12 (Atomic Queuing):** The one `writeFile` to `.flint/detected-environment.json` remains in the IPC handler (not in the shared module). This is a metadata cache, not source code, so FileTransactionManager is not required.
- **C13 (No Regex Surgery):** Regex used only on semver strings (`cleanVersion`, `tailwindMajor`), not source code. Clean.

## Security

- **Path traversal:** All `path.join` calls use hardcoded relative segments (`package.json`, `tsconfig.json`, etc.) joined to `projectRoot`. No user-controlled path components. Clean.
- **Symlinks in `defaultCountFiles`:** The walker uses `entry.isDirectory()` / `entry.isFile()`, which follow symlinks. A malicious symlink pointing outside the project could be walked. **WARNING** -- low risk since this only counts files and never reads content, but consider adding `{ withFileTypes: true }` + `entry.isSymbolicLink()` skip in a future hardening pass.
- **Process boundary:** `projectDetector.ts` lives in `shared/`, imported only by `electron/` and `server/`. Never imported from `src/`. Clean.

## Test coverage

15 tests covering: React, Vue, Next.js, Tailwind v4, shadcn, MUI, Mantine, styled-components, DTCG tokens, Tokens Studio, Style Dictionary, TypeScript detection, no-package.json fallback, config-file-only Tailwind, countFiles callback. Good breadth.

## Warnings (non-blocking)

1. **WARNING: Symlink following** in `defaultCountFiles` -- see above.
2. **WARNING: `import('node:fs/promises')` dynamic import** on every `defaultCountFiles` call. Consider hoisting or caching. Not a perf issue at detection time but unnecessary overhead.

## Test results

- TSC: 0 errors
- Glass: 1961/1961 passing
- Core: 1389/1391 (2 pre-existing failures unrelated to this commit: `mithrilParity` + `ws3-server thumbnail`)
