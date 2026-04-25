import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: "Stale CSP comment claims production omits 'unsafe-eval' but new policy includes it",
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'electron/main.ts',
        line: 496,
        excerpt:
          "// Production CSP omits 'unsafe-eval' — the only new Function() usage in\n// production is inside the sandboxed srcdoc iframe which has its own CSP context.",
        note: 'Comment contradicts the actual PRODUCTION_CSP constant on line 446.',
      },
      {
        file: 'electron/main.ts',
        line: 446,
        excerpt: '"script-src \'self\' \'unsafe-eval\' \'unsafe-inline\'",',
        note: 'Production CSP now allows unsafe-eval.',
      },
    ],
    observed:
      "Comment in createWindow() asserts that the production CSP omits 'unsafe-eval'. The PRODUCTION_CSP constant defined ~50 lines earlier now includes 'unsafe-eval'.",
    rationale:
      "A future reader (human or agent) will trust the comment and assume the renderer cannot eval strings. They may then ship a feature that does, believing the CSP would block it. Audit-trail integrity depends on comments matching code. Low security impact today, high meta-impact on future review confidence.",
    proposedFix:
      "Update the comment to: 'Both dev and production CSPs allow unsafe-eval because the LivePreview transpile-and-eval pipeline runs in the top-level renderer, not inside an isolated iframe. The eval surface is bounded by the input surface — only project-local TSX is transpiled.'",
  },
  {
    id: 'WARN-2',
    title: 'tokens:seed-from-project clear-then-insert is not wrapped in a SQLite transaction',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    commandment: 12,
    evidence: [
      {
        file: 'electron/main.ts',
        line: 1063,
        excerpt:
          'stmtClearAll.run()\nfor (const t of tokens) {\n    stmtCreate.run(t.token_path, t.token_type, t.token_value, t.description ?? null, \'default\', \'default\')\n}',
        note: 'Clear and per-row insert outside a transaction.',
      },
      {
        file: 'server/index.ts',
        line: 934,
        excerpt:
          'stmtClearAll.run()\nfor (const t of tokens) {\n  stmtCreate.run(...)\n}',
        note: 'Same pattern in the web-parity handler.',
      },
      {
        file: 'electron/main.ts',
        line: 4651,
        excerpt: 'const insertMany = db.transaction(',
        note: 'Existing pattern in the same file shows the right approach.',
      },
    ],
    observed:
      'The handler clears all tokens then loops inserting each one. If any insert throws (NOT NULL/UNIQUE constraint, future schema change), the user is left with an emptied store and a partial seed. The outer try/catch returns an error string but the database mutation is already half-applied.',
    rationale:
      'Commandment 12 requires atomicity for stateful mutations. Risk in practice is low — schema is forgiving, next project-open re-seeds — but the fix is one line and the same file already uses db.transaction() for insertMany on line 4651.',
    proposedFix:
      'Wrap the clear + insert loop in db.transaction(() => { ... })() in both electron/main.ts and server/index.ts. Keep the outer try/catch for parse/IO errors.',
  },
  {
    id: 'WARN-3',
    title: 'projectRoot is not canonicalised or boundary-checked before path.join',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    commandment: 9,
    evidence: [
      {
        file: 'electron/main.ts',
        line: 1041,
        excerpt:
          "if (typeof projectRoot !== 'string' || projectRoot.length === 0) {\n    return { seeded: 0, source: 'none' as const, error: 'invalid project root' }\n}\nconst candidates = [\n    path.join(projectRoot, '.flint', 'design-tokens.json'),\n    path.join(projectRoot, 'design-tokens.json'),\n]",
        note: 'String check only — no path.resolve, no comparison to activeProjectRoot.',
      },
      {
        file: 'server/index.ts',
        line: 912,
        excerpt: "handlers.set('tokens:seed-from-project', async (projectRoot: unknown) => {",
        note: 'Same lack of canonicalisation in the web handler.',
      },
    ],
    observed:
      "Handler accepts a string projectRoot and joins .flint/design-tokens.json onto it. There is no path.resolve or check that the resolved path is under a known workspace root. A renderer (or web client on loopback) could pass /etc and the handler would attempt /etc/.flint/design-tokens.json.",
    rationale:
      'In the closed-beta Electron model the renderer is trusted via contextIsolation + allowlist, so this is not exploitable. In the web build the handler sits behind a per-session WS token + 127.0.0.1 bind, which contains the threat to a single user on their own machine. Still: the handler can be tricked into reading a JSON file from anywhere on disk and echoing the path back in success/error responses. Worth tightening before public beta or before binding the server to anything beyond loopback.',
    proposedFix:
      "After the string check, do: const resolved = path.resolve(projectRoot); and reject unless resolved === activeProjectRoot (or is a recently opened root). Mirror in server/index.ts. Add a test for the rejection path.",
  },
  {
    id: 'INFO-1',
    title: 'Recursive flattenDtcg has no explicit depth limit',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'shared/dtcgFlatten.ts',
        line: 58,
        excerpt: "function walk(node: Record<string, unknown>, prefix: string, out: FlatToken[]): void {",
        note: 'Recursive descent, no max-depth guard.',
      },
    ],
    observed:
      'flattenDtcg recurses through nested DTCG groups with no explicit depth cap. A pathologically nested file (~10k levels) would throw RangeError: Maximum call stack size exceeded.',
    rationale:
      'Caught by the outer try/catch and returned as { source: none, error }. Worst case: one rejected seed, fall back to baseline tokens. Not a DoS. Documenting as INFO so a future reader does not mistake it for a vulnerability.',
    proposedFix:
      'Optional: add a depth parameter with a sane cap (e.g., 32) and emit a warning instead of stack-overflowing. Not required.',
  },
  {
    id: 'INFO-2',
    title: 'Preload-only-in-dev branch keys off VITE_DEV_SERVER_URL — verify in packaged build',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/main.ts',
        line: 462,
        excerpt: 'const usePreload = !!process.env.VITE_DEV_SERVER_URL',
        note: 'Branch decides whether to attach the preload bridge.',
      },
    ],
    observed:
      'usePreload is true iff VITE_DEV_SERVER_URL is set. In the packaged production build this env var is absent, so the preload is correctly omitted. If a developer ever launches a packaged binary with that env var set (e.g., for debugging), the preload would attach and collide with the web adapter.',
    rationale:
      'Not a vulnerability — it would be a developer error producing a confusing UI, not a security boundary breach. Logging the chosen mode at startup would make this self-diagnosing.',
    proposedFix:
      "Add a console.log: console.log(`${BRAND.logPrefix} createWindow: usePreload=${usePreload}, packaged=${app.isPackaged}`). Optionally tighten to: const usePreload = !!process.env.VITE_DEV_SERVER_URL && !app.isPackaged.",
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'POST-HOC-601daff',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-25',
    round: 1,
    scope: [
      'electron/main.ts (CSP block + tokens:seed-from-project handler + createWindow preload branch)',
      'electron/preload.ts (tokens.seedFromProject exposure)',
      'server/index.ts (web-parity handler, ws-token auth, listen binding)',
      'shared/dtcgFlatten.ts',
      'src/App.tsx (caller)',
      'src/types/flint-api.d.ts',
      'electron/__tests__/tokensSeedFromProject.test.ts',
    ],
    markdownFile: 'POST-HOC-601daff-security-review-2026-04-25.md',
  },
  rubric: [
    { criterion: "contextIsolation: true preserved on BrowserWindow", result: 'pass' },
    { criterion: "nodeIntegration: false preserved on BrowserWindow", result: 'pass' },
    { criterion: "Preload not attached when loading from embedded server in production", result: 'pass' },
    { criterion: "WS upgrade requires per-session token authentication", result: 'pass' },
    { criterion: "Embedded server binds to 127.0.0.1, not 0.0.0.0", result: 'pass' },
    { criterion: "flattenDtcg rejects __proto__/constructor/prototype keys", result: 'pass' },
    { criterion: "tokens:seed-from-project validates input type before path operations", result: 'pass' },
    {
      criterion: 'tokens:seed-from-project canonicalises projectRoot against an opened workspace root',
      result: 'fail',
      evidence: 'No path.resolve + boundary check; see WARN-3.',
      relatedFindings: ['WARN-3'],
    },
    {
      criterion: 'Clear+insert in tokens:seed-from-project runs inside a single SQLite transaction',
      result: 'fail',
      evidence: 'Loop is outside db.transaction(); see WARN-2.',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'CSP comments in createWindow accurately describe the active policy',
      result: 'fail',
      evidence: "Comment claims production omits 'unsafe-eval' but PRODUCTION_CSP includes it; see WARN-1.",
      relatedFindings: ['WARN-1'],
    },
    { criterion: 'Process boundary intact — no fs/path imports added to src/', result: 'pass' },
    { criterion: 'Tests cover malformed input, invalid input, and nested DTCG cases', result: 'pass' },
    { criterion: "CSP additions (ws://, http://localhost) scoped to loopback only", result: 'pass' },
    { criterion: "'unsafe-eval' in production CSP is justified by LivePreview architecture", result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'electron/main.ts:425-507 (CSP + createWindow)',
      'electron/main.ts:1035-1083 (tokens:seed-from-project handler)',
      'electron/preload.ts:140-143 (tokens.seedFromProject bridge)',
      'server/index.ts:690-754 (WS auth + listen)',
      'server/index.ts:909-955 (web-parity handler)',
      'server/index.ts:4852 (listen bind 127.0.0.1)',
      'shared/dtcgFlatten.ts (full file)',
      'src/App.tsx:361-380 (hydrateWorkspace caller)',
    ],
    skipped: [
      'electron/__tests__/tokensSeedFromProject.test.ts — confirmed exists with 24 cases per commit message; not line-audited',
      'src/adapters/web-api.ts — pass-through invoke wrapper, low risk',
      'Other electron/main.ts handlers unchanged in this commit',
    ],
  },
};
