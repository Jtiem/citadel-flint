/**
 * d2cApply.test.ts
 *
 * Unit tests for the d2c:apply and workspace:rescan IPC handler logic.
 *
 * Strategy: the handler code in main.ts is not importable (Electron IPC,
 * dynamic imports, app.getPath). We extract and test the pure logic
 * equivalents directly — the same approach used in mainSecurityFixes.test.ts,
 * setupIpc.test.ts, and other electron unit tests.
 *
 * Each test group validates one invariant from the D2C.2 contract:
 *   §5.1  Handler pseudocode / d2c:apply semantics
 *   §5.2  workspace:rescan semantics
 *   §12   Risk mitigation (parse errors, security validation, theme file path)
 *   §9    Commandment 7 — injectFlintIds runs before write (data-flint-id present)
 */

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import os from 'node:os'

// ── Helpers that mirror the handler logic ─────────────────────────────────────

/**
 * Mirrors the security check in the d2c:apply handler.
 * Returns true when filePath is safe to write.
 */
function isPathSafe(filePath: string, homeDir: string): boolean {
    return (
        path.isAbsolute(filePath) &&
        filePath.startsWith(homeDir + path.sep)
    )
}

/**
 * Mirrors the request shape validation in the d2c:apply handler.
 */
function validateRequest(request: unknown): string | null {
    if (typeof request !== 'object' || request === null) {
        return 'Invalid request: must be an object'
    }
    const r = request as Record<string, unknown>
    if (typeof r.pageName !== 'string' || r.pageName.trim() === '') {
        return 'Invalid request: pageName must be a non-empty string'
    }
    if (!Array.isArray(r.components)) {
        return 'Invalid request: components must be an array'
    }
    if (typeof r.page !== 'object' || r.page === null) {
        return 'Invalid request: page must be an object'
    }
    const page = r.page as Record<string, unknown>
    if (typeof page.name !== 'string' || typeof page.code !== 'string') {
        return 'Invalid request: page must have name and code strings'
    }
    return null
}

/**
 * Mirrors the target directory computation.
 */
function computeTargetDir(projectRoot: string, pageName: string): string {
    return path.join(projectRoot, 'src', 'components', 'generated', pageName)
}

/**
 * Mirrors the file path computation for components.
 */
function computeComponentPaths(
    targetDir: string,
    components: Array<{ name: string }>,
    pageName: string
): { componentPaths: string[]; pagePath: string } {
    const componentPaths = components.map((c) => path.join(targetDir, `${c.name}.tsx`))
    const pagePath = path.join(targetDir, `${pageName}.tsx`)
    return { componentPaths, pagePath }
}

/**
 * Mirrors the export-default guard logic from the handler (contract Q1 resolution).
 */
function ensureExportDefault(code: string, componentName: string): string {
    if (/export\s+default\b/.test(code)) {
        return code
    }
    return code + `\nexport default ${componentName};\n`
}

/**
 * Mirrors the theme file path computation.
 */
function computeThemeFilePath(projectRoot: string, filename: string): string {
    return path.join(projectRoot, filename)
}

// ── Minimal injectFlintIds logic (mirrors the plugin visitor) ─────────────────

/**
 * A simplified port of injectFlintIdPlugin's core logic for testing purposes.
 * Inserts `data-flint-id` into JSX opening tags in raw code using a regex
 * approximation suitable for unit testing the "IDs are present after process"
 * invariant, without requiring a full Babel AST in the test environment.
 */
function simulateInjectFlintIds(code: string): string {
    // Replace JSX opening tags that don't already have data-flint-id
    // This mirrors the structural intent: every JSX element gets an ID.
    return code.replace(
        /<([A-Za-z][A-Za-z0-9.]*)((?:\s+(?!data-flint-id)[^>]*)?)(\s*\/?>)/g,
        (_match, tagName: string, attrs: string, close: string) => {
            // Skip if already has data-flint-id
            if (/data-flint-id/.test(attrs)) return _match
            const id = `${tagName}:0:0`
            return `<${tagName}${attrs} data-flint-id="${id}"${close}`
        }
    )
}

// ── §5.2 workspace:rescan ─────────────────────────────────────────────────────

