# D2C.4 -- Quality & Intelligence Upgrade

**Phase:** D2C.4
**Status:** CONTRACT
**Author:** flint-architect
**Date:** 2026-03-26
**Depends on:** D2C.1 (HydroPaste -- ONLINE), D2C.2 (LivePreview Integration -- CONTRACT), D2C.3 (Library Preview Runtime -- COMPLETE)

---

## Overview

Four features that upgrade the Design-to-Code pipeline from scaffold quality to production quality:

1. **classifyFrame + classifyComponent** -- Structural and semantic heuristics for smarter JSX emission
2. **Token Extraction from Figma** -- Extract, review, and approve design tokens from Figma payloads
3. **Code Connect Auto-Registration** -- Bridge Flint's library registry to Figma Code Connect
4. **Governance Overlay on Generated Code** -- Ensure Mithril audit fires immediately on D2C output

---

## Feature 1: classifyFrame + classifyComponent Heuristics

### Problem

Currently, `generateJSXWithEmitter` treats every non-TEXT, non-button FRAME as a `div` container. This produces flat, semantically poor output. A Figma frame named "ContactForm" with input children becomes a `<Card>` with nested `<Card>`s instead of a `<form>` with `<Input>` components.

### Design

Two pure functions added to `hydroPaste.ts`:

#### classifyFrame

Determines the HTML/component wrapper for a FRAME node based on structural signals.

```typescript
type FrameClassification =
  | 'card'        // Has fill + border/shadow, depth >= 2
  | 'form'        // Name contains form keywords
  | 'section'     // Depth 0-1, multiple children, no fill
  | 'nav'         // Name contains nav/navigation/menu
  | 'container'   // Default div wrapper
  | 'component'   // Name matches a classifyComponent entry

interface FrameClassificationResult {
  classification: FrameClassification
  /** When classification is 'component', this holds the component type */
  componentType?: ComponentType
  /** Confidence score 0-1 for debugging/logging */
  confidence: number
}

function classifyFrame(node: FigmaNode, depth: number): FrameClassificationResult
```

Decision tree (evaluated in order, first match wins):
1. `classifyComponent(node.name)` returns a match => `'component'`
2. Name contains `form` => `'form'`
3. Name contains `nav`/`navigation`/`menu`/`sidebar` => `'nav'`
4. Depth >= 2 AND (has solid fill AND (has border/stroke OR has shadow effect)) => `'card'`
5. Depth <= 1 AND children count >= 2 => `'section'`
6. Default => `'container'`

#### classifyComponent

Maps Figma node names to library-specific component types.

```typescript
type ComponentType =
  | 'Input'
  | 'Textarea'
  | 'Select'
  | 'Checkbox'
  | 'Switch'
  | 'Avatar'
  | 'Badge'
  | 'Tabs'
  | 'Separator'
  | 'Alert'

interface ComponentClassification {
  type: ComponentType
  /** Keywords that triggered this match */
  matchedKeywords: string[]
}

function classifyComponent(name: string): ComponentClassification | null
```

Keyword map (case-insensitive, evaluated in order):
| Keywords | ComponentType |
|----------|--------------|
| `input`, `text-field`, `textfield` | `Input` |
| `textarea`, `text-area` | `Textarea` |
| `select`, `dropdown`, `combobox` | `Select` |
| `checkbox`, `check-box` | `Checkbox` |
| `switch`, `toggle` | `Switch` |
| `avatar`, `profile-pic` | `Avatar` |
| `badge`, `chip`, `tag` | `Badge` |
| `tab`, `tabs` | `Tabs` |
| `separator`, `divider`, `hr` | `Separator` |
| `alert`, `message`, `notification`, `toast` | `Alert` |

Returns `null` when no keyword matches.

#### LibraryCodeEmitter extension

Add a single generic method to the interface rather than 10+ specific methods:

```typescript
// Added to LibraryCodeEmitter interface
emitNamedComponent(
  componentType: ComponentType,
  props: Record<string, string>,
  children: string,
  depth: number,
): string
```

Each emitter implements this with library-specific mappings:

