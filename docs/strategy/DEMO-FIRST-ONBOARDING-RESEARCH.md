# Demo-First Onboarding: Research Report

**Date:** 2026-03-27
**Author:** Research Agent
**Status:** Research complete -- ready for design decisions
**Companion documents:** IDE-CHAT-ONBOARDING-STRATEGIES.md, BACKLOG-PRIORITIZED.md

---

## Executive Summary

The best developer tools achieve sub-60-second time-to-first-value through a single shared principle: **show the product working before asking the user to configure anything.** The specific mechanism varies -- pre-populated workspaces, scaffolded example content, sandbox environments, or synthetic data -- but the behavioral insight is universal. Users who see the product do something valuable in the first minute stay. Users who see a setup wizard leave.

Flint already has the critical asset: `DemoCard.tsx` with 6 intentional violations and a matching `design-tokens.json`. The infrastructure exists (`beta:load-demo-project` IPC handler, temp directory scaffolding, token placement). The problem is not capability -- it is **routing**. The demo is gated behind a beta-only `BetaWelcome` screen that most users will never see. The SetupWizard (5 steps, MCP config focus) runs first for all new users. By the time a user reaches the canvas, 15+ minutes have elapsed and the app shows an empty state.

The research below catalogs how six best-in-class tools solve this problem and distills their patterns into actionable recommendations for Flint.

---

## Part 1: Pattern Catalog

### 1. Linear -- The Pre-Populated Workspace

**What happens:** Linear offers a browser-only demo workspace accessible from their docs site (linear.app/docs/start-guide) with no signup required. The workspace is pre-populated with realistic issues, projects, and workflows. Changes are local to the browser and reset on refresh.

**Steps to first value:** 1 click from the docs page. Zero clicks from the demo URL itself. The user lands inside a fully functional workspace with sample issues, priorities, cycles, and project boards already populated.

**Synthetic vs. real data:** Entirely synthetic. The demo workspace contains believable project management data (teams, issues, labels, priorities) that mirrors how a real team would use the product.

**The aha moment:** Seeing the command menu (Cmd+K) work inside a workspace that looks like real work. Linear introduces the command menu before the user has touched anything else -- signaling who the product is for and how it expects to be used.

**Transition to real usage:** After signup, Linear gives users onboarding tasks instead of a tour: create an issue, use the command menu, set a priority. The demo workspace disappears entirely -- there is no "continue from demo" path. The post-signup workspace starts empty but with guided tasks.

**Key insight for Flint:** Linear's demo is not a tutorial. It is a fully functional product with pre-loaded data. The user explores freely rather than following a guided path. Settings and admin features are explicitly excluded -- the demo only shows the core value loop.

### 2. Vercel -- The Template-to-Deploy Pipeline

**What happens:** Vercel's "New Project" page (vercel.com/new) presents a template gallery. Clicking any template triggers: clone repository, name it, deploy. The entire flow from template selection to live URL takes 30-90 seconds.

**Steps to first value:** 3 steps: (1) Pick a template, (2) Name the repo, (3) Click Deploy. Vercel auto-detects the framework, configures build settings, and deploys. The user sees a live URL within 60 seconds.

**Synthetic vs. real data:** Real, but templated. The deployed project is actual working code in the user's own GitHub account. It is not a simulation -- it is a real deployment that they own.

**The aha moment:** Seeing the green "Deployed" status with a live `.vercel.app` URL. The user has a working website before they understand how Vercel works.

**Transition to real usage:** The template IS the real project. Users modify the cloned repo and Vercel auto-deploys changes. There is no separate "demo mode" to exit. Vercel also offers an "Empty Project" path for users who want to skip templates.

**Key insight for Flint:** Vercel eliminates the gap between "demo" and "real" by making the first experience a real artifact the user owns. The template does not feel like a tutorial -- it feels like a shortcut.

### 3. Figma -- The Animated Product Tour with Pre-Loaded Canvas

