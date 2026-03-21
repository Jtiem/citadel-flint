import { gettingStarted } from '../lib/content';
import { FadeIn } from './FadeIn';

export function GettingStarted() {
  return (
    <section className="py-section">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink text-center">
            {gettingStarted.title}
          </h2>
        </FadeIn>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-page mx-auto">
          {gettingStarted.paths.map((path, i) => (
            <FadeIn key={path.label} delay={i * 120}>
              <div className="relative rounded-2xl bg-white border border-border-subtle shadow-card p-6 h-full flex flex-col">
                <span className="absolute top-4 right-4 text-xs font-medium bg-accent-subtle text-accent px-2.5 py-0.5 rounded-full">
                  {path.tag}
                </span>

                <h3 className="text-xl font-semibold text-ink mb-4 pr-16">
                  {path.label}
                </h3>

                <div className="bg-surface-code text-white/90 font-mono text-sm rounded-xl p-4 mb-4 overflow-x-auto">
                  <pre className="whitespace-pre">{path.code}</pre>
                </div>

                <p className="text-sm text-ink-secondary mt-auto">
                  {path.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
