/**
 * FORGE.1 — Channel Consolidation + Smart Detection
 *
 * Executable contract. Phase 2 implementers import these types directly.
 * Compiles standalone with `npx tsc --noEmit` — no imports from src/.
 */

import type { FlintContract } from '../../shared/contract-schema';

// ─── Cross-boundary types Phase 2 imports ──────────────────────────────────

/** Single string accepted by the Start-from-existing-code channel. */
export interface SmartOpenPayload {
    /** Either an absolute folder path or a git URL (https://, git@, ssh://). */
    input: string;
}

/** Routing source returned to the renderer for telemetry + UI copy. */
export type SmartOpenSource = 'folder' | 'git-clone';

/**
 * Mirror of the public-facing fields of ProjectEnvironment from
 * shared/projectDetector.ts. Re-declared here so this contract file stays
 * import-free of src/ — Phase 2 wires the real type at the implementation
 * boundary.
 */
export interface ForgeProjectEnvironment {
    framework: { name: string; version: string } | null;
    cssFramework: { name: string; version: string } | null;
    componentLibrary: { name: string; version: string } | null;
    hasDesignTokens: boolean;
    tokenSource: 'flint' | 'style-dictionary' | 'tokens-studio' | null;
    componentCount: number;
    detectedAt: string;
    uiFramework: string;
    cssFrameworkLabel: string;
    tokenFormat: string | null;
    typescript: boolean;
    componentLibraryLabel: string | null;
}

export interface SmartOpenResult {
    projectPath: string;
    environment: ForgeProjectEnvironment;
    source: SmartOpenSource;
}

export interface DetectionPreviewProps {
    environment: ForgeProjectEnvironment;
    projectPath: string;
    onConfirm: (overrides?: Partial<ForgeProjectEnvironment>) => void;
    onCancel: () => void;
}

/** New 3-channel discriminator — replaces the legacy JTBDPath in LaunchScreen. */
export type ForgeChannel = 'from-idea' | 'from-figma' | 'from-existing-code';

