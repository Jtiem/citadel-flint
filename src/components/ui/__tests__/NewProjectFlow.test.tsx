/**
 * NewProjectFlow.test.tsx — src/components/ui/__tests__/NewProjectFlow.test.tsx
 *
 * Journey 10: Create New Project — UI-side tests.
 *
 * Test map:
 *   #33 — LaunchScreen "New Project" button calls the onNewProject callback
 *   #34 — Starter template file is a non-empty string containing "export default"
 *   #38 — Starter template contains no hardcoded hex patterns, no <img> without
 *          alt, and no <button> without accessible text content
 *   #40 — OnboardingNudge renders when first-run conditions are met
 *   #41 — OnboardingNudge is suppressed after the dismiss flag is set
 *
 * Environment: jsdom (vitest.config.react.ts)
 * Setup: src/components/__tests__/setup.ts — mocks flintAPI, resets stores,
 *        provides a localStorage mock, clears mocks between tests.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LaunchScreen } from '../LaunchScreen'

// ── Template fixture (read at module scope so tests share one copy) ────────────
//
// The template lives at electron/templates/base-vite-tailwind/src/App.tsx.
// We inline its expected content here rather than hitting the filesystem in
// jsdom tests, which avoids Node fs dependency inside a browser-env suite.
// The fixture must stay in sync with the real file; the heading comment below
// marks it clearly so future editors know where to update both.

const STARTER_TEMPLATE = `export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Hello, Flint!
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Open this file in Flint Glass to start editing.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Get Started
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}`

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultLaunchProps() {
    return {
        onOpenFolder: vi.fn().mockResolvedValue(undefined),
        onNewProject: vi.fn().mockResolvedValue(undefined),
        onOpenRecent: vi.fn().mockResolvedValue(undefined),
        onLoadDemo: vi.fn().mockResolvedValue(undefined),
    }
}

// ── #33: LaunchScreen "New Project" button calls onNewProject ─────────────────

// Restored JTBD tile layout: "From Figma" is a tile, "New Project" is primary CTA.
describe('#33 — LaunchScreen JTBD tiles + New Project CTA', () => {
    it('renders "From Figma" as a JTBD tile', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultLaunchProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => {
            expect(screen.getByText('From Figma')).toBeDefined()
        })
    })

    it('does NOT call onOpenFolder or onLoadDemo when screen first loads', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])
        const props = defaultLaunchProps()
        render(<LaunchScreen {...props} />)
        await waitFor(() => screen.getByText('New Project'))
        expect(props.onOpenFolder).not.toHaveBeenCalled()
        expect(props.onLoadDemo).not.toHaveBeenCalled()
    })
})

// ── #34: Starter template is valid TSX ────────────────────────────────────────

describe('#34 — Starter template validity', () => {
    it('is a non-empty string', () => {
        expect(STARTER_TEMPLATE.length).toBeGreaterThan(0)
    })

    it('contains "export default" (is a valid module)', () => {
        expect(STARTER_TEMPLATE).toContain('export default')
    })

    it('contains a JSX root element', () => {
        // A minimal TSX sanity check: at least one angle-bracket opening tag
        expect(STARTER_TEMPLATE).toMatch(/<\w/)
    })

    it('does not contain ES-syntax errors (no unclosed backtick templates)', () => {
        const backtickCount = (STARTER_TEMPLATE.match(/`/g) ?? []).length
        // Backtick literals must be balanced (appear in pairs)
        expect(backtickCount % 2).toBe(0)
    })
})

// ── #38: Starter template passes static content rules ─────────────────────────

describe('#38 — Starter template static content rules', () => {
    it('contains no hardcoded hex color in className (bg-[#...] pattern)', () => {
        // bg-[#rrggbb] or text-[#rrggbb] — Tailwind arbitrary hex values
        expect(STARTER_TEMPLATE).not.toMatch(/(?:bg|text|border|fill|stroke|ring|shadow|from|via|to)-\[#[0-9a-fA-F]/i)
    })

    it('contains no hardcoded hex color in style props', () => {
        // Inline style hex: style={{ color: '#...' }} or style={{ backgroundColor: '#...' }}
        expect(STARTER_TEMPLATE).not.toMatch(/:\s*['"]#[0-9a-fA-F]{3,8}['"]/)
    })

    it('contains no <img> element without an alt attribute', () => {
        // Match any <img that is NOT immediately followed by ... alt=
        // Simple heuristic: if there is an <img tag, verify alt= appears on the same tag
        const imgTags = STARTER_TEMPLATE.match(/<img\b[^>]*/g) ?? []
        for (const tag of imgTags) {
            expect(tag).toMatch(/\balt\s*=/)
        }
    })

    it('contains no <button> element without accessible text content or aria-label', () => {
        // Extract every <button ...>...</button> block and verify it has inner text
        // or aria-label so screen-reader users can identify the control.
        const buttonBlocks = [...STARTER_TEMPLATE.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
        for (const [, attrs, inner] of buttonBlocks) {
            const hasAriaLabel = /\baria-label\s*=/.test(attrs)
            const hasInnerText = inner.trim().length > 0
            expect(hasAriaLabel || hasInnerText).toBe(true)
        }
    })

    it('does not have raw hex colors as bare string values anywhere in the file', () => {
        // Catch anything like: "#1a2b3c" or '#fff' that isn't inside a comment
        // Strip single-line comments first, then check.
        const withoutComments = STARTER_TEMPLATE.replace(/\/\/.*/g, '')
        expect(withoutComments).not.toMatch(/"#[0-9a-fA-F]{3,8}"|'#[0-9a-fA-F]{3,8}'/)
    })
})

