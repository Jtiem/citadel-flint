Show all available Flint commands. Print this reference card:

---

## Flint Commands

### Inspect
| Command | What it does |
|---------|-------------|
| `/audit <file>` | Governance audit (Mithril + A11y) on a component |
| `/report [glob]` | Design debt health score, grade, trends |
| `/dbom [glob]` | Design Bill of Materials (token + component inventory) |
| `/query <term>` | Search the component registry |
| `/status` | Flint server health + project state |

### Fix
| Command | What it does |
|---------|-------------|
| `/fix <file>` | Auto-fix violations (dry-run first, then apply) |
| `/sweep [glob]` | Audit + auto-fix across multiple files |
| `/migrate <file>` | Tailwind v3 to v4 class migration |

### Ship
| Command | What it does |
|---------|-------------|
| `/review` | Pre-commit code review gate (SHIP/BLOCK verdict) |

### Demo (canned fixtures)
| Command | What it does |
|---------|-------------|
| `/demo:audit-good` | Audit a compliant banner |
| `/demo:audit-bad` | Audit a non-compliant banner |
| `/demo:fix` | Auto-fix a drifted component |
| `/demo:sweep` | Sweep all demo fixtures |
| `/demo:report` | Debt report for demo files |

**Tips:**
- Most commands accept relative paths: `/audit src/Button.tsx`
- Globs default to `src/**/*.tsx` if omitted
- `/fix` does a dry-run first and asks before applying
- `/audit` picks up the file from your IDE selection if no path given

---

Arguments: $ARGUMENTS