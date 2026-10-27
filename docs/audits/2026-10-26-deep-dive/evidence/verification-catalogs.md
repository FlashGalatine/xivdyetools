# Independent verification — initial catalogs

Snapshot `6da3ff5b`; `xivdye-verifier`, explicitly resolved `gpt-6.1-sol` / `xhigh`, instruction-only role. All 19 candidates confirmed by independent caller/code/test inspection. No files, builds, test suites, production requests or Git state changed. Two permitted read-only source probes were repeated: initialized Discord command metadata (12 missing maps), and real generated OG SVG with bundled fonts (both recorded hashes reproduced).

| Candidate | Verdict | Corrected evidence / limit |
|---|---|---|
| pkg-001 | MEDIUM | HarmonySelector:130-141 returns degrees for hue-only HSV selection; harmony.ts:258-280 mixes those with metric companion distances. Non-HSV wheels force perceptual selection. |
| pkg-002 | MEDIUM | swatch.ts:424-449 uses index equality; EXT-28 parity fixture:5667-5688 has differing active winning colors. Merge only effective equal colors. |
| pkg-003 | LOW | chara-library.ts:146-149,265-269 splits supplementary characters; web card:289-311 displays labels. Cosmetic; SVG drops lone surrogates. Include web filename boundary in its consumer task. |
| pkg-004 | LOW | glamour.ts:576-613 leaves note tail uncapped; negative remaining allowance can retain most body. Abnormal upstream/injected names required. Existing body-only regression does not cover notes. |
| workers-01 | LOW | presets.ts:1071-1109 and rate-limit-service.ts:379-387: both synchronized final-slot submissions can lose; append-only quota events survive rollback until UTC reset. |
| workers-02 | LOW | presets.ts:611,1512-1525 plus preset-service.ts:687-694: omitted secondary list retains promoted primary. SQL categories:47-50 does not double count; stored/UI invariant only. |
| workers-03 | LOW | preset-service.ts:420-438 returns zero; presets.ts:1081 votes, :1163 returns old object. Return successful vote state while preserving vote-failure handling. |
| workers-04 | LOW | presets.ts:1191,1301-1330 unconditionally updates captured image state without changes check. Races distinct from accepted failed R2 deletion. |
| workers-05 | LOW | preset.ts:1324-1339 joins 50 names that can escape to 100 characters each (sanitize.ts:23,61-62). Requires a sufficiently large/long list. |
| workers-06 | LOW OPT | preset.ts:1310-1312 and preset-api.ts:237-245: up to 50 requests. Batch can save 49 request/query round trips, not 49 rows read. No latency benchmark. Dedupe security FINDING-024; carry Oct4 OPT-003. |
| workers-07 | LOW | preset.ts:1310-1320 turns API errors into missing entries. No KV mutation or permanent favorite deletion. |
| workers-08 | LOW | glamour.ts:183-200 ignores false edit result; command-trace.ts:232-245 defaults ok. Failure is logged. Expired tokens may prevent fallback. |
| web-root-001 | LOW | Correct anchors glamour-block.ts:337-349,803-813; chara-file-card.ts:358-361. glamour-tool.ts:137-151 deliberately retains block. Cold chunk required; saved probe asserts defect. |
| CONTENT-001 | HC P1 | main.ts:185-190 passes English detail beside translated chrome. Safe standalone locale table must cover this sentence without LanguageService. |
| CONTENT-002 | I18N P2 | localize.ts:138-204,220-224 omits 2 order + 7 slot + 3 sort localization maps. Source probe confirms; no command registration. Bot-logic key publication precedes Discord metadata deploy. |
| CONTENT-003 | TERM P2 | Five Korean Hue values conflict with explicit colorspace house rule at i18n-fonts.md:70-74. Existing terminology decision; no new client-term judgment. |
| CONTENT-004 | I18N P1 | Correction from provisional P2: false count is wrong displayed text. Applies to default Discord-frame subtitle only (default-card.ts:131-176); X omits deck. Update cache version as well as copy/fixtures. |
| CONTENT-005 | FONT P3 | Real render hashes repeated; current-order 全色盲 equals JP-only, reversed order equals SC-only. Regional forms, not tofu. Renderer must accept locale. |
| CONTENT-006 | HC P1 | Correction from provisional P2: live hardcoded preference UI is P1 by skill taxonomy. Dormant command consumer reduces practical urgency, not reachability. Preserve stored canonical values. |

Full source paths, regression gaps and detailed traces remain in the candidate JSON/reviewer evidence. Final IDs are assigned only by the coordinator. No security-critical escalated verdict was needed; preceding security findings retain their original verified snapshot basis.
