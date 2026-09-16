# Worker bundle sizes — before and after the cleanup (2026-09-16)

Branch `cleanup/dead-code-2026-09-15`, HEAD `2d1695af` (all 17 removals applied) versus its base `c40e7e63`
(`origin/main`, PR #183 merged). Every measurement below ran **inside the cleanup worktree** with one
`pnpm install --frozen-lockfile` and the same package `dist/` outputs, so the only variable is this
branch's source:

```bash
# "base": the worker's src/ and package.json restored to c40e7e63 in the working tree, then
for w in discord-worker moderation-worker presets-api api-worker image-worker; do
  git checkout c40e7e63 -- apps/$w/src apps/$w/package.json
  pnpm --filter xivdyetools-$w exec wrangler deploy --dry-run --outdir "$TMP/bundle-base-$w"
  git checkout HEAD -- apps/$w/src apps/$w/package.json
done
# "after": the same command at HEAD with nothing restored
```

| Worker | Exit | Raw KiB base | Gzip KiB base | Raw KiB after | Gzip KiB after | Δ raw | Δ gzip |
|---|---:|---:|---:|---:|---:|---:|---:|
| discord-worker | 0 | 7454.47 | 2284.25 | 7454.47 | 2284.25 | 0.00 | 0.00 |
| moderation-worker | 0 | 221.35 | 51.70 | 221.04 | 51.58 | −0.31 | −0.12 |
| presets-api | 0 | 217.80 | 53.93 | 217.80 | 53.93 | 0.00 | 0.00 |
| api-worker | 0 | 3854.94 | 577.41 | 3854.94 | 577.41 | 0.00 | 0.00 |
| image-worker | 0 | 1666.52 | 645.52 | 1666.52 | 645.52 | 0.00 | 0.00 |

Reading: four of the five bundles are byte-identical because esbuild had already tree-shaken the
unreferenced exports (`getPreference`, `truncateUnicodeSafe`, `duplicateResponse`) and the two
type-only changes (DEAD-015/016/017) erase at compile time. Only moderation-worker shrinks, and only
because `SENSITIVE_HEADERS` / `sanitizeHeaders` were reachable from the (unused but exported) fetch
wrappers until DEAD-010/011 removed the chain. This matches the report's own caveat: *"No bundle
reduction is claimed"*. The savings are in source and test maintenance, not bytes shipped.

## Why the audit's `bundle-*.log` numbers do not line up with the "base" column

The audit's baselines (`evidence/bundle-*.log`, e.g. discord-worker 7448.58 / 2282.85 KiB) were
measured at `main@0332fcc5`. Between that snapshot and this branch's base, Dependabot PR #181 bumped
`hono` 4.13.5 → 4.13.7, which is where the +5.89 KiB raw / +1.40 KiB gzip on discord-worker comes from
(the bundles' module headers name the resolved hono version). The first "after" collection in this
session repeated the audit's numbers exactly for the same reason: its shell working directory had been
reset to the main checkout (still at `0332fcc5`, hono 4.13.5) rather than the worktree, so it measured
the wrong tree. The table above supersedes that run; the base-versus-HEAD comparison is the one that
isolates this branch.
