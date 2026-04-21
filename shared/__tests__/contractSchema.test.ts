import { describe, it, expect } from 'vitest';
import {
  type FlintContract,
  type IPCChannelContract,
  type TestBoundary,
  type Invariant,
  type ImpactEntry,
  isCompleteContract,
  validateIPCTriangles,
  validateTestBoundaries,
  validateInvariants,
  validateParallelism,
} from '../contract-schema';

// ─── Fixtures ────────────────────────────────────────────────────────

const validInvariant: Invariant = {
  name: 'tokenLookup-p95',
  measurable: 'p95 round-trip latency',
  threshold: '< 200ms at N=1000',
  measuredBy: 'vitest bench',
};

const validIPC: IPCChannelContract = {
  channel: 'flint:do-thing',
  direction: 'renderer→main',
  payloadType: 'DoThingPayload',
  returnType: '{ success: boolean }',
  handler: 'electron/main.ts',
  validator: 'doThingPayloadSchema',
};

const validBoundary: TestBoundary = {
  target: 'flint:do-thing handler',
  kind: 'ipc-handler',
  behavior: 'Accepts payload and persists',
  assertion: 'returns { success: true }',
  edgeCases: ['empty payload'],
  given: 'the handler is registered',
  when: 'a valid payload is dispatched',
  then: 'returns { success: true }',
};

const validContract: FlintContract = {
  meta: {
    name: 'TestFeature',
    phase: 'T.1',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-17',
    audience: 'designer',
  },
  impact: [
    { file: 'electron/main.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Add handler' },
  ],
  ipc: [validIPC],
  stores: [],
  components: [],
  commandments: [12, 14],
  testBoundaries: [validBoundary],
  invariants: [validInvariant],
  risks: [],
  parallelismGroups: { A: ['flint-electron-ipc'] },
  nonGoals: ['Real-time sync'],
};

// ─── isCompleteContract ──────────────────────────────────────────────

describe('isCompleteContract', () => {
  it('returns true for a fully populated contract', () => {
    expect(isCompleteContract(validContract)).toBe(true);
  });

  it('returns false when meta.audience is missing', () => {
    const c = { ...validContract, meta: { ...validContract.meta, audience: undefined } } as unknown as Partial<FlintContract>;
    expect(isCompleteContract(c)).toBe(false);
  });

  it('returns false when meta.name is missing', () => {
    const c = { ...validContract, meta: { ...validContract.meta, name: '' } };
    expect(isCompleteContract(c)).toBe(false);
  });

  it('returns false when impact is empty', () => {
    expect(isCompleteContract({ ...validContract, impact: [] })).toBe(false);
  });

  it('returns false when commandments is empty', () => {
    expect(isCompleteContract({ ...validContract, commandments: [] })).toBe(false);
  });

  it('returns false when testBoundaries is empty', () => {
    expect(isCompleteContract({ ...validContract, testBoundaries: [] })).toBe(false);
  });

  it('returns false when invariants is empty (v2.1 requirement)', () => {
    expect(isCompleteContract({ ...validContract, invariants: [] })).toBe(false);
  });

  it('returns false when parallelismGroups is empty', () => {
    expect(isCompleteContract({ ...validContract, parallelismGroups: {} })).toBe(false);
  });

  it('returns false when nonGoals is empty (v2.1 requirement)', () => {
    expect(isCompleteContract({ ...validContract, nonGoals: [] })).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isCompleteContract({})).toBe(false);
  });
});

// ─── validateIPCTriangles ────────────────────────────────────────────

