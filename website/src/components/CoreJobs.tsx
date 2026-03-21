import { coreJobs } from '../lib/content';
import { FadeIn } from './FadeIn';

export function CoreJobs() {
  return (
    <section className="py-section">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-semibold text-ink text-center mb-16">
            {coreJobs.title}
          </h2>
        </FadeIn>

        <div className="max-w-content mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {coreJobs.jobs.map((job, i) => (
            <FadeIn key={job.name} delay={i * 100}>
              <div className="rounded-2xl bg-white border border-border-subtle shadow-card p-7 hover:shadow-card-hover transition-shadow h-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-ink-tertiary/50 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                    {job.name}
                  </span>
                </div>

                <p className="text-xl font-semibold text-ink leading-snug">
                  {job.hook}
                </p>

                <p className="text-base text-ink-secondary">{job.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={350}>
          <p className="mt-8 text-sm text-ink-tertiary text-center max-w-prose mx-auto">
            Three steps. One loop. Every AI-generated component passes through
            all three before it ships.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
