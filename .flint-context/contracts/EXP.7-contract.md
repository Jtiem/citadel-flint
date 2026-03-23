# EXP.7 -- Cross-Platform Token Sync

**Phase:** EXP.7
**Status:** CONTRACT (Phase 1)
**Author:** flint-architect
**Date:** 2026-03-21
**Priority:** P3 / XL

---

## 1. Summary

EXP.7 extends the existing DTCG token pipeline (`.flint/design-tokens.json`) to emit platform-native token files for five targets: Tailwind CSS, CSS Custom Properties, React Native StyleSheet, Swift UIColor, and Kotlin Compose Color. A cross-platform consistency audit compares outputs and produces a sync report.

This is an **MCP-only** feature. No Glass UI in v1. All emitters are pure functions (tokens in, string out). File I/O is handled exclusively in the MCP tool handler. Adding a 6th platform (e.g., Flutter/Dart) requires only one new emitter file.

---

## 2. Impact Map

| File | Action | Owner Agent | Notes |
|------|--------|-------------|-------|
| `flint-mcp/src/core/emitters/types.ts` | CREATE | `flint-state-architect` | Shared types: `PlatformTarget`, `PlatformOutput`, `PlatformEmitter`, `CrossPlatformAuditResult`, `TokenSyncReport`, `ValidationResult` |
| `flint-mcp/src/core/emitters/tailwindEmitter.ts` | CREATE | `flint-ast-surgeon` | Tailwind theme config emitter |
| `flint-mcp/src/core/emitters/cssEmitter.ts` | CREATE | `flint-ast-surgeon` | CSS custom properties emitter |
| `flint-mcp/src/core/emitters/reactNativeEmitter.ts` | CREATE | `flint-ast-surgeon` | React Native StyleSheet emitter |
| `flint-mcp/src/core/emitters/swiftEmitter.ts` | CREATE | `flint-ast-surgeon` | Swift UIColor/CGFloat emitter |
| `flint-mcp/src/core/emitters/kotlinEmitter.ts` | CREATE | `flint-ast-surgeon` | Kotlin Compose Color emitter |
| `flint-mcp/src/core/emitters/crossPlatformAuditor.ts` | CREATE | `flint-ast-surgeon` | Cross-platform consistency checker |
| `flint-mcp/src/core/emitters/index.ts` | CREATE | `flint-state-architect` | Barrel export + `getEmitter(platform)` registry |
| `flint-mcp/src/tools/emitTokens.ts` | CREATE | `flint-state-architect` | MCP tool definition + handler for `flint_emit_tokens` |
| `flint-mcp/src/core/emitters/__tests__/tailwindEmitter.test.ts` | CREATE | `flint-test-writer` | Tailwind emitter tests |
| `flint-mcp/src/core/emitters/__tests__/cssEmitter.test.ts` | CREATE | `flint-test-writer` | CSS emitter tests |
| `flint-mcp/src/core/emitters/__tests__/reactNativeEmitter.test.ts` | CREATE | `flint-test-writer` | React Native emitter tests |
| `flint-mcp/src/core/emitters/__tests__/swiftEmitter.test.ts` | CREATE | `flint-test-writer` | Swift emitter tests |
| `flint-mcp/src/core/emitters/__tests__/kotlinEmitter.test.ts` | CREATE | `flint-test-writer` | Kotlin emitter tests |
| `flint-mcp/src/core/emitters/__tests__/crossPlatformAuditor.test.ts` | CREATE | `flint-test-writer` | Audit consistency tests |
| `flint-mcp/src/tools/__tests__/emitTokens.test.ts` | CREATE | `flint-test-writer` | Tool handler integration tests |
| `flint-mcp/src/server.ts` | MODIFY | `flint-state-architect` | Register `flint_emit_tokens` tool in ListTools + CallTool handlers |
| `flint-mcp/src/core/governance/types.ts` | MODIFY | `flint-state-architect` | Export `PlatformTarget` type (re-export from emitters/types) for cross-package visibility |

---

## 3. Type Contracts

All types live in `flint-mcp/src/core/emitters/types.ts`.

