import { problem } from '../lib/content';
import { FadeIn } from './FadeIn';
export function Problem() {
  return <section className="py-section bg-surface-raised">
      <div className="mx-auto max-w-content px-6">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-semibold text-ink text-center">
            {problem.title}
          </h2>
        </FadeIn>

        <div className="mt-16 space-y-20">
          {problem.sections.map(section => {
          const headlineStat = section.stats.find(s => s.headline);
          const supportingStats = section.stats.filter(s => !s.headline);
          return <FadeIn key={section.label}>
                <div>
                  <h3 className="text-xs font-semibold text-accent uppercase tracking-wider">
                    {section.label}
                  </h3>

                  <div className="mt-5 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-10">
                    {headlineStat && <div className="shrink-0">
                        <p className="text-5xl font-semibold text-ink tabular-nums leading-none">
                          {headlineStat.value}
                        </p>
                        <p className="mt-2 text-base text-ink-secondary max-w-[var(--spacing.12, 48px)]">
                          {headlineStat.desc}
                        </p>
                      </div>}

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {supportingStats.map(stat => <div key={stat.value} className="rounded-2xl bg-white border border-border-subtle shadow-card p-5">
                          <p className="text-xl font-semibold text-accent tabular-nums">
                            {stat.value}
                          </p>
                          <p className="mt-1 text-sm text-ink-secondary">
                            {stat.desc}
                          </p>
                        </div>)}
                    </div>
                  </div>

                  {section.sources.length > 0 && <p className="mt-4 text-xs text-ink-tertiary">
                      Sources: {section.sources.join(', ')}
                    </p>}
                </div>
              </FadeIn>;
        })}
        </div>
      </div>
    </section>;
}