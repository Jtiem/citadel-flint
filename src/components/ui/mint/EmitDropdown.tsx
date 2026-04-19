/**
 * EmitDropdown — src/components/ui/mint/EmitDropdown.tsx
 *
 * MINT.5 Phase 3 — Emit/Handoff Dropdown (Scout)
 *
 * Presentational emit menu. 5 platforms: CSS variables, Tailwind config,
 * React Native, Swift, Kotlin. ARIA role="menu" + role="menuitem", full
 * keyboard navigation (arrow keys cycle, Enter selects, Escape closes),
 * outside-click + Escape close. Receives onEmit(platforms, mode) callback.
 * Mode toggle (preview/write) presented as separate menuitem groups per
 * platform.
 *
 * Pure render — no MCP calls, no store access beyond local UI state
 * (open/closed, focused index).
 *
 * Contract: MINT.5-phase3.contract.ts — EmitDropdownProps
 * Commandment 5 (Accessibility): ARIA menu role + full keyboard navigation
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Loader2, ArrowUpFromLine } from 'lucide-react'
import clsx from 'clsx'
import type { EmitDropdownProps, EmitPlatform, EmitMode } from '../../../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Platform display metadata ─────────────────────────────────────────────────

interface PlatformEntry {
  platform: EmitPlatform
  label: string
}

const PLATFORMS: PlatformEntry[] = [
  { platform: 'css',          label: 'CSS variables'   },
  { platform: 'tailwind',     label: 'Tailwind config' },
  { platform: 'react-native', label: 'React Native'    },
  { platform: 'swift',        label: 'Swift'           },
  { platform: 'kotlin',       label: 'Kotlin'          },
]

// Each platform has two entries: preview + write. Total = 10 menu items.
interface MenuItem {
  platform: EmitPlatform
  mode: EmitMode
  label: string
  testId: string
}

function buildMenuItems(): MenuItem[] {
  const items: MenuItem[] = []
  for (const { platform, label } of PLATFORMS) {
    items.push({
      platform,
      mode: 'preview',
      label: `${label} (preview)`,
      testId: `emit-item-${platform}-preview`,
    })
    items.push({
      platform,
      mode: 'write',
      label: `${label} (write to disk)`,
      testId: `emit-item-${platform}-write`,
    })
  }
  return items
}

const MENU_ITEMS = buildMenuItems()

// ── Component ─────────────────────────────────────────────────────────────────

export function EmitDropdown({ disabled = false, emitOp, onEmit }: EmitDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const menuId = useId()

  // When the menu opens, reset focus to first item.
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0)
      // Let the menu mount before focusing
      const timer = setTimeout(() => {
        itemRefs.current[0]?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Document-level Escape handler — catches Escape regardless of which element
  // currently has focus, so the menu closes even when focus is elsewhere.
  useEffect(() => {
    if (!isOpen) return

    function handleDocumentKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [isOpen])

  // Outside-click handler — listens on both pointerdown and mousedown for
  // maximum compatibility across browser environments and test runners (jsdom
  // dispatches mousedown; real browsers dispatch pointerdown first).
  useEffect(() => {
    if (!isOpen) return

    function handleOutsideClick(e: Event) {
      const target = e.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Trigger is disabled when an emit is in-flight OR when explicitly disabled.
  const triggerDisabled = disabled || emitOp !== null

  function handleTriggerClick() {
    if (triggerDisabled) return
    setIsOpen(prev => !prev)
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!triggerDisabled) {
        setIsOpen(prev => !prev)
      }
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isOpen && !triggerDisabled) {
      e.preventDefault()
      setIsOpen(true)
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const count = MENU_ITEMS.length

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = (focusedIndex + 1) % count
      setFocusedIndex(next)
      itemRefs.current[next]?.focus()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = (focusedIndex - 1 + count) % count
      setFocusedIndex(prev)
      itemRefs.current[prev]?.focus()
      return
    }

    if (e.key === 'Home') {
      e.preventDefault()
      setFocusedIndex(0)
      itemRefs.current[0]?.focus()
      return
    }

    if (e.key === 'End') {
      e.preventDefault()
      const last = count - 1
      setFocusedIndex(last)
      itemRefs.current[last]?.focus()
      return
    }
  }

  function handleItemSelect(item: MenuItem) {
    onEmit([item.platform], item.mode)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  function handleItemKeyDown(e: React.KeyboardEvent<HTMLLIElement>, item: MenuItem) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleItemSelect(item)
    }
  }

  return (
    <div className="relative" data-testid="emit-dropdown">
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        disabled={triggerDisabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        data-testid="emit-trigger"
        title="Emit tokens"
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
          'border-zinc-700 bg-zinc-900 text-zinc-200',
          'hover:border-zinc-600 hover:bg-zinc-800',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        {emitOp !== null ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" data-testid="emit-spinner" />
        ) : (
          <ArrowUpFromLine className="h-3 w-3" aria-hidden="true" />
        )}
        <span>Emit</span>
        <ChevronDown
          className={clsx('h-3 w-3 transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* ── Menu ── */}
      {isOpen && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Emit tokens"
          onKeyDown={handleMenuKeyDown}
          data-testid="emit-menu"
          className={clsx(
            'absolute right-0 top-full z-50 mt-1',
            'min-w-[200px] rounded-lg border border-zinc-700/50 bg-zinc-900',
            'py-1 shadow-xl',
          )}
        >
          {/* Section headers — purely visual, platform groups */}
          {PLATFORMS.map(({ platform, label }, platformIdx) => (
            <li key={platform} role="none">
              {/* Platform section divider (except first) */}
              {platformIdx > 0 && (
                <div className="my-1 border-t border-zinc-800" role="separator" aria-hidden="true" />
              )}
              <span className="block px-3 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider select-none">
                {label}
              </span>
              {/* Preview item */}
              {(() => {
                const previewIdx = platformIdx * 2
                const previewItem = MENU_ITEMS[previewIdx]
                return (
                  <li
                    key={previewItem.testId}
                    ref={el => { itemRefs.current[previewIdx] = el }}
                    role="menuitem"
                    tabIndex={focusedIndex === previewIdx ? 0 : -1}
                    data-testid={previewItem.testId}
                    onClick={() => handleItemSelect(previewItem)}
                    onKeyDown={e => handleItemKeyDown(e, previewItem)}
                    className={clsx(
                      'mx-1 flex cursor-pointer items-center rounded-md px-2 py-1.5 text-xs text-zinc-300',
                      'hover:bg-zinc-800 hover:text-zinc-100',
                      'focus:bg-zinc-800 focus:text-zinc-100 focus:outline-none',
                    )}
                  >
                    <span className="flex-1">{previewItem.label}</span>
                  </li>
                )
              })()}
              {/* Write item */}
              {(() => {
                const writeIdx = platformIdx * 2 + 1
                const writeItem = MENU_ITEMS[writeIdx]
                return (
                  <li
                    key={writeItem.testId}
                    ref={el => { itemRefs.current[writeIdx] = el }}
                    role="menuitem"
                    tabIndex={focusedIndex === writeIdx ? 0 : -1}
                    data-testid={writeItem.testId}
                    onClick={() => handleItemSelect(writeItem)}
                    onKeyDown={e => handleItemKeyDown(e, writeItem)}
                    className={clsx(
                      'mx-1 flex cursor-pointer items-center rounded-md px-2 py-1.5 text-xs text-zinc-300',
                      'hover:bg-zinc-800 hover:text-zinc-100',
                      'focus:bg-zinc-800 focus:text-zinc-100 focus:outline-none',
                    )}
                  >
                    <span className="flex-1">{writeItem.label}</span>
                  </li>
                )
              })()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
