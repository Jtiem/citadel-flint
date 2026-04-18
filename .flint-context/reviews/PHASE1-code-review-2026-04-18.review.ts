import type { ReviewReport, ReviewFinding } from '../../shared/review-schema'
import { countFindings, deriveVerdict } from '../../shared/review-schema'

const findings: ReviewFinding[] = [
    {
        id: 'WARN-1',
        title: 'Unscoped edits outside Phase 1 contract in the same working tree',
        severity: 'warning',
        scope: 'cross-file',
        status: 'open',
        evidence: [
            {
                file: 'flint-mcp/src/core/A11yLinter.ts',
                line: 15,
                note: 'RUNTIME.1 appended comment block referencing `RUNTIME-<axe-id>` rule IDs — not Phase 1 scope',
            },
            {
                file: 'flint-mcp/src/core/config.ts',
                line: 287,
                note: '`rules.runtime.axe` config block + `isRuntimeAxeEnabled` helper at line 459',
            },
            {
                file: 'flint-mcp/src/core/governance/ruleProvenanceRegistry.ts',
                line: 685,
                note: '`RUNTIME-` prefix branch in `resolveProvenance`',
            },
            {
                file: 'flint-mcp/src/core/governance/types.ts',
                line: 24,
                note: "'runtime-dom' added to `SourceAuthority`",
            },
            {
                file: '.flint-context/contracts/RUNTIME.1-contract.md',
                note: 'Untracked contract for the parallel RUNTIME.1 swarm',
            },
        ],
        observed:
            'The working tree contains two phases at once: Phase 1 (Tailwind config + class composition) and RUNTIME.1 (axe-core runtime adapter). A naive `git commit` from this tree would ship both under a Phase 1 commit message.',
        rationale:
            'The Contract-First workflow requires a phase commit to contain only its contract-attributed files. Mixing swarms breaks bisect-ability, makes rollback surgical rather than atomic, and weakens the claim that Phase 1 is "additive only." The Phase 1 contract invariants are still met by the Phase 1 slice alone, but the commit needs to be split.',
        proposedFix:
            'Split the RUNTIME.1 files into their own branch (feat/runtime.1-axe-adapter). `git add` only the Phase 1 files: tailwindConfigLoader.ts, classExpressionExpander.ts, MithrilLinter.ts (partial), coverageClassifier.ts, the four new test files, fixtures/**, package.json, and the Phase 1 contract artifacts.',
    },
    {
        id: 'WARN-2',
        title: 'Fixture corpus exists on disk but is not executed by the test suite',
        severity: 'warning',
        scope: 'one-file',
        status: 'open',
        evidence: [
            {
                file: 'flint-mcp/src/core/__tests__/fixtures/class-expressions/',
                note: '50 .tsx fixtures with matching .expected.json siblings',
            },
            {
                file: 'flint-mcp/src/core/__tests__/classExpressionExpander.test.ts',
                line: 1,
                note: '51 describe() blocks, none read from the fixture directory. `grep fixtures/class-expressions` returns zero matches in the test file.',
            },
            {
                file: '.flint-context/contracts/PHASE1-tailwind-config-class-composition.contract.ts',
                note: 'Invariant classExpressionExpander-fidelity >= 0.95 is declared but unverifiable without fixture execution',
            },
        ],
        observed:
            'The 50-fixture corpus is committed but not driven by the test suite. All 51 passing tests use inline source strings. The contract defines a fidelity invariant of >=0.95 (47.5/50 minimum), but that threshold is not measured from the fixtures.',
        rationale:
            'Fidelity is a headline contract invariant. If the fixtures are reference cases, the suite should iterate them so an unintended behavior change in the expander fails loudly. As is, a developer could edit 02-clsx-single-arg.expected.json to anything and nothing would fail.',
        proposedFix:
            'Add a `describe.each(fixtures)` runner that reads each .tsx, runs expandAllList, and deepEquals against .expected.json. Assert fidelity = passing/total >= 0.95.',
    },
    {
        id: 'WARN-3',
        title: 'Community preset-trust escape surface is not documented as a risk',
        severity: 'warning',
        scope: 'one-line',
        commandment: 14,
        status: 'open',
        evidence: [
            {
                file: 'flint-mcp/src/core/tailwindConfigLoader.ts',
                line: 120,
                note: '`/^tailwindcss-[a-z0-9-]+$/.test(spec)` — allows any community preset by name',
            },
            {
                file: 'flint-mcp/src/core/tailwindConfigLoader.ts',
                line: 166,
                excerpt: 'return safeRequire(specifier)',
                note: 'Allowed specifiers load with full Node privileges via createRequire',
            },
            {
                file: 'flint-mcp/src/core/tailwindConfigLoader.ts',
                line: 173,
                excerpt: '// re-sandboxed at this layer (tailwindcss internals are trusted).',
                note: 'Inline comment does not call out the community-preset risk',
            },
        ],
        observed:
            'Any npm package whose name matches `tailwindcss-<kebab>` loads with full Node privileges inside the Phase 1 sandbox. The sandbox prevents top-level `require("fs")` in the user config but cannot prevent `require("tailwindcss-evil")` where the preset itself calls fs or spawns a child process.',
        rationale:
            'Commandment 14 covers Flint code paths, not third-party npm packages — this is a trust model, not a bug. But users may reasonably expect "vm.runInNewContext with frozen sandbox" to block all file/network/env access transitively. The risk surface should be documented explicitly so security-conscious users can lock the allowlist to `tailwindcss` + `@tailwindcss/*` only.',
        proposedFix:
            'Add a JSDoc SECURITY NOTE to sandboxRequire explaining the trust boundary and add to contract nonGoals: "Community-preset trust model — allowlisted tailwindcss-* packages run with full Node privileges; project is expected to audit its npm dependencies."',
    },
    {
        id: 'SUG-1',
        title: 'detectTailwindVersion heuristic is fragile',
        severity: 'suggestion',
        scope: 'one-file',
        status: 'open',
        evidence: [
            {
                file: 'flint-mcp/src/core/tailwindConfigLoader.ts',
                line: 642,
                note: 'Detects v4-js by substring match on `@tailwindcss/vite` / `@tailwindcss/postcss` and `_v4` / `__isTailwindV4` marker fields',
            },
        ],
        observed:
            'Version detection relies on source substring matching and escape-hatch marker fields. A v4 config using a different plugin name or a v3 config importing @tailwindcss/vite will be mis-classified.',
        rationale:
            'Low-impact — only the `version` label on the result is affected, not behavior. Worth a note for Phase 2 when v4 CSS-first is implemented.',
        proposedFix:
            'Read tailwindcss/package.json version inside the sandbox or defer version detection to Phase 2.',
    },
    {
        id: 'SUG-2',
        title: 'resolveConfig try/catch silently falls through',
        severity: 'suggestion',
        scope: 'one-line',
        status: 'open',
        evidence: [
            {
                file: 'flint-mcp/src/core/tailwindConfigLoader.ts',
                line: 333,
                excerpt: 'try { resolved = resolveConfig(rawConfig) } catch { /* fall through */ }',
            },
        ],
        observed:
            'If Tailwind resolveConfig throws (malformed user config, version skew), we silently use the unresolved raw config. No log, no diagnostic, no changed return value.',
        rationale:
            'The user will not see why their extend tokens did not merge. Silent failure hides bugs.',
        proposedFix:
            'Capture the error and attach it as a diagnostic on the theme, or return { ok: false, error: "resolve-config-threw" } which is already defined in TailwindConfigLoadError.',
    },
    {
        id: 'SUG-3',
        title: 'Theme-token merge does not respect (token_path, collection_name) uniqueness',
        severity: 'suggestion',
        scope: 'one-file',
        status: 'open',
        evidence: [
            {
                file: 'flint-mcp/src/core/MithrilLinter.ts',
                line: 1919,
                note: 'mergeThemeTokens uses `existingPaths.has(tp)` — path-only uniqueness, not (path, collection)',
            },
        ],
        observed:
            'When an existing token and a theme-derived token share token_path, the existing wins; otherwise both coexist. CIEDE2000 will match against both, which is the intended behavior but could produce duplicate-token warnings if future theme sections drop the `tailwind.` prefix.',
        rationale:
            'Minor — the current tailwind.* prefix namespace prevents most collisions. Advisory only: if a future theme section uses an unprefixed path, collisions become silent.',
        proposedFix:
            'Document the precedence rule at the top of mergeThemeTokens or extend uniqueness to (token_path, collection_name).',
    },
]

