/**
 * tailwindMigrator tests — bridge-mcp/src/core/tailwindMigrator.test.ts
 *
 * EXP.3: Comprehensive test suite for the Tailwind v3→v4 migration engine.
 *
 * Coverage:
 *   - Each deprecated class transformation in TW_V3_TO_V4_MAP
 *   - Template literals with expressions
 *   - No-op on already-v4 classes
 *   - Multiple classes on same element
 *   - Dry-run vs. write mode (write mode tested with tmp files)
 *   - Edge cases: empty className, no Tailwind classes, malformed JSX
 *   - migrateFileAtPath: file I/O round-trip
 *   - Opacity modifier sentinels (bg-opacity-X → bg-color/X)
 *   - Gradient renames (bg-gradient-to-r → bg-linear-to-r)
 *   - MigrateResult shape correctness
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { migrateFile, migrateFileAtPath, TW_V3_TO_V4_MAP } from './tailwindMigrator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap source code in a minimal TSX component for parsing. */
function wrap(jsx: string): string {
    return `export default function C() { return (${jsx}); }`
}

function tmpFile(content: string, ext = '.tsx'): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-tw-test-'))
    const filePath = path.join(dir, `test${ext}`)
    fs.writeFileSync(filePath, content, 'utf-8')
    return filePath
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('migrateFile — result shape', () => {
    it('returns correct MigrateResult fields on no-change input', () => {
        const source = wrap('<div className="p-4 flex items-center" />')
        const result = migrateFile(source)
        expect(result.originalSource).toBe(source)
        expect(result.migratedSource).toBe(source)
        expect(result.changes).toEqual([])
        expect(result.fileChanged).toBe(false)
    })

    it('sets fileChanged=true when at least one class migrated', () => {
        const source = wrap('<div className="flex-grow" />')
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(true)
        expect(result.changes.length).toBeGreaterThan(0)
    })

    it('changes array contains from/to/line/column entries', () => {
        const source = wrap('<div className="flex-grow" />')
        const result = migrateFile(source)
        expect(result.changes[0]).toMatchObject({
            from: 'flex-grow',
            to: 'grow',
        })
        expect(typeof result.changes[0].line).toBe('number')
        expect(typeof result.changes[0].column).toBe('number')
    })
})

