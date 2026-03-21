import { howItWorks } from '../lib/content';
import { FadeIn } from './FadeIn';

/* ------------------------------------------------------------------ */
/*  Small sub-components used only inside this section                */
/* ------------------------------------------------------------------ */

/** Color swatch with hex label */
function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-7 h-7 rounded border border-border shrink-0"
        style={{ backgroundColor: hex }}
        aria-label={`Color swatch: ${hex}`}
      />
      <div className="flex flex-col">
        <span className="font-mono text-xs text-ink">{hex}</span>
        <span className="text-xs text-ink-tertiary">{label}</span>
      </div>
    </div>
  );
}

/** Delta-E badge -- big monospace number, colored by severity */
function DeltaBadge({
  value,
  status,
}: {
  value: number;
  status: 'failing' | 'passing';
}) {
  const color =
    status === 'failing' ? 'text-violation' : 'text-gate-pass';
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-ink-tertiary font-mono tracking-wider uppercase">
        {'\u0394'}E
      </span>
      <span className={`text-3xl font-mono font-semibold ${color} tabular-nums`}>
        {value.toFixed(1)}
      </span>
      <span
        className={`text-xs font-semibold mt-0.5 ${
          status === 'failing' ? 'text-violation/70' : 'text-gate-pass/70'
        }`}
      >
        {status === 'failing' ? 'brand violation' : 'within tolerance'}
      </span>
    </div>
  );
}

/** Violation / fix annotation tag */
function AnnotationTag({
  label,
  detail,
  rule,
  variant,
}: {
  label: string;
  detail: string;
  rule: string;
  variant: 'violation' | 'fix';
}) {
  const ringColor =
    variant === 'violation'
      ? 'border-violation/40 bg-violation/5'
      : 'border-gate-pass/40 bg-gate-pass/5';
  const labelColor =
    variant === 'violation' ? 'text-violation' : 'text-gate-pass';
  return (
    <div
      className={`flex items-baseline gap-2 rounded-2xl border px-2.5 py-1.5 ${ringColor}`}
    >
      <span className={`text-xs font-semibold font-mono shrink-0 ${labelColor}`}>
        {rule}
      </span>
      <span className="text-xs text-ink-secondary">
        <span className="font-semibold text-ink">{label}</span>
        {' \u2014 '}
        {detail}
      </span>
    </div>
  );
}

/** Styled code block with optional line highlights */
function CodePanel({
  code,
  highlightLines,
  highlightColor,
}: {
  code: string;
  highlightLines?: number[];
  highlightColor?: 'violation' | 'gate-pass';
}) {
  const lines = code.split('\n');
  const hlBg =
    highlightColor === 'gate-pass'
      ? 'bg-gate-pass/8'
      : 'bg-violation/8';
  const hlBorder =
    highlightColor === 'gate-pass'
      ? 'border-l-gate-pass/50'
      : 'border-l-violation/50';

  return (
    <pre className="bg-surface-code text-white/90 font-mono text-sm rounded-2xl p-5 overflow-x-auto">
      <code>
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const isHighlighted = highlightLines?.includes(lineNum);
          return (
            <div
              key={i}
              className={`${
                isHighlighted
                  ? `${hlBg} ${hlBorder} border-l-2 -ml-2 pl-[calc(0.5rem-2px)] pr-2 -mr-2`
                  : ''
              }`}
            >
              <span className="inline-block w-6 text-right text-white/25 mr-4 select-none text-xs">
                {lineNum}
              </span>
              {renderCodeLine(line)}
            </div>
          );
        })}
      </code>
    </pre>
  );
}

/** Minimal JSX syntax coloring -- keeps it readable without a full highlighter */
function renderCodeLine(line: string) {
  // Match JSX patterns for minimal syntax color
  const parts: { text: string; className: string }[] = [];
  let remaining = line;

  // Process the line character by character with simple pattern detection
  while (remaining.length > 0) {
    // String literals (double-quoted)
    const strMatch = remaining.match(/^"([^"]*)"/);
    if (strMatch) {
      parts.push({ text: strMatch[0], className: 'text-gate-pass/80' });
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // JSX tags: < and > with tag names
    const tagOpenMatch = remaining.match(/^(<\/?)([A-Z]\w*)/);
    if (tagOpenMatch) {
      parts.push({ text: tagOpenMatch[1], className: 'text-white/50' });
      parts.push({ text: tagOpenMatch[2], className: 'text-indigo-400' });
      remaining = remaining.slice(tagOpenMatch[0].length);
      continue;
    }

    // Closing bracket
    if (remaining.startsWith('>') || remaining.startsWith('/>')) {
      const bracket = remaining.startsWith('/>') ? '/>' : '>';
      parts.push({ text: bracket, className: 'text-white/50' });
      remaining = remaining.slice(bracket.length);
      continue;
    }

    // JSX attribute names
    const attrMatch = remaining.match(/^([a-z][a-zA-Z-]*)(?==)/);
    if (attrMatch) {
      parts.push({ text: attrMatch[0], className: 'text-sky-400/80' });
      remaining = remaining.slice(attrMatch[0].length);
      continue;
    }

    // JSX expression braces and content
    const exprMatch = remaining.match(/^\{([^}]*)\}/);
    if (exprMatch) {
      parts.push({ text: '{', className: 'text-white/40' });
      parts.push({ text: exprMatch[1], className: 'text-amber-300/70' });
      parts.push({ text: '}', className: 'text-white/40' });
      remaining = remaining.slice(exprMatch[0].length);
      continue;
    }

    // Everything else: take one character
    parts.push({ text: remaining[0], className: 'text-white/90' });
    remaining = remaining.slice(1);
  }

  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={p.className}>
          {p.text}
        </span>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Flow arrow between before and after panels                        */