```typescript
/**
 * Cross-Platform Token Emitter types -- flint-mcp/src/core/emitters/types.ts
 *
 * EXP.7: Shared type definitions for the platform token emission pipeline.
 * All emitters consume DesignToken[] and produce PlatformOutput.
 */

import type { DesignToken, TokenType } from '../../types.js'

// -- Platform targets ----------------------------------------------------------

/**
 * Supported platform output targets.
 * Adding a new platform (e.g. 'flutter') requires:
 *   1. A new emitter file implementing PlatformEmitter
 *   2. Registration in the emitter registry (index.ts)
 */
export type PlatformTarget =
    | 'tailwind'
    | 'css'
    | 'react-native'
    | 'swift'
    | 'kotlin'

// -- Emitter output ------------------------------------------------------------

/**
 * The result of a single platform emission.
 */
export interface PlatformOutput {
    /** Which platform this output targets. */
    platform: PlatformTarget
    /** The generated source code string. */
    code: string
    /** Suggested filename for this output (e.g. 'tailwind.config.ts'). */
    filename: string
    /** Number of tokens successfully emitted. */
    tokenCount: number
    /** Tokens that were skipped (unsupported type for this platform). */
    skippedTokens: SkippedToken[]
    /** MIME type of the output file (for MCP content negotiation). */
    mimeType: string
}

/**
 * A token that could not be emitted for a specific platform.
 */
export interface SkippedToken {
    /** The token_path of the skipped token. */
    tokenPath: string
    /** The token_type of the skipped token. */
    tokenType: TokenType
    /** Human-readable reason it was skipped. */
    reason: string
}

// -- Validation ----------------------------------------------------------------

/**
 * Result of validating a platform output.
 * Each emitter validates its own output for syntactic correctness.
 */
export interface ValidationResult {
    /** Whether the output is valid. */
    valid: boolean
    /** Validation errors, if any. */
    errors: ValidationError[]
}

export interface ValidationError {
    /** Line number in the generated output (1-based), or null if not applicable. */
    line: number | null
    /** Human-readable error description. */
    message: string
}

// -- Emitter interface ---------------------------------------------------------

/**
 * Contract for a platform-specific token emitter.
 *
 * Design constraints:
 *   - emit() is a PURE FUNCTION: tokens in, PlatformOutput out. No I/O.
 *   - validate() checks the output string for syntactic correctness.
 *   - Each emitter is a standalone module with no cross-emitter dependencies.
 */
export interface PlatformEmitter {
    /** Which platform this emitter targets. */
    readonly platform: PlatformTarget
    /** The default filename for this platform's output. */
    readonly defaultFilename: string
    /**
     * Emit platform-native token definitions from the given design tokens.
     *
     * @param tokens    The full set of DTCG-normalized design tokens.
     * @param options   Platform-specific options (optional).
     * @returns         The generated output with metadata.
     */
    emit(tokens: DesignToken[], options?: EmitOptions): PlatformOutput
    /**
     * Validate the generated output for syntactic correctness.
     * Does NOT validate runtime behavior -- only structure/syntax.
     */
    validate(output: PlatformOutput): ValidationResult
}

/**
 * Optional emitter configuration passed through from the tool handler.
 */
export interface EmitOptions {
    /** Filter tokens to a specific mode (e.g. 'Light', 'Dark'). When omitted, emits all modes. */
    mode?: string
    /** Filter tokens to a specific collection. When omitted, emits all collections. */
    collection?: string
    /** Prefix for generated identifiers (e.g. CSS variable prefix). Defaults vary by platform. */
    prefix?: string
}

// -- Cross-platform audit ------------------------------------------------------

/**
 * Token presence record across all targeted platforms.
 */
export interface TokenCoverageEntry {
    /** The token_path. */
    tokenPath: string
    /** The token_type. */
    tokenType: TokenType
    /** Which platforms successfully emitted this token. */
    presentIn: PlatformTarget[]
    /** Which platforms skipped this token. */
    missingFrom: PlatformTarget[]
}

/**
 * A consistency issue found during cross-platform audit.
 */
export interface ConsistencyIssue {
    /** Severity of the inconsistency. */
    severity: 'error' | 'warning' | 'info'
    /** Which token is affected. */
    tokenPath: string
    /** Human-readable description of the issue. */
    message: string
    /** Platforms involved in the inconsistency. */
    platforms: PlatformTarget[]
}

/**
 * Result of the cross-platform audit.
 */
export interface CrossPlatformAuditResult {
    /** Overall consistency grade: A (all tokens in all platforms) through F. */
    grade: string
    /** Consistency score 0-100. */
    score: number
    /** Total unique tokens across all platforms. */
    totalTokens: number
    /** Per-token coverage across platforms. */
    coverage: TokenCoverageEntry[]
    /** Specific consistency issues found. */
    issues: ConsistencyIssue[]
    /** Summary statistics by platform. */
    platformSummary: PlatformSummary[]
}

/**
 * Per-platform summary in the audit result.
 */
export interface PlatformSummary {
    platform: PlatformTarget
    /** Tokens emitted for this platform. */
    emitted: number
    /** Tokens skipped for this platform. */
    skipped: number
    /** Coverage percentage (emitted / total * 100). */
    coveragePercent: number
}

// -- Sync report ---------------------------------------------------------------

/**
 * Full report returned by the flint_emit_tokens tool.
 */
export interface TokenSyncReport {
    /** ISO 8601 timestamp when this report was generated. */
    generatedAt: string
    /** Total input tokens from design-tokens.json. */
    inputTokenCount: number
    /** Whether this was a dry run (no files written). */
    dryRun: boolean
    /** Per-platform emission results. */
    outputs: PlatformOutput[]
    /** Per-platform validation results. */
    validations: Record<PlatformTarget, ValidationResult>
    /** Cross-platform consistency audit (null if only one platform was targeted). */
    audit: CrossPlatformAuditResult | null
    /** Output directory where files were written (null for dry run). */
    outputDir: string | null
}
```

