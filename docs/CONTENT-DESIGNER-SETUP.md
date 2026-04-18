# Content Designer Setup Guide

> **Welcome to Flint.** This guide gets you productive in under 15 minutes.

---

## Step 1: Install Cursor (Your IDE)

**Cursor** is the recommended IDE for content work. It's a visual code editor with built-in AI chat, file browsing, and MCP tool support.

1. Download Cursor: [https://cursor.sh](https://cursor.sh)
2. Install and open it
3. Sign in (free tier works)

### Why Cursor?
- Visual file browser (no terminal required)
- Built-in AI chat sidebar — ask questions about the codebase
- Native MCP support — Flint's governance tools work directly in chat
- Agent mode — can run multi-step content workflows
- Markdown preview — see your content rendered as you write

---

## Step 2: Clone the Repository

Open Cursor's terminal (`` Ctrl+` `` or `` Cmd+` ``) and run:

```bash
git clone <repository-url>
```

Then open the cloned folder in Cursor: **File → Open Folder → select the repository**

---

## Step 3: Install Dependencies (One Time)

In the terminal:

```bash
npm install
cd flint-mcp && npm install && cd ..
```

This installs everything Flint needs. You only do this once.

---

## Step 4: Connect Flint MCP (AI Governance Tools)

The repository includes a `.mcp.json` file that Cursor reads automatically. Check that it's working:

1. Open Cursor Settings → MCP
2. You should see `flint` listed as a server
3. If it shows "connected," you're good

If it's not auto-detected, add this to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "flint": {
      "command": "npx",
      "args": ["tsx", "flint-mcp/src/server.ts"]
    }
  }
}
```

### What MCP gives you

With MCP connected, you can ask the AI in chat things like:
- "Show me Flint's current health score" → pulls live data
- "What rule packs does Flint have?" → lists real governance rules
- "Run a quick demo audit" → scaffolds a component and audits it live
- "What's the compliance coverage for WCAG?" → real coverage data

This makes your content **specific and credible** — you can reference live product data, not just marketing claims.

---

## Step 5: Read the Content System

Your content work is powered by these files. Read them in this order:

### Must-Read (First Day)

| Priority | File | What it gives you |
|----------|------|------------------|
| 🔴 **1** | [`docs/CONTENT-QUICK-REF.md`](docs/CONTENT-QUICK-REF.md) | One-page cheat sheet — positioning, elevator pitch, stats, analogies |
| 🔴 **2** | [`docs/strategy/CONTENT-BIBLE.md`](docs/strategy/CONTENT-BIBLE.md) | Voice & tone, messaging hierarchy, audience messaging, competitive positioning, vocabulary |
| 🔴 **3** | [`docs/FLINT-PRODUCT-NARRATIVE.md`](docs/FLINT-PRODUCT-NARRATIVE.md) | The non-technical "what and why" — great for understanding the story |

### Read This Week

| Priority | File | What it gives you |
|----------|------|------------------|
| 🟡 **4** | [`docs/strategy/INVESTOR-BRIEF-2026.md`](docs/strategy/INVESTOR-BRIEF-2026.md) | Market data, 5 headline narratives, competitive matrix, pitch arc |
| 🟡 **5** | [`docs/strategy/GO-TO-MARKET-PLAN.md`](docs/strategy/GO-TO-MARKET-PLAN.md) | Positioning per audience, phased plan, success metrics |
| 🟡 **6** | [`docs/strategy/FEATURE-NAMING-THEMES.md`](docs/strategy/FEATURE-NAMING-THEMES.md) | The Citadel naming system — internal feature names + usage guidelines |

### Reference (When Needed)

| File | When to use |
|------|-------------|
| [`CLAUDE.md`](CLAUDE.md) | Verify feature claims — check Module Status (ONLINE / DELETED) |
| [`docs/JOURNEY-MAPS.md`](docs/JOURNEY-MAPS.md) | Understand user workflows and personas |
| [`README.md`](README.md) | Basic project setup and architecture |

---

## Step 6: Use the AI Agent

When working in Cursor's AI chat, you can reference the content strategist agent:

**In Agent Mode**, the AI automatically has access to:
- All your content files (Content Bible, Quick Ref, etc.)
- Flint MCP tools (live product data)
- The full codebase for fact-checking

### Useful Prompts to Try

```
"I need a landing page hero section for developers. 
 Read docs/strategy/CONTENT-BIBLE.md for voice guidelines 
 and docs/CONTENT-QUICK-REF.md for the key stats."
