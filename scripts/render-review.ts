#!/usr/bin/env tsx
/**
 * render-review.ts — Deterministic markdown renderer for `.review.ts` files.
 *
 * Part of the Review Ceremony Cheaper-Pilot (A+B+E). Reviewer agents emit the
 * structured `.review.ts` only; this script renders the human-readable `.md`
 * from that single source of truth. Keeps the evidence library consumable while
 * cutting the agent-written prose in half.
 *
 * Usage:
 *   npx tsx scripts/render-review.ts <input.review.ts>             # writes .md sibling
 *   npx tsx scripts/render-review.ts <input.review.ts> --stdout    # prints to stdout
 *   npx tsx scripts/render-review.ts <input.review.ts> --out <path> # writes to path
 *   npx tsx scripts/render-review.ts <input.review.ts> --check     # render to memory, diff vs existing .md
 *
 * The output matches the conventions established in the Phase 0-2 ceremony:
 * verdict header, findings with evidence blocks, rubric table, scope coverage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  validateReport,
  type ReviewReport,
  type ReviewFinding,
  type RubricItem,
  type Evidence,
  type ReviewDimension,
} from '../shared/review-schema';

// ─── CLI ────────────────────────────────────────────────────────────

interface Args {
  input: string;
  mode: 'write' | 'stdout' | 'check';
  outPath?: string;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  if (args.length === 0) {
    fail('Usage: render-review.ts <input.review.ts> [--stdout | --out <path> | --check]');
  }
  const input = args[0];
  let mode: Args['mode'] = 'write';
  let outPath: string | undefined;
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--stdout') mode = 'stdout';
    else if (a === '--check') mode = 'check';
    else if (a === '--out') {
      outPath = args[++i];
      if (!outPath) fail('--out requires a path argument');
    } else {
      fail(`Unknown argument: ${a}`);
    }
  }
  return { input, mode, outPath };
}

function fail(msg: string): never {
  console.error(`render-review: ${msg}`);
  process.exit(1);
}

// ─── Load ───────────────────────────────────────────────────────────

async function loadReport(inputPath: string): Promise<ReviewReport> {
  const abs = path.resolve(inputPath);
  if (!fs.existsSync(abs)) fail(`Input not found: ${abs}`);
  if (!abs.endsWith('.review.ts')) fail(`Input must end with .review.ts: ${abs}`);
  const mod = await import(pathToFileURL(abs).href);
  const report = mod.REPORT as ReviewReport | undefined;
  if (!report) fail(`Module does not export REPORT: ${abs}`);
  const errors = validateReport(report);
  if (errors.length > 0) {
    fail(`Invalid ReviewReport:\n  - ${errors.join('\n  - ')}`);
  }
  return report;
}

// ─── Render ─────────────────────────────────────────────────────────

const DIMENSION_TITLE: Record<ReviewDimension, string> = {
  ux: 'UX Review',
  code: 'Code Review',
  security: 'Security Review',
  accessibility: 'Accessibility Review',
  performance: 'Performance Review',
};

function renderReport(r: ReviewReport): string {
  const parts: string[] = [];
  parts.push(renderHeader(r));
  parts.push(renderVerdict(r));
  if (r.findings.length > 0) parts.push(renderFindings(r.findings));
  if (r.rubric.length > 0) parts.push(renderRubric(r.rubric));
  parts.push(renderScopeCoverage(r));
  return parts.join('\n\n') + '\n';
}

function renderHeader(r: ReviewReport): string {
  const title = `# ${r.meta.phase} ${DIMENSION_TITLE[r.meta.dimension]}`;
  const scope = r.meta.scope.length > 0 ? r.meta.scope.join('; ') : '(unspecified)';
  return [
    title,
    '',
    `- **Phase:** ${r.meta.phase}`,
    `- **Dimension:** ${r.meta.dimension}`,
    `- **Reviewer:** ${r.meta.reviewer}`,
    `- **Date:** ${r.meta.date}`,
    `- **Round:** ${r.meta.round}`,
    `- **Scope:** ${scope}`,
  ].join('\n');
}

function renderVerdict(r: ReviewReport): string {
  const c = r.counts;
  const summary = `${c.blocking} blocking · ${c.warning} warnings · ${c.suggestion} suggestions`;
  return ['## Verdict', '', `**${r.verdict}** — ${summary}`].join('\n');
}

function renderFindings(findings: ReviewFinding[]): string {
  const blocks: string[] = ['## Findings'];
  for (const f of findings) {
    blocks.push(renderFinding(f));
  }
  return blocks.join('\n\n');
}

function renderFinding(f: ReviewFinding): string {
  const lines: string[] = [];
  lines.push(`### ${f.id} — ${f.title}`);
  lines.push('');
  const meta: string[] = [
    `**Severity:** ${f.severity}`,
    `**Scope:** ${f.scope}`,
    `**Status:** ${f.status}`,
  ];
  if (f.commandment !== undefined) meta.push(`**Commandment:** ${f.commandment}`);
  lines.push(meta.join(' · '));
  lines.push('');
  lines.push('**Evidence:**');
  for (const e of f.evidence) {
    lines.push(renderEvidence(e));
  }
  lines.push('');
  lines.push(`**Observed:** ${f.observed.trim()}`);
  lines.push('');
  lines.push(`**Rationale:** ${f.rationale.trim()}`);
  if (f.proposedFix) {
    lines.push('');
    lines.push(`**Proposed fix:** ${f.proposedFix.trim()}`);
  }
  if (f.resolution) {
    lines.push('');
    lines.push(`**Resolution:** ${f.resolution.trim()}`);
  }
  return lines.join('\n');
}

function renderEvidence(e: Evidence): string {
  const loc = e.line !== undefined ? `\`${e.file}:${e.line}\`` : `\`${e.file}\``;
  const parts: string[] = [`- ${loc}`];
  if (e.note) parts.push(`— ${e.note.trim()}`);
  const firstLine = parts.join(' ');
  if (!e.excerpt) return firstLine;
  const excerptBlock = '  ```\n' + indent(e.excerpt.trim(), '  ') + '\n  ```';
  return `${firstLine}\n${excerptBlock}`;
}

function renderRubric(rubric: RubricItem[]): string {
  const rows: string[] = [
    '## Rubric',
    '',
    '| Criterion | Result | Evidence / Related findings |',
    '|-----------|--------|-----------------------------|',
  ];
  for (const item of rubric) {
    const evidence = item.evidence
      ? escapeTableCell(item.evidence)
      : item.relatedFindings && item.relatedFindings.length > 0
        ? item.relatedFindings.join(', ')
        : '';
    const result =
      item.result === 'pass'
        ? 'pass'
        : item.result === 'fail'
          ? '**fail**'
          : 'n/a';
    rows.push(`| ${escapeTableCell(item.criterion)} | ${result} | ${evidence} |`);
  }
  return rows.join('\n');
}

function renderScopeCoverage(r: ReviewReport): string {
  const lines: string[] = ['## Scope Coverage', ''];
  lines.push('**Reviewed:**');
  for (const f of r.scopeCoverage.reviewed) lines.push(`- ${f}`);
  if (r.scopeCoverage.skipped.length > 0) {
    lines.push('');
    lines.push('**Skipped:**');
    for (const s of r.scopeCoverage.skipped) lines.push(`- ${s}`);
  }
  return lines.join('\n');
}

// ─── Utilities ──────────────────────────────────────────────────────

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map(line => prefix + line)
    .join('\n');
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function deriveOutputPath(inputPath: string): string {
  return path.resolve(inputPath).replace(/\.review\.ts$/, '.md');
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const report = await loadReport(args.input);
  const rendered = renderReport(report);

  if (args.mode === 'stdout') {
    process.stdout.write(rendered);
    return;
  }

  if (args.mode === 'check') {
    const existing = deriveOutputPath(args.input);
    if (!fs.existsSync(existing)) {
      console.error(`check: no existing .md at ${existing}`);
      process.exit(2);
    }
    const existingText = fs.readFileSync(existing, 'utf8');
    const renderedLen = rendered.split('\n').length;
    const existingLen = existingText.split('\n').length;
    console.log(`rendered:   ${rendered.length} bytes / ${renderedLen} lines`);
    console.log(`existing:   ${existingText.length} bytes / ${existingLen} lines`);
    console.log(`verdict:    ${report.verdict}`);
    console.log(`findings:   ${report.findings.length}`);
    console.log(`rubric:     ${report.rubric.length}`);
    console.log(
      `reviewed:   ${report.scopeCoverage.reviewed.length} files, skipped ${report.scopeCoverage.skipped.length}`,
    );
    return;
  }

  const outPath = args.outPath ?? deriveOutputPath(args.input);
  fs.writeFileSync(outPath, rendered, 'utf8');
  console.log(`wrote ${outPath} (${rendered.length} bytes)`);
}

main().catch(err => {
  console.error('render-review failed:', err);
  process.exit(1);
});
