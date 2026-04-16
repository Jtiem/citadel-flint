# /getting-started — Adaptive Onboarding Tour

A guided first-time experience that reads your project state and walks you through exactly what matters right now. Not a manual — a conversation.

## Usage

- `/getting-started` — Full adaptive tour
- `/getting-started quick` — 30-second orientation (just the essentials)

## Behavior

### Step 1: Read the room

Call `flint_get_context` and `flint_status` in parallel. Determine which of these states the user is in:

| State | How to detect | Priority path |
|-------|--------------|---------------|
| **Brand new** | No `.flint/` directory, no tokens, no registry entries | Start from zero |
| **Connected but empty** | Figma connected, no components generated yet | Design-to-code |
| **Has components** | Components exist but violations present | Clean up |
| **Healthy project** | Components exist, few/no violations | Ship & maintain |

### Step 2: Greet and orient

Start with a brief, warm welcome that acknowledges where they are — not a generic intro:

**Brand new:**
```
Welcome to Flint — your design governance co-pilot.

Right now you have a blank slate. Here's the fastest path to your first
governance-compliant component:

  1. Connect to Figma    →  /connect
  2. Turn a design into code  →  /figma <url>
  3. Check what Flint found   →  /health

Let's start. Do you have a Figma file to connect? Paste the URL and
I'll handle the rest.
```

**Connected but empty:**
```
You're connected to Figma — nice. But there are no components in the
project yet. Let's fix that.

Paste a Figma URL for a frame or component, and I'll turn it into
governance-compliant code:

  /figma <your-url-here>

Or if you already have component files, point me at one:

  /audit src/components/YourComponent.tsx
```

**Has components (with violations):**
```
You have [N] components, but [M] governance violations are open.
Here's the quick health check:

  Score: [X]/100 ([grade])
  Top issue: [rule name] — [plain English explanation]

Want to clean these up? Two options:

  /fix [worst file]     — Fix one file at a time
  /sweep                — Fix everything at once

Or run /health for the full breakdown.
```

**Healthy project:**
```
Your project is in good shape — [score]/100, [grade].

Here's what you can do from here:

  /tokens check    — Make sure Figma tokens are in sync
  /dbom            — Generate a Design Bill of Materials
  /report          — Track health trends over time

  /figma <url>     — Add a new component from Figma
  /review          — Pre-commit review before shipping

Run /flint anytime to see all available commands.
```

### Step 3: Teach by doing (not by listing)

After the greeting, DO NOT dump a command reference. Instead, based on the detected state:

- **Brand new:** Ask "Do you have a Figma URL?" If yes, immediately run `/figma` on it. If no, offer to audit an existing file or show `/getting-started quick`.
- **Connected but empty:** Ask "Paste a Figma frame URL and I'll generate your first component."
- **Has violations:** Offer to fix the worst file right now. "Want me to clean up [filename]? It has [N] issues."
- **Healthy:** Suggest the most relevant next action based on context (token staleness, pending overrides, etc.)

The goal is to get the user to *do something* within 30 seconds — not read documentation.

### Step 4: Leave a breadcrumb

End every tour with exactly one next step and one escape hatch:

```
Next step: [contextual suggestion]
Full command list: /flint
```

### /getting-started quick

Skip the state detection. Print a 30-second orientation:

```
Flint keeps your UI code governance-compliant. Here's what matters:

  DESIGN → CODE          FIX & SHIP              MONITOR
  /figma <url>           /fix <file>              /health
  /connect               /sweep                   /context
  /tokens pull           /review                  /report

Start here → /figma <url>     or     /health
Full reference → /flint
```

## Design Principles

1. **State-aware:** Never show irrelevant commands. A user with no Figma connection doesn't need `/tokens push`.
2. **Action-first:** Every screen ends with a prompt to do something, not read something.
3. **Plain English:** Use Citadel names only in parentheses: "auto-fix violations (Mithril)" — never jargon-first.
4. **One path:** Don't offer 5 options when 1 is clearly right for the user's state.
5. **Escape hatch:** Always provide `/flint` as the "show me everything" fallback.

Arguments: $ARGUMENTS
