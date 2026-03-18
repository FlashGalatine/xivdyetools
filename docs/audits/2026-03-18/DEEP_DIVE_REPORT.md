# Deep-Dive Analysis Report — Full Monorepo

## Executive Summary
- **Project:** xivdyetools monorepo (11 packages + 9 applications)
- **Analysis Date:** 2026-03-18
- **Analyzer:** Claude Opus 4.6 Deep-Dive Analysis Skill
- **Total Findings:** 39 (18 bugs, 10 refactoring, 6 optimization, 5 architecture concerns)
- **Critical Issues:** 0 new (2 previously fixed, verified correct)
- **High-Priority Issues:** 3 (BUG-012, REFACTOR-001, REFACTOR-002)

This is the first **full monorepo** deep-dive, covering all 11 shared packages and 9 applications. Prior deep-dives (2026-01-25, 2026-02-06) focused on individual projects. Source files were read at the line level and verified against the live codebase.

**Key finding:** The monorepo has excellent foundational architecture with no circular dependencies, comprehensive test infrastructure, and consistent TypeScript/ESLint configuration. The most actionable issues are in the presets-api (unsafe JSON.parse, missing input validation) and cross-cutting concerns (Vitest version split, test file organization).

---

## Summary by Category

### Hidden Bugs (18)

| ID | Title | Severity | Type | Package/App |
|----|-------|----------|------|-------------|
| BUG-001 | APIService resolvePromise! pattern fragility | LOW | Code Quality | core |
| BUG-002 | APIService error returns null indistinguishable from no data | LOW | API Design | core |
| BUG-003 | Non-null assertion on Map.get() after set | LOW | Type Safety | core |
| BUG-004 | Base64URL btoa/atob encoding edge case fragility | LOW | Encoding | crypto |
| BUG-005 | HMAC CryptoKey cache FIFO instead of LRU | MEDIUM | Caching | auth |
| BUG-006 | LRU cache delete+set async race condition | MEDIUM | Concurrency | core |
| BUG-007 | Missing locale fallback chain for incomplete translations | MEDIUM | Localization | core |
| BUG-008 | LocalizationService singleton race condition | MEDIUM | Concurrency | core |
| BUG-009 | Missing HSV validation for external API callers | LOW | Validation | core |
| BUG-010 | JWT verification missing `sub` claim validation | MEDIUM | Security | auth |
| BUG-011 | DyeSearch.searchByName null safety from untyped callers | LOW | Validation | core |
| BUG-012 | **Unsafe JSON.parse on D1 columns without try-catch** | **HIGH** | Error Handling | presets-api |
| BUG-013 | OAuth state signing accepts unsigned states | MEDIUM | Security | oauth |
| BUG-014 | Duplicate preset race condition — mitigated, fragile string match | LOW | Concurrency | presets-api |
| BUG-015 | Silent Discord notification failures | MEDIUM | Observability | presets-api |
| BUG-016 | Rate limiter no fail-closed behavior | MEDIUM | Security | presets-api |
| BUG-017 | Missing dye array size validation in preset submissions | MEDIUM | Validation | presets-api |
| BUG-018 | IP header spoofing for rate limit bypass | LOW | Security | universalis-proxy |

### Refactoring Opportunities (10)

| ID | Title | Priority | Effort | Package/App |
|----|-------|----------|--------|-------------|
| REFACTOR-001 | Vitest version mismatch (v3 vs v4) | HIGH | MEDIUM | monorepo |
| REFACTOR-002 | Inconsistent test file locations | HIGH | LOW | monorepo |
| REFACTOR-003 | Inconsistent coverage thresholds | MEDIUM | MEDIUM | monorepo |
| REFACTOR-004 | Build script inconsistency for core package | MEDIUM | LOW | core |
| REFACTOR-005 | getDyesInternal returns mutable array | MEDIUM | LOW | core |
| REFACTOR-006 | @internal exports not hidden from consumers | MEDIUM | MEDIUM | multi-package |
| REFACTOR-007 | Phase 2 TODO commands in stoat-worker | LOW | LOW | stoat-worker |
| REFACTOR-008 | Hardcoded locale in stoat-worker | LOW | LOW | stoat-worker |
| REFACTOR-009 | Hardcoded production proxy URL | LOW | LOW | web-app |
| REFACTOR-010 | Hardcoded category cache TTL | LOW | LOW | presets-api |

