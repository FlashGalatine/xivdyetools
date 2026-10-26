# Complete dye-list discovery through XIVAPI

**Follow-up requested:** 2026-10-20, issue [#322](https://github.com/FlashGalatine/xivdyetools/issues/322).  
**Baseline:** `b98c8584a85f5dc50b4b4392c508cc627ef004d6`.  
**Status:** Research verified; no production importer, scheduled job or data changes implemented.

## Answer

**Yes: XIVAPI exposes an enumerable Stain sheet that can serve as the upstream dye-color catalog.** It is not a separately curated list of currently obtainable dyes. The sheet includes special and blank rows, so discovery must classify the results before proposing additions.

Unlike the original audit's known-ID requests, this follow-up requested the entire sheet without a `rows=` allowlist. The [sheet-reading documentation](https://v2.xivapi.com/docs/guides/sheets/) documents enumeration with `limit` and `after`; [version/schema pinning](https://v2.xivapi.com/docs/guides/pinning/) lets all pages describe one consistent snapshot.

## Live enumeration result

Captured at game version `0874aee069e1e7c4` (latest/7.57x1 during this run), schema `exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb`.

| Result | Count / IDs | Treatment |
|---|---|---|
| Total sheet rows | **129**, IDs 0–128 | Preserve complete raw snapshot |
| Named nonzero rows | **125**, IDs 1–125 | All match the current local catalog's stainIDs |
| Special no-dye row | ID 0, **No Color** | Exclude from the dye catalog; its Item link is Terebinth |
| Blank rows | IDs **126, 127, 128** | Keep in the snapshot as blank rows; do not assume their future purpose |
| Additional named dye candidates | **0** | None at this tested version |
| Local dyes absent from named upstream rows | **0** | All 125 covered |

The first page resolved the current game version and schema; subsequent pages explicitly pinned those returned values. Three requests returned **100 rows, 29 rows, then an empty page**. Total response bodies: 48,984 bytes, including four-language names and selected metadata. All named nonzero rows currently have at least one positive Item link. This is an observation, not a mandatory filter for future dyes.

Evidence: [summary](evidence/discovery/summary.json), [request manifest](evidence/discovery/manifest.json), [enumeration script](evidence/discovery/enumerate_stains.py), and raw [page 1](evidence/discovery/stain-list-page-1.json), [page 2](evidence/discovery/stain-list-page-2.json), [terminal page](evidence/discovery/stain-list-page-3.json).

## How to find additions in future patches

Extend the proposed **maintenance-time, report-only Stain audit command** to scan the whole sheet. A fetch restricted to our known 125 IDs cannot discover a new one.

1. Resolve the target game version and matching canonical schema once, then pin both for the enumeration. A refresh that always uses today's old pin will never see future patch additions. Record any intentional pin advance.
2. Start at `/api/sheet/Stain` with no `rows` or `after` parameter. Request only the required fields, for example:
   `Name,Name@ja,Name@de,Name@fr,Color,Shade,SubOrder,IsMetallic,IsHousingApplicable,Item[].Name`.
3. Request a bounded page (100 worked here), then set `after` to the last returned row ID. Resend fields, limit, version and schema on every page. Continue until a successful empty `rows` array, even after a short page: upstream limits may be clamped.
4. Require ascending unique IDs, forward progress, expected field types and unchanged version/schema. An error, malformed response, timeout, size/page cap or missing required field makes the scan **incomplete**. Never turn an incomplete scan into “no new dyes.”
5. Compare the full result both with the local stainID set and with the previous full snapshot. Report **new named IDs**, **previously blank rows that became populated**, **changed existing rows**, and **missing/blanked existing dyes** separately.
6. Keep results as review candidates. A new named Stain row is not proof that players can obtain/use it yet. Preserve six-language requirements, category/acquisition decisions, stable identities and the earlier audit's unresolved color differences before accepting a release.

**Scan from the beginning each time.** A query starting after the highest known ID can miss reused holes or changes to older rows. Comparing only row count or maximum ID also misses blank-to-populated transitions—IDs 126–128 show why that distinction matters.

Do not filter solely on `Color != 0` (black can be valid), a positive Item link (row 0 has one), `IsHousingApplicable` (housing is a separate property), an English “Dye” suffix, or the current consolidated Item IDs. Stain IDs identify colors; Item IDs identify consumables and can be shared across many colors.

## Recommendation change and limits

This follow-up **extends the first-change recommendation in [README.md](README.md)**: include complete Stain enumeration and discovery, rather than only parity checks for existing local rows. Add fixtures for a new higher ID, a previously blank lower row becoming populated, sparse IDs, changed existing rows, a clamped short page followed by more rows, terminal empty-page detection, and incomplete scans. Keep ordinary builds and runtime dye lookups offline.

The global service still supplies only en/ja/de/fr data. A discovery workflow can flag a new dye before the maintained ko/zh translations are available; it must not silently reduce locale coverage. The result reflects what XIVAPI has ingested at the chosen version, with no verified patch-time availability guarantee. It is not an availability, acquisition, rendering or regional-release certification.

These three requests and their manifest are separate from the original audit's 25-request evidence set. Prior captures and findings remain intact.
