/**
 * paymentCalculator — src/templates/paymentCalculator.ts
 *
 * A self-contained payment calculator demo component as a TSX source string.
 * Loaded into the Monaco editor by the "Load Demo" button in LivePreview.
 *
 * Design token class names used (all resolved by the Tailwind CDN config
 * injected from the Flint token store):
 *
 *   bg-surface-base        → page / canvas background
 *   bg-surface-card        → card / panel background
 *   text-content-primary   → primary body text (headings, values)
 *   text-content-secondary → secondary / muted text (labels, captions)
 *   text-brand-primary     → accent text (badge, numeric highlights)
 *   bg-brand-primary       → CTA button background
 *   border-ui-border       → card borders and dividers
 *
 * These map to the "Demo Tokens" seed set inserted by `ensureDemoTokens()`
 * in tokenStore.ts when the DB is empty, so the component always renders
 * correctly before a Figma sync has occurred.
 *
 * Implementation notes:
 *   - Uses React.useState / React.useMemo (not named imports) because the
 *     IPC Babel transform strips all `import` statements; `React` is available
 *     as the UMD global in the srcdoc iframe.
 *   - `fmt()` is defined inside the component to keep the string self-contained.
 */

export const PAYMENT_CALCULATOR_CODE = `import React from 'react'

export default function PaymentCalculator() {
  const [principal, setPrincipal] = React.useState(15000)
  const [termMonths, setTermMonths] = React.useState(36)
  const [apr, setApr] = React.useState(7.5)

  const result = React.useMemo(() => {
    const r = (apr / 100) / 12
    if (r === 0) {
      return { monthly: principal / termMonths, interest: 0, total: principal }
    }
    const m =
      (principal * r * Math.pow(1 + r, termMonths)) /
      (Math.pow(1 + r, termMonths) - 1)
    return { monthly: m, interest: m * termMonths - principal, total: m * termMonths }
  }, [principal, termMonths, apr])

  function fmt(n: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n)
  }

  return (
    <div className="min-h-screen bg-surface-base p-8 flex items-start justify-center">
      <div className="w-full max-w-md">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary mb-2">
            Flint IDE · Demo
          </p>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight">
            Enrollment Calculator
          </h1>
          <p className="mt-1 text-sm text-content-secondary">
            Adjust values — all fields update instantly
          </p>
        </div>

        {/* ── Input sliders ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-ui-border bg-surface-card p-6 space-y-6">

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-content-secondary">Loan Amount</label>
              <span className="font-mono text-sm font-semibold text-brand-primary">{fmt(principal)}</span>
            </div>
            <input
              type="range" min={1000} max={100000} step={500} value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-content-secondary opacity-60">$1,000</span>
              <span className="text-[10px] text-content-secondary opacity-60">$100,000</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-content-secondary">Term</label>
              <span className="font-mono text-sm font-semibold text-brand-primary">{termMonths} months</span>
            </div>
            <input
              type="range" min={6} max={84} step={6} value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-content-secondary opacity-60">6 mo</span>
              <span className="text-[10px] text-content-secondary opacity-60">84 mo</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-content-secondary">APR</label>
              <span className="font-mono text-sm font-semibold text-brand-primary">{apr.toFixed(2)}%</span>
            </div>
            <input
              type="range" min={0} max={36} step={0.25} value={apr}
              onChange={(e) => setApr(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-content-secondary opacity-60">0.00%</span>
              <span className="text-[10px] text-content-secondary opacity-60">36.00%</span>
            </div>
          </div>

        </div>

        {/* ── Results ────────────────────────────────────────────── */}
        <div className="mt-4 rounded-2xl border border-ui-border bg-surface-card p-6">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-brand-primary mb-2">
            Monthly Payment
          </p>
          <p className="text-center text-5xl font-bold text-content-primary tabular-nums">
            {fmt(result.monthly)}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="rounded-xl border border-ui-border p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-content-secondary mb-1">
                Total Interest
              </p>
              <p className="text-sm font-semibold text-content-primary tabular-nums">
                {fmt(result.interest)}
              </p>
            </div>
            <div className="rounded-xl border border-ui-border p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-content-secondary mb-1">
                Total Cost
              </p>
              <p className="text-sm font-semibold text-content-primary tabular-nums">
                {fmt(result.total)}
              </p>
            </div>
          </div>
        </div>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-brand-primary py-3.5 text-sm font-semibold text-content-primary transition-opacity hover:opacity-90 active:opacity-75"
        >
          Enroll in Payment Plan
        </button>
        <p className="mt-3 text-center text-xs text-content-secondary opacity-60">
          Subject to credit approval · Rates may vary
        </p>

      </div>
    </div>
  )
}
`
