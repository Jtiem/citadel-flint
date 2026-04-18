// Malformed config — deliberate syntax error
// The tailwindConfigLoader must catch this and return
// { ok: false, error: 'syntax-error' }

module.exports = {
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        primary: '#0066cc',
        // Dangling comma + unclosed bracket — SyntaxError
        secondary: {
          DEFAULT: '#6b7280',
    // missing closing braces intentionally
