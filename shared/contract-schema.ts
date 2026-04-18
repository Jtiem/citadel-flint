/**
 * Contract Schema — Machine-readable definition of a Flint contract artifact.
 *
 * Every contract produced by flint-architect includes a companion `.contract.ts`
 * file that Phase 2 agents import directly. This eliminates the gap between
 * "what the contract says" and "what the code implements" — TypeScript enforces
 * alignment at compile time.
 *
 * Usage:
 *   Phase 1: Architect writes `.flint-context/contracts/<name>.contract.ts`
 *   Phase 2: Agents `import type { ... } from '../contracts/<name>.contract'`
 *   Phase 3: Validator confirms all exported types are consumed in implementation
 */

// ─── Contract Metadata ──────────────────────────────────────────────

export type ContractStatus = 'DRAFT' | 'APPROVED' | 'IMPLEMENTING' | 'SHIPPED';
export type ChangeType = 'CREATE' | 'MODIFY' | 'DELETE';
export type RiskSeverity = 'low' | 'medium' | 'high';
export type IPCDirection = 'renderer→main' | 'main→renderer' | 'bidirectional';

/**
 * Dual-audience mapping per Feature Budget Framework.
 * Forces the architect to declare which interface this feature serves.
 * - engine   → flint-mcp/ (both designers and developers consume)
 * - designer → electron/ + src/ (Glass)
 * - developer → flint-vscode/
 * - ci       → flint-ci/
 */
export type Audience = 'engine' | 'designer' | 'developer' | 'ci';

export interface ContractMeta {
  /** Feature/phase name (e.g., "CV2.3-ComponentCards") */
  name: string;
  /** Phase ID from the roadmap (e.g., "CV2.3") */
  phase: string;
  /** Current lifecycle status */
  status: ContractStatus;
  /** Lead architect agent */
  owner: string;
  /** ISO date of contract creation */
  date: string;
  /** Which interface this feature serves (Feature Budget Framework) */
  audience: Audience;
}

// ─── Impact Map ─────────────────────────────────────────────────────

export interface ImpactEntry {
  /** Relative file path from project root */
  file: string;
  /** What happens to this file */
  changeType: ChangeType;
  /** Which specialist agent owns this file */
  owner: string;
  /** Brief description of the change */
  summary: string;
}

// ─── IPC Channels ───────────────────────────────────────────────────

export interface IPCChannelContract {
  /** Channel name (e.g., "components:list") */
  channel: string;
  /** Communication direction */
  direction: IPCDirection;
  /** TypeScript type name for the payload */
  payloadType: string;
  /** TypeScript type name for the return value */
  returnType: string;
  /** Handler location (e.g., "electron/main.ts") */
  handler: string;
  /**
   * Zod validator export name in shared/ipc-validators.ts.
   * Required for every renderer→main channel to close the preload-bridge
   * security gap. Phase 1.5 greps the validators file for this export.
   * Use `null` ONLY for main→renderer broadcasts that carry no payload.
   */
  validator: string | null;
}

// ─── Store Contracts ────────────────────────────────────────────────

export interface StoreSliceContract {
  /** Store name (e.g., "canvasStore") */
  store: string;
  /** New state fields: { fieldName: "TypeName" } */
  newState: Record<string, string>;
  /** New actions: { actionName: "(params) => returnType" } */
  newActions: Record<string, string>;
  /** New selectors: { selectorName: "() => ReturnType" } */
  newSelectors: Record<string, string>;
}

// ─── Component Contracts ────────────────────────────────────────────

export interface ComponentContract {
  /** Component name (e.g., "ComponentCard") */
  name: string;
  /** File path (e.g., "src/components/canvas/ComponentCard.tsx") */
  file: string;
  /** Props interface name (e.g., "ComponentCardProps") */
  propsType: string;
  /** Stores this component reads from */
  consumesStores: string[];
  /** IPC channels this component calls */
  emitsIPC: string[];
}

// ─── Test Boundaries ────────────────────────────────────────────────

/**
 * NEW: Test boundaries extracted from the contract.
 * flint-test-writer uses these to generate test scaffolds BEFORE
 * implementation begins — bringing TDD's "red phase" into the
 * contract-first workflow.
 */
