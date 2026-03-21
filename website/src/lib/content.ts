// All copy and data in one place. Section components read from here.

export const hero = {
  headline: 'The type checker for design systems',
  subhead:
    'AI writes your UI. Flint makes sure it matches your design system, passes accessibility, and ships clean. Deterministic enforcement at the AST level.',
  cta: { primary: 'Get Early Access', secondary: 'See How It Works' },
  badges: ['MCP Native', 'React + Vue + HTML', 'WCAG 2.1 AA', 'CI/CD Gate'],
  proof:
    'Compatible with 6,400+ MCP tools across Claude Code, Cursor, VS Code, and Windsurf',
};

export const problem = {
  title: 'Three crises. One missing layer.',
  sections: [
    {
      label: 'The AI Code Flood',
      stats: [
        {
          value: '41%',
          desc: 'of all code is AI-generated today',
          headline: true,
        },
        {
          value: '100%',
          desc: 'of code at Anthropic & OpenAI is AI-written',
          headline: false,
        },
        {
          value: '90%',
          desc: 'projected for everyone else by early 2027',
          headline: false,
        },
        {
          value: '48%',
          desc: 'of AI-generated code has security vulnerabilities',
          headline: false,
        },
      ],
      sources: ['Fortune', 'GitHub', 'Second Talent'],
    },
    {
      label: 'The Compliance Cliff',
      stats: [
        {
          value: '5,114',
          desc: 'ADA lawsuits filed in 2025',
          headline: true,
        },
        {
          value: '5,500+',
          desc: 'projected for 2026',
          headline: false,
        },
        {
          value: '\u20ac3M',
          desc: 'maximum EU Accessibility Act fines',
          headline: false,
        },
        {
          value: '+40%',
          desc: 'pro se filings\u2009\u2014\u2009AI now drafts the complaints too',
          headline: false,
        },
      ],
      sources: ['UsableNet', 'BeAccessible', 'Accessible.org'],
    },
    {
      label: 'The Design System Gap',
      stats: [
        {
          value: '80%',
          desc: 'of enterprises have design systems',
          headline: true,
        },
        {
          value: '30%',
          desc: 'sustain compliance after 18 months',
          headline: false,
        },
        {
          value: '50pt',
          desc: 'gap between existence and enforcement',
          headline: false,
        },
        {
          value: '20\u201340%',
          desc: 'overhead from design inconsistency',
          headline: false,
        },
      ],
      sources: [],
    },
  ],
};

export const coreJobs = {
  title: 'What Flint does',
  jobs: [
    {
      name: 'Accelerate',
      hook: 'AI writes code at 10\u00d7 speed.',
      desc: 'Flint sits inside the generation loop\u2009\u2014\u2009not after it. Your AI agent writes, Flint validates, in the same tool call. No slowdown. No second pass.',
    },
    {
      name: 'Protect',
      hook: 'Catches what humans miss.',
      desc: 'A color 5 \u0394E off-brand. A missing aria-label. A hardcoded hex instead of a token. Perceptual color science and AST analysis find violations humans would ship.',
    },
    {
      name: 'Recover',
      hook: 'One click to undo the mistake.',
      desc: 'Surgical AST-level recovery. Transplant a single node from any point in Git history. Not \u201Crevert the whole file\u201D\u2009\u2014\u2009revert the exact line the AI broke.',
    },
  ],
};

