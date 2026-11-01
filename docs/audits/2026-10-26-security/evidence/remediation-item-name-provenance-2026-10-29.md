# Controlled item-name provenance refresh — 2026-10-29

**Status: source/data preparation; FINDING-029 remains OPEN pending release acceptance.**
This completes the controlled-refresh source prerequisite left by A-API. It does not deploy
API or Discord, publish packages, activate production or complete the terminal font sprints.
Keep pending API **0.21.1** and Discord **5.9.7**; no additional bump is needed.

## Inputs, replay and current provenance

Resolve datamining master and Teamcraft staging once each, then acquire only immutable raw
files. The [normalized receipt](item-name-provenance-2026-10-29.json) records source URLs,
commits, raw-byte sizes/hashes, output hashes, font identities and local proof hashes.

| Source | Commit | Inputs |
|---|---|---|
| xivapi/ffxiv-datamining | `44948e4cda5846eab0baa9872122a888fcc4f1b1` | English and Japanese Item CSVs |
| ffxiv-teamcraft/ffxiv-teamcraft | `c022ca5385ae41ec0d747599ef16ce74e4fbfdcf` | Korean and Chinese item-name JSONs |

The four raw inputs total **44,866,835 bytes**. Acquisition is public, read-only, bounded to
30 seconds and 64 MiB per file, with redirects refused. An initial sandbox DNS failure is
preserved separately; the public-only normal-host retry succeeds. No local datamining clone,
credentials, upstream executable code or font downloads are used.

Copy the byte-identical existing builder and cleaner into an isolated file-layout mirror.
Replay all six requests from the verified cache through a preload that rejects any other
network or subprocess access. The unmodified builder succeeds for ko, zh and ja; only the
verified Korean output and metadata need promotion. Chinese/Japanese outputs already match
byte-for-byte. Builder SHA256 remains
`3d90e904e9451bae74fa3c5e573fa5440e8e1fc7b7e31c147d4f8d136ad48b55`.

All five source records across the three per-language metadata entries match their exact
cached raw bytes and selected commits. Current counts/provenance live in those per-language
entries. The old shared `generated`, `equippable` and `sources.itemCsv` fields are deliberately
retained historical metadata under the builder's existing contract; they are not relabeled as
new provenance. Pins/checksums bind this refresh, not the honesty of upstream data or its past.

## Reviewed data and font effects

| Language | Before | Prepared | Changes |
|---|---:|---:|---|
| Korean | 28,986 | 29,051 | 65 additions, no removals; two direction marks stripped |
| Chinese | 28,992 | 28,992 | Byte-identical |
| Japanese | 29,057 | 29,057 | Byte-identical; remains build-time font data |

A separate comparator verifies every added Korean ID has nonzero English `EquipSlotCategory`
and its name exactly matches independently cleaned pinned Teamcraft text. Independent verifier
recomputation of all three tables from the four raw inputs also matches every output. Existing
name changes are exclusively U+200F removal from IDs **1200** and **1238**. Missing-name counts
are Korean seven, Chinese 66 and Japanese one; existing fallback behavior is unchanged.

There are **zero added codepoints** and no missing candidate glyphs across the ten actual
bundled font faces. Every Japanese CJK codepoint remains in the JP subset. All ten font hashes
are unchanged. No subset expansion or regeneration is needed for these tables; later rendered
text/major adoption still requires the separately scheduled terminal font passes.

The actual existing item-name gate initially fails **one of six** assertions solely because
the U+200F exception is stale. Remove that precise exception and retain the stale-entry/glyph
assertions. Actual item-name, locale-coverage, static-face and regional render/load-order checks
then pass **71/71 tests across seven files**. Discord type-check/lint passes; existing warnings
remain, with no new errors or threshold changes.

## Legacy-input regression fixture and gates

The first API run passes **989/990** tests and exposes a fixture that requires U+200F to remain
inside the generated Korean table. Replace that data dependency with an explicit two-name
malformed module fixture. Keep runtime-cleaning assertions and add a post-lookup check that
the input table is unchanged. Bypassing the production cleaner makes the assertion fail;
exact production bytes are restored and the focused test passes. This does not remove the
legacy-input defense just because the current generated data is clean.

The complete API suite passes **990 tests /46 files**, with coverage **96.15% statements,
92.85% branches, 95.45% functions and 96.77% lines**. The scoped API/dependency gate passes
**32/32 tasks**; the final pass executes four API tasks and reuses 28 successful dependency
tasks. Discord dependency/type/lint verification passes **10/10 tasks**.

The initial sandbox core test fails on Windows temporary-path rename/symlink permission,
before the relevant security assertion can run. A narrow unchanged-test normal-host rerun
passes **15/15**, followed by the scoped gate above. Both failed permission attempts remain
recorded. No source assertion, timeout, coverage requirement, exclusion or font gate is weakened.

The actual production configurations pass local dry runs with isolated fake-credential profiles:
API **5,248.88 KiB upload /717.86 KiB gzip**, Discord **8,651.40 KiB /2,739.42 KiB gzip**. Both
exit before upload; Discord remains below the 3,072 KiB gzip limit. Independent source/data/font
verification accepts the prepared scope. Final combined-stack verification and secret scans
remain separate handoff checks. Production deployment/activation and upstream package
availability remain held release gates; preparation does not change finding counts or claim
live acceptance.

## Combined release-stack handoff

Integrate OAuth [PR #364](https://github.com/FlashGalatine/xivdyetools/pull/364) at
`8554872195c96601e8d30c4b0420aad0417cef36` with the controlled refresh. The merge is clean;
pending API 0.21.1, Discord 5.9.7 and OAuth 3.2.0 remain intact. OAuth's corrected head passes
all four CI checks, including Chromium; its original fake-clock failure remains documented.

The combined serialized build/type-check/lint/test graph passes **62/62 tasks**, **zero cached**,
with **17,873 tests /612 files /17 test workspaces**. The shared-cache attempt does not reuse
entries across these worktrees, so this is a fresh execution. Root self-tests pass **220/220**;
script types, reachability (**648 production /651 test files**), **34** version claims,
**1,144** relative links across **266** living documents and **seven** Workers Logs pins pass.
No assertion, timeout, budget or threshold changes follow the successful combined run.

Final filename-aware staged/outgoing-history secret scans gate the feature push. The private
support packet and XIVAuth report stay outside Git. Both release drafts remain source
preparation: no main merge, publication, remote migration, live deployment, new hosted request
or production activation is performed.
