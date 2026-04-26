import { useState } from 'react';
import { useCases } from '../lib/content';
import { FadeIn } from './FadeIn';
export function UseCases() {
  const [activeTab, setActiveTab] = useState(0);
  const active = useCases.audiences[activeTab];
  return <section className="py-section bg-surface-raised">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink text-center">
            {useCases.title}
          </h2>
        </FadeIn>

        <FadeIn>
          <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
            {useCases.audiences.map((audience, i) => <button key={audience.label} onClick={() => setActiveTab(i)} className={`text-sm font-semibold px-4 py-1.5 rounded-full transition-colors ${i === activeTab ? 'bg-accent text-white' : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-raised'}`}>
                {audience.label}
              </button>)}
          </div>
        </FadeIn>

        <FadeIn>
          <div className="mt-10 max-w-prose mx-auto">
            <ul className="space-y-4">
              {active.points.map(point => <li key={point} className="flex items-start gap-3">
                  <span className="mt-[var(--spacing.2, 8px)] w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="text-base text-ink-secondary">{point}</span>
                </li>)}
            </ul>
          </div>
        </FadeIn>
      </div>
    </section>;
}