# [DEAD-028]: `crawler-detector.ts` — the commented-out `Googlebot` pattern

## Category
Stale Code (commented-out code — deliberate)

## Location
- `src/crawler-detector.ts:49-51`

```ts
  // Google (for rich results, not just search indexing)
  // Note: We might want to let Googlebot through to the SPA for SEO
  // { pattern: /Googlebot/i, type: 'other' },
```

## Evidence
The skill's rule is that commented-out code is dead code. Here, though, the omission is a documented product decision: CLAUDE.md "Crawler Detection" — *"`Googlebot` is **commented out** — Google requests are intentionally passed through to the SPA so the SPA's own SEO content takes precedence"* — but **no test pins it**: `grep -i googlebot src/crawler-detector.test.ts` is empty (220 lines of tests, none for the one deliberate exclusion). Anyone "helpfully" uncommenting the line would go green.

## Recommendation
**KEEP** — but turn the tentative "We might want to…" into the decision it already is (one line: "Deliberately excluded: Googlebot must reach the SPA for SEO — see CLAUDE.md"), delete the commented pattern line itself, and add a one-line test `expect(detectCrawler('…Googlebot/2.1…').isCrawler).toBe(false)`. The *decision* is worth a comment and a test; the *code* is not.