**What happens:** On first account creation, Figma presents a welcome modal offering a product tour. If accepted, the user enters a canvas with pre-loaded design elements and animated tooltips that demonstrate features one at a time: import Sketch files, use design elements, invite collaborators.

**Steps to first value:** 2 steps: (1) Create account (Google OAuth), (2) Accept the tour (or skip it). The canvas is immediately usable either way. Figma also provides starter files with pre-built components, color styles, and typography for hands-on exploration.

**Synthetic vs. real data:** The tour uses pre-loaded shapes and elements on the canvas. The starter files in Community contain realistic design system components (buttons, cards, typography scales). Neither requires the user to bring their own content first.

**The aha moment:** Dragging an element on the infinite canvas and seeing it snap to a grid. The interactive nature of the canvas is self-evident -- the user understands "this is a design tool" within seconds of touching it.

**Transition to real usage:** The tour is opt-in and dismissible. After completion, the user is in a real design file. There is no mode switch. Complicated features link to external documentation rather than being explained inline. The onboarding sequence is brief but covers substantial ground by keeping tooltip copy concise and adding animations.

**Key insight for Flint:** Figma's tour works because the canvas already has things on it. An empty canvas would produce the same paralysis as an empty state. The pre-loaded content is not a tutorial -- it is a workspace that happens to have teaching annotations on it.

### 4. Stripe -- The Persistent Test/Live Toggle

**What happens:** Every new Stripe account starts in Test Mode. The entire dashboard -- payments, customers, products, subscriptions -- works identically to live mode but with test credit cards and simulated transactions. A toggle in the top-right corner switches between Test and Live at any time.

**Steps to first value:** 0 additional steps after account creation. The user lands in a fully functional test environment. They can create test products, process test payments (card number 4242 4242 4242 4242), and see real webhook events -- all before configuring a single integration.

**Synthetic vs. real data:** Synthetic but behaviorally identical. Test mode objects behave exactly like live objects. The API responses, webhook payloads, and dashboard views are indistinguishable from production. Stripe pre-fills onboarding data (name, address) when available to reduce friction further.

**The aha moment:** Running the first successful test charge and seeing it appear in the dashboard. The entire payment flow -- create product, generate payment link, complete checkout, see revenue -- is achievable in under 5 minutes with zero code.

**Transition to real usage:** Replace test API keys with live keys. The toggle is always visible. Test mode is never removed or deprecated -- it remains available for the lifetime of the account. There is no "exit demo mode" ceremony.

**Key insight for Flint:** Stripe's test mode is not positioned as a "demo." It is positioned as a development environment. The framing matters: "test mode" implies professional workflow; "demo mode" implies toy. Both are synthetic, but the perception is different.

### 5. Storybook -- Scaffolded Example Stories with In-App Tour

**What happens:** Running `npx storybook init` scaffolds a `/stories` folder with pre-generated example components (Button, Header, Page) and their corresponding `.stories.tsx` files. On first launch, a "Welcome to Storybook" modal appears, offering a 3-minute guided tour. The tour highlights the sidebar (story navigation), the canvas (component preview), and the controls panel (interactive props).

**Steps to first value:** 2 steps: (1) Run `npx storybook init`, (2) See the example Button component rendered with interactive controls. The scaffold includes working stories that demonstrate every core concept. The guided tour is optional -- the example stories are valuable even without it.

**Synthetic vs. real data:** Synthetic. The scaffolded components (Button, Header, Page) are generic examples, not the user's own components. They are explicitly marked as examples and intended to be replaced.

**The aha moment:** Changing a prop value in the Controls panel and seeing the component update live. This demonstrates the core value proposition (interactive component development) without requiring the user to write anything.

**Transition to real usage:** The example stories are intended to be deleted. The guided tour teaches the user to write their first story by showing the Component Story Format (CSF) structure: meta field, story exports, args. After the tour, the user writes a story for their own component and the example stories become obsolete.

**Key insight for Flint:** Storybook's genius is that the scaffolded content is both a demo AND a template. The example stories show the product working (demo) while also serving as copyable patterns for the user's own stories (template). The transition cost from demo to real is a file rename, not a mode switch.

