// Timeout fixture: infinite loop at module top level.
// The VM sandbox must enforce a 2000ms timeout and return
// { ok: false, error: 'timeout' } within 2500ms wall clock.

// Infinite loop — must be killed by vm.runInNewContext timeout
while (true) {
  // This loop must never complete
}

module.exports = {
  content: [],
  theme: { extend: {} },
}
