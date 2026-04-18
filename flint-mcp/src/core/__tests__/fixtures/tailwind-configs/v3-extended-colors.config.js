/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#0066cc',
          600: '#0052a3',
          700: '#003d7a',
          800: '#002952',
          900: '#001429',
        },
        secondary: {
          DEFAULT: '#6b7280',
          light: '#9ca3af',
          dark: '#374151',
        },
        brand: {
          accent: '#f97316',
          primary: '#0066cc',
        },
      },
    },
  },
  plugins: [],
}
