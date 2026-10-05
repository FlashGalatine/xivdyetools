# DEAD-019: SubscriptionManager.addAll and getters count/hasSubscriptions have no caller or test — 21 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Unused Export · **Origin:** MAIN

## Location
- `apps/web-app/src/shared/subscription-manager.ts:56` — SubscriptionManager.addAll/count/hasSubscriptions

## Evidence
- The sole instance is BaseComponent.subs (base-component.ts:77). Every tracked usage is subs.add (29) or subs.unsubscribeAll (2). No test file, bracket access or other instance exists. The CHANGELOG mention is prose.
  - Commands: git grep -h -o 'subs\.[a-zA-Z]+' apps/web-app/src | uniq -c: 29 subs.add, 2 subs.unsubscribeAll; git grep -w -E 'addAll|hasSubscriptions' apps/web-app: declarations + CHANGELOG.md:2472 only
- Origin: subscription-manager.ts unchanged between 8ecb878f and HEAD; git grep at 8ecb878f returns only the declarations.

## Fix
**REMOVE.** count is documented as 'useful for debugging' but has no reader in src, e2e or tests.

Steps: In apps/web-app/src/shared/subscription-manager.ts delete addAll (51-59), the count getter (75-82) and the hasSubscriptions getter (83-88). No tests. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

## Status
OPEN
