# A-BOT-LOGIC implementation evidence — 2026-10-27

Scope: the ten primary A-BOT-LOGIC findings in the merged remediation plan, plus
DEAD-023's compatible deprecation phase and I18N-001's prerequisite labels. Stack base:
A-SVG PR #339 at `8e0c406bf0702a759beb37ac6aea58fd580ee13d`. Prepare bot-logic 4.12.0,
Discord 5.9.4, moderation 1.8.3 and parked Stoat 0.3.4. Source preparation and automatic
beta acceptance are separate from npm publication and production acceptance.

## Baseline and boundaries

Fresh npm reads returned bot-logic 4.11.0, core 5.15.0 and SVG 4.4.0. The local stack
prepares core 5.16.0 and SVG 4.4.1. Publish and verify those packages in that order before
bot-logic 4.12.0. Workspace app workflows bundle local source independently of publication.
The bot-logic/dependents baseline gate passed 21/21 tasks; a fresh unit run passed 855
tests in 26 files with coverage S99.47%, B96.49%, F100%, L99.76%. Frozen installation
changed no lockfile. The TypeScript compiler API recorded 70 root and 14 i18n exports.

Matching eligibility continues to use `matchHex` alone; lip matching uses its live blend.
Imported nicknames and unknown input fields remain excluded from result/card/embed/log
canaries. The deprecated swatch projection retains its required property, legacy member
shape and both successful return paths. Its raw producer metadata is not hardened by a
deprecation tag: FINDING-043 remains deferred to the approved major removal, with the
existing cancellation gate for an external npm consumer.

## Sanitizer and glamour description group

FINDING-021 adds `<` escaping and removes U+061C, U+2066–U+2069 and U+E0000–U+E007F.
Stoat mirrors the invisible-character prepass before platform mention defusing, the shared
sanitizer and mass-mention handling. FINDING-014 routes untrusted glamour display values
through the shared bounded sanitizer. Raw values are still grouped before sanitizing, so
ring equality is preserved. BUG-004 bounds advisory names and the tail first, allocates a
nonnegative body budget and retains complete body lines or an ellipsis. The fixed manual
and share-link suffix survives long notes; the final description stays within 4,000 UTF-16
code units. Tests cover all six locale advisories and boundary lengths.

Initial RED and separate mutations detect angle-token escaping (5 failures), added invisible
controls (8), Stoat prepass ordering (7), the old glamour sanitizer (5), and the old aggregate
allocator while retaining the new per-value sanitizer (10). Intended source initially passed
888 bot-logic tests with enforced coverage and 20 Stoat tests. Both units' build/type-check/
lint passed; Stoat's 13 existing `any` warnings are in the unchanged Revolt mocks.

Independent review found one boundary defect: removing a trailing backslash unconditionally
could turn an even complete escape run into an odd run. The original implementer fixed the
cap to remove a backslash only for an odd trailing run. Three helper and four actual-command
cases cover ordinary item names and fixed/blocked/company acquisition notes. RED and mutation
each produced five failures; restored intended source passed all 151 covering tests plus
build/type-check. Independent scoped rereview approved specification and quality, with no
remaining blocker. A separate Astra/high security review also passed the final six files.
Final whole-graph verification below includes this correction.

## Harmony, swatch and packaging group

BUG-001 recomputes only the selected primary row's displayed distance using the requested
method and the same ideal target as its companions. Selection remains unchanged. For the
non-strict RGB triadic `#D69C6D` regression, selector deviations of 2.95 and 0.19 degrees
become OKLAB distances of approximately 0.1710894 and 0.3090490. Winning IDs and ideal
hexes are pinned; an independent sRGB/OKLab calculation checks the units.

BUG-002 merges eyes only if both eligible winning colors are present and equal. EXT-28's
shared index 42 retains separate `#87C0A3` and `#DCBA6C` rows, labeled L/R. Single-slot
`eyes` still prefers the left eligible eye, then the right, and returns five matches. Equal
eligible colors still merge even with different indices. DEAD-015 makes the slot-label map
exhaustive and removes its unreachable skin fallback. Core's index metadata is unchanged.