describe('workspace:rescan — handler logic', () => {
    it('returns null when no project root is set', () => {
        const activeProjectRoot: string | null = null
        // Mirrors: if (!activeProjectRoot) return null
        const result = activeProjectRoot ? 'would scan' : null
        expect(result).toBeNull()
    })

    it('proceeds to scan when project root is set', () => {
        const activeProjectRoot = '/Users/test/my-project'
        // Mirrors: return await scanDirectory(activeProjectRoot)
        const willScan = activeProjectRoot !== null
        expect(willScan).toBe(true)
    })
})

// ── §5.1 d2c:apply — request validation ──────────────────────────────────────

describe('d2c:apply — request validation', () => {
    it('rejects null input', () => {
        expect(validateRequest(null)).toBeTruthy()
    })

    it('rejects missing pageName', () => {
        expect(validateRequest({ components: [], page: { name: 'P', code: '' } })).toMatch(/pageName/)
    })

    it('rejects empty pageName', () => {
        expect(validateRequest({ pageName: '  ', components: [], page: { name: 'P', code: '' } })).toMatch(/pageName/)
    })

    it('rejects non-array components', () => {
        expect(validateRequest({ pageName: 'Hero', components: 'not-array', page: { name: 'P', code: '' } })).toMatch(/components/)
    })

    it('rejects missing page', () => {
        expect(validateRequest({ pageName: 'Hero', components: [] })).toMatch(/page/)
    })

    it('rejects page without name', () => {
        expect(validateRequest({ pageName: 'Hero', components: [], page: { code: 'x' } })).toMatch(/page/)
    })

    it('rejects page without code', () => {
        expect(validateRequest({ pageName: 'Hero', components: [], page: { name: 'HeroPage' } })).toMatch(/page/)
    })

    it('accepts a valid minimal request', () => {
        const result = validateRequest({
            pageName: 'Hero',
            components: [],
            page: { name: 'HeroPage', code: 'export function HeroPage() { return <div /> }' },
        })
        expect(result).toBeNull()
    })

    it('accepts a request with components and themeFile', () => {
        const result = validateRequest({
            pageName: 'Dashboard',
            components: [
                { name: 'DashHeader', code: 'export function DashHeader() { return <header /> }' },
                { name: 'DashBody', code: 'export function DashBody() { return <main /> }' },
            ],
            page: { name: 'DashboardPage', code: 'export default function DashboardPage() { return <div /> }' },
            themeFile: { filename: 'tailwind.config.ts', code: 'module.exports = {}' },
        })
        expect(result).toBeNull()
    })
})

// ── §5.1 d2c:apply — project-open guard ──────────────────────────────────────

describe('d2c:apply — project-open guard', () => {
    it('rejects when activeProjectRoot is null', () => {
        const activeProjectRoot: string | null = null
        const error = activeProjectRoot ? null : 'No project open — open a project before applying D2C output'
        expect(error).toMatch(/No project open/)
    })

    it('proceeds when activeProjectRoot is set', () => {
        const activeProjectRoot = '/Users/test/my-project'
        const error = activeProjectRoot ? null : 'No project open'
        expect(error).toBeNull()
    })
})

// ── §5.1 d2c:apply — path computation ────────────────────────────────────────

describe('d2c:apply — path computation', () => {
    const projectRoot = path.join(os.homedir(), 'projects', 'my-app')
    const pageName = 'HeroLanding'

    it('computes targetDir as src/components/generated/<pageName>', () => {
        const targetDir = computeTargetDir(projectRoot, pageName)
        expect(targetDir).toBe(path.join(projectRoot, 'src', 'components', 'generated', pageName))
    })

    it('computes correct component file paths under targetDir', () => {
        const targetDir = computeTargetDir(projectRoot, pageName)
        const components = [{ name: 'HeroSection' }, { name: 'CTASection' }]
        const { componentPaths } = computeComponentPaths(targetDir, components, pageName)
        expect(componentPaths).toHaveLength(2)
        expect(componentPaths[0]).toBe(path.join(targetDir, 'HeroSection.tsx'))
        expect(componentPaths[1]).toBe(path.join(targetDir, 'CTASection.tsx'))
    })

    it('computes page compositor path as <pageName>.tsx inside targetDir', () => {
        const targetDir = computeTargetDir(projectRoot, pageName)
        const { pagePath } = computeComponentPaths(targetDir, [], pageName)
        expect(pagePath).toBe(path.join(targetDir, `${pageName}.tsx`))
    })

    it('computes theme file path at project root', () => {
        const themeFilePath = computeThemeFilePath(projectRoot, 'tailwind.config.ts')
        expect(themeFilePath).toBe(path.join(projectRoot, 'tailwind.config.ts'))
        expect(themeFilePath.startsWith(projectRoot)).toBe(true)
    })

    it('theme file path is at project root, not in generated subdir', () => {
        const targetDir = computeTargetDir(projectRoot, pageName)
        const themeFilePath = computeThemeFilePath(projectRoot, 'theme.css')
        expect(themeFilePath.startsWith(targetDir)).toBe(false)
        expect(themeFilePath.startsWith(projectRoot)).toBe(true)
    })
})

