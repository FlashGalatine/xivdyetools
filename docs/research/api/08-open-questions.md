# 08 — Open Questions

Unresolved decisions that need further discussion before or during implementation.

---

## Q1: Batch Operations

**Question:** Should endpoints support batch requests (e.g., match multiple hex colors in one call)?

**Example:**
```
GET /v1/match/closest/batch?hexes=FF5733,33FF57,3357FF
```

**Pro:**
- Reduces HTTP round trips for apps that need multiple matches (e.g., a glamour set with 5 dye slots)
- Better UX for developers

**Con:**
- Complicates rate limiting (does one batch of 10 count as 1 request or 10?)
- Increases response payload size and compute time per request
- Harder to cache (each unique combination of inputs is a unique cache key)

**Recommendation:** Defer to Phase 2+. Start with single-item endpoints. If batch is needed, count each item toward the rate limit (a batch of 10 = 10 rate limit units).

---

## Q2: Developer Portal vs. Docs Page

**Question:** Should there be a dedicated developer portal at `developers.xivdyetools.com`, or embed docs within `api.xivdyetools.com`?

**Option A: Separate subdomain** (`developers.xivdyetools.com`)
- Clean separation between API endpoints and documentation
- Can be a static site (cheaper, faster)
- Requires separate DNS entry and deployment

**Option B: Same domain** (`api.xivdyetools.com/docs`)
- Single deployment unit
- Docs served from the same worker
- API key management at `api.xivdyetools.com/register` stays colocated

**Recommendation:** Option B (same domain). Simplicity wins. The worker can serve both API responses and a docs page with minimal overhead (Scalar UI is ~200 KiB gzipped).

---

## Q3: API Key Registration Model

**Question:** Should API keys be self-service or require manual approval?

**Self-service:**
- Developer logs in with Discord → immediately gets a key
- Lower friction, faster adoption
- Risk: spam accounts creating keys

**Manual approval:**
- Developer submits application → admin reviews → key granted
- Higher quality users, lower abuse risk
- Higher friction, slower adoption, admin burden

**Recommendation:** Self-service with automatic provisioning. Rate limits already prevent abuse. If a key misbehaves, it can be revoked. Reserve manual approval for a future paid/premium tier.

---

## Q4: Community Presets Exposure

**Question:** Should the public API expose community presets (from presets-api), or only curated presets (from PresetService)?

**Curated only:**
- Simpler — no Service Binding to presets-api needed for presets
- Content is stable and curated
- No moderation concerns

**Both curated and community:**
- Richer dataset for developers
- Would need Service Binding to presets-api
- Must respect moderation status (only show `approved` presets)
- Rate limit budgets shared between direct presets-api traffic and pass-through

**Recommendation:** Phase 1–3: curated only. Phase 4+: evaluate adding community presets via Service Binding, exposing only `approved` presets with read-only access.

---

## Q5: Image Upload for Palette Extraction

**Question:** Should the API expose `PaletteService.extractPalette()` (k-means color extraction from images)?

**Challenges:**
- Requires image upload (POST with multipart/form-data or base64)
- Significantly higher compute cost than other endpoints
- Workers have a 30-second CPU time limit; large images could exceed this
- Storage implications (do we store uploaded images? process in-memory only?)
- Abuse potential (large uploads, denial of service)

**If yes:**
```
POST /v1/palette/extract
Content-Type: multipart/form-data

image: <binary>
colorCount: 4
matchDyes: true
locale: en
```

**Recommendation:** Defer to post-Phase 5. If implemented, require a registered API key (no anonymous access), enforce strict file size limits (max 2 MiB), process in-memory only (no storage), and count as 10 rate limit units per extraction.

---

## Q6: Multi-Step Color Conversion

**Question:** Should `/color/convert` support chained conversions (e.g., RGB → OKLAB → OKLCH) or only direct conversions?

**Direct only:**
- Simpler implementation — map each `from`/`to` pair to a specific `ColorService` method
- Some pairs may not have a direct method (e.g., RYB → OKLCH), requiring intermediate steps internally

**Chained:**
- More flexible for developers
- But any chain can be done with multiple API calls
- Internal chaining is an implementation detail, not a user-facing feature

**Recommendation:** Direct conversion only, but internally chain through RGB when no direct method exists (e.g., RYB → RGB → OKLCH). The API consumer sees a single `from=ryb&to=oklch` call; the chaining is hidden.

---

