/**
 * Project Environment Detector — shared/projectDetector.ts
 *
 * FORGE.2a: Pure-function detection of project framework, CSS framework,
 * component library, design tokens, and component count. No Electron or
 * Express dependencies — importable from both electron/main.ts and
 * server/index.ts.
 *
 * All file I/O uses the injected `fs` helpers so the module is testable
 * with in-memory stubs.
 */

import path from 'node:path'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ProjectEnvironment {
    /** Detected UI framework with version (e.g. { name: 'react', version: '19.1.0' }). */
    framework: { name: string; version: string } | null
    /** Detected CSS framework with version. */
    cssFramework: { name: string; version: string } | null
    /** Detected component library with version. */
    componentLibrary: { name: string; version: string } | null
    /** True when any design token file is found. */
    hasDesignTokens: boolean
    /** Source of design tokens when detected. */
    tokenSource: 'flint' | 'style-dictionary' | 'tokens-studio' | null
    /** Number of component files (.tsx/.vue/.svelte) found under src/. */
    componentCount: number
    /** ISO 8601 timestamp when detection ran. */
    detectedAt: string

    // ── Legacy fields (backward-compat with DetectionBanner) ──────────────
    /** Human-readable UI framework name for the banner (e.g. 'React 19'). */
    uiFramework: string
    /** Human-readable CSS framework name (e.g. 'Tailwind v4'). */
    cssFrameworkLabel: string
    /** Token format label (e.g. 'DTCG', 'Tokens Studio'). */
    tokenFormat: string | null
    /** Whether TypeScript is configured. */
    typescript: boolean
    /** Human-readable component library name (e.g. 'shadcn'). */
    componentLibraryLabel: string | null
    /** Optional baseline audit summary, populated after MCP audit. */
    auditSummary?: { violations: number; grade: string }
}

// ── Filesystem abstraction (for testability) ──────────────────────────────────

export interface DetectorFS {
    readFile: (filePath: string, encoding: 'utf-8') => Promise<string>
    exists: (filePath: string) => boolean
    /** Recursively count files matching extensions under a directory. */
    countFiles?: (dir: string, extensions: string[]) => Promise<number>
}

// ── Framework detection maps ──────────────────────────────────────────────────

interface DepMatch {
    packages: string[]
    name: string
}

const UI_FRAMEWORKS: DepMatch[] = [
    { packages: ['next'], name: 'next' },
    { packages: ['nuxt'], name: 'nuxt' },
    { packages: ['@sveltejs/kit'], name: 'sveltekit' },
    { packages: ['astro'], name: 'astro' },
    { packages: ['react', 'react-dom'], name: 'react' },
    { packages: ['vue'], name: 'vue' },
    { packages: ['svelte'], name: 'svelte' },
    { packages: ['@angular/core'], name: 'angular' },
]

const CSS_FRAMEWORKS: DepMatch[] = [
    { packages: ['tailwindcss'], name: 'tailwindcss' },
    { packages: ['styled-components'], name: 'styled-components' },
    { packages: ['@emotion/react', '@emotion/styled'], name: 'emotion' },
]

interface LibMatch {
    packages: string[]
    name: string
    label: string
}

const COMPONENT_LIBRARIES: LibMatch[] = [
    { packages: ['@mui/material', '@mui/core'], name: 'mui', label: 'MUI' },
    { packages: ['primeng', '@primeng/themes'], name: 'primeng', label: 'PrimeNG' },
    // shadcn detection: class-variance-authority + @radix-ui combo is the signature
    { packages: ['class-variance-authority'], name: 'shadcn', label: 'shadcn' },
    { packages: ['@radix-ui/react-slot'], name: 'radix', label: 'Radix' },
    { packages: ['antd'], name: 'antd', label: 'Ant Design' },
    { packages: ['@chakra-ui/react'], name: 'chakra', label: 'Chakra UI' },
    { packages: ['@mantine/core'], name: 'mantine', label: 'Mantine' },
]

// ── Human-readable labels ─────────────────────────────────────────────────────