// ─── Machine-readable contract ─────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'FORGE.1-ChannelConsolidationSmartDetection',
        phase: 'FORGE.1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-19',
        audience: 'designer',
    },

    impact: [
        {
            file: 'src/components/ui/LaunchScreen.tsx',
            changeType: 'MODIFY',
            owner: 'flint-design-engineer',
            summary:
                'Replace 4-tile JTBDPath array with 3-channel ForgeChannel array (from-idea | from-figma | from-existing-code); new from-idea handler skips folder picker; from-existing-code routes via project:smart-open; remove orphan setFigmaSetupOpen reference at line 228.',
        },
        {
            file: 'src/components/ui/DetectionPreview.tsx',
            changeType: 'CREATE',
            owner: 'flint-design-engineer',
            summary:
                'New component that renders ForgeProjectEnvironment summary with per-field override controls; calls project:auto-configure on confirm.',
        },
        {
            file: 'src/components/ui/__tests__/LaunchScreen.test.tsx',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary: 'Update existing tests to assert 3-channel rendering; add orphan-removal regression test.',
        },
        {
            file: 'src/components/ui/__tests__/DetectionPreview.test.tsx',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Render + interaction + override + IPC-call tests.',
        },
        {
            file: 'electron/main.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'Append-only: register project:smart-open IPC handler. Heuristic anchored regex for git URL vs folder; folder branch calls existing detectProjectEnvironment; git branch routes through GitManager (no raw exec) then detects.',
        },
        {
            file: 'server/index.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Web parity mirror of project:smart-open with the same heuristic and DetectorFS injection.',
        },
        {
            file: 'electron/preload.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Append-only: expose window.flintAPI.project.smartOpen(input: string).',
        },
        {
            file: 'src/types/flint-api.d.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'Type declaration for smartOpen with SmartOpenPayload + SmartOpenResult.',
        },
        {
            file: 'shared/ipc-validators.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'Append 5 Zod exports: projectDetectEnvironmentSchema (z.void), projectAutoConfigureSchema (z.void), projectRunBaselineSchema (z.void), projectGetHealthGradeSchema (z.string), projectSmartOpenSchema (z.object).',
        },
        {
            file: 'electron/__tests__/projectSmartOpen.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Heuristic routing fixture suite (≥ 20 inputs); validator integration; error propagation.',
        },
    ],

    ipc: [
        {
            channel: 'project:smart-open',
            direction: 'renderer→main',
            payloadType: 'SmartOpenPayload',
            returnType: 'SmartOpenResult',
            handler: 'electron/main.ts',
            validator: 'projectSmartOpenSchema',
        },
        {
            channel: 'project:detect-environment',
            direction: 'renderer→main',
            payloadType: 'void',
            returnType: 'ForgeProjectEnvironment | null',
            handler: 'electron/main.ts',
            validator: 'projectDetectEnvironmentSchema',
        },
        {
            channel: 'project:auto-configure',
            direction: 'renderer→main',
            payloadType: 'void',
            returnType: '{ configured: boolean; library: string | null; reindexed: boolean }',
            handler: 'electron/main.ts',
            validator: 'projectAutoConfigureSchema',
        },
        {
            channel: 'project:run-baseline',
            direction: 'renderer→main',
            payloadType: 'void',
            returnType: '{ violations: number; grade: string; score: number; filesAudited: number } | null',
            handler: 'electron/main.ts',
            validator: 'projectRunBaselineSchema',
        },
        {
            channel: 'project:get-health-grade',
            direction: 'renderer→main',
            payloadType: 'string',
            returnType: '{ grade: string; score: number; updatedAt: string } | null',
            handler: 'electron/main.ts',
            validator: 'projectGetHealthGradeSchema',
        },
    ],

    stores: [],

    components: [
        {
            name: 'LaunchScreen',
            file: 'src/components/ui/LaunchScreen.tsx',
            propsType: 'LaunchScreenProps',
            consumesStores: [],
            emitsIPC: [
                'project:smart-open',
                'project:create-scratchpad',
                'registry:getRecent',
                'project:get-health-grade',
            ],
        },
        {
            name: 'DetectionPreview',
            file: 'src/components/ui/DetectionPreview.tsx',
            propsType: 'DetectionPreviewProps',
            consumesStores: [],
            emitsIPC: ['project:auto-configure'],
        },
    ],

    commandments: [2, 4, 8, 12, 13, 14],

    testBoundaries: [
        {
            target: 'project:smart-open IPC handler — git URL routing',
            kind: 'ipc-handler',
            behavior: 'Routes a git URL through GitManager and runs detection on the cloned path',
            assertion: 'returns SmartOpenResult with source === "git-clone"',
            edgeCases: ['ssh:// URL', 'git@ shorthand', 'https URL with .git suffix', 'malformed URL throws'],
            given: 'A valid https git URL "https://github.com/example/repo.git" and a stub GitManager that resolves to /tmp/clone',
            when: 'project:smart-open is invoked with { input: "https://github.com/example/repo.git" }',
            then: 'returns SmartOpenResult where projectPath === "/tmp/clone" and source === "git-clone"',
        },
        {
            target: 'project:smart-open IPC handler — folder routing',
            kind: 'ipc-handler',
            behavior: 'Routes a folder path through detectProjectEnvironment without invoking git',
            assertion: 'returns SmartOpenResult with source === "folder" and a populated environment',
            edgeCases: ['absolute path with spaces', 'path that does not exist throws typed error', 'path inside home dir'],
            given: 'An absolute folder path /Users/test/my-react-app pointing at a project with package.json',
            when: 'project:smart-open is invoked with { input: "/Users/test/my-react-app" }',
            then: 'returns SmartOpenResult where source === "folder" and environment.framework.name === "react"',
        },
        {
            target: 'project:smart-open heuristic — UNC path rejection',
            kind: 'ipc-handler',
            behavior: 'Treats Windows UNC paths as folder paths, not git URLs',
            assertion: 'throws on a UNC path that does not exist rather than attempting git clone',
            edgeCases: ['\\\\server\\share', 'file:// URL'],
            given: 'A Windows UNC path "\\\\\\\\server\\\\share\\\\project" that does not exist on disk',
            when: 'project:smart-open is invoked with that input',
            then: 'throws a typed error containing "not a directory" and never calls GitManager.clone',
        },
        {
            target: 'projectSmartOpenSchema validator',
            kind: 'service',
            behavior: 'Rejects empty-string and non-object payloads at the preload bridge',
            assertion: 'throws ZodError before IPC fires',
            edgeCases: ['empty string', 'whitespace-only', 'null', 'number'],
            given: 'A payload of { input: "" }',
            when: 'projectSmartOpenSchema.parse is called',
            then: 'throws a ZodError with message containing "min(1)"',
        },
        {
            target: 'LaunchScreen — 3-channel rendering',
            kind: 'component',
            behavior: 'Renders exactly 3 primary channel buttons after the New Project CTA',
            assertion: 'queryAllByRole("button", { name: /^Start from/ }) has length 3',
            edgeCases: ['mcpConnected=true still shows 3 channels', 'recentProjects empty', 'web mode'],
            given: 'A fresh LaunchScreen render with default props and no recent projects',
            when: 'the component mounts',
            then: 'renders 3 channel buttons matching /^Start from (idea|Figma|existing code)/',
        },
        {
            target: 'LaunchScreen — Start from idea defers folder picker',
            kind: 'component',
            behavior: 'Clicking "Start from idea" never invokes dialog:openFolder before first render',
            assertion: 'spy on window.flintAPI.dialog.openFolder records 0 calls after click',
            edgeCases: ['web mode', 'electron mode', 'rapid double-click guarded'],
            given: 'A LaunchScreen with a spy on dialog.openFolder',
            when: 'the user clicks the "Start from idea" button',
            then: 'calls project:create-scratchpad and does NOT call dialog:openFolder',
        },
        {
            target: 'LaunchScreen — orphan setFigmaSetupOpen removed',
            kind: 'component',
            behavior: 'Source contains no reference to the deleted setFigmaSetupOpen setter',
            assertion: 'grep of LaunchScreen.tsx returns 0 hits for "setFigmaSetupOpen"',
            edgeCases: [],
            given: 'The post-refactor LaunchScreen.tsx file content',
            when: 'a regex /setFigmaSetupOpen/ is applied',
            then: 'returns 0 matches',
        },
        {
            target: 'DetectionPreview — confirm calls auto-configure with overrides',
            kind: 'component',
            behavior: 'Override controls merge into the auto-configure payload',
            assertion: 'project:auto-configure is invoked once with merged environment',
            edgeCases: ['no overrides', 'all overrides', 'null library override'],
            given: 'A DetectionPreview rendered with environment.componentLibrary === null and a user-selected override of "mui"',
            when: 'the user clicks Confirm',
            then: 'calls onConfirm with { componentLibrary: { name: "mui", version: "latest" } }',
        },
        {
            target: 'DetectionPreview — cancel does not auto-configure',
            kind: 'component',
            behavior: 'Cancel is non-destructive',
            assertion: 'project:auto-configure is not invoked',
            edgeCases: [],
            given: 'A rendered DetectionPreview',
            when: 'the user clicks Cancel',
            then: 'calls onCancel and does NOT call project:auto-configure',
        },
        {
            target: 'Start from idea defaults to MUI library',
            kind: 'ipc-handler',
            behavior: 'project:create-scratchpad called from from-idea channel passes libraryDefault: "mui"',
            assertion: 'handler receives { libraryDefault: "mui" }',
            edgeCases: ['user later overrides via DetectionPreview'],
            given: 'A LaunchScreen click on "Start from idea"',
            when: 'project:create-scratchpad is invoked',
            then: 'calls handler with payload containing libraryDefault === "mui"',
        },
    ],

    invariants: [
        {
            name: 'entry-channel-count',
            measurable: 'Number of primary channel buttons rendered by LaunchScreen',
            threshold: '=== 3',
            measuredBy: 'LaunchScreen.test.tsx — channelButtons.length assertion',
        },
        {
            name: 'from-idea-folder-deferral',
            measurable: 'Calls to dialog:openFolder during from-idea channel before first render',
            threshold: '=== 0',
            measuredBy: 'LaunchScreen.test.tsx — vi.fn spy on flintAPI.dialog.openFolder',
        },
        {
            name: 'smart-open-routing-precision',
            measurable: 'Heuristic correctness over 20 mixed-fixture inputs (folders + git URLs)',
            threshold: '>= 0.95',
            measuredBy: 'electron/__tests__/projectSmartOpen.test.ts — fixture matrix',
        },
        {
            name: 'validator-coverage-project-channels',
            measurable: 'Number of project:* renderer→main channels missing a Zod validator export',
            threshold: '=== 0',
            measuredBy: 'flint-contract-linter Phase 1.5 + preload.mcp-validation.test.ts',
        },
        {
            name: 'from-idea-ipc-roundtrip',
            // CODE-SUG-1 (Phase 2 fix-forward 2026-04-19): the original wall-clock
            // threshold conflated "no extra IPC round-trips" with "fast." The real
            // invariant is that the from-idea channel awaits `project:create-scratchpad`
            // on the same async flush as the click handler — no dialog interstitial,
            // no second IPC hop. That property is what the test now asserts.
            measurable: 'project:create-scratchpad is awaited inline in the from-idea click handler with no folder-picker IPC between the click and the canvas mount',
            threshold: 'same async flush (no dialog:openFolder calls, no extra IPC round-trips)',
            measuredBy: 'src/components/ui/__tests__/LaunchScreen.test.tsx — spy on dialog:openFolder, assert 0 calls; assert createScratchpad is awaited synchronously',
        },
        {
            name: 'detection-coverage-existing-code',
            measurable: 'Fraction of in-repo fixtures (electron/templates/* + demos/0*) where ProjectEnvironment.framework is non-null when run through detectProjectEnvironment',
            threshold: '>= 0.10',
            measuredBy: 'electron/__tests__/projectSmartOpen.test.ts fixture suite (Sprint 1 floor — only base-vite-tailwind ships a real package.json today; raising to 0.85 is Sprint 2 work tracked in HANDOFF as "fixture coverage backfill")',
        },
    ],

    risks: [
        {
            risk: 'Heuristic misclassifies a folder path that looks URL-ish, or git URL with no scheme',
            severity: 'medium',
            mitigation:
                'Anchored regex /^(https?:\\/\\/|git@|ssh:\\/\\/)/ — anything else is a folder path. UNC paths fail with typed error rather than silent clone.',
        },
        {
            risk: 'Library detection returns null for a project that uses MUI but never imports it',
            severity: 'low',
            mitigation: 'DetectionPreview always renders override controls. Default-MUI policy applies only to from-idea + null detection.',
        },
        {
            risk: 'Removing setFigmaSetupOpen orphan masks an undocumented re-mount path',
            severity: 'low',
            mitigation: 'Phase 2 grep audit + full test suite + integration validator.',
        },
        {
            risk: 'Retroactive Zod validators expose pre-existing payload shape mismatches',
            severity: 'medium',
            mitigation: 'Phase 2 must run preload.mcp-validation.test.ts-style integration check. Validator failures route to typed errors not silent crashes.',
        },
        {
            risk: 'Start from idea skipping folder picker breaks web mode where in-memory canvas state cannot persist across reload',
            severity: 'medium',
            commandment: 4,
            mitigation: 'Reuse existing project:create-scratchpad which already has web parity. First save triggers path prompt — same flow as today.',
        },
    ],

    parallelismGroups: {
        // Group A runs first — IPC plumbing + test scaffolds (it.todo against
        // the contract testBoundaries). flint-test-writer in Group A produces
        // the SCAFFOLD pass only (electron/__tests__/projectSmartOpen.test.ts
        // as it.todo). Group B then fills LaunchScreen + DetectionPreview tests
        // with real assertions once the IPC types and components exist.
        A: ['flint-electron-ipc', 'flint-test-writer'],
        B: ['flint-design-engineer', 'flint-test-writer'],
    },

    nonGoals: [
        'Visual redesign of LaunchScreen beyond 3-channel consolidation (Sprints 2-4)',
        'Animation/transition polish (Sprints 2-4)',
        'Copy refinement beyond the 3 channel labels themselves (Sprints 2-4)',
        'New AI orchestrator capabilities — Mason/Sage already exist',
        'Token sync changes — no Envoy/Scout work',
        'Mithril/Warden rule changes',
        'Library-pack support beyond MUI default — other adapters already shipped via LIB.1',
        'Removal of DemoScenarioPicker, Recent Projects, or Paste-Audit (these are persistent surfaces, not entry channels)',
        'Removal of footer "Connect to IDE" and "Open any folder…" (escape hatches, not channels)',
        'VS Code extension or CI surface changes',
        'New MCP tools',
        'New Zustand stores — Sprint 1 uses existing canvasStore + component-local state only',
        'Sprint 2-4 Forge work (smart-open progressive disclosure, brilliant-moment integrations)',
    ],
};
