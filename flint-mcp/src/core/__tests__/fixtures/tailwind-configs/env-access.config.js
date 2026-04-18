// Sandbox violation: attempts to read process.env at module top level.
// The sandbox does not expose `process`, so reading process.env
// throws a ReferenceError, which the loader maps to sandbox-violation.
// Expected result: { ok: false, error: 'sandbox-violation' }
// The env var value must NOT appear in the returned details field.

const brandColor = process.env.SECRET_BRAND_COLOR || '#0066cc'

module.exports = {
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        primary: brandColor,
      },
    },
  },
}
