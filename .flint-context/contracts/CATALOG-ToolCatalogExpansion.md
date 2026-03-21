# Contract: CATALOG — AST Tool Catalog Expansion

> Closes the "static assembly to production UI" gap identified in the Flint critical assessment. Expands the 7-op orchestrator tool catalog and the MCP `flint_ast_mutate` mutation types to support hooks, handlers, conditional rendering, array mapping, compound components, and LSP-backed prop validation.

## Situation Analysis

### Current Catalog (Orchestrator — `electron/orchestrator.ts`)

The `FLINT_TOOLS` array exposes 11 tools total, of which 7 are mutation-capable:

| Tool | Category | Limitation |
|------|----------|------------|
| `flint_update_props` | Property | String-only values. Cannot wire function references, expressions, or JSX expression containers. |
| `flint_update_text` | Property | Text-only. |
| `flint_insert_node` | Structural | Accepts `nodeType`, `props` (string values), `children` (string). Cannot emit hooks, callbacks, or expression containers. |
| `flint_wrap_node` | Structural | Wrapper tag + string props. No expression support. |
| `flint_delete_node` | Structural | OK as-is. |
| `flint_add_class` | Class | Single class. OK as-is. |
| `flint_remove_class` | Class | Single class. OK as-is. |

Read-only tools (`flint_read_code`, `flint_read_tokens`, `flint_audit_mithril`, `flint_audit_a11y`, `flint_search_design_system`) are unchanged by this expansion.

### Current Catalog (MCP Server — `flint-mcp/src/core/ast-modifier.ts`)

The MCP `flint_ast_mutate` accepts these mutation types via the `type` discriminant:

| Type | Babel Function | Notes |
|------|---------------|-------|
| `move` | `moveNode()` | OK |
| `inject` | `injectComponent()` | JSX snippet string. Already arbitrary JSX parsing via `parseJSXSnippet`. |
| `fixToken` | `applyTokenFix()` | OK |
| `assembleLayout` | `assembleLayout()` | OK |
| `updateProp` | `updateProp()` | Supports string, number, boolean. **Does not** support JSXExpressionContainer for function references. |
| `updateClassName` | `updateClassName()` | OK |
| `updateTextContent` | `updateTextContent()` | OK |
| `delete` | `deleteNode()` | OK |
| `wrap` | `wrapNode()` | OK |

### The 5 Gaps

1. **No hook injection** -- Cannot emit `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, or custom hooks at the component body level.
2. **No handler/callback wiring** -- `updateProp` accepts only `string | number | boolean`. Cannot produce `onClick={handleClick}` or `onChange={(e) => setName(e.target.value)}`. Props that reference functions are structurally impossible.
3. **No conditional rendering** -- Cannot wrap JSX in `{condition && <X/>}` or `{condition ? <X/> : <Y/>}`. No ternary or logical-AND guard ops.
4. **No array mapping** -- Cannot produce `{items.map((item) => <X key={item.id} />)}`. Commandment 3 (Composite IDs) has no enforcement path.
5. **No compound component support** -- Cannot target `<Dialog.Header>` via `JSXMemberExpression`. `findNode` only matches `JSXIdentifier`, not `JSXMemberExpression`.
6. **Prop validation is syntactic only** -- The TypeScript LSP validates JSX syntax but not prop type conformance against the target component's interface. No `PropDefinition` data from the registry is used at mutation time.

---

## Phase Plan

### Phase CATALOG.1 — Import + Hook + Handler Emission

**Closes gaps:** #1 (hooks), #2 (handler wiring), partially #3 (expression containers)

**Dependency:** None. Builds directly on existing `ast-modifier.ts` infrastructure.

**Complexity:** Compound (multi-file, new Babel AST node types, validation changes)

#### New MCP Mutation Types (added to `flint_ast_mutate`)

##### 1. `emitImport`

Adds an import declaration to the file. Deduplicates at the specifier level (same logic as `synthesizeImports` in `ASTService.ts`).

```typescript
interface EmitImportMutation {
    type: 'emitImport'
    args: {
        /** e.g. "import { useState, useEffect } from 'react'" */
        importSnippet: string
    }
}
```

**Babel AST output:**
```typescript
// Input: importSnippet = "import { useState } from 'react'"
// Output: ImportDeclaration node prepended to Program.body
// Dedup: if 'react' already imported, merges specifiers
```

**Implementation:** Reuse `parseImportSnippet()` already in `ast-modifier.ts`. Add specifier-level merge when the source module already exists (lift from `synthesizeImports` in `ASTService.ts`).

##### 2. `emitHook`

Injects a hook call statement at the top of the component function body, after all existing hook calls (respecting Rules of Hooks: top-level, not conditional).

```typescript
interface EmitHookMutation {
    type: 'emitHook'
    args: {
        /** Target component name (e.g. "MyComponent"). Finds the function/arrow component. */
        componentName: string
        /** Full hook call statement. e.g. "const [count, setCount] = useState(0)" */
        hookStatement: string
        /** Optional: position hint. 'first' = before all hooks, 'last' = after all hooks (default). */
        position?: 'first' | 'last'
    }
}
```

**Babel AST output:**
```typescript
// Before:
function MyComponent() {
    return <div>Hello</div>
}

