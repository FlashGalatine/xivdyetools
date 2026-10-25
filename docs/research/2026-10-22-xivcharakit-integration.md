# XIVCharaKit integration: compatibility register (Task 1)

**Question:** can XIV Dye Tools use `xivcharakit` as the `.chara` reader and appearance interpreter
without losing behavior it relies on, and where do the two deliberately differ?

**Status (2026-10-25):** pre-install work done. The comparison test is written and its host half
passes; its library half cannot run until the dependency installs, which `minimumReleaseAge: 1440`
allows from about 2026-10-26T11:32Z. Nothing below is classified as *verified* until that run. The
plan this register serves is
`docs/superpowers/plans/2026-10-22-xivdyetools-integration.md` in the XIVCharaKit repository.

## Baseline

| Item | Value |
| --- | --- |
| Target | `FlashGalatine/xivdyetools` `main` at `0cf9d00c` (unchanged since the plan was written) |
| Units | core 5.14.0, web-app 5.15.5, bot-logic 4.10.0, discord-worker 5.8.15, api-worker 0.20.1 |
| Tooling | pnpm 11.17.0, Node `>=22.13.0` (checked on 22.21.0) |
| Candidate | `xivcharakit@0.1.0-beta.4`, registry time 2026-10-25T11:31:59Z, expected integrity `sha512-fIW3xEd3fHaP+C6tKbwmBOHFHb59ymoUdW+FpEAvwbR1LcQy+ZMVi2mdhtmRxP/hOJYD9cpzuhiYmpLplRg0Mw==` |
| Install | pending: earliest 2026-10-26T11:32Z; no `minimumReleaseAge` exclusion and no `allowBuilds` entry |

Other work in the target that touches files this integration edits (rebase on whichever lands first):
Dependabot PR #323 (`pnpm-lock.yaml` only, open and clean), PR #324 `docs/xivapi-offloading-research`
(core `package.json`, `CHANGELOG.md`, `CLAUDE.md`, `lint`/`type-check` scripts), PR #325
`docs/xivapi-worker-improvements-plan` (`docs/versions.md`, the api-worker `/v1/chara/*` code), and the
local-only `review/prs-2026-10-20` preview branch (dependency bumps; not on the remote).

## Producer source refresh (2026-10-25)

Checked through the official GitHub release APIs and default-branch sources, against the pins in the
library's `fixtures/manifest.json`. This is **source review only**: no producer binary was run and no
new export was made.

| Producer | Latest stable | Newer prerelease | Default branch | Pinned files |
| --- | --- | --- | --- | --- |
| Anamnesis | v7.57.0.3 (2026-10-20), `3d63575` | none | `master` `3d63575`, 0 commits past the pin | all hash-identical |
| Ktisis | v0.4.1.2 (2026-09-16), `6f0fcf0` | v0.4.1.3-b (2026-10-25), tag commit `551bb23`, the already-reviewed source | `main` `4a83cadb`, 1 commit past `551bb23`, `repo.json` only | all hash-identical |
| Brio | v0.8.0.12 (2026-09-29), `b510c82` | none | `main` `771be60b`, 4 commits past `3f6f8e1`, `repo.json` only | all hash-identical |

Anamnesis' `CustomizeEditor.xaml.cs` (read but not pinned) and the AetherToolsWpf submodule pointer
(`8221958`) are unchanged. All 31 manifest-pinned files hash identically at current HEAD, so the lip
bit, face-paint mirror bit, extended eye offsets, `IsExtendedAppearanceValid` writing, `Glasses`
shape, enum names and vector format are unchanged by construction. The Ktisis prerelease artifact was
not inspected, only its tag commit.

## Decisions the plan left to the implementer

