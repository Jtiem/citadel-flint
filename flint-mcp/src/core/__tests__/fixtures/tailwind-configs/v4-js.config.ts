// Tailwind v4 JS-based config
// Tailwind v4 still supports JS configs in addition to CSS-first @theme blocks.
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',
      },
      colors: {
        brand: {
          DEFAULT: '#0066cc',
          dark: '#004499',
        },
      },
    },
  },
}

export default config