// After emitHook { componentName: "MyComponent", hookStatement: "const [count, setCount] = useState(0)" }:
function MyComponent() {
    const [count, setCount] = useState(0)
    return <div>Hello</div>
}
```

**Implementation:** New Babel visitor finds the component function declaration/expression by name. Parses `hookStatement` via `parse()` to get an ExpressionStatement or VariableDeclaration. Inserts at the top of the BlockStatement body (before the return statement, after any existing variable declarations / hook calls).

**Validation rule:** The LSP validates the full component body after injection. Rules of Hooks structural check: the visitor rejects injection into conditional blocks, loops, or nested functions.

##### 3. `emitHandler`

Injects a named function declaration inside the component body (below hooks, above the return statement).

```typescript
interface EmitHandlerMutation {
    type: 'emitHandler'
    args: {
        /** Target component name. */
        componentName: string
        /** Full function body. e.g. "const handleClick = () => { setCount(c => c + 1) }" */
        handlerCode: string
    }
}
```

**Babel AST output:**
```typescript
// Before:
function MyComponent() {
    const [count, setCount] = useState(0)
    return <button>{count}</button>
}

// After emitHandler { componentName: "MyComponent", handlerCode: "const handleClick = () => { setCount(c => c + 1) }" }:
function MyComponent() {
    const [count, setCount] = useState(0)
    const handleClick = () => { setCount(c => c + 1) }
    return <button>{count}</button>
}
```

**Implementation:** Similar to `emitHook` — finds component, parses handler code, inserts before the ReturnStatement.

**Validation rule:** TSC validates the full component after injection. Handler must be parseable as a valid statement.

##### 4. `emitCallback`

Wires a handler reference to an event prop on a JSX element. This is the critical flint from `emitHandler` to actual interactivity.

```typescript
interface EmitCallbackMutation {
    type: 'emitCallback'
    args: {
        /** data-flint-id of the target JSX element. */
        nodeId: string
        /** Event prop name, e.g. "onClick", "onChange", "onSubmit". */
        propName: string
        /**
         * Expression string for the prop value. Can be:
         * - A simple identifier: "handleClick" -> onClick={handleClick}
         * - An inline arrow: "(e) => setName(e.target.value)" -> onChange={(e) => setName(e.target.value)}
         * - A function call: "() => toggle(!open)" -> onClick={() => toggle(!open)}
         */
        expression: string
    }
}
```

**Babel AST output:**
```typescript
// Before: <button data-flint-id="abc123">Click</button>
// After emitCallback { nodeId: "abc123", propName: "onClick", expression: "handleClick" }:
// <button data-flint-id="abc123" onClick={handleClick}>Click</button>
```

**Implementation:** New function in `ast-modifier.ts`. Uses `findNode()` to locate the target. Parses the `expression` string as a JavaScript expression (via `parse(`(${expression})`, ...)`). Creates a `JSXAttribute` with a `JSXExpressionContainer` wrapping the parsed expression. Replaces any existing attribute with the same `propName`.

**This is the key enabler** — it unlocks function-valued props without expanding `updateProp`'s type surface (which stays string/number/boolean for safe, auditable property changes).

#### New Orchestrator Tools (added to `FLINT_TOOLS` in `orchestrator.ts`)

```typescript
{
    name: 'flint_emit_hook',
    description: 'Inject a React hook call (useState, useEffect, useRef, etc.) at the top of a component function body. Respects Rules of Hooks — hooks are always inserted at the top level, never inside conditionals.',
    input_schema: {
        type: 'object',
        properties: {
            componentName: { type: 'string', description: 'Name of the target component function.' },
            hookStatement: { type: 'string', description: 'Full hook call, e.g. "const [count, setCount] = useState(0)"' },
            importSnippet: { type: 'string', description: 'Import to add if needed, e.g. "import { useState } from \'react\'"' },
            reasoning: { type: 'string', description: 'One-sentence explanation.' },
        },
        required: ['componentName', 'hookStatement', 'reasoning'],
    },
}