---

## 4. MCP Tool Design

### 4.1 Tool Registration

**Tool name:** `flint_emit_tokens` (via `toolName('emit_tokens')`)

```typescript
// In flint-mcp/src/tools/emitTokens.ts

export const FLINT_EMIT_TOKENS_TOOL = {
    name: toolName('emit_tokens'),
    description:
        'EXP.7: Emit design tokens from .flint/design-tokens.json to platform-native ' +
        'formats. Supports: tailwind (theme config), css (custom properties), ' +
        'react-native (StyleSheet.create), swift (UIColor extensions), kotlin ' +
        '(Compose Color/MaterialTheme). Returns per-platform output files plus a ' +
        'cross-platform consistency audit. Use dryRun=true to preview without writing files.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            platforms: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: ['tailwind', 'css', 'react-native', 'swift', 'kotlin'],
                },
                description:
                    'Target platforms to emit. Pass multiple for cross-platform sync. ' +
                    'When omitted, emits to all 5 platforms.',
            },
            outputDir: {
                type: 'string',
                description:
                    'Directory to write generated files. Defaults to .flint/platform-tokens/. ' +
                    'Ignored when dryRun is true.',
            },
            dryRun: {
                type: 'boolean',
                description:
                    'When true, returns the generated code without writing to disk. Default: false.',
            },
            projectRoot: {
                type: 'string',
                description:
                    'Absolute path to the project root. Defaults to process.cwd().',
            },
            mode: {
                type: 'string',
                description:
                    'Filter tokens to a specific mode (e.g. "Light", "Dark"). ' +
                    'When omitted, emits all modes.',
            },
            collection: {
                type: 'string',
                description:
                    'Filter tokens to a specific collection name. When omitted, emits all.',
            },
            prefix: {
                type: 'string',
                description:
                    'Identifier prefix for generated output (e.g. CSS variable prefix). ' +
                    'Platform defaults apply when omitted.',
            },
        },
    },
} as const
```

### 4.2 Tool Handler

```typescript
export interface EmitTokensArgs {
    platforms?: PlatformTarget[]
    outputDir?: string
    dryRun?: boolean
    projectRoot?: string
    mode?: string
    collection?: string
    prefix?: string
}

export async function handleEmitTokens(
    args: EmitTokensArgs,
    defaultProjectRoot: string,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    // 1. Resolve project root
    // 2. Read .flint/design-tokens.json (via fs.readFileSync -- MCP process, not renderer)
    // 3. Parse tokens into DesignToken[] using existing token extraction logic
    // 4. For each requested platform:
    //    a. Get emitter from registry
    //    b. Call emitter.emit(tokens, options)
    //    c. Call emitter.validate(output)
    // 5. If platforms.length > 1, run crossPlatformAudit(outputs)
    // 6. If !dryRun, write files to outputDir via fs.mkdirSync + fs.writeFileSync
    //    (MCP server process -- not Electron renderer, so FileTransactionManager
    //    is not available. Use atomic write pattern: write to .tmp then rename.)
    // 7. Return TokenSyncReport
}
```

### 4.3 Token Loading

The handler reads tokens from `.flint/design-tokens.json`. This file uses the W3C DTCG format (nested JSON with `$value` and `$type` keys). The existing `tokenExtractor.ts` already has a `walkDTCG()` function that converts this format to `DesignToken[]`. We will extract and reuse that logic.

**Decision:** Create a lightweight `loadDesignTokens(projectRoot: string): DesignToken[]` utility in `flint-mcp/src/core/emitters/tokenLoader.ts` that:
1. Reads `configPath('design-tokens.json')` from the project root
2. Walks the DTCG tree using the same algorithm as `walkDTCG` in `tokenExtractor.ts`
3. Returns `DesignToken[]`

This avoids coupling to the init runner's stack detection and keeps the emitter pipeline self-contained.

---

## 5. Platform Emitter Architecture

### 5.1 Emitter Registry