### 6. Snyk -- Scan-First, Configure-Later

**What happens:** After installing the CLI and authenticating (`snyk auth`), the user runs `snyk test` in any project directory. Snyk auto-detects the manifest file (package.json, requirements.txt, etc.), scans dependencies, and returns a vulnerability report immediately. No project configuration, no dashboard setup, no team creation.

**Steps to first value:** 2 steps: (1) Install CLI + authenticate, (2) Run `snyk test`. Results appear in the terminal within seconds. The web dashboard provides a richer view after repository import, but the CLI delivers value before the user has visited the web UI at all.

**Synthetic vs. real data:** Real. Snyk scans the user's actual project dependencies against its vulnerability database. The first value moment uses the user's own code, not a demo project. The Snyk-maintained `snyk-goof` repository serves as a known-vulnerable demo project for users who want to test with guaranteed results.

**The aha moment:** Seeing the first vulnerability report with severity ratings, dependency paths, and fix recommendations. For a typical Node.js project, `snyk test` finds real vulnerabilities -- the user does not need to believe in the product because the evidence is in their own codebase.

**Transition to real usage:** The CLI output IS real usage. There is no transition. The web dashboard, CI integration, and PR automation are additive -- each adds value on top of the CLI baseline, but the CLI alone is the complete first experience.

**Key insight for Flint:** Snyk proves that scanning tools achieve the fastest time-to-value when they scan the user's own code. However, this requires the user to have a project. For users without a project (evaluators, managers, designers), the `snyk-goof` demo repository fills the gap as an explicit opt-in.

---

## Part 2: Cross-Cutting Principles

### Principle 1: Value Before Configuration

Every tool studied delivers value before asking the user to configure anything. The configuration that does exist is either (a) deferred until after first value, or (b) automated (Storybook scaffolds config, Vercel auto-detects frameworks, Stripe starts in test mode).

**Flint's current violation:** The SetupWizard (IDE detection, MCP config write, connection verification) runs before any value is delivered. A user who skips setup still lands on an empty canvas.

### Principle 2: Pre-Loaded Content Beats Empty States

Linear, Figma, Storybook, and Stripe all avoid empty states on first launch. Linear pre-populates a workspace. Figma pre-loads canvas elements. Storybook scaffolds example stories. Stripe starts with a functional test environment. The tools that show empty states (some CI tools, some analytics platforms) have notably worse activation rates.

**Flint's current state:** After the SetupWizard, the canvas is empty. The governance panel is empty. The DemoCard.tsx exists in `build-resources/` but has no automatic path to the canvas.

### Principle 3: The Demo IS the Product (Not a Separate Mode)

The strongest pattern across all six tools: the demo experience uses the same UI, same features, and same interactions as the real product. Linear's demo workspace is the real Linear UI. Stripe's test mode is the real Stripe dashboard. Storybook's example stories run in the real Storybook instance. There is no "demo mode" that looks different from "real mode."

**Implication for Flint:** The demo should load DemoCard.tsx into the real canvas, show real violations in the real governance panel, and use the real auto-fix engine. No special "demo UI" -- just the real product with pre-loaded content.

### Principle 4: Escape Hatches Are Mandatory

Every tool provides a clear path to skip or exit the demo experience. Linear's demo has no settings (implicit scope limitation). Vercel offers "Empty Project" alongside templates. Figma's tour has a dismiss button. Storybook's examples can be deleted. Stripe's test/live toggle is always visible.

**Implication for Flint:** The demo must never feel like a trap. "Skip -- I'll open my own project" must be visible and functional at every stage.

### Principle 5: The Transition Should Be Invisible

The best tools make the transition from demo to real usage seamless. Vercel's template becomes the real project. Storybook's example stories coexist with real stories. Stripe's test mode persists alongside live mode. There is no "congratulations, you've completed the demo!" ceremony.

**Implication for Flint:** After the demo, the user should be able to open their own project in the same session without restarting. The demo project should remain accessible (perhaps in recent projects) but not block the path to real work.

