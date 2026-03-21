import { competitive } from '../lib/content';
import { FadeIn } from './FadeIn';

const positiveValues = new Set(['Full', 'Yes', 'CIEDE2000']);

function CellValue({ value, isFlintRow }: { value: string; isFlintRow: boolean }) {
  if (isFlintRow) {
    return <span className="font-semibold text-ink">{value}</span>;
  }
  return (
    <span className={positiveValues.has(value) ? 'font-semibold text-ink' : 'text-ink-tertiary'}>
      {value}
    </span>
  );
}

export function Competitive() {
  return (
    <section className="py-section">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">
            {competitive.title}
          </h2>
          <p className="mt-3 text-base text-ink-secondary max-w-prose">
            {competitive.subtitle}
          </p>
        </FadeIn>

        <FadeIn>
          <div className="mt-12 rounded-2xl overflow-hidden border border-border-subtle shadow-card max-w-page mx-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-code text-white/80">
                    <th className="px-4 py-3 text-sm font-semibold whitespace-nowrap">
                      Tool
                    </th>
                    {competitive.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-sm font-semibold whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {competitive.rows.map((row) => (
                    <tr
                      key={row.tool}
                      className={`border-t border-border-subtle ${
                        row.highlight
                          ? 'bg-accent-subtle border-l-2 border-l-accent'
                          : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-ink whitespace-nowrap">
                        {row.tool}
                      </td>
                      {row.cells.map((cell, i) => (
                        <td
                          key={competitive.columns[i]}
                          className="px-4 py-3 text-sm whitespace-nowrap"
                        >
                          <CellValue value={cell} isFlintRow={row.highlight} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-page mx-auto">
          {competitive.differentiators.map((d, i) => (
            <FadeIn key={d.title} delay={i * 80}>
              <div>
                <h3 className="font-semibold text-ink">{d.title}</h3>
                <p className="mt-2 text-sm text-ink-secondary">{d.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