describe('migrateFile — flex utilities', () => {
    it('transforms flex-grow → grow', () => {
        const source = wrap('<div className="flex-grow" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('grow')
        expect(result.migratedSource).not.toContain('flex-grow')
        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].from).toBe('flex-grow')
        expect(result.changes[0].to).toBe('grow')
    })

    it('transforms flex-grow-0 → grow-0', () => {
        const source = wrap('<div className="flex-grow-0" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('grow-0')
        expect(result.changes[0]).toMatchObject({ from: 'flex-grow-0', to: 'grow-0' })
    })

    it('transforms flex-shrink → shrink', () => {
        const source = wrap('<div className="flex-shrink" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('"shrink"')
        expect(result.changes[0]).toMatchObject({ from: 'flex-shrink', to: 'shrink' })
    })

    it('transforms flex-shrink-0 → shrink-0', () => {
        const source = wrap('<div className="flex-shrink-0" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('shrink-0')
        expect(result.changes[0]).toMatchObject({ from: 'flex-shrink-0', to: 'shrink-0' })
    })
})

describe('migrateFile — text / overflow utilities', () => {
    it('transforms overflow-ellipsis → text-ellipsis', () => {
        const source = wrap('<p className="overflow-ellipsis" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('text-ellipsis')
        expect(result.changes[0]).toMatchObject({ from: 'overflow-ellipsis', to: 'text-ellipsis' })
    })

    it('transforms overflow-clip → text-clip', () => {
        const source = wrap('<p className="overflow-clip" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('text-clip')
        expect(result.changes[0]).toMatchObject({ from: 'overflow-clip', to: 'text-clip' })
    })
})

describe('migrateFile — box decoration utilities', () => {
    it('transforms decoration-clone → box-decoration-clone', () => {
        const source = wrap('<span className="decoration-clone" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('box-decoration-clone')
        expect(result.changes[0]).toMatchObject({
            from: 'decoration-clone',
            to: 'box-decoration-clone',
        })
    })

    it('transforms decoration-slice → box-decoration-slice', () => {
        const source = wrap('<span className="decoration-slice" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('box-decoration-slice')
        expect(result.changes[0]).toMatchObject({
            from: 'decoration-slice',
            to: 'box-decoration-slice',
        })
    })
})

describe('migrateFile — bg-opacity-X sentinel replacements', () => {
    it('transforms bg-opacity-50 → bg-color/50', () => {
        const source = wrap('<div className="bg-blue-500 bg-opacity-50" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('bg-color/50')
        expect(result.changes.find(c => c.from === 'bg-opacity-50')).toBeDefined()
    })

    it('transforms bg-opacity-0 → bg-color/0', () => {
        const source = wrap('<div className="bg-opacity-0" />')
        const result = migrateFile(source)
        expect(result.changes[0]).toMatchObject({ from: 'bg-opacity-0', to: 'bg-color/0' })
    })

    it('transforms bg-opacity-100 → bg-color/100', () => {
        const source = wrap('<div className="bg-opacity-100" />')
        const result = migrateFile(source)
        expect(result.changes[0]).toMatchObject({ from: 'bg-opacity-100', to: 'bg-color/100' })
    })
})

describe('migrateFile — text-opacity-X sentinel replacements', () => {
    it('transforms text-opacity-50 → text-color/50', () => {
        const source = wrap('<p className="text-gray-900 text-opacity-50" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('text-color/50')
        expect(result.changes.find(c => c.from === 'text-opacity-50')).toBeDefined()
    })

    it('transforms text-opacity-75 → text-color/75', () => {
        const source = wrap('<p className="text-opacity-75" />')
        const result = migrateFile(source)
        expect(result.changes[0]).toMatchObject({ from: 'text-opacity-75', to: 'text-color/75' })
    })
})

describe('migrateFile — border-opacity-X sentinel replacements', () => {
    it('transforms border-opacity-25 → border-color/25', () => {
        const source = wrap('<div className="border border-opacity-25" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('border-color/25')
    })
})

describe('migrateFile — gradient renames', () => {
    it('transforms bg-gradient-to-r → bg-linear-to-r', () => {
        const source = wrap('<div className="bg-gradient-to-r from-blue-500 to-red-500" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('bg-linear-to-r')
        expect(result.changes[0]).toMatchObject({
            from: 'bg-gradient-to-r',
            to: 'bg-linear-to-r',
        })
    })

    it('transforms bg-gradient-to-br → bg-linear-to-br', () => {
        const source = wrap('<div className="bg-gradient-to-br" />')
        const result = migrateFile(source)
        expect(result.changes[0]).toMatchObject({ from: 'bg-gradient-to-br', to: 'bg-linear-to-br' })
    })

    it('transforms all 8 gradient directions', () => {
        const directions = ['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl']
        for (const dir of directions) {
            const source = wrap(`<div className="bg-gradient-to-${dir}" />`)
            const result = migrateFile(source)
            expect(result.changes[0]).toMatchObject({
                from: `bg-gradient-to-${dir}`,
                to: `bg-linear-to-${dir}`,
            })
        }
    })
})

describe('migrateFile — outline-none → outline-hidden', () => {
    it('transforms outline-none → outline-hidden', () => {
        const source = wrap('<button className="outline-none focus:ring-2" />')
        const result = migrateFile(source)
        expect(result.migratedSource).toContain('outline-hidden')
        expect(result.changes[0]).toMatchObject({ from: 'outline-none', to: 'outline-hidden' })
    })
})

describe('migrateFile — shadow renames', () => {
    it('transforms shadow-sm → shadow-xs', () => {
        const source = wrap('<div className="shadow-sm" />')
        const result = migrateFile(source)
        expect(result.changes[0]).toMatchObject({ from: 'shadow-sm', to: 'shadow-xs' })
    })

    it('transforms drop-shadow-sm → drop-shadow-xs', () => {
        const source = wrap('<div className="drop-shadow-sm" />')
        const result = migrateFile(source)
        expect(result.changes[0]).toMatchObject({ from: 'drop-shadow-sm', to: 'drop-shadow-xs' })
    })
})

describe('migrateFile — multiple classes on same element', () => {
    it('migrates all deprecated classes in a single className', () => {
        const source = wrap(
            '<div className="flex-grow flex-shrink overflow-ellipsis decoration-clone" />'
        )
        const result = migrateFile(source)
        expect(result.changes).toHaveLength(4)
        expect(result.migratedSource).toContain('grow')
        expect(result.migratedSource).toContain('shrink')
        expect(result.migratedSource).toContain('text-ellipsis')
        expect(result.migratedSource).toContain('box-decoration-clone')
    })

    it('migrates deprecated classes while leaving v4-valid classes untouched', () => {
        const source = wrap('<div className="flex items-center flex-grow gap-4 p-2" />')
        const result = migrateFile(source)
        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].from).toBe('flex-grow')
        expect(result.migratedSource).toContain('flex')
        expect(result.migratedSource).toContain('items-center')
        expect(result.migratedSource).toContain('gap-4')
        expect(result.migratedSource).toContain('p-2')
    })

    it('handles multiple deprecated classes spread across multiple elements', () => {
        const source = `
export default function C() {
  return (
    <div className="flex-grow">
      <p className="overflow-ellipsis text-opacity-50" />
    </div>
  );
}`
        const result = migrateFile(source)
        expect(result.changes).toHaveLength(3)
        const froms = result.changes.map(c => c.from)
        expect(froms).toContain('flex-grow')
        expect(froms).toContain('overflow-ellipsis')
        expect(froms).toContain('text-opacity-50')
    })
})

describe('migrateFile — template literals', () => {
    it('migrates classes in static template literal quasis', () => {
        const source = wrap('<div className={`flex-grow p-4`} />')
        const result = migrateFile(source)
        expect(result.changes.some(c => c.from === 'flex-grow')).toBe(true)
    })

    it('migrates static parts of template literal with expressions', () => {
        const source = wrap('<div className={`px-4 ${dynamic} bg-opacity-50`} />')
        const result = migrateFile(source)
        expect(result.changes.some(c => c.from === 'bg-opacity-50')).toBe(true)
    })

    it('leaves expression slots in template literals untouched', () => {
        const source = wrap('<div className={`px-4 ${someVar} flex-shrink`} />')
        const result = migrateFile(source)
        // Only flex-shrink should be migrated; someVar expression is not a static quasi
        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].from).toBe('flex-shrink')
    })

    it('handles template literal with no deprecated classes', () => {
        const source = wrap('<div className={`p-4 text-sm font-bold`} />')
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(false)
        expect(result.changes).toHaveLength(0)
    })
})

describe('migrateFile — expression container with string literal', () => {
    it('migrates className={"flex-grow"}', () => {
        const source = wrap('<div className={"flex-grow"} />')
        const result = migrateFile(source)
        expect(result.changes).toHaveLength(1)
        expect(result.changes[0]).toMatchObject({ from: 'flex-grow', to: 'grow' })
    })
})

describe('migrateFile — no-op cases', () => {
    it('returns unchanged source when no deprecated classes present', () => {
        const source = wrap('<div className="flex p-4 text-sm font-bold rounded-lg" />')
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(false)
        expect(result.changes).toHaveLength(0)
        expect(result.migratedSource).toBe(source)
    })

    it('is a no-op on v4 class names that replaced v3 ones', () => {
        const source = wrap('<div className="grow shrink text-ellipsis" />')
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(false)
    })

    it('does not migrate non-className attributes', () => {
        const source = wrap('<div id="flex-grow" data-class="bg-opacity-50" />')
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(false)
    })
})

describe('migrateFile — edge cases', () => {
    it('handles empty className string', () => {
        const source = wrap('<div className="" />')
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(false)
        expect(result.changes).toHaveLength(0)
    })

    it('handles component with no className at all', () => {
        const source = wrap('<div id="root"><p>Hello</p></div>')
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(false)
    })

    it('handles malformed JSX gracefully — returns original source unchanged', () => {
        const source = '<div className="flex-grow"'   // missing closing >
        const result = migrateFile(source)
        // Should return original, not throw
        expect(result.originalSource).toBe(source)
        expect(result.fileChanged).toBe(false)
    })

    it('handles empty source string', () => {
        const result = migrateFile('')
        expect(result.fileChanged).toBe(false)
        expect(result.changes).toHaveLength(0)
    })

    it('handles source with no JSX', () => {
        const source = 'export const x = 42;'
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(false)
    })
})

describe('migrateFile — dry-run mode (default)', () => {
    it('dryRun=true does not write to disk even when filePath is provided', () => {
        const filePath = tmpFile(wrap('<div className="flex-grow" />'))
        const originalContent = fs.readFileSync(filePath, 'utf-8')

        const result = migrateFile(fs.readFileSync(filePath, 'utf-8'), { dryRun: true, filePath })
        expect(result.fileChanged).toBe(true)
        expect(result.changes).toHaveLength(1)

        // File on disk must be unchanged
        const afterContent = fs.readFileSync(filePath, 'utf-8')
        expect(afterContent).toBe(originalContent)

        // Cleanup
        fs.unlinkSync(filePath)
        fs.rmdirSync(path.dirname(filePath))
    })

    it('default options imply dryRun=true', () => {
        const filePath = tmpFile(wrap('<div className="flex-shrink" />'))
        const original = fs.readFileSync(filePath, 'utf-8')

        migrateFile(original, { filePath })  // no dryRun specified — defaults to true

        const after = fs.readFileSync(filePath, 'utf-8')
        expect(after).toBe(original)

        fs.unlinkSync(filePath)
        fs.rmdirSync(path.dirname(filePath))
    })
})

describe('migrateFile — write mode', () => {
    it('dryRun=false writes migrated content to disk', () => {
        const source = wrap('<div className="flex-grow" />')
        const filePath = tmpFile(source)

        const result = migrateFile(source, { dryRun: false, filePath })
        expect(result.fileChanged).toBe(true)

        const written = fs.readFileSync(filePath, 'utf-8')
        expect(written).toBe(result.migratedSource)
        expect(written).not.toBe(source)

        fs.unlinkSync(filePath)
        fs.rmdirSync(path.dirname(filePath))
    })

    it('dryRun=false does not write if no changes', () => {
        const source = wrap('<div className="flex p-4" />')
        const filePath = tmpFile(source)

        const result = migrateFile(source, { dryRun: false, filePath })
        expect(result.fileChanged).toBe(false)
        // File should still be original (write is guarded by fileChanged)
        const after = fs.readFileSync(filePath, 'utf-8')
        expect(after).toBe(source)

        fs.unlinkSync(filePath)
        fs.rmdirSync(path.dirname(filePath))
    })
})

describe('migrateFileAtPath', () => {
    it('reads file, migrates, returns result in dry-run mode', () => {
        const source = wrap('<div className="flex-grow overflow-ellipsis" />')
        const filePath = tmpFile(source)

        const result = migrateFileAtPath(filePath, { dryRun: true })
        expect(result.fileChanged).toBe(true)
        expect(result.changes).toHaveLength(2)

        // File unchanged in dry-run
        const after = fs.readFileSync(filePath, 'utf-8')
        expect(after).toBe(source)

        fs.unlinkSync(filePath)
        fs.rmdirSync(path.dirname(filePath))
    })

    it('writes migrated file when dryRun=false', () => {
        const source = wrap('<div className="decoration-clone" />')
        const filePath = tmpFile(source)

        const result = migrateFileAtPath(filePath, { dryRun: false })
        expect(result.fileChanged).toBe(true)

        const written = fs.readFileSync(filePath, 'utf-8')
        expect(written).toContain('box-decoration-clone')

        fs.unlinkSync(filePath)
        fs.rmdirSync(path.dirname(filePath))
    })

    it('handles file with no deprecated classes correctly', () => {
        const source = wrap('<div className="flex p-4 text-sm" />')
        const filePath = tmpFile(source)

        const result = migrateFileAtPath(filePath, { dryRun: false })
        expect(result.fileChanged).toBe(false)
        expect(result.changes).toHaveLength(0)

        const after = fs.readFileSync(filePath, 'utf-8')
        expect(after).toBe(source)

        fs.unlinkSync(filePath)
        fs.rmdirSync(path.dirname(filePath))
    })
})

describe('TW_V3_TO_V4_MAP — map integrity', () => {
    it('is a non-empty readonly object', () => {
        expect(Object.keys(TW_V3_TO_V4_MAP).length).toBeGreaterThan(0)
    })

    it('contains all expected flex keys', () => {
        expect(TW_V3_TO_V4_MAP['flex-grow']).toBe('grow')
        expect(TW_V3_TO_V4_MAP['flex-grow-0']).toBe('grow-0')
        expect(TW_V3_TO_V4_MAP['flex-shrink']).toBe('shrink')
        expect(TW_V3_TO_V4_MAP['flex-shrink-0']).toBe('shrink-0')
    })

    it('contains all expected text overflow keys', () => {
        expect(TW_V3_TO_V4_MAP['overflow-ellipsis']).toBe('text-ellipsis')
        expect(TW_V3_TO_V4_MAP['overflow-clip']).toBe('text-clip')
    })

    it('contains all 8 gradient keys', () => {
        const dirs = ['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl']
        for (const dir of dirs) {
            expect(TW_V3_TO_V4_MAP[`bg-gradient-to-${dir}`]).toBe(`bg-linear-to-${dir}`)
        }
    })

    it('contains opacity modifier keys for all standard values', () => {
        const standardValues = [0, 5, 10, 25, 50, 75, 100]
        for (const v of standardValues) {
            expect(TW_V3_TO_V4_MAP[`bg-opacity-${v}`]).toBe(`bg-color/${v}`)
            expect(TW_V3_TO_V4_MAP[`text-opacity-${v}`]).toBe(`text-color/${v}`)
            expect(TW_V3_TO_V4_MAP[`border-opacity-${v}`]).toBe(`border-color/${v}`)
        }
    })

    it('shadow-sm maps to shadow-xs', () => {
        expect(TW_V3_TO_V4_MAP['shadow-sm']).toBe('shadow-xs')
    })

    it('outline-none maps to outline-hidden', () => {
        expect(TW_V3_TO_V4_MAP['outline-none']).toBe('outline-hidden')
    })
})

describe('migrateFile — from/to option validation', () => {
    it('accepts default (no from/to) and migrates correctly', () => {
        const source = wrap('<div className="flex-grow" />')
        const result = migrateFile(source, {})
        expect(result.fileChanged).toBe(true)
    })

    it('accepts from="3" to="4" and migrates correctly', () => {
        const source = wrap('<div className="flex-shrink" />')
        const result = migrateFile(source, { from: '3', to: '4' })
        expect(result.fileChanged).toBe(true)
        expect(result.changes[0].from).toBe('flex-shrink')
    })
})

describe('migrateFile — realistic component', () => {
    it('migrates a realistic component with mixed v3 and v4 classes', () => {
        const source = `
export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-6 shadow-sm bg-white rounded-xl">
      <div className="flex-grow overflow-hidden">
        <p className="text-opacity-75 overflow-ellipsis truncate">
          {children}
        </p>
      </div>
      <button className="outline-none flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600">
        Action
      </button>
    </div>
  );
}`
        const result = migrateFile(source)
        expect(result.fileChanged).toBe(true)
        const froms = result.changes.map(c => c.from)
        expect(froms).toContain('shadow-sm')
        expect(froms).toContain('flex-grow')
        expect(froms).toContain('text-opacity-75')
        expect(froms).toContain('overflow-ellipsis')
        expect(froms).toContain('outline-none')
        expect(froms).toContain('flex-shrink-0')
        expect(froms).toContain('bg-gradient-to-r')

        // v4 replacements present
        expect(result.migratedSource).toContain('shadow-xs')
        expect(result.migratedSource).toContain('grow')
        expect(result.migratedSource).toContain('text-color/75')
        expect(result.migratedSource).toContain('text-ellipsis')
        expect(result.migratedSource).toContain('outline-hidden')
        expect(result.migratedSource).toContain('shrink-0')
        expect(result.migratedSource).toContain('bg-linear-to-r')

        // v4-native classes must be preserved
        expect(result.migratedSource).toContain('flex')
        expect(result.migratedSource).toContain('flex-col')
        expect(result.migratedSource).toContain('gap-4')
        expect(result.migratedSource).toContain('p-6')
        expect(result.migratedSource).toContain('rounded-xl')
        expect(result.migratedSource).toContain('truncate')
    })
})