{
    name: 'flint_emit_handler',
    description: 'Inject a named handler function inside a component body (below hooks, above return). Use this to create event handlers before wiring them with flint_emit_callback.',
    input_schema: {
        type: 'object',
        properties: {
            componentName: { type: 'string', description: 'Name of the target component function.' },
            handlerCode: { type: 'string', description: 'Full handler declaration, e.g. "const handleClick = () => { setCount(c => c + 1) }"' },
            reasoning: { type: 'string', description: 'One-sentence explanation.' },
        },
        required: ['componentName', 'handlerCode', 'reasoning'],
    },
}

{
    name: 'flint_emit_callback',
    description: 'Wire a handler reference or inline arrow function to an event prop (onClick, onChange, onSubmit, etc.) on a JSX element. The expression becomes a JSXExpressionContainer: onClick={expression}.',
    input_schema: {
        type: 'object',
        properties: {
            targetId: { type: 'string', description: 'data-flint-id of the target JSX element.' },
            propName: { type: 'string', description: 'Event prop name, e.g. "onClick", "onChange".' },
            expression: { type: 'string', description: 'JS expression string, e.g. "handleClick" or "(e) => setName(e.target.value)".' },
            reasoning: { type: 'string', description: 'One-sentence explanation.' },
        },
        required: ['targetId', 'propName', 'expression', 'reasoning'],
    },
}
```

#### Validation Loop Changes

For `flint_emit_hook` and `flint_emit_handler`: the orchestrator assembles a synthetic component wrapping the proposed hook/handler code and validates it through the ILspClient. Pseudocode:

```typescript
if (toolName === 'flint_emit_hook') {
    const snippet = `function __FlintValidate() {\n  ${input.hookStatement}\n  return null;\n}`
    const lspError = await lsp.validateSnippet(snippet)
    if (lspError) return lspError
}
```

For `flint_emit_callback`: the orchestrator wraps the expression in a JSX context:

```typescript
if (toolName === 'flint_emit_callback') {
    const snippet = `const __v = <div ${input.propName}={${input.expression}} />;`
    const lspError = await lsp.validateSnippet(snippet)
    if (lspError) return lspError
}
```

#### MRS Risk Weights (new entries in `MRS_OP_WEIGHTS`)

```typescript
flint_emit_hook:     0.35,  // adds state — amber floor
flint_emit_handler:  0.30,  // adds logic — amber floor
flint_emit_callback: 0.25,  // wires existing handler — below structural threshold
```

New tier floors:
```typescript
flint_emit_hook:    'amber',  // hook injection always requires review
flint_emit_handler: 'amber',  // handler injection always requires review
```

---

### Phase CATALOG.2 — Conditional Rendering + Array Map

**Closes gaps:** #3 (conditionals), #4 (array mapping + Commandment 3)

**Dependency:** CATALOG.1 (expression container infrastructure from `emitCallback`)

**Complexity:** Compound

#### New MCP Mutation Types

##### 5. `emitConditional`

Wraps an existing JSX element in a conditional guard (ternary or logical AND).

```typescript
interface EmitConditionalMutation {
    type: 'emitConditional'
    args: {
        /** data-flint-id of the JSX element to wrap. */
        nodeId: string
        /** JS expression for the condition. e.g. "isOpen", "user !== null", "items.length > 0" */
        condition: string
        /** 'and' produces {condition && <X/>}. 'ternary' produces {condition ? <X/> : fallback}. */
        mode: 'and' | 'ternary'
        /** For ternary mode: the fallback JSX snippet. e.g. "<p>No items</p>" or "null". */
        fallback?: string
    }
}
```

**Babel AST output (mode: 'and'):**
```typescript
// Before: <Panel data-flint-id="abc" />
// After:  {isOpen && <Panel data-flint-id="abc" />}
```

**Babel AST output (mode: 'ternary'):**
```typescript
// Before: <Panel data-flint-id="abc" />
// After:  {isOpen ? <Panel data-flint-id="abc" /> : <p>Loading...</p>}
```

**Implementation:** Finds the target JSXElement via `findNode()`. In the parent's `children` array, replaces the element with a `JSXExpressionContainer` containing either:
- `LogicalExpression` (operator: `&&`, left: parsed condition, right: original element) for `'and'` mode
- `ConditionalExpression` (test: parsed condition, consequent: original element, alternate: parsed fallback or `NullLiteral`) for `'ternary'` mode

**Inverse strategy:** `restoreCode` snapshot (structural change).

##### 6. `emitMap`

Wraps JSX children in an `array.map()` callback with automatic `key` prop injection (Commandment 3).

```typescript
interface EmitMapMutation {
    type: 'emitMap'
    args: {
        /** data-flint-id of the JSX element to be the map template (the repeated element). */
        nodeId: string
        /** The array expression to map over. e.g. "items", "users.filter(u => u.active)" */
        arrayExpression: string
        /** The iterator variable name. e.g. "item", "user" */
        iteratorName: string
        /** Expression for the key prop. e.g. "item.id", "user.email".
         *  Auto-injected as key={expression} on the template element. */
        keyExpression: string
    }
}
```

**Babel AST output:**
```typescript
// Before:
// <ul>
//   <li data-flint-id="tpl">Item</li>
// </ul>