describe('validateIPCTriangles', () => {
  it('returns no errors for a well-formed renderer→main channel', () => {
    expect(validateIPCTriangles([validIPC])).toEqual([]);
  });

  it('flags missing channel name', () => {
    const bad = { ...validIPC, channel: '' };
    const errors = validateIPCTriangles([bad]);
    expect(errors).toContain('IPC channel missing name');
  });

  it('flags missing payloadType', () => {
    const bad = { ...validIPC, payloadType: '' };
    const errors = validateIPCTriangles([bad]);
    expect(errors.some(e => e.includes('missing payload type'))).toBe(true);
  });

  it('flags missing returnType', () => {
    const bad = { ...validIPC, returnType: '' };
    const errors = validateIPCTriangles([bad]);
    expect(errors.some(e => e.includes('missing return type'))).toBe(true);
  });

  it('flags missing handler', () => {
    const bad = { ...validIPC, handler: '' };
    const errors = validateIPCTriangles([bad]);
    expect(errors.some(e => e.includes('missing handler location'))).toBe(true);
  });

  it('requires validator on renderer→main channels', () => {
    const bad = { ...validIPC, validator: null };
    const errors = validateIPCTriangles([bad]);
    expect(errors.some(e => e.includes('Zod validator'))).toBe(true);
  });

  it('requires validator on bidirectional channels', () => {
    const bad: IPCChannelContract = { ...validIPC, direction: 'bidirectional', validator: null };
    const errors = validateIPCTriangles([bad]);
    expect(errors.some(e => e.includes('Zod validator'))).toBe(true);
  });

  it('allows null validator on main→renderer broadcasts', () => {
    const broadcast: IPCChannelContract = {
      channel: 'flint:tokens-updated',
      direction: 'main→renderer',
      payloadType: 'void',
      returnType: 'void',
      handler: 'electron/main.ts',
      validator: null,
    };
    expect(validateIPCTriangles([broadcast])).toEqual([]);
  });

  it('returns no errors for an empty channel list', () => {
    expect(validateIPCTriangles([])).toEqual([]);
  });

  it('accumulates errors across multiple channels', () => {
    const errors = validateIPCTriangles([
      { ...validIPC, channel: '' },
      { ...validIPC, channel: 'good:one', validator: null },
    ]);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── validateTestBoundaries ──────────────────────────────────────────

describe('validateTestBoundaries', () => {
  it('returns no errors for a well-formed boundary', () => {
    expect(validateTestBoundaries([validBoundary])).toEqual([]);
  });

  it('flags missing given', () => {
    const bad = { ...validBoundary, given: '' };
    const errors = validateTestBoundaries([bad]);
    expect(errors.some(e => e.includes('missing `given`'))).toBe(true);
  });

  it('flags missing when', () => {
    const bad = { ...validBoundary, when: '' };
    const errors = validateTestBoundaries([bad]);
    expect(errors.some(e => e.includes('missing `when`'))).toBe(true);
  });

  it('flags missing then', () => {
    const bad = { ...validBoundary, then: '' };
    const errors = validateTestBoundaries([bad]);
    expect(errors.some(e => e.includes('missing `then`'))).toBe(true);
  });

  it('rejects prose then clauses ("handles errors gracefully")', () => {
    const bad = { ...validBoundary, then: 'handles errors gracefully' };
    const errors = validateTestBoundaries([bad]);
    expect(errors.some(e => e.includes('must start with an imperative verb'))).toBe(true);
  });

  it('rejects vague verbs ("works", "is")', () => {
    expect(validateTestBoundaries([{ ...validBoundary, then: 'works correctly' }]).length).toBeGreaterThan(0);
    expect(validateTestBoundaries([{ ...validBoundary, then: 'is correct' }]).length).toBeGreaterThan(0);
  });

  it.each([
    'returns the item',
    'throws a ValidationError',
    'rejects with a 4xx',
    'emits a tokens:updated event',
    'sets newSlice.loading to false',
    'calls the handler once',
    'renders 3 <li> elements',
    'dispatches an updateItem action',
    'updates editorStore.items to length 1',
    'writes the file via FileTransactionManager',
    'broadcasts flint:context-synced',
    'blocks the export',
    'allows the override',
  ])('accepts imperative verb: %s', (thenClause) => {
    const good = { ...validBoundary, then: thenClause };
    expect(validateTestBoundaries([good])).toEqual([]);
  });

  it('is case-insensitive on the verb', () => {
    const good = { ...validBoundary, then: 'Returns the item' };
    expect(validateTestBoundaries([good])).toEqual([]);
  });

  it('tolerates surrounding whitespace', () => {
    const good = { ...validBoundary, then: '   returns the item' };
    expect(validateTestBoundaries([good])).toEqual([]);
  });

  it('returns empty for empty array', () => {
    expect(validateTestBoundaries([])).toEqual([]);
  });
});

// ─── validateInvariants ──────────────────────────────────────────────

describe('validateInvariants', () => {
  it('returns no errors for a well-formed invariant', () => {
    expect(validateInvariants([validInvariant])).toEqual([]);
  });

  it('flags missing name', () => {
    const bad = { ...validInvariant, name: '' };
    const errors = validateInvariants([bad]);
    expect(errors.some(e => e.includes('missing `name`'))).toBe(true);
  });

  it('flags missing measurable', () => {
    const bad = { ...validInvariant, measurable: '' };
    const errors = validateInvariants([bad]);
    expect(errors.some(e => e.includes('missing `measurable`'))).toBe(true);
  });

  it('flags missing threshold', () => {
    const bad = { ...validInvariant, threshold: '' };
    const errors = validateInvariants([bad]);
    expect(errors.some(e => e.includes('missing `threshold`'))).toBe(true);
  });

  it('flags missing measuredBy', () => {
    const bad = { ...validInvariant, measuredBy: '' };
    const errors = validateInvariants([bad]);
    expect(errors.some(e => e.includes('missing `measuredBy`'))).toBe(true);
  });

  it('rejects adjective thresholds ("fast enough")', () => {
    const bad = { ...validInvariant, threshold: 'fast enough' };
    const errors = validateInvariants([bad]);
    expect(errors.some(e => e.includes('not falsifiable'))).toBe(true);
  });

  it('rejects "acceptable" and "reasonable"', () => {
    expect(validateInvariants([{ ...validInvariant, threshold: 'acceptable' }]).length).toBeGreaterThan(0);
    expect(validateInvariants([{ ...validInvariant, threshold: 'reasonable performance' }]).length).toBeGreaterThan(0);
  });

  it.each([
    '< 200ms',
    '> 99.9% success rate',
    '= 0 errors',
    '≤ 50ms',
    '≥ 60fps',
    '<= 100MB',
    '>= 95% coverage',
  ])('accepts threshold with operator: %s', (threshold) => {
    const good = { ...validInvariant, threshold };
    expect(validateInvariants([good])).toEqual([]);
  });

  it('returns empty for empty array', () => {
    expect(validateInvariants([])).toEqual([]);
  });

  it('accumulates errors across multiple invariants', () => {
    const errors = validateInvariants([
      { ...validInvariant, threshold: 'vibes' },
      { ...validInvariant, name: '' },
    ]);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── validateParallelism ─────────────────────────────────────────────

describe('validateParallelism', () => {
  const impact: ImpactEntry[] = [
    { file: 'a.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'x' },
    { file: 'b.ts', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'y' },
  ];

  it('returns no errors when all owners are in a group', () => {
    const groups = {
      A: ['flint-electron-ipc'],
      B: ['flint-design-engineer'],
    };
    expect(validateParallelism(impact, groups)).toEqual([]);
  });

  it('flags an owner not in any group', () => {
    const groups = { A: ['flint-electron-ipc'] };
    const errors = validateParallelism(impact, groups);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('flint-design-engineer');
    expect(errors[0]).toContain('b.ts');
  });

  it('returns no errors for empty impact', () => {
    expect(validateParallelism([], { A: ['x'] })).toEqual([]);
  });
});