const FRAMEWORK_LABELS: Record<string, string> = {
    react: 'React',
    vue: 'Vue',
    svelte: 'Svelte',
    sveltekit: 'SvelteKit',
    angular: 'Angular',
    next: 'Next.js',
    nuxt: 'Nuxt',
    astro: 'Astro',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findDep(allDeps: Record<string, string>, packages: string[]): { pkg: string; version: string } | null {
    for (const pkg of packages) {
        if (allDeps[pkg]) {
            return { pkg, version: allDeps[pkg] }
        }
    }
    return null
}

/** Strip semver range prefixes to get a clean version string. */
function cleanVersion(raw: string): string {
    return raw.replace(/^[\^~>=<\s]+/, '').split(' ')[0] ?? raw
}

/** Determine Tailwind major version from the version range string. */
function tailwindMajor(versionRange: string): string {
    if (versionRange.match(/^[\^~>=]*4/)) return 'v4'
    if (versionRange.match(/^[\^~>=]*3/)) return 'v3'
    return ''
}

// ── Default countFiles implementation using Node.js fs ────────────────────────

async function defaultCountFiles(dir: string, extensions: string[], fsExists: (p: string) => boolean): Promise<number> {
    // We use a dynamic import so this module remains pure for test stubs
    const { readdir } = await import('node:fs/promises')

    if (!fsExists(dir)) return 0

    let count = 0
    const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.nuxt', '.svelte-kit', 'build', 'coverage', '.flint'])

    async function walk(current: string): Promise<void> {
        let entries: import('node:fs').Dirent[]
        try {
            entries = await readdir(current, { withFileTypes: true })
        } catch {
            return
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') || entry.name === '.flint') {
                    if (!SKIP_DIRS.has(entry.name)) {
                        await walk(path.join(current, entry.name))
                    }
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase()
                if (extensions.includes(ext)) {
                    count++
                }
            }
        }
    }

    await walk(dir)
    return count
}

// ── Main detection function ───────────────────────────────────────────────────

