import { useState, type FormEvent } from 'react';
import { emailCapture } from '../lib/content';
import { FadeIn } from './FadeIn';

export function EmailCapture() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  return (
    <section
      id="early-access"
      className="py-section bg-gradient-to-br from-accent-subtle via-white to-purple-50"
    >
      <div className="section-container">
        <FadeIn>
          <div className="max-w-prose mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">
              {emailCapture.headline}
            </h2>
            <p className="mt-4 text-base text-ink-secondary">
              {emailCapture.subhead}
            </p>

            {submitted ? (
              <p className="mt-8 text-base font-semibold text-ink">
                Thanks! We'll be in touch.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8">
                <div className="flex flex-col sm:flex-row">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={emailCapture.placeholder}
                    className="flex-1 border border-border rounded-xl sm:rounded-l-xl sm:rounded-r-none px-4 py-3 text-base text-ink placeholder:text-ink-tertiary bg-white outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                  />
                  <button
                    type="submit"
                    className="mt-3 sm:mt-0 bg-accent text-white font-semibold px-6 py-3 rounded-xl sm:rounded-l-none sm:rounded-r-xl hover:bg-accent-hover transition-colors"
                  >
                    {emailCapture.cta}
                  </button>
                </div>
              </form>
            )}

            <p className="mt-4 text-xs text-ink-tertiary">{emailCapture.note}</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
