# Character-file size policy: 8 KiB proposal

## Scope and provenance

On 2026-10-15 the maintainer requested investigation of an 8 KB character-file ceiling and supplied the `CharaSamples` folder. This is a documentation follow-up to audit commit `4db66f3e6157fc36999d098650ce9e507a6e39b8`; application source remains `e4fd9fc0f5e45e398e14010e6894eed12d272dbc`. No import limit or other application source was changed. The proposal deliberately replaces the audit's earlier requirement to preserve large embedded-image exports.

The coordinator measured all top-level `.chara` files in the supplied folder, including their original on-disk byte lengths, and passed their text to core's actual source parser. No source files were modified, image payloads decoded, network requests made by the script, or private corpus contents copied into the repository. The JSON capture contains aggregate statistics, a digest of the content-hash set and the oversized file's content hash/size, not character names or image data. Producer groups describe declarations in the input; they are not authenticated provenance or version/age evidence.

The source reviewer retained `gpt-6.1-sol` / `medium`; the independent security verifier retained `gpt-6-astra` / `high`. The reviewer inspected affected application boundaries without reading the external corpus. The verifier reviewed the saved script/results and source claims, without independently rescanning the corpus. The coordinator owns the measurements, document text and Git operations.

## Corpus measurements

| Measurement | Result |
| --- | ---: |
| Files / unique content hashes | 1,093 / 1,093 |
| Accepted by the current core parser | 1,093 |
| Files with `Base64Image` absent | 999 |
| Files with `Base64Image: null` | 93 |
| Files with a nonempty `Base64Image` string | 1 |
| Empty-string / other-type image fields | 0 / 0 |
| Files without nonempty image data | 1,092 |
| Their minimum / median / 95th-percentile / maximum bytes | 1,837 / 2,475 / 2,725 / 2,777 |
| Files exceeding 8,000 bytes | 1 |
| Files exceeding 8,192 bytes | 1 |

The sole oversized file declares `Anamnesis Character File`: **3,128,021 bytes**, including a **2,898,324-character `Base64Image`** string. Removing that property from an in-memory copy yields 1,665 bytes with compact JSON serialization or 2,106 bytes with two-space indentation; these are formatting-dependent measurements, not a modification to the source file or an import workaround. The script deliberately does not determine whether the embedded data is a real image or a spoof.

All 1,092 remaining files fit either interpretation of “8 KB.” The proposal uses the precise binary boundary **8 KiB = 8,192 bytes**. This leaves headroom above the largest ordinary file in this corpus, while intentionally refusing its large image-bearing export. The current Discord 1 MiB limit already refuses that example; the current web 20 MiB limit allows it to reach parsing. No inference that every legitimate/future export fits, or that larger files are malicious, is warranted.

## Reproduction and small policy probes

With dependencies available, run from the repository root:

```powershell
node --import tsx docs/audits/2026-10-15-web-app-security/evidence/scripts/profile-chara-size-policy.mjs . 'C:\dev\XIVProjects\CharaSamples'
```

[Saved script](scripts/profile-chara-size-policy.mjs) and [captured output](chara-size-profile.json). The script scans top-level `.chara` files only, uses original bytes for size statistics, runs the actual `parseCharaFile`, and prints JSON. The proposed cap is simulated; no production guard has been implemented or integration-tested at the new threshold.

| Probe | Bytes | Observed result |
| --- | ---: | --- |
| Null image placeholder | 71 | Fits cap; parser output unchanged |
| Empty image placeholder | 69 | Fits cap; parser output unchanged |
| Non-image text in `Base64Image` | 94 | Fits cap; current parser accepts and omits image field |
| Base64-encoded non-image text | 105 | Fits cap; current parser accepts and omits image field |
| Just below proposed cap | 8,191 | Simulated size gate admits; current parser accepts |
| Exactly at proposed cap | 8,192 | Simulated size gate admits; current parser accepts |
| Just above proposed cap | 8,193 | Simulated size gate refuses; current parser alone still accepts |
| Multibyte UTF-8 text | 9,069 | Refused by byte length despite fewer than 8,192 JavaScript string units |
| Earlier nested diagnostic input | 20,014 | Exceeds proposed cap; this does not prove all harmful inputs exceed it |

All **nine** probes matched their explicit expectations. These are bounded audit probes, not new application tests or a malicious-payload detector. In particular, arbitrary small content can fit in a string field; merely claiming a producer or image format establishes no trust.

Validation passed for the saved script's syntax, all 34 local audit links, the repository's 1,015-link documentation check and its 34 version claims. The earlier 215 focused tests remain historical evidence from the Discord follow-up; they were not rerun or represented as coverage of an implemented 8 KiB guard. No full application suite was run for this documentation-only addendum.

## What the change would protect

An early whole-file byte ceiling reduces memory and parsing work before JSON interpretation. It would exclude the recorded large image-bearing sample from the web path, further constrain Discord inputs and exclude the existing 20,014-byte diagnostic reproducer from both. That is a resource restriction. It does not authenticate payloads, guarantee absence of image data, or replace semantic validation, depth/field limits and bounded error construction.

