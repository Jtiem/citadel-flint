# Privacy Policy

**Flint** — last updated March 2026

---

## The short version

Flint does not collect your data. It does not phone home. It does not know you exist.

---

## Flint Glass (the desktop app)

Flint Glass runs entirely on your machine. It collects no telemetry and sends no data to Flint servers — because there are no Flint servers receiving anything from you.

When you use Flint Glass, the following happens:

- Your files are read and written locally using your filesystem.
- A local audit log is written to `.flint/telemetry-events.jsonl` inside your project folder. This file records tool invocations and their outcomes so you can review your own session history. It never leaves your machine. Nothing reads it except you and Flint itself.
- Flint Glass connects to the AI providers you configure (Anthropic, OpenAI, Google, etc.) using the API keys you supply. Those connections go directly from your machine to the provider — Flint is not in the middle. Each provider's own privacy policy governs what they do with your prompts and data.

That's it.

---

## The optional beta version check

If you have the `FLINT_BETA_VERSION_URL` environment variable set, Flint will fetch a version manifest from that URL at startup to check whether an update is available. This is opt-in — if you haven't set that variable, no network request is made. The request contains no identifying information.

---

## What Flint does NOT do

- No analytics or usage tracking
- No crash reporting sent to a remote server
- No cookies (Flint Glass is a desktop app, not a website)
- No account creation required
- No data stored anywhere except your local filesystem and the AI providers you configure

---

## AI providers

When you use Flint with an AI provider, you're sending prompts and file content directly to that provider's API. Review their privacy policies for details on how they handle that data:

- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy)
- [Google Privacy Policy](https://policies.google.com/privacy)

---

## Contact

Questions? Reach out to Justin Tiemann directly.