| Question | Decision | Evidence |
| --- | --- | --- |
| Does any supported producer write `Gender` "Male"/"Female"? | **No.** Treat the host's acceptance of them as legacy tolerance and the library's `unsupported` result as an intentional difference. | All three serializers use `JsonStringEnumConverter` and declare `Gender` as `Masculine`/`Feminine` (Anamnesis `ActorCustomizeMemory.cs:15-19`, Ktisis `CustomizeContainer.cs:63-66`, Brio `ActorEnums.cs:5-9`); 1,093 of 1,093 files in the local corpus store a `Masculine`/`Feminine` string. Cases IDN-xx pin both behaviors. |
| Keep `historicalEyeCorrection` at its default (true)? | PENDING the post-install corpus run (recommendation: keep the default). | Current Brio exports (v0.7.2 and later) store each eye's color under the other eye's name, so disabling the correction would regress them; the host already un-crosses an exact crossing. The library adds one-sided inference with an `EYE_PAIRING_INFERRED` warning. |
| `SwatchCharacter`: map the projection back or take a bot-logic semver decision? | Map the projection back to the existing `Omit<ResolvedCharaCharacter, 'nickname'>` shape in Task 6; no bot-logic semver decision. | `SwatchCharacter` is a public bot-logic export whose `slots` element type tests read; the library's slot `kind` adds `limbalOrTattoo`, which the mapping must fold to the old union. |
| Does `vite.config.ts` need `worker: { format: 'es' }`? | PENDING the Task 4 production build. | `CharacterColorService` dynamically imports `hair_colors.json`; Vite's default worker format is `iife`, which rejects code splitting. |

## How this register is built

