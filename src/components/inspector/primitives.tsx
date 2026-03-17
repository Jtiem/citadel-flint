import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronDown } from 'lucide-react'

// ── Accordion ───────────────────────────────────────────────────────────────

export function Accordion({
    title,
    defaultOpen = true,
    children,
    headerRight
}: {
    title: React.ReactNode
    defaultOpen?: boolean
    children: React.ReactNode
    headerRight?: React.ReactNode
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    return (
        <div className="border-b border-gray-800/60">
            <div className="flex w-full items-center justify-between px-3 py-2 hover:bg-gray-800/30 transition-colors">
                <button
                    type="button"
                    className="flex flex-1 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {title}
                </button>
                {headerRight && <div className="shrink-0">{headerRight}</div>}
            </div>
            {isOpen && <div className="px-3 pb-3 pt-1">{children}</div>}
        </div>
    )
}

// ── CompactSelect ───────────────────────────────────────────────────────────

export function CompactSelect({
    icon,
    value,
    onChange,
    options
}: {
    icon?: React.ReactNode
    value: string
    onChange: (val: string) => void
    options: { label: string; value: string }[]
}) {
    return (
        <div className="group relative flex w-full items-center rounded border border-transparent transition-colors hover:border-gray-700 bg-transparent hover:bg-gray-800/50">
            {icon && <div className="pl-1.5 pr-0.5 text-gray-500">{icon}</div>}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none bg-transparent py-1 pr-4 text-[11px] outline-none text-gray-300"
                style={{ paddingLeft: icon ? '4px' : '6px' }}
            >
                <option value="__none__">— default —</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-gray-800 text-gray-200">
                        {opt.label}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute right-1.5 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                <ChevronDown className="h-3 w-3" />
            </div>
        </div>
    )
}

// ── PopoverPicker ───────────────────────────────────────────────────────────

export function PopoverPicker({
    isOpen,
    onClose,
    triggerRef,
    children
}: {
    isOpen: boolean
    onClose: () => void
    triggerRef: React.RefObject<HTMLButtonElement | null>
    children: React.ReactNode
}) {
    const popoverRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                onClose()
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, onClose, triggerRef])

    if (!isOpen || !triggerRef.current) return null

    const rect = triggerRef.current.getBoundingClientRect()

    // Constrain within viewport
    const top = rect.bottom + 4
    let left = rect.left
    if (left + 220 > window.innerWidth) {
        left = window.innerWidth - 230
    }

    return createPortal(
        <div
            ref={popoverRef}
            className="fixed z-50 flex w-48 flex-col rounded-md border border-gray-700 bg-gray-900 py-1 shadow-2xl"
            style={{ top, left }}
        >
            {children}
        </div>,
        document.body
    )
}

// ── TokenAutocomplete ────────────────────────────────────────────────────────

/**
 * OPP-15: Token-aware autocomplete input for raw class name entry.
 *
 * Props:
 *   suggestions  — pre-computed list (up to 8) from the parent, already filtered
 *                  to the typed substring.
 *   value        — the current controlled value of the text input.
 *   onChange     — called on every keystroke so the parent can recompute suggestions.
 *   onCommit     — called when the user presses Enter or selects a suggestion.
 *                  Receives the final class string to append.
 *   placeholder  — hint text for the input.
 *
 * The dropdown is portal-rendered so it is never clipped by overflow:hidden
 * panel wrappers.
 */
export interface TokenSuggestion {
    /** Human-readable label: the normalized token path */
    label: string
    /** The Tailwind class to insert, e.g. "bg-brand-primary" */
    tailwindClass: string
    /** Hex value for color tokens; empty string otherwise */
    colorHex: string
}

