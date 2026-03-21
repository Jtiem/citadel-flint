import { twoProducts } from '../lib/content';
import { FadeIn } from './FadeIn';

export function TwoProducts() {
  return (
    <section className="py-section bg-surface-raised">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink text-center">
            {twoProducts.title}
          </h2>
        </FadeIn>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-page mx-auto">
          {twoProducts.products.map((product, i) => (
            <FadeIn key={product.name} delay={i * 120}>
              <div
                className={`rounded-2xl border shadow-card hover:shadow-card-hover transition-shadow p-6 md:p-8 ${
                  i === 0
                    ? 'bg-accent-subtle/40 border-border-subtle border-l-4 border-l-accent'
                    : 'bg-white border-border-subtle'
                }`}
              >
                <p className="text-sm font-semibold text-accent mb-3">
                  {product.role}
                </p>
                <h3 className="text-xl font-semibold text-ink">
                  {product.name}
                </h3>
                <p className="mt-3 text-base text-ink-secondary mb-5">
                  {product.desc}
                </p>
                <ul className="space-y-2.5">
                  {product.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-[0.45rem] w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      <span className="text-sm text-ink-secondary">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