Core currently calls `JSON.parse` (`packages/core/src/services/chara/chara-parser.ts:384`), which allocates strings including image data, but returns only selected character fields (`:521`). The module explicitly says never to read `Base64Image` (`:50`); the reviewed web and bot flows do not decode or render it. A spoofed string was not demonstrated to execute or cross a new trust boundary.

If the maintainer's desired product policy is “no embedded images in character files,” the recommended companion rule is explicit refusal of **nonempty `Base64Image` strings and non-string/non-null values**. Keep missing, null and empty-string placeholders compatible; 93 corpus files use null. Perform that semantic check after the early byte guard, without decoding the image or interpolating its contents into a diagnostic. The decision is deferred with implementation. Rejecting one known field is not a generic payload detector: unrecognized fields can also hold small arbitrary data and must remain inert/bounded.

## Implementation boundaries to preserve

| Surface | Required follow-up and source evidence |
| --- | --- |
| Web loader | Add a dedicated character-file cap before `file.text()` in `apps/web-app/src/services/chara-file-loader.ts:51`; both tools already share it |
| Existing image uploads | Keep `apps/web-app/src/shared/constants.ts:127` and Palette Extractor's use at `src/components/extractor-tool.ts:1303` separate; lowering the global cap would also reduce image uploads |
| Web message | `apps/web-app/src/components/chara-file-card.ts:143` maps to a 20 MB message; use dedicated character-file wording in all six locales |
| Discord guard | `apps/discord-worker/src/utils/chara-attachment.ts:17,75,105`: set the same byte cap for metadata and actual download, including missing/misleading length headers |
| Discord message | `chara-attachment.ts:20,76,107` currently converts to MB; simply changing bytes would print `0.0078125 MB`. Update placeholder/unit and all six bot locales |
| Generic stream helper | Keep `apps/discord-worker/src/utils/read-text-capped.ts:34,40,49` generic and preserve counting/cancellation and encoded-byte fallback |
| Parser content policy | `packages/core/src/services/chara/chara-parser.ts:384,408,521`: keep key-based producer compatibility and selected output; consider the explicit image-field rule independently of size |
| Web rejection state | Preserve the prior character session: `apps/web-app/src/services/chara-file-loader.ts:89` publishes only after success |
| Living documentation | Update web/Discord unit `CLAUDE.md`, Glamour Reader guide, web tools reference, Discord command reference and project command guide when limits actually change |

Acceptance work must cover 8,191/8,192/8,193 bytes; UTF-8 versus string length; admission through both web controls/tools and both Discord commands; refusal before reading/parsing; misleading CDN lengths; preservation of transport guards and session state; null/empty/missing versus populated image fields; and unchanged image-upload limits. Use small synthetic fixtures for embedded-data tests, not private corpus files. Any refusal should explain the supported limit/image policy without labeling a file malicious solely because it is larger.

## Independent security verification — full final return

| id | Verdict | Reason with evidence |
|---|---|---|
| S1 | CONFIRMED | Recommend a dedicated **8,192-byte character-import cap**, preserving image uploads’ 20 MiB allowance. Update web pre-read validation and its localized message (`chara-file-loader.ts:51`; `constants.ts:127`; `chara-file-card.ts:143–144`), plus Discord metadata/stream guards and MB wording (`chara-attachment.ts:17–20,75–76,105–107`); retain parser defenses. |
| S2 | CONFIRMED | Saved profile records 1,093 unique files/parser successes; 1,092 without nonempty images span 1,837–2,777 bytes. Its sole oversized file is 3,128,021 bytes with the stated producer declaration and 2,898,324-character field (`chara-size-profile.json:6–43,79–92`). Script scans **top-level `.chara` files only**, counts bytes and never decodes images; both thresholds exclude one. Compatibility evidence is corpus-specific. |
| S3 | CONFIRMED | The 94/105-byte probes pass simulated size checks and actual parsing with unchanged output (`chara-size-profile.json:112–125`; script `:64–74`). Core JSON-parses the field but omits it from its result (`chara-parser.ts:384,521–534`). A separate content rule rejecting nonempty strings and non-string/non-null values would implement the proposed strict policy; missing/null/empty remain permissible. Neither producer identity nor an exploit is established. |
| S4 | CONFIRMED | This deliberately supersedes the existing embedded-image preservation requirement (`SECURITY_AUDIT_REPORT.md:87`) and proposed retention of the old Discord cap (`:90`). Application paths remain unchanged against `e4fd9fc0`; findings stay open and severity need not change. The 20,014-byte case exceeds the proposal (`chara-size-profile.json:156–162`), but that does not replace field/depth/diagnostic bounds. |

The verifier's report line references describe the pre-edit audit; the superseding requirements now appear in its character-file-ceiling section. This addendum proposes mitigation for existing FINDING-002 and a compatibility policy; it does not add an unproven vulnerability or close any finding. Implementation remains deferred.
