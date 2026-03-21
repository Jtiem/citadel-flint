import { trust } from '../lib/content';
import { FadeIn } from './FadeIn';

export function Trust() {
  return (
    <section className="py-section">
      <div className="section-container">
        <FadeIn>
          <div className="text-center max-w-prose mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">
              {trust.title}
            </h2>
            <p className="mt-3 text-base text-ink-secondary">
              {trust.subtitle}
            </p>
          </div>
        </FadeIn>

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-content mx-auto">
          {trust.metrics.map((metric, i) => (
            <FadeIn key={metric.label} delay={i * 80}>
              <div className="rounded-2xl bg-white border border-border-subtle shadow-card p-6">
                <p className="text-4xl md:text-5xl font-semibold gradient-text">
                  {metric.value}
                </p>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {metric.label}
                </p>
                <p className="mt-1 text-xs text-ink-tertiary">
                  {metric.detail}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
