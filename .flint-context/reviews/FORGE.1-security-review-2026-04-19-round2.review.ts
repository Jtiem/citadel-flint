import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'SUG-1',
    title: 'Mirror SSRF carve-out rationale into Electron handler header',
    severity: 'suggestion',
    evidence: [
      { file: 'electron/main.ts', line: 2480, note: 'project:smart-open handler header has no comment explaining why SSRF gating is web-only' },
      { file: 'server/index.ts', line: 1716, note: 'Web handler documents the carve-out; Electron does not mirror it' },
    ],
    observed:
      'The web build (server/index.ts:1716-1745) implements an SSRF gate that rejects RFC1918, loopback, and link-local hosts, with a comment explaining the desktop is user-trusted and exempt. The Electron handler at electron/main.ts:2480-2547 has no equivalent comment so the omission of an SSRF check is undocumented in that file.',
    rationale:
      'A reader of the Electron handler in isolation could mistake the missing SSRF check for an oversight and "fix" it without realising the threat model is different (desktop = single-user trust boundary, web server = multi-tenant). Documenting the carve-out at the call site preserves the intentional asymmetry across future refactors.',
    proposedFix:
      'Add a 2-3 line comment block to the Electron project:smart-open handler header pointing readers to the web SSRF gate and stating the desktop trust-model rationale.',
    scope: 'one-file',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'FORGE.1',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-19',
    round: 2,
    scope: [
      'electron/main.ts:project:smart-open (~2480-2592)',
      'server/index.ts:project:smart-open (~1692-1846)',
      'electron/GitManager.ts:clone (~250-296)',
      'shared/ipc-validators.ts:projectSmartOpenSchema',
      'electron/__tests__/projectSmartOpen.test.ts',
    ],
    markdownFile: 'FORGE.1-security-review-2026-04-19-round2.md',
  },
  rubric: [
    { criterion: 'SEC-HIGH-1: slug derivation rejects empty, ".", "..", path-separator, and NUL inputs and falls back to randomUUID() in both Electron and web handlers', result: 'pass' },
    { criterion: 'SEC-HIGH-1: final path.resolve + startsWith(flintProjectsDir + path.sep) boundary assertion present in both clone destination computations', result: 'pass' },
    { criterion: 'SEC-HIGH-2: -c core.symlinks=false appears BEFORE the "clone" verb in both Electron (GitManager) and web (server/index.ts) argv arrays', result: 'pass' },
    { criterion: 'SEC-MED-1: --depth=1 --single-branch and timeout: 120_000 set in both clone paths; typed clone-timeout error thrown on SIGTERM/ETIMEDOUT', result: 'pass' },
    { criterion: 'SEC-MED-2: web handler rejects URLs whose host resolves to RFC1918, loopback, or link-local ranges', result: 'pass' },
    { criterion: 'SEC-MED-2: Electron carve-out is documented in code so the asymmetry is auditable', result: 'fail', evidence: 'electron/main.ts:2480-2547 has no comment referencing the web-only SSRF policy', relatedFindings: ['SUG-1'] },
    { criterion: 'SEC-MED-3: projectSmartOpenSchema enforces min(1), max(4096), .strict(), and a refine that bans \\p{Cc}\\p{Cf}', result: 'pass' },
    { criterion: 'SEC-MED-4: env scrub (GIT_TERMINAL_PROMPT=0, GIT_ASKPASS=echo, SSH_ASKPASS=echo) plus -c core.askPass=true in both paths; typed auth-required error thrown on credential-related stderr', result: 'pass' },
    { criterion: 'SEC-MED-5: fs.realpath(home) + path.resolve(projectPath) + boundary assertion replace prior string startsWith check in both Electron and web folder paths', result: 'pass' },
    { criterion: 'Deliberate-breakage probes for SEC-HIGH-1 and SEC-HIGH-2 exercise the vulnerable derivation/argv-ordering paths, not just the fixed happy-path', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'electron/main.ts:175-182 (realpathSafe helper)',
      'electron/main.ts:2466-2592 (project:get-health-grade + project:smart-open)',
      'electron/GitManager.ts:229-296 (clone method)',
      'server/index.ts:1692-1846 (web smart-open handler)',
      'shared/ipc-validators.ts:427-505 (FORGE.1 schemas)',
      'electron/__tests__/projectSmartOpen.test.ts (full file, 446 lines)',
    ],
    skipped: [
      'electron/main.ts:2400-2461 (FORGE.2c run-baseline) — out of FORGE.1 review scope',
      'detectProjectEnvironment internals — covered by FORGE.1 round-1 review and unchanged in fix-forward',
      'mcpClient.callTool wiring — outside fix-forward diff',
    ],
  },
};
