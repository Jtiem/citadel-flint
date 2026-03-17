# Architecture Specification v1.0

> Canonical architecture document. All agents and contributors read this first.
> Version this document. When the architecture changes, bump the version.

---

## System Overview

[2-3 sentences describing what this system does and its primary value proposition]

---

## Module Map

### Module A: [Name]
**Purpose:** [What this module does]
**Owns:** [Files/directories this module owns]
**Depends on:** [Other modules it imports from]
**Public API:** [Key exports]

### Module B: [Name]
**Purpose:**
**Owns:**
**Depends on:**
**Public API:**

### Module C: [Name]
**Purpose:**
**Owns:**
**Depends on:**
**Public API:**

---

## Process Boundaries

[Describe the security/isolation model. Which code runs where? What can't talk to what?]

```
[Process A]  <-->  [Bridge/IPC]  <-->  [Process B]
  has: X, Y           exposes: Z         has: W
  cannot: A, B                           cannot: C, D
```

---

## Data Flow

[Describe how data moves through the system. What's the source of truth? What's derived?]

```
[Source] → [Transform] → [Store] → [Render]
```

---

## Technology Choices

| Layer | Technology | Why |
|---|---|---|
| Language | | |
| Runtime | | |
| Framework | | |
| State | | |
| Persistence | | |
| Testing | | |

---

## Constraints

- [Hard constraint 1 — e.g., "No network calls from renderer process"]
- [Hard constraint 2 — e.g., "All state changes through the store, no direct DOM manipulation"]
- [Hard constraint 3]

---

## Version History

| Version | Date | Changes |
|---|---|---|
| v1.0 | YYYY-MM-DD | Initial architecture |
