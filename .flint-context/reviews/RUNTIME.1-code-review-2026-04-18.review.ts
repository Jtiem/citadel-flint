/**
 * RUNTIME.1 — Code Review (machine-readable)
 *
 * Sibling to RUNTIME.1-code-review-2026-04-18.md.
 * Reviewer: flint-code-reviewer (Reviewer 2 of 3, parallel round).
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema'
import { countFindings, deriveVerdict } from '../../shared/review-schema'

const findings: ReviewFinding[] = [
    {
        id: 'BLK-1',
        title: 'Electron IPC surface declared but not implemented',
        severity: 'blocking',
        scope: 'cross-file',
        status: 'open',
        commandment: 9,
        evidence: [
            {
                file: 'electron/main.ts',
                note: 'Full-file grep for runtime:run-axe|runAxe|axe-core|playwright|createRuntimeAuditSandbox returns zero matches.',
            },
            {
                file: 'electron/preload.ts',
                line: 3,
                excerpt: "import { validateIPC, mcpCallToolSchema } from '../shared/ipc-validators.ts'",
                note: 'No runtime namespace binding; runtimeRunAxePayloadSchema never imported.',
            },
            {
                file: 'src/types/flint-api.d.ts',
                line: 2205,
                excerpt: 'runtime: { runAxe: (request: {...}) => Promise<{...}> }',
                note: 'Declares a surface that does not exist in the Electron main process.',
            },
            {
                file: 'src/hooks/useRuntimeAudit.ts',
                line: 98,
                excerpt: 'if (!api?.runAxe) { updateStatus(\'error\'); useNotificationStore.getState().push({ ... })',
                note: 'In the Electron build this branch is always taken.',
            },
        ],
        observed:
            'src/types/flint-api.d.ts declares window.flintAPI.runtime.runAxe and useRuntimeAudit.ts calls it, but electron/main.ts contains no runtime:run-axe ipcMain.handle and electron/preload.ts does not expose a runtime namespace.',
        rationale:
            'The contract (Decision #1) commits to a separate sandboxed BrowserWindow with its own CSP in Electron. No such code exists. Glass ships on Electron as the primary desktop target; without an IPC handler, a flag-on Electron user sees the pill transition to error state on first click, never reaching axe. The web-parity invariant R6 is violated in the opposite direction: web works, Electron does not.',
        proposedFix:
            'Add ipcMain.handle("runtime:run-axe", ...) in electron/main.ts mirroring server handler shape; spawn BrowserWindow with nodeIntegration: false, contextIsolation: true, preload: undefined, sandbox: true; CSP script-src \'self\' \'unsafe-eval\'; network blocked via session.webRequest.onBeforeRequest. Expose via contextBridge in electron/preload.ts with validateIPC wrapping. Add integration test that spawns ipcMain/ipcRenderer and asserts round-trip.',
    },
    {
        id: 'BLK-2',
        title: 'Renderer SourceAuthority mirror is out of sync with engine',
        severity: 'blocking',
        scope: 'one-file',
        status: 'open',
        commandment: 9,
        evidence: [
            {
                file: 'flint-mcp/src/core/governance/types.ts',
                line: 29,
                excerpt: "| 'runtime-dom'",
                note: 'Engine union has 9 members including runtime-dom.',
            },
            {
                file: 'src/types/flint-api.d.ts',
                line: 2277,
                excerpt:
                    "export type SourceAuthority = | 'WCAG 2.1 AA' | 'WCAG 2.2 AA' | 'SOC2' | 'FDA SaMD' | 'HIPAA' | 'Flint Design System' | 'Custom'",
                note: 'Renderer mirror has only 8 members; missing "Section 508" AND "runtime-dom".',
            },
            {
                file: 'src/types/runtime-audit.ts',
                line: 35,
                excerpt: 'export type RuntimeSourceAuthority = BaseSourceAuthority | \'runtime-dom\'',
                note: 'Local workaround type that would be unnecessary if the mirror were kept in sync.',
            },
        ],
        observed:
            'The engine SourceAuthority union at flint-mcp/src/core/governance/types.ts:29 appends "runtime-dom" append-only. The renderer-side mirror at src/types/flint-api.d.ts:2277-2284 lists only 8 values — both "Section 508" and "runtime-dom" are missing.',
        rationale:
            'The renderer mirror carries an explicit instruction to stay in sync (src/types/flint-api.d.ts:8-12). The RUNTIME.1 impact row for flint-api.d.ts says "APPEND ONLY — declare window.flintAPI.runtime namespace" and the agent appended the namespace but forgot the union. Consumers doing exhaustive narrowing on SourceAuthority in the renderer will miss the new value; Record<SourceAuthority, number> initializers will fail exhaustiveness checks once consumers read from the canonical mirror.',
        proposedFix:
            'Append " | \'Section 508\' | \'runtime-dom\'" to the union at src/types/flint-api.d.ts:2277-2284. Then simplify src/types/runtime-audit.ts:23-35 so RuntimeSourceAuthority is just SourceAuthority.',
    },
    {
        id: 'WARN-1',
        title: 'Server handler launches Chromium with --no-sandbox',
        severity: 'warning',
        scope: 'one-line',
        status: 'open',
        evidence: [
            {
                file: 'server/index.ts',
                line: 4244,
                excerpt: "args: ['--no-sandbox', '--disable-dev-shm-usage'],",
                note: 'Chromium browser sandbox disabled for the sandbox that executes preview HTML.',
            },
        ],
        observed:
            'The Playwright chromium.launch call at server/index.ts:4242-4245 passes --no-sandbox, disabling the Chromium renderer sandbox for the window that renders potentially hostile preview HTML.',
        rationale:
            'Network is blocked at the route layer and axe is loaded locally, but --no-sandbox means a Chromium 0-day or preview-HTML RCE chain executes without the renderer-process sandbox. For a local tool that accepts designs from untrusted Figma imports or templates this is an elevated local risk.',
        proposedFix:
            "Remove --no-sandbox. If CI requires it (rootless Linux container), gate the flag behind process.env.CI === 'true' and emit a console warning noting sandbox is disabled. Document the decision in the contract risks list.",
    },
    {
        id: 'WARN-2',
        title: 'No timeout on the runtime audit handler',
        severity: 'warning',
        scope: 'one-file',
        status: 'open',
        commandment: 4,
        evidence: [
            {
                file: 'server/index.ts',
                line: 4258,
                excerpt: "await page.goto(dataUrl, { waitUntil: 'load' })",
                note: 'No timeout option.',
            },
            {
                file: 'server/index.ts',
                line: 4260,
                excerpt: 'const sandboxResult: any = await page.evaluate(...)',
                note: 'No Promise.race wrapper.',
            },
        ],
        observed:
            'The handler awaits page.goto, page.addScriptTag, and page.evaluate without a wrapping timeout. A pathological preview (infinite <script> loop, uncooperative load event) can leave the handler promise unresolved indefinitely.',
        rationale:
            "Contract invariant runtime-audit-latency-p95 declares < 3000ms at N=1000 nodes and empty-preview-handled < 500ms. Both are bench-tested but there is no production guard. A stuck handler pins a Chromium process, holds the WebSocket slot, and blocks the useRuntimeAudit serialization slot forever.",
        proposedFix:
            "Wrap goto/addScriptTag/evaluate in Promise.race against a 30-second timeout. On timeout, return { status: 'error', error: { code: 'sandbox-timeout', message: 'Runtime audit exceeded 30s' } }.",
    },
    {
        id: 'WARN-3',
        title: 'playwright is on caret range, not exact pin',
        severity: 'warning',
        scope: 'one-line',
        status: 'open',
        evidence: [
            {
                file: 'package.json',
                line: 79,
                excerpt: '"playwright": "^1.52.0",',
                note: 'Caret admits all 1.x.x upgrades.',
            },
            {
                file: 'package.json',
                line: 55,
                excerpt: '"axe-core": "4.10.3",',
                note: 'axe-core IS exact-pinned per contract Decision #4; playwright was not.',
            },
        ],
        observed:
            'The brief claims playwright@1.58.2 is the installed version. package.json specifies "^1.52.0" — caret range, not exact pin. Contract Decision #4 exact-pins axe-core but does not mention Playwright.',
        rationale:
            'The sandbox isolation claim depends on Chromium honoring the route interceptor, data-URL semantics, and browser sandbox behavior. Minor Playwright bumps have historically altered context.route() semantics and default flag lists. Pinning axe-core while leaving Playwright on caret lets supply-chain drift silently change the sandbox surface.',
        proposedFix:
            'Change package.json:79 to exact "1.52.0" (or whatever is in package-lock.json today). Add the pinned version to the contract Decisions list alongside axe-core@4.10.3.',
    },
    {
        id: 'SUG-1',
        title: 'Drop file: from allowed schemes in the network blocker',
        severity: 'suggestion',
        scope: 'one-line',
        status: 'open',
        evidence: [
            {
                file: 'server/index.ts',
                line: 4250,
                excerpt:
                    "if (url.startsWith('data:') || url.startsWith('about:') || url.startsWith('file:')) {",
                note: 'file: not required for the normal data-URL path.',
            },
        ],
        observed:
            'The route interceptor allows file: URLs through. The sandbox injects HTML via data:text/html;base64,..., so file: is not required for correctness.',
        rationale:
            "Defense-in-depth. Preview HTML that dereferences file:///etc/passwd or an SSH key path would mostly be blocked at the OS layer anyway, but the smallest surface is the safest surface. The fewer schemes we permit the narrower the attack surface.",
        proposedFix:
            "Remove || url.startsWith('file:') from the allow-list. If a later phase genuinely needs file:// for iframe inlining, re-enable behind a rules.runtime.axe.allowFileUrls flag.",
    },
]

export const REPORT: ReviewReport = {
    meta: {
        phase: 'RUNTIME.1',
        dimension: 'code',
        reviewer: 'flint-code-reviewer',
        date: '2026-04-18',
        round: 1,
        scope: [
            '13 prod files',
            '4 test files',
            'contract markdown + executable contract',
            'shared review + ipc validators',
            'package.json dependency pins',
        ],
        markdownFile: 'RUNTIME.1-code-review-2026-04-18.md',
    },
    rubric: [
        {
            criterion: "runtime:run-axe renderer→main IPC channel has a Zod validator in shared/ipc-validators.ts",
            result: 'pass',
            evidence: "shared/ipc-validators.ts:213-248 defines ipcSchemas['runtime:run-axe']; exports at 283-287.",
        },
        {
            criterion: 'Electron main process registers a handler for every IPC channel the preload bridge exposes',
            result: 'fail',
            evidence:
                'electron/main.ts has no runtime:run-axe handler; electron/preload.ts exposes no runtime namespace; src/types/flint-api.d.ts:2205 declares the surface.',
            relatedFindings: ['BLK-1'],
        },
        {
            criterion: 'SourceAuthority union is extended append-only across engine and renderer',
            result: 'fail',
            evidence:
                'Engine at flint-mcp/src/core/governance/types.ts:29 has runtime-dom. Renderer at src/types/flint-api.d.ts:2277-2284 does not.',
            relatedFindings: ['BLK-2'],
        },
        {
            criterion: 'axe-core is pinned to exact 4.10.3',
            result: 'pass',
            evidence: 'package.json:55 → "axe-core": "4.10.3"',
        },
        {
            criterion: 'playwright is pinned to exact 1.58.2 as claimed in brief',
            result: 'fail',
            evidence: 'package.json:79 → "playwright": "^1.52.0" — caret range, not 1.58.2.',
            relatedFindings: ['WARN-3'],
        },
        {
            criterion: 'Sandbox Chromium runs with full browser sandbox active',
            result: 'fail',
            evidence: "server/index.ts:4244 launches Playwright with args: ['--no-sandbox', '--disable-dev-shm-usage'].",
            relatedFindings: ['WARN-1'],
        },
        {
            criterion: 'Network disabled during audit (C4 Local-First)',
            result: 'pass',
            evidence:
                'server/index.ts:4248-4255 intercepts all routes; only data:, about:, file: permitted. axe bundle loaded from local node_modules.',
        },
        {
            criterion: 'axe.version === 4.10.3 mismatch returns a soft error rather than throwing',
            result: 'pass',
            evidence: 'server/index.ts:4267-4298 returns status: "version-mismatch" via schema-validated response.',
        },
        {
            criterion: 'axeRuleMap covers common axe rules overlapping Warden',
            result: 'pass',
            evidence: 'flint-mcp/src/core/axeRuleMap.ts:36-86 maps 31 rules; tests assert each.',
        },
        {
            criterion: 'Unmapped axe rules return RUNTIME-<axe-id> prefix',
            result: 'pass',
            evidence:
                'flint-mcp/src/core/__tests__/axeRuleMap.test.ts:71-82 assert null for unknown; server handler falls back to RUNTIME- prefix at line 4339.',
        },
        {
            criterion: 'Dedup merges AST + runtime authorities on (ruleId, elementId) match',
            result: 'pass',
            evidence: 'src/hooks/useMergedA11yFindings.ts:86-132.',
        },
        {
            criterion: 'canvasStore.runtimeFindings is never persisted to disk (C12)',
            result: 'pass',
            evidence:
                'src/store/canvasStore.ts:289,929-930,977. Cleared on closeWorkspace and setActiveFile. No SQLite write paths added.',
        },
        {
            criterion: 'Store slice avoids cross-store imports',
            result: 'pass',
            evidence:
                'src/store/canvasStore.ts imports no other stores. IPC call lives in useRuntimeAudit, not in the store action.',
        },
        {
            criterion: 'useRuntimeAudit hook serializes concurrent run() calls to 1 IPC invocation',
            result: 'pass',
            evidence: 'src/hooks/useRuntimeAudit.ts:92 guard on statusRef.current === "running".',
        },
        {
            criterion: 'RuntimeAuditPill not mounted when flag is false',
            result: 'pass',
            evidence: 'src/components/editor/StatusBar.tsx:221-232 — RuntimeAuditGate returns null when flag off.',
        },
        {
            criterion: 'Runtime Audit accordion not rendered when flag off',
            result: 'pass',
            evidence:
                'src/components/ui/GovernanceDashboard.tsx:483-485 wraps accordion in conditional runtimeAxeEnabled && ...',
        },
        {
            criterion: 'Server handler lazy-imports Playwright so boot is not slowed',
            result: 'pass',
            evidence: 'server/index.ts:4166-4173 — dynamic import(\'playwright\') inside handler closure.',
        },
        {
            criterion: 'Handler has a timeout to prevent pathological preview from hanging',
            result: 'fail',
            evidence: 'server/index.ts:4258,4260 — page.goto and page.evaluate have no timeout wrapper.',
            relatedFindings: ['WARN-2'],
        },
        {
            criterion: 'StatusBar changes compose cleanly with MINT.5 Phase 2 markup',
            result: 'pass',
            evidence:
                'StatusBar.tsx:849-852 — RuntimeAuditGate is a sibling to existing pills; no overlap with MINT.5 additions in the inspected region.',
        },
    ],
    findings,
    counts: countFindings(findings),
    verdict: deriveVerdict(findings, 'code'),
    scopeCoverage: {
        reviewed: [
            '.flint-context/contracts/RUNTIME.1-contract.md',
            '.flint-context/contracts/RUNTIME.1.contract.ts',
            'flint-mcp/src/core/axeRuleMap.ts',
            'flint-mcp/src/core/__tests__/axeRuleMap.test.ts',
            'flint-mcp/src/core/governance/types.ts',
            'flint-mcp/src/core/governance/ruleProvenanceRegistry.ts',
            'flint-mcp/src/core/governance/__tests__/runtimeDomProvenance.test.ts',
            'flint-mcp/src/core/A11yLinter.ts',
            'flint-mcp/src/core/config.ts',
            'shared/ipc-validators.ts',
            'src/types/runtime-audit.ts',
            'src/types/flint-api.d.ts',
            'src/store/canvasStore.ts',
            'src/hooks/useRuntimeAudit.ts',
            'src/hooks/useRuntimeAxeFlag.ts',
            'src/hooks/useMergedA11yFindings.ts',
            'src/components/editor/RuntimeAuditPill.tsx',
            'src/components/editor/StatusBar.tsx',
            'src/components/ui/GovernanceDashboard.tsx',
            'src/components/ui/governance/RuntimeAuditAccordion.tsx',
            'src/adapters/web-api.ts',
            'src/components/__tests__/setup.ts',
            'server/index.ts',
            'electron/__tests__/runtimeAxeIpc.test.ts',
            'electron/main.ts (verified-absent surface)',
            'electron/preload.ts (verified-absent surface)',
            'package.json',
        ],
        skipped: [
            'docs/strategy/WEEKEND-PLAN-2026-04-18.md — not in code-review scope',
            'Integration tests for Playwright handler — require browser download; declared contract testBoundary',
            'npm test / npm test:react / cd flint-mcp && npm test — Bash permission denied in review env; test file contents inspected directly',
            'src/hooks/__tests__/useMergedA11yFindings.test.ts fixtures — inspected hook source, relied on contract testBoundaries',
            'Full MINT.5 Phase 2 StatusBar diff — integration-validator scope',
        ],
    },
}
