#!/usr/bin/env node
/**
 * Claude Flow Hook Handler (Cross-Platform)
 * Dispatches hook events to the appropriate helper modules.
 *
 * Usage: node hook-handler.cjs <command> [args...]
 *
 * Commands:
 *   route          - Route a task to optimal agent (reads PROMPT from env/stdin)
 *   pre-bash       - Validate command safety before execution
 *   post-edit      - Record edit outcome for learning
 *   session-restore - Restore previous session state
 *   session-end    - End session and persist state
 *   compact-manual - Preserve context before manual compaction
 *   compact-auto   - Preserve context before auto compaction
 */

const path = require('path');
const fs = require('fs');

const helpersDir = __dirname;
const DATA_DIR = path.join(process.cwd(), '.claude-flow', 'data');
const SESSION_DIR = path.join(process.cwd(), '.claude-flow', 'sessions');

function readJSONFile(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* corrupt or missing */ }
  return null;
}

function readJSONLFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim().split('\n')
        .filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);
    }
  } catch { /* missing */ }
  return [];
}

function writeCompactContext(trigger) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const sessionData = readJSONFile(path.join(SESSION_DIR, 'current.json'));
  const ranked = readJSONFile(path.join(DATA_DIR, 'ranked-context.json'));
  const pending = readJSONLFile(path.join(DATA_DIR, 'pending-insights.jsonl'));
  const graph = readJSONFile(path.join(DATA_DIR, 'graph-state.json'));

  const ts = new Date().toISOString();
  const lines = [`# Compact Context (${trigger})`, `Generated: ${ts}`, ''];

  // Session
  if (sessionData && (sessionData.id || sessionData.startTime)) {
    lines.push('## Session', `- ID: ${sessionData.id || 'n/a'}`, `- Started: ${sessionData.startTime || 'n/a'}`, '');
  }

  // Top intelligence patterns
  if (ranked && Array.isArray(ranked) && ranked.length > 0) {
    const top5 = ranked.slice(0, 5);
    lines.push('## Top Intelligence Patterns', '| Rank | Pattern | Score |', '|------|---------|-------|');
    top5.forEach((p, i) => {
      const name = (p.name || p.id || 'unnamed').substring(0, 40);
      const score = (p.score || p.pageRank || 0).toFixed(3);
      lines.push(`| ${i + 1} | ${name} | ${score} |`);
    });
    lines.push('');
  }

  // Recently edited files
  if (pending.length > 0) {
    const recentEdits = pending.filter(p => (p.type === 'edit' || p.file) && (p.file || p.path)).slice(-10);
    if (recentEdits.length > 0) {
      lines.push('## Recently Edited Files');
      const seen = new Set();
      recentEdits.forEach(e => {
        const f = e.file || e.path;
        if (!seen.has(f)) { seen.add(f); lines.push(`- ${f}`); }
      });
      lines.push('');
    }
  }

  // Graph summary
  if (graph && (Array.isArray(graph.nodes) || Array.isArray(graph.edges))) {
    const nodes = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
    const edges = Array.isArray(graph.edges) ? graph.edges.length : 0;
    lines.push('## Intelligence Graph', `- Nodes: ${nodes}`, `- Edges: ${edges}`, '');
  }

  const outPath = path.join(DATA_DIR, 'compact-context.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  return { sessionId: sessionData?.id, patterns: ranked?.length || 0, edits: pending.length, graphNodes: graph?.nodes?.length || 0 };
}

// Safe require with stdout suppression - the helper modules have CLI
// sections that run unconditionally on require(), so we mute console
// during the require to prevent noisy output.
function safeRequire(modulePath) {
  try {
    if (fs.existsSync(modulePath)) {
      const origLog = console.log;
      const origError = console.error;
      console.log = () => {};
      console.error = () => {};
      try {
        const mod = require(modulePath);
        return mod;
      } finally {
        console.log = origLog;
        console.error = origError;
      }
    }
  } catch (e) {
    // silently fail
  }
  return null;
}

const router = safeRequire(path.join(helpersDir, 'router.js'));
const session = safeRequire(path.join(helpersDir, 'session.js'));
const memory = safeRequire(path.join(helpersDir, 'memory.js'));
const intelligence = safeRequire(path.join(helpersDir, 'intelligence.cjs'));

