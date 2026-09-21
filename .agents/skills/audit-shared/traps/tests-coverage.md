## 4. Tests / coverage

- Removing fully-covered dead code lowers aggregate coverage — expect ratchet adjustments
  (web-app 71/55/65/72 is a ratchet: never lower; others are thresholds in `vitest.config.ts`).
- A coverage drop with no source change and no failing test is usually a constant-valued mock
  crossing a component threshold — bisect with historical test files, don't theorize.
- Tests that cannot fail are common in web-app tool suites (`expect(typeof x).toBe('function')`,
  `not.toThrow()` as the only assertion, guarded bodies with no else, asserting a value captured
  before the action). Ask "what source edit would make this fail?" before trusting green.
- Fixed `setTimeout(0)` flush counts lose to jsdom's ~16 ms frame on fast runners — wait on the
  signal with `vi.waitFor`. CI runs ~5× slower than local: check which path a perf budget times
  (core's "k-d tree" benchmarks time the CIEDE2000 linear scan) before changing a number.