export const howItWorks = {
  title: 'The quality loop',
  subtitle:
    'AI writes a component. It looks fine. Flint sees what humans can\u2019t.',
  before: {
    code: `<Button\n  className="bg-[#3B82F6]"\n  onClick={handleSubmit}\n>\n  Submit\n</Button>`,
    violations: [
      {
        line: 1,
        label: 'color-drift',
        detail: '#3B82F6 is not a design token',
        rule: 'MITH-001',
      },
      {
        line: 1,
        label: 'a11y',
        detail: 'Missing aria-label for icon-adjacent button',
        rule: 'A11Y-002',
      },
      {
        line: 1,
        label: 'hardcoded',
        detail: 'Inline style instead of token class',
        rule: 'MITH-003',
      },
    ],
    color: { hex: '#3B82F6', label: 'AI output' },
    deltaE: 5.2,
  },
  after: {
    code: `<Button\n  className="bg-brand-blue"\n  onClick={handleSubmit}\n  aria-label="Submit form"\n>\n  Submit\n</Button>`,
    fixes: [
      {
        line: 1,
        label: 'Snapped to token',
        detail: 'bg-brand-blue (design token)',
        rule: 'MITH-001',
      },
      {
        line: 3,
        label: 'Injected',
        detail: 'aria-label added via AST',
        rule: 'A11Y-002',
      },
    ],
    color: { hex: '#2563EB', label: 'brand-blue token' },
    deltaE: 0.3,
  },
  caption:
    'CIEDE2000 \u0394E measures perceptual color distance. Above 2.0 = visible drift. Flint auto-fixes to the nearest design token.',
};

export const twoProducts = {
  title: 'Two products. One engine.',
  products: [
    {
      name: 'Flint MCP',
      role: 'Headless governance engine',
      desc: 'Runs everywhere AI writes code. 33 tools, 9 resources, 3 prompts over MCP protocol. React, Vue, HTML, SwiftUI, and Compose. Drops into Claude Code, Cursor, VS Code, Windsurf, or any CI/CD pipeline.',
      highlights: [
        'Multi-framework: React, Vue, HTML, SwiftUI, Compose',
        '6 governance domains: healthcare, fintech, government, e-commerce, enterprise, general',
        'SARIF 2.1.0 output for GitHub, GitLab, Azure DevOps',
        'Agent-native: AI audits and fixes in the generation loop',
      ],
    },
    {
      name: 'Flint Glass',
      role: 'Visual observatory',
      desc: 'See your entire design system\u2019s health at a glance. Infinite canvas with live preview. Governance overlays, design debt scores, and Git Time Machine for surgical recovery.',
      highlights: [
        'Infinite canvas with spatial governance overlays',
        'Health dashboard: score 0\u2013100, grade A\u2013F',
        'Git Time Machine: surgical node-level recovery',
        'Reads MCP state\u2009\u2014\u2009owns zero business logic',
      ],
    },
  ],
};

export const competitive = {
  title: 'No competitor covers all seven.',
  subtitle:
    'The AI code generation market hits $30.1B by 2032. The quality layer doesn\u2019t exist yet.',
  columns: [
    'Token Gov',
    'AST Gov',
    'WCAG Gate',
    'Figma Sync',
    'MCP Native',
    'Deterministic',
    'Color Science',
  ],
  rows: [
    {
      tool: 'Flint',
      cells: ['Full', 'Full', 'Yes', 'Full', 'Yes', 'Yes', 'CIEDE2000'],
      highlight: true,
    },
    {
      tool: 'Knapsack',
      cells: ['Docs', 'None', 'No', 'Docs', 'No', 'N/A', 'None'],
      highlight: false,
    },
    {
      tool: 'Supernova',
      cells: ['Files', 'None', 'No', 'Import', 'No', 'N/A', 'None'],
      highlight: false,
    },
    {
      tool: 'Specify',
      cells: ['Files', 'None', 'No', 'Import', 'No', 'N/A', 'None'],
      highlight: false,
    },
    {
      tool: 'Chromatic',
      cells: ['None', 'None', 'No', 'None', 'No', 'N/A', 'Pixel diff'],
      highlight: false,
    },
    {
      tool: 'Figma Dev Mode',
      cells: ['Ref', 'None', 'No', 'Read', 'No', 'N/A', 'None'],
      highlight: false,
    },
    {
      tool: 'SonarQube',
      cells: ['None', 'Generic', 'No', 'None', 'No', 'Yes', 'None'],
      highlight: false,
    },
    {
      tool: 'Snyk Code',
      cells: ['None', 'Security', 'No', 'None', 'No', 'Yes', 'None'],
      highlight: false,
    },
    {
      tool: 'axe-core',
      cells: ['None', 'DOM', 'Post-render', 'None', 'No', 'Yes', 'None'],
      highlight: false,
    },
    {
      tool: 'Anima / Locofy',
      cells: ['None', 'None', 'No', 'Yes', 'No', 'N/A', 'None'],
      highlight: false,
    },
    {
      tool: 'v0',
      cells: ['None', 'None', 'No', 'None', 'No', 'N/A', 'None'],
      highlight: false,
    },
  ],
  differentiators: [
    {
      title: 'Deterministic, not probabilistic',
      desc: 'LLM-based code review gives different answers each time. Flint gives the same answer every time\u2009\u2014\u2009required for compliance.',
    },
    {
      title: 'Shift-left beyond CI/CD',
      desc: 'axe-core checks after rendering. SonarQube checks after writing. Flint checks during AI generation\u2009\u2014\u2009inside the MCP tool call layer.',
    },
    {
      title: 'Perceptual color science',
      desc: 'CIEDE2000 distinguishes a brand violation (\u0394E=5.0) from an imperceptible rounding error (\u0394E=0.3). No competitor does this.',
    },
    {
      title: 'MCP-native distribution',
      desc: 'One server = every MCP-compatible AI tool. Claude Code, Cursor, VS Code, Windsurf. No plugins to install.',
    },
    {
      title: 'The Snyk model, applied to design',
      desc: 'Snyk proved deterministic AST scanning + CI/CD blocking = $8.5B business. Flint applies the identical pattern to design systems and accessibility.',
    },
  ],
};