The comparison test is `packages/core/src/services/chara/__tests__/chara-library-parity.test.ts`. It holds **261 cases**, each a minimal `.chara` document with a hand-written expectation for both pipelines (the legacy `parseCharaFile` + `resolveCharaColors`, and `readChara` → `inspectChara` → `resolveAppearance` with the library's bundled palette provider, a test-only import) and a classification:

- **preserved:** the new import must read the document the way the host does today;
- **intentional:** the two differ on purpose and the library side is the new behavior. A note starting `UNPLANNED:` marks a difference neither the plan table nor the plan text approves (below); `HOST QUIRK:` marks surprising current host behavior the plan does not describe;
- **blocks adoption if the library diverges:** a required contract (the Helion alias, the sixteen tribes, disabled controls staying inactive, image omission, valid gear surviving a bad neighbour).

Expected values are literals derived from the plan, the library's `api.md` / `compatibility.md` and the host source. The library half was **not run**: the dependency cannot install until the release-age window opens, and a snapshot of one implementation's output would prove nothing. Instead each section was written by one agent and then re-derived independently by a verifier that read the library source (never executed it), in two rounds; their disagreements are resolved in the case notes. The host half runs and passes (261 cases plus 2 case-table checks). **Expect some library-side expectations to fail on the first real run; each failure is either a wrong expectation (fix it, with a reason) or a real difference to classify.**

| Area | Cases | Preserved | Intentional | Blocks if diverged |
| --- | ---: | ---: | ---: | ---: |
| IDN | 43 | 22 | 21 | 13 |
| COL | 34 | 26 | 8 | 0 |
| GEA | 44 | 17 | 27 | 6 |
| ACT | 44 | 15 | 29 | 8 |
| EXT | 45 | 24 | 21 | 0 |
| ENV | 34 | 20 | 14 | 6 |
| FIX | 17 | 14 | 3 | 9 |
| **Total** | **261** | **138** | **123** | **42** |

Areas: IDN identity and aliases; COL palette indices; GEA gear, dyes and `Glasses`; ACT activation controls and the lip; EXT extended colors and eye pairing; ENV document admission; FIX the five real-shaped fixtures already in this repo.

### Plan rows and the cases that pin them

Grouped by each case's declared plan row (a keyword match, so the ids are indicative; the test file is authoritative).

| Plan row | Cases | Ids |
| --- | ---: | --- |
| Partial equipment-only document | 10 | IDN-29, IDN-30, GEA-32, ENV-04…ENV-06, ENV-08…ENV-11 |
| Unknown tribe/gender or malformed color | 57 | IDN-12, IDN-24…IDN-28, IDN-31, IDN-33…IDN-37, IDN-39…IDN-41, IDN-46, COL-15…COL-21, COL-23, COL-25, COL-28, COL-30…COL-34, GEA-09, GEA-25, GEA-26, GEA-28, GEA-29, GEA-33, GEA-34, GEA-38…GEA-40, EXT-01…EXT-11, EXT-15, EXT-34…EXT-36, EXT-39 |
| `Au Ra` / `AuRa`, feminine/masculine enums | 23 | IDN-02…IDN-07, IDN-09…IDN-11, IDN-13…IDN-19, IDN-23, IDN-32, IDN-38, IDN-42…IDN-45 |
| Legacy `Helion` | 2 | IDN-01, IDN-08 |
| Missing/fractional model lanes | 10 | GEA-10…GEA-16, GEA-37, GEA-43, GEA-44 |
| Invalid dye or zero dye | 7 | GEA-02, GEA-03, GEA-17…GEA-19, GEA-36, GEA-41 |
| Explicitly disabled highlight or face-paint control | 6 | ACT-03, ACT-06, ACT-07, FIX-03, FIX-06, FIX-16 |
| Lip-color bit (`0x80` of `Mouth`) clear | 14 | ACT-15…ACT-18, ACT-22…ACT-26, ACT-33, FIX-04, FIX-10, FIX-14, FIX-17 |
| `FacePaint` mirror flag alone (128) | 4 | ACT-08…ACT-10, FIX-09 |
| Missing/null/invalid highlight, face-paint or lip-color control | 17 | ACT-01, ACT-02, ACT-04, ACT-05, ACT-12…ACT-14, ACT-19…ACT-21, ACT-28…ACT-30, ACT-41…ACT-43, EXT-40 |
| Lip alpha zero with extended data inactive | 13 | ACT-27, ACT-32, ACT-38, ACT-39, ACT-44, ACT-45, EXT-20…EXT-23, EXT-34, EXT-41, EXT-42 |
| Crossed eyes | 12 | EXT-24…EXT-30, EXT-37, EXT-38, EXT-43, EXT-44, FIX-02 |
| Missing shader reference | 1 | EXT-31 |
| Embedded image under 8 KiB | 6 | ENV-18…ENV-20, ENV-26, ENV-27, ENV-35 |
| Duplicate keys, depth/node limits, unsafe numbers | 12 | GEA-30, ENV-12…ENV-17, ENV-25, ENV-28, ENV-30…ENV-32 |
| Other cases (direct pins of palette selection, gear lanes, liveness, document shape and the real fixtures) | 68 | COL-01…COL-14, COL-22, COL-26, COL-27, COL-29, COL-35, GEA-01, GEA-04…GEA-08, GEA-20…GEA-24, GEA-27, GEA-31, GEA-35, GEA-42, ACT-31, ACT-34…ACT-37, ACT-40, EXT-12…EXT-14, EXT-16…EXT-19, EXT-32, EXT-33, EXT-45, ENV-01…ENV-03, ENV-21…ENV-24, ENV-29, ENV-33, ENV-34, FIX-01, FIX-05, FIX-07, FIX-08, FIX-11…FIX-13, FIX-15 |

"Missing shader reference" is pinned only on the library side (the `noShader` provider mode): the host's creator fallback is unreachable with the shipped tables, as the plan row says.

## Differences that need a maintainer decision or an adapter obligation

These are the `UNPLANNED:` cases. None is blocking by itself; each is listed so no unexplained difference passes the consumer-switch gate.

| Cases | Difference | What happens / recommendation |
| --- | --- | --- |
| ACT-37, FIX-10, FIX-17 | A lip with a positive stored opacity whose extended data is **not live** (no `IsExtendedAppearanceValid`) | The host composites a `blendHex` anyway (`chara-resolver.ts` tests only `alpha > 0`); the library composes only from live extended data, so `lipComposite` is null and the preview shows the palette lip. Both Anamnesis-shaped fixtures in this repo behave this way (Anamnesis never writes the flag), so every Anamnesis file whose lip-color bit is set and whose stored opacity is above 0 loses its blended lip tint. **Maintainer decision:** accept the library rule and say so in the release notes, or keep the tint (which means reimplementing lip compositing in the adapter, against the plan). |
| EXT-03 | A float string with one trailing separator (`"r, g, b, "`) | The host tolerates it (as the producers' own readers do); the library marks the field invalid and keeps the palette index. No producer writes this shape; it is a hand-edit artefact. **Recommend accepting.** |
| EXT-34 (and EXT-35) | An alpha-less 3-part `MouthColor` | The host reads alpha as absent (and, in an all-zero block, counts it as uncaptured); the library requires four parts for `MouthColor`, so the field is invalid and an all-zero block becomes live and black. Producers write four parts. **Recommend accepting.** |
| COL-09, COL-10, COL-35 | Lip/face-paint file index 96–127 (the unused gap), including the fractional 96.5 | The host names the gap (`midRangeIndex`), which the web app maps to the localized `swatch.slotError.midRangeIndex`; the library reports `indexOutOfRange` (or an invalid field for a fraction). **Adapter obligation (Tasks 3 and 5):** derive the gap message from `storedIndex.value` 96–127 (and from `storedIndex.raw` for a fractional value) so the user-visible text is unchanged. |
| COL-19 | `eyesShareIndex` on two equal but invalid indices | The host says true (it checks only non-null and equal); the library says false (both fields must be valid). A corner of a corner. **Recommend accepting** and projecting the library value. |
| COL-28 | Hair or skin with an out-of-range index and no gender | The host reports `noTribe` (context first); the library reports `indexOutOfRange` (range first). No colour either way. **Recommend accepting;** the adapter picks the message. |
| IDN-38 | A numeric `Race` in a tribe-less file | The host ignores a non-string `Race` (race null, limbal reads as a tattoo); the library accepts numeric enums (limbal ring for Au Ra). **Recommend accepting.** |
| ENV-22 | A leading U+FEFF before the JSON | The library skips one BOM; the host's `JSON.parse` refuses it. API-level only: the web loader (`File.text()`) and the bot (`Response.text()` / `TextDecoder`) strip the BOM first. Needs its own row in the plan's compatibility table; non-blocking. |

## Obligations carried into Tasks 3–6

- Key the activity-unknown warning on `active === null`, never on `reason`: a non-live float or an all-zero block on an unknown-activation slot reads `extendedInactive` / `ambiguousZeroBlock`, not `activityUnknown` (ACT-42 and its neighbours).
- Derive the localized gap message for lip/face-paint indices 96–127 from the stored index (COL-09/10/35, above).
- Fold the library slot kind `limbalOrTattoo` (race unknown) into the host's old union; map `Au Ra` back to `AuRa` and keep the host's `Male`/`Female` spelling (IDN cases).
- `UNSUPPORTED_FIELD` is raised for ordinary producer keys such as `Tags` (Brio-shaped and unlabelled exports: FIX-01, FIX-05, FIX-12); it is a warning and must never reach the user as an error.
- The library refuses the **whole document** for an unsafe integer anywhere in it, `Glasses` included (GEA-30, ENV-14); the host accepted such values. Fixed localized refusal, prior session retained (Task 5).
- A worn piece in the host can carry a lane the file never named: a coerced `ModelSet` / `ModelVariant` beside a positive base reads 0 and the piece counts as worn (GEA-11, GEA-16, GEA-44). The library marks the piece `INCOMPLETE_MODEL` and returns no model. The adapter follows the library (plan row "Missing/fractional model lanes"); lookups lose these pieces.
- The host walks gear in a fixed slot order, not file order, despite its docstrings (GEA-20); the adapter keeps the fixed order for stable output.

## Required contracts (a library divergence blocks adoption)

IDN-01…IDN-03, IDN-06, IDN-08…IDN-11, IDN-23, IDN-42…IDN-45, GEA-01, GEA-05, GEA-19, GEA-21, GEA-22, GEA-43, ACT-03, ACT-06, ACT-07, ACT-17, ACT-18, ACT-22, ACT-33, ACT-39, ENV-18…ENV-20, ENV-26, ENV-27, ENV-35, FIX-01, FIX-03…FIX-06, FIX-08, FIX-12, FIX-15, FIX-16 (42 cases). If any of these fails on the first real run, the candidate is blocked: request a separately reviewed library fix and exact pin; do not weaken the expectation.

## Gate status

| Step | State |
| --- | --- |
| Refresh target, producer sources, branches | Done 2026-10-25 |
| Comparison test written; host half green | Done: 261 cases |
| `vitest run …chara-library-parity.test.ts` before the dependency exists | Fails as the plan expects: `Cannot find package 'xivcharakit'` |
| Install `xivcharakit@0.1.0-beta.4`; lockfile integrity; `pnpm audit signatures` in an isolated consumer | Pending, not before 2026-10-26T11:32Z |
| Run the library half; classify every failure (wrong expectation, intentional difference, blocking) | Pending |
| Corpus aggregate (the maintainer's local `.chara` files; aggregate counts only) and the `historicalEyeCorrection` decision | Pending |
| Final candidate, evidence and approved differences recorded; commit with the dependency | Pending |

