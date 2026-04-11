# Hooks + Components A+ Review — 2026-04-11

**Overall Grade: B+** | 0 Criticals | 2 Majors | 21 Minors | 3 Warnings
**TSC: 0 errors** | **React tests: 1953/1953 passing**

## File Grades

| File | Grade |
|------|-------|
| useContextSync.ts | A |
| useIDEFileSync.ts | A+ |
| useMCPEventListener.ts | A- |
| useOnboardingTooltip.ts | A+ |
| LivePreview.tsx | B+ |
| XYCanvas.tsx | A- |
| StatusBar.tsx | B+ |
| GovernanceDashboard.tsx | B+ |
| ExportModal.tsx | A- |
| TokenManager.tsx | A- |

## Priority Fix List

1. **MAJOR: LivePreview.tsx line 415** — Full-store destructure `useCanvasStore()`. Replace with individual slice selectors.
2. **MAJOR: LivePreview.tsx line 679** — Regex strip of import statements on JS output. Commandment 13 tension.
3. **WARNING: StatusBar.tsx line 453** — `py-[3px]` arbitrary spacing.
4. **WARNING: XYCanvas.tsx lines 335/357/364/366** — Hardcoded hex in MiniMap/Background props.
5. **WARNING: GovernanceDashboard.tsx line 288** — Hardcoded hex in Sparkline SVG.