`flint-mcp/src/core/emitters/index.ts`:

```typescript
import type { PlatformTarget, PlatformEmitter } from './types.js'
import { TailwindEmitter } from './tailwindEmitter.js'
import { CSSEmitter } from './cssEmitter.js'
import { ReactNativeEmitter } from './reactNativeEmitter.js'
import { SwiftEmitter } from './swiftEmitter.js'
import { KotlinEmitter } from './kotlinEmitter.js'

const EMITTER_REGISTRY: Record<PlatformTarget, PlatformEmitter> = {
    tailwind: new TailwindEmitter(),
    css: new CSSEmitter(),
    'react-native': new ReactNativeEmitter(),
    swift: new SwiftEmitter(),
    kotlin: new KotlinEmitter(),
}

/**
 * Get the emitter for a specific platform.
 * Throws if the platform is not registered (should never happen with PlatformTarget type).
 */
export function getEmitter(platform: PlatformTarget): PlatformEmitter {
    const emitter = EMITTER_REGISTRY[platform]
    if (!emitter) throw new Error(`No emitter registered for platform: ${platform}`)
    return emitter
}

/**
 * Get all registered platform targets.
 */
export function getAllPlatforms(): PlatformTarget[] {
    return Object.keys(EMITTER_REGISTRY) as PlatformTarget[]
}

export * from './types.js'
```

### 5.2 Per-Platform Emitter Specifications

Each emitter implements `PlatformEmitter`. All are pure functions.

#### 5.2.1 Tailwind CSS (`tailwindEmitter.ts`)

**Output filename:** `tailwind.config.ts`
**What it emits:**

```typescript
// Generated by Flint EXP.7 -- DO NOT EDIT
// Source: .flint/design-tokens.json
// Generated at: 2026-03-21T...

import type { Config } from 'tailwindcss'

export default {
    theme: {
        extend: {
            colors: {
                'brand-primary': '#3B82F6',
                'brand-secondary': '#9333EA',
            },
            spacing: {
                'base': '16px',
                'large': '32px',
            },
            fontFamily: {
                'sans': ['Inter', 'sans-serif'],
            },
            fontSize: {
                'heading-1': '2.25rem',
            },
            // ... etc.
        },
    },
} satisfies Config
```

**Token type mapping:**
- `color` -> `theme.extend.colors`
- `dimension` (with spacing/padding/margin/gap path) -> `theme.extend.spacing`
- `dimension` (with fontSize/size path) -> `theme.extend.fontSize`
- `fontFamily` -> `theme.extend.fontFamily`
- `fontWeight` -> `theme.extend.fontWeight`
- `lineHeight` -> `theme.extend.lineHeight`
- `letterSpacing` -> `theme.extend.letterSpacing`
- `shadow` -> `theme.extend.boxShadow`
- `opacity` -> `theme.extend.opacity`

**Skipped types:** `string`, `boolean` (no Tailwind equivalent)

**Validation:** Check that the output is syntactically valid TypeScript by verifying balanced braces, proper string escaping, and no undefined references.

#### 5.2.2 CSS Custom Properties (`cssEmitter.ts`)

**Output filename:** `variables.css`
**What it emits:**

```css
/* Generated by Flint EXP.7 -- DO NOT EDIT */
/* Source: .flint/design-tokens.json */
/* Generated at: 2026-03-21T... */

:root {
    /* Colors */
    --color-brand-primary: #3B82F6;
    --color-brand-secondary: #9333EA;

    /* Spacing */
    --spacing-base: 16px;
    --spacing-large: 32px;

    /* Typography */
    --font-family-sans: 'Inter', sans-serif;
    --font-size-heading-1: 2.25rem;
    --font-weight-bold: 700;
    --line-height-normal: 1.5;
    --letter-spacing-wide: 0.05em;

    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

    /* Opacity */
    --opacity-disabled: 0.5;
}
```

**Multi-mode support:** When tokens have modes (Light/Dark), emit separate blocks:

```css
:root, [data-theme="light"] {
    --color-brand-primary: #3B82F6;
}

[data-theme="dark"] {
    --color-brand-primary: #1E40AF;
}
```

**Token type mapping:** All types map to CSS custom properties. Variable name derived from `token_path` with dots replaced by hyphens, prefixed by type category.

**Skipped types:** `boolean` (no CSS equivalent)

**Validation:** Check balanced braces, valid CSS property name characters, semicolon termination.

#### 5.2.3 React Native StyleSheet (`reactNativeEmitter.ts`)

**Output filename:** `tokens.ts`
**What it emits:**

