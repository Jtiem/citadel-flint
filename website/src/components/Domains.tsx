import { domains } from '../lib/content';
import { FadeIn } from './FadeIn';

export function Domains() {
  return (
    <section className="py-section">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">
            {domains.title}
          </h2>
        </FadeIn>

        <div className="mt-10 max-w-content mx-auto">
          <FadeIn>
            <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-4">
              Shipping now
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {domains.current.map((item) => (
                <div
                  key={item.domain}
                  className="rounded-xl bg-white border border-border-subtle px-4 py-3 flex items-center gap-3"
                >
                  <span className="w-2 h-2 rounded-full bg-gate-pass shrink-0" />
                  <span className="text-sm text-ink">{item.domain}</span>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn>
            <h3 className="text-xs font-semibold text-ink-tertiary uppercase tracking-wider mt-10 mb-4">
              On the roadmap
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {domains.roadmap.map((item) => (
                <div
                  key={item.domain}
                  className="rounded-xl bg-white border border-border-subtle px-4 py-3 flex items-start gap-3"
                >
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-ink-tertiary shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-ink">
                      {item.domain}
                    </span>
                    <p className="text-xs text-ink-tertiary mt-0.5">
                      {item.profile}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