export async function detectProjectEnvironment(
    projectRoot: string,
    fs: DetectorFS,
): Promise<ProjectEnvironment> {
    const now = new Date().toISOString()

    // ── 1. Read package.json ──────────────────────────────────────────────
    let allDeps: Record<string, string> = {}
    try {
        const pkgRaw = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8')
        const pkg = JSON.parse(pkgRaw) as {
            dependencies?: Record<string, string>
            devDependencies?: Record<string, string>
        }
        allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    } catch {
        // No package.json or parse error — continue with defaults
    }

    // ── 2. Detect UI framework ────────────────────────────────────────────
    let framework: ProjectEnvironment['framework'] = null
    let uiFramework = 'Unknown'

    for (const fw of UI_FRAMEWORKS) {
        const match = findDep(allDeps, fw.packages)
        if (match) {
            framework = { name: fw.name, version: cleanVersion(match.version) }
            const label = FRAMEWORK_LABELS[fw.name] ?? fw.name
            const ver = cleanVersion(match.version).split('.')[0]
            uiFramework = ver ? `${label} ${ver}` : label
            break
        }
    }

    // ── 3. Detect CSS framework ───────────────────────────────────────────
    let cssFramework: ProjectEnvironment['cssFramework'] = null
    let cssFrameworkLabel = 'Unknown'

    // Check Tailwind config files as fallback
    const TAILWIND_CONFIGS = [
        'tailwind.config.ts', 'tailwind.config.js',
        'tailwind.config.mjs', 'tailwind.config.cjs',
    ]
    const hasTwConfig = TAILWIND_CONFIGS.some(c => fs.exists(path.join(projectRoot, c)))

    for (const css of CSS_FRAMEWORKS) {
        const match = findDep(allDeps, css.packages)
        if (match) {
            cssFramework = { name: css.name, version: cleanVersion(match.version) }
            if (css.name === 'tailwindcss') {
                const major = tailwindMajor(match.version)
                cssFrameworkLabel = major ? `Tailwind ${major}` : 'Tailwind'
            } else if (css.name === 'styled-components') {
                cssFrameworkLabel = 'styled-components'
            } else if (css.name === 'emotion') {
                cssFrameworkLabel = 'Emotion'
            }
            break
        }
    }

    // Tailwind config without package dep (e.g. CDN or workspace setup)
    if (!cssFramework && hasTwConfig) {
        cssFramework = { name: 'tailwindcss', version: 'unknown' }
        cssFrameworkLabel = 'Tailwind'
    }

    // ── 4. Detect design tokens ───────────────────────────────────────────
    let hasDesignTokens = false
    let tokenSource: ProjectEnvironment['tokenSource'] = null
    let tokenFormat: string | null = null

    // Flint tokens
    if (fs.exists(path.join(projectRoot, '.flint', 'design-tokens.json'))) {
        hasDesignTokens = true
        tokenSource = 'flint'
        // Check if DTCG format
        try {
            const tokenRaw = await fs.readFile(
                path.join(projectRoot, '.flint', 'design-tokens.json'), 'utf-8',
            )
            tokenFormat = (tokenRaw.includes('"$type"') || tokenRaw.includes('"$value"'))
                ? 'DTCG' : 'Flint'
        } catch {
            tokenFormat = 'Flint'
        }
    }

    // Style Dictionary
    if (!hasDesignTokens) {
        const sdConfigs = [
            'style-dictionary.config.json', 'style-dictionary.config.js',
            'sd.config.js', 'sd.config.json',
        ]
        for (const c of sdConfigs) {
            if (fs.exists(path.join(projectRoot, c))) {
                hasDesignTokens = true
                tokenSource = 'style-dictionary'
                tokenFormat = 'Style Dictionary'
                break
            }
        }
    }

    // Tokens Studio
    if (!hasDesignTokens && fs.exists(path.join(projectRoot, 'tokens.json'))) {
        hasDesignTokens = true
        tokenSource = 'tokens-studio'
        tokenFormat = 'Tokens Studio'
    }

    // ── 5. Detect TypeScript ──────────────────────────────────────────────
    const typescript = fs.exists(path.join(projectRoot, 'tsconfig.json'))

    // ── 6. Detect component library ───────────────────────────────────────
    let componentLibrary: ProjectEnvironment['componentLibrary'] = null
    let componentLibraryLabel: string | null = null

    // Special case: shadcn is class-variance-authority + radix combo
    const hasCVA = !!allDeps['class-variance-authority']
    const hasRadix = Object.keys(allDeps).some(k => k.startsWith('@radix-ui/'))
    if (hasCVA && hasRadix) {
        const cvaVersion = allDeps['class-variance-authority']
        componentLibrary = { name: 'shadcn', version: cleanVersion(cvaVersion) }
        componentLibraryLabel = 'shadcn/ui'
    }

    if (!componentLibrary) {
        for (const lib of COMPONENT_LIBRARIES) {
            if (lib.name === 'shadcn' || lib.name === 'radix') continue // handled above
            const match = findDep(allDeps, lib.packages)
            if (match) {
                componentLibrary = { name: lib.name, version: cleanVersion(match.version) }
                componentLibraryLabel = lib.label
                break
            }
        }
    }

    // ── 7. Count component files ──────────────────────────────────────────
    const COMPONENT_EXTENSIONS = ['.tsx', '.vue', '.svelte']
    let componentCount = 0
    try {
        if (fs.countFiles) {
            componentCount = await fs.countFiles(
                path.join(projectRoot, 'src'),
                COMPONENT_EXTENSIONS,
            )
        } else {
            componentCount = await defaultCountFiles(
                path.join(projectRoot, 'src'),
                COMPONENT_EXTENSIONS,
                fs.exists,
            )
        }
    } catch {
        // Counting failed — leave at 0
    }

    // Also count in pages/ and app/ for Next.js / Nuxt projects
    if (framework?.name === 'next' || framework?.name === 'nuxt') {
        const extraDirs = ['pages', 'app']
        for (const dir of extraDirs) {
            try {
                if (fs.countFiles) {
                    componentCount += await fs.countFiles(
                        path.join(projectRoot, dir),
                        COMPONENT_EXTENSIONS,
                    )
                } else {
                    componentCount += await defaultCountFiles(
                        path.join(projectRoot, dir),
                        COMPONENT_EXTENSIONS,
                        fs.exists,
                    )
                }
            } catch {
                // Skip
            }
        }
    }

    return {
        framework,
        cssFramework,
        componentLibrary,
        hasDesignTokens,
        tokenSource,
        componentCount,
        detectedAt: now,

        // Legacy backward-compat fields
        uiFramework,
        cssFrameworkLabel,
        tokenFormat,
        typescript,
        componentLibraryLabel,
    }
}