```typescript
// Generated by Flint EXP.7 -- DO NOT EDIT
// Source: .flint/design-tokens.json
// Generated at: 2026-03-21T...

import { StyleSheet } from 'react-native'

export const colors = {
    brandPrimary: '#3B82F6',
    brandSecondary: '#9333EA',
} as const

export const spacing = {
    base: 16,
    large: 32,
} as const

export const typography = {
    fontFamilySans: 'Inter',
    fontSizeHeading1: 36,
    fontWeightBold: '700',
    lineHeightNormal: 1.5 * 36,
    letterSpacingWide: 0.8,
} as const

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
} as const

export const opacity = {
    disabled: 0.5,
} as const
```

**Token type mapping:**
- `color` -> `colors` object (hex strings)
- `dimension` -> `spacing` object (numeric values in dp, strip 'px'/'rem' units, convert rem to dp at 16px base)
- `fontFamily` -> `typography` object (first family name only, no fallback stacks)
- `fontWeight` -> `typography` object (string values)
- `fontSize` -> `typography` object (numeric dp values)
- `lineHeight` -> `typography` object (numeric values)
- `letterSpacing` -> `typography` object (numeric values)
- `shadow` -> `shadows` object (parsed into React Native shadow shape)
- `opacity` -> `opacity` object (numeric 0-1)

**Skipped types:** `string`, `boolean` (no RN style equivalent)

**Validation:** Verify TypeScript syntax (balanced braces, valid identifiers).

#### 5.2.4 Swift UIColor (`swiftEmitter.ts`)

**Output filename:** `Tokens.swift`
**What it emits:**

```swift
// Generated by Flint EXP.7 -- DO NOT EDIT
// Source: .flint/design-tokens.json
// Generated at: 2026-03-21T...

import UIKit

// MARK: - Colors

extension UIColor {
    static let brandPrimary = UIColor(red: 0.231, green: 0.510, blue: 0.965, alpha: 1.0)
    static let brandSecondary = UIColor(red: 0.576, green: 0.200, blue: 0.918, alpha: 1.0)
}

// MARK: - Spacing

enum Spacing {
    static let base: CGFloat = 16.0
    static let large: CGFloat = 32.0
}

// MARK: - Typography

enum Typography {
    static let fontFamilySans = "Inter"
    static let fontSizeHeading1: CGFloat = 36.0
    static let fontWeightBold: CGFloat = 700.0
    static let lineHeightNormal: CGFloat = 1.5
    static let letterSpacingWide: CGFloat = 0.8
}

// MARK: - Opacity

enum Opacity {
    static let disabled: CGFloat = 0.5
}
```

**Token type mapping:**
- `color` -> `UIColor(red:green:blue:alpha:)` static properties (hex -> 0-1 float channels)
- `dimension` -> `CGFloat` constants in `Spacing` enum (strip units)
- `fontFamily` -> String constants in `Typography` enum
- `fontWeight`/`fontSize`/`lineHeight`/`letterSpacing` -> `CGFloat` in `Typography` enum
- `opacity` -> `CGFloat` in `Opacity` enum

**Skipped types:** `shadow` (complex struct, would need `NSShadow` -- skip in v1), `string`, `boolean`

**Validation:** Balanced braces, valid Swift identifier characters, proper float formatting.

#### 5.2.5 Kotlin Compose Color (`kotlinEmitter.ts`)

**Output filename:** `Tokens.kt`
**What it emits:**

```kotlin
// Generated by Flint EXP.7 -- DO NOT EDIT
// Source: .flint/design-tokens.json
// Generated at: 2026-03-21T...

package com.project.tokens

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// -- Colors --

object TokenColors {
    val BrandPrimary = Color(0xFF3B82F6)
    val BrandSecondary = Color(0xFF9333EA)
}

// -- Spacing --

object TokenSpacing {
    val Base = 16.dp
    val Large = 32.dp
}

// -- Typography --

object TokenTypography {
    const val FontFamilySans = "Inter"
    val FontSizeHeading1 = 36.sp
    const val FontWeightBold = 700
    val LineHeightNormal = 1.5.sp
    val LetterSpacingWide = 0.8.sp
}

// -- Opacity --

object TokenOpacity {
    const val Disabled = 0.5f
}
```

**Token type mapping:**
- `color` -> `Color(0xAARRGGBB)` values (hex -> ARGB int)
- `dimension` (spacing) -> `.dp` values
- `dimension` (font size) -> `.sp` values
- `fontFamily` -> String constants
- `fontWeight` -> Int constants
- `lineHeight`/`letterSpacing` -> `.sp` values
- `opacity` -> Float constants

**Skipped types:** `shadow` (Compose shadow is a Modifier, too complex for v1), `string`, `boolean`

**Validation:** Balanced braces, valid Kotlin identifiers, proper package declaration.