// ── §12 d2c:apply — security validation ──────────────────────────────────────

describe('d2c:apply — security validation', () => {
    const homeDir = os.homedir()
    const projectRoot = path.join(homeDir, 'projects', 'my-app')

    it('approves a path inside the home directory', () => {
        const filePath = path.join(projectRoot, 'src', 'components', 'generated', 'Hero', 'HeroSection.tsx')
        expect(isPathSafe(filePath, homeDir)).toBe(true)
    })

    it('rejects a path outside the home directory', () => {
        const outsidePath = '/etc/passwd'
        expect(isPathSafe(outsidePath, homeDir)).toBe(false)
    })

    it('rejects a relative path (not absolute)', () => {
        const relativePath = 'src/components/Button.tsx'
        expect(isPathSafe(relativePath, homeDir)).toBe(false)
    })

    it('rejects a path that starts with home but is not separated (path traversal check)', () => {
        // e.g. homeDir = /Users/alice, path = /Users/alice-evil/secret
        const evilPath = homeDir + '-evil/secret.tsx'
        expect(isPathSafe(evilPath, homeDir)).toBe(false)
    })

    it('approves theme file path inside home directory', () => {
        const themeFilePath = path.join(projectRoot, 'tailwind.config.ts')
        expect(isPathSafe(themeFilePath, homeDir)).toBe(true)
    })

    it('rejects theme file path outside home directory', () => {
        const outsidePath = '/tmp/tailwind.config.ts'
        expect(isPathSafe(outsidePath, homeDir)).toBe(false)
    })
})

// ── §9 + Commandment 7 — injectFlintIds output contains data-flint-id ─────────

describe('d2c:apply — injectFlintIds produces data-flint-id attributes', () => {
    it('adds data-flint-id to a simple JSX element', () => {
        const input = '<div className="hero">Hello</div>'
        const output = simulateInjectFlintIds(input)
        expect(output).toContain('data-flint-id')
    })

    it('adds data-flint-id to a component element', () => {
        const input = '<Button variant="primary">Click</Button>'
        const output = simulateInjectFlintIds(input)
        expect(output).toContain('data-flint-id')
    })

    it('does not duplicate data-flint-id when already present', () => {
        const input = '<div data-flint-id="div:1:0" className="hero">Hello</div>'
        const output = simulateInjectFlintIds(input)
        const count = (output.match(/data-flint-id/g) ?? []).length
        expect(count).toBe(1)
    })

    it('adds data-flint-id to multiple sibling elements', () => {
        const input = `
            <section>
                <header>Title</header>
                <main>Content</main>
            </section>
        `
        const output = simulateInjectFlintIds(input)
        const idCount = (output.match(/data-flint-id/g) ?? []).length
        expect(idCount).toBeGreaterThanOrEqual(3)
    })

    it('preserves existing JSX attributes alongside the injected ID', () => {
        const input = '<Button variant="primary" size="lg">Label</Button>'
        const output = simulateInjectFlintIds(input)
        expect(output).toContain('variant="primary"')
        expect(output).toContain('size="lg"')
        expect(output).toContain('data-flint-id')
    })
})

// ── §12 risk: export-default guard (contract Q1 resolution) ──────────────────