// After emitMap { nodeId: "tpl", arrayExpression: "items", iteratorName: "item", keyExpression: "item.id" }:
// <ul>
//   {items.map((item) => (
//     <li data-flint-id="tpl" key={item.id}>Item</li>
//   ))}
// </ul>
```

**Implementation:** Finds the target element. In the parent's children array, replaces the element with a `JSXExpressionContainer` containing a `CallExpression`:
- Callee: `MemberExpression` (object: parsed `arrayExpression`, property: `Identifier('map')`)
- Arguments: single `ArrowFunctionExpression` with parameter `iteratorName`, body is the original JSXElement
- Automatically injects `key={keyExpression}` as a `JSXAttribute` with `JSXExpressionContainer` on the template element

**Commandment 3 enforcement:** The op rejects execution if `keyExpression` is empty or the literal string `"index"` (which would be the array index anti-pattern). The key must reference a stable identifier from the iterator.

**Inverse strategy:** `restoreCode` snapshot (structural change).

#### New Orchestrator Tools

```typescript
{
    name: 'flint_emit_conditional',
    description: 'Wrap a JSX element in a conditional guard. Mode "and" produces {condition && <Element/>}. Mode "ternary" produces {condition ? <Element/> : <Fallback/>}.',
    input_schema: {
        type: 'object',
        properties: {
            targetId: { type: 'string', description: 'data-flint-id of the element to conditionally render.' },
            condition: { type: 'string', description: 'JS boolean expression, e.g. "isOpen" or "items.length > 0".' },
            mode: { type: 'string', enum: ['and', 'ternary'], description: '"and" for && guard, "ternary" for ternary with fallback.' },
            fallback: { type: 'string', description: 'For ternary mode: fallback JSX or "null". Ignored in "and" mode.' },
            reasoning: { type: 'string', description: 'One-sentence explanation.' },
        },
        required: ['targetId', 'condition', 'mode', 'reasoning'],
    },
}