export interface TestBoundary {
  /** What is being tested (function, action, handler, component) */
  target: string;
  /** Target type for routing to the right test pattern */
  kind: 'ipc-handler' | 'store-action' | 'component' | 'service' | 'hook';
  /** Human description of the expected behavior */
  behavior: string;
  /** The type assertion to verify (e.g., "returns ComponentEntry[]") */
  assertion: string;
  /** Edge cases that MUST be tested */
  edgeCases: string[];
  /**
   * Executable specification (Given/When/Then).
   * Required. Forces architect to write falsifiable boundaries.
   * Linter rejects prose like "handles errors gracefully" by requiring
   * `then` to begin with an imperative verb (returns|throws|rejects|emits|sets|calls|renders|dispatches).
   */
  given: string;
  when: string;
  then: string;
}

// ─── Invariants ─────────────────────────────────────────────────────

/**
 * Falsifiable, measurable invariants this feature must uphold.
 * Forbids adjectives. "Fast" is not an invariant; "p95 < 200ms at N=1000" is.
 * Linter requires `threshold` to contain a comparison operator.
 */
export interface Invariant {
  /** Short identifier (e.g., "tokenLookup-p95") */
  name: string;
  /** What is being measured (e.g., "p95 latency", "memory at idle", "render count") */
  measurable: string;
  /**
   * Numeric threshold with comparison operator and units.
   * Must contain one of: <, >, =, <=, >=, ≤, ≥.
   * Good: "< 200ms at N=1000", ">= 99.9% success rate over 24h"
   * Bad: "fast enough", "acceptable performance"
   */
  threshold: string;
  /** How this is verified (e.g., "vitest bench", "manual via DevTools", "telemetry dashboard") */
  measuredBy: string;
}

// ─── Risk Register ──────────────────────────────────────────────────

export interface RiskEntry {
  /** What could go wrong */
  risk: string;
  /** Impact severity */
  severity: RiskSeverity;
  /** Which Commandment this threatens (1-16) */
  commandment?: number;
  /** How we prevent or mitigate it */
  mitigation: string;
}

// ─── Full Contract Definition ───────────────────────────────────────

/**
 * The complete, machine-readable contract.
 *
 * The architect exports this as `CONTRACT` from the `.contract.ts` file.
 * The contract linter validates it. The integration validator checks
 * implementation against it. The test-writer scaffolds from it.
 */
export interface FlintContract {
  meta: ContractMeta;
  impact: ImpactEntry[];
  ipc: IPCChannelContract[];
  stores: StoreSliceContract[];
  components: ComponentContract[];
  commandments: number[];
  testBoundaries: TestBoundary[];
  /** Falsifiable, measurable invariants — required (min 1) */
  invariants: Invariant[];
  risks: RiskEntry[];
  /** Parallelism groups: { "A": ["flint-electron-ipc", "flint-state-architect"], ... } */
  parallelismGroups: Record<string, string[]>;
  /**
   * Explicit non-goals — what this feature does NOT do.
   * Required (min 1). Most Phase 2 scope creep starts with an empty nonGoals list.
   */
  nonGoals: string[];
}

// ─── Contract File Helpers ──────────────────────────────────────────

/**
 * Type guard: validates that a contract has all required sections.
 * Used by the contract linter agent in Phase 1.5.
 */
export function isCompleteContract(c: Partial<FlintContract>): c is FlintContract {
  return !!(
    c.meta?.name &&
    c.meta?.phase &&
    c.meta?.status &&
    c.meta?.owner &&
    c.meta?.date &&
    c.meta?.audience &&
    Array.isArray(c.impact) && c.impact.length > 0 &&
    Array.isArray(c.ipc) &&
    Array.isArray(c.stores) &&
    Array.isArray(c.components) &&
    Array.isArray(c.commandments) && c.commandments.length > 0 &&
    Array.isArray(c.testBoundaries) && c.testBoundaries.length > 0 &&
    Array.isArray(c.invariants) && c.invariants.length > 0 &&
    Array.isArray(c.risks) &&
    c.parallelismGroups && Object.keys(c.parallelismGroups).length > 0 &&
    Array.isArray(c.nonGoals) && c.nonGoals.length > 0
  );
}

/**
 * Validates that each TestBoundary is executable (not prose).
 * Every boundary must have non-empty given/when/then, and `then`
 * must begin with an imperative verb from the allowed set.
 * Returns an array of error strings (empty = valid).
 */