```

```
"Generate positioning for a healthcare compliance team. 
 Use the audience matrix from the Content Bible."
```

```
"Write a LinkedIn post about why accessibility enforcement 
 matters now. Use the ADA lawsuit stats from the Investor Brief."
```

```
"Create a competitive comparison vs axe-core. Be honest 
 about their strengths. Lead with our shift-left advantage."
```

```
"Pull live product stats — how many tools, rules, and 
 rule packs does Flint have right now?"
```

---

## Step 7: Slash Commands (Claude Code Users)

If you're using Claude Code instead of Cursor, these slash commands are available:

| Command | What it does |
|---------|-------------|
| `/content/draft "landing page for developers"` | Draft content for a specific format and audience |
| `/content/positioning "compliance team"` | Generate audience-specific positioning statements |
| `/content/competitive "vs axe-core"` | Generate competitive comparison content |
| `/content/stats` | Pull verified market and product statistics |

---

## Your First Task: Try This

1. Open `docs/CONTENT-QUICK-REF.md` in Cursor
2. Read it (takes 2 minutes)
3. Open the AI chat (Cmd+L)
4. Type: `"Based on the Content Quick Reference, draft a 280-character tweet about why AI-generated code needs governance. Include one stat."`
5. See what it produces

If the output sounds like Flint — confident, specific, backed by data — you're set up correctly.

---

## Folder Map (What Lives Where)

```
📁 Your repository
├── 📁 docs/
│   ├── 📄 CONTENT-QUICK-REF.md          ← Your cheat sheet
│   ├── 📄 FLINT-PRODUCT-NARRATIVE.md     ← The story
│   ├── 📄 JOURNEY-MAPS.md               ← User journeys
│   ├── 📄 START-HERE.md                  ← Technical getting started
│   └── 📁 strategy/
│       ├── 📄 CONTENT-BIBLE.md           ← Your bible
│       ├── 📄 GO-TO-MARKET-PLAN.md       ← GTM strategy
│       ├── 📄 INVESTOR-BRIEF-2026.md     ← Market data + narratives
│       └── 📄 FEATURE-NAMING-THEMES.md   ← Citadel naming system
├── 📁 .claude/
│   ├── 📁 agents/
│   │   └── 📄 flint-content-strategist.md ← AI agent persona
│   └── 📁 commands/content/
│       ├── 📄 draft.md                    ← /content/draft command
│       ├── 📄 positioning.md              ← /content/positioning command
│       ├── 📄 competitive.md              ← /content/competitive command
│       └── 📄 stats.md                    ← /content/stats command
├── 📄 CLAUDE.md                          ← Technical architecture (fact-checking)
└── 📄 README.md                          ← Project overview
```

---

## Content Work Rules

These are embedded in your AI agent, but good to know:

1. **Never hallucinate stats.** Every number must come from the Investor Brief or a live MCP tool call.
2. **Never claim features that aren't ONLINE.** Check CLAUDE.md Module Status.
3. **Always specify the audience.** Content for developers ≠ content for designers.
4. **Use "AI code quality infrastructure"** as the category. Not "AI governance."
5. **MCP is the engine. Glass is the window.** Never conflate them.
6. **Be specific.** "CIEDE2000 perceptual color distance" beats "advanced color checking."
7. **Be honest about competitors.** Acknowledge strengths, differentiate on unique capabilities.

---

## Getting Help

- **Technical questions about Flint:** Ask the AI with CLAUDE.md as context
- **Content strategy questions:** Reference the Content Bible
- **"What stat should I use?":** Run `/content/stats` or check the Quick Ref
- **"How should I talk about X?":** Check the Content Bible vocabulary guide
- **"Is this feature real?":** Check CLAUDE.md Module Status tables

Welcome aboard. Let's make Flint's story brilliant. 🔥