### Principle 6: Two Audiences, Two Entry Points

Snyk and Stripe serve this pattern best. Snyk offers `snyk test` (scan your own code -- for developers with a project) and `snyk-goof` (demo project -- for evaluators). Stripe offers test mode (for developers building integrations) and the dashboard walkthrough (for business owners evaluating the product).

**Implication for Flint:** Designers evaluating Glass need the demo project. Developers evaluating the MCP engine need to scan their own code. Both paths should exist, but the demo project path should be the default for Glass (where the empty state problem is most severe).

---

## Part 3: Taxonomy of Approaches

| Approach | Examples | Time to First Value | Works Without User Content | Transition Cost |
|----------|----------|--------------------|-----------------------------|-----------------|
| **Auto-load demo content** | Linear, Figma | < 10 seconds | Yes | Low (dismiss/replace) |
| **Scaffold example content** | Storybook | < 30 seconds | Yes | Medium (delete examples) |
| **Template-to-real pipeline** | Vercel | 30-90 seconds | Yes | Zero (template IS the project) |
| **Persistent sandbox mode** | Stripe | 0 seconds (instant) | Yes | Low (flip a toggle) |
| **Scan user's own content** | Snyk CLI | 10-30 seconds | No (requires user project) | Zero (scan IS real usage) |
| **Explicit demo button** | Current Flint (BetaWelcome) | 15+ minutes | Yes (if found) | Medium (open new project) |

---

## Part 4: Recommendations for Flint

### Recommendation 1: Auto-Load the Demo on First Launch (Opinionated Default)

**The pattern:** When `isFirstLaunch` is `true`, bypass the SetupWizard entirely and immediately load DemoCard.tsx into the canvas with its design tokens. The governance panel lights up with violations. The user sees Flint working within 10 seconds of launching the app.

**Why auto-load, not an explicit button:** The research is unambiguous. Linear, Figma, and Stripe all choose opinionated defaults over explicit choices for first-launch. The reasoning is behavioral: a "Try Demo" button introduces a decision point. Decision points cause drop-off. An auto-loaded demo has no decision point -- the user opens the app and the product is already working.

The current `BetaWelcome` screen with its "Try the Demo Project" button represents the explicit-choice pattern. The research shows this is the weaker approach for a visual tool like Glass, where the empty canvas is the primary activation killer.

**Sequence:**
1. User opens Flint Glass for the first time
2. App detects `isFirstLaunch: true`
3. Automatically runs `beta:load-demo-project` (rename to `demo:load-project`)
4. Canvas renders DemoCard.tsx with live preview
5. Governance panel shows 6 violations with auto-fix buttons
6. Lightweight tooltip overlay (3 steps, already exists as OnboardingOverlay) explains what the user is seeing
7. SetupWizard is deferred to a "Connect to IDE" button in the status bar or sidebar -- available when the user is ready, not blocking first value

**Estimated time to first value:** 5-10 seconds (app launch + demo scaffold + render).

### Recommendation 2: Rename "Demo" to "Sample Project" or "Starter Kit"

**The pattern:** Storybook calls them "example stories." Vercel calls them "templates." Stripe calls it "test mode." None of them use the word "demo," which carries connotations of limitation and artificiality.

**For Flint:** Call it the "Sample Project" or "Governance Playground." The framing should be: "This is a real component with real violations. Fix them to see how Flint works." Not: "This is a demo. Your real work starts later."

### Recommendation 3: Retain the MCP Setup as a Deferred, Non-Blocking Path

**The pattern:** Stripe does not require API integration before showing the dashboard. Figma does not require plugin installation before showing the canvas. Configuration is available when the user is ready, but it does not gate first value.

**For Flint:** The SetupWizard (IDE detection, MCP config, connection verification) is valuable but should not be the first thing a user sees. Defer it to:
- A persistent "Connect to IDE" indicator in the StatusBar (already exists as a concept)
- A prompt after the user completes their first auto-fix ("Nice work. Want to connect Flint to your IDE for real-time auditing?")
- The command palette (Cmd+K > "Connect to IDE")

