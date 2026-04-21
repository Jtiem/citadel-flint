/**
 * TypographySection — src/components/inspector/TypographySection.tsx
 *
 * Inspector section for typography properties: font-family, font-weight,
 * font-size, line-height, letter-spacing, and color.
 *
 * Each row reads className + inline style from the selected VisualLayer, then
 * calls matchValueToToken to determine whether the value is within the active
 * token set. Off-token values render a StatBadge variant="warning" alongside
 * the raw value.
 *
 * @schemaRole support-evidence (root)
 * CONTRACT: INSPECTOR.1 Group B
 * Commandments: C2 (no hallucinated styling), C13 (read-only, no AST surgery)
 */

import React from 'react';
import Section from '../ui/primitives/Section';
import PropertyRow from '../ui/primitives/PropertyRow';
import StatBadge from '../ui/primitives/StatBadge';
import { matchValueToToken } from '../../utils/tokenMatcher';
import type { TokenMatchCategory } from '../../utils/tokenMatcher';
import { useTokenStore } from '../../store/tokenStore';
import type { VisualLayer } from '../../core/ast-parser';

export interface TypographySectionProps {
  layer: VisualLayer;
  onCommit: (newClassName: string) => void;
  /**
   * FIX 1: Controls whether the Section starts expanded.
   * Derived from getAutoExpandedSections(tagName) in PropertiesPanel.
   * Defaults to false so generic/unknown tags start collapsed per ODQ-3.
   */
  initiallyExpanded?: boolean;
  children?: React.ReactNode;
}

// ── Tailwind typography class extraction ──────────────────────────────────────

/**
 * Extract a typography value from a Tailwind class string.
 * Returns the raw value or null when not found.
 *
 * Examples:
 *   "text-[17px]"  → "17px"  (arbitrary)
 *   "text-lg"      → "text-lg" (token class — returned as the class name)
 *   "font-bold"    → "bold"
 */

/** Extract arbitrary bracket value from a class like `text-[17px]`. */
function extractArbitrary(className: string, prefix: string): string | null {
  const re = new RegExp(`(?:^|\\s)${prefix}\\[([^\\]]+)\\](?=\\s|$)`);
  const m = className.match(re);
  return m ? m[1] : null;
}

/** Extract a named Tailwind utility class value (the part after the prefix). */
function extractNamed(className: string, prefix: string): string | null {
  const re = new RegExp(`(?:^|\\s)${prefix}([\\w\\-./]+)(?=\\s|$)`);
  const m = className.match(re);
  if (!m) return null;
  // Exclude bracket-arbitrary matches (they start with '[')
  if (m[1].startsWith('[')) return null;
  return m[1];
}

interface TypographyField {
  label: string;
  value: string | null;
  category: TokenMatchCategory;
}

