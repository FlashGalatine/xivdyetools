# Splitting image processing into `image-worker`

**Status:** design approved 2026-08-09, not yet implemented
**Priority:** **blocking.** Nothing in `discord-worker` can deploy until this lands.

---

## Why

`discord-worker` on `monorepo-2.0-prep` **exceeds Cloudflare's Worker size limit and cannot
deploy at all**:

```
X [ERROR] Your Worker exceeded the size limit of 3 MiB. Please upgrade to a paid
  plan to deploy Workers up to 10 MiB. [code: 10027]
```

Measured from `wrangler deploy --dry-run`:

| | Value |
|---|---|
| Bundle, uncompressed | 9,429.7 KiB |
| Bundle, gzipped | **3,209.3 KiB** |
| Free-plan limit | **3,072.0 KiB** (3 MiB) |
| Over by | 137.3 KiB (4.4%) |

### What pushed it over

5.0 nearly doubled the bundled font payload:

| Font | `main` | `monorepo-2.0-prep` | Δ |
|---|---:|---:|---:|
| Habibi | 33.4 KiB | — | −33.4 |
| Fragment Mono | — | 122.4 KiB | +122.4 |
| NotoSansJP-Subset | — | 545.9 KiB | **+545.9** |
| NotoSansSC-Subset | 474.0 KiB | 805.8 KiB | **+331.8** |
| KR / Onest / Space Grotesk | 476.9 KiB | 476.9 KiB | 0 |
| **Total** | **984.3 KiB** | **1,951.0 KiB** | **+966.7 KiB** |

`main` deploys; the 5.0 branch does not. This also means **`FONT-001` (Sprint 7 of the
2026-08-09 audit) makes the problem worse** — it adds 128 further glyphs to exactly these
subsets. That sprint's note treated the exceeded font budget as a documentation concern; it is
in fact a hard deploy failure.

### Why splitting, not shrinking

The two WASM blobs dominate, and they compress predictably:

| Asset | Raw | Gzipped | Used by |
|---|---:|---:|---|
| `index_bg.wasm` (resvg) | 2,420.5 KiB | 926.6 KiB | every card render |
| `photon_rs_bg.wasm` | 1,530.1 KiB | **604.1 KiB** | `/extractor` only |

Removing photon yields **3,209.3 − 604.1 = 2,605.2 KiB**, leaving **467 KiB (15%) of headroom** —
enough to absorb Sprint 7. Trimming fonts instead would recover less, is uncertain, and pulls
Sprint 7 out of its deliberate terminal position.

Photon is also the better thing to move on the merits: it is a 1.5 MiB image library that
**one** command uses, carried by every `/harmony`, `/dye` and `/contrast` invocation.

---

## The seam

It already exists in the code:

- `@cf-wasm/photon` is imported by exactly one file — `apps/discord-worker/src/services/image/photon.ts`.
- `services/image/` has exactly one consumer — `apps/discord-worker/src/handlers/commands/extractor.ts:45`.

```
BEFORE  extractor.ts ──local call──► services/image/ (photon) ──► pixels ──► PaletteService
AFTER   extractor.ts ──service binding──► image-worker (photon) ──► pixels ──► PaletteService
```

**Cut at the pixel boundary, no deeper.** `extractAndMatchPalette(rgbPixels, dyeService, …)`
(`extractor.ts:464`) fuses palette extraction *and* dye matching in one `@xivdyetools/core` call
that needs the dye database. Cutting below it would drag `core` — dye DB and six locales — into
the new Worker, defeating the purpose. Cutting at pixels keeps `image-worker`'s only real
dependency as photon itself.

## What moves

`apps/discord-worker/src/services/image/` → `apps/image-worker/src/`, wholesale:

| File | Note |
|---|---|
| `photon.ts` | the sole photon consumer |
| `validators.ts` | `MAX_FILE_SIZE_BYTES` 10 MB, `MAX_IMAGE_DIMENSION` 4096, `MAX_PIXEL_COUNT` 16M |
| `index.ts` | re-export surface |
| `photon.test.ts`, `validators.test.ts`, `index.test.ts` | move with their source |

