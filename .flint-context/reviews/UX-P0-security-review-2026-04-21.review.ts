import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'UX-P0-SEC-W1',
    severity: 'warning',
    title: 'No size cap on rule overrides payload',
    commandment: 12,
    scope: 'one-file',
    observed:
      'governanceSaveOverridesValidator uses z.record(z.string(), ...) with no bound on key count or string length. A buggy or compromised renderer can submit an unbounded payload that the main process will serialize and write to disk.',
    rationale:
      'The schema is the only gate between the untrusted renderer and disk I/O. Without a cap this is a silent local-DoS / disk-fill vector and inflates every subsequent read.',
    evidence: [
      { file: 'shared/ipc-validators.ts', line: 528 },
      { file: 'shared/ipc-validators.ts', line: 530 },
      { file: 'electron/main.ts', line: 4450 },
      { file: 'server/index.ts', line: 2088 },
    ],
    proposedFix:
      'Add .max(200) on the record key schema and .refine(r => Object.keys(r).length <= 5000) on the rules record in shared/ipc-validators.ts. Both Electron and web handlers inherit the cap.',
    status: 'open',
  },
  {
    id: 'UX-P0-SEC-W2',
    severity: 'warning',
    title: 'get-overrides returns unvalidated parsed JSON',
    commandment: 16,
    scope: 'one-line',
    observed:
      'Both handlers JSON.parse the on-disk file and cast the result to the expected shape without re-running the Zod validator. A syntactically valid but structurally malformed file passes straight to the renderer typed as if valid.',
    rationale:
      'The write-side Zod gate is worthless if the read side does not re-validate. Local filesystem is part of the threat model (other tools, pack imports, manual edits).',
    evidence: [
      { file: 'electron/main.ts', line: 4464 },
      { file: 'server/index.ts', line: 2101 },
    ],
    proposedFix:
      'Replace the unchecked cast with governanceSaveOverridesValidator.safeParse(JSON.parse(raw)); return null on parse failure, mirroring ENOENT behavior. Apply to both handlers.',
    status: 'open',
  },
  {
    id: 'UX-P0-SEC-S1',
    severity: 'suggestion',
    title: 'Preload severity type is looser than the Zod schema',
    commandment: 9,
    scope: 'cross-file',
    observed:
      'preload.ts, flint-api.d.ts, and web-api.ts expose severity?: string, while the Zod validator accepts only the closed enum "critical" | "amber" | "advisory".',
    rationale:
      'The preload is the contract surface; narrower types push invariants left. Runtime validation still catches bad values, so this is DX/defense-in-depth, not an active vulnerability.',
    evidence: [
      { file: 'electron/preload.ts', line: 1691 },
      { file: 'src/adapters/web-api.ts', line: 598 },
      { file: 'src/types/flint-api.d.ts', line: 2167 },
    ],
    proposedFix:
      'Change severity?: string to severity?: "critical" | "amber" | "advisory" in the preload signature, the flint-api.d.ts declaration, and the web adapter.',
    status: 'open',
  },
  {
    id: 'UX-P0-SEC-S2',
    severity: 'suggestion',
    title: 'Raw error object logged on read failure',
    commandment: 12,
    scope: 'one-line',
    observed:
      'Non-ENOENT read failures log the full err object, which may include stack traces and absolute filesystem paths.',
    rationale:
      'IPC handlers should not surface raw error objects — narrow to { code, message } to reduce leakage if logs are shipped off-box.',
    evidence: [
      { file: 'electron/main.ts', line: 4468 },
      { file: 'server/index.ts', line: 2104 },
    ],
    proposedFix:
      'Log only err.code and err.message; drop the full object from the console.warn call.',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'UX-P0',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-21',
    round: 1,
    scope: [
      'electron/main.ts:4432-4472',
      'electron/preload.ts:1681-1695',
      'shared/ipc-validators.ts:519-537',
      'src/adapters/web-api.ts:598-601',
      'server/index.ts:2073-2108',
    ],
    markdownFile: 'UX-P0-security-review-2026-04-21.md',
  },
  rubric: [
    { criterion: 'Path constructed server-side, no renderer-supplied segments', result: 'pass' },
    { criterion: 'Payload Zod-validated before disk I/O (Electron)', result: 'pass' },
    { criterion: 'Payload Zod-validated before disk I/O (web parity)', result: 'pass' },
    { criterion: 'Write routed through FileTransactionManager / atomicWrite', result: 'pass' },
    { criterion: 'Payload size bounded (record keys + key length)', result: 'fail' },
    { criterion: 'Read-side validation of on-disk JSON', result: 'fail' },
    { criterion: 'No code execution / eval on the path', result: 'pass' },
    { criterion: 'Severity modeled as closed enum end-to-end at type surface', result: 'fail' },
    { criterion: 'Error logs redact raw Node error objects', result: 'fail' },
    { criterion: 'Preload surface typed (not any)', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'electron/main.ts:governance-overrides-handlers',
      'electron/preload.ts:saveRuleOverrides+getRuleOverrides',
      'shared/ipc-validators.ts:governance-overrides-validators',
      'src/adapters/web-api.ts:governance-overrides-adapter',
      'server/index.ts:governance-overrides-handlers',
    ],
    skipped: ['src/store/governanceStore.ts — consumer logic, covered by code reviewer'],
  },
};
