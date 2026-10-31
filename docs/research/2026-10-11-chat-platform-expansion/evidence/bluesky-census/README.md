# Bluesky FFXIV census — aggregate historical results

**Status:** Measurements captured 2026-10-11 to 2026-10-13; publication minimized
2026-10-29. Primary-source verification and the final recommendation remain
in progress in [the research README](../../README.md).

## Redaction

The 2026-10-16 replacement publication used labels for individuals. Those labels
still joined exact profile statistics, cross-platform pairs, activity histories
and content judgments. On 2026-10-29 those rows and their distinctive narrative
were removed entirely, along with feed/pack creator rows, ranked lists and the
two personal hand-count files. This privacy correction is an explicit exception
to the research folder's usual frozen-body convention.

The retained JSON contains cohort and whole-query aggregates only: no account
or creator records, linked labels, raw text, profiles or individual activity
months. Run windows describe collections. Official and organization references
elsewhere in the reports remain permitted.

Editing this tree does not purge earlier Git commits, PR revisions or caches.
GitHub Support's removal of the original PR is separate from handling earlier
revisions of this replacement PR. No removed material was recovered for this
work, and these files contain no private label map.

## Retained files

| File suffix | Aggregate evidence retained |
|---|---|
| `profiles.json` | Collection timestamp and 9-profile cohort size |
| `tags-7d.json` | Per-day counts for the 10 fixed hashtags |
| `tags-7d-union.json` | Distinct-post union, hashtag counts and declared-language totals |
| `actors.json` | Search counts and three broad follower bands |
| `starterpacks.json` | 109 packs, member/join totals and query counters |
| `feeds.json` | 748 relevant feeds, combined likes and query counters |
| `focus.json` | 10-account cohort size and sampling limit |
| `focus-top50.json` | 50-account cohort size and sampling limit |
| `focus-top50-verdicts.json` | The 50-account cohort's four grade totals |
| `x-followers.json` | 10-account comparison cohort size, without pairs or metrics |
| `stream-{na,eu,jp}[-replay].json` | Window counts, rates, fixed-term and declared-language totals |
| `stream-{na,eu,jp}.log` | Historical aggregate progress checkpoints |

There are 16 JSON captures and three logs. Original capture timestamps and
filenames identify runs. Removed individual comparisons and qualitative claims
cannot be recomputed from this publication.

## Aggregate results

**Hashtags, 2026-10-04 to 2026-10-10 UTC.** 7,062 distinct posts used at least one
of the 10 tracked tags, about 1,009 per day. Per-tag totals sum to 9,925 because
tags overlap; 4,916 posts carry only one tracked tag. The first declared language
is English for 59.4%, Japanese for 27.8%, and absent for 5.4%. Posts mentioning
the game without a tracked tag are excluded.

**Account search.** 42,691 accounts named an FFXIV term in their own profile
text. Broad follower bands are 34,525 below 100, 7,384 at 100–999, and 782 at
1,000 or more. These replace sparse upper bands and ranked records. Relevance is
a lower-bound heuristic, not evidence of focus.

**Packs and feeds.** The 109 packs contain 6,230 overlapping member slots, not
unique people. Joined counters total 19 all-time and zero in the preceding week;
their apparent meaning as pack-driven sign-ups is inferred from the client
label. The 748 relevant feed generators have 5,282 likes between them. No
individual pack or feed metrics are retained.

**Three sampled stream hours.** NA/EU figures below are replay counts after
deduplication; the JP live and replay agree.

| UTC window | All new posts | FFXIV matches | Share | English matches | Japanese matches |
|---|---:|---:|---:|---:|---:|
| 2026-10-12 03:54–04:54 | 134,992 | 121 | 0.090% | 78 | 35 |
| 2026-10-12 16:02–17:02 | 139,973 | 113 | 0.081% | 83 | 15 |
| 2026-10-13 11:00–12:00 | 141,196 | 64 | 0.045% | 30 | 24 |

These are three hours, not daily rates or evidence of comparative migration.
Text matching includes untagged posts and false positives. The original live
NA/EU captures include duplicates; their replays deduplicate by record. Search
captures deduplicate by URI. No new live measurement was performed here.

**Focus review.** Of 50 accounts reviewed, six were graded focused, four mostly,
ten partly and thirty not focused. Historical thresholds were 80%, 50% and 20%
of classifiable original posts. This selected cohort is not representative of
all 42,691 accounts. Classifications included manual reading and an image-heavy
case graded from captions without image inspection. Individual bases have been
removed: the tally does not support new per-account conclusions or a claim that
every grade was independently revalidated. Sensitive qualitative classifications
are not retained.

## Collectors after 2026-10-29

[The Bluesky collector](../scripts/bsky-ffxiv-census.mjs) and
[the X collector](../scripts/x-follower-counts.mjs) emit aggregate-only JSON.
Raw API records stay in memory for matching, deduplication and counting; there
is no raw-export option. Progress and failures use fixed messages and operational
counts, without upstream text or account identifiers.

Subject-derived metrics require five distinct contributors. Matching-post
subsets must meet that threshold independently. Profile audience results use
three broad bands; the whole table is suppressed if any occupied bin has fewer
than five subjects. No exact profile sums, comparison pairs, extrema, individual
grades or input-file provenance are exported.

Nonzero pooled feed/pack totals also require five distinct positive contributors.
Focus results require sufficient sampled, classifiable and matching subjects.
Zero-valued records cannot pad the cohort needed to publish a nonzero measure.

| Command | New result |
|---|---|
| `node bsky-ffxiv-census.mjs profiles` | Selected-profile cohort counts and eligible audience bands |
| `node bsky-ffxiv-census.mjs actors` | Relevant search counts and eligible audience bands |
| `node bsky-ffxiv-census.mjs starterpacks` | Eligible pooled member/join totals |
| `node bsky-ffxiv-census.mjs feeds` | Eligible pooled feed/like totals |
| `node bsky-ffxiv-census.mjs focus 200` | Eligible pooled focus counts |
| `node bsky-ffxiv-census.mjs tags 7` | Eligible pooled tag-window counts |
| `node bsky-ffxiv-census.mjs stream 60` | Eligible pooled stream counts; optional ISO start requests replay |
| `node x-follower-counts.mjs` | Selected-profile cohort counts and eligible audience bands |

`EXTRA_HANDLES` and `EXTRA_PAIRS` are collection inputs only. Keep their values
outside the repository and committed commands. File-input focus mode is removed.
The tags endpoint may require `BSKY_HANDLE` and `BSKY_APP_PASSWORD`; credentials
never belong in output or committed files.

Historical captures predate the new schema and contributor checks. Their
retained totals cannot prove those thresholds because contributor records were
already removed. They are observations, not examples of the new output schema.
New collectors intentionally omit term/language/day tables to keep exports
small and auditable.

Run `pnpm test:research-privacy` for synthetic CLI and publication-schema tests.
This command is included in `pnpm test:scripts` and its existing CI job.

## Limits and remaining research

- Search indexes omit hidden or unindexed results; relevance does not establish
  focus. The selected focus cohort does not generalize to smaller accounts.
- Followers measure accumulated audience. X post volume was never measured.
  Removed individual pairs and their median are no longer recommendation
  evidence. Do not reconstruct them from earlier revisions.
- Historical tag/language totals do not reveal contributor counts. New checks
  reduce sparse exports but do not establish anonymity against every external
  dataset or deliberate repeated-query comparison.
- Primary-source platform verification, further stream sampling and final
  synthesis remain separate research work. No new account review was performed.