## Q7: API Version Deprecation Policy

**Question:** How long should deprecated API versions remain available?

**Options:**

| Policy | Sunset Period | Pros | Cons |
|--------|--------------|------|------|
| **Aggressive** | 6 months | Less maintenance burden | Breaks slow-moving integrations |
| **Standard** | 12 months | Industry norm (Stripe, GitHub) | Moderate maintenance |
| **Conservative** | 24 months | Maximum compatibility | Long-term burden, tech debt |

**Recommendation:** 12-month deprecation window with clear communication:
- `X-API-Deprecated: true` header on deprecated versions
- `X-API-Sunset: 2027-03-01` header with sunset date
- Email/Discord notification to registered key holders
- Deprecation announcement in changelog and docs

---

## Q8: Analytics and Monitoring

**Question:** What level of analytics should the public API provide?

**Minimum (Phase 1):**
- Cloudflare Analytics Engine: request count, latency, error rate per endpoint
- Rate limit hit tracking in KV

**Enhanced (Phase 4+):**
- Per-API-key usage dashboard: requests/day, top endpoints, error rate
- Global API usage statistics (anonymized, public-facing)
- Latency percentiles (p50, p95, p99)

**Advanced (future):**
- Usage-based billing telemetry (if paid tier is added)
- Real-time alerting on error rate spikes
- Consumer-facing status page at `status.xivdyetools.com`

**Recommendation:** Start with Cloudflare Analytics Engine (already used by og-worker). Add per-key dashboard in Phase 4 alongside API key management.

---

## Q9: WebSocket / Server-Sent Events

**Question:** Should the API support real-time updates (e.g., market price push notifications)?

**Use case:** A developer wants their app to automatically update when market prices change, without polling.

**Reality check:**
- Universalis data is already 5+ minutes stale (their refresh interval)
- Worker WebSocket support exists (Durable Objects) but adds significant complexity
- Polling `/v1/prices/` every 5 minutes is simple and adequate
- Demand is likely low for this niche use case

**Recommendation:** Not in scope. Polling with proper `Cache-Control` headers is sufficient. Revisit only if multiple developers request it.

---

## Q10: Rate Limit Unit Accounting

**Question:** Should all endpoints count equally toward the rate limit, or should compute-heavy endpoints cost more?

**Equal (simple):**
- Every request = 1 unit
- Easy to understand and implement
- Spectral mixing and harmony generation cost more CPU than a dye lookup, but the difference is marginal at current scale

**Weighted (complex):**
- Dye lookup = 1 unit
- Color conversion = 1 unit
- Harmony generation = 2 units
- Palette extraction = 10 units (if implemented)
- More fair resource allocation
- Harder to communicate to developers

**Recommendation:** Equal weighting for Phase 1–4 (all current endpoints are fast). Only introduce weighted units if palette extraction (Q5) is implemented, since that's the only truly expensive operation.

---

## Q11: Patch 7.5 Consolidation Transition

**Question:** How should the API handle the transition period around Patch 7.5's dye consolidation (April 28, 2026)?

**Context:** Patch 7.5 consolidates 105 individual dye items into 3 base items (Type A: 85, Type B: 9, Type C: 11). Post-patch, all dyes in a consolidation group share a single market price via a new consolidated item ID. The consolidation is activated by setting 3 item IDs in `consolidated-ids.ts`.

**Sub-questions:**

1. **Should the API expose `consolidationActive` status?** If yes, consumers can adapt their UIs (e.g., show "all Type A dyes cost the same" instead of individual prices). Already included in `/dyes/consolidation-groups` response.

2. **Should `/prices/` return per-dye or per-group prices?** Post-consolidation, all 85 Type A dyes have the same market price. Options:
   - **Per-group only** — Return 3 consolidated prices + ~17 Special prices. Simpler, accurate.
   - **Fan out** — Return all 136 prices, but Type A/B/C dyes share their group's price. More data, but consumers don't need to understand consolidation.
   - **Both** — New `/prices/:datacenter/dyes` endpoint (per-group), existing `/prices/:datacenter/:itemIds` fans out.

3. **Should `marketItemID` be a response field?** Including it lets consumers call Universalis directly for real-time checks. But it exposes an implementation detail.

4. **Pre-patch behavior:** Before the 3 consolidated item IDs are known, `consolidationType` is present on dyes (tagged from game data) but `marketItemID` equals the original `itemID`. Consumers should not need to handle the transition — the API abstracts it.