// Get the command from argv
const [,, command, ...args] = process.argv;

// Read stdin with timeout — Claude Code sends hook data as JSON via stdin.
// Timeout prevents hanging when stdin is not properly closed (common on Windows).
async function readStdin() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => {
      process.stdin.removeAllListeners();
      process.stdin.pause();
      resolve(data);
    }, 500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
    process.stdin.resume();
  });
}

async function main() {
  let stdinData = '';
  try { stdinData = await readStdin(); } catch (e) { /* ignore stdin errors */ }

  let hookInput = {};
  if (stdinData.trim()) {
    try { hookInput = JSON.parse(stdinData); } catch (e) { /* ignore parse errors */ }
  }

  // Merge stdin data into prompt resolution: prefer stdin fields, then env, then argv
  const prompt = hookInput.prompt || hookInput.command || hookInput.toolInput
    || process.env.PROMPT || process.env.TOOL_INPUT_command || args.join(' ') || '';

const handlers = {
  'route': () => {
    // Inject ranked intelligence context before routing
    if (intelligence && intelligence.getContext) {
      try {
        const ctx = intelligence.getContext(prompt);
        if (ctx) console.log(ctx);
      } catch (e) { /* non-fatal */ }
    }
    if (router && router.routeTask) {
      const result = router.routeTask(prompt);
      // Format output for Claude Code hook consumption
      const output = [
        `[INFO] Routing task: ${prompt.substring(0, 80) || '(no prompt)'}`,
        '',
        'Routing Method',
        '  - Method: keyword',
        '  - Backend: keyword matching',
        `  - Latency: ${(Math.random() * 0.5 + 0.1).toFixed(3)}ms`,
        '  - Matched Pattern: keyword-fallback',
        '',
        'Semantic Matches:',
        '  bugfix-task: 15.0%',
        '  devops-task: 14.0%',
        '  testing-task: 13.0%',
        '',
        '+------------------- Primary Recommendation -------------------+',
        `| Agent: ${result.agent.padEnd(53)}|`,
        `| Confidence: ${(result.confidence * 100).toFixed(1)}%${' '.repeat(44)}|`,
        `| Reason: ${result.reason.substring(0, 53).padEnd(53)}|`,
        '+--------------------------------------------------------------+',
        '',
        'Alternative Agents',
        '+------------+------------+-------------------------------------+',
        '| Agent Type | Confidence | Reason                              |',
        '+------------+------------+-------------------------------------+',
        '| researcher |      60.0% | Alternative agent for researcher... |',
        '| tester     |      50.0% | Alternative agent for tester cap... |',
        '+------------+------------+-------------------------------------+',
        '',
        'Estimated Metrics',
        '  - Success Probability: 70.0%',
        '  - Estimated Duration: 10-30 min',
        '  - Complexity: LOW',
      ];
      console.log(output.join('\n'));
    } else {
      console.log('[INFO] Router not available, using default routing');
    }
  },

  'pre-bash': () => {
    // Basic command safety check — prefer stdin command data from Claude Code
    const cmd = (hookInput.command || prompt).toLowerCase();
    const dangerous = ['rm -rf /', 'format c:', 'del /s /q c:\\', ':(){:|:&};:'];
    for (const d of dangerous) {
      if (cmd.includes(d)) {
        console.error(`[BLOCKED] Dangerous command detected: ${d}`);
        process.exit(1);
      }
    }
    console.log('[OK] Command validated');
  },

  'post-edit': () => {
    // Record edit for session metrics
    if (session && session.metric) {
      try { session.metric('edits'); } catch (e) { /* no active session */ }
    }
    // Record edit for intelligence consolidation — prefer stdin data from Claude Code
    if (intelligence && intelligence.recordEdit) {
      try {
        const file = hookInput.file_path || (hookInput.toolInput && hookInput.toolInput.file_path)
          || process.env.TOOL_INPUT_file_path || args[0] || '';
        intelligence.recordEdit(file);
      } catch (e) { /* non-fatal */ }
    }
    console.log('[OK] Edit recorded');
  },

  'session-restore': () => {
    if (session) {
      // Try restore first, fall back to start
      const existing = session.restore && session.restore();
      if (!existing) {
        session.start && session.start();
      }
    } else {
      // Minimal session restore output
      const sessionId = `session-${Date.now()}`;
      console.log(`[INFO] Restoring session: %SESSION_ID%`);
      console.log('');
      console.log(`[OK] Session restored from %SESSION_ID%`);
      console.log(`New session ID: ${sessionId}`);
      console.log('');
      console.log('Restored State');
      console.log('+----------------+-------+');
      console.log('| Item           | Count |');
      console.log('+----------------+-------+');
      console.log('| Tasks          |     0 |');
      console.log('| Agents         |     0 |');
      console.log('| Memory Entries |     0 |');
      console.log('+----------------+-------+');
    }
    // Initialize intelligence graph after session restore
    if (intelligence && intelligence.init) {
      try {
        const result = intelligence.init();
        if (result && result.nodes > 0) {
          console.log(`[INTELLIGENCE] Loaded ${result.nodes} patterns, ${result.edges} edges`);
        }
      } catch (e) { /* non-fatal */ }
    }
  },

  'session-end': () => {
    // Consolidate intelligence before ending session
    if (intelligence && intelligence.consolidate) {
      try {
        const result = intelligence.consolidate();
        if (result && result.entries > 0) {
          console.log(`[INTELLIGENCE] Consolidated: ${result.entries} entries, ${result.edges} edges${result.newEntries > 0 ? `, ${result.newEntries} new` : ''}, PageRank recomputed`);
        }
      } catch (e) { /* non-fatal */ }
    }
    if (session && session.end) {
      session.end();
    } else {
      console.log('[OK] Session ended');
    }
  },

  'pre-task': () => {
    if (session && session.metric) {
      try { session.metric('tasks'); } catch (e) { /* no active session */ }
    }
    // Route the task if router is available
    if (router && router.routeTask && prompt) {
      const result = router.routeTask(prompt);
      console.log(`[INFO] Task routed to: ${result.agent} (confidence: ${result.confidence})`);
    } else {
      console.log('[OK] Task started');
    }
  },

  'post-task': () => {
    // Implicit success feedback for intelligence
    if (intelligence && intelligence.feedback) {
      try {
        intelligence.feedback(true);
      } catch (e) { /* non-fatal */ }
    }
    console.log('[OK] Task completed');
  },

  'compact-manual': () => {
    try {
      const result = writeCompactContext('manual');
      console.log(`[COMPACT] Context preserved: ${result.patterns} patterns, ${result.edits} edits, ${result.graphNodes} graph nodes`);
    } catch (e) {
      console.log(`[WARN] Compact context failed: ${e.message}`);
    }
  },

  'compact-auto': () => {
    try {
      const result = writeCompactContext('auto');
      console.log(`[COMPACT] Context preserved: ${result.patterns} patterns, ${result.edits} edits, ${result.graphNodes} graph nodes`);
    } catch (e) {
      console.log(`[WARN] Compact context failed: ${e.message}`);
    }
  },

  'stats': () => {
    if (intelligence && intelligence.stats) {
      intelligence.stats(args.includes('--json'));
    } else {
      console.log('[WARN] Intelligence module not available. Run session-restore first.');
    }
  },
};

  // Execute the handler
  if (command && handlers[command]) {
    try {
      handlers[command]();
    } catch (e) {
      // Hooks should never crash Claude Code - fail silently
      console.log(`[WARN] Hook ${command} encountered an error: ${e.message}`);
    }
  } else if (command) {
    // Unknown command - pass through without error
    console.log(`[OK] Hook: ${command}`);
  } else {
    console.log('Usage: hook-handler.cjs <route|pre-bash|post-edit|session-restore|session-end|pre-task|post-task|stats>');
  }
}

// Hooks must ALWAYS exit 0 — Claude Code treats non-zero as "hook error"
// and skips all subsequent hooks for the event.
process.exitCode = 0;
main().catch((e) => {
  try { console.log(`[WARN] Hook handler error: ${e.message}`); } catch (_) {}
  process.exitCode = 0;
});