{
    name: 'flint_emit_map',
    description: 'Wrap a JSX element in an array.map() to render it for each item. Automatically injects a key prop (Commandment 3). The keyExpression must reference a stable identifier, not the array index.',
    input_schema: {
        type: 'object',
        properties: {
            targetId: { type: 'string', description: 'data-flint-id of the template element to repeat.' },
            arrayExpression: { type: 'string', description: 'Array to iterate, e.g. "items" or "users.filter(u => u.active)".' },
            iteratorName: { type: 'string', description: 'Iterator parameter name, e.g. "item".' },
            keyExpression: { type: 'string', description: 'Stable key expression, e.g. "item.id". Must not be "index".' },
            reasoning: { type: 'string', description: 'One-sentence explanation.' },
        },
        required: ['targetId', 'arrayExpression', 'iteratorName', 'keyExpression', 'reasoning'],
    },
}
```

#### Validation Loop Changes

For `flint_emit_conditional`:
```typescript
const snippet = `const __v = <>{${input.condition} && <div />}</>;`
// or for ternary:
const snippet = `const __v = <>{${input.condition} ? <div /> : ${input.fallback ?? 'null'}}</>;`
const lspError = await lsp.validateSnippet(snippet)
```

For `flint_emit_map`:
```typescript
const snippet = `const __v = <>{${input.arrayExpression}.map((${input.iteratorName}) => <div key={${input.keyExpression}} />)}</>;`
const lspError = await lsp.validateSnippet(snippet)
```

#### MRS Risk Weights

```typescript
flint_emit_conditional: 0.40,  // structural wrapping — amber floor
flint_emit_map:         0.50,  // structural + key injection — amber floor
```

---

### Phase CATALOG.3 — Compound Component Support

**Closes gap:** #5 (compound components like `<Dialog.Header>`, `<Tabs.Panel>`)

**Dependency:** None (can run in parallel with CATALOG.1 or CATALOG.2)

**Complexity:** Moderate (focused change in `findNode` + `injectComponent`)

#### Problem

`findNode()` in `ast-modifier.ts` only matches `JSXIdentifier` tags via the `data-flint-id` attribute. Compound components use `JSXMemberExpression` (e.g., `Dialog.Header`), which have a different AST shape:

```typescript
// <Dialog.Header> parses to:
JSXMemberExpression {
    object: JSXIdentifier { name: "Dialog" },
    property: JSXIdentifier { name: "Header" }
}
```

The `data-flint-id` attribute is still present on the opening element, so `findNode` already works for compound components located by flint ID. The gap is in **creation** (injection) and **targeting by tag name**.

#### Changes

##### 1. Enhanced `injectComponent` and `parseJSXSnippet`

`parseJSXSnippet` already handles compound component JSX because it parses arbitrary JSX strings. No change needed for parsing.

For `assembleLayout` and `injectComponent`, compound component children like `<Dialog.Header>Content</Dialog.Header>` already work because they are parsed as JSX snippet strings. No structural change needed.

##### 2. New mutation type: `composeSlot`

Targets a compound component slot by its full dotted name and injects children.

```typescript
interface ComposeSlotMutation {
    type: 'composeSlot'
    args: {
        /** data-flint-id of the compound parent (e.g., the <Dialog> element). */
        parentId: string
        /** Dotted slot name, e.g. "Dialog.Header" or "Tabs.Panel". */
        slotName: string
        /** JSX snippet to inject as children of the slot. */
        jsxSnippet: string
        /** Optional import snippet. */
        importSnippet?: string
    }
}
```

**Implementation:** New Babel visitor finds the parent by `data-flint-id`, then searches its children for a `JSXElement` whose opening tag is a `JSXMemberExpression` matching `slotName`. If found, injects the parsed `jsxSnippet` as a child. If the slot element does not exist, creates it.

**Babel AST output:**
```typescript
// Before: <Dialog data-flint-id="dlg1"><Dialog.Body>Hello</Dialog.Body></Dialog>
// After composeSlot { parentId: "dlg1", slotName: "Dialog.Header", jsxSnippet: "<h2>Title</h2>" }:
// <Dialog data-flint-id="dlg1"><Dialog.Header><h2>Title</h2></Dialog.Header><Dialog.Body>Hello</Dialog.Body></Dialog>
```

##### 3. New orchestrator tool

```typescript
{
    name: 'flint_compose_slot',
    description: 'Insert content into a compound component slot (e.g., Dialog.Header, Tabs.Panel). If the slot does not exist, it is created.',
    input_schema: {
        type: 'object',
        properties: {
            parentId: { type: 'string', description: 'data-flint-id of the compound component root.' },
            slotName: { type: 'string', description: 'Dotted slot name, e.g. "Dialog.Header".' },
            jsxSnippet: { type: 'string', description: 'JSX content to inject into the slot.' },
            importSnippet: { type: 'string', description: 'Optional import to add.' },
            reasoning: { type: 'string', description: 'One-sentence explanation.' },
        },
        required: ['parentId', 'slotName', 'jsxSnippet', 'reasoning'],
    },
}
```

#### MRS Risk Weight

```typescript
flint_compose_slot: 0.45,  // structural insertion — amber floor
```

---

### Phase CATALOG.4 — LSP-Backed Prop Validation

**Closes gap:** #6 (prop type conformance)

**Dependency:** CATALOG.1 (expression container support), Phase INIT.1 (component registry with `PropDefinition` data)

**Complexity:** Compound (cross-boundary: MCP registry data feeds into orchestrator validation)

#### Problem

The current validation loop checks JSX syntax validity but not whether the props match the target component's TypeScript interface. For example, `flint_update_props` accepts `{ disabled: "true" }` as a string, but if the component's interface declares `disabled: boolean`, this produces a type error that only surfaces at build time.

#### Approach: Leverage the Existing LSP + Registry

The TypeScript LSP client (`TypeScriptLspClient`) already runs a full `LanguageService` with semantic diagnostics. The gap is that the synthetic validation snippet lacks type context for the target component.

**Solution: Augmented Validation Snippets**

When validating a mutation targeting a known component (found in the registry), the orchestrator constructs a validation snippet that includes a minimal type stub:

```typescript
// For flint_update_props targeting a Button component:
interface ButtonProps { variant: 'primary' | 'secondary'; disabled?: boolean; children: React.ReactNode; }
declare function Button(props: ButtonProps): JSX.Element;
const __v = <Button variant="primary" disabled="true" />;
//                                     ^^^^^^^^^^^^^^^^ TS error: Type 'string' is not assignable to type 'boolean'
```

The `PropDefinition` from the component registry provides the type stub. The LSP catches the mismatch.

#### Changes

##### 1. New function in orchestrator: `buildPropTypeStub`

```typescript
/**
 * Builds a minimal TypeScript interface stub from the component registry entry.
 * Returns null if the component is not in the registry or has no props defined.
 */
