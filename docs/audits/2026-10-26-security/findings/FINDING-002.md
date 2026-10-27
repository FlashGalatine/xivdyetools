# FINDING-002: api-worker reads XIVAPI search/Glasses bodies unbounded and caches item names with no length cap, control or bidi filtering (7-day cache; quadratic downstream sinks)
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** api-worker (primary); packages/core chara-gposers, packages/svg frame.ts, bot-logic/discord-worker and web-app as downs… · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-400
**Merged:** G49, G65 (same root cause)

## Location
- `apps/api-worker/src/chara/xivapi.ts:432` — XIVAPI search/Glasses bodies read with unbounded response.json(); item names have no length cap before the 7-day cache and the O(n^2) downstream sinks
- `packages/core/src/services/chara/chara-gposers.ts:120` — GPOSERS text() regex is quadratic on long non-newline whitespace runs
- `apps/api-worker/src/chara/data/item-names.ko.json:1` — Bidi/format characters not stripped in upstream names

## Evidence
- xivapi.ts:432 `const body = await response.json<RawSearchResponse>();` | :453 `const body = await response.json<RawSheetRow>();` | :97 `value.replace(/­/g, '').trim()` | vs :326-327 `JSON.parse(await readBoundedText(response.body, MAX_CONTEXT_BYTES))` | chara-gposers.ts:120 `value?.replace(/\s*[\r\n]+\s*/g, ' ')` | frame.ts:198 `while (chars.length > 1 && textWidth(chars.join('') + '…', size, font) > maxPx) chars.pop();`
- Reach: Any client can POST /v1/chara/resolve and make searchItems (xivapi.ts:428-432) or getGlasses (:448-453) fetch from XIVAPI, but only the upstream (v2.xivapi.com or whatever host XIVAPI_BASE names) controls the body and name contents. A hostile or compromised upstream would send an oversized body or an oversized name, and that name is cached for about 7 days and served to web-app (chara-resolve-service.ts:212) and discord-worker (handlers/commands/glamour.ts:92), neither of which caps it.
- The code matches the claim. xivapi.ts:432 and :453 call response.json() with no byte cap, while the context probe at :326-327 uses readBoundedText (32 KiB) and icons.ts:48 caps at 1 MiB. cleanName (:96-97) only strips U+00AD and trims, and namesOf (:184-190) does no slicing. The sinks are quadratic: gposers text() at chara-gposers.ts:120 uses /\s*[\r\n]+\s*/g, which backtracks O(n^2) on long whitespace runs, and fitText at frame.ts:185-202 pops one code point per iteration and re-measures the whole string each time. This is narrower than the MEDIUM/INTERNET-UNAUTH grading: the 2026-10-03 handoff (handoffs.md:217) routed it as robus… Preconditions: The attacker must control or compromise the XIVAPI upstream, or the XIVAPI_BASE var must be misconfigured to point at a hostile host. An internet client can trigger the fetch but cannot influence the body. All sub-claims are factually real (unbounded json at both sites, no name cap or control strip…
- Live state the repo cannot show: The production value of XIVAPI_BASE in wrangler.toml / deployed vars (the default is https://v2.xivapi.com). Whether XIVAPI itself enforces name lengths cannot be checked from the repo.

## Fix
- Read both bodies with JSON.parse(await readBoundedText(response.body, MAX_SEARCH_BYTES)) (about 2 MiB for search, 32 KiB for Glasses). Map BodyTooLargeError to UpstreamUnavailableError so it is never cached.
- In cleanName, strip C0/C1 control characters, collapse whitespace and cap names at about 128 code points before anything is cached.
- Optional defense in depth: make fitText binary-search its cut point and rewrite gposers text() without the leading \s* backtracking.

## Status
OPEN — A-CORE's GPOSERS companion source is prepared and beta-verified; [core evidence](../../2026-10-26-xivcharakit-dead-code/evidence/remediation-core-2026-10-27.md). A-SVG's linear, output-equivalent fitText implementation passes 562 unit tests, whole-graph/affected-app gates and independent review; feature PR/beta receipts and release remain pending; [SVG evidence](../evidence/remediation-svg-2026-10-27.md). API body/name bounds and production release verification remain outstanding. These companions do not close the finding.
