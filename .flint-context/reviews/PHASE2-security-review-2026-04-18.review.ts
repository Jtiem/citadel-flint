import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
    {
        id: 'PHASE2-SEC-H1',
        severity: 'high',
        title: 'Symlink escape bypasses path-traversal gate',
        observed:
            'isOutsideProject uses path.resolve (lexical) only; a symlink inside projectRoot that points outside the workspace lets fs.readFile follow it through to arbitrary filesystem paths.',
        rationale:
            'Defense-in-depth requires realpath-based canonicalization before any file read. An attacker who can plant a symlink inside node_modules (or via a malicious governance pack) defeats the traversal gate.',
        evidence: [
            { file: 'flint-mcp/src/core/cssModulesResolver.ts', line: 171, excerpt: 'const rel = path.relative(path.resolve(projectRoot), path.resolve(absolutePath))' },
            { file: 'flint-mcp/src/core/cssModulesResolver.ts', line: 287, excerpt: 'cssContent = await fs.promises.readFile(absoluteModulePath, \'utf8\')' },
        ],
        commandment: 14,
        proposedFix:
            'After the lexical startsWith check passes, call fs.realpath on absoluteModulePath and re-test against fs.realpath(projectRoot) before readFile. Catch ENOENT to preserve the module-not-found branch.',
        status: 'open',
        blocking: true,
    },
    {
        id: 'PHASE2-SEC-H2',
        severity: 'high',
        title: 'No CPU/timeout guard on PostCSS parse',
        observed:
            'postcss.parse(content) runs unbounded. A 1.9MB file with pathological nesting can stall the MCP event loop for seconds.',
        rationale:
            'Size cap bounds memory but not CPU. Phase 1 established a 2000ms budget for untrusted input processing (vm.Script); Phase 2 must match. Required before any multi-tenant deployment.',
        evidence: [
            { file: 'flint-mcp/src/core/cssStylesheetLoader.ts', line: 219, excerpt: 'root = postcss.parse(content, { syntax: syntaxPlugin })' },
            { file: 'flint-mcp/src/core/cssModulesResolver.ts', line: 128, excerpt: 'root = postcss.parse(content)' },
        ],
        commandment: 4,
        proposedFix:
            'Wrap parse in Promise.race with a 2000ms timeout. Return parse-error/module-parse-error on timeout. Mirror Phase 1 CPU budget.',
        status: 'open',
        blocking: true,
    },
    {
        id: 'PHASE2-SEC-M1',
        severity: 'medium',
        title: 'Size cap not enforced on CSS Modules read path',
        observed:
            'cssModulesResolver.resolve calls fs.promises.readFile without fs.stat; the 2MB cap defined in cssStylesheetLoader is bypassed.',
        rationale:
            'Two independent file-reading surfaces exist; only one enforces the contract invariant size-cap-enforced. A 500MB .module.css will OOM Node.',
        evidence: [
            { file: 'flint-mcp/src/core/cssModulesResolver.ts', line: 285, excerpt: 'cssContent = await fs.promises.readFile(absoluteModulePath, \'utf8\')' },
            { file: 'flint-mcp/src/core/cssStylesheetLoader.ts', line: 107, excerpt: 'export const MAX_STYLESHEET_SIZE_BYTES = 2_000_000' },
        ],
        commandment: 14,
        proposedFix:
            'Route modules resolver through cssStylesheetLoader.load (preferred: unified cache + size cap + timeout). Alternative: add stat-before-read gate inline with the same MAX_STYLESHEET_SIZE_BYTES check.',
        status: 'open',
        blocking: false,
    },
    {
        id: 'PHASE2-SEC-M2',
        severity: 'medium',
        title: 'Path-traversal timing invariant tested with flaky wall clock',
        observed:
            'Test 3 asserts Date.now() elapsed < 10ms; under CI load this is flaky and could silently hide a regression that added fs.stat before the gate.',
        rationale:
            'Contract invariant path-traversal-rejected-within-10ms should be enforced by asserting zero fs.* calls rather than wall-clock timing, which is environment-dependent.',
        evidence: [
            { file: 'flint-mcp/src/core/__tests__/cssModulesResolver.test.ts', line: 134, excerpt: 'expect(elapsed).toBeLessThan(10)' },
        ],
        commandment: 14,
        proposedFix:
            'Replace wall-clock assertion with spy-based assertion that fs.promises.stat, fs.promises.access, and fs.promises.readFile received zero calls for the outside-project path. Keep a loose wall-clock bound (<100ms) for sanity only.',
        status: 'open',
        blocking: false,
    },
    {
        id: 'PHASE2-SEC-M3',
        severity: 'medium',
        title: 'projectRoot not required to be absolute',
        observed:
            'resolve() accepts any string as projectRoot; if caller passes a relative path, path.resolve expands against process.cwd(), effectively moving the security boundary.',
        rationale:
            'Traversal defense must not depend on caller context. Silent fallback to cwd is a security downgrade with no error signal.',
        evidence: [
            { file: 'flint-mcp/src/core/cssModulesResolver.ts', line: 262, excerpt: 'const resolvedRoot = path.resolve(projectRoot)' },
        ],
        commandment: 14,
        proposedFix:
            'At function entry, throw if !path.isAbsolute(projectRoot). Document that callers must canonicalize once via fs.realpathSync.',
        status: 'open',
        blocking: false,
    },
    {
        id: 'PHASE2-SEC-L1',
        severity: 'low',
        title: 'Error details leak absolute filesystem paths',
        observed:
            'Error details include absolute paths, exposing user directory layout via MCP transcripts.',
        rationale:
            'Low risk for single-user Glass, noteworthy for Flint-as-a-Service roadmap. File contents and stack traces are NOT leaked — only paths.',
        evidence: [
            { file: 'flint-mcp/src/core/cssStylesheetLoader.ts', line: 367, excerpt: 'details: `File not found: ${absolutePath}`' },
            { file: 'flint-mcp/src/core/cssStylesheetLoader.ts', line: 377, excerpt: 'details: `File size ${stat.size} bytes exceeds limit...`' },
        ],
        commandment: 4,
        proposedFix:
            'When a projectRoot context is available, render paths relative to it in details strings.',
        status: 'open',
        blocking: false,
    },
    {
        id: 'PHASE2-SEC-L2',
        severity: 'low',
        title: 'Scoped-name hash is keyed on absolute path (non-reproducible across machines)',
        observed:
            'generateScopedName hashes ${modulePath}:${localName} where modulePath is absolute. Two developers auditing the same repo get different scoped names.',
        rationale:
            'Not a security issue (hash is not security-sensitive; Mithril uses only localClassName). Correctness note.',
        evidence: [
            { file: 'flint-mcp/src/core/cssModulesResolver.ts', line: 112, excerpt: 'const hash = simpleHash(`${modulePath}:${localName}`)' },
        ],
        proposedFix:
            'Hash over path.relative(projectRoot, modulePath) for reproducibility. Update JSDoc.',
        status: 'open',
        blocking: false,
    },
];