function buildPropTypeStub(componentName: string, registry: Record<string, ComponentEntry>): string | null {
    const entry = registry[componentName]
    if (!entry?.props || Object.keys(entry.props).length === 0) return null

    const propLines = Object.entries(entry.props).map(([name, def]) => {
        const opt = def.required ? '' : '?'
        return `  ${name}${opt}: ${def.type};`
    })

    return [
        `interface ${componentName}Props {`,
        ...propLines,
        `}`,
        `declare function ${componentName}(props: ${componentName}Props): JSX.Element;`,
    ].join('\n')
}
```

##### 2. Enhanced `validateToolInput` for prop-aware validation

For `flint_update_props`, `flint_insert_node`, and `flint_emit_callback`:
1. Determine the target component name (from the source code, read via `flint_read_code`).
2. Look up the component in the registry.
3. If a `PropDefinition` exists, build the type stub.
4. Prepend the stub to the validation snippet.
5. Run the augmented snippet through the LSP.

This requires the orchestrator to have access to the component registry. Two options:

**Option A (preferred):** The orchestrator reads `flint-manifest.json` from the workspace root at the start of each `sendChatMessage` call and caches it for the duration.

**Option B:** Expose a new IPC channel `flint:get-registry` that returns the cached registry.

Option A avoids IPC overhead and keeps the registry access in the main process where `fs` is available.

##### 3. New orchestrator tool (advisory, not blocking)

```typescript
{
    name: 'flint_validate_props',
    description: 'Type-check a set of props against a component interface from the registry. Returns validation errors or confirms compatibility. Advisory: use before proposing prop changes.',
    input_schema: {
        type: 'object',
        properties: {
            componentName: { type: 'string', description: 'Component name to validate against.' },
            props: { type: 'object', description: 'Props to validate.', additionalProperties: true },
            reasoning: { type: 'string', description: 'Why this validation is needed.' },
        },
        required: ['componentName', 'props', 'reasoning'],
    },
}
```

This tool is read-only. It returns validation results without mutating anything. The AI can use it proactively before calling mutation tools.

---

## Impact Map

| File | Change Type | Phase | Owner Agent |
|------|------------|-------|-------------|
| `flint-mcp/src/core/ast-modifier.ts` | ADD: `emitHook`, `emitHandler`, `emitCallback`, `emitConditional`, `emitMap`, `composeSlot`, `emitImport` functions + enhanced `parseImportSnippet` (specifier merge) | C1, C2, C3 | flint-ast-surgeon |
| `flint-mcp/src/server.ts` | ADD: new mutation types to `flint_ast_mutate` switch, new tool registrations | C1, C2, C3 | flint-ast-surgeon |
| `electron/orchestrator.ts` | ADD: new tools to `FLINT_TOOLS`, new entries in `MUTATION_TOOL_NAMES`, `MRS_OP_WEIGHTS`, `MRS_TIER_FLOORS`, new `validateToolInput` branches, `buildPropTypeStub` | C1, C2, C3, C4 | flint-electron-ipc |
| `electron/lsp/TypeScriptLspClient.ts` | No change (existing `validateSnippet` handles augmented snippets) | -- | -- |
| `src/core/ASTService.ts` | ADD: new `ASTMutation` union members for `emitHook`, `emitHandler`, `emitCallback`, `emitConditional`, `emitMap`, `composeSlot`; new `applyMutationBatch` switch cases | C1, C2, C3 | flint-state-architect |
| `src/utils/astModifier.ts` | MIRROR: add same new functions as `flint-mcp/src/core/ast-modifier.ts` (renderer-side copy) | C1, C2, C3 | flint-ast-surgeon |
| `flint-mcp/src/core/ast-modifier.test.ts` (NEW) | ADD: comprehensive tests for all new mutation functions | C1, C2, C3 | flint-test-writer |
| `src/utils/astModifier.test.ts` | ADD: tests for renderer-side new functions | C1, C2, C3 | flint-test-writer |
| `electron/__tests__/orchestratorSafety.test.ts` | ADD: validation tests for new tools | C1, C2, C3, C4 | flint-test-writer |
| `CLAUDE.md` | UPDATE: Commandment 15 text, tool catalog count, phase status | All | flint-architect |

---

## Type Contracts

### New ASTMutation Union Members (renderer side — `src/core/ASTService.ts`)

```typescript
interface EmitHookMutation {
    op: 'emitHook'
    componentName: string
    hookStatement: string
    position?: 'first' | 'last'
}

