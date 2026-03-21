import { footer } from '../lib/content';

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="section-container py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <p className="text-sm text-ink-secondary font-medium">
            {footer.tagline}
          </p>

          <nav className="flex items-center gap-6">
            {footer.links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-ink-tertiary hover:text-ink transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <p className="mt-8 text-xs text-ink-tertiary">{footer.copyright}</p>
      </div>
    </footer>
  );
}