### Optimization Opportunities (6)

| ID | Title | Impact | Category | Package/App |
|----|-------|--------|----------|-------------|
| OPT-001 | Category cache thundering herd | MEDIUM | Caching | presets-api |
| OPT-002 | No pagination bounds on proxy response size | MEDIUM | I/O | universalis-proxy |
| OPT-003 | Async cache deletes blocking request path | MEDIUM | Latency | core |
| OPT-004 | Memory leak from event handler accumulation | MEDIUM | Memory | web-app |
| OPT-005 | Rate limiter cleanup iterates all entries | LOW | Algorithm | rate-limiter |
| OPT-006 | Missing AbortController cleanup | LOW | Memory | discord-worker |

---

## Architecture Concerns (Cross-Cutting)

### ARCH-001: Incomplete Deploy Triggers in CI/CD (HIGH)
Worker deploy workflows only track some transitive package dependencies:
- **discord-worker** tracks: core, types, logger, auth, rate-limiter, crypto
- **Missing from triggers**: svg, bot-logic, bot-i18n, color-blending (all are real dependencies)
- **presets-api** only tracks its own changes, missing: auth, crypto, rate-limiter

**Fix**: Add missing path triggers or use Turborepo's `--filter` with `...` dependency graph for deploy decisions.

### ARCH-002: No Smoke Tests Post-Deploy (MEDIUM)
Deploy workflows push code to Cloudflare but never verify the deployed worker responds correctly. A broken deployment goes unnoticed until a user reports it.

**Fix**: Add a post-deploy health check step (curl the health/ping endpoint).

### ARCH-003: No Dependency Audit in CI (MEDIUM)
`pnpm audit` is not part of the CI pipeline. Known vulnerable dependencies could ship to production. Dependabot is configured but doesn't block merges.

**Fix**: Add `pnpm audit --production` step to CI workflow.

### ARCH-004: Missing Bundle Size Checks in Pipeline (MEDIUM)
The discord-worker is ~8 MiB (gzip: ~2.4 MiB), near the 10 MiB Cloudflare paid plan limit. A `check-bundle-size.js` script exists but isn't integrated into the Turbo pipeline. A single large dependency could exceed the limit.

**Fix**: Add bundle size check to the build pipeline or `wrangler deploy --dry-run` for size validation.

### ARCH-005: No TypeScript Project References (LOW)
Each package compiles independently without TypeScript project references (`composite: true`). This means every build recompiles all source files from scratch, even if nothing changed. For a 20-project monorepo, this adds up.

**Fix**: Configure `tsconfig.json` with `references` to enable incremental builds.

---

## Priority Matrix

### P0: Fix This Week (High Impact, Low Effort)
1. **BUG-012**: Wrap `JSON.parse()` in try-catch in `preset-service.ts` — prevents single corrupted row from crashing the entire presets endpoint
2. **BUG-017**: Add dye array bounds validation — prevents DoS via oversized preset submissions
3. **REFACTOR-005**: Change `getDyesInternal()` return type to `readonly DyeInternal[]` — zero runtime cost, compile-time safety

### P1: Fix Next Sprint (High Impact, Moderate Effort)
4. **BUG-008**: LocalizationService singleton race — still open from 2026-02-06 audit, affects multilingual concurrent users
5. **BUG-010**: Add `sub` claim validation to `verifyJWT()` — one-line security hardening
6. **BUG-015**: Add retry or dead-letter queue for Discord notifications — prevents silent notification loss
7. **REFACTOR-001**: Document Vitest version constraint; monitor for vitest-pool-workers v4 support
8. **REFACTOR-002**: Standardize test file locations to colocated pattern
9. **OPT-001**: Add pending promise deduplication to category cache
10. **ARCH-001**: Fix incomplete deploy triggers in CI/CD workflows

