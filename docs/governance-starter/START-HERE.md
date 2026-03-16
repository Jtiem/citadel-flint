# How to Set Up Rules for Your Project

> You just started a project. You're excited. You want to move fast.
> But you also don't want to end up with a mess in 3 months.
>
> This template gives your project guardrails — simple rules that keep
> your code clean as it grows, especially if you're using AI to help write it.

---

## What's in this folder?

Think of it like setting up a new kitchen. Before you cook, you decide:
- What ingredients are always in stock (your **rules**)
- Who does what (your **agents** — AI helpers with specific jobs)
- Your closing routine (your **workflows** — checklists you run regularly)

```
rules/
  MY-RULES.md          ← The things that MUST be true about your code
  WHAT-MAKES-US-DIFFERENT.md  ← Why your project exists (so you don't lose focus)
  HOW-ITS-BUILT.md     ← A simple map of your project's parts

agents/
  planner.md           ← AI helper that thinks before building
  checker.md           ← AI helper that reviews code before it ships
  builder.md           ← AI helper that writes the actual code
  fixer.md             ← AI helper that figures out why things break

workflows/
  before-you-commit.md ← Quick checklist before saving your work
  end-of-day.md        ← Quick checklist before closing your laptop
```

---

## Setup Guide (About 2 hours, no experience needed)

### Step 1: Write Your Rules (30 minutes)

Open `rules/MY-RULES.md`. It has 5 starter rules already filled in. Read each one and decide:
- Does this apply to my project? (Keep it or delete it)
- What's missing? (Add 1-3 rules specific to your project)

**The only hard requirement:** Each rule must be a yes/no question. Not "try to write clean code" but "does every function have a name that describes what it does?"

### Step 2: Write Why Your Project Exists (15 minutes)

Open `rules/WHAT-MAKES-US-DIFFERENT.md`. Answer three questions:
1. What problem does your project solve?
2. What makes your approach better than alternatives?
3. Before building any new feature, ask: "Does this make us better at #2?"

This prevents you from building random features that don't serve your core purpose.

### Step 3: Map Your Project (30 minutes)

Open `rules/HOW-ITS-BUILT.md`. Draw a simple map of your project's parts:
- What are the main folders and what do they do?
- What talks to what?
- What are the hard rules? (e.g., "the frontend never touches the database directly")

### Step 4: Customize Your AI Helpers (30 minutes)

Look at the 4 files in `agents/`. Each one is a job description for an AI assistant. Read through them and:
- Update the file paths to match YOUR project
- Update the "don't do this" sections with mistakes YOU'VE made before
- The `checker.md` file is the most important one — it's what keeps quality high

### Step 5: Try the Checklists (15 minutes)

Run through `workflows/before-you-commit.md` once with your current code. Does every item make sense? Remove what doesn't, add what's missing.

---

## That's it.

Once these files are in your project, any AI assistant (Claude, etc.) will automatically read them and follow your rules. You don't need to configure anything — the AI finds these files and uses them as instructions.

The magic isn't in any single file. It's in having your rules written down at all. Most projects fail not because of bad code, but because nobody agreed on what "good" means.
