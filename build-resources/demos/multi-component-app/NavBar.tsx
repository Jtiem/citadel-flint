import React from 'react';

// Grade B — 1 violation
// VIOLATION: nav has no aria-label (landmark ambiguity when multiple navs on page)

interface NavBarProps {
  logo: string;
  links: { label: string; href: string; active?: boolean }[];
}

export function NavBar({ logo, links }: NavBarProps) {
  return (
    // VIOLATION: missing aria-label="Main navigation"
    <nav style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #f3f4f6', padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '56px', gap: '32px' }}>
        <span style={{ fontWeight: '700', fontSize: '20px', color: '#111827' }}>{logo}</span>
        {links.map(link => (
          <a
            key={link.label}
            href={link.href}
            style={{
              fontSize: '14px',
              fontWeight: link.active ? '600' : '400',
              color: link.active ? '#2563eb' : '#374151',
              textDecoration: 'none'
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
