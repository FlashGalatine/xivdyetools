# Deep-Dive Analysis Report

## Executive Summary
- **Project:** XIV Dye Tools (xivdyetools monorepo)
- **Analysis Date:** 2026-02-21
- **Total Findings:** 32

## Summary by Category

### Hidden Bugs (12)
| ID | Title | Severity | Component |
|----|-------|----------|-----------|
| BUG-001 | Double XML escaping in SVG generators | Medium | svg |
| BUG-002 | `safeParseJSON` prototype check always false-positives | **Critical** | moderation-worker |
| BUG-003 | Discord rate limit response uses HTTP 429 instead of 200 | **Critical** | moderation-worker |
| BUG-004 | KV `checkOnly()` off-by-one in remaining count | Medium | rate-limiter |
| BUG-005 | Memory backend `remaining` inconsistent with KV | Medium | rate-limiter |
| BUG-006 | D1 mock records bindings at bind-time, not execution-time | Medium | test-utils |
| BUG-007 | D1 mock `batch()` discards statement results | Medium | test-utils |
| BUG-008 | `findClosestDye` may miss perceptually close matches | Medium | core |
| BUG-009 | `Dye.hex` is `string` instead of `HexColor` branded type | Low | types |
| BUG-010 | `Math.max(...timestamps)` stack overflow risk under load | Low | rate-limiter |
| BUG-011 | `DelegatingLogger.time()` loses child context | Low | logger |
| BUG-012 | CJK character width miscalculation in SVG badges | Low | svg |

### Refactoring Opportunities (6)
| ID | Title | Priority | Effort |
|----|-------|----------|--------|
| REFACTOR-001 | `getColorDistance()` duplicated in 4+ files | High | Low |
| REFACTOR-002 | `getMatchQuality` variants with different signatures | Medium | Low |
| REFACTOR-003 | Duplicated JWT verification logic | Medium | Low |
| REFACTOR-004 | `rgbToHsv` duplicated in SVG package | Low | Low |
| REFACTOR-005 | Inconsistent SVG text truncation styles | Low | Low |
| REFACTOR-006 | ColorConverter static+instance dual API | Low | Medium |

### Optimization Opportunities (3)
| ID | Title | Impact | Category |
|----|-------|--------|----------|
| OPT-001 | Missing OKLAB cache in ColorConverter | Medium | Caching |
| OPT-002 | CryptoKey re-imported on every HMAC operation | Medium | Crypto I/O |
| OPT-003 | K-d tree in RGB space for perceptual queries | Medium | Algorithm |

## Priority Matrix

### Immediate Action (High Impact, Low Effort)
1. **BUG-002** — Fix `safeParseJSON` prototype check (`key in obj` → `Object.hasOwn(obj, key)`)
2. **BUG-003** — Change HTTP 429 to 200 for Discord interaction responses
3. **BUG-001** — Remove double `escapeXml()` calls in SVG generators
4. **REFACTOR-001** — Consolidate `getColorDistance()` into shared utility

### Plan for Next Sprint (High Impact, Medium Effort)
5. **BUG-004/BUG-005** — Align `remaining` semantics across rate limiter backends
6. **BUG-008** — Improve perceptual matching candidate selection
7. **OPT-001** — Add OKLAB cache to ColorConverter
8. **OPT-002** — Cache CryptoKey in auth package

### Technical Debt Backlog (Lower Priority)
9. **REFACTOR-002** — Unify match quality functions
10. **REFACTOR-003** — DRY JWT verification
11. **BUG-009** — Branded type for `Dye.hex`
12. **REFACTOR-006** — Simplify ColorConverter API

## Positive Observations

The codebase has many strong patterns worth preserving:
- **Inline bug documentation:** Previously-fixed bugs (CORE-BUG-* series) are annotated with inline comments explaining failure modes and fixes
- **Prototype pollution protection:** `safeClone()` in DyeDatabase correctly filters dangerous keys using `Object.create(null)`
- **ReDoS prevention:** Hex validation checks string length before regex
- **Race condition prevention:** Deferred promise pattern correctly prevents concurrent API call duplication
- **Request versioning:** Market board service uses request version counters to prevent stale data overwrites
- **PKCE implementation:** OAuth flow correctly implements PKCE as defense-in-depth
- **Comprehensive i18n:** All 6 locale files are perfectly synchronized (738 lines each) with automated key completeness testing