export function TokenAutocomplete({
    suggestions,
    value,
    onChange,
    onCommit,
    placeholder = 'Add class…',
}: {
    suggestions: TokenSuggestion[]
    value: string
    onChange: (raw: string) => void
    onCommit: (cls: string) => void
    placeholder?: string
}) {
    const [open, setOpen] = useState(false)
    const [activeIdx, setActiveIdx] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    // Recompute open state whenever suggestions or value change
    useEffect(() => {
        setOpen(value.trim().length > 0 && suggestions.length > 0)
        setActiveIdx(-1)
    }, [value, suggestions.length])

    // Close when clicking outside
    useEffect(() => {
        function handleMouseDown(e: MouseEvent) {
            if (
                inputRef.current && !inputRef.current.contains(e.target as Node) &&
                listRef.current && !listRef.current.contains(e.target as Node)
            ) {
                setOpen(false)
            }
        }
        if (open) document.addEventListener('mousedown', handleMouseDown)
        return () => document.removeEventListener('mousedown', handleMouseDown)
    }, [open])

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open) {
            if (e.key === 'Enter' && value.trim()) {
                onCommit(value.trim())
                onChange('')
            }
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx((i) => Math.max(i - 1, -1))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (activeIdx >= 0 && activeIdx < suggestions.length) {
                onCommit(suggestions[activeIdx].tailwindClass)
            } else if (value.trim()) {
                onCommit(value.trim())
            }
            onChange('')
            setOpen(false)
        } else if (e.key === 'Escape') {
            setOpen(false)
        }
    }

    // Portal position
    const rect = inputRef.current?.getBoundingClientRect()
    const dropdownTop = rect ? rect.bottom + 2 : 0
    let dropdownLeft = rect ? rect.left : 0
    if (typeof window !== 'undefined' && dropdownLeft + 220 > window.innerWidth) {
        dropdownLeft = window.innerWidth - 224
    }

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (value.trim() && suggestions.length > 0) setOpen(true)
                }}
                placeholder={placeholder}
                className="w-full rounded border border-zinc-700/50 bg-zinc-800/60 px-2 py-1 font-mono text-[11px] text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
                autoComplete="off"
                spellCheck={false}
            />

            {open && rect && createPortal(
                <div
                    ref={listRef}
                    className="fixed z-50 flex w-56 flex-col rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-2xl"
                    style={{ top: dropdownTop, left: dropdownLeft }}
                >
                    {suggestions.map((s, idx) => (
                        <button
                            key={s.tailwindClass}
                            type="button"
                            onMouseDown={(e) => {
                                // mousedown fires before blur — prevent input blur
                                e.preventDefault()
                                onCommit(s.tailwindClass)
                                onChange('')
                                setOpen(false)
                            }}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors ${
                                idx === activeIdx
                                    ? 'bg-zinc-800 text-zinc-100'
                                    : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                        >
                            {/* Color swatch for color tokens */}
                            {s.colorHex ? (
                                <div
                                    className="h-3 w-3 shrink-0 rounded-sm border border-zinc-600"
                                    style={{ backgroundColor: s.colorHex }}
                                />
                            ) : (
                                <div className="h-3 w-3 shrink-0" />
                            )}
                            {/* Token path */}
                            <span className="min-w-0 flex-1 truncate text-zinc-400">
                                {s.label}
                            </span>
                            {/* Tailwind class */}
                            <span className="shrink-0 font-mono text-indigo-400 text-[10px]">
                                {s.tailwindClass}
                            </span>
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    )
}

// ── ColorPickerSwatch ───────────────────────────────────────────────────────

export function ColorPickerSwatch({
    colorHex,
    activeTokenDisplay,
    options,
    onSelect
}: {
    colorHex: string
    activeTokenDisplay: string
    options: { id: string | number; label: string; value: string; hex: string }[]
    onSelect: (val: string | null) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className="flex items-center gap-2 rounded border border-transparent hover:border-gray-700 bg-transparent hover:bg-gray-800/50 p-1.5 transition-colors w-full text-left"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div
                    className="h-4 w-4 shrink-0 rounded-full border border-gray-600 shadow-sm"
                    style={{ backgroundColor: colorHex || 'transparent' }}
                />
                <span className="flex-1 text-[11px] text-gray-300 truncate">
                    {activeTokenDisplay || '— none —'}
                </span>
            </button>

            <PopoverPicker isOpen={isOpen} onClose={() => setIsOpen(false)} triggerRef={triggerRef}>
                <div className="flex max-h-60 flex-col overflow-y-auto px-1 py-1">
                    <button
                        type="button"
                        onClick={() => { onSelect(null); setIsOpen(false) }}
                        className="text-left text-[11px] px-2 py-1.5 hover:bg-gray-800 text-gray-400 rounded transition-colors"
                    >
                        — none —
                    </button>
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => { onSelect(opt.value); setIsOpen(false) }}
                            className="flex items-center gap-2 text-left text-[11px] px-2 py-1.5 hover:bg-gray-800 rounded text-gray-200 transition-colors"
                        >
                            <div
                                className="h-3.5 w-3.5 shrink-0 rounded-full border border-gray-600"
                                style={{ backgroundColor: opt.hex }}
                            />
                            <span className="truncate flex-1">{opt.label}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">{opt.hex}</span>
                        </button>
                    ))}
                </div>
            </PopoverPicker>
        </>
    )
}