---

## 6. Cross-Platform Auditor

`flint-mcp/src/core/emitters/crossPlatformAuditor.ts`

### 6.1 Audit Logic

The auditor receives all `PlatformOutput[]` results and performs:

1. **Coverage check:** For each unique `token_path` in the input set, verify which platforms emitted it and which skipped it. Build `TokenCoverageEntry[]`.

2. **Consistency scoring:**
   - Score = (total emitted across all platforms) / (total tokens * platform count) * 100
   - Grade mapping: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

3. **Issue detection:**
   - **Missing color tokens** (severity: error): A color token exists in one platform but not another. This indicates a broken brand experience.
   - **Missing typography tokens** (severity: warning): Typography has platform-specific behavior, so gaps are expected but should be flagged.
   - **Missing spacing tokens** (severity: warning): Spacing models differ by density (mobile vs. web), but shared tokens should be consistent.
   - **Platform-specific skips** (severity: info): Tokens that legitimately do not map to a platform (e.g., `shadow` in Swift v1).

4. **Per-platform summary:** Emitted count, skipped count, coverage percentage.

### 6.2 Interface

```typescript
export function auditCrossPlatform(
    inputTokens: DesignToken[],
    outputs: PlatformOutput[],
): CrossPlatformAuditResult
```

Pure function. No I/O.

---

## 7. File Output Structure

When `dryRun` is false, the handler writes to:

```
<outputDir>/          (default: <projectRoot>/.flint/platform-tokens/)
  tailwind.config.ts  (Tailwind theme config)
  variables.css       (CSS custom properties)
  tokens.ts           (React Native StyleSheet)
  Tokens.swift        (Swift UIColor extensions)
  Tokens.kt           (Kotlin Compose Color)
  _report.json        (TokenSyncReport -- always written for audit trail)
```

The handler creates the output directory if it does not exist (`fs.mkdirSync(dir, { recursive: true })`).

**Atomic write pattern:** Since this runs in the MCP server process (not Electron renderer), `FileTransactionManager` is not available. Use the same atomic pattern: write to `<file>.tmp`, then `fs.renameSync` to the final path. This prevents partial writes on crash.

---

## 8. Token Path to Identifier Mapping

All emitters need a shared utility for converting DTCG token paths to platform-native identifiers.

```typescript
// In flint-mcp/src/core/emitters/naming.ts

/**
 * Convert a DTCG token_path to a camelCase identifier.
 * "color-tokens.brand.primary" -> "brandPrimary"
 * Strips the collection prefix and token type prefix.
 */
export function toCamelCase(tokenPath: string): string

/**
 * Convert a DTCG token_path to a kebab-case identifier.
 * "color-tokens.brand.primary" -> "brand-primary"
 */
export function toKebabCase(tokenPath: string): string

/**
 * Convert a DTCG token_path to PascalCase.
 * "color-tokens.brand.primary" -> "BrandPrimary"
 */
export function toPascalCase(tokenPath: string): string

/**
 * Convert a DTCG token_path to a CSS custom property name.
 * "color-tokens.brand.primary" -> "--color-brand-primary"
 */
export function toCSSProperty(tokenPath: string, prefix?: string): string
```

---

## 9. Token Value Conversion Utilities

Shared across emitters. Located in `flint-mcp/src/core/emitters/valueConverters.ts`.

```typescript
/**
 * Parse a hex color string into RGBA channels (0-1 scale).
 * Supports #RGB, #RRGGBB, #RRGGBBAA.
 */
export function hexToRGBA(hex: string): { r: number; g: number; b: number; a: number } | null

/**
 * Convert a CSS dimension string to a numeric value.
 * "16px" -> 16, "1.5rem" -> 24 (at 16px base), "0.5em" -> 8
 */
export function dimensionToNumber(value: string, basePx?: number): number | null

/**
 * Convert a hex color to a 0xAARRGGBB integer for Kotlin/Android.
 */
export function hexToARGBInt(hex: string): string | null

/**
 * Strip quotes from a font family string and return the first family.
 * "'Inter', sans-serif" -> "Inter"
 */
export function extractPrimaryFont(fontFamily: string): string
```

---

## 10. IPC Channels

**None.** This is an MCP-only feature. No Glass UI, no Electron IPC, no renderer involvement. The `flint_emit_tokens` tool runs entirely in the MCP server process.

If Glass integration is added in a future phase, it would use:

| Channel | Direction | Payload | Return | Phase |
|---------|-----------|---------|--------|-------|
| `flint:emit-tokens` | Renderer -> Main | `EmitTokensArgs` | `TokenSyncReport` | Future |

---

## 11. Store Contracts