function extractTypographyFields(layer: VisualLayer): TypographyField[] {
  const cls = layer.className ?? '';
  const style = layer.style ?? '';

  // Font size: text-[Xpx/rem/em] or text-{scale} or font-size in style
  // Only treat text-[...] as fontSize when the value looks like a size unit (not a color)
  const fontSizeArbRaw = extractArbitrary(cls, 'text-');
  const fontSizeArb = fontSizeArbRaw && /^[\d.]+(%|px|rem|em|ex|vw|vh|ch|pt|pc|cm|mm)$/.test(fontSizeArbRaw)
    ? fontSizeArbRaw
    : null;
  // FIX 4: Only treat text-{named} as fontSize when suffix is NOT a non-size utility
  const fontSizeNamedRaw = extractNamed(cls, 'text-');
  const fontSizeNamed = fontSizeNamedRaw && !NON_SIZE_TEXT_SUFFIXES.has(fontSizeNamedRaw)
    ? fontSizeNamedRaw
    : null;
  const fontSizeStyleMatch = style.match(/font-size:\s*([^;}"']+)/);
  const fontSize =
    fontSizeArb ??
    (fontSizeStyleMatch ? fontSizeStyleMatch[1].trim() : null) ??
    (fontSizeNamed ? fontSizeNamed : null);

  // Font family: font-[...] or font-{family}
  const fontFamilyArb = extractArbitrary(cls, 'font-');
  const fontFamilyNamed = extractNamed(cls, 'font-');
  const fontFamilyStyleMatch = style.match(/font-family:\s*([^;}"']+)/);
  // Exclude fontWeight matches (bold, semibold, etc.) from fontFamily
  const weightWords = new Set(['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black']);
  const fontFamilyFromClass =
    fontFamilyNamed && !weightWords.has(fontFamilyNamed) ? fontFamilyNamed : null;
  const fontFamily =
    fontFamilyArb ??
    (fontFamilyStyleMatch ? fontFamilyStyleMatch[1].trim() : null) ??
    fontFamilyFromClass;

  // Font weight: font-bold / font-semibold / font-[700]
  const fontWeightArb = extractArbitrary(cls, 'font-');
  const fontWeightNamed = extractNamed(cls, 'font-');
  const fontWeightStyleMatch = style.match(/font-weight:\s*([^;}"']+)/);
  const fontWeightFromClass =
    fontWeightNamed && weightWords.has(fontWeightNamed) ? fontWeightNamed : null;
  const fontWeight =
    fontWeightArb ??
    (fontWeightStyleMatch ? fontWeightStyleMatch[1].trim() : null) ??
    fontWeightFromClass;

  // Line height: leading-[...] or leading-{scale}
  const lineHeightArb = extractArbitrary(cls, 'leading-');
  const lineHeightNamed = extractNamed(cls, 'leading-');
  const lineHeightStyleMatch = style.match(/line-height:\s*([^;}"']+)/);
  const lineHeight =
    lineHeightArb ??
    (lineHeightStyleMatch ? lineHeightStyleMatch[1].trim() : null) ??
    (lineHeightNamed ? lineHeightNamed : null);

  // Letter spacing: tracking-[...] or tracking-{scale}
  const letterSpacingArb = extractArbitrary(cls, 'tracking-');
  const letterSpacingNamed = extractNamed(cls, 'tracking-');
  const letterSpacingStyleMatch = style.match(/letter-spacing:\s*([^;}"']+)/);
  const letterSpacing =
    letterSpacingArb ??
    (letterSpacingStyleMatch ? letterSpacingStyleMatch[1].trim() : null) ??
    (letterSpacingNamed ? letterSpacingNamed : null);

  // Color: text-[#...] or text-[rgb...] or color in style
  // Only treat text-[...] as color when the value looks like a color expression
  const colorArbRaw = extractArbitrary(cls, 'text-');
  const colorArb = colorArbRaw && /^(#|rgb|hsl|oklch|color\()/.test(colorArbRaw)
    ? colorArbRaw
    : null;
  const colorStyleMatch = style.match(/(?:^|;)\s*color:\s*([^;}"']+)/);
  const color =
    colorArb ??
    (colorStyleMatch ? colorStyleMatch[1].trim() : null);

  return [
    { label: 'Font Family', value: fontFamily, category: 'fontFamily' },
    { label: 'Font Weight', value: fontWeight, category: 'fontWeight' },
    { label: 'Font Size',   value: fontSize,   category: 'fontSize' },
    { label: 'Line Height', value: lineHeight,  category: 'lineHeight' },
    { label: 'Letter Spacing', value: letterSpacing, category: 'letterSpacing' },
    { label: 'Color',       value: color,       category: 'color' },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * FIX 4: Non-size text-* suffixes that must NOT be treated as font-size tokens.
 * These are alignment, wrapping, overflow, and decoration utilities.
 */
const NON_SIZE_TEXT_SUFFIXES = new Set([
  'center', 'left', 'right', 'justify', 'start', 'end',
  'ellipsis', 'clip', 'wrap', 'nowrap', 'balance', 'pretty',
  'uppercase', 'lowercase', 'capitalize', 'normal-case',
  'decoration', 'underline', 'overline', 'line-through', 'no-underline',
])

const TypographySection: React.FC<TypographySectionProps> = ({ layer, initiallyExpanded = false }) => {
  const tokens = useTokenStore(s => s.tokens);

  const fields = extractTypographyFields(layer);

  return (
    <div data-schema-role="support-evidence" data-testid="typography-section">
      <Section
        title="Typography"
        schemaRole="primary-content"
        expandedWhen={() => initiallyExpanded}
        stackItem={false}
      >
        {fields.map(({ label, value, category }) => {
          if (value === null) return null;

          const result = matchValueToToken(value, category, tokens);
          const isOffToken = !result.inTokenSet;

          // FIX 5: Surface nearest-token name when available for color category.
          // For non-color categories we don't have a CIEDE-style nearest-match;
          // show just the raw value + label.
          const nearestHint =
            isOffToken && category === 'color' && result.nearestTokenName
              ? ` • closest: ${result.nearestTokenName}`
              : '';

          const valueNode = isOffToken ? (
            <span className="flex items-center gap-1 justify-end">
              <span
                className="font-mono"
                style={{
                  fontSize: 'var(--text-body)',
                  color: 'var(--text-primary)',
                }}
              >
                {value}
              </span>
              <span title={nearestHint ? `off-token${nearestHint}` : undefined}>
                <StatBadge variant="warning" compact>
                  off-token{nearestHint}
                </StatBadge>
              </span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border border-indigo-500/30 bg-indigo-600/10"
              style={{ fontSize: 'var(--text-label)', color: 'var(--text-accent)' }}
              data-schema-role="support-evidence"
            >
              {result.nearestTokenName ?? value}
            </span>
          );

          return (
            <PropertyRow
              key={label}
              label={label}
              value={valueNode}
              schemaRole="support-evidence"
            />
          );
        })}
        {fields.every(f => f.value === null) && (
          <p
            className="px-3 py-2"
            style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}
          >
            No typography values found.
          </p>
        )}
      </Section>
    </div>
  );
};

export default TypographySection;