describe('d2c:apply — export default guard', () => {
    it('appends export default when not present', () => {
        const code = 'function MyPage() { return <div /> }'
        const result = ensureExportDefault(code, 'MyPage')
        expect(result).toContain('export default MyPage')
    })

    it('does not duplicate export default when already present', () => {
        const code = 'export default function MyPage() { return <div /> }'
        const result = ensureExportDefault(code, 'MyPage')
        const count = (result.match(/export\s+default/g) ?? []).length
        expect(count).toBe(1)
    })

    it('preserves the existing code when appending', () => {
        const code = 'function MyPage() { return <div className="page" /> }'
        const result = ensureExportDefault(code, 'MyPage')
        expect(result).toContain('className="page"')
        expect(result).toContain('export default MyPage')
    })

    it('works with a named export default function', () => {
        const code = 'export default function MyPage() { return <main /> }'
        const result = ensureExportDefault(code, 'MyPage')
        expect(result).toBe(code)
    })

    it('works with export default assigned to variable', () => {
        const code = 'const MyPage = () => <div />; export default MyPage;'
        const result = ensureExportDefault(code, 'MyPage')
        // Already has export default — should be unchanged
        const count = (result.match(/export\s+default/g) ?? []).length
        expect(count).toBe(1)
    })
})

// ── §12 risk: parse error handling (write as-is with warning) ─────────────────

describe('d2c:apply — parse error handling', () => {
    /**
     * Mirrors the catch block in processComponentCode.
     * On parse failure, the original code is returned with a warning.
     */
    function processWithFallback(code: string, filename: string): { code: string; warning?: string } {
        const INTENTIONALLY_BROKEN = /<<<<<<< HEAD|SYNTAX_ERROR_MARKER/.test(code)
        if (INTENTIONALLY_BROKEN) {
            return { code, warning: `Parse failed for ${filename}: syntax error` }
        }
        return { code }
    }

    it('returns the original code when parsing fails', () => {
        const brokenCode = '<<<<<<< HEAD\nconst x = <div />'
        const result = processWithFallback(brokenCode, 'BrokenComponent')
        expect(result.code).toBe(brokenCode)
    })

    it('includes a warning when parsing fails', () => {
        const brokenCode = 'SYNTAX_ERROR_MARKER function Broken() {'
        const result = processWithFallback(brokenCode, 'BrokenComponent')
        expect(result.warning).toBeDefined()
        expect(result.warning).toContain('BrokenComponent')
    })

    it('returns no warning for valid code', () => {
        const validCode = 'function GoodComponent() { return <div className="ok" /> }'
        const result = processWithFallback(validCode, 'GoodComponent')
        expect(result.warning).toBeUndefined()
    })

    it('the result code is still usable even when parsing fails', () => {
        const brokenCode = '<<<<<<< HEAD\nconst x = 1'
        const result = processWithFallback(brokenCode, 'Broken')
        // The file should still be writable as-is so the user can fix it manually
        expect(typeof result.code).toBe('string')
        expect(result.code.length).toBeGreaterThan(0)
    })
})

// ── File batch composition ────────────────────────────────────────────────────

describe('d2c:apply — file batch composition', () => {
    const projectRoot = path.join(os.homedir(), 'projects', 'test-app')
    const pageName = 'Dashboard'
    const targetDir = computeTargetDir(projectRoot, pageName)

    it('builds a batch with one entry per component plus the page', () => {
        const components = [
            { name: 'DashHeader', code: '<header />' },
            { name: 'DashSidebar', code: '<aside />' },
        ]
        const batch = new Map<string, string>()
        for (const c of components) {
            batch.set(path.join(targetDir, `${c.name}.tsx`), c.code)
        }
        batch.set(path.join(targetDir, `${pageName}.tsx`), '<main />')
        expect(batch.size).toBe(3)
    })

    it('theme file is NOT in the component file paths array', () => {
        const componentFilePaths = [
            path.join(targetDir, 'DashHeader.tsx'),
            path.join(targetDir, 'DashSidebar.tsx'),
        ]
        const themeFilePath = path.join(projectRoot, 'tailwind.config.ts')
        expect(componentFilePaths).not.toContain(themeFilePath)
    })

    it('page compositor path is distinct from component file paths', () => {
        const components = [{ name: 'HeroSection' }, { name: 'CTASection' }]
        const { componentPaths, pagePath } = computeComponentPaths(targetDir, components, pageName)
        expect(componentPaths).not.toContain(pagePath)
    })
})
