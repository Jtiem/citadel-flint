/**
 * Section — src/components/ui/primitives/Section.tsx
 *
 * Collapsible accordion primitive for the Glass Interaction Schema.
 *
 * @schemaRole primary-content
 *
 * CONTRACT: GLASSTYPO.1 Group B
 *
 * Rules enforced here:
 *  - `expandedWhen` MUST be a function — literal true/false is a TypeScript error.
 *  - Section expands IFF the user has an actionable lever inside (predicate encodes
 *    this rule structurally rather than relying on convention).
 *  - Passive info must NOT live in a Section — use MetadataTooltip instead.
 *  - Title uses text-title (13px/600) + text-primary.
 *  - Chevron rotates 90° on expand (CSS transition).
 *  - Keyboard accessible: Space/Enter toggle.
 *  - Collapsed content is hidden via the `hidden` attribute and aria-hidden.
 *
 * ── Inline style vs. utility class convention (GLASSTYPO.1) ──────────────────
 *
 * INSIDE primitives (Section, StatBadge, PropertyRow, PanelTabLabel, etc.):
 *   Use inline `style={{ fontSize: 'var(--text-X)', lineHeight: 'var(--text-X-lh)',
 *   fontWeight: 'var(--text-X-weight)' }}` when you need to bundle size + lineHeight +
 *   weight atomically. Tailwind utilities like `text-body` only set font-size; they do
 *   not carry the companion lineHeight and fontWeight tokens. Bundling all three in one
 *   style block at the primitive level makes the contract explicit and self-contained.
 *
 * AT CALL SITES (GovernanceDashboard, PropertiesPanel, governance/* children):
 *   Use Tailwind utility classes (`[font-size:var(--text-body)]`,
 *   `[color:var(--text-secondary)]`) rather than inline style objects. Utilities are
 *   cache-friendly and Mithril-linter-auditable; inline styles at call sites are not
 *   caught by the `grep`-based invariants in the contract.
 *
 * TODO (GLASSTYPO.2): Migrate remaining call-site inline `style={{ color: var(--...) }}`
 *   occurrences to `[color:var(--text-*)]` utility classes for full linter coverage.
 */

import React, { useState, useCallback, useId } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * SectionContext — reactive inputs that `expandedWhen` evaluates against.
 * Composed at the call site from already-visible state; no new store needed.
 */
export interface SectionContext {
  score: number;
  totalViolations: number;
  pendingApprovals: number;
  hasRuntimeViolations: boolean;
  /** Free-form extension for call-site-specific actionable-state inputs. */
  [key: string]: unknown;
}

/** Predicate required on every Section instance. Literal true/false is a type error. */
export type ExpandedWhen = (ctx: SectionContext) => boolean;

export interface SectionProps {
  title: string;
  /** Fixed to 'primary-content' — encoded as a literal so the role is unambiguous. */
  schemaRole: 'primary-content';
  /**
   * REQUIRED predicate. Section expands IFF the user has an actionable lever
   * inside. Passive info must not live in a Section — use MetadataTooltip instead.
   * Literal values are disallowed at the type level (must be a function).
   */
  expandedWhen: ExpandedWhen;
  /**
   * Optional live context for predicate evaluation. When provided the predicate
   * is re-evaluated on mount with real state rather than the zero-value default.
   * Callers compose this from already-visible store state — no new store required.
   */
  ctx?: SectionContext;
  /** Optional right-aligned header slot (e.g., a CTA button). */
  action?: React.ReactNode;
  id?: string;
  /**
   * When true (default) this Section participates in the between-section spacing
   * rhythm (16px marginTop). Set to false only for the first Section in a stack
   * where the panel already provides outer padding.
   * The 16px gap is strictly greater than the 8px inside-section padding-top,
   * enforcing the "airy-between / dense-inside" contract invariant.
   */
  stackItem?: boolean;
  children: React.ReactNode;
}

/**
 * Section primitive — Primary-content collapsible accordion.
 *
 * @schemaRole primary-content
 */
const Section: React.FC<SectionProps> = ({
  title,
  schemaRole,
  expandedWhen,
  ctx,
  action,
  id,
  stackItem = true,
  children,
}) => {
  const defaultCtx: SectionContext = {
    score: 0,
    totalViolations: 0,
    pendingApprovals: 0,
    hasRuntimeViolations: false,
  };

  // Derive initial expanded state from the predicate, using caller-provided ctx
  // (if any) so live state is reflected on mount rather than zero-value defaults.
  const [isOpen, setIsOpen] = useState<boolean>(() => expandedWhen(ctx ?? defaultCtx));
  const uid = useId();
  const contentId = id ? `${id}-content` : `${uid}-content`;
  const triggerId = id ? `${id}-trigger` : `${uid}-trigger`;

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  }, [toggle]);

  return (
    <div
      data-schema-role={schemaRole}
      data-flint-id={id}
      style={stackItem ? { marginTop: '16px' } : undefined}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <button
          id={triggerId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded"
        >
          <ChevronRight
            size={12}
            className="shrink-0 transition-transform duration-150"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'var(--text-secondary)',
            }}
            aria-hidden="true"
          />
          <span
            className="truncate"
            style={{
              fontSize: 'var(--text-title)',
              lineHeight: 'var(--text-title-lh)',
              fontWeight: 'var(--text-title-weight)',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
        </button>

        {/* Right-slot action (e.g. CTA button) — click does not propagate to toggle */}
        {action != null && (
          <div
            className="ml-2 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            {action}
          </div>
        )}
      </div>

      {/* Collapsible body — open-state visual treatment per GLASSTYPO.1 rev 3.
          When expanded: tint (3% of --text-primary), 1px left accent border
          (40% of --text-accent), 10px left indent, 8px top/bottom padding,
          12px right padding. Between-section spacing (16px marginTop) is
          applied by the mt-4 on the root wrapper below — see stack note. */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!isOpen}
        hidden={!isOpen}
        style={isOpen ? {
          background: 'color-mix(in oklch, var(--text-primary) 3%, transparent)',
          borderLeft: '1px solid color-mix(in oklch, var(--text-accent) 40%, transparent)',
          paddingLeft: '10px',
          paddingTop: '8px',
          paddingBottom: '8px',
          paddingRight: '12px',
        } : undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default Section;
