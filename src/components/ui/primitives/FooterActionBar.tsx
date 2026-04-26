/**
 * FooterActionBar — src/components/ui/primitives/FooterActionBar.tsx
 *
 * Bottom-anchored row of Nav-link items. The ONLY place Nav-link role renders.
 *
 * @schemaRole nav-link (container)
 *
 * CONTRACT: GLASSTYPO.1 Group B
 *
 * Design rules:
 *  - Separator line above (border-t).
 *  - Flex row with configurable justify-content via `align` prop.
 *  - Children MUST be Nav-link items (not CTAs) — enforced by convention.
 *  - Nav-link color is text-secondary (NOT accent) per interaction schema §Q4.
 *
 * Sub-component:
 *  - FooterLink: individual nav-link with chevron-right (or ExternalLink) suffix.
 *    Props: href?, onClick?, children, external?
 */

import React from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';

export type FooterActionBarAlign = 'start' | 'end' | 'between';

export interface FooterActionBarProps {
  /** Role fixed to nav-link container. Children are Nav-link items, not CTAs. */
  align?: FooterActionBarAlign;
  children: React.ReactNode;
}

// ── FooterLink sub-component ─────────────────────────────────────────────────

export interface FooterLinkProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  external?: boolean;
}

const NAV_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
  color: 'var(--text-secondary)',
};

/** Allowlist of safe URL schemes for FooterLink href values. */
const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:)/i;

/**
 * Returns the href only if it matches a safe scheme. Silently drops unsafe
 * schemes (e.g. `javascript:`, `data:`) and warns in development.
 */
function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (SAFE_HREF.test(href)) return href;
  if (import.meta.env.DEV) {
    console.warn(`[FooterLink] unsafe href dropped: ${href}`);
  }
  return undefined;
}

/**
 * FooterLink — Individual nav-link item inside FooterActionBar.
 *
 * @schemaRole nav-link
 */
export const FooterLink: React.FC<FooterLinkProps> = ({
  href,
  onClick,
  children,
  external = false,
}) => {
  const resolvedHref = safeHref(href);
  const innerContent = (
    <span className="flex items-center gap-0.5">
      {children}
      {external ? (
        <ExternalLink size={10} aria-hidden="true" className="shrink-0 opacity-70" />
      ) : (
        <ChevronRight size={10} aria-hidden="true" className="shrink-0 opacity-70" />
      )}
    </span>
  );

  if (resolvedHref !== undefined) {
    return (
      <a
        href={resolvedHref}
        target={external ? '_blank' : undefined}
        rel="noopener noreferrer"
        style={NAV_STYLE}
        data-schema-role="nav-link"
        className="leading-none focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded px-0.5"
      >
        {innerContent}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={NAV_STYLE}
      data-schema-role="nav-link"
      className="leading-none cursor-pointer bg-transparent border-none p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded px-0.5"
    >
      {innerContent}
    </button>
  );
};

// ── FooterActionBar ──────────────────────────────────────────────────────────

const JUSTIFY_MAP: Record<FooterActionBarAlign, string> = {
  start:   'justify-start',
  end:     'justify-end',
  between: 'justify-between',
};

/**
 * FooterActionBar primitive — Nav-link container at the bottom of a panel section.
 *
 * @schemaRole nav-link
 */
const FooterActionBar: React.FC<FooterActionBarProps> = ({
  align = 'start',
  children,
}) => {
  return (
    <div
      className={`flex flex-row items-center gap-3 px-3 py-2 border-t border-zinc-800 bg-zinc-950/60 ${JUSTIFY_MAP[align]}`}
      data-schema-role="nav-link"
    >
      {children}
    </div>
  );
};

export default FooterActionBar;
