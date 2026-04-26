/**
 * ClassBuilder — src/components/inspector/ClassBuilder.tsx
 *
 * GLASSTYPO.1 rev 3 migration:
 *  - Accordion replaced with Section (expandedWhen predicate pattern).
 *  - All text-[var(--spacing.*)] font-sizes replaced with --text-* token props.
 *  - All text-zinc-{400..700} replaced with --text-* token color vars.
 *  - No inline uppercase utility.
 *  - All color swatches in Stroke / Fill section headers use state-signal role.
 *
 * @schemaRole support-evidence (ClassBuilder as a whole)
 */

import { useState, useMemo } from 'react';
import type { TokenType } from '../../types/flint-api';
import { useTokenStore } from '../../store/tokenStore';
import { normalizePath, tokenToClass } from '../../utils/classMapper';
import { CompactSelect, ColorPickerSwatch, TokenAutocomplete } from './primitives';
import type { TokenSuggestion } from './primitives';
import Section from '../ui/primitives/Section';

// ── Section definitions ────────────────────────────────────────────────────────

interface SectionDef {
  prefix: string;
  tokenType: TokenType;
}
const SECTIONS: Record<string, SectionDef> = {
  // Typography
  textColor: {
    prefix: 'text-',
    tokenType: 'color'
  },
  fontSize: {
    prefix: 'text-',
    tokenType: 'dimension'
  },
  fontFamily: {
    prefix: 'font-',
    tokenType: 'fontFamily'
  },
  fontWeight: {
    prefix: 'font-',
    tokenType: 'fontWeight'
  },
  lineHeight: {
    prefix: 'leading-',
    tokenType: 'lineHeight'
  },
  letterSpacing: {
    prefix: 'tracking-',
    tokenType: 'letterSpacing'
  },
  // Fill
  background: {
    prefix: 'bg-',
    tokenType: 'color'
  },
  // Stroke
  borderColor: {
    prefix: 'border-',
    tokenType: 'color'
  },
  borderRadius: {
    prefix: 'rounded-',
    tokenType: 'dimension'
  },
  // Effects
  shadow: {
    prefix: 'shadow-',
    tokenType: 'shadow'
  },
  opacity: {
    prefix: 'opacity-',
    tokenType: 'opacity'
  }
};
interface Props {
  className: string;
  onCommit: (newClassName: string) => void;
}
export function ClassBuilder({
  className,
  onCommit
}: Props) {
  const tokens = useTokenStore(s => s.tokens);

  // ── OPP-15: Token autocomplete state ───────────────────────────────────────

  /** Raw text typed into the "Add class" autocomplete field. */
  const [autocompleteQuery, setAutocompleteQuery] = useState('');

  /**
   * Build the suggestion list. For each token, derive one candidate per
   * section prefix where the token type matches, then filter by the typed
   * substring (case-insensitive match against token_path or resulting class).
   * Cap at 8 results to keep the dropdown manageable.
   */
  const autocompleteSuggestions = useMemo<TokenSuggestion[]>(() => {
    const q = autocompleteQuery.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const results: TokenSuggestion[] = [];
    for (const token of tokens) {
      // Find every section that matches this token's type
      for (const section of Object.values(SECTIONS)) {
        if (section.tokenType !== token.token_type) continue;
        const tailwindClass = tokenToClass(token.token_path, token.token_type, section.prefix);
        if (seen.has(tailwindClass)) continue;
        const label = normalizePath(token.token_path, token.token_type);

        // Match against the token path or the resulting Tailwind class
        if (!token.token_path.toLowerCase().includes(q) && !tailwindClass.toLowerCase().includes(q)) continue;
        seen.add(tailwindClass);
        results.push({
          label,
          tailwindClass,
          colorHex: token.token_type === 'color' ? String(token.token_value) : ''
        });
        if (results.length >= 8) break;
      }
      if (results.length >= 8) break;
    }
    return results;
  }, [autocompleteQuery, tokens]);

  /**
   * Appends the selected Tailwind class to the unmanaged portion of className
   * (i.e. it is not removed by the section-aware handleChange logic).
   */
  function handleAutocompleteCommit(cls: string): void {
    const existing = new Set(className.split(' ').filter(Boolean));
    if (existing.has(cls)) return; // already present — no-op
    const parts = className.split(' ').filter(Boolean);
    parts.push(cls);
    onCommit(parts.join(' '));
  }
  function computeManaged(): Set<string> {
    const managed = new Set<string>();
    for (const key of Object.keys(SECTIONS)) {
      const section = SECTIONS[key];
      for (const token of tokens.filter(t => t.token_type === section.tokenType)) {
        managed.add(tokenToClass(token.token_path, token.token_type, section.prefix));
      }
    }
    return managed;
  }
  function getActiveClass(section: SectionDef): string {
    const classList = new Set(className.split(' ').filter(Boolean));
    for (const token of tokens.filter(t => t.token_type === section.tokenType)) {
      const cls = tokenToClass(token.token_path, token.token_type, section.prefix);
      if (classList.has(cls)) return cls;
    }
    return '';
  }
  function handleChange(changedSection: SectionDef, newCls: string | null): void {
    const managed = computeManaged();
    const unmanaged = className.split(' ').filter(c => c !== '' && !managed.has(c));
    const otherActives = Object.values(SECTIONS).filter(s => s !== changedSection).map(s => getActiveClass(s)).filter(c => c !== '');
    const parts = [...unmanaged, ...otherActives];
    if (newCls !== null && newCls !== '__none__') parts.push(newCls);
    onCommit(parts.join(' '));
  }

  // Helper to generate options for CompactSelect
  function getOptionsFor(sectionKey: keyof typeof SECTIONS) {
    const section = SECTIONS[sectionKey];
    return tokens.filter(t => t.token_type === section.tokenType).map(t => ({
      label: normalizePath(t.token_path, t.token_type),
      value: tokenToClass(t.token_path, t.token_type, section.prefix)
    }));
  }

  // Helper to generate options for ColorPickerSwatch
  function getColorOptionsFor(sectionKey: keyof typeof SECTIONS) {
    const section = SECTIONS[sectionKey];
    return tokens.filter(t => t.token_type === section.tokenType).map(t => ({
      id: t.id,
      label: normalizePath(t.token_path, t.token_type),
      value: tokenToClass(t.token_path, t.token_type, section.prefix),
      hex: String(t.token_value)
    }));
  }
  function getColorActive(sectionKey: keyof typeof SECTIONS) {
    const section = SECTIONS[sectionKey];
    const activeCls = getActiveClass(section);
    const opts = getColorOptionsFor(sectionKey);
    const found = opts.find(o => o.value === activeCls);
    return {
      colorHex: found?.hex || '',
      display: found ? `${found.label}` : ''
    };
  }
  if (tokens.length === 0) {
    return <div className="px-3 py-4 text-center" style={{ fontSize: 'var(--text-body)', color: 'var(--text-tertiary)' }}>
                No tokens loaded — add tokens in the Token Manager panel.
            </div>;
  }
  const txtColorActive = getColorActive('textColor');
  const bgColorActive = getColorActive('background');
  const brdColorActive = getColorActive('borderColor');

  // Check if sections have active values for expandedWhen predicates
  const hasTypography = Object.values(SECTIONS).slice(0, 6).some(s => getActiveClass(s) !== '');
  const hasFill = getActiveClass(SECTIONS.background) !== '';
  const hasStroke = getActiveClass(SECTIONS.borderColor) !== '' || getActiveClass(SECTIONS.borderRadius) !== '';
  const hasEffects = getActiveClass(SECTIONS.shadow) !== '' || getActiveClass(SECTIONS.opacity) !== '';

  return <div className="flex flex-col">
            {/* OPP-15: Token autocomplete — freeform class entry with token-aware suggestions */}
            <div className="border-b border-zinc-800 px-3 py-2">
                <TokenAutocomplete suggestions={autocompleteSuggestions} value={autocompleteQuery} onChange={setAutocompleteQuery} onCommit={handleAutocompleteCommit} placeholder="Add token class…" />
            </div>

            {/*
              ClassBuilder sections use expandedWhen to reflect whether the node
              currently has active token classes in that category. This is the
              correct "actionable-state" predicate: the user has a lever (the
              CompactSelect / ColorPickerSwatch) and the section expands when
              the lever is already engaged (i.e. a token class is set).
              stackItem=false on the first section — the autocomplete bar above
              already provides separation.
            */}
            <Section
              title="Typography"
              schemaRole="primary-content"
              expandedWhen={() => hasTypography}
              stackItem={false}
            >
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0" title="Font Family">
                            <CompactSelect value={getActiveClass(SECTIONS.fontFamily)} onChange={val => handleChange(SECTIONS.fontFamily, val)} options={getOptionsFor('fontFamily')} />
                        </div>
                        <div className="flex-1 min-w-0" title="Font Weight">
                            <CompactSelect value={getActiveClass(SECTIONS.fontWeight)} onChange={val => handleChange(SECTIONS.fontWeight, val)} options={getOptionsFor('fontWeight')} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 min-w-0" title="Font Size">
                            <CompactSelect value={getActiveClass(SECTIONS.fontSize)} onChange={val => handleChange(SECTIONS.fontSize, val)} options={getOptionsFor('fontSize')} />
                        </div>
                        <div className="flex-1 min-w-0" title="Line Height">
                            <CompactSelect value={getActiveClass(SECTIONS.lineHeight)} onChange={val => handleChange(SECTIONS.lineHeight, val)} options={getOptionsFor('lineHeight')} />
                        </div>
                    </div>
                    <div title="Text Color">
                        <ColorPickerSwatch colorHex={txtColorActive.colorHex} activeTokenDisplay={txtColorActive.display} options={getColorOptionsFor('textColor')} onSelect={val => handleChange(SECTIONS.textColor, val)} />
                    </div>
                </div>
            </Section>

            <Section
              title="Fill"
              schemaRole="primary-content"
              expandedWhen={() => hasFill}
              action={bgColorActive.colorHex ? (
                /* @schemaRole state-signal */
                <div
                  data-schema-role="state-signal"
                  className="h-3 w-3 rounded-full border border-zinc-600"
                  style={{ backgroundColor: bgColorActive.colorHex }}
                />
              ) : undefined}
            >
                <ColorPickerSwatch colorHex={bgColorActive.colorHex} activeTokenDisplay={bgColorActive.display} options={getColorOptionsFor('background')} onSelect={val => handleChange(SECTIONS.background, val)} />
            </Section>

            <Section
              title="Stroke"
              schemaRole="primary-content"
              expandedWhen={() => hasStroke}
              action={brdColorActive.colorHex ? (
                /* @schemaRole state-signal */
                <div
                  data-schema-role="state-signal"
                  className="h-3 w-3 rounded-full border border-zinc-600"
                  style={{ backgroundColor: brdColorActive.colorHex }}
                />
              ) : undefined}
            >
                <div className="flex flex-col gap-2">
                    <ColorPickerSwatch colorHex={brdColorActive.colorHex} activeTokenDisplay={brdColorActive.display} options={getColorOptionsFor('borderColor')} onSelect={val => handleChange(SECTIONS.borderColor, val)} />
                    <div className="flex gap-2 items-center">
                        <span className="w-16 shrink-0" style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}>Radius</span>
                        <div className="flex-1 min-w-0">
                            <CompactSelect value={getActiveClass(SECTIONS.borderRadius)} onChange={val => handleChange(SECTIONS.borderRadius, val)} options={getOptionsFor('borderRadius')} />
                        </div>
                    </div>
                </div>
            </Section>

            <Section
              title="Effects"
              schemaRole="primary-content"
              expandedWhen={() => hasEffects}
            >
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                        <span className="w-16 shrink-0" style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}>Shadow</span>
                        <div className="flex-1 min-w-0">
                            <CompactSelect value={getActiveClass(SECTIONS.shadow)} onChange={val => handleChange(SECTIONS.shadow, val)} options={getOptionsFor('shadow')} />
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="w-16 shrink-0" style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}>Opacity</span>
                        <div className="flex-1 min-w-0">
                            <CompactSelect value={getActiveClass(SECTIONS.opacity)} onChange={val => handleChange(SECTIONS.opacity, val)} options={getOptionsFor('opacity')} />
                        </div>
                    </div>
                </div>
            </Section>
        </div>;
}