**None.** No Zustand stores are affected. This is a pure MCP tool with no renderer state.

---

## 12. Component Contracts

**None.** No React components in v1.

---

## 13. Commandment Compliance

| # | Commandment | Applies? | How satisfied |
|---|-------------|----------|---------------|
| 1 | Code is Truth | No | EXP.7 generates _new_ files, not AST mutations to existing .tsx files |
| 2 | No Hallucinated Styling | No | Token values come from the canonical `design-tokens.json` source |
| 3 | Composite IDs | No | No JSX generation |
| 4 | **Local-First Only** | **Yes** | All generation is offline. No network calls. Tokens read from local `.flint/design-tokens.json`. All emitters are pure functions. No external dependencies fetched at runtime. |
| 5 | Accessibility | No | Generated files are token definitions, not UI components |
| 6 | Gatekeeper Rule | No | Export gate is for UI components, not token definition files |
| 7 | ID Preservation | No | No AST node manipulation |
| 8 | Audit-First | No | Deterministic code generation, no AI model calls |
| 9 | CIEDE2000 | No | No color drift detection (tokens are the source of truth) |
| 10 | Micro-Recovery | No | No undo operations |
| 11 | Surgical Transplants | No | No git operations |
| 12 | **Atomic Queuing** | **Yes** | File writes use atomic `.tmp` + `rename` pattern. MCP server process does not have `FileTransactionManager` (that is Electron main process), so we replicate the atomic write pattern inline. The `_report.json` and all platform files are written atomically. |
| 13 | **Deterministic Surgery** | **Yes** | Token-to-code generation is deterministic string construction from structured data. No regex on source code. No Babel needed because we are generating new files from scratch, not modifying existing source. The generation functions are pure: same input always produces same output. |
| 14 | Bypass Prohibition | Partial | MCP server process uses `fs` directly (standard for MCP tools -- see `dbom.ts`, `fix.ts`, `tokenExtractor.ts`). Not a violation because this is the MCP process, not the Electron renderer. |
| 15 | Granular AST Tools | No | Not an AI orchestrator operation |
| 16 | In-Memory Validation | No | Not AI-generated output |

---

## 14. Implementation Order

### Phase 2a -- Parallel (no dependencies between these)

| Step | File(s) | Agent | Blocks |
|------|---------|-------|--------|
| 2a.1 | `emitters/types.ts` | `flint-state-architect` | 2a.2-2a.6, 2b.1 |
| 2a.2 | `emitters/naming.ts`, `emitters/valueConverters.ts` | `flint-ast-surgeon` | 2a.3-2a.6 |

### Phase 2b -- Parallel (each emitter is independent)

_All depend on 2a.1 and 2a.2 completing first._

| Step | File(s) | Agent | Blocks |
|------|---------|-------|--------|
| 2b.1 | `emitters/tailwindEmitter.ts` + tests | `flint-ast-surgeon` + `flint-test-writer` | 2c |
| 2b.2 | `emitters/cssEmitter.ts` + tests | `flint-ast-surgeon` + `flint-test-writer` | 2c |
| 2b.3 | `emitters/reactNativeEmitter.ts` + tests | `flint-ast-surgeon` + `flint-test-writer` | 2c |
| 2b.4 | `emitters/swiftEmitter.ts` + tests | `flint-ast-surgeon` + `flint-test-writer` | 2c |
| 2b.5 | `emitters/kotlinEmitter.ts` + tests | `flint-ast-surgeon` + `flint-test-writer` | 2c |

### Phase 2c -- Sequential (depends on all emitters)

| Step | File(s) | Agent | Blocks |
|------|---------|-------|--------|
| 2c.1 | `emitters/crossPlatformAuditor.ts` + tests | `flint-ast-surgeon` + `flint-test-writer` | 2d |
| 2c.2 | `emitters/index.ts` (barrel + registry) | `flint-state-architect` | 2d |
| 2c.3 | `emitters/tokenLoader.ts` (DTCG reader) | `flint-ast-surgeon` | 2d |

### Phase 2d -- Tool wiring (depends on 2c)

| Step | File(s) | Agent | Blocks |
|------|---------|-------|--------|
| 2d.1 | `tools/emitTokens.ts` + tests | `flint-state-architect` | 2e |
| 2d.2 | `server.ts` (register tool) | `flint-state-architect` | 2e |

### Phase 2e -- TSC + full test suite

| Step | Action | Agent |
|------|--------|-------|
| 2e.1 | `npx tsc --noEmit` (0 errors) | `flint-test-writer` |
| 2e.2 | `cd flint-mcp && npm test` (all passing, report counts) | `flint-test-writer` |
| 2e.3 | `npm run test:react` (no regressions) | `flint-test-writer` |
| 2e.4 | `npm test` (no regressions) | `flint-test-writer` |

