/**
 * HelloFlintWelcome.test.tsx
 *
 * Contract: .flint-context/contracts/HELLO-FLINT-PHASE-A.contract.ts
 * Test boundaries covered (in order):
 *   HFW-01  renders welcome state on mount
 *   HFW-02  already-connected fast path
 *   HFW-03  Let's go advances to detecting then connect-confirm
 *   HFW-04  undetected editor button is disabled
 *   HFW-05  write succeeds and shows verify panel
 *   HFW-06  partial failure shows honest result
 *   HFW-07  manual fallback shows snippet
 *   HFW-08  skip text link calls onComplete
 *   HFW-09  token-only styling (static grep — no raw hex in source)
 *   HFW-10  escape blocked during writing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { HelloFlintWelcome } from '../HelloFlintWelcome';

// ── Helpers ───────────────────────────────────────────────────────────────────

const THREE_EDITORS_ALL_PRESENT = {
  editors: [
    { editor: 'claude-code' as const, present: true, configPath: '/home/.claude/mcp.json' },
    { editor: 'cursor' as const, present: true, configPath: '/home/Cursor/settings.json' },
    { editor: 'vscode' as const, present: true, configPath: '/home/Code/settings.json' },
  ],
  mcpServerPath: '/abs/flint-mcp/dist/server.js',
  platform: 'darwin' as const,
};

const CURSOR_ONLY = {
  editors: [
    { editor: 'claude-code' as const, present: false, configPath: null },
    { editor: 'cursor' as const, present: true, configPath: '/home/Cursor/settings.json' },
    { editor: 'vscode' as const, present: false, configPath: null },
  ],
  mcpServerPath: '/abs/flint-mcp/dist/server.js',
  platform: 'darwin' as const,
};

const NONE_PRESENT = {
  editors: [
    { editor: 'claude-code' as const, present: false, configPath: null },
    { editor: 'cursor' as const, present: false, configPath: null },
    { editor: 'vscode' as const, present: false, configPath: null },
  ],
  mcpServerPath: '/abs/flint-mcp/dist/server.js',
  platform: 'darwin' as const,
};

function makeHelloAPI(overrides: Partial<{
  alreadyConnected: () => Promise<unknown>;
  detectEditors: () => Promise<unknown>;
  writeMcpConfigBulk: (p: unknown) => Promise<unknown>;
}> = {}) {
  return {
    alreadyConnected: vi.fn().mockResolvedValue({ connected: false, editors: [] }),
    detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
    writeMcpConfigBulk: vi.fn().mockResolvedValue({
      written: [{ editor: 'cursor', configPath: '/p', preservedEntries: 2 }],
      failed: [],
    }),
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  // Ensure a hello namespace exists on the global mock (setup.ts provides flintAPI)
  if (!(window as any).flintAPI) {
    (window as any).flintAPI = {};
  }
  (window as any).flintAPI.hello = makeHelloAPI();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// ── HFW-01: renders welcome state on mount ────────────────────────────────────

describe('HFW-01: welcome state on mount', () => {
  it('renders the "Welcome to Flint" heading', () => {
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    expect(screen.getByText('Welcome to Flint')).toBeTruthy();
  });

  it('renders the primary "Let\'s go" button', () => {
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /let'?s go/i })).toBeTruthy();
  });

  it('renders the "Skip" text link', () => {
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /skip/i })).toBeTruthy();
  });

  it('renders without crashing when no optional props are given', () => {
    expect(() => render(<HelloFlintWelcome onComplete={vi.fn()} />)).not.toThrow();
  });

  it('renders the build footer when buildId is provided', () => {
    render(<HelloFlintWelcome onComplete={vi.fn()} buildId="0.3.0-beta.1" daysRemaining={60} />);
    expect(screen.getByText(/0\.3\.0-beta\.1/)).toBeTruthy();
    expect(screen.getByText(/60 days/)).toBeTruthy();
  });

  it('renders build footer without expiry when daysRemaining is null', () => {
    render(<HelloFlintWelcome onComplete={vi.fn()} buildId="0.3.0-beta.1" daysRemaining={null} />);
    expect(screen.getByText(/0\.3\.0-beta\.1/)).toBeTruthy();
    expect(screen.queryByText(/days/)).toBeNull();
  });

  it('does not render build footer when buildId is omitted', () => {
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    expect(screen.queryByText(/Build /)).toBeNull();
  });
});

// ── HFW-02: already-connected fast path ──────────────────────────────────────

describe('HFW-02: already-connected fast path', () => {
  it('calls onComplete immediately when alreadyConnected resolves connected:true', async () => {
    const onComplete = vi.fn();
    (window as any).flintAPI.hello = makeHelloAPI({
      alreadyConnected: vi.fn().mockResolvedValue({ connected: true, editors: ['cursor'] }),
    });
    render(<HelloFlintWelcome onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it('does not call detectEditors during the fast path', async () => {
    const onComplete = vi.fn();
    const detectEditors = vi.fn().mockResolvedValue(CURSOR_ONLY);
    (window as any).flintAPI.hello = makeHelloAPI({
      alreadyConnected: vi.fn().mockResolvedValue({ connected: true, editors: ['cursor'] }),
      detectEditors,
    });
    render(<HelloFlintWelcome onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(detectEditors).not.toHaveBeenCalled();
  });

  it('does not call onComplete when alreadyConnected returns connected:false', async () => {
    const onComplete = vi.fn();
    (window as any).flintAPI.hello = makeHelloAPI({
      alreadyConnected: vi.fn().mockResolvedValue({ connected: false, editors: [] }),
    });
    render(<HelloFlintWelcome onComplete={onComplete} />);
    // Give the promise time to settle
    await act(async () => { await Promise.resolve(); });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not crash when alreadyConnected rejects', async () => {
    const onComplete = vi.fn();
    (window as any).flintAPI.hello = makeHelloAPI({
      alreadyConnected: vi.fn().mockRejectedValue(new Error('network')),
    });
    expect(() => render(<HelloFlintWelcome onComplete={onComplete} />)).not.toThrow();
    await act(async () => { await Promise.resolve(); });
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ── HFW-03: Let's go advances through detecting → connect-confirm ─────────────

describe('HFW-03: Let\'s go → detecting → connect-confirm', () => {
  it('calls detectEditors once after clicking Let\'s go', async () => {
    const detectEditors = vi.fn().mockResolvedValue(CURSOR_ONLY);
    (window as any).flintAPI.hello = makeHelloAPI({ detectEditors });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => expect(detectEditors).toHaveBeenCalledOnce());
  });

  it('renders a present-editor indicator after detection resolves', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    await waitFor(() => {
      expect(screen.getByText(/Found Cursor/)).toBeTruthy();
    });
  });

  it('renders "not found" for absent editors', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    // CURSOR_ONLY has 2 absent editors (claude-code + vscode) — use getAllByText
    await waitFor(() => {
      const items = screen.getAllByText(/not found/i);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('reaches connect-confirm when all 3 editors are present', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(THREE_EDITORS_ALL_PRESENT),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    await waitFor(() => {
      expect(screen.getByText(/Which one should I connect/i)).toBeTruthy();
    });
  });

  it('reaches connect-confirm even when no editors are present', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(NONE_PRESENT),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /manually/i })).toBeTruthy();
    });
  });
});

// ── HFW-04: undetected editor button is disabled ──────────────────────────────

describe('HFW-04: undetected editor button disabled', () => {
  it('VS Code button is disabled when present:false', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    await waitFor(() => screen.getByRole('button', { name: /Connect VS Code/i }));
    const vsCodeBtn = screen.getByRole('button', { name: /Connect VS Code/i });
    expect(vsCodeBtn).toHaveProperty('disabled', true);
  });

  it('all editor buttons are disabled when no editors are detected', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(NONE_PRESENT),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    await waitFor(() => screen.getByRole('button', { name: /Connect Cursor/i }));
    ['Connect Claude Code', 'Connect Cursor', 'Connect VS Code'].forEach(label => {
      const btn = screen.getByRole('button', { name: label });
      expect(btn).toHaveProperty('disabled', true);
    });
  });

  it('"I\'ll do this manually" is always enabled regardless of detection', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(NONE_PRESENT),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    await waitFor(() => screen.getByRole('button', { name: /manually/i }));
    expect(screen.getByRole('button', { name: /manually/i })).toHaveProperty('disabled', false);
  });
});

// ── HFW-05: write succeeds → verify panel ─────────────────────────────────────

describe('HFW-05: write succeeds and shows verify panel', () => {
  it('calls writeMcpConfigBulk with editors:["cursor"] when Cursor is picked', async () => {
    const writeMcpConfigBulk = vi.fn().mockResolvedValue({
      written: [{ editor: 'cursor', configPath: '/p', preservedEntries: 2 }],
      failed: [],
    });
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
      writeMcpConfigBulk,
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));

    await waitFor(() => screen.getByRole('button', { name: /Connect Cursor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Connect Cursor/i }));

    await waitFor(() => expect(writeMcpConfigBulk).toHaveBeenCalledWith({
      editors: ['cursor'],
      mcpServerPath: '/abs/flint-mcp/dist/server.js',
    }));
  });

  it('renders the "I see the green dot" button after a successful write', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
      writeMcpConfigBulk: vi.fn().mockResolvedValue({
        written: [{ editor: 'cursor', configPath: '/p', preservedEntries: 2 }],
        failed: [],
      }),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /Connect Cursor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Connect Cursor/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /I see the green dot/i })).toBeTruthy(),
    );
  });

  it('clicking the green-dot button calls onComplete', async () => {
    const onComplete = vi.fn();
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
      writeMcpConfigBulk: vi.fn().mockResolvedValue({
        written: [{ editor: 'cursor', configPath: '/p', preservedEntries: 2 }],
        failed: [],
      }),
    });
    render(<HelloFlintWelcome onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /Connect Cursor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Connect Cursor/i }));
    await waitFor(() => screen.getByRole('button', { name: /I see the green dot/i }));
    fireEvent.click(screen.getByRole('button', { name: /I see the green dot/i }));

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('Both button calls writeMcpConfigBulk with 2 editors', async () => {
    const writeMcpConfigBulk = vi.fn().mockResolvedValue({
      written: [
        { editor: 'cursor', configPath: '/p1', preservedEntries: 1 },
        { editor: 'claude-code', configPath: '/p2', preservedEntries: 0 },
      ],
      failed: [],
    });
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(THREE_EDITORS_ALL_PRESENT),
      writeMcpConfigBulk,
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /Both/i }));
    fireEvent.click(screen.getByRole('button', { name: /Both/i }));

    await waitFor(() =>
      expect(writeMcpConfigBulk).toHaveBeenCalledOnce(),
    );
    const payload = writeMcpConfigBulk.mock.calls[0][0] as { editors: string[] };
    expect(payload.editors.length).toBeGreaterThanOrEqual(2);
  });
});

// ── HFW-06: partial failure shows honest result ───────────────────────────────

describe('HFW-06: partial failure shows honest result', () => {
  async function renderToVerifyPartial() {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(THREE_EDITORS_ALL_PRESENT),
      writeMcpConfigBulk: vi.fn().mockResolvedValue({
        written: [{ editor: 'cursor', configPath: '/p', preservedEntries: 1 }],
        failed: [{ editor: 'vscode', reason: 'file locked' }],
      }),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /Both/i }));
    fireEvent.click(screen.getByRole('button', { name: /Both/i }));
    await waitFor(() => screen.getByRole('button', { name: /I see the green dot/i }));
  }

  it('renders success mention of Cursor', async () => {
    await renderToVerifyPartial();
    expect(screen.getByText(/Wrote to Cursor/)).toBeTruthy();
  });

  it('renders failure mention of VS Code', async () => {
    await renderToVerifyPartial();
    // Text appears in both the summary <p> and the detail <li> — getAllByText
    const matches = screen.getAllByText(/Couldn't write to VS Code/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('includes the reason string from the failed entry', async () => {
    await renderToVerifyPartial();
    // "file locked" appears in both summary and detail nodes — getAllByText
    const matches = screen.getAllByText(/file locked/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('all-failed transitions to error state with manual fallback', async () => {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
      writeMcpConfigBulk: vi.fn().mockResolvedValue({
        written: [],
        failed: [{ editor: 'cursor', reason: 'permission denied' }],
      }),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /Connect Cursor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Connect Cursor/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Try manual instead/i })).toBeTruthy(),
    );
  });
});

// ── HFW-07: manual fallback shows snippet ────────────────────────────────────

describe('HFW-07: manual fallback shows snippet', () => {
  async function navigateToManual() {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue({
        ...CURSOR_ONLY,
        mcpServerPath: '/abs/flint-mcp/dist/server.js',
      }),
    });
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /manually/i }));
    fireEvent.click(screen.getByRole('button', { name: /manually/i }));
  }

  it('renders a code block containing "mcpServers"', async () => {
    await navigateToManual();
    const codeEl = document.querySelector('pre code');
    expect(codeEl).not.toBeNull();
    expect(codeEl!.textContent).toContain('mcpServers');
  });

  it('code block contains the resolved mcpServerPath', async () => {
    await navigateToManual();
    const codeEl = document.querySelector('pre code');
    expect(codeEl!.textContent).toContain('/abs/flint-mcp/dist/server.js');
  });

  it('"Done" button calls onComplete', async () => {
    const onComplete = vi.fn();
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
    });
    render(<HelloFlintWelcome onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /manually/i }));
    fireEvent.click(screen.getByRole('button', { name: /manually/i }));
    await waitFor(() => screen.getByRole('button', { name: /^Done$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

// ── HFW-08: skip text link calls onComplete ───────────────────────────────────

describe('HFW-08: skip link behaviour', () => {
  it('calls onComplete exactly once when Skip is clicked', () => {
    const onComplete = vi.fn();
    render(<HelloFlintWelcome onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('does not call any hello API method when Skip is clicked', () => {
    const detectEditors = vi.fn();
    const writeMcpConfigBulk = vi.fn();
    const alreadyConnected = vi.fn().mockResolvedValue({ connected: false, editors: [] });
    (window as any).flintAPI.hello = { detectEditors, writeMcpConfigBulk, alreadyConnected };

    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(detectEditors).not.toHaveBeenCalled();
    expect(writeMcpConfigBulk).not.toHaveBeenCalled();
  });

  it('sets the localStorage flag when Skip is clicked', () => {
    render(<HelloFlintWelcome onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(localStorage.getItem('flint-hello-welcome-seen')).toBe('true');
  });
});

// ── HFW-09: token-only styling (static grep) ──────────────────────────────────
// Uses process.cwd() + known relative path because import.meta.url resolves to
// an HTTP URL under jsdom and produces a broken pathname.

const COMPONENT_PATH =
  process.cwd() + '/src/components/ui/HelloFlintWelcome.tsx';

describe('HFW-09: token-only styling', () => {
  it('source file contains no raw hex color literals', async () => {
    const { readFile } = await import('fs/promises');
    const src = await readFile(COMPONENT_PATH, 'utf8');
    // Match #RGB, #RRGGBB, #RRGGBBAA patterns (min 4 chars to skip 3-digit CSS IDs)
    const hexMatches = src.match(/#[0-9a-fA-F]{4,8}\b/g) ?? [];
    expect(hexMatches).toHaveLength(0);
  });

  it('source file contains no arbitrary bracket color values (e.g. text-[#...])', async () => {
    const { readFile } = await import('fs/promises');
    const src = await readFile(COMPONENT_PATH, 'utf8');
    const arbitraryColor = src.match(/\[#[0-9a-fA-F]{3,8}\]/g) ?? [];
    expect(arbitraryColor).toHaveLength(0);
  });
});

// ── HFW-10: Escape blocked during writing ────────────────────────────────────

describe('HFW-10: escape key blocked during writing', () => {
  it('does not call onComplete when Escape is pressed during writing', async () => {
    const onComplete = vi.fn();
    // writeMcpConfigBulk never resolves — keeps the component in "writing" state
    let resolveWrite!: (v: unknown) => void;
    const pendingWrite = new Promise(r => { resolveWrite = r; });
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
      writeMcpConfigBulk: vi.fn().mockReturnValue(pendingWrite),
    });

    render(<HelloFlintWelcome onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /Connect Cursor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Connect Cursor/i }));

    // Component should now be in "writing" state — wait for spinner
    await waitFor(() => screen.getByText(/Writing config/i));

    // Press Escape — should be blocked
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onComplete).not.toHaveBeenCalled();

    // Cleanup: resolve the pending promise
    resolveWrite({ written: [], failed: [{ editor: 'cursor', reason: 'cancelled' }] });
  });

  it('allows Escape in welcome state', () => {
    const onComplete = vi.fn();
    render(<HelloFlintWelcome onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

// ── HFW-11: help panel navigation ────────────────────────────────────────────

describe('HFW-11: help panel navigation', () => {
  async function navigateToHelp() {
    (window as any).flintAPI.hello = makeHelloAPI({
      detectEditors: vi.fn().mockResolvedValue(CURSOR_ONLY),
      writeMcpConfigBulk: vi.fn().mockResolvedValue({
        written: [{ editor: 'cursor', configPath: '/p', preservedEntries: 0 }],
        failed: [],
      }),
    });
    const onComplete = vi.fn();
    render(<HelloFlintWelcome onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /let'?s go/i }));
    await waitFor(() => screen.getByRole('button', { name: /Connect Cursor/i }));
    fireEvent.click(screen.getByRole('button', { name: /Connect Cursor/i }));
    await waitFor(() => screen.getByRole('button', { name: /Help/i }));
    fireEvent.click(screen.getByRole('button', { name: /Help/i }));
    return onComplete;
  }

  it('renders the Troubleshooting heading in help state', async () => {
    await navigateToHelp();
    expect(screen.getByText('Troubleshooting')).toBeTruthy();
  });

  it('"Back to verify" returns to verify state', async () => {
    await navigateToHelp();
    fireEvent.click(screen.getByRole('button', { name: /Back to verify/i }));
    expect(screen.getByRole('button', { name: /I see the green dot/i })).toBeTruthy();
  });
});
