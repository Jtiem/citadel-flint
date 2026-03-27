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
  risks: RiskEntry[];
  /** Parallelism groups: { "A": ["flint-electron-ipc", "flint-state-architect"], ... } */
  parallelismGroups: Record<string, string[]>;
  /** Explicit non-goals — what this feature does NOT do */
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
    Array.isArray(c.impact) && c.impact.length > 0 &&
    Array.isArray(c.ipc) &&
    Array.isArray(c.stores) &&
    Array.isArray(c.components) &&
    Array.isArray(c.commandments) && c.commandments.length > 0 &&
    Array.isArray(c.testBoundaries) && c.testBoundaries.length > 0 &&
    Array.isArray(c.risks) &&
    c.parallelismGroups && Object.keys(c.parallelismGroups).length > 0 &&
    Array.isArray(c.nonGoals)
  );
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
