# Deep-Dive Analysis Manifest

## Analysis Information

- **Project:** xivdyetools-* Ecosystem
- **Analysis Date:** 2026-01-25
- **Scope:** All 12 xivdyetools-* projects (742+ TypeScript files)
- **Analysis Duration:** Completed

## Analysis Categories

### Hidden Bug Detection

Categories investigated:
- Race conditions & concurrency issues
- Edge cases & boundary conditions
- Resource management (memory leaks, unclosed handles)
- Error handling gaps
- Logic errors (unreachable code, inverted conditions)
- State management issues (stale closures)

### Refactoring Opportunities

Categories investigated:
- Code smells (long methods, deep nesting, duplication)
- Design pattern opportunities
- Maintainability issues
- Architecture concerns (circular dependencies, tight coupling)

### Optimization Opportunities

Categories investigated:
- Algorithmic optimization
- Memory optimization
- I/O optimization (N+1 queries, missing batch operations)
- Caching opportunities
- Lazy loading opportunities

## Findings Index

### Bugs

See individual files in `bugs/` directory.

| ID | Title | Severity | Type | Status |
|----|-------|----------|------|--------|
| BUG-001 | Base64URL Decode Duplication | HIGH | Code Duplication | ✅ RESOLVED (REFACTOR-001) |
| BUG-002 | KV Race Condition in Rate Limiting | HIGH | Concurrency | ACCEPTED |
| BUG-003 | XIVAPI No Timeout in Maintainer | HIGH | Resource Management | ✅ RESOLVED |
| BUG-004 | RequestCoalescer Unsafe Type Cast | MEDIUM | Type Safety | ✅ Fixed |
| BUG-005 | RequestCoalescer Memory Leak | MEDIUM | Resource Leak | ✅ Fixed |
| BUG-006 | Null Handling in HarmonyGenerator | MEDIUM | Edge Case | ✅ RESOLVED (2026-01-26) |
| BUG-007 | Empty Array Check in RateLimitService | LOW | Code Clarity | ✅ Won't Fix - Idiomatic |

### Refactoring

See individual files in `refactoring/` directory.

| ID | Title | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| REFACTOR-001 | Consolidate Base64 Utils | HIGH | LOW | ✅ COMPLETED (2026-01-25) |
| REFACTOR-002 | Consolidate Rate Limiting | HIGH | MEDIUM | ✅ COMPLETED (2026-01-25) |
| REFACTOR-003 | Shared Auth Patterns | MEDIUM | MEDIUM | ✅ COMPLETED (2026-01-26) |
| REFACTOR-004 | Deduplicate Checksum | LOW | LOW | ✅ COMPLETED (2026-01-25) |

### Optimization

See individual files in `optimization/` directory.

| ID | Title | Impact | Category | Status |
|----|-------|--------|----------|--------|
| OPT-001 | LRU Cache Concurrency | MEDIUM | Algorithm | ✅ COMPLETED (AsyncLRUCache) |
| OPT-002 | N+1 KV Queries in Analytics | LOW | I/O | ✅ COMPLETED (2026-01-25) |
| OPT-003 | Random Cleanup Timing | LOW | Algorithm | ✅ COMPLETED (2026-01-25) |
| OPT-004 | Array Search O(n) in UserStorage | LOW | Algorithm | ✅ Won't Fix - Tiny dataset |

## Summary Statistics

| Category | Count |
|----------|-------|
| Hidden Bugs | 7 |
| Refactoring Opportunities | 4 |
| Optimization Opportunities | 4 |
| **Total Findings** | **15** |