`@cf-wasm/photon` moves from `discord-worker`'s dependencies to `image-worker`'s.
`discord-worker`'s vitest coverage `exclude` list drops `src/services/image/**`.

## Wire contract

```
POST /extract
  body: { url: string, maxDimension?: number }

200 → body:    raw RGBA bytes (binary, not base64)
      headers: X-Image-Width, X-Image-Height
4xx → JSON:    { error: string }   validation failures (bad host, too large, bad format)
```

**Binary, not base64** — base64 would inflate the payload 33% for no benefit over a service
binding, which passes `Request`/`Response` objects directly.

**Payload is bounded at 256 KiB.** `DEFAULT_MAX_DIMENSION` is 256 (`photon.ts:48`), so the worst
case is 256 × 256 × 4 bytes regardless of the 10 MB input limit.

## Deployment shape

- **`workers_dev = false` in production** — reachable *only* via service binding, with no public
  surface at all.
- Adopts the `DEPLOY_ENVIRONMENTS.md` pattern from birth: top-level `xivdyetools-image-worker-dev`
  with no routes; production config exclusively under `[env.production]`.
- New `.github/workflows/deploy-image-worker.yml`, mirroring its siblings with
  `deploy --env production`.
- `discord-worker` gains a service binding:
  ```toml
  [[services]]
  binding = "IMAGE_WORKER"
  service = "xivdyetools-image-worker"
  ```

**Deploy order is load-bearing:** `image-worker` must exist before `discord-worker` deploys, or
the binding fails to resolve. The reverse is harmless — an old bot alongside a new image Worker
simply ignores it.

## Secondary benefit: CPU budget

Cloudflare's CPU-time limit applies **per request, per Worker**. Today a single `/extractor`
request spends its one budget on photon decode/resize *and* resvg rasterisation. Split, each
Worker gets its own allowance. This matters more on the free plan than a paid one, and is a real
gain independent of bundle size.

## Risks

| Risk | Mitigation |
|---|---|
| `/extractor` is the only user-visible feature affected; a broken binding breaks it entirely | Deploy `image-worker` first; smoke-test `/extractor` on the beta bot before production |
| Two deploy units must move together | Documented order above; the binding is additive |
| Tests move across packages | The three test files move with their source; coverage excludes adjust |
| A seventh Worker to operate | It has no public surface, no secrets, no storage bindings — the smallest operational footprint in the monorepo |

## Verification

1. `pnpm turbo run type-check test --force` — 17/17 each once `image-worker` joins the workspace.
2. `wrangler deploy --dry-run` on `discord-worker` reports **gzip < 3,072 KiB**. This is the
   gate that matters. **Measured: 2,589.70 KiB gzipped** (7,859.35 KiB raw) — 482.3 KiB of
   headroom under the limit, down from the 3,209.3 KiB baseline (−619.6 KiB).
3. `wrangler deploy --dry-run` on `image-worker` reports well under the limit (~650 KiB expected).
   **Measured: 639.35 KiB gzipped** (1,648.82 KiB raw).
4. `/extractor` on the beta bot returns a correct 14K ramp card.

## Sequencing

This is **first**, ahead of everything currently queued:

| Order | Work | Why |
|---|---|---|
| 1 | **This split** | Nothing deploys until the bundle fits |
| 2 | `DEPLOY_ENVIRONMENTS.md` — safe deploy defaults + beta bot | Needs a deployable Worker to exist |
| 3 | Verify Sprint 2 on beta, then Sprints 3–7 | Needs the beta bot |
| 4 | `DOMAIN_DEPRECATION.md` Phases 2–4 | Needs the 5.0 merge |

## Related

- `docs/operations/DEPLOY_ENVIRONMENTS.md` — the config pattern this Worker adopts at birth.
- `docs/audits/2026-08-09-prerelease-monorepo-upgrade/REMEDIATION_PLAN.md` — Sprint 7
  (`FONT-001`) adds glyphs to the subsets measured above; re-check the gzip figure after it.
