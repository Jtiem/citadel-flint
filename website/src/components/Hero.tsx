import { hero } from '../lib/content';
import { FadeIn } from './FadeIn';

export function Hero() {
  return (
    <section className="pt-28 md:pt-36 pb-section">
      <div className="mx-auto max-w-page px-6 text-center">
        <FadeIn>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-ink">
            The <span className="gradient-text">type checker</span> for design
            systems
          </h1>
        </FadeIn>

        <FadeIn delay={80}>
          <p className="mx-auto mt-6 max-w-[640px] text-lg text-ink-secondary">
            {hero.subhead}
          </p>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="#early-access"
              className="bg-accent text-white font-semibold px-6 py-3 rounded-xl hover:bg-accent-hover transition-colors"
            >
              {hero.cta.primary}
            </a>
            <a
              href="#how-it-works"
              className="border border-border text-ink font-semibold px-6 py-3 rounded-xl hover:bg-surface-raised transition-colors"
            >
              {hero.cta.secondary}
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {hero.badges.map((badge) => (
              <span
                key={badge}
                className="text-xs font-medium px-3 py-1 rounded-full bg-accent-subtle text-accent border border-accent/10"
              >
                {badge}
              </span>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={320}>
          <p className="mt-6 text-sm text-ink-tertiary">{hero.proof}</p>
        </FadeIn>
      </div>
    </section>
  );
}
