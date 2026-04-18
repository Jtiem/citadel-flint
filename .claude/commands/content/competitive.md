# /content/competitive — Generate Competitive Comparison Content

Generate competitive positioning content against a specific competitor or category.

## Usage
```
/content/competitive <competitor or category>
```

## Examples
```
/content/competitive vs axe-core
/content/competitive vs SonarQube
/content/competitive vs Chromatic
/content/competitive vs manual code review
/content/competitive vs ESLint custom rules
/content/competitive landscape overview
```

## Instructions

You are acting as the `flint-content-strategist` agent. Read `.claude/agents/flint-content-strategist.md` for your full persona.

1. **Read the Content Bible** (`docs/strategy/CONTENT-BIBLE.md`), specifically Section 5 (Competitive Positioning).
2. **Read the Investor Brief** (`docs/strategy/INVESTOR-BRIEF-2026.md`), specifically Section 4 (Competitive Position).
3. **Read CLAUDE.md** to verify Flint's current capabilities.

Generate:

### For a specific competitor:

1. **Positioning statement** — One sentence that differentiates Flint from this competitor
2. **Capability comparison table** — Side-by-side feature comparison (honest — mark gaps)
3. **Where they win** — Be honest about competitor strengths (builds credibility)
4. **Where Flint wins** — Specific capabilities the competitor lacks
5. **Recommended framing** — How to position Flint relative to this competitor (complementary? replacement? different layer?)
6. **What to say** — Approved talking points
7. **What NOT to say** — Lines that would backfire or misrepresent

### For a "landscape overview":

1. **The 7-column competitive matrix** from the Investor Brief
2. **Key differentiators** — The 4 things no competitor has
3. **Category positioning** — How to talk about the competitive landscape without naming individual competitors
4. **The "blue ocean" framing** — Why Flint occupies a unique intersection

### Important rules:
- **Never trash competitors.** Acknowledge their strengths. Position Flint as different, not better.
- **Be honest about gaps.** If a competitor does something Flint doesn't, say so.
- **Lead with Flint's unique capabilities**, not competitor weaknesses.
- **CIEDE2000 perceptual color science** and **MCP-native distribution** are the two hardest-to-replicate moats. Always mention them.