DEAD-016 removes only internal helper exports. DEAD-022 removes legacy parser/resolver test
oracles and their unused mock wrapper. Literal raw/composite lip values include `#621C33` /
`#AE8F98` at alpha 0.60 and an independently calculated blue-lip blend `#9F8DF3`. Full-result,
generator, embed and log privacy canaries remain, as do required-field and legacy-member
compatibility tests for both success routes (DEAD-023 phase one). DEAD-005 updates the actual
facade refusal example and explains why generic error messages still cannot be logged.

DEAD-017 excludes source fixtures from build and coverage collection without reducing any
90% threshold. A clean baseline pack listed four compiled fixture paths. Removing the new
exclusion, cleaning and rebuilding restores those four paths and fails the absence assertion;
restoring and clean-building passes. The source fixtures remain available for tests.

New actual-command tests reproduced the harmony and eye defects before source changes.
Separate restored mutations fail for primary metric (1 test), right-eye suppression (2),
index-based labels (5), raw-lip selection (3), display-only eligibility fallback (5), and
inactive creator-color fallback (1). An exhaustive-map compile mutation fails for a missing
future slot while the old loose-map control passes. All mutations restore intended sources.
The full intended suite passes 901/901 tests in 26 files; enforced coverage is statements
99.58%, branches 96.71%, functions 100%, lines 99.76%. Build, type-check, eslint and knip pass.
Independent Sol/xhigh specification and quality review approves all eight files, with no
blocker. The compiler API check preserves all 70 root and 14 i18n names; root, i18n and
swatch declaration ASTs are unchanged apart from comments. Both exact deprecation tags are
emitted and `character` remains required.

## Preparatory localization

Exactly five metadata keys are prepared in all six bot locales. They are siblings of
`commands.<command>.options`, so regenerating option descriptions preserves them. They
contain no emoji; A-DISCORD retains the current emoji and canonical option values when it
adds explicit literal-key lookups. The seven existing `card.swatchSlotName.*` labels are
reused rather than duplicated. Command registration remains unchanged in this sprint.

| Locale | `swatch.choices.order.slots` | `swatch.choices.order.hardest` | `preset.choices.sort.popular` | `preset.choices.sort.recent` | `preset.choices.sort.name` |
|---|---|---|---|---|---|
| en | Slots — file order (default) | Hardest — worst match first | Most Popular | Most Recent | Alphabetical |
| ja | スロット — ファイル順（既定） | 難しい順 — 一致度の低い順 | 人気順 | 新着順 | アルファベット順 |
| de | Slots — Dateireihenfolge (Standard) | Schwierigste — schlechteste Übereinstimmung zuerst | Am beliebtesten | Neueste zuerst | Alphabetisch |
| fr | Emplacements — ordre du fichier (par défaut) | Plus difficiles — correspondance la moins bonne en premier | Les plus populaires | Les plus récents | Ordre alphabétique |
| ko | 슬롯 — 파일 순서(기본값) | 어려운 순 — 일치도가 낮은 순 | 인기순 | 최신순 | 가나다순 |
| zh | 部位——文件顺序（默认） | 最难匹配——匹配度最差的优先 | 最受欢迎 | 最新优先 | 按字母排序 |

Each key has the `commands.` prefix. These are ordinary UI labels, not newly translated
FFXIV game nouns; the existing glossary and neutral fragments preserve German `du` and
French `vous` register. No placeholders or locale-quality exceptions are added.

The accepted plan requires publishing these labels before their consumer. A bounded orphan
exception therefore names only these five exact keys, checks their existence in every locale
and becomes a failure once a natural literal consumer exists. A-DISCORD must remove the
exception when adding those lookups. The cost is five temporarily unused metadata labels;
a sixth orphan is not exempt. Both Discord glyph-source scanners exclude only command
`options` and `choices`, retaining command descriptions that cards can render.