### Recommendation 4: Make the Demo Violations Progressively Discoverable

**The pattern:** Storybook's guided tour highlights one concept at a time. Figma's tooltips explain features sequentially. Neither dumps all information at once.

**For Flint:** The 6 violations in DemoCard.tsx are the teaching material. Present them progressively:
1. First, highlight the most visually obvious violation (color drift -- the blue is wrong)
2. After the user fixes it, celebrate briefly and surface the next violation
3. After 2-3 fixes, show the governance dashboard with the improving health score
4. After all fixes, show the Export Gate turning green

This is the "Momentum Loop" (Strategy 6 from IDE-CHAT-ONBOARDING-STRATEGIES.md) applied to the Glass demo experience.

### Recommendation 5: Keep the "Open Your Own Project" Path Always Visible

**The pattern:** Every tool in the catalog provides an escape hatch. Vercel's "Empty Project," Figma's tour dismiss button, Linear's demo scope limitation.

**For Flint:** During the demo experience, a persistent "Open Your Own Project" affordance should be visible (File menu, status bar, or a subtle button on the canvas). The demo should feel like a starting point, not a walled garden.

---

## Part 5: Risk Analysis

### Risk 1: Auto-Loading Feels Presumptuous

**Concern:** Some power users may find an auto-loaded demo patronizing. They want to open their own project immediately.

**Mitigation:** The demo loads fast (< 3 seconds) and includes a prominent "Open Your Own Project" escape hatch. The cost of dismissing the demo is low (one click), while the cost of an empty state is high (user churns). The math favors the opinionated default. Stripe, Linear, and Figma all made this same calculation.

**Severity:** Low. Power users who know what they want will dismiss the demo in 2 seconds. New users who do not know what they want will benefit enormously.

### Risk 2: Demo Project Creates False Expectations

**Concern:** Users may think Flint only works with the demo component and not realize it works with their own code.

**Mitigation:** The transition prompt after the demo ("Open your own component to see Flint audit your real code") explicitly addresses this. The Momentum Loop (Strategy 6) reinforces that the demo is a starting point. The OnboardingOverlay's Step 3 already says "Talk to Flint" -- extending this to "Now try it on your own code" is natural.

**Severity:** Medium. Requires intentional copy in the transition moment. Without it, some users will complete the demo and not know what to do next.

### Risk 3: Demo Tokens Conflict with User's Existing Tokens

**Concern:** If the demo writes `design-tokens.json` to a temp directory and the user then opens their own project, token state could be confusing.

**Mitigation:** The existing implementation already handles this correctly -- the demo project is created in a temp directory (`/tmp/flint-beta-demo/demo-{timestamp}`) with its own `.flint/design-tokens.json`. When the user opens their own project, the project root changes and Flint reads that project's tokens. No conflict.

**Severity:** Low. Already solved by the existing architecture.

### Risk 4: MCP Connection Is Delayed

**Concern:** Deferring the SetupWizard means the MCP connection to the IDE is not configured during the demo. Some users may want to use chat commands during the demo.

**Mitigation:** The demo's value proposition is visual: see violations, click auto-fix, watch them resolve. This loop is entirely within Glass and does not require MCP. The MCP setup becomes relevant when the user opens their own project and wants IDE-side auditing. The deferred prompt ("Now connect to your IDE") arrives at exactly the right moment.

**Severity:** Low for designers (Glass-first workflow). Medium for developers who expect CLI/IDE integration immediately. The developer audience is better served by the MCP-side onboarding strategies (IDE-CHAT-ONBOARDING-STRATEGIES.md Strategies 1-3).

### Risk 5: Stale Demo After Product Evolution

**Concern:** As Flint's governance engine evolves (new rules, new violation types), the DemoCard.tsx may not showcase the latest capabilities.

**Mitigation:** DemoCard.tsx should be treated as a maintained artifact with its own test coverage. Each time a new high-impact rule is added, evaluate whether a corresponding violation should be added to the demo. The demo does not need to showcase every feature -- it needs to showcase the core value loop (see violation, fix violation, export cleanly).