| ComponentType | shadcn | MUI | PrimeNG | Tailwind (generic) |
|--------------|--------|-----|---------|-------------------|
| Input | `<Input />` | `<TextField />` | `<InputText />` | `<input />` |
| Textarea | `<Textarea />` | `<TextField multiline />` | `<InputTextarea />` | `<textarea />` |
| Select | `<Select><SelectTrigger /><SelectContent /></Select>` | `<Select />` | `<Dropdown />` | `<select />` |
| Checkbox | `<Checkbox />` | `<Checkbox />` | `<Checkbox />` | `<input type="checkbox" />` |
| Switch | `<Switch />` | `<Switch />` | `<InputSwitch />` | `<input type="checkbox" role="switch" />` |
| Avatar | `<Avatar><AvatarImage /><AvatarFallback /></Avatar>` | `<Avatar />` | `<Avatar />` | `<div class="avatar" />` |
| Badge | `<Badge />` | `<Chip />` | `<Badge />` | `<span class="badge" />` |
| Tabs | `<Tabs><TabsList><TabsTrigger /></TabsList></Tabs>` | `<Tabs><Tab /></Tabs>` | `<TabView><TabPanel /></TabView>` | `<div role="tablist" />` |
| Separator | `<Separator />` | `<Divider />` | `<Divider />` | `<hr />` |
| Alert | `<Alert><AlertDescription /></Alert>` | `<Alert />` | `<Message />` | `<div role="alert" />` |

Each emitter also extends `getImports()` to include the new components when used.

#### Wiring into generateJSXWithEmitter

The FRAME processing block (currently lines ~376-404 in `hydroPaste.ts`) gets a new classification step before the existing container/component branching:

```typescript
// After button heuristic, before container fallback:
const frameClass = classifyFrame(node, depth)

if (frameClass.classification === 'component' && frameClass.componentType) {
  return emitter.emitNamedComponent(frameClass.componentType, {}, childrenJSX, depth)
}

if (frameClass.classification === 'form') {
  return emitter.wrapContainer(className.replace('flex flex-col', ''), childrenJSX, depth, 'form')
  // wrapContainer gets an optional `element` param defaulting to 'div'
}

if (frameClass.classification === 'nav') {
  return emitter.wrapContainer(className, childrenJSX, depth, 'nav')
}

if (frameClass.classification === 'section') {
  return emitter.wrapContainer(className, childrenJSX, depth, 'section')
}
// card and container fall through to existing wrapContainer
```

The `wrapContainer` signature extends with an optional `element` parameter:

```typescript
// Updated in LibraryCodeEmitter
wrapContainer(
  className: string,
  children: string,
  depth: number,
  element?: 'div' | 'form' | 'nav' | 'section' | 'main' | 'article',
): string
```

### FigmaNode interface extension

The existing `FigmaNode` interface uses `[key: string]: unknown` so no changes needed -- we access `node.effects`, `node.strokes`, `node.cornerRadius` etc. via the index signature. The `classifyFrame` function casts these explicitly within its body.

