# Sprint A-DISCORD preparation — 2026-10-27

**State:** prepared in draft [PR #345](https://github.com/FlashGalatine/xivdyetools/pull/345);
source CI and automatic Discord beta pass. Production release and cutover remain separate.
Base: `0a7ef240`
(A-MODERATION, draft #344). Production merge, package publication, manual deployment and
webhook cutover are separate actions. The private XIVAuth report is excluded.

## Scope and contracts

| Finding | Prepared behavior |
|---|---|
| FINDING-024; BUG-009 / BUG-010 | One signed acting-user batch lookup for 1–50 favorite IDs; exact approved/missing partition, saved order and KV preservation, distinct service failures, complete escaped lines plus notices within 4096 UTF-16 units, checked delivery and one short fallback |
| BUG-011 | Every Glamour edit result checked; failed card delivery remains unserved, even if one short fallback arrives; prior failure classification preserved |
| DEAD-014 | Original capped attachment bytes only; redundant decoded text and adapter pass-through removed; parser compatibility API retained |
| HC-002 | Official localized clan/race search, autocomplete and validation; canonical saved values preserved; clan preference remains dormant |
| I18N-001 | All twelve Swatch order/slot and preset-sort choices localized; canonical values, emoji and intentional English exceptions preserved |
| FINDING-001 companion | New preview-image outcomes omit moderator username and ID fallback; API/database actor attribution retained; historical messages unchanged |
| FINDING-022; FINDING-027 bot half | All six bot policies disclose public character-card clan/gender/allowlisted producer labels and restrict snapshot wording to edits of published approved presets; web snapshot half remains A-WEB |
| FINDING-040 | Per-user button tier before analytics and dispatch, using existing native binding; missing-user denial and existing backend failure reporting retained |
| FINDING-039 | Private named notification provider and default-false binding-only cutover gate; separate presets configuration companion and verified cutover required before closure |
| FINDING-030 companion | Beta comments/runbook forbid production bot API/signing secrets; describe signed favorite lookup limitations and credential-boundary risk accurately |

The batch endpoint has no per-ID failure array. Transport/query failure fails the whole batch;
malformed, duplicate, unexpected, overlapping or incomplete classifications also fail. Missing
includes nonpublic presets and never deletes a saved favorite. One lookup replaces 1/10/50
individual requests with 1/1/1: **0/9/49 fewer request round trips**, with no reduced-row-read claim.

The audit overstated the public getter exports: race/clan getters existed internally but were
absent from bot-logic's barrel. The additive exports and six-language message companion fold into
the still-unpublished **4.12.0 MINOR** (public registry reported 4.11.0 during preparation).
Discord prepares **5.9.7 PATCH**. No dependency or lockfile change is needed.

**Production publication gate:** ordinary merges do not enforce publication before deployment.
The publish workflow is manual; affected consumer workflows deploy main pushes and bundle
workspace source. A separately authorized release must either verify that the reviewed provider
ref is eligible for Actions publication, publish/verify its complete package artifacts first,
then merge consumers; or establish a verified hold on all affected automatic consumer deploys
before merging, publish/verify from the reviewed source, and only then release/deploy that source.
Verify actual environment/ref eligibility rather than assuming it. Do not publish an earlier
incomplete 4.12.0 snapshot and reuse that version; reassess the version if it becomes published.
No workflow hold, publication or deployment is selected here.

## Notification boundary and release ordering

An intermediate shared public admission quota was rejected by ordinary and escalated security
review because unauthenticated traffic could suppress legitimate notifications. The final design
uses Cloudflare's private named entrypoint with the existing Fetch request protocol, retaining
bearer authentication, production configuration validation and actual-byte body limits.

`PRESET_WEBHOOK_BINDING_ONLY` remains **false in both configurations**. A separate presets
companion selects `PresetNotifications` on both existing `DISCORD_WORKER` bindings, preserving
their existing production service target. No producer request, bearer, payload or retry contract
changes are required. The independent deploy workflows require separate PR/release boundaries:

1. Satisfy earlier OAuth/migration/disclosure prerequisites and deploy the capped presets batch
   provider. Publish core/SVG prerequisites and bot-logic including this sprint's source.
2. Deploy the Discord provider with `PRESET_WEBHOOK_BINDING_ONLY=false` (public compatibility
   enabled); verify default and named delivery.
3. Deploy the separate presets binding companion and verify real submission/edit/preview delivery.
4. Inventory any external/manual callers before separately authorizing binding-only activation.
   Verify public rejection and private delivery independently; only then close FINDING-039.

Keep the named export while consumers use it. Before rolling a consumer back to the old default
binding, restore and verify public compatibility. Never roll the provider back to a version
without the named export first. Dead-letter records preserve visibility; they are not automatic
redelivery. Existing 429 responses are terminal at the producer, while 503 receives short retries.

Beta keeps production API/signing secrets absent. Its signed favorites success path is proved
locally with fake bindings. Existing automatic beta workflows may verify deployment and command
registration; they do not establish production acceptance or authorize activation.

## Verification record

Baseline: dependency build **8/8**, Discord **73 files / 1,712 tests**, bot i18n **113 tests**.
Genuine pre-fix assertion failures reproduced the behavioral findings. Focused restored results:
favorites **157**, localization/chara/preview **165**. The initial integrated app passed **1,790**
tests before the independently required private-boundary correction; that is an intermediate
receipt, not final-source acceptance.

All five favorites mutants and all five localization/chara/preview mutants were individually
type checked, killed by targeted assertions, and restored exactly. Four guard mutants initially
passed the same proof; webhook-specific intermediate mutants are superseded by the boundary fix.
Infrastructure-only pnpm store and Vitest SSR errors were not counted as RED or mutation kills.

All six bot locales revise `previewImage.approvedFooter`, `previewImage.rejectedFooter` and
`preset.favorite.allRemoved`, and add `preset.favorite.unavailableSummary`, `.truncated` and
`.lookupFailed`. Independent meaning review passes all 36 values and five translated policies.
Mechanical policy parity passes. The policies' update dates already agree on 2026-10-27.

Both canonical font scripts were rerun after strings were final. Discord JP cmap changes
1097→1096 (+1/-2), SC 2412→2414 (+3/-1); KR is unchanged. All OG cmaps and non-head tables are
unchanged, so timestamp-only regenerated outputs were restored. Bot-logic configured coverage:
**909 tests**, **99.58/96.56/100/99.76** (statements/branches/functions/lines). Discord font gates
**35/35** and OG font gate **10/10** pass.

Final-source local gates:

| Gate | Result |
|---|---|
| Whole-graph build/type/lint | **45/45 tasks**; 43 cached |
| Whole-graph tests | **25/25 tasks**; 24 cached; **17,340 tests / 602 files / 17 workspaces** |
| Discord configured coverage | **1,821 tests / 75 files**; **93.62/85.98/94.20/94.41** |
| Bot-logic configured coverage | **909 tests / 26 files**; **99.58/96.71/100/99.76** |
| Dead-code reachability | **642 production / 639 test files**; no new fake usage or public tags |
| Script tests/types | **167/167**; type check passes |
| Versions / links / logging | **34 claims**; **1,063 links / 259 docs**; worker logging pins pass |
| Discord integration / policy parity | **28/28**; **0 policy problem groups** |
| Redacted staged secret scan | **0 leaks**, Gitleaks 8.30.1 with 100% redaction |

One newly added synthetic signing-key fixture triggered the detector. Replacing it with an
explicit equal-length repeat expression required no scanner exemption; the unchanged baseline
helper and all assertions remain. Its **75 tests**, TypeScript and lint pass, followed by the
fresh final whole-graph receipt above. No runtime source changed after independent review.
The two Workerd fixture paths/default handlers and runtime builtin are narrowly declared in
Knip; shipped export checking remains enabled. The full stacked source-history scan passes with
100% redaction; actual remote receipts are recorded below.

The corrected boundary now passes independent ordinary/scoped and final escalated source
review, with no remaining source findings. **260 focused tests**, including **7 actual Workerd
tests**, pass. Five boundary and two current button mutants each type check, fail their targeted
assertions and restore exact source hashes. Together with favorites and localization, that is
**17 independently checked final-source mutants**; the separate config companion adds one valid
configuration mutant. Workerd proves transport/authentication/routing; its successful preview
fixture has no moderation channel, so it does not prove real Discord posting.

The actual production-config dry run passes at **8649.86 KiB raw / 2739.15 KiB gzip**. The
unchanged bundle gate reports **2739.2/3072 KiB**, leaving **332.8 KiB**. Fake profile/credentials,
disabled dotenv/telemetry and local bundling isolate these checks; nothing is deployed.

## Published source receipts

Source `9e6ae7cd4f65c1aa3c67e1280e20ad486c403059` is published in draft #345, stacked on #344.
[CI run 40623733378](https://github.com/FlashGalatine/xivdyetools/actions/runs/40623733378)
passes all four jobs, including **167 Playwright tests**, lint/types/tests/build, production
security audit and Gitleaks. [Automatic Discord beta 40623672320](https://github.com/FlashGalatine/xivdyetools/actions/runs/40623672320)
deploys successfully and registers **18 commands**. No web beta was selected.

The configuration companion is draft [PR #346](https://github.com/FlashGalatine/xivdyetools/pull/346).
Its source `ae26ddc3` integrates this provider, preserves both app versions, and passes
[CI 40624786941](https://github.com/FlashGalatine/xivdyetools/actions/runs/40624786941), including
**167 Playwright tests**; its [automatic Discord beta](https://github.com/FlashGalatine/xivdyetools/actions/runs/40624743878)
also registers **18 commands**. These beta runs verify deployment/registration, not the separately
required production notification acceptance. This receipt-only update changes evidence/plan;
runtime source and disabled activation flags are unchanged.
