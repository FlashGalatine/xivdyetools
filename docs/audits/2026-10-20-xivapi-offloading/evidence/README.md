# Evidence and reproduction

Captured on 2026-10-20 from public XIVAPI v2 with a descriptive User-Agent and `Origin: https://xivdyetools.app`. Requests were sequential, separated by 250 ms, with a 15-second timeout and a 2 MB read cap. No credentials, user files or private character data were sent.

- [probe-manifest.json](probe-manifest.json): exact URLs, UTC starts, observed status/selected headers, elapsed time, body filenames and SHA-256.
- [summary.json](summary.json): 25 requests; 17 HTTP 200, three 404, four 400, one 304. Two of the HTTP-200 responses exceeded the research size cap and have no saved body. Saved response bodies total 145,639 bytes.
- [stain-parity.json](stain-parity.json): all 125 identities, item links and complete discrepancies against local dyes/CSV.
- [COLOR_DIFFERENCES.md](COLOR_DIFFERENCES.md): readable table of the 22 hex discrepancies.
- [openapi.json](openapi.json): live endpoint/language/asset-format contract.
- [issue-322.json](issue-322.json): research scope captured from GitHub.
- [VERIFICATION.md](../VERIFICATION.md): independent review and local artifact validation.

## Observations and failed assumptions

| Evidence | Observation | Interpretation / limit |
|---|---|---|
| stain-coverage-1/2.json | 100 + 25 rows; four nonempty names each; 42,627 bytes | Complete coverage of the current local catalog, not discovery of every upstream dye |
| stain-parity.json | 22 hex differences, zero metallic differences, zero expected consolidated-link differences | Hold color changes for separate source/client review |
| stain-four-locales.json | Two rows, four names, selected metadata in 456 bytes | Decorated language batching works; three other English Stain names contain trailing spaces |
| stain-pinned.json | Explicit game and schema pins return 200 | Pin values are recorded, not future availability guarantees |
| stain-sample.json | The guessed row 131 makes the requested batch return 404 | Do not assume sparse/missing IDs are silently skipped; required-row validation belongs in a future importer |
| stain-transient.json and stain-transient-pinned.json | Sheet not found at latest and 541c0c12e07da325 | Use observed Stain.Item[]; do not claim when StainTransient changed historically |
| stain-ko/zh.json | Application locale codes rejected by API parser | Not sufficient alone to establish regional coverage |
| stain-language-kr/chs.json | Correct API spellings also rejected as unsupported | Confirms the documented global-client language boundary for these requests |
| items.json, known-equipment-search.json | Selected item fields and a real model/slot query succeeded | Search helps retrieve candidate rows; our resolver chooses among alternatives |
| equip-search.json | Deliberately exploratory model/slot query returned zero rows | Empty result is not a service failure |
| glasses.json | Glasses row 1 provides name/icon; requested GlassesId field absent | Do not assume request-side .chara GlassesId is a response field; row_id is the lookup identity |
| gilshop.json | GilShopItem rows/subrows and Item.Name links returned | Raw shop evidence, not a complete NPC/location/acquisition join |
| specialshop.json | Guessed ReceiveItems path returned empty objects with HTTP 200 | Validate projected keys; the schema's relation grouping is not the actual JSON field path |
| specialshop-projected.json | Actual Item[].Item[], ItemCost[], counts/cost-mode fields returned in 23,085 bytes | Field existence confirmed, not a full availability/currency semantic audit |
| specialshop-full / specialshop-field-shape manifest entries | Advertised roughly 5.26 MB; read stopped at 2,000,001 bytes | No bodies retained. Neither unrestricted expansion nor @as(raw) on the struct provided a safe small response |
| icon.bin, icon-conditional.bin | PNG, ETag, 304; max-age 604800; wildcard CORS | Upstream caching verified on one asset; not the existing proxy's 30-day policy |
| versions.json | latest=0874aee069e1e7c4 (7.57x1); acquisition pin=541c0c12e07da325 (7.56x1) | Snapshot of service labels, not an independent game-release chronology |

Recorded response schemas use `exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb`. Independent schema references: [Stain.yml](https://github.com/xivdev/EXDSchema/blob/e773c41a90aed788cf4c1c48469fa85618ef01fb/Stain.yml), [SpecialShop.yml](https://github.com/xivdev/EXDSchema/blob/e773c41a90aed788cf4c1c48469fa85618ef01fb/SpecialShop.yml).

No successful JSON probe returned Cache-Control/ETag in the selected captured headers. Do not infer that absence means upstream has no internal caching. No numerical rate quota or SLA was established, and no rate-limit/load test was run.

## Reproduce without changing this snapshot

Copy this audit directory to a new dated audit directory at the same depth in a checkout of the recorded repository revision. Then run these Python files in order from its evidence folder:

1. `python probe_xivapi.py`
2. `python probe_followup.py`
3. `python probe_coverage.py`
4. `python analyze_stain.py`
5. `python summarize.py`

These are research scripts, not a new production importer. They intentionally retain exploratory failures; the main script discovers latest, so a later run may capture a different version. The coverage step pins the version/schema obtained in that run. To reproduce comparisons for this snapshot exactly, reuse the saved coverage responses and the recorded repository revision; no live call is needed. Network timings and headers will vary.

The color and locale comparison is strict. The CSV analysis also reports a trim-only comparison. It does not case-fold/inflect names before deciding whether a naming convention changed, and does not rewrite either source.


## Full-sheet discovery follow-up

Three additional requests enumerate Stain without a local-ID allowlist. They are preserved separately in [discovery/manifest.json](discovery/manifest.json), with [summary](discovery/summary.json), raw pages and the enumeration script. See [DYE_DISCOVERY.md](../DYE_DISCOVERY.md) for the 129-row result and future-patch detection recommendation. The original 25-request manifest and counts above are unchanged.
