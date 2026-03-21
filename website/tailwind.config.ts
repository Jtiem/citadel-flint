import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    fontFamily: {
      sans: [
        'Inter',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'sans-serif',
      ],
      mono: [
        'JetBrains Mono',
        'SF Mono',
        'Fira Code',
        'monospace',
      ],
    },
    fontSize: {
      xs: ['0.8125rem', { lineHeight: '1.4' }],
      sm: ['0.875rem', { lineHeight: '1.5' }],
      base: ['1.0625rem', { lineHeight: '1.65' }],
      lg: ['1.1875rem', { lineHeight: '1.6' }],
      xl: ['1.375rem', { lineHeight: '1.4' }],
      '2xl': ['1.875rem', { lineHeight: '1.25' }],
      '3xl': ['2.375rem', { lineHeight: '1.15' }],
      '4xl': ['3.25rem', { lineHeight: '1.08' }],
      '5xl': ['4rem', { lineHeight: '1.05' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
    },
    extend: {
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          subtle: '#eef2ff',
        },
        ink: {
          DEFAULT: '#0f172a',
          secondary: '#475569',
          tertiary: '#94a3b8',
        },
        surface: {
          DEFAULT: '#ffffff',
          raised: '#f8fafc',
          code: '#0f172a',
        },
        border: {
          DEFAULT: '#e2e8f0',
          subtle: '#f1f5f9',
        },
        gate: {
          pass: '#10b981',
          fail: '#ef4444',
        },
        violation: '#ea580c',
      },
      maxWidth: {
        prose: '720px',
        content: '960px',
        page: '1120px',
      },
      spacing: {
        section: '7rem',
        'section-sm': '4.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 10px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        glow: '0 0 80px rgba(99,102,241,0.12)',
        'glow-sm': '0 0 40px rgba(99,102,241,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