The real orphan gate initially fails on exactly those five new keys. Intended source passes
113 i18n tests across five files, 88 Discord localization/font tests across six files, both
unit type checks, Python syntax and three Python doctest examples. Controls reject an
unrelated/sixth unused key, every stale literal/enumerated reference, blank exception reasons
and a missing locale key. Removing preparation treatment fails the real five-key gate;
removing `.choices` exclusion independently fails the TypeScript regression and Python
doctest. All three mutants restore exact source hashes, followed by green covering checks.
Independent Sol/xhigh specification/quality and Astra/high whole-branch source reviews pass.
The latter requested one documentation correction: Discord's CLAUDE now names both excluded
metadata subtrees and explicitly retains rendered command descriptions.

Both subset scripts regenerate successfully with Python 3.14.6/fontTools 4.61.1/Brotli
1.2.0, using verified cached full Noto Sans source faces (version 2.004). No source font is
downloaded or bundled. Every subset retains its exact byte size and cmap:

| Unit | JP cmap / bytes | KR cmap / bytes | SC cmap / bytes | Added / removed code points |
|---|---|---|---|---|
| Discord | 1,097 / 482,160 | 961 / 206,680 | 2,412 / 858,980 | 0 / 0 in every face |
| OpenGraph | 337 / 227,572 | 409 / 114,940 | 706 / 345,656 | 0 / 0 in every face |

All non-`head` font tables are byte-identical; the only changed `head` fields are `modified`
and `checkSumAdjustment`. The original tracked subset bytes are therefore retained and
SHA-verified. Regeneration introduces no glyph demand or OpenGraph source change.

## Final verification and review

All bounded implementation groups have passed independent review. The final packed
bot-logic 4.12.0 tarball has no fixture or test paths,
and rewrites workspace dependencies to core 5.16.0, SVG 4.4.1 and types 3.3.0. A local smoke
test executes the packed JS through the existing workspace `tsx` JSON loader with individual
absolute dependency junctions. Both swatch routes generate SVG/embed, retain the compatible
character result and exclude private nickname/unknown-field canaries. Actual harmony,
sanitizer, both entrypoints and all six locale JSON imports pass. This is a local packed-JS
check with workspace dependencies, not a clean registry installation or vanilla-Node claim.

All nine final gate commands exit 0:

- Whole graph: 62/62 tasks, 48 cached; 16,419 passing tests across 17 workspaces, including
  cached results. Fresh affected suites pass 909 bot-logic, 1,683
  Discord, 757 moderation and 216 Stoat tests. Package/app coverage thresholds remain enforced.
- Root script tests: 167/167. Script type-check, test-only reachability, version consistency,
  living-document links and worker-log checks pass.
- Discord production bundle: 2,735.5 / 3,072 KiB gzip (89.0%, 336.5 KiB remaining).
- Moderation production dry run: 239.11 KiB / 57.84 KiB gzip; confirms `--dry-run` exit.
  Parked Stoat's build passes in the graph.

The compiler API/declaration check passes again after the final graph build. Existing lint
warnings and Turbo's no-output warnings for moderation/Stoat test tasks do not fail the gate.
Final independent Astra/high review approves source/API/semver, font retention, pack and
all nine gate results for draft-PR preparation. Git secret scanning precedes the source
commit; remote beta/CI receipts will be recorded after the authorized feature push.

## Release and acceptance

Bot-logic paths trigger production Discord and moderation workflows. The feature-branch push
triggers the existing beta Discord workflow; this sprint does not claim a new web or OpenGraph
deployment. Discord 5.9.4 follows the separate SVG/Discord 5.9.3 release. Moderation 1.8.3
executes the shared sanitizer. Stoat 0.3.4 is prepared locally and remains parked.

No merge, npm publication or manual deployment is authorized. No source-prepared item is
counted as deployed FIXED. The audit remains 133 IDs: 7 fixed, 101 outstanding (including
one partial and one eligibility-blocked), 23 KEEP and 2 superseded; no rotation is required.
Private XIVAuth correspondence remains outside Git and is not part of this sprint.