/* ------------------------------------------------------------------ */

function FlowArrow() {
  return (
    <div className="flex flex-col items-center justify-center py-6 md:py-0 md:px-2">
      {/* Vertical arrow on mobile, horizontal on desktop */}
      <div className="hidden md:flex flex-col items-center gap-2">
        <svg
          width="48"
          height="80"
          viewBox="0 0 48 80"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          {/* Gradient line from violation to gate-pass */}
          <defs>
            <linearGradient id="arrow-grad" x1="24" y1="0" x2="24" y2="80" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ea580c" stopOpacity="0.6" />
              <stop offset="1" stopColor="hsl(155, 70%, 38%)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <line x1="24" y1="4" x2="24" y2="64" stroke="url(#arrow-grad)" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M16 60 L24 72 L32 60" stroke="hsl(155, 70%, 38%)" strokeWidth="2" fill="none" strokeOpacity="0.6" />
        </svg>
        <span className="text-xs font-mono text-ink-tertiary tracking-wide uppercase">
          AST surgery
        </span>
      </div>
      {/* Mobile: horizontal arrow */}
      <div className="md:hidden flex items-center gap-3">
        <svg
          width="80"
          height="32"
          viewBox="0 0 80 32"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arrow-grad-h" x1="0" y1="16" x2="80" y2="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ea580c" stopOpacity="0.6" />
              <stop offset="1" stopColor="hsl(155, 70%, 38%)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <line x1="4" y1="16" x2="64" y2="16" stroke="url(#arrow-grad-h)" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M60 8 L72 16 L60 24" stroke="hsl(155, 70%, 38%)" strokeWidth="2" fill="none" strokeOpacity="0.6" />
        </svg>
        <span className="text-xs font-mono text-ink-tertiary tracking-wide uppercase">
          AST surgery
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function HowItWorks() {
  const { before, after } = howItWorks;

  return (
    <section id="how-it-works" className="py-section">
      <div className="section-container">
        {/* Section header */}
        <FadeIn>
          <div className="max-w-prose mx-auto text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-semibold text-ink">
              {howItWorks.title}
            </h2>
            <p className="mt-3 text-base text-ink-secondary">
              {howItWorks.subtitle}
            </p>
          </div>
        </FadeIn>

        {/* Before / After comparison */}
        <FadeIn delay={120}>
          <div className="max-w-page mx-auto shadow-glow-sm rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0 items-start">

              {/* ---- BEFORE panel ---- */}
              <div className="space-y-5 min-w-0 p-6 md:p-8">
                {/* Panel label */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold font-mono tracking-wider uppercase text-violation">
                    Before
                  </span>
                  <span className="text-xs text-ink-tertiary">
                    AI-generated output
                  </span>
                </div>

                {/* Code block */}
                <CodePanel
                  code={before.code}
                  highlightLines={[2]}
                  highlightColor="violation"
                />

                {/* Color comparison */}
                <div className="flex items-center gap-6 px-1">
                  <Swatch hex={before.color.hex} label={before.color.label} />
                  <div className="flex-1" />
                  <DeltaBadge value={before.deltaE} status="failing" />
                </div>

                {/* Violations */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-ink-tertiary uppercase tracking-wider">
                    {before.violations.length} violations detected
                  </span>
                  {before.violations.map((v) => (
                    <AnnotationTag
                      key={v.rule}
                      label={v.label}
                      detail={v.detail}
                      rule={v.rule}
                      variant="violation"
                    />
                  ))}
                </div>
              </div>

              {/* ---- Arrow ---- */}
              <FlowArrow />

              {/* ---- AFTER panel ---- */}
              <div className="space-y-5 min-w-0 p-6 md:p-8">
                {/* Panel label */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold font-mono tracking-wider uppercase text-gate-pass">
                    After
                  </span>
                  <span className="text-xs text-ink-tertiary">
                    Flint-governed output
                  </span>
                </div>

                {/* Code block */}
                <CodePanel
                  code={after.code}
                  highlightLines={[2, 4]}
                  highlightColor="gate-pass"
                />

                {/* Color comparison */}
                <div className="flex items-center gap-6 px-1">
                  <Swatch hex={after.color.hex} label={after.color.label} />
                  <div className="flex-1" />
                  <DeltaBadge value={after.deltaE} status="passing" />
                </div>

                {/* Fixes */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-ink-tertiary uppercase tracking-wider">
                    {after.fixes.length} fixes applied
                  </span>
                  {after.fixes.map((f) => (
                    <AnnotationTag
                      key={f.rule}
                      label={f.label}
                      detail={f.detail}
                      rule={f.rule}
                      variant="fix"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Caption */}
            <p className="text-sm text-ink-tertiary pb-8 px-8 text-center max-w-prose mx-auto">
              {howItWorks.caption}
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
