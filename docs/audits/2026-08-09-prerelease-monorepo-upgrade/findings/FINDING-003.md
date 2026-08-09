# [FINDING-003]: `seroval` critical advisory reaches `stoat-worker` as a runtime dependency

## Severity
LOW *(upstream advisory is CRITICAL — see "Why this is downgraded")*

## Category
A06:2021 Vulnerable and Outdated Components · CWE-1395

## Location
- File: `apps/stoat-worker/package.json` (`dependencies` → `revolt.js@7.2.0`)
- Dependency path: `seroval@1.5.0` ← `seroval-plugins` / `solid-js@1.9.11` ← `@solid-primitives/*` ← `revolt.js@7.2.0` ← `stoat-worker`
- Advisory: `seroval.fromJSON()` Promise resolver type confusion — vulnerable `<=1.5.2`, patched `>=1.5.3`

## Deploy Unit
`stoat-worker` — **parked** (`XIVDyeTools-redesign-5.0/CLAUDE.md` § Scope: *"`stoat-worker` is
parked — nothing waits on it, no feature needs a drawn Stoat shape"*).

## Exposure
**LOCAL** — the package is not deployed. It has no production surface, no route, and no
Cloudflare Worker binding; it is a Node.js app that is not currently run.

## Rotation Required
NONE.

## Description

`pnpm audit` reports one CRITICAL advisory in the tree. It resolves through `revolt.js`, which
is a **production** (not dev) dependency of `apps/stoat-worker`. `seroval` is Solid's
serialisation layer, pulled in transitively by `revolt.js`'s use of `solid-js` reactive
primitives.

## Why this is downgraded from CRITICAL to LOW

Severity here is a property of *this deployment*, not of the package:

1. **The app is not deployed.** `stoat-worker` is explicitly parked in the 5.0 design record.
   Unreachable code cannot be exploited.
2. **The vulnerable API is not called by this codebase.** `seroval.fromJSON()` is invoked by
   Solid's internal hydration path; `stoat-worker` uses `revolt.js` for a chat gateway, not SSR
   hydration of untrusted payloads.
3. **It is four levels deep and not directly upgradable.** The fix requires `revolt.js` to move
   its `solid-js` floor, which is upstream's call.

## Evidence

```
$ pnpm why seroval
seroval@1.5.0
├─┬ seroval-plugins@1.5.0
│ └─┬ solid-js@1.9.11
│   ├─┬ @solid-primitives/map@0.7.2
│   │ └─┬ revolt.js@7.2.0
│   │   └── xivdyetools-stoat-worker@0.2.0 (dependencies)   ← production dep
…
Found 1 version of seroval
```

```
$ pnpm audit
 critical  seroval: `seroval.fromJSON()` Promise resolver type …
   Package seroval   Vulnerable <=1.5.2   Patched >=1.5.3
```

## Impact

None today. If `stoat-worker` is ever un-parked and deployed, this becomes a live
supply-chain exposure in a network-facing Node process and must be re-scored before that
deploy.

## Recommendation

**Take no action now.** Bumping `revolt.js` on a parked surface spends regression risk and
review time for zero security benefit, and `stoat-worker`'s 11 test files are the only thing
that would catch a breaking change in a dependency nobody is currently exercising.

Instead:

1. Record a **revisit trigger**: *"before any `stoat-worker` deploy, re-run `pnpm audit` and
   resolve every advisory in its dependency tree."*
2. Add that check to the un-parking checklist wherever Stoat's status is tracked.
3. If a `pnpm` override is desired purely to quiet the audit signal, `seroval@>=1.5.3` can be
   forced via `pnpm-workspace.yaml` overrides — but only do this if the noise is actively
   obscuring new advisories, and verify `stoat-worker`'s tests still pass afterwards.

## References
- GHSA advisory for `seroval` (see `evidence/pnpm-audit.json`)
- `XIVDyeTools-redesign-5.0/CLAUDE.md` § Scope — parked status
