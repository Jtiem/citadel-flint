# Welcome to the Flint Beta

Thanks for being here. You are one of ten people with access to this build, and your feedback will directly shape what Flint becomes.

---

## What Flint is

Flint is a governance layer for AI-generated UI code. When an AI writes a React component, Flint checks it against your design system — catching color drift, accessibility failures, and spacing violations before they reach production. Think of it as a spell-checker, but for design rules instead of typos.

---

## What "closed beta" means

This is a private, hand-picked beta. That means:

- **You have the build; almost nobody else does.** There is no public download. Please do not share the link.
- **It expires.** The StatusBar shows the expiry date. When the build expires, you will see a prompt to email for a new one. The expiry window is 60 days from your install date.
- **Expect rough edges.** Some flows are incomplete. Some error messages are cryptic. That is exactly why we are doing this before a public release.
- **Your feedback is the point.** There is no passive telemetry that replaces you actually telling us what broke or confused you.

---

## Your first five minutes

Here is the shortest path to seeing Flint do something meaningful.

**1. Install**

- macOS: Open the `.dmg`, drag Flint to Applications. The first time you open it, macOS will warn you the app is from an unidentified developer — this is expected, since the build is not yet notarized. Right-click the app icon, choose Open, then click Open in the dialog. You only need to do this once.
- Windows: Run the `.exe`. Windows SmartScreen will warn you. Click "More info" then "Run anyway."

**2. Accept or decline telemetry**

On first launch, Flint will ask whether it can send anonymous usage events (tool names, audit counts, crash reports — never file contents or design data). Accept or decline — either is fine. You can change this later in Settings.

**3. Open the demo project**

Flint ships with a demo project. Choose "Open Demo Project" from the launch screen. This gives you something to audit immediately without needing your own codebase.

**4. Run an audit**

With the demo project open, click the file named `Button.tsx` in the left panel. Then click the "Audit" button in the top toolbar, or press `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Windows).

You will see a verdict in the right sidebar. Flint runs two checks automatically:
- **Mithril** (our color and spacing linter) — flags anything that drifts from your design token values using perceptual color math, not hex matching
- **Warden** (our accessibility checker) — checks 50 WCAG 2.1 AA rules including contrast, keyboard navigation, and ARIA labeling

**5. Fix a violation**

If Mithril or Warden finds an issue, click the violation in the list. You will see a plain-English explanation of what is wrong and why it matters. Click "Fix It" — Flint rewrites the AST (the underlying code structure) automatically.

**6. Export**

Try clicking Export in the StatusBar at the bottom. Flint's Gate (the export checker) will either let you through or tell you exactly what is blocking it. No guessing.

That is the core loop: audit → understand → fix → export. Everything else in the app is either supporting that loop or giving you visibility into it.

---

## What we want feedback on

These are our four open questions for this beta. Please focus here:

**1. Governance accuracy** — Did Mithril flag something that looked correct to you? Did Warden complain about an accessible component? False positives are as important as missed violations. Tell us specifically what was flagged and why you disagreed.

**2. Plain-language explanations** — When Flint explains a violation, does it make sense? Could you act on it? Or did it feel like jargon? Copy-paste the exact explanation if something confused you.

**3. The audit-to-fix loop** — Was the fix Flint applied correct? Did it leave the component looking right? Did anything break downstream? We are especially interested in cases where the auto-fix felt wrong or too aggressive.

**4. Performance** — Did anything feel slow? Audit on a file with 50+ components, or try auditing a whole folder. Note what you did and approximately how long it took.

---

## How to file an issue

Use the "Send Feedback" button in the StatusBar at the bottom of the app. This opens a short form. Type what you observed, what you expected, and what you were trying to do. Flint will automatically attach your app version, OS, and the last few tool calls (no file contents) to help us reproduce the issue.

If the feedback button does not work, or you are offline, it will copy the report to your clipboard. Email it to justin.tiemann@gmail.com with the subject "Flint Beta Feedback."

For anything urgent — crash on launch, app unresponsive — email directly.

---

## What we are NOT asking about yet

Please skip feedback on these things for now. They are either not in this build or not ready for review:

- The Figma integration. Figma connection is accessible but unpolished. We will ask for feedback on it in a later session.
- The `flint-ci` command-line tool. This ships with the codebase but is not part of the Glass app you are testing.
- The VS Code / Cursor extension. Same — it exists, but this beta is focused on the desktop app.
- The web version. We are testing the desktop app only.
- Auto-update. There is none in this build. When a new build is ready, we will send you a link.
- Code signing / notarization warnings. We know. They go away in the public release.

---

## Build expiry

This build expires 60 days from the date it was sent to you. The StatusBar will turn amber when you have less than a week left. When it expires, the app will show a dialog and stop — email justin.tiemann@gmail.com and we will send a fresh build. We will try to always have a replacement ready before the expiry fires.

---

## Ground rules

A few things that make the beta useful for everyone:

- **Be specific.** "It felt slow" is less useful than "auditing a 200-line file took about 8 seconds." Screenshots and exact quotes from the UI are gold.
- **Don't share the build.** This is a closed beta with a small group by design. The link is private.
- **You can break things.** Seriously. Try weird files, empty components, components with 300 violations. The more edge cases we hit now, the better.
- **Weekly check-in.** We will reach out weekly for a quick 15-minute sync. If a week goes by and the app just sat on your dock, that's feedback too — we want to know what stopped you from using it.
- **Nothing is final.** Names, layouts, and behaviors will change. If something seems wrong, it might be intentional — or it might be a bug. Either way, mention it.

---

## Contact

Justin Tiemann — justin.tiemann@gmail.com

Response time: same day on weekdays, best-effort on weekends. For a crash or launch failure, mention "urgent" in the subject line.

---

Thanks again. This is a small group and every session matters.
