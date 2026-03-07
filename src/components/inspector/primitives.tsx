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
                            <span className="text-[9px] text-gray-500 font-mono">{opt.hex}</span>
                        </button>
                    ))}
                </div>
            </PopoverPicker>
        </>
    )
}
