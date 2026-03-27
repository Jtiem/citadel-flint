/**
 * vendor.d.ts — ambient module declarations for packages that ship without
 * bundled TypeScript types and for which @types/* packages are not installed.
 *
 * Add entries here rather than installing @types packages when the package is
 * only used in a narrow context (a few call-sites in electron/).
 */

declare module 'js-yaml' {
    /**
     * Parse a YAML string and return the parsed JavaScript value.
     * Returns null when the document is empty.
     */
    export function load(input: string, options?: Record<string, unknown>): unknown

    /**
     * Serialize a JavaScript value to a YAML string.
     */
    export function dump(
        obj: unknown,
        options?: {
            indent?: number
            lineWidth?: number
            noRefs?: boolean
            sortKeys?: boolean
        },
    ): string
}
