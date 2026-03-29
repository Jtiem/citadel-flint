# Demo: Multi-Component App (Full Workflow)

**What you'll learn:** The complete Flint governance workflow — swarm audit, debt report, and Export Gate.

## The scenario
A small SaaS dashboard with 5 components at mixed compliance levels. This is realistic — most apps have a mix of carefully-built and hastily-built components.

## Component health
| Component | Grade | Violations | Notes |
|-----------|-------|-----------|-------|
| `Dashboard.tsx` | **A** | 0 | Reference implementation |
| `NavBar.tsx` | **B** | 1 | Missing nav aria-label |
| `MetricCard.tsx` | **B** | 2 | Off-token color + wrong font size |
| `AlertBanner.tsx` | **D** | 5 | Color drift + missing a11y roles |
| `DataTable.tsx` | **F** | 8 | Table a11y + contrast + off-token colors |

**Starting health score: ~65/100 (Grade D)**

## What to try
1. Open the governance panel — see the health score ring at ~65/100
2. Say **"sweep"** → `flint_swarm_audit_fix` auto-fixes all auto-fixable violations
3. Watch the health score climb toward B (~84/100)
4. Click **Export** → Gate blocks on remaining manual a11y fixes in DataTable
5. Say **"what's blocking export?"** → get a plain-language explanation of what needs manual review

## Learning outcome
"Flint shows you exactly where your debt is, fixes what it can, and gates export on what it can't."
