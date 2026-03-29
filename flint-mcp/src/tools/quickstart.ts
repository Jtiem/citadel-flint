/**
 * flint_quickstart tool handler — flint-mcp/src/tools/quickstart.ts
 *
 * Scaffolds a demo component with intentional design violations, audits it,
 * and returns formatted results. Gives MCP-only users their first value moment.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { FlintConfig } from '../core/config.js'
import { handleFlintAudit } from './audit.js'

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const FLINT_QUICKSTART_TOOL = {
    name: 'flint_quickstart',
    description:
        "Scaffold a demo component with design violations, audit it, and show Flint's governance results. Perfect for first-time users.",
    inputSchema: {
        type: 'object' as const,
        properties: {
            outputDir: {
                type: 'string',
                description:
                    'Directory to write demo files into. Defaults to current working directory.',
            },
        },
        required: [] as string[],
    },
}

// ---------------------------------------------------------------------------
// Demo file content
// ---------------------------------------------------------------------------

const DEMO_COMPONENT = `import React from 'react';

/**
 * FlintDemo — intentional violations for Flint quickstart demo.
 *
 * Violations:
 *   1. <img> without alt attribute (Warden A11Y-001)
 *   2. <button> with icon only and no accessible name (Warden A11Y-002)
 *   3. <input> without aria-label or associated label (Warden A11Y-004)
 *   4. Hardcoded hex #1d4ed8 inline style — use a design token instead (Mithril)
 */
export function FlintDemo() {
  return (
    <div className="p-4" data-flint-id="demo-root">
      {/* Violation 1: img missing alt attribute */}
      <img src="/logo.png" width={120} height={40} />

      {/* Violation 2: icon-only button with no accessible name */}
      <button>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {/* Violation 3: input without programmatic label */}
      <input type="text" placeholder="Enter your name" />

      {/* Violation 4: hardcoded color instead of design token */}
      <button
        data-flint-id="demo-submit"
        style={{ backgroundColor: '#1d4ed8', color: 'white', padding: '8px 16px' }}
      >
        Submit
      </button>
    </div>
  );
}
`

const DEMO_TOKENS = JSON.stringify(
    {
        color: {
            brand: { primary: { $value: '#005B94', $type: 'color' } },
            feedback: { error: { $value: '#C41E1E', $type: 'color' } },
        },
    },
    null,
    2,
)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleFlintQuickstart(
    { outputDir }: { outputDir?: string },
    config: FlintConfig,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    // 1. Resolve output directory
    const resolvedDir = outputDir ?? config.projectRoot ?? process.cwd()

    if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true })
    }

    // 2. Write demo files
    const demoFilePath = path.join(resolvedDir, 'FlintDemo.tsx')
    const tokensFilePath = path.join(resolvedDir, 'design-tokens.json')

    fs.writeFileSync(demoFilePath, DEMO_COMPONENT, 'utf-8')
    fs.writeFileSync(tokensFilePath, DEMO_TOKENS, 'utf-8')

    // 3. Build a config that points tokens to the demo dir so Mithril can load them
    const auditConfig: FlintConfig = {
        ...config,
        projectRoot: resolvedDir,
    }

    // 4. Run audit on the scaffolded file
    let auditResult
    try {
        auditResult = await handleFlintAudit(
            { source: DEMO_COMPONENT, filePath: 'FlintDemo.tsx' },
            auditConfig,
        )
    } catch (err) {
        // Audit failure should not prevent us from returning a useful response
        const errMsg = err instanceof Error ? err.message : String(err)
        return {
            content: [
                {
                    type: 'text',
                    text: [
                        '## Flint Quickstart',
                        '',
                        `Files written to: \`${resolvedDir}\``,
                        `- \`FlintDemo.tsx\` — demo component with intentional violations`,
                        `- \`design-tokens.json\` — minimal token palette`,
                        '',
                        `> Audit could not run: ${errMsg}`,
                        '',
                        '**Next step:** Run `flint_audit` on `FlintDemo.tsx` to see violations.',
                    ].join('\n'),
                },
            ],
        }
    }

    const violations = auditResult.violations ?? []
    const mithrilCount = auditResult.mithrilCount ?? 0
    const a11yCount = auditResult.a11yCount ?? 0
    const totalCount = violations.length

    // 5. Format output
    const violationLines = violations.map((v, i) => {
        const loc = v.line ? ` (line ${v.line})` : ''
        return `${i + 1}. **[${v.ruleId}]** ${v.message}${loc} — _${v.severity}_`
    })

    const text = [
        '## Flint Quickstart',
        '',
        `Files written to \`${resolvedDir}\`:`,
        `- \`FlintDemo.tsx\` — demo component with ${totalCount} intentional violations`,
        `- \`design-tokens.json\` — minimal token palette (brand.primary, feedback.error)`,
        '',
        `### Audit Results: ${totalCount} violation${totalCount === 1 ? '' : 's'} found`,
        '',
        `| Type | Count |`,
        `|------|-------|`,
        `| Mithril (design token drift) | ${mithrilCount} |`,
        `| Warden (accessibility) | ${a11yCount} |`,
        '',
        ...(violationLines.length > 0
            ? ['### Violations', '', ...violationLines, '']
            : []),
        '### Next Step',
        '',
        'Run `flint_fix` on `FlintDemo.tsx` to auto-remediate all violations.',
    ].join('\n')

    return {
        content: [{ type: 'text', text }],
    }
}