export const REPORT: ReviewReport = {
    meta: {
        phase: 'PHASE1-tailwind-config-class-composition',
        dimension: 'code',
        reviewer: 'flint-code-reviewer',
        date: '2026-04-18',
        round: 1,
        scope: [
            'tailwindConfigLoader.ts (new, 675 LOC)',
            'classExpressionExpander.ts (new, 680 LOC)',
            'coverageClassifier.ts (upgrade path)',
            'MithrilLinter.ts (auditAll integration)',
            '29 + 51 + 15 + 10 new tests',
            '50-fixture class-expression corpus',
            '10-fixture tailwind-config corpus',
            'package.json dep additions',
            'Phase 1 contract artifacts',
        ],
        markdownFile: 'PHASE1-code-review-2026-04-18.md',
    },
    rubric: [
        {
            criterion: 'vm.runInNewContext is used for user config evaluation (C14)',
            result: 'pass',
            evidence: 'tailwindConfigLoader.ts:212',
        },
        {
            criterion: 'Sandbox object contains zero Node built-ins (process/fs/http/etc)',
            result: 'pass',
            evidence: 'tailwindConfigLoader.ts:183-204 — sandbox object does not declare process/global/fs/http/https/net/fetch/child_process/setTimeout/setInterval/import/Worker/SharedArrayBuffer',
        },
        {
            criterion: 'Custom require rejects non-allowlisted specifiers',
            result: 'pass',
            evidence: 'tailwindConfigLoader.ts:166-175 + tests require-fs/require-http/fetch all return sandbox-violation',
        },
        {
            criterion: '2000ms timeout enforced at vm.Script and wall-clock race',
            result: 'pass',
            evidence: 'tailwindConfigLoader.ts:208-212 (vm CPU) + 557-566 (wall-clock +100ms grace)',
        },
        {
            criterion: 'Error details do not leak file contents or env var values',
            result: 'pass',
            evidence: 'test `does NOT leak the env var value in details` passes; redactErrorDetails at line 130 redacts (args) and =values',
        },
        {
            criterion: 'classExpressionExpander is read-only against AST (C13)',
            result: 'pass',
            evidence: 'classExpressionExpander.ts — no path.replaceWith/insertBefore/remove anywhere; traverse visitor only reads',
        },
        {
            criterion: 'AuditAllOptions signature preserved (all new fields optional)',
            result: 'pass',
            evidence: 'MithrilLinter.ts:1903-1915 — tailwindTheme?, classExpansions? both optional',
        },
        {
            criterion: 'Coverage classifier upgrade suppresses tailwind-config-extension correctly',
            result: 'pass',
            evidence: 'coverageClassifier.ts:513-523 — gated on tailwindConfig?.ok === true',
        },
        {
            criterion: 'Coverage classifier upgrade suppresses dynamic-class-expression correctly',
            result: 'pass',
            evidence: 'coverageClassifier.ts:528-544 — gated on classExpansions !== undefined && length > 0 && every unresolvable=false',
        },
        {
            criterion: 'All 5447 MCP tests pass, TSC exits 0',
            result: 'pass',
            evidence: 'npx vitest run → 5447/5447; npx tsc --noEmit → 0 errors',
        },
        {
            criterion: 'Phase 1 commit is atomic (no unrelated file changes)',
            result: 'fail',
            evidence: 'RUNTIME.1 files (A11yLinter.ts, config.ts, ruleProvenanceRegistry.ts, governance/types.ts, src/**, server/index.ts) are dirty in working tree',
            relatedFindings: ['WARN-1'],
        },
        {
            criterion: '50-fixture corpus is executed by the test suite',
            result: 'fail',
            evidence: 'classExpressionExpander.test.ts contains no references to fixtures/class-expressions/',
            relatedFindings: ['WARN-2'],
        },
        {
            criterion: 'Community-preset trust model is documented as a risk',
            result: 'fail',
            evidence: 'tailwindConfigLoader.ts:173 comment says "tailwindcss internals are trusted" but no explicit note on community-preset escape. Contract nonGoals does not list it.',
            relatedFindings: ['WARN-3'],
        },
        {
            criterion: 'cva handles compoundVariants correctly',
            result: 'pass',
            evidence: 'test 37 inline verifies compoundVariants leaf strings land in possible',
        },
        {
            criterion: 'cva skips defaultVariants',
            result: 'pass',
            evidence: 'classExpressionExpander.ts:549-550 + test 38 inline',
        },
        {
            criterion: 'Renamed imports correctly resolve utility kind (import cn from clsx → utility=clsx)',
            result: 'pass',
            evidence: 'buildBindingTable inspects node.source.value and records localName → utility; fixture 31 expected utility="clsx" confirmed by test',
        },
        {
            criterion: 'Unresolvable identifiers mark unresolvable=true',
            result: 'pass',
            evidence: 'classExpressionExpander.ts:343-352 (resolveLocalConst fallback) + fixtures 41-45',
        },
    ],
    findings,
    counts: countFindings(findings),
    verdict: deriveVerdict(findings, 'code'),
    scopeCoverage: {
        reviewed: [
            'flint-mcp/src/core/tailwindConfigLoader.ts',
            'flint-mcp/src/core/classExpressionExpander.ts',
            'flint-mcp/src/core/coverageClassifier.ts',
            'flint-mcp/src/core/MithrilLinter.ts (auditAll + visitClassNames diff)',
            'flint-mcp/src/core/__tests__/tailwindConfigLoader.test.ts',
            'flint-mcp/src/core/__tests__/classExpressionExpander.test.ts',
            'flint-mcp/src/core/__tests__/coverageClassifier.test.ts (diff)',
            'flint-mcp/src/core/__tests__/fixtures/tailwind-configs/ (10 configs)',
            'flint-mcp/src/core/__tests__/fixtures/class-expressions/ (50 fixtures)',
            'flint-mcp/package.json',
            '.flint-context/contracts/PHASE1-tailwind-config-class-composition.contract.ts',
            '.flint-context/contracts/PHASE1-tailwind-config-class-composition-contract.md',
        ],
        skipped: [
            'flint-mcp/src/core/A11yLinter.ts — RUNTIME.1 scope, not Phase 1',
            'flint-mcp/src/core/config.ts — RUNTIME.1 isRuntimeAxeEnabled helper, not Phase 1',
            'flint-mcp/src/core/governance/ruleProvenanceRegistry.ts — RUNTIME.1 runtime-dom authority',
            'flint-mcp/src/core/governance/types.ts — RUNTIME.1 SourceAuthority union extension',
            'src/**, server/**, shared/ipc-validators.ts, electron/** — RUNTIME.1 runtime/axe UI + IPC work',
            'docs/strategy/** — not code scope',
        ],
    },
}