const THEN_VERBS = [
  'returns', 'return',
  'throws', 'throw',
  'rejects', 'reject',
  'resolves', 'resolve',
  'emits', 'emit',
  'sets', 'set',
  'calls', 'call',
  'renders', 'render',
  'dispatches', 'dispatch',
  'updates', 'update',
  'writes', 'write',
  'reads', 'read',
  'broadcasts', 'broadcast',
  'blocks', 'block',
  'allows', 'allow',
];
export function validateTestBoundaries(boundaries: TestBoundary[]): string[] {
  const errors: string[] = [];
  for (const b of boundaries) {
    if (!b.given?.trim()) errors.push(`TestBoundary "${b.target}" missing \`given\``);
    if (!b.when?.trim()) errors.push(`TestBoundary "${b.target}" missing \`when\``);
    if (!b.then?.trim()) {
      errors.push(`TestBoundary "${b.target}" missing \`then\``);
      continue;
    }
    const firstWord = b.then.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
    if (!THEN_VERBS.includes(firstWord)) {
      errors.push(
        `TestBoundary "${b.target}" \`then\` must start with an imperative verb ` +
        `(${THEN_VERBS.filter((_, i) => i % 2 === 0).join('|')}). Got: "${firstWord}"`
      );
    }
  }
  return errors;
}

/**
 * Validates that each Invariant has a falsifiable threshold.
 * `threshold` must contain a comparison operator — adjectives like "fast" fail.
 */
const THRESHOLD_OPERATORS = ['<', '>', '=', '≤', '≥', '<=', '>='];
export function validateInvariants(invariants: Invariant[]): string[] {
  const errors: string[] = [];
  for (const inv of invariants) {
    if (!inv.name?.trim()) errors.push(`Invariant missing \`name\``);
    if (!inv.measurable?.trim()) errors.push(`Invariant "${inv.name}" missing \`measurable\``);
    if (!inv.measuredBy?.trim()) errors.push(`Invariant "${inv.name}" missing \`measuredBy\``);
    if (!inv.threshold?.trim()) {
      errors.push(`Invariant "${inv.name}" missing \`threshold\``);
      continue;
    }
    const hasOperator = THRESHOLD_OPERATORS.some(op => inv.threshold.includes(op));
    if (!hasOperator) {
      errors.push(
        `Invariant "${inv.name}" threshold "${inv.threshold}" is not falsifiable — ` +
        `must contain a comparison operator (${THRESHOLD_OPERATORS.join(', ')})`
      );
    }
  }
  return errors;
}

/**
 * Validates IPC triangle completeness.
 * Every IPC channel must specify handler location.
 * Phase 1.5 uses this; Phase 3 verifies against actual files.
 */
export function validateIPCTriangles(channels: IPCChannelContract[]): string[] {
  const errors: string[] = [];
  for (const ch of channels) {
    if (!ch.channel) errors.push(`IPC channel missing name`);
    if (!ch.payloadType) errors.push(`IPC "${ch.channel}" missing payload type`);
    if (!ch.returnType) errors.push(`IPC "${ch.channel}" missing return type`);
    if (!ch.handler) errors.push(`IPC "${ch.channel}" missing handler location`);
    // Validator is required for renderer→main and bidirectional channels.
    // main→renderer broadcasts may omit it only if they carry no payload.
    const requiresValidator = ch.direction === 'renderer→main' || ch.direction === 'bidirectional';
    if (requiresValidator && !ch.validator) {
      errors.push(
        `IPC "${ch.channel}" (${ch.direction}) must declare a Zod validator export name from ` +
        `shared/ipc-validators.ts. Use \`validator: null\` only for payload-less main→renderer broadcasts.`
      );
    }
  }
  return errors;
}

/**
 * Validates that every impact entry has an owner in a parallelism group.
 */
export function validateParallelism(
  impact: ImpactEntry[],
  groups: Record<string, string[]>
): string[] {
  const allAgents = new Set(Object.values(groups).flat());
  const errors: string[] = [];
  for (const entry of impact) {
    if (!allAgents.has(entry.owner)) {
      errors.push(
        `Impact entry "${entry.file}" assigned to "${entry.owner}" but that agent is not in any parallelism group`
      );
    }
  }
  return errors;
}
