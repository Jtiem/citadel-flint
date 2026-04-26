# Flint Beta Invitation Template

<!--
USAGE NOTES
===========
This template is for the ~10 hand-picked testers in the closed beta.
Customize before sending — especially [WHY_THIS_PERSON].

PLACEHOLDERS TO FILL:
  [FIRST_NAME]         — recipient's first name
  [WHY_THIS_PERSON]    — one sentence, personal, specific. See examples below.
  [BETA_DOWNLOAD_URL]  — private link, rotate per build. Do not reuse.

CUSTOMIZATION TIPS:
  - Keep the tone peer-to-peer, not product-announcement. You know these people.
  - The [WHY_THIS_PERSON] line is the most important sentence in the email. Don't skip it.
  - If they're the type to ignore long emails, cut everything after "Here's the link."
    The welcome guide covers the rest.

EXAMPLE [WHY_THIS_PERSON] FILLERS:
  "You've been deep in shadcn components lately and I need someone who'll immediately
   spot when Flint's token mapping gets it wrong."

  "Your accessibility work is exactly the lens I need — Warden (the a11y checker)
   has 50 WCAG rules and I need someone who'll argue with it."

  "You ship more AI-generated UI than anyone I know, which means you've already
   seen the drift problem firsthand and you'll have opinions."

  "You've been working inside a design system at scale — you'll know within five
   minutes whether the governance layer is actually useful or just noise."

  "You're the rare designer who reads AST output for fun, and I need at least
   one person like that in this group."

SENDING:
  - Plain text or light HTML. No tracking pixels — the beta plan says telemetry
    is opt-in; don't undermine that with a tracked email.
  - BCC all 10 if sending in batch, or send individually (individual is better —
    the [WHY_THIS_PERSON] line won't survive a mass send anyway).
  - Subject line suggestions:
      "You're in — Flint closed beta"
      "I built a thing. Want to break it?"
      "Flint beta invite (one of 10)"
-->

---

## EMAIL BODY

Subject: You're in — Flint closed beta

---

Hey [FIRST_NAME],

I've been quietly building something for the last several months, and I'm finally at the point where I need real people to use it instead of just me telling myself it's fine.

It's called Flint. One-sentence version: it's a tool that catches design system drift in AI-generated UI before it ships — think spell-check, but for design rules instead of typos. Every time an AI writes a React component with a hardcoded color or a spacing value that's close-but-wrong, Flint flags it, explains why in plain English, and fixes it in the actual code.

You're one of ten people I'm inviting. [WHY_THIS_PERSON] That's the honest reason you're getting this email instead of someone else.

**The ask is small:**

- Download the build, install it (takes 2 minutes — instructions in the welcome guide)
- Use it on at least one real component — yours, not just the demo
- Send me 1–2 pieces of feedback in the first week, via the in-app button or just reply to this email

That's probably an hour of your time over the 60-day window, maybe two if you get curious. No Zoom required, no weekly rituals — unless you want them.

**What you get:**

- Early access before anyone else sees it
- Your name in the credits when public beta launches (opt-in, no pressure)
- A handwritten thank-you from me when this ships publicly — yes, actual paper, no, it won't be legible

**Honest disclaimer:** this is a closed beta. There are rough edges. Some error messages are still written for me, not for you. The build expires in 60 days — when it does, just email me and I'll send a fresh one. Nothing leaves your machine without your explicit consent; telemetry is opt-in on first launch.

Here's the link: [BETA_DOWNLOAD_URL]

Install guide: once you've downloaded, open the TESTER-WELCOME file inside the app folder — it walks you through everything including the one macOS Gatekeeper hoop you'll have to jump through (sorry, working on notarization).

Don't share the link. And genuinely, thank you — this is the part of building something where you realize how much you've been talking to yourself.

— Justin

---