interface EmitHandlerMutation {
    op: 'emitHandler'
    componentName: string
    handlerCode: string
}

interface EmitCallbackMutation {
    op: 'emitCallback'
    nodeId: string
    propName: string
    expression: string
}

interface EmitConditionalMutation {
    op: 'emitConditional'
    nodeId: string
    condition: string
    mode: 'and' | 'ternary'
    fallback?: string
}

interface EmitMapMutation {
    op: 'emitMap'
    nodeId: string
    arrayExpression: string
    iteratorName: string
    keyExpression: string
}

interface ComposeSlotMutation {
    op: 'composeSlot'
    parentId: string
    slotName: string
    jsxSnippet: string
    importSnippet?: string
}

interface EmitImportMutation {
    op: 'emitImport'
    importSnippet: string
}

// Updated union:
export type ASTMutation =
    | UpdateClassNameMutation
    | MoveNodeMutation
    | DeleteNodeMutation
    | UpdatePropMutation
    | UpdateTextContentMutation
    | InjectComponentMutation
    | ApplyTokenFixMutation
    | EmitHookMutation      // CATALOG.1
    | EmitHandlerMutation   // CATALOG.1
    | EmitCallbackMutation  // CATALOG.1
    | EmitImportMutation    // CATALOG.1
    | EmitConditionalMutation // CATALOG.2
    | EmitMapMutation        // CATALOG.2
    | ComposeSlotMutation    // CATALOG.3
```

### New MCP Mutation Types (server side — `flint-mcp/src/server.ts`)

The `flint_ast_mutate` `type` enum expands from:
```
["move", "inject", "fixToken", "assembleLayout", "updateProp", "updateClassName", "updateTextContent", "delete", "wrap"]
```
to:
```
["move", "inject", "fixToken", "assembleLayout", "updateProp", "updateClassName", "updateTextContent", "delete", "wrap",
 "emitImport", "emitHook", "emitHandler", "emitCallback", "emitConditional", "emitMap", "composeSlot"]
