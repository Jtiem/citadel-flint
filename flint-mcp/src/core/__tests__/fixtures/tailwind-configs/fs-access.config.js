// Sandbox violation: attempts to read filesystem at module top level.
// The tailwindConfigLoader sandbox must block this.
// Expected result: { ok: false, error: 'sandbox-violation' }
// The read result must NOT appear in the returned details.

const secret = require('fs').readFileSync('/etc/passwd', 'utf-8')

module.exports = {
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        // Attempting to leak filesystem content into theme
        danger: secret ? '#ff0000' : '#000000',
      },
    },
  },
}