**Severity:** Low with maintenance discipline. High without it.

---

## Part 6: Decision Matrix

The central design question: **Should the demo auto-load (opinionated) or be an explicit choice (button)?**

| Factor | Auto-Load | Explicit Button |
|--------|-----------|-----------------|
| Time to first value | 5-10 seconds | 15+ minutes (current) |
| Drop-off risk at decision point | None (no decision) | High (user must choose) |
| Power user friction | Low (one-click dismiss) | None |
| Industry precedent | Linear, Figma, Stripe, Storybook | Few successful examples |
| Implementation complexity | Low (re-route existing IPC) | Already implemented |
| Empty state risk | Eliminated | Persists if user skips demo |
| Perceived product quality on first impression | High (product is alive) | Medium (depends on choice) |

**Recommendation: Auto-load.** The evidence from all six tools, the PLG research on time-to-value, and the specific characteristics of Flint's visual product (where an empty canvas is the worst possible first impression) all point to the opinionated default.

The explicit button (current BetaWelcome pattern) should remain available as the "re-enter demo" path -- accessible from the Help menu or command palette for users who want to revisit it.

---

## Sources

- [Linear Start Guide](https://linear.app/docs/start-guide)
- [Linear Onboarding Flow Teardown (Supademo)](https://supademo.com/user-flow-examples/linear)
- [How Linear Welcomes New Users (fmerian, Medium)](https://fmerian.medium.com/delightful-onboarding-experience-the-linear-ftux-cf56f3bc318c)
- [Getting Started with Vercel](https://vercel.com/docs/getting-started-with-vercel)
- [Vercel Templates Gallery](https://vercel.com/new/templates)
- [Vercel Onboarding Flow (Page Flows)](https://pageflows.com/post/desktop-web/onboarding/vercel/)
- [Figma's Animated Onboarding Flow (Appcues / GoodUX)](https://goodux.appcues.com/blog/figmas-animated-onboarding-flow)
- [Figma Design for Beginners Course](https://help.figma.com/hc/en-us/articles/30848209492887-Course-overview-Figma-Design-for-beginners-2025)
- [Create Your First Design File (Figma Learn)](https://help.figma.com/hc/en-us/articles/30926129986199-FD4B-Create-your-first-design-file)
- [Stripe Sandboxes Documentation](https://docs.stripe.com/sandboxes)
- [Stripe Testing Use Cases](https://docs.stripe.com/testing-use-cases)
- [Stripe API Keys and Test/Live Modes](https://docs.stripe.com/keys)
- [Testing Connect Onboarding with Sandboxes (Stripe Dev Blog)](https://stripe.dev/blog/testing-connect-onboarding-with-sandboxes)
- [Storybook In-App Tour for New Users](https://storybook.js.org/blog/in-app-tour-for-new-users/)
- [Storybook Addon Onboarding (GitHub)](https://github.com/storybookjs/addon-onboarding)
- [Storybook Install Docs](https://storybook.js.org/docs/get-started/install)
- [Snyk CLI Getting Started](https://docs.snyk.io/developer-tools/snyk-cli/getting-started-with-the-snyk-cli)
- [Snyk GitHub Integration](https://docs.snyk.io/scm-ide-and-ci-cd-integrations/snyk-scm-integrations/github)
- [Interactive Demos and PLG (Chameleon)](https://www.chameleon.io/blog/interactive-demos-product-led-growth)
- [Sandbox Demos Guide 2025 (Guideflow)](https://www.guideflow.com/blog/sandbox-demos-guide)
- [API Sandbox Best Practices (Nordic APIs)](https://nordicapis.com/7-best-practices-for-api-sandboxes/)
- [Empty State UX Patterns (Mobbin)](https://mobbin.com/glossary/empty-state)
- [Empty States and User Onboarding (Smashing Magazine)](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/)
- [Interactive Demo Best Practices 2025 (DemoDazzle)](https://demodazzle.com/blog/interactive-demo-best-practices)