export const REPORT: ReviewReport = {
    meta: {
        phase: 'PHASE2',
        dimension: 'security',
        reviewer: 'flint-security-reviewer',
        date: '2026-04-18',
        round: 1,
        scope: [
            'flint-mcp/src/core/cssStylesheetLoader.ts',
            'flint-mcp/src/core/cssModulesResolver.ts',
            'flint-mcp/src/core/cssCustomPropertyMap.ts',
            'flint-mcp/src/core/tailwindV4ThemeParser.ts',
            'flint-mcp/src/core/__tests__/cssStylesheetLoader.test.ts',
            'flint-mcp/src/core/__tests__/cssModulesResolver.test.ts',
        ],
        markdownFile: 'PHASE2-security-review-2026-04-18.md',
    },
    rubric: [
        { criterion: 'Path-traversal gate runs BEFORE any fs.* call', result: 'pass', evidence: 'cssModulesResolver.ts:271-287 — isOutsideProject precedes readFile' },
        { criterion: 'Path-traversal gate resists symlink escape (realpath canonicalization)', result: 'fail', evidence: 'H1 — only lexical path.resolve used' },
        { criterion: 'Size cap (2MB) enforced via fs.stat before readFile in stylesheet loader', result: 'pass', evidence: 'cssStylesheetLoader.ts:362-380' },
        { criterion: 'Size cap enforced on all file-reading code paths', result: 'fail', evidence: 'M1 — cssModulesResolver reads without stat' },
        { criterion: 'Parse-time CPU timeout present on untrusted input', result: 'fail', evidence: 'H2 — no Promise.race timeout' },
        { criterion: 'Cycle detection in custom-property resolution terminates', result: 'pass', evidence: 'cssCustomPropertyMap.ts:118-122 visited set' },
        { criterion: 'AST treated as read-only (Commandment 13)', result: 'pass', evidence: 'Direct ast.program.body iteration; no mutation APIs called' },
        { criterion: 'Zero Node.js imports in src/', result: 'pass', evidence: 'All new modules in flint-mcp/src/core/' },
        { criterion: 'postcss-modules plugin hooks not used (no arbitrary code execution surface)', result: 'pass', evidence: 'Plain postcss + regex only; no plugin registration' },
        { criterion: 'Boundary tests for size cap (2M accepted, 2M+1 rejected)', result: 'pass', evidence: 'cssStylesheetLoader.test.ts tests 4 and 5' },
        { criterion: 'projectRoot validation (absolute path required)', result: 'fail', evidence: 'M3 — no assertion at entry' },
        { criterion: 'Error details do not leak file contents or stack traces', result: 'pass', evidence: 'Only paths and structured error codes returned' },
    ],
    findings,
    counts: countFindings(findings),
    verdict: deriveVerdict(findings, 'security'),
    scopeCoverage: {
        reviewed: [
            'cssStylesheetLoader.ts:full',
            'cssModulesResolver.ts:full',
            'cssCustomPropertyMap.ts:full',
            'tailwindV4ThemeParser.ts:full',
            'cssStylesheetLoader.test.ts:full',
            'cssModulesResolver.test.ts:full',
        ],
        skipped: [
            'Fixture corpus under __tests__/fixtures/css-modules/ — 20 fixtures, content review deferred to code review',
        ],
    },
};