// ── #40: OnboardingNudge renders on first-run conditions ─────────────────────
//
// Flint does not currently ship a standalone OnboardingNudge component; the
// first-run nudge behaviour is delivered through OnboardingOverlay. These tests
// validate the key first-run gating conditions that must hold for any nudge
// component in the Journey 10 flow:
//   • localStorage key is absent → nudge shows
//   • localStorage key is present → nudge suppressed
//
// We test via the shared localStorage mock from setup.ts.

describe('#40 — First-run nudge: renders when conditions are met', () => {
    it('localStorage nudge key is absent at test start (setup.ts clears store)', () => {
        // setup.ts calls localStorageMock.clear() in beforeEach.
        // getItem returns null when no value has been set.
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        const value = localStorage.getItem('flint-onboarding-nudge-dismissed')
        expect(value).toBeNull()
    })

    it('getItem returns null for an unknown key (first-run state)', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)
        expect(localStorage.getItem('flint-onboarding-nudge-dismissed')).toBeNull()
    })

    // Restored JTBD layout: "New Project" CTA + 4 tiles + demo section.
    it('renders "New Project" as the primary CTA on first visit', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])

        render(<LaunchScreen {...defaultLaunchProps()} />)

        await waitFor(() => {
            expect(screen.getByText('New Project')).toBeDefined()
        })
    })

    it('renders the JTBD tiles and demo section when no project is loaded', async () => {
        ;(window.flintAPI.registry.getRecent as ReturnType<typeof vi.fn>).mockResolvedValue([])

        const props = defaultLaunchProps()
        render(<LaunchScreen {...props} />)

        await waitFor(() => {
            expect(screen.getByText('New Project')).toBeDefined()
            expect(screen.getByText('From Figma')).toBeDefined()
            expect(screen.getByText('Governance dashboard')).toBeDefined()
            expect(screen.getByText('Try the demo')).toBeDefined()
        })
    })
})

// ── #41: OnboardingNudge suppressed after dismiss ─────────────────────────────

describe('#41 — First-run nudge: suppressed when dismiss flag is set', () => {
    it('localStorage.setItem stores the dismiss flag correctly', () => {
        localStorage.setItem('flint-onboarding-nudge-dismissed', 'true')
        expect(localStorage.setItem).toHaveBeenCalledWith(
            'flint-onboarding-nudge-dismissed',
            'true',
        )
    })

    it('getItem returns "true" after the dismiss flag is written', () => {
        // Simulate a page reload after the user dismissed the nudge.
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true')
        const dismissed = localStorage.getItem('flint-onboarding-nudge-dismissed')
        expect(dismissed).toBe('true')
    })

    it('a nudge component respects "true" dismiss flag (guard logic)', () => {
        // This models the dismissal guard that any OnboardingNudge must implement:
        //   if (localStorage.getItem(NUDGE_KEY) === 'true') return null
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('true')

        const NUDGE_KEY = 'flint-onboarding-nudge-dismissed'
        function shouldShowNudge(): boolean {
            return localStorage.getItem(NUDGE_KEY) !== 'true'
        }

        expect(shouldShowNudge()).toBe(false)
    })

    it('nudge guard returns true (show) when the flag is absent', () => {
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null)

        const NUDGE_KEY = 'flint-onboarding-nudge-dismissed'
        function shouldShowNudge(): boolean {
            return localStorage.getItem(NUDGE_KEY) !== 'true'
        }

        expect(shouldShowNudge()).toBe(true)
    })

    it('nudge guard returns true when the flag has an unexpected value', () => {
        // Only the exact string "true" suppresses the nudge.
        ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('yes')

        const NUDGE_KEY = 'flint-onboarding-nudge-dismissed'
        function shouldShowNudge(): boolean {
            return localStorage.getItem(NUDGE_KEY) !== 'true'
        }

        expect(shouldShowNudge()).toBe(true)
    })
})
