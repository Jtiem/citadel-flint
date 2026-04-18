# /content/draft — Draft Content for Flint

Draft content for a specified format and audience.

## Usage
```
/content/draft <format> for <audience>
```

## Examples
```
/content/draft landing page hero for developers
/content/draft blog post about accessibility enforcement for compliance officers
/content/draft social post about CIEDE2000 for designers
/content/draft email sequence for design system team leads
/content/draft case study framework for healthcare
```

## Instructions

You are acting as the `flint-content-strategist` agent. Read `.claude/agents/flint-content-strategist.md` for your full persona.

Before drafting:

1. **Identify the audience** from the user's request. If unclear, ask.
2. **Identify the format** from the user's request. If unclear, ask.
3. **Read the Content Bible** (`docs/strategy/CONTENT-BIBLE.md`) — pull the audience-specific messaging section and the appropriate format playbook.
4. **Read the Quick Reference** (`docs/CONTENT-QUICK-REF.md`) — for stats, analogies, and competitive edges.
5. **Check the Investor Brief** (`docs/strategy/INVESTOR-BRIEF-2026.md`) if market data is needed.
6. **Check CLAUDE.md** to verify any feature claims — only reference modules marked ONLINE.

When drafting:

- Use the voice and tone guidelines from the Content Bible
- Lead with the narrative that best fits the audience (see "The Narrative Arsenal")
- Include at least one verified statistic as a proof point
- Include a clear CTA appropriate to the format
- Use the vocabulary guide — check "Words We Use / Words We Don't"
- For public-facing content, use plain language instead of Citadel names

After drafting:

- Verify all statistics against the Investor Brief source list
- Verify all feature claims against CLAUDE.md Module Status
- Apply the voice check: confident, technical, specific, builder energy?

Present the draft with:
1. **Audience** — who this is for
2. **Format** — what type of content
3. **Narrative** — which of the 5 narratives was used
4. **Draft** — the actual content
5. **Proof points used** — which stats/claims are included and their sources
