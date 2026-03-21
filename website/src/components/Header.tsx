import { hero } from '../lib/content';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border-subtle">
      <div className="max-w-page mx-auto px-6 py-3.5 flex items-center justify-between">
        <a href="/" className="text-xl font-semibold">
          <span className="gradient-text">Flint</span>
        </a>
        <a
          href="#early-access"
          className="bg-accent text-white font-semibold px-6 py-3 rounded-xl hover:bg-accent-hover transition-colors text-sm"
        >
          {hero.cta.primary}
        </a>
      </div>
    </header>
  );
}