export const useCases = {
  title: 'Built for every team that ships UI',
  audiences: [
    {
      label: 'Design Teams',
      points: [
        'Enforce your design system automatically\u2009\u2014\u2009not through Slack and code reviews',
        'Know compliance posture at all times with the Health Dashboard',
        'Import from Figma; Flint validates token compliance immediately',
        'Design debt is the next technical debt\u2009\u2014\u2009Flint makes it visible and measurable',
      ],
    },
    {
      label: 'Engineering',
      points: [
        '5-minute CI/CD integration: add flint audit to your pipeline',
        'SARIF 2.1.0 output integrates with GitHub, GitLab, Azure DevOps',
        'AI agents auto-audit and auto-fix without human intervention',
        'Surgical undo: revert a single AST node, not the whole file',
      ],
    },
    {
      label: 'Enterprise',
      points: [
        'Deterministic audit trail: every mutation logged in the provenance ledger',
        'Domain-specific compliance: HIPAA, PCI-DSS, Section 508, SOC 2, WCAG AAA',
        'WCAG 2.1 AA gate\u2009\u2014\u2009accessibility violations block export',
        'ADA defense + EU Accessibility Act readiness',
      ],
    },
    {
      label: 'AI-First Orgs',
      points: [
        'The quality layer every AI coding tool needs but doesn\u2019t have',
        'MCP-native: works inside the agent loop, not bolted on after',
        'Every dollar invested in Cursor, Copilot, and v0 increases the need for Flint',
        'Scales with AI code volume\u2009\u2014\u2009more AI means more value',
      ],
    },
  ],
};

export const domains = {
  title: 'One engine. Every regulated domain.',
  current: [
    {
      domain: 'React, Vue, iOS (SwiftUI), Android (Compose), HTML',
      status: 'Shipping',
    },
    { domain: 'Design System Compliance', status: 'Shipping' },
    { domain: 'Accessibility (WCAG 2.1 AA \u2014 50 rules)', status: 'Shipping' },
    { domain: 'Figma-to-Code (JSX, TSX, Vue output)', status: 'Shipping' },
    { domain: 'Design Debt Management', status: 'Shipping' },
    {
      domain:
        'Domain Governance (Healthcare, Fintech, Government, E-commerce, Enterprise SaaS)',
      status: 'Shipping',
    },
  ],
  roadmap: [
    {
      domain: 'Infrastructure as Code',
      profile: 'SOC 2 policy violations',
    },
    {
      domain: 'Multi-Brand Theming',
      profile: 'Validate one codebase under N brand tokens',
    },
    {
      domain: 'Cross-Platform Token Sync',
      profile: 'React Native, Swift, Kotlin, CSS custom properties',
    },
    {
      domain: 'Bidirectional Figma Sync',
      profile: 'Three-way diff engine with conflict resolution',
    },
  ],
};