### P2: Plan for Next Quarter (Medium Priority)
11. **BUG-005** through **BUG-007**: HMAC cache FIFO, LRU async race, locale fallback chain
12. **BUG-013**, **BUG-016**: OAuth unsigned state cleanup, rate limiter fail-closed
13. **REFACTOR-003**, **REFACTOR-004**, **REFACTOR-006**: Coverage thresholds, build scripts, internal exports
14. **OPT-002** through **OPT-004**: Proxy response bounds, cache delete latency, image upload memory
15. **ARCH-002** through **ARCH-004**: Smoke tests, dependency audit, bundle size checks

### P3: Backlog (Low Priority)
16. **BUG-001** through **BUG-004**, **BUG-009**, **BUG-011**, **BUG-014**, **BUG-018**: Code quality, type safety, edge case hardening
17. **REFACTOR-007** through **REFACTOR-010**: Stoat-worker cleanup, hardcoded values
18. **OPT-005**, **OPT-006**: Rate limiter cleanup, AbortController
19. **ARCH-005**: TypeScript project references

---

## Cross-References to Prior Audits

| This Audit | Prior Finding | Status |
|------------|--------------|--------|
| BUG-006 | 2026-01-25/OPT-001 (LRU cache concurrency) | Expanded scope — now documents app-level callers |
| BUG-008 | 2026-02-06/BUG-001 (LocalizationService race) | Still open — singleton pattern unchanged |
| BUG-001 | CORE-BUG-001/002 (APIService race condition) | **Fixed** — verified correct in source |

---

## Overall Code Quality Assessment

### Strengths
- **Architecture**: Clean layered dependencies with no circular imports. Well-defined service boundaries.
- **Security**: Ed25519 signature verification, HMAC-SHA256 with timing-safe comparisons, input sanitization, algorithm validation in JWT, minimum key length enforcement.
- **Type Safety**: Branded types (HexColor, DyeId), strict TypeScript configuration, comprehensive interfaces.
- **Testing**: 112 test files, 529+ tests, dedicated test-utils package with CF Workers mocks.
- **Observability**: Structured logging with request ID correlation, Analytics Engine integration, secret redaction.
- **Documentation**: Extensive `docs/` directory with architecture overviews, API contracts, deployment guides. CLAUDE.md files in every project.

### Areas for Improvement
- **Concurrency**: LocalizationService singleton remains the primary concern (global mutable state shared across concurrent CF Worker requests).
- **Defensive Programming**: Missing input validation at system boundaries (preset dye array size, JWT sub claim).
- **Error Recovery**: Fire-and-forget patterns (notifications, cache deletes) lack retry mechanisms.
- **Tooling Consistency**: Vitest version split and test file location inconsistency create maintenance burden.

---

## Recommendations

1. **Fix BUG-012 first** — the unsafe `JSON.parse()` is the highest-risk finding: a single corrupted D1 row can crash the entire presets listing endpoint.
2. **Bundle BUG-017 + REFACTOR-005** into a quick validation PR — both are low-effort, high-value hardening.
3. **Address BUG-008 strategically** — the LocalizationService singleton race has been open since 2026-02-06 and requires a core library API change. Plan this for a v3.0 release of `@xivdyetools/core`.
4. **Fix ARCH-001 immediately** — incomplete deploy triggers mean code changes to svg/bot-logic/bot-i18n don't auto-deploy the discord-worker.
5. **Add smoke tests (ARCH-002)** — the simplest operational improvement for deployment confidence.

## Next Steps
1. Review findings with maintainer
2. Prioritize P0 items for immediate action
3. Create GitHub issues for P1 items
4. Schedule P2 items for quarterly planning
5. Get explicit approval before making code changes