**Recommendation:**
- Include `consolidationType`, `isIshgardian`, and `marketItemID` on all dye responses from day one (even pre-patch, when `marketItemID === itemID` for consolidated dyes)
- The `/prices/:datacenter/dyes` convenience endpoint returns per-group prices with `appliesTo` count
- The `/prices/:datacenter/:itemIds` endpoint auto-deduplicates consolidated IDs and fans out results
- `consolidationActive` boolean in meta tells consumers whether consolidation is live

---

## Q12: stainID as API Identifier

**Question:** How should the API handle `stainID` as a dye identifier, and what role should it play post-Patch 7.5?

**Context:** The game's stain table ID (`stainID`, range 1–125 for current dyes) is the internal identifier used by Dalamud plugins (Glamourer, Mare Synchronos), character save data, and datamined content. Post-Patch 7.5, dye consolidation means **new dyes may be added via the stain table without individual inventory itemIDs**, making `stainID` the only universal identifier for those dyes. The codebase already has `DyeDatabase.getByStainId()` with O(1) Map-based lookup.

**Key observation — disjoint ID ranges:**

| Range | ID Type | Example |
|-------|---------|---------|
| Negative | Facewear synthetic ID | `-1` (Black Facewear) |
| 1–125 | stainID | `1` (Snow White) |
| 126–5728 | Unused (no dye in either system) | — |
| 5729+ | itemID | `5729` (Snow White) |

Because these ranges never overlap, `GET /dyes/:id` can **auto-detect** the ID type from the numeric value alone — no query parameter needed.

**Sub-questions:**

1. **Should stainID become the recommended identifier for post-7.5 consumers?** If new dyes lack individual itemIDs, stainID becomes the only universal identifier. However, stainIDs could theoretically shift when new stain rows are inserted (though this has never happened in FFXIV's history — existing stainIDs have been stable since 2.0).

2. **Should the batch endpoint support mixed ID types?** An `idType` query parameter (`auto`, `item`, `stain`) on `GET /dyes/batch` lets consumers force interpretation. `auto` (default) applies range-based detection per-ID, allowing mixed lists like `?ids=1,5729,-1`. Alternatively, require all IDs in a batch to be the same type — simpler but less flexible.

3. **Should `excludeIds` accept stainIDs?** The `excludeIds` parameter on `GET /dyes` and `GET /match/closest` currently expects itemIDs. Adding auto-detection is consistent with the `/dyes/:id` behavior but adds implementation complexity.

4. **Should there be an explicit `/dyes/stain/:stainId` endpoint?** Even with auto-detection on `/dyes/:id`, a dedicated endpoint provides unambiguous stainID-only semantics. This future-proofs against the unlikely scenario where FFXIV introduces itemIDs in the 1–125 range.

**Recommendation:**
- Auto-detect on `GET /dyes/:id` using range-based resolution (safe due to disjoint ranges)
- Provide `GET /dyes/stain/:stainId` as an explicit alternative for consumers who want unambiguous stainID semantics
- Batch endpoint supports auto-detection by default with optional `idType` override
- `excludeIds` supports auto-detection (consistent behavior across all ID parameters)
- Post-7.5, if new dyes lack itemIDs, update documentation to recommend stainID for those dyes specifically, while keeping itemID as the default for dyes that have them

---

## Decision Tracker

| # | Question | Status | Decision |
|---|----------|--------|----------|
| Q1 | Batch operations | Open | Defer to Phase 2+ |
| Q2 | Portal location | Leaning | Same domain (`/docs`) |
| Q3 | Key registration | Leaning | Self-service |
| Q4 | Community presets | Open | Curated-only initially |
| Q5 | Image upload | Open | Defer to post-Phase 5 |
| Q6 | Chained conversion | Leaning | Direct only (chain internally) |
| Q7 | Deprecation policy | Leaning | 12 months |
| Q8 | Analytics level | Leaning | CF Analytics Engine → per-key Phase 4 |
| Q9 | WebSocket/SSE | Closed | Not in scope |
| Q10 | Rate limit units | Leaning | Equal weighting |
| Q11 | Patch 7.5 consolidation transition | Leaning | Expose fields from day one; fan out prices; `consolidationActive` in meta |
| Q12 | stainID as API identifier | Leaning | Auto-detect on `/dyes/:id`; explicit `/dyes/stain/:stainId`; `idType` on batch |