export const trust = {
  title: 'Not a prototype.',
  subtitle:
    'Flint is built, tested, and shipping. Every module is production-ready.',
  metrics: [
    {
      value: '80+',
      label: 'Production modules',
      detail: 'All status: ONLINE',
    },
    {
      value: '33',
      label: 'MCP tools',
      detail: 'Headless governance engine',
    },
    {
      value: '50',
      label: 'WCAG 2.1 AA rules',
      detail: 'Deterministic AST-level checks',
    },
    {
      value: '9',
      label: 'MCP resources',
      detail: 'Live observability endpoints',
    },
    {
      value: '5',
      label: 'UI frameworks',
      detail: 'React, Vue, HTML, SwiftUI, Compose',
    },
    {
      value: '6',
      label: 'Governance domains',
      detail:
        'Healthcare, fintech, government, e-commerce, enterprise, general',
    },
  ],
};

export const faq = {
  title: 'Questions we hear',
  items: [
    {
      q: 'Can\u2019t ESLint do this?',
      a: 'ESLint can\u2019t calculate CIEDE2000 color distance, traverse JSX design-token semantics, or participate in MCP agent loops. It\u2019s the difference between a spell-checker and a legal contract reviewer.',
    },
    {
      q: 'Won\u2019t Figma or Vercel just build it?',
      a: 'Figma optimizes for keeping designers in Figma. Vercel optimizes for deployment speed. Neither has incentive to build a neutral governance layer that works across all tools\u2009\u2014\u2009that\u2019s structurally impossible for a single-platform vendor.',
    },
    {
      q: 'Is this market big enough?',
      a: 'Design governance alone is ~$500M. But Flint\u2019s parser-agnostic rule engine extends to IaC security, HIPAA UI, Section 508, and PCI DSS. The real market is deterministic quality enforcement for all AI-generated code.',
    },
    {
      q: '92% of developers already use AI tools. Isn\u2019t this already solved?',
      a: '92% of developers use AI to write code. Nobody is checking whether that code matches the design system, passes accessibility, or preserves brand integrity. Generation is solved. Quality is not.',
    },
  ],
};

export const gettingStarted = {
  title: 'Five minutes to quality enforcement',
  paths: [
    {
      label: 'CI/CD Gate',
      tag: 'Fastest',
      code: `npm install flint-mcp\nnpx flint-mcp audit "src/**/*.tsx"`,
      desc: 'Add to GitHub Actions. Done. Design governance in your pipeline.',
    },
    {
      label: 'MCP Agent',
      tag: 'AI-native',
      code: `// ~/.claude/mcp.json\n{\n  "mcpServers": {\n    "flint": {\n      "command": "node",\n      "args": ["flint-mcp/dist/server.js"]\n    }\n  }\n}`,
      desc: 'Your AI agent audits, fixes, and reports compliance automatically.',
    },
    {
      label: 'Flint Glass',
      tag: 'Visual',
      code: `npm install && npm run dev`,
      desc: 'Infinite canvas with governance overlays, health scores, and Git Time Machine.',
    },
  ],
};

export const emailCapture = {
  headline: 'Ship AI-generated code you can trust',
  subhead: 'Join the waitlist for early access.',
  placeholder: 'you@company.com',
  cta: 'Get Early Access',
  note: 'No spam. One email when we launch.',
};

export const footer = {
  tagline: 'AI generates code. Flint governs it.',
  links: [
    { label: 'GitHub', href: '#' },
    { label: 'Documentation', href: '#' },
    { label: 'MCP Registry', href: '#' },
  ],
  copyright: `\u00a9 ${new Date().getFullYear()} Flint`,
};
