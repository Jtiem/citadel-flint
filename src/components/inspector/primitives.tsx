/**
 * inspector/primitives.tsx — shared low-level inspector components.
 *
 * GLASSTYPO.1 rev 3 migration:
 *  - Accordion DELETED — all call sites in the Properties canary now use
 *    `Section` from `src/components/ui/primitives/Section.tsx`.
 *  - All `text-[var(--spacing.*)]` font-size references replaced with
 *    token-derived style properties via CSS custom properties.
 *  - All `text-zinc-{400..700}` replaced with `--text-*` token colors.
 *  - No inline `uppercase` utility.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// ── CompactSelect ───────────────────────────────────────────────────────────────
// @schemaRole support-evidence

export function CompactSelect({
  icon,
  value,
  onChange,
  options
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  options: {
    label: string;
    value: string;
  }[];
}) {
  return <div className="group relative flex w-full items-center rounded border border-transparent transition-colors hover:border-zinc-700 bg-transparent hover:bg-zinc-800/50">
            {icon && <div className="pl-1.5 pr-0.5" style={{ color: 'var(--text-tertiary)' }}>{icon}</div>}
            <select value={value} onChange={e => onChange(e.target.value)} className="w-full appearance-none bg-transparent py-1 pr-4 outline-none" style={{
      paddingLeft: icon ? '4px' : '6px',
      fontSize: 'var(--text-body)',
      color: 'var(--text-secondary)',
    }} aria-label="[NEEDS LABEL]">
                <option value="__none__">— default —</option>
                {options.map(opt => <option key={opt.value} value={opt.value} className="bg-zinc-800" style={{ color: 'var(--text-primary)' }}>
                        {opt.label}
                    </option>)}
            </select>
            <div className="pointer-events-none absolute right-1.5 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--text-tertiary)' }}>
                <ChevronDown className="h-3 w-3" />
            </div>
        </div>;
}

// ── PopoverPicker ───────────────────────────────────────────────────────────────
// @schemaRole support-evidence

export function PopoverPicker({
  isOpen,
  onClose,
  triggerRef,
  children
}: {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);
  if (!isOpen || !triggerRef.current) return null;
  const rect = triggerRef.current.getBoundingClientRect();

  // Constrain within viewport
  const top = rect.bottom + 4;
  let left = rect.left;
  if (left + 220 > window.innerWidth) {
    left = window.innerWidth - 230;
  }
  return createPortal(<div ref={popoverRef} role="dialog" aria-modal="false" className="fixed z-50 flex w-48 flex-col rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-2xl" style={{
    top,
    left
  }}>
            {children}
        </div>, document.body);
}

// ── TokenAutocomplete ────────────────────────────────────────────────────────────
// @schemaRole support-evidence

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
  label: string;
  /** The Tailwind class to insert, e.g. "bg-brand-primary" */
  tailwindClass: string;
  /** Hex value for color tokens; empty string otherwise */
  colorHex: string;
}
export function TokenAutocomplete({
  suggestions,
  value,
  onChange,
  onCommit,
  placeholder = 'Add class…'
}: {
  suggestions: TokenSuggestion[];
  value: string;
  onChange: (raw: string) => void;
  onCommit: (cls: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const getOptionId = (idx: number) => `${listId}-option-${idx}`;

  // Recompute open state whenever suggestions or value change
  useEffect(() => {
    setOpen(value.trim().length > 0 && suggestions.length > 0);
    setActiveIdx(-1);
  }, [value, suggestions.length]);

  // Close when clicking outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'Enter' && value.trim()) {
        onCommit(value.trim());
        onChange('');
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        onCommit(suggestions[activeIdx].tailwindClass);
      } else if (value.trim()) {
        onCommit(value.trim());
      }
      onChange('');
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Portal position
  const rect = inputRef.current?.getBoundingClientRect();
  const dropdownTop = rect ? rect.bottom + 2 : 0;
  let dropdownLeft = rect ? rect.left : 0;
  if (typeof window !== 'undefined' && dropdownLeft + 220 > window.innerWidth) {
    dropdownLeft = window.innerWidth - 224;
  }
  return <div className="relative w-full">
            <input ref={inputRef} type="text" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeIdx >= 0 ? getOptionId(activeIdx) : undefined} value={value} onChange={e => onChange(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => {
      if (value.trim() && suggestions.length > 0) setOpen(true);
    }} placeholder={placeholder} className="w-full rounded border border-zinc-700/50 bg-zinc-800/60 px-2 py-1 font-mono outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors" style={{
      fontSize: 'var(--text-body)',
      color: 'var(--text-primary)',
    }} autoComplete="off" spellCheck={false} aria-label="[NEEDS LABEL]" />

            {open && rect && createPortal(<div ref={listRef} id={listId} role="listbox" aria-label="Token suggestions" className="fixed z-50 flex w-56 flex-col rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-2xl" style={{
      top: dropdownTop,
      left: dropdownLeft
    }}>
                    {suggestions.map((s, idx) => <button key={s.tailwindClass} id={getOptionId(idx)} role="option" aria-selected={idx === activeIdx} type="button" onMouseDown={e => {
        // mousedown fires before blur — prevent input blur
        e.preventDefault();
        onCommit(s.tailwindClass);
        onChange('');
        setOpen(false);
      }} onMouseEnter={() => setActiveIdx(idx)} className={`flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${idx === activeIdx ? 'bg-zinc-800' : 'hover:bg-zinc-800'}`} style={{
        fontSize: 'var(--text-label)',
        color: idx === activeIdx ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}>
                            {/* Color swatch for color tokens */}
                            {s.colorHex ? <div className="h-3 w-3 shrink-0 rounded-sm border border-zinc-600" style={{
          backgroundColor: s.colorHex
        }} /> : <div className="h-3 w-3 shrink-0" />}
                            {/* Token path */}
                            <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                                {s.label}
                            </span>
                            {/* Tailwind class — secondary, muted */}
                            <span className="shrink-0 font-mono" style={{
        color: 'var(--text-tertiary)',
        fontSize: 'var(--text-micro)',
      }}>
                                {s.tailwindClass}
                            </span>
                        </button>)}
                </div>, document.body)}
        </div>;
}

// ── ColorPickerSwatch ───────────────────────────────────────────────────────────
// @schemaRole support-evidence

export function ColorPickerSwatch({
  colorHex,
  activeTokenDisplay,
  options,
  onSelect
}: {
  colorHex: string;
  activeTokenDisplay: string;
  options: {
    id: string | number;
    label: string;
    value: string;
    hex: string;
  }[];
  onSelect: (val: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return <>
            <button ref={triggerRef} type="button" aria-label={`Color: ${activeTokenDisplay || 'none'}`} aria-expanded={isOpen} aria-haspopup="dialog" className="flex items-center gap-2 rounded border border-transparent hover:border-zinc-700 bg-transparent hover:bg-zinc-800/50 p-1.5 transition-colors w-full text-left" onClick={() => setIsOpen(!isOpen)}>
                <div className="h-4 w-4 shrink-0 rounded-full border border-zinc-600 shadow-sm" style={{
        backgroundColor: colorHex || 'transparent'
      }} />
                <span className="flex-1 truncate" style={{
        fontSize: 'var(--text-body)',
        color: 'var(--text-secondary)',
      }}>
                    {activeTokenDisplay || '— none —'}
                </span>
            </button>

            <PopoverPicker isOpen={isOpen} onClose={() => setIsOpen(false)} triggerRef={triggerRef}>
                <div className="flex max-h-60 flex-col overflow-y-auto px-1 py-1">
                    <button type="button" onClick={() => {
          onSelect(null);
          setIsOpen(false);
        }} className="text-left px-2 py-1.5 hover:bg-zinc-800 rounded transition-colors" style={{
        fontSize: 'var(--text-body)',
        color: 'var(--text-secondary)',
      }}>
                        — none —
                    </button>
                    {options.map(opt => <button key={opt.id} type="button" onClick={() => {
          onSelect(opt.value);
          setIsOpen(false);
        }} className="flex items-center gap-2 text-left px-2 py-1.5 hover:bg-zinc-800 rounded transition-colors" style={{
        fontSize: 'var(--text-body)',
        color: 'var(--text-primary)',
      }}>
                            <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-600" style={{
            backgroundColor: opt.hex
          }} />
                            <span className="truncate flex-1">{opt.label}</span>
                            <span className="font-mono" style={{
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-micro)',
        }}>{opt.hex}</span>
                        </button>)}
                </div>
            </PopoverPicker>
        </>;
}