```

---

## Commandment Checklist

- [x] **C1 Code is Truth** -- All new ops produce Babel AST nodes that are serialized to `.tsx` via `generate()`. No ephemeral state.
- [x] **C3 Composite IDs for Arrays** -- `emitMap` enforces `keyExpression` (rejects "index" as key). Commandment 3 is now mechanically enforced.
- [x] **C7 ID Preservation** -- `emitConditional` and `emitMap` wrap existing elements without removing their `data-flint-id`. `emitCallback` adds props without touching flint IDs.
- [x] **C9 CIEDE2000** -- Not directly involved, but Mithril pre-commit check extends to `emitCallback` if it wires className-related handlers (handled by existing className audit).
- [x] **C10 Targeted Micro-Recovery** -- New structural ops (`emitConditional`, `emitMap`, `composeSlot`) use `restoreCode` snapshot inversion. Property-level ops (`emitCallback`) use surgical inversion.
- [x] **C12 Atomic Queuing** -- All saves continue through `FileTransactionManager`. No change to persistence path.
- [x] **C13 Deterministic Surgery** -- Every new op uses Babel AST traversal. Expression strings are parsed via `@babel/parser`, never evaluated or regex-matched.
- [x] **C15 Granular AST Tools Only** -- Each new op is a single, targeted, auditable mutation. No raw code string generation. The orchestrator cannot bypass the catalog.
- [x] **C16 In-Memory Validation** -- Every new tool has a corresponding `validateToolInput` branch that constructs a synthetic snippet and validates it through the ILspClient before surfacing to the user.

---

## Implementation Order

### Group 0: Shared Infrastructure (sequential, before all phases)
1. **Shared expression parser helper** — A reusable `parseExpression(exprStr: string)` function in `ast-modifier.ts` that safely parses a JS expression string into a Babel Expression node. Used by `emitCallback`, `emitConditional`, `emitMap`.

### Phase CATALOG.1 — Group A (parallel)
- **flint-ast-surgeon**: Implement `emitImport`, `emitHook`, `emitHandler`, `emitCallback` in both `flint-mcp/src/core/ast-modifier.ts` and `src/utils/astModifier.ts`.
- **flint-electron-ipc**: Add `flint_emit_hook`, `flint_emit_handler`, `flint_emit_callback` to `FLINT_TOOLS`, `MUTATION_TOOL_NAMES`, `MRS_OP_WEIGHTS`, `MRS_TIER_FLOORS`, and `validateToolInput` in `electron/orchestrator.ts`.

### Phase CATALOG.1 — Group B (after Group A)
- **flint-state-architect**: Add new `ASTMutation` union members and `applyMutationBatch` switch cases in `src/core/ASTService.ts`.
- **flint-test-writer**: Tests for all Group A deliverables.

### Phase CATALOG.1 — Group C (after Group B)
- **flint-ast-surgeon**: Add new mutation types to `flint_ast_mutate` handler in `flint-mcp/src/server.ts`.

### Phase CATALOG.2 — Group D (after CATALOG.1 ships)
- **flint-ast-surgeon**: Implement `emitConditional`, `emitMap` in both ast-modifier files.
- **flint-electron-ipc**: Add `flint_emit_conditional`, `flint_emit_map` to orchestrator.
- **flint-state-architect**: Add `EmitConditionalMutation`, `EmitMapMutation` to `ASTService.ts`.
- **flint-test-writer**: Tests for all CATALOG.2 deliverables.

### Phase CATALOG.3 — Group E (can run parallel with CATALOG.1 or CATALOG.2)
- **flint-ast-surgeon**: Implement `composeSlot` in both ast-modifier files.
- **flint-electron-ipc**: Add `flint_compose_slot` to orchestrator.
- **flint-state-architect**: Add `ComposeSlotMutation` to `ASTService.ts`.
- **flint-test-writer**: Tests.

### Phase CATALOG.4 — Group F (after CATALOG.1 + INIT.1 ships)
- **flint-electron-ipc**: Implement `buildPropTypeStub`, registry-augmented validation snippets, `flint_validate_props` tool in orchestrator.
- **flint-test-writer**: Tests for prop validation with mock registry data.

---

## Risks

| Risk | Severity | Mitigation | Commandment |
|------|----------|------------|-------------|
| Expression string parsing allows arbitrary JS code injection | HIGH | Every expression is parsed by Babel (never `eval`). The LSP validates the full synthetic snippet. Malformed expressions are rejected at parse time. | C13, C16 |
| `emitHook` injected into a conditional branch violates Rules of Hooks | MEDIUM | The visitor explicitly checks that the insertion point is inside a function component's top-level `BlockStatement`, not inside an `IfStatement`, loop, or nested function. | C13 |
| `emitMap` without a stable key causes React reconciliation bugs | MEDIUM | The op rejects `keyExpression === "index"` and requires a non-empty key. Commandment 3 is structurally enforced. | C3 |
| Component registry missing for CATALOG.4 prop validation | LOW | Validation degrades gracefully: if no registry entry exists, prop validation falls back to syntax-only (current behavior). No blocking. | C16 |
| Two copies of ast-modifier.ts drift (MCP vs renderer) | MEDIUM | Both files follow identical function signatures. Tests run against both. Long-term: extract to shared package (out of scope for CATALOG). | C13 |
| New tools increase the AI's action space, making hallucinated tool calls more likely | LOW | The system prompt is updated with explicit workflow rules. Each tool has descriptive constraints in its schema. The validation loop catches all syntax errors. | C15, C16 |

---

## Updated Commandment 15 Text

After CATALOG ships, the Commandment 15 text in `CLAUDE.md` and `orchestrator.ts` should be updated to:

> **Commandment 15 — Granular AST Tools Only**: The AI Orchestrator MUST only emit ops from the versioned AST Tool Catalog. The catalog provides targeted, single-purpose mutation tools for structural changes (insert, delete, wrap, move), property changes (update props, update text, add/remove class), component logic (emit hook, emit handler, emit callback), rendering control flow (emit conditional, emit map), compound component assembly (compose slot), and imports (emit import). Each op is validated through the in-memory ILspClient before surfacing to the user. Raw code string generation, full-file replacements, and regex patches are structurally prohibited.

### Updated Tool Count

After all CATALOG phases ship:
- Orchestrator `FLINT_TOOLS`: 11 current + 6 new mutation tools + 1 advisory tool = **18 tools** (11 read/audit + 7 mutation)
- MCP `flint_ast_mutate` types: 9 current + 7 new = **16 mutation types**

---

## System Prompt Addendum

After CATALOG ships, add this workflow section to `SYSTEM_PROMPT` in `electron/orchestrator.ts`:

```
## Interactive UI Workflow

When adding interactivity to a component:
1. flint_emit_hook — add state (useState, useRef, etc.)
2. flint_emit_handler — add event handler functions that reference the state
3. flint_emit_callback — wire the handlers to JSX event props (onClick, onChange)
4. flint_emit_conditional — add conditional rendering guards for state-dependent UI
5. flint_emit_map — render lists with automatic key prop injection

Always declare hooks before handlers, and handlers before wiring them to elements.
Do not inline complex logic in flint_emit_callback — use flint_emit_handler first.
```