---

## 15. Test Plan

### 15.1 Per-Emitter Tests (5 test files)

Each emitter test file must cover:

1. **Happy path** -- emit a representative token set, assert output matches expected code string
2. **Empty input** -- `emit([])` returns valid code with empty definitions (no crash)
3. **Single token type** -- emit only color tokens, only spacing tokens, etc.
4. **Multi-mode** -- tokens with Light/Dark modes produce correct mode-specific output
5. **Skipped tokens** -- tokens with unsupported types for the platform appear in `skippedTokens[]`
6. **Special characters** -- token paths with hyphens, numbers, underscores produce valid identifiers
7. **Validation pass** -- `validate(output)` returns `{ valid: true }` for well-formed output
8. **Value edge cases:**
   - Color: 3-char hex, 6-char hex, 8-char hex (alpha)
   - Dimension: px, rem, em, unitless numbers, percentage values
   - Font family: single family, comma-separated list, quoted names

**Minimum: 8 tests per emitter = 40 emitter tests**

### 15.2 Cross-Platform Auditor Tests

1. **Full coverage** -- all tokens present in all platforms -> grade A, score 100
2. **Partial coverage** -- some tokens missing from some platforms -> correct grade and score
3. **No overlap** -- disjoint token sets -> grade F
4. **Single platform** -- audit with one platform output -> null audit result (tool handler returns null)
5. **Issue severity** -- missing color = error, missing typography = warning, platform skip = info
6. **Empty inputs** -- zero tokens, zero outputs

**Minimum: 8 audit tests**

### 15.3 Tool Handler Tests

1. **Dry run** -- returns `TokenSyncReport` with all outputs, no files written
2. **Write mode** -- files written to output directory (mock fs)
3. **Default platforms** -- omitting `platforms` emits all 5
4. **Single platform** -- only the requested platform is emitted
5. **Missing tokens file** -- returns error message
6. **Custom output dir** -- files written to specified directory
7. **Mode filter** -- only tokens matching the specified mode are emitted
8. **Report file** -- `_report.json` is always written (even in dryRun=false)

**Minimum: 8 handler tests**

### 15.4 Naming/Conversion Utility Tests

1. **toCamelCase** -- standard paths, edge cases (single segment, numbers)
2. **toKebabCase** -- same
3. **toPascalCase** -- same
4. **toCSSProperty** -- with and without custom prefix
5. **hexToRGBA** -- 3, 6, 8 char hex, invalid input
6. **dimensionToNumber** -- px, rem, em, unitless, invalid
7. **hexToARGBInt** -- standard hex, alpha hex
8. **extractPrimaryFont** -- quoted, unquoted, single, multiple

**Minimum: 16 utility tests**

### 15.5 Total Minimum Tests: 72

---

## 16. Risks

| Risk | Commandment | Mitigation |
|------|-------------|------------|
| Token path naming collisions across platforms | -- | Naming utility includes collision detection; test with adversarial paths |
| CSS value units not mapping cleanly to native (rem -> dp) | C13 | Conservative conversion with explicit base-px parameter; document assumptions |
| Shadow parsing is complex (CSS shorthand -> RN/Swift/Kotlin struct) | -- | v1 skips shadow for Swift and Kotlin; CSS and Tailwind pass through as strings; RN attempts basic parsing |
| Large token sets (1000+) could produce very long files | -- | Each emitter adds a `// Token count: N` header; no chunking needed (string concat is fast) |
| Multi-mode tokens create namespace collisions | -- | CSS uses `[data-theme]` selector; other platforms use mode suffix in identifier names (e.g., `brandPrimaryLight`) |
| MCP server `fs.writeFileSync` is not atomic | C12 | Mitigated by `.tmp` + `rename` pattern (same as `FileTransactionManager`) |
| Future platform additions require understanding the contract | -- | `PlatformEmitter` interface is the only contract; `index.ts` registry makes addition a 2-line change |

---

## 17. Future Extensions (Not in v1)

- **Glass UI:** Display the sync report in the right sidebar Health tab. Wire via `flint://platform-tokens` resource.
- **Watch mode:** Re-emit when `design-tokens.json` changes (via `fs.watch`).
- **Flutter/Dart emitter:** `flutterEmitter.ts` implementing `PlatformEmitter`.
- **Android XML emitter:** For pre-Compose Android projects (`colors.xml`, `dimens.xml`).
- **Figma sync trigger:** Automatically emit after `flint_sync_pull` completes.
- **Per-platform config files:** `.flint/platform-config.json` for custom package names, prefixes, output paths.
