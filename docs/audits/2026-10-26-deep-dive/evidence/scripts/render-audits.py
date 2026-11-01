"""Render the coordinator-reviewed catalog; run from the repository root."""
from pathlib import Path
from collections import Counter
import json

BASE = Path('docs/audits')
DEEP = BASE / '2026-10-26-deep-dive'
I18N = BASE / '2026-10-26-i18n'
SHA = '6da3ff5b047188e6f8c08be2ea47f99f02e7a8d1'

def read(folder):
    return json.loads((folder / 'evidence/final-catalog.json').read_text(encoding='utf8'))['findings']

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + '\n', encoding='utf8')

def clean(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')

def findings(folder, rows):
    for r in rows:
        if folder == DEEP:
            label = 'Impact' if r['kind'] == 'OPT' else 'Severity'
            header = f"**{label}:** {r['severity']} · **Type:** {r['type']} · **Deploy unit:** {r['unit']} · **Covered by test?:** No regression assertion; see evidence."
            if r['kind'] == 'OPT':
                header = f"**Impact:** LOW · **Category:** I/O · **Deploy unit:** {r['unit']} · **Expected gain:** up to 49 fewer service calls per 50-item list · **Benchmark:** count binding calls and row queries for 1/10/50 favorites."
        else:
            header = f"**Tier:** {r['tier']} · **Locale(s):** {', '.join(r['locales'])} · **Deploy unit:** {r['unit']} · **Generated?:** No"
        loc = '\n'.join(f'- `{x}`' for x in r['locations'][:3])
        extra = f"\n- {r['qualification']}" if r.get('qualification') else ''
        supersedes = f"\n- Supersedes {r['supersedes']}." if r.get('supersedes') else ''
        text = f"""# {r['id']}: {r['title']}
{header}

## Location
{loc}

## Evidence
- {r['evidence']}
- Reproduce: {r['repro']}
- Test gap: {r['test_gap']} See [review and verification evidence](../evidence/).
{extra}{supersedes}
## Fix
- {r['fix']}

## Status
OPEN — audit only; no implementation change.
"""
        assert len(text.splitlines()) <= 25, r['id']
        write(folder / 'findings' / (r['id'] + '.md'), text)

def status(rows):
    return '\n'.join(['| ID | Status | Commit |', '|---|---|---|'] + [f"| [{r['id']}](findings/{r['id']}.md) | OPEN | — |" for r in rows])

def readme(folder, rows, report):
    topic = 'Deep-dive' if folder == DEEP else 'i18n'
    grade = 'severity' if folder == DEEP else 'tier'
    counts = ', '.join(f'{v} {k}' for k, v in sorted(Counter(r[grade] for r in rows).items()))
    leading = sorted(rows, key=lambda r: {'CRITICAL':0,'HIGH':1,'MEDIUM':2,'LOW':3}.get(r[grade], 0)) if folder == DEEP else rows
    top = '\n'.join(f"{i}. **[{r['id']}](findings/{r['id']}.md) ({r[grade]})** — {r['unit']}: {r['title']}." for i, r in enumerate(leading[:6], 1))
    plan = 'REMEDIATION_PLAN.md' if folder == I18N else '../2026-10-26-i18n/REMEDIATION_PLAN.md'
    write(folder / 'README.md', f"""# {topic} audit — 2026-10-26

This audit appends to [PR #333](https://github.com/FlashGalatine/xivdyetools/pull/333) and [PR #334](https://github.com/FlashGalatine/xivdyetools/pull/334): **{len(rows)} findings ({counts}), all OPEN**. No source files were modified by the audit. The [merged remediation plan]({plan}) reconciles both preceding catalogs and both new catalogs; no remediation sprint has started.

**Scope:** all 17 workspace units; six locales for i18n. **Branch:** `codex/deep-i18n-audits-20261026` at `{SHA}`. PR #334 contains #333; both prior PRs are documentation-only and share main's runtime tree at `13c386e5`. Date follows the maintainer's local 2026-10-26 session; some evidence timestamps are UTC 2026-10-27.

**Method:** tracked-source inventories, runtime/declaration reads across packages/apps, targeted tests and caller traces, gates and independent Sol/xhigh verification. Some comments, static markup and style literals were elided as recorded in the read ledgers; no visual CSS audit is claimed. Generated data received structural checks; translations received changed-value and targeted semantic review, not a new native-speaker certification of all unchanged prose. See each report's scope and limitations.

| File | Purpose |
|---|---|
| [{report}]({report}) | Verified catalog, controls, rejections and status |
| [findings/](findings/) | One evidence-backed OPEN finding per file |
| [evidence/](evidence/) | Read ledgers, reviewer returns, verification, command logs and reusable scripts |
| [Merged remediation plan]({plan}) | One assignment per finding, retained KEEP register, release dependencies |

## Top items

{top}
""")

def deep_report(rows):
    coverage = json.loads((DEEP / 'evidence/coverage-baseline.json').read_text())
    cov = '\n'.join(f"| {u} | {v['statements']['pct']} | {v['branches']['pct']} | {v['functions']['pct']} | {v['lines']['pct']} |" for u, v in coverage.items())
    bugs = '\n'.join(f"| [{r['id']}](findings/{r['id']}.md) | {clean(r['title'])} | {r['severity']} | {r['type']} | {r['unit']} | No regression assertion |" for r in rows if r['kind'] == 'BUG')
    opts = '\n'.join(f"| [{r['id']}](findings/{r['id']}.md) | {clean(r['title'])} | LOW | I/O | {r['unit']} |" for r in rows if r['kind'] == 'OPT')
    counts = ', '.join(f'{n} {k}' for k,n in sorted(Counter(r['severity'] for r in rows).items()))
    write(DEEP / 'DEEP_DIVE_REPORT.md', f"""# Deep-dive analysis — whole monorepo (2026-10-26)

- **Branch/commit:** `codex/deep-i18n-audits-20261026` / `{SHA}`; continuation of PRs #333/#334.
- **Scope:** eight packages, nine apps, root quality scripts; **650 code files / 169,904 original lines**, with no missing runtime-file reads in [source-coverage.json](evidence/source-coverage.json). Runtime/declaration review sometimes elided comments, static markup and style literals; original line counts are inventory sizes, not a claim to have reviewed every CSS literal. Generated tables were inspected structurally; test files were read around suspected gaps, not all in full.
- **Method:** source/caller/test tracing, independent verifier review, full unit gates, fresh coverage and a deferred-import reproduction. [Baseline details](evidence/verification-baseline.md) distinguish retries, cache reuse and limitations.
- **Totals:** {len(rows)} findings ({counts}); {sum(r['kind']=='BUG' for r in rows)} bugs and {sum(r['kind']=='OPT' for r in rows)} optimization. No HIGH/CRITICAL; no separate structural-refactor finding justified. **Sprint 0 emergency:** none.
- **Status basis:** 0 fixed during analysis; every new finding OPEN. One previously OPEN optimization is carried forward with a qualified supersession; overlap with the security fan-out finding is one implementation task in the merged plan.

## Catalog — bugs

| ID | Title | Sev | Type | Deploy unit | Tested? |
|---|---|---|---|---|---|
{bugs}

## Catalog — refactors

No standalone refactor is proposed merely because a file is large. Small extractions that prevent a confirmed bug ride with that bug; #334 already owns the migration cleanup.

## Catalog — optimizations

| ID | Title | Impact | Category | Deploy unit |
|---|---|---|---|---|
{opts}

## Gates and coverage

The baseline passed **62/62 tasks** (26 cached), **16,193 tests** across 17 units. Fresh coverage subsequently passed each of the 17 configured unit gates. Initial collection errors and successful narrow/full-unit retries are retained, rather than rewritten as a single successful run. Web `build:check` passed at **98.9%** of the one-locale payload budget. No production request or browser E2E suite was run.

| Unit | Statements % | Branches % | Functions % | Lines % |
|---|---|---|---|---|
{cov}

These percentages apply to each configured coverage include/exclude set. They do not establish correctness of the unasserted scenarios in the catalog. The stale export-sheet test passes by asserting the defect; it is not a remediation test passing on a fix.

## Positive controls

- Character-file byte limits, parse generations, worker protocol guards and teardown protect the normal import path; the identified export-sheet race is a distinct late import callback.
- Core normalizes library gender values before GPOSERS omission rules; off-grid match gating and valid color parity remain covered.
- Preset moderation binds status/revision and preview decisions to the exact image key; author upload replacement has a separate concurrency gap.
- OAuth binds PKCE to signed provider state; retention jobs propagate failures through `waitUntil`.
- Image decoding checks dimensions and frees separate Photon allocations; prior 16-bit memory accounting remains security-owned.
- API chara work is bounded/coalesced and registered to the owning request; fully cached responses intentionally permit null version.
- The published API/KEEP boundaries in #334 remain intact. A symbol being test-only in this repository does not authorize a breaking removal.
- Existing i18n, policy, dead-code and bundle gates remain meaningful controls; none was relaxed to make the audit pass.

## Rejected suspicions and limits

- Feminine/Female robe mismatch: facade normalization makes the rule reachable with the expected value.
- Null API version on a full cache hit: explicit contract; the client currently requests unversioned icons.
- Duplicate stored categories do not multiply SQL category counts; that finding is limited to the effective category invariant and display.
- Failed favorite lookups do not delete KV favorites; the defect is an incorrect response and omitted results.
- Dormant Stoat reaction context eviction and internal-only image input probes were not refilled as new user-facing bugs.
- Large files, bounded loops over 125 dyes, deliberate cache TTLs, published exports and accepted deprecations are not standalone performance/dead-code findings.
- Huge glamour-note overflow requires abnormal upstream or injected names; normal content was not demonstrated to exceed the budget.
- Reviewer ledgers and verification returns preserve additional rejected leads and exact test gaps. Static race schedules are distinguished from the executed UI reproduction; no live D1/R2 race or production Discord delivery fault was induced.

## Recommendations

- Add regression assertions at the rendered payload/state boundary for every confirmed bug.
- Compare effective state after partial edits; use conditional database writes and explicit cleanup for concurrent object replacements.
- Treat failed delivery and failed lookups as distinct outcomes rather than success or permanent removal.
- Centralize metric formatting on the selected metric's identity and precision.
- Refresh asynchronous caches and views with generation/identity guards across reset, locale changes and mutation completion.
- Measure favorite service-call counts before/after the shared security/optimization task; preserve order and partial-failure semantics.

## Remediation status

{status(rows)}

## Next steps

Use the [merged remediation plan](../2026-10-26-i18n/REMEDIATION_PLAN.md). It supersedes scheduling in the preceding security/dead-code plans while keeping those snapshots unchanged. The maintainer's review-first decision remains in force; this audit makes no source, publish, deployment or policy change.
""")

def i18n_report(rows):
    fonts=json.loads((I18N/'evidence/font-status.json').read_text())['fonts']
    fontrows='\n'.join(f"| {r['unit']} / {r['font']} | {r['needed']} | {r['covered']} | {len(r['missing'])} | {r['stale']} | {r['bytes']:,} |" for r in fonts)
    catalog='\n'.join(f"| [{r['id']}](findings/{r['id']}.md) | {clean(r['title'])} | {r['tier']} | {', '.join(r['locales'])} | {r['unit']} | No |" for r in rows)
    counts=', '.join(f'{n} {k}' for k,n in sorted(Counter(r['tier'] for r in rows).items()))
    write(I18N/'I18N_AUDIT_2026-10-26.md', f"""# i18n audit — whole monorepo (2026-10-26)

- **Branch/commit:** `codex/deep-i18n-audits-20261026` / `{SHA}`; continuation of PRs #333/#334.
- **Scope:** en/ja/de/fr/ko/zh across web, bot-logic, generated core locales, command metadata, OG copy, SVG/font stacks, plus policy parity and preceding policy findings.
- **Method:** existing gates first; structural diffs and codepoint inventories; changed-value/terminology/runtime review; initialized command-payload probe; actual generated-card regional-font probe repeated independently by the verifier.
- **Totals:** {len(rows)} findings ({counts}); no P0, duplicates, missing locale keys, placeholder mismatches or missing drawable glyphs. **Sprint 0:** none. **Status basis:** all OPEN, no translations or fonts changed.

## Locale structure and gates

| Set | Keys per locale | ja/de/fr/ko/zh coverage | Dupes | Gate result |
|---|---|---|---|---|
| web JSON | 1,197 | 100% each | 0 | validate/unused/parity/reverse/locale-switch pass |
| bot-logic JSON | 724 | 100% each | 0 | structure/reverse/plural gates pass |
| generated core JSON | 238 | 100% each | 0 | build-locales/band vocabulary/search parity pass |
| OG authored tables | typed six-locale tables | all six branches reviewed | not JSON | string/role/deck-fit/data gates pass |
| policies | 24 files | four English documents + five locale siblings each | n/a | policy parity pass; semantic overlaps remain in #333 |

Targeted tests: web 78, bot-logic 105, core 48, OG 206, Discord 76, all passing. Web ESLint returned no i18n-rule error. [Gate commands and exits](evidence/gate-summary.json) include the corrected spelling-run path: its one candidate is the protected official **Grey** term, rejected. Structural equality is not proof of semantic quality; the findings below survive these gates.

## Catalog

| ID | Title | Tier | Locale(s) | Deploy unit | Generated? |
|---|---|---|---|---|---|
{catalog}

## Font status

| Font | Needed | Covered | Missing | Stale | Bytes |
|---|---|---|---|---|---|
{fontrows}

Counts compare each subset's required regional script against actual core/bot/OG tables and the Discord item-name data. See [font-status.json](evidence/font-status.json) and the saved input/codepoint scripts. The whole-stack scan finds one raw non-rendering control, U+200F in Korean item-name data; it is not a drawable glyph or tofu defect. Existing font gates cover the emitted code labels. The Discord SC subset exceeds the generic 500 KiB heuristic because it carries 1,985 required codepoints and zero surplus in the compared set; no speculative bloat finding is filed. No fonts were regenerated.

Regional glyph selection is separate from coverage: the current Chinese OG render uses Japanese forms for shared glyphs. The independent probe reproduced the current-order and SC-first full-card hashes exactly; this is FONT-001, not a missing-codepoint claim.

## Positive controls

- All 18 JSON files have matching keys/placeholders; generated core data remains generator-owned.
- New character issue/status keys retain safe unknown fallbacks, activation uncertainty and skip semantics across locales.
- Character counts use `Intl.PluralRules` and clauses use `Intl.ListFormat`; prior French zero and card clan-localization fixes remain present.
- Browser CJK stacks and Discord font ordering already select regional faces appropriately.
- Method tags, language endonyms, canonical option values and GPOSERS output have deliberate English/identifier exceptions.
- Policies are present in all six languages with parity gates; existing security-owned meaning/copy discrepancies are carried into the merged plan, not duplicated here.

## Rejected suspicions and limits

- **Grey/Glamour** are protected game terms, not American-English violations.
- Admin stats, log text, raw API errors, user names/content, release-note bodies, algorithm tags and the parked English-only Stoat surface are not newly broken localized UI.
- German `Sie wird` refers to the submitted Vorlage; it is not an accidental formal-address switch.
- Unpinned German/French clan terminology remains deferred; no guessed client term or new translation was introduced.
- Security-owned saved-palette terminology, other-people promise and German upload assurance stay in that catalog.
- All locale JSONs were loaded and changed values compared with the preceding audit baseline. This is not native-speaker certification of every unchanged sentence, nor a repeated full legal review of all policy translations.
- No live Discord picker or browser fault injection was performed. Command registration was inspected as a local payload; the OG probe used real generator/font bytes and reproduced renderer options locally.
- Font timestamps and aggregate size are leads, not correctness evidence; cmap/content checks and real regional render comparisons settle the verdict.

## Recommendations

- Gate all plain-language slash-choice families, while retaining documented identifier exceptions.
- Keep fatal-screen copy dependency-free but cover every displayed sentence in all six locales.
- Add a focused pinned-term check for Korean Hue uses and remove brittle product counts from descriptive copy where possible.
- Thread locale through OG rendering and assert regional-face selection with real font bytes.
- Recompute required codepoints after final locale edits; fonts are the terminal verification/release work in the merged plan.

## Remediation status

{status(rows)}

## Next steps

The [merged remediation plan](REMEDIATION_PLAN.md) combines the two new catalogs with #333/#334, preserving 23 KEEP entries and accepted decisions. No remediation, source translation, font regeneration, publish or deploy has begun.
""")

if __name__ == '__main__':
    deep, i18n = read(DEEP), read(I18N)
    findings(DEEP,deep); findings(I18N,i18n)
    deep_report(deep); i18n_report(i18n)
    readme(DEEP,deep,'DEEP_DIVE_REPORT.md')
    readme(I18N,i18n,'I18N_AUDIT_2026-10-26.md')
