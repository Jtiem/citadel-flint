/**
 * Tailwind CSS library adapter.
 *
 * Thin adapter wrapper around the existing TailwindEmitter (EXP.7) to present
 * it through the LibraryAdapter interface. This ensures Tailwind can be
 * selected alongside PrimeNG, shadcn, and MUI through the unified
 * `flint_map_tokens` tool.
 *
 * The actual token → Tailwind mapping logic lives in ../emitters/tailwindEmitter.ts.
 */

import type { DesignToken } from '../../types.js'
import type {
    LibraryAdapter,
    LibraryMatchResult,
    LibraryThemeOutput,
    MapOptions,
    ValidationResult,
} from './types.js'
import { filterTokens } from './types.js'
import { TailwindEmitter } from '../emitters/tailwindEmitter.js'

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class TailwindAdapter implements LibraryAdapter {
    readonly library = 'tailwind' as const
    readonly defaultFilename = 'tailwind.config.ts'
    readonly displayName = 'Tailwind CSS'
    readonly description =
        'Generates a tailwind.config.ts theme extension to match your Figma design.'

    private readonly emitter = new TailwindEmitter()

    mapTokens(tokens: DesignToken[], options?: MapOptions): LibraryThemeOutput {
        const filtered = filterTokens(tokens, options)

        // Delegate to the existing emitter
        const emitterOutput = this.emitter.emit(filtered, {
            mode: options?.mode,
            collection: options?.collection,
        })

        // Build token map from the emitter output
        const tokenMap: Record<string, string> = {}
        for (const token of filtered) {
            tokenMap[token.token_path] = token.token_value
        }

        return {
            library: 'tailwind',
            code: emitterOutput.code,
            filename: emitterOutput.filename,
            tokenCount: emitterOutput.tokenCount,
            skippedTokens: emitterOutput.skippedTokens.map(s => ({
                tokenPath: s.tokenPath,
                tokenType: s.tokenType,
                reason: s.reason,
            })),
            mimeType: emitterOutput.mimeType,
            tokenMap,
        }
    }

    validate(output: LibraryThemeOutput): ValidationResult {
        // Delegate to the existing emitter's validator
        const emitterValidation = this.emitter.validate({
            platform: 'tailwind',
            code: output.code,
            filename: output.filename,
            tokenCount: output.tokenCount,
            skippedTokens: output.skippedTokens.map(s => ({
                tokenPath: s.tokenPath,
                tokenType: s.tokenType,
                reason: s.reason,
            })),
            mimeType: output.mimeType,
        })
        return emitterValidation
    }

    // -----------------------------------------------------------------------
    // seedTokens — Tailwind CSS v4 canonical base design tokens
    // -----------------------------------------------------------------------

    seedTokens(): DesignToken[] {
        const color = (
            id: number,
            path: string,
            value: string,
            description: string,
        ): DesignToken => ({
            id,
            token_path: `tailwind.${path}`,
            token_type: 'color',
            token_value: value,
            description,
            collection_name: 'tailwind',
            mode: 'default',
        })

        const dimension = (
            id: number,
            path: string,
            value: string,
            description: string,
        ): DesignToken => ({
            id,
            token_path: `tailwind.${path}`,
            token_type: 'dimension',
            token_value: value,
            description,
            collection_name: 'tailwind',
            mode: 'default',
        })

        return [
            // Source: Tailwind CSS v4 default theme
            // Ref: https://tailwindcss.com/docs/theme

            // Slate scale
            color(1,  'colors.slate.50',   '#f8fafc', 'Slate 50'),
            color(2,  'colors.slate.100',  '#f1f5f9', 'Slate 100'),
            color(3,  'colors.slate.200',  '#e2e8f0', 'Slate 200'),
            color(4,  'colors.slate.300',  '#cbd5e1', 'Slate 300'),
            color(5,  'colors.slate.400',  '#94a3b8', 'Slate 400'),
            color(6,  'colors.slate.500',  '#64748b', 'Slate 500'),
            color(7,  'colors.slate.600',  '#475569', 'Slate 600'),
            color(8,  'colors.slate.700',  '#334155', 'Slate 700'),
            color(9,  'colors.slate.800',  '#1e293b', 'Slate 800'),
            color(10, 'colors.slate.900',  '#0f172a', 'Slate 900'),
            color(11, 'colors.slate.950',  '#020617', 'Slate 950'),

            // Blue
            color(12, 'colors.blue.500',   '#3b82f6', 'Blue 500'),
            color(13, 'colors.blue.600',   '#2563eb', 'Blue 600'),
            color(14, 'colors.blue.700',   '#1d4ed8', 'Blue 700'),

            // Red
            color(15, 'colors.red.500',    '#ef4444', 'Red 500'),
            color(16, 'colors.red.600',    '#dc2626', 'Red 600'),

            // Green
            color(17, 'colors.green.500',  '#22c55e', 'Green 500'),
            color(18, 'colors.green.600',  '#16a34a', 'Green 600'),

            // Yellow
            color(19, 'colors.yellow.500', '#eab308', 'Yellow 500'),
            color(20, 'colors.yellow.600', '#ca8a04', 'Yellow 600'),

            // Spacing
            dimension(21, 'spacing.0',     '0px',      'No spacing'),
            dimension(22, 'spacing.1',     '0.25rem',  'Spacing 1 (4px)'),
            dimension(23, 'spacing.2',     '0.5rem',   'Spacing 2 (8px)'),
            dimension(24, 'spacing.3',     '0.75rem',  'Spacing 3 (12px)'),
            dimension(25, 'spacing.4',     '1rem',     'Spacing 4 (16px)'),
            dimension(26, 'spacing.6',     '1.5rem',   'Spacing 6 (24px)'),
            dimension(27, 'spacing.8',     '2rem',     'Spacing 8 (32px)'),

            // Border radius
            dimension(28, 'borderRadius.xs',   '0.125rem', 'Extra-small border radius'),
            dimension(29, 'borderRadius.sm',   '0.25rem',  'Small border radius'),
            dimension(30, 'borderRadius.md',   '0.375rem', 'Medium border radius'),
            dimension(31, 'borderRadius.lg',   '0.5rem',   'Large border radius'),
            dimension(32, 'borderRadius.xl',   '0.75rem',  'Extra-large border radius'),
            dimension(33, 'borderRadius.full', '9999px',   'Full (pill) border radius'),

            // Font family
            {
                id: 34,
                token_path: 'tailwind.fontFamily.sans',
                token_type: 'fontFamily',
                token_value: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
                description: 'Default sans-serif font stack',
                collection_name: 'tailwind',
                mode: 'default',
            },

            // Shadows
            {
                id: 35,
                token_path: 'tailwind.shadow.2xs',
                token_type: 'shadow',
                token_value: '0 1px rgb(0 0 0 / 0.05)',
                description: 'Extra-extra-small shadow',
                collection_name: 'tailwind',
                mode: 'default',
            },
            {
                id: 36,
                token_path: 'tailwind.shadow.xs',
                token_type: 'shadow',
                token_value: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                description: 'Extra-small shadow',
                collection_name: 'tailwind',
                mode: 'default',
            },
            {
                id: 37,
                token_path: 'tailwind.shadow.sm',
                token_type: 'shadow',
                token_value: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                description: 'Small box shadow',
                collection_name: 'tailwind',
                mode: 'default',
            },
            {
                id: 38,
                token_path: 'tailwind.shadow.md',
                token_type: 'shadow',
                token_value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                description: 'Medium box shadow',
                collection_name: 'tailwind',
                mode: 'default',
            },
        ]
    }

    // -----------------------------------------------------------------------
    // getIdiomBlock — AI prompt constraints for Tailwind CSS
    // -----------------------------------------------------------------------

    getIdiomBlock(): string {
        return [
            '## Active Library: Tailwind CSS',
            '',
            '**Styling:** Use utility classes directly in `className` props. No CSS files needed.',
            '**Layout:** Use `flex`, `grid`, `gap-*`, `p-*`, `m-*` utilities for layout.',
            '**Rules:**',
            '- Do NOT use inline `style={{}}` props. Use Tailwind utility classes exclusively.',
            '- Do NOT use arbitrary values (e.g., `w-[347px]`) when a standard utility exists.',
            '- Use `@apply` sparingly — prefer utility classes in JSX.',
            '- Use design token colors from `tailwind.config.ts` — do NOT hardcode hex values in className.',
            '- Prefer responsive utilities (`md:`, `lg:`) over media queries.',
            '- Use `dark:` variant for dark mode styles.',
        ].join('\n')
    }

    // -----------------------------------------------------------------------
    // matchTokens — reverse detection scoring (intentionally low ceiling)
    // -----------------------------------------------------------------------

    matchTokens(tokens: DesignToken[]): LibraryMatchResult {
        let score = 0
        const reasons: string[] = []
        const paths = tokens.map(t => t.token_path.toLowerCase())

        // Tailwind shade scale: colors.*.50 through colors.*.950
        const shadePattern = /colors\.\w+\.(50|100|200|300|400|500|600|700|800|900|950)$/
        if (paths.some(p => shadePattern.test(p))) {
            score += 15
            reasons.push('Found Tailwind-style color shade scale (50-950)')
        }

        // Spacing with numeric keys (spacing.0 through spacing.12)
        const spacingPattern = /spacing\.\d+$/
        if (paths.some(p => spacingPattern.test(p))) {
            score += 15
            reasons.push('Found numeric spacing tokens (spacing.N)')
        }

        // Border radius sm/md/lg/xl/full
        const radiusPattern = /borderradius\.(sm|md|lg|xl|full)$/
        if (paths.some(p => radiusPattern.test(p))) {
            score += 10
            reasons.push('Found Tailwind-style borderRadius size tokens')
        }

        // Font family sans or mono
        const fontPattern = /fontfamily\.(sans|mono)$/
        if (paths.some(p => fontPattern.test(p))) {
            score += 10
            reasons.push('Found fontFamily.sans or fontFamily.mono token')
        }

        // Shadow sm/md/lg/xl
        const shadowPattern = /shadow\.(sm|md|lg|xl)$/
        if (paths.some(p => shadowPattern.test(p))) {
            score += 10
            reasons.push('Found Tailwind-style shadow size tokens')
        }

        // Baseline: any color tokens present
        if (tokens.some(t => t.token_type === 'color')) {
            score += 5
            reasons.push('Color tokens present (baseline signal)')
        }

        // Cap at 65 — Tailwind is the generic fallback, should not outscore
        // library-specific adapters
        score = Math.min(score, 65)

        return { score, reasons }
    }
}

export function createTailwindAdapter(): TailwindAdapter {
    return new TailwindAdapter()
}