### File Impact Map

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/core/hydroPaste.ts` | MODIFY: Add `classifyFrame`, `classifyComponent`, wire into `generateJSXWithEmitter` and `generateJSX` | flint-ast-surgeon |
| `flint-mcp/src/core/hydroPaste-emitters.ts` | MODIFY: Add `emitNamedComponent` to interface, implement in all 4 emitters, extend `wrapContainer` with `element` param, extend `getImports` | flint-ast-surgeon |
| `flint-mcp/src/core/__tests__/classifyFrame.test.ts` | CREATE: Unit tests for classifyFrame + classifyComponent | flint-test-writer |
| `flint-mcp/src/core/__tests__/hydroPasteEmitters.test.ts` | MODIFY: Add tests for emitNamedComponent across all 4 emitters | flint-test-writer |

### Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|------------|---------|---------------|
| 2 | No Hallucinated Styling | Yes | classifyFrame uses structural signals, not visual guesses |
| 4 | Local-First Only | Yes | Pure functions, no network calls |
| 13 | Deterministic Surgery | N/A | No source code mutation -- this is code generation |
| 15 | Granular AST Tools Only | N/A | This is D2C generation, not orchestrator mutations |

### Test Plan

- `classifyFrame` with depth 0 FRAME, no fill => `section`
- `classifyFrame` with depth 3 FRAME, solid fill + border stroke => `card`
- `classifyFrame` with name "ContactForm" => `form`
- `classifyFrame` with name "NavigationBar" => `nav`
- `classifyFrame` with name "EmailInput" => `component` + `Input`
- `classifyComponent("UserAvatar")` => `{ type: 'Avatar', matchedKeywords: ['avatar'] }`
- `classifyComponent("MainContainer")` => `null`
- `emitNamedComponent('Input', {}, '', 1)` for each of 4 emitters
- `emitNamedComponent('Select', {}, '', 1)` for shadcn (compound structure)
- `wrapContainer` with `element: 'form'` for each emitter
- Full integration: `processPayload` with a FRAME named "LoginForm" containing children named "EmailInput", "PasswordInput", "SubmitButton"
- **Expected: ~20 tests**

---

## Feature 2: Token Extraction from Figma ("Design System Discovery")

### Problem

When a user sends a Figma payload through `flint_design_to_code`, every unique color, spacing value, font size, and border radius is encountered. Currently these resolve to arbitrary-value classes (`bg-[#3b82f6]`) or fallback tokens. There is no mechanism to discover and propose new tokens from the Figma design itself.

### Design

#### Core extractor: `figmaTokenExtractor.ts`

A pure, stateless module that walks a Figma node tree and collects every visual property value.

```typescript
// flint-mcp/src/core/figmaTokenExtractor.ts

export interface ProposedToken {
  /** Dot-separated path, e.g. "colors.brand.blue-500" */
  proposedName: string
  /** Raw value, e.g. "#3B82F6", "16px", "Inter" */
  value: string
  /** DTCG token type */
  type: TokenType
  /** How many times this exact value appeared in the payload */
  usageCount: number
  /** Confidence score 0-1 based on usage count + naming signals */
  confidence: number
  /** Where in the Figma tree this value was found (first occurrence) */
  source: {
    nodeName: string
    nodeType: string
    property: 'fill' | 'stroke' | 'fontSize' | 'fontFamily' | 'fontWeight'
             | 'lineHeight' | 'letterSpacing' | 'cornerRadius' | 'padding'
             | 'itemSpacing' | 'effect' | 'opacity'
  }
}

export interface TokenExtractionOptions {
  /** Existing tokens to diff against (avoids proposing duplicates) */
  existingTokens?: DesignToken[]
  /** Minimum usage count to include a token in results. Default: 1 */
  minUsageCount?: number
  /** Minimum confidence to include. Default: 0.0 */
  minConfidence?: number
}

export interface FigmaTokenExtractionResult {
  /** All proposed tokens, sorted by confidence DESC then usageCount DESC */
  proposedTokens: ProposedToken[]
  /** Tokens that already exist in the project (exact value match) */
  existingMatches: Array<{ proposed: ProposedToken; existing: DesignToken }>
  /** Tokens that are close but not exact (deltaE < 2.0 for colors) */
  nearMatches: Array<{ proposed: ProposedToken; existing: DesignToken; deltaE: number }>
  /** Summary statistics */
  stats: {
    totalValuesScanned: number
    uniqueColors: number
    uniqueSpacing: number
    uniqueTypography: number
    uniqueRadii: number
    proposedCount: number
    existingMatchCount: number
    nearMatchCount: number
  }
}

export function extractTokensFromFigma(
  payload: unknown,
  options?: TokenExtractionOptions,
): FigmaTokenExtractionResult
```

The walker recursively visits every node and collects:
- **Colors**: from `fills[].color` (SOLID type), `strokes[].color`
- **Font sizes**: from `style.fontSize` (TEXT nodes)
- **Font families**: from `style.fontFamily` (TEXT nodes)
- **Font weights**: from `style.fontWeight` (TEXT nodes)
- **Line height**: from `style.lineHeightPx` (TEXT nodes)
- **Letter spacing**: from `style.letterSpacing` (TEXT nodes)
- **Corner radius**: from `cornerRadius` (FRAME nodes)
- **Padding**: from `paddingLeft`/`paddingTop`/`paddingRight`/`paddingBottom` (FRAME nodes)
- **Item spacing**: from `itemSpacing` (auto-layout FRAME nodes)
- **Effects**: box-shadow from `effects[]` (DROP_SHADOW type)
- **Opacity**: from `opacity` (any node with opacity < 1.0)

#### Naming heuristic

Proposed names are generated from context:
- Colors: `colors.<role>.<hex-suffix>` where role is inferred from the node context (background fill => `surface`, text fill => `text`, etc.)
- Spacing: `spacing.<value>` (e.g., `spacing.16`, `spacing.24`)
- Typography: `typography.<property>.<value>` (e.g., `typography.fontSize.16`)
- Radii: `radii.<value>` (e.g., `radii.8`, `radii.12`)

#### Confidence scoring

```
confidence = clamp(0, 1,
  (usageCount >= 3 ? 0.4 : usageCount === 2 ? 0.2 : 0.1)  // frequency
  + (hasSemanticName ? 0.3 : 0.0)                            // naming signal
  + (isCommonDesignValue ? 0.2 : 0.0)                        // e.g., 4px, 8px, 16px
  + (noExistingNearMatch ? 0.1 : 0.0)                        // novelty
)
```

#### MCP Tool: `flint_extract_tokens`

```typescript
// flint-mcp/src/tools/extractTokens.ts

interface ExtractTokensInput {
  /** The Figma payload (same format as flint_design_to_code input) */
  figmaPayload: unknown
  /** Path to project root (for reading existing tokens) */
  projectRoot: string
  /** Minimum usage count filter. Default: 1 */
  minUsageCount?: number
  /** Minimum confidence filter. Default: 0.0 */
  minConfidence?: number
}

interface ExtractTokensOutput {
  proposedTokens: ProposedToken[]
  existingMatches: Array<{ proposed: ProposedToken; existingPath: string }>
  nearMatches: Array<{ proposed: ProposedToken; existingPath: string; deltaE: number }>
  stats: FigmaTokenExtractionResult['stats']
  /** Instructions for the agent/user on how to approve */
  reviewInstructions: string
}
```

The tool:
1. Reads existing tokens from `.flint/design-tokens.json` via the project root
2. Calls `extractTokensFromFigma(payload, { existingTokens })`
3. Returns the full result with review instructions
4. Does NOT write any tokens -- approval is a separate step

#### Approval Gateway

Approval happens through the existing `flint_fix` tool or a new `flint_approve_tokens` tool:

```typescript
interface ApproveTokensInput {
  /** Project root path */
  projectRoot: string
  /** Token paths to approve (from the proposed set). Empty = approve all. */
  approvedPaths?: string[]
  /** Token paths to explicitly reject (excluded from write). */
  rejectedPaths?: string[]
  /** The proposed tokens from the extraction result */
  proposedTokens: ProposedToken[]
  /** Session ID for governance event tracking */
  sessionId?: string
}

interface ApproveTokensOutput {
  /** Tokens written to design-tokens.json */
  writtenCount: number
  /** Tokens rejected */
  rejectedCount: number
  /** Tokens skipped (already exist) */
  skippedCount: number
  /** Governance event ID for provenance tracking */
  governanceEventId: string
}
```

The approval tool:
1. Filters `proposedTokens` by `approvedPaths` / `rejectedPaths`
2. Converts each approved `ProposedToken` to a `DesignToken`
3. Writes to `.flint/design-tokens.json` via the existing token write path
4. Records a governance event with type `'token_extraction'` and full provenance

#### Governance Event Extension

Add to `GovernanceEvent.eventType` union:

```typescript
// In governance/types.ts, extend the eventType union:
eventType: 'violation' | 'override' | 'export_block' | 'auto_fix' | 'rule_change' | 'token_extraction'
```

The `metadata` field (already `Record<string, unknown>`) stores extraction provenance:
```json
{
  "figmaFileName": "Marketing Landing Page",
  "proposedCount": 24,
  "approvedCount": 18,
  "rejectedCount": 6,
  "tokenPaths": ["colors.brand.blue-500", "spacing.16", ...],
  "extractionSessionId": "uuid"
}
```

### File Impact Map

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/core/figmaTokenExtractor.ts` | CREATE: Pure extraction + dedup + confidence scoring | flint-ast-surgeon |
| `flint-mcp/src/tools/extractTokens.ts` | CREATE: `flint_extract_tokens` + `flint_approve_tokens` handlers | flint-ast-surgeon |
| `flint-mcp/src/server.ts` | MODIFY: Register both new tools | flint-ast-surgeon |
| `flint-mcp/src/core/governance/types.ts` | MODIFY: Add `token_extraction` to eventType union | flint-ast-surgeon |
| `flint-mcp/src/core/__tests__/figmaTokenExtractor.test.ts` | CREATE: Unit tests | flint-test-writer |
| `flint-mcp/src/tools/__tests__/extractTokens.test.ts` | CREATE: Tool handler tests | flint-test-writer |

### Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|------------|---------|---------------|
| 1 | Code is Truth | Yes | Tokens only written after explicit approval via MCP tool |
| 2 | No Hallucinated Styling | Yes | Extraction proposes, never auto-applies. Human-in-the-loop. |
| 4 | Local-First Only | Yes | All processing local. Figma data arrives via paste/MCP, not fetched. |
| 9 | CIEDE2000 Delta-E | Yes | Near-match detection uses CIEDE2000 to find close-but-not-exact tokens |
| 12 | Atomic Queuing | Yes | Token writes go through existing token write path |

### Test Plan

- Extract colors from a payload with 3 SOLID fills (2 unique) => 2 proposed color tokens
- Extract typography from TEXT nodes with fontSize, fontFamily, fontWeight
- Extract spacing from FRAME nodes with paddingLeft, itemSpacing
- Extract cornerRadius from nested FRAME nodes
- Deduplicate: same hex color on 5 nodes => single token with usageCount: 5
- Existing token match: proposed color matches existing token exactly => appears in existingMatches, not proposedTokens
- Near match: proposed color is deltaE 1.5 from existing => appears in nearMatches
- Confidence scoring: token with 4 usages + semantic name => confidence >= 0.7
- Empty payload => empty result with zeroed stats
- Approve gateway: approve 3 of 5 proposed => 3 written, 2 rejected
- Approve gateway: governance event recorded with correct metadata
- **Expected: ~25 tests**

---

## Feature 3: Code Connect Auto-Registration

### Problem

Figma Code Connect maps Figma components to codebase components, enabling `get_design_context` to return actual component imports instead of raw design data. Currently, when a user selects a library in Flint (e.g., shadcn), there is no bridge to register those components with Figma's Code Connect system.

### Research: Figma MCP Tools

The Figma MCP server exposes these Code Connect tools:
- `get_code_connect_map` -- Read existing mappings for a file
- `add_code_connect_map` -- Add a mapping (component name => import path + prop mapping)
- `send_code_connect_mappings` -- Batch-send mappings to Figma
- `get_code_connect_suggestions` -- Get AI suggestions for unmapped components

### Design

This feature is an **MCP tool orchestration** -- it coordinates between Flint's library registry and the Figma MCP tools. It does NOT require Glass UI changes (the action is triggered from the chat interface).

#### New MCP Tool: `flint_code_connect_sync`

```typescript
interface CodeConnectSyncInput {
  /** The Figma file key to register mappings for */
  figmaFileKey: string
  /** Library to use for mappings (reads from active library if omitted) */
  library?: string
  /** Project root for reading the component registry */
  projectRoot: string
  /** When true, only returns the mappings without sending to Figma */
  dryRun?: boolean
}

interface CodeConnectMapping {
  /** Figma component name (as it appears in the Figma file) */
  figmaComponentName: string
  /** Import path in the codebase */
  importPath: string
  /** Component name as used in JSX */
  componentName: string
  /** Prop mapping: Figma prop name => code prop name */
  propMapping: Record<string, string>
  /** Confidence in this mapping (0-1) */
  confidence: number
}

interface CodeConnectSyncOutput {
  /** Mappings generated */
  mappings: CodeConnectMapping[]
  /** Mappings successfully sent to Figma (empty in dry_run mode) */
  sentCount: number
  /** Mappings that failed to send */
  failedCount: number
  /** Whether Figma MCP tools were available */
  figmaMcpAvailable: boolean
  /** Fallback: when Figma MCP is unavailable, a Code Connect config file */
  fallbackConfig?: string
  summary: string
}
```

#### Algorithm

1. Read the component registry from `flint-manifest.json` (via `projectRoot`)
2. Read the active library adapter (from `library` param or `.flint/scope.json`)
3. For each component in the registry that has the active library as its source:
   a. Generate a Code Connect mapping using the adapter's import conventions
   b. Map component props from the registry's `props` field to Figma property names
4. If Figma MCP tools are available (detected via `mcp.listTools()` or try/catch):
   a. Call `send_code_connect_mappings` with the batch
   b. Report success/failure counts
5. If Figma MCP tools are NOT available (fallback):
   a. Generate a `.figma/code-connect.json` config file
   b. Return it as `fallbackConfig` with instructions for manual import

#### Library-to-Import Mapping

Each emitter in `hydroPaste-emitters.ts` already knows its import paths. The Code Connect mapper reads from the same source:

| Library | Import Pattern | Example |
|---------|---------------|---------|
| shadcn | `@/components/ui/<component>` | `import { Button } from "@/components/ui/button"` |
| MUI | `@mui/material` | `import { Button } from "@mui/material"` |
| PrimeNG | `primereact/<component>` | `import { Button } from "primereact/button"` |
| Tailwind | N/A (utility-only) | No component imports |

#### Prop Mapping Heuristic

For common component types, use standard prop name mappings:

```typescript
const COMMON_PROP_MAPPINGS: Record<string, Record<string, string>> = {
  Button: { label: 'children', variant: 'variant', disabled: 'disabled', onClick: 'onClick' },
  Input:  { placeholder: 'placeholder', value: 'value', label: 'aria-label' },
  Avatar: { src: 'src', name: 'alt', size: 'className' },
  Badge:  { label: 'children', variant: 'variant' },
  // etc.
}
```

### File Impact Map

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/tools/codeConnectSync.ts` | CREATE: `flint_code_connect_sync` tool handler | flint-ast-surgeon |
| `flint-mcp/src/core/codeConnectMapper.ts` | CREATE: Pure mapping logic (registry => Code Connect format) | flint-ast-surgeon |
| `flint-mcp/src/server.ts` | MODIFY: Register `flint_code_connect_sync` tool | flint-ast-surgeon |
| `flint-mcp/src/core/__tests__/codeConnectMapper.test.ts` | CREATE: Unit tests | flint-test-writer |
| `flint-mcp/src/tools/__tests__/codeConnectSync.test.ts` | CREATE: Tool handler tests | flint-test-writer |

### Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|------------|---------|---------------|
| 4 | Local-First Only | Partial | Mapping generation is local. Figma push is optional (dry_run + fallback) |
| 8 | Audit-First Execution | Yes | dry_run mode for review before sending to Figma |
| 12 | Atomic Queuing | N/A | No local file writes (unless fallback config) |

### Test Plan

- Generate mappings for shadcn library with 5 registry components => 5 CodeConnectMapping entries
- Generate mappings for MUI library => correct MUI import paths
- Component with known props => prop mapping populated
- Component with unknown props => empty prop mapping, lower confidence
- dry_run mode => mappings returned, sentCount is 0
- Figma MCP unavailable => fallbackConfig contains valid JSON config
- Empty registry => empty mappings array
- **Expected: ~15 tests**

### Risk

The Figma MCP tools (`add_code_connect_map`, `send_code_connect_mappings`) may require specific authentication or permissions that Flint cannot provide programmatically. The fallback path (generating a config file for manual import) mitigates this completely. This feature should be implemented with the fallback path first, and Figma MCP integration added only after manual testing confirms the tools accept programmatic input.

---

## Feature 4: Governance Overlay on Generated Code

### Research Findings

After reading the codebase, the governance pipeline is:

1. `MithrilProvider` (mounted in `App.tsx` wrapping the main layout) subscribes to `editorStore.ast` and `tokenStore.tokens`
2. On any AST change, `MithrilProvider` calls `auditAll(ast, tokens)` and writes results to `editorStore.linterWarnings` and `canvasStore.mithrilViolations`
3. `GovernanceOverlay` component reads from `editorStore.linterWarnings`

**Current state:** `GovernanceOverlay` exists as a fully functional component but is NOT mounted anywhere in the live application. It is only tested in isolation. The `MithrilProvider` side (audit execution) works correctly -- it fires on every AST change.

**The D2C apply flow** (from D2C.2 contract):
1. `useDesignToCodeApply` writes generated files via `d2c:apply` IPC
2. IPC handler calls `setActiveFile` + `setCode` on the generated page
3. `editorStore.setCode` parses the code into an AST
4. `MithrilProvider` fires on the AST change and populates `linterWarnings`

**Gap analysis:**

| Component | Status | Gap |
|-----------|--------|-----|
| `MithrilProvider` audit trigger | WORKS | None -- fires on every `editorStore.ast` change |
| `editorStore.linterWarnings` population | WORKS | None -- `MithrilProvider` calls `setLinterWarnings` |
| `GovernanceOverlay` component | EXISTS but NOT MOUNTED | Must be mounted in the right sidebar |
| Spatial violations on preview (ShieldOverlay) | WORKS | Already reads `canvasStore.mithrilViolations` |
| Export Gate blocking | WORKS | Already reads `linterWarnings.size` |

**Conclusion:** The only gap is that `GovernanceOverlay` is not mounted in the app layout. The entire audit pipeline already fires correctly when D2C-generated code is set as active.

### Design

Mount `GovernanceOverlay` in the right sidebar, inside the `properties` tab, above the `PropertiesPanel`:

```typescript
// In App.tsx, inside the rightTab === 'properties' branch:
{rightTab === 'properties' && (
  <>
    <GovernanceOverlay />
    <PropertiesPanel />
  </>
)}
```

This is the correct placement because:
- GovernanceOverlay shows violations for the active file (same scope as PropertiesPanel)
- It collapses to a single "No Mithril violations" line when clean (minimal visual footprint)
- It provides inline Auto-Fix buttons that directly modify the active file's AST
- The properties tab is always the default tab, so violations are immediately visible

No new state, no new IPC, no new stores. Just an import and a mount.

### File Impact Map

| File | Change | Owner |
|------|--------|-------|
| `src/App.tsx` | MODIFY: Import `GovernanceOverlay`, mount in properties tab | flint-design-engineer |

### Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|------------|---------|---------------|
| 1 | Code is Truth | Yes | GovernanceOverlay's Auto-Fix dispatches to `applyBatch` which saves via AST |
| 5 | Accessibility is Compiler Error | Yes | Violations are surfaced immediately, blocking export |
| 6 | Gatekeeper Rule | Yes | Export Gate already reads linterWarnings.size -- this just makes violations visible |

### Test Plan

- Verify `GovernanceOverlay` renders in the properties tab when linterWarnings exist
- Verify "No Mithril violations" shows when linterWarnings is empty
- Integration: set code with arbitrary hex classes, verify GovernanceOverlay shows violations
- **Expected: 0 new tests (existing GovernanceOverlay tests cover component behavior; existing MithrilProvider tests cover audit pipeline)**

### Risk

None. This is a single-line mount of an already-tested component.

---

## Implementation Order

### Phase 1 (Parallel -- no dependencies between features)

**Group A** (flint-ast-surgeon):
- Feature 1: `classifyFrame` + `classifyComponent` in hydroPaste.ts
- Feature 1: `emitNamedComponent` + `wrapContainer` element param in hydroPaste-emitters.ts
- Feature 1: Wire classifiers into `generateJSXWithEmitter` and `generateJSX`

**Group B** (flint-ast-surgeon):
- Feature 2: `figmaTokenExtractor.ts` (pure extraction module)
- Feature 2: `extractTokens.ts` tool handlers
- Feature 2: Register tools in server.ts

**Group C** (flint-design-engineer):
- Feature 4: Mount GovernanceOverlay in App.tsx

### Phase 2 (After Phase 1 Group A completes)

**Group D** (flint-ast-surgeon):
- Feature 3: `codeConnectMapper.ts` (pure mapping logic)
- Feature 3: `codeConnectSync.ts` tool handler
- Feature 3: Register tool in server.ts

### Phase 3 (After all Phase 1+2 complete)

**Group E** (flint-test-writer):
- All test suites for Features 1-3
- Integration test: full D2C pipeline with classifiers + token extraction + governance overlay

### Phase 4 (flint-integration-validator)

- Run full test suite
- Run TSC
- Verify no regressions
- SHIP / FIX / REDESIGN

---

## Global Risks

| Risk | Commandment | Mitigation |
|------|------------|------------|
| classifyFrame false positives (e.g., frame named "card-wrapper" classified as Card when it should be div) | 2 | Keyword lists are conservative; container keywords already excluded by isLikelyButton pattern |
| Token extraction proposes too many tokens (noise) | 2 | minUsageCount and minConfidence filters; approval gateway prevents auto-write |
| Figma MCP tools reject programmatic Code Connect registration | 4 | Fallback config file generation; dry_run mode for validation |
| GovernanceOverlay causes layout shift in properties panel | N/A | Component already handles empty state gracefully (single line) |
| wrapContainer signature change breaks existing emitter implementations | N/A | element param is optional with default 'div'; backward compatible |
