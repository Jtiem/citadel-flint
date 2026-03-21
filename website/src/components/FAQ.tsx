import { useState } from 'react';
import { faq } from '../lib/content';
import { FadeIn } from './FadeIn';

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-semibold text-ink">{q}</span>
        <span
          className={`text-xl text-ink-tertiary shrink-0 transition-transform duration-200 ${
            open ? 'rotate-45' : ''
          }`}
        >
          +
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? 'max-h-96 opacity-100 pb-5' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-base text-ink-secondary pr-8">{a}</p>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section className="py-section">
      <div className="section-container">
        <div className="max-w-prose mx-auto">
          <FadeIn>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">
              {faq.title}
            </h2>
          </FadeIn>

          <div className="mt-8">
            {faq.items.map((item, i) => (
              <FadeIn key={item.q} delay={i * 60}>
                <FAQItem q={item.q} a={item.a} />
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
