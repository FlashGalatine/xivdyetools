# Content and runtime i18n review

Reviewed at `6da3ff5b` in the isolated audit worktree. Assigned pair: `gpt-6.1-sol` / `high`; `.codex/agents/xivdye-worker.toml:1` leaves model and effort unset. No source edits, builds, gates, command registration, network calls, commits or pushes were performed. Only the three assigned evidence files were written.

## Candidates

See `candidates-content.json` for six independently verifiable candidates, source anchors, reproduction steps and proposed fixes. Priority is provisional for coordinator/verifier review.

> Coordinator note (2026-10-31): the coordinator's final catalog (`evidence/final-catalog.json`) files CONTENT-004 as I18N-002 and CONTENT-006 as HC-002, both at P1; those filed tiers are final.

| Candidate | Draft priority | Evidence that gates miss |
|---|---|---|
| CONTENT-001 | HC P1 | `main.ts:187` supplies an English-only error detail alongside localized fatal-screen chrome; `fatal-error.ts:61` paints it. |
| CONTENT-002 | I18N P2 | `localize.ts:138-204` has no swatch/slot, swatch/order or preset/sort branches; runtime payload confirms twelve plain-language choices with no localization map. |
| CONTENT-003 | TERM P2 | `ko.json:145,198,201,291,499` still calls Hue 색조, against the explicit house rule in `traps/i18n-fonts.md:73-74`. |
| CONTENT-004 | I18N P2 | `og-strings.ts:43,56,69,82,95,108` advertises six harmony types; `og-params.ts:48` and web `harmony-generator.ts:39` enumerate ten. |
| CONTENT-005 | FONT P3 | `fonts.ts:81-83` always loads JP before SC for zh; actual generated-card renders change under SC-first order. |
| CONTENT-006 | HC P2 | `index.ts:1235,1288-1305` drops the resolved locale for clan autocomplete; validation at `preferences.ts:785` inserts the same English-only table. |

Abbreviated paths in this table resolve to the full paths in the candidate JSON. The font item concerns regional face selection, not glyph absence, and should be scheduled last. CONTENT-006 has lower practical impact because the preference currently has no command consumer (`schemas.ts:715`).

## Runtime probes

Run from `apps/discord-worker` to reproduce the choice-localization result. This calls source modules and already built local package dependencies, with no registration or build:

```powershell
node --import tsx --input-type=module -e "import { commands } from './src/commands/schemas.ts'; import { localizeCommands, LOCALE_CODES } from './src/commands/localize.ts'; import { initializeLocale } from '@xivdyetools/bot-logic'; await Promise.all(LOCALE_CODES.map(initializeLocale)); const walk=(os,p)=>{for(const o of os??[]){const cs=(o.choices??[]).filter(c=>!c.name_localizations);if(cs.length)console.log(p+'.'+o.name+' | '+cs.map(c=>c.name).join(' / '));walk(o.options,p+'.'+o.name)}};for(const c of localizeCommands(commands))walk(c.options,c.name);"
```

Relevant output after initializing all six locales:

```text
swatch.order | Slots — file order (default) / Hardest — worst match first
swatch.slot | 👤 Skin / 💇 Hair / ✨ Highlights / 👁️ Eyes / 💋 Lip / 🎨 Face paint / 🎭 Tattoo / Limbal ring
preset.list.sort | ⭐ Most Popular / 🕐 Most Recent / 🔤 Alphabetical
```

Other absent maps included method/model tags, language endonyms and preset categories. Those were excluded from the twelve-count finding because of the explicit exception policy (`localize.ts:133-136`; `traps/i18n-fonts.md:32-35`). A preliminary probe omitted core locale initialization and consequently over-reported harmony/category/vision/budget maps; the initialized result above supersedes it. The first CJS `tsx -e` attempt failed on core's ESM-only exports; the successful probe uses Node's ESM entry point. One initial invocation also used root-relative imports from the app directory; the corrected app-relative invocation above passed.

Read-only font probe, run from `apps/og-worker` (the full production font order is reproduced directly from `fonts.ts:73-83`; SVG comes from the actual card generator):

```javascript
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { generateAccessibilityOG } from './src/services/svg/accessibility.ts';
const entry = createRequire(import.meta.url).resolve('@resvg/resvg-wasm');
await initWasm(readFileSync(join(dirname(entry), 'index_bg.wasm')));
const disk = f => new Uint8Array(readFileSync('src/fonts/' + f));
const latin = ['SpaceGrotesk-Regular.ttf', 'SpaceGrotesk-SemiBold.ttf',
  'SpaceGrotesk-Bold.ttf', 'Onest-Regular.ttf', 'Onest-SemiBold.ttf',
  'Onest-Bold.ttf', 'FragmentMono-Regular.ttf'].map(disk);
const jp = disk('NotoSansJP-Subset.ttf'), sc = disk('NotoSansSC-Subset.ttf'),
  kr = disk('NotoSansKR-Subset.ttf');
function hash(svg, faces) {
  const r = new Resvg(svg, {fitTo:{mode:'zoom',value:3},
    font:{fontBuffers:[...latin,...faces],defaultFontFamily:'Onest'}});
  const out = r.render();
  const result = createHash('sha256').update(out.asPng()).digest('hex');
  out.free(); r.free(); return result;
}
const svg = generateAccessibilityOG({dyeIds:[1],visionType:'achromatopsia',locale:'zh'});
console.log(svg.match(/>[^<]*全色盲[^<]*</g));
console.log(hash(svg,[jp,sc,kr]),hash(svg,[sc,kr,jp]));
```

Execute the block through `node --import tsx --input-type=module -` (PowerShell UTF-8 here-string input). Output:

```text
>全色盲 · 1 种染剂<
JP-first 8a6489e3327c10046bcaf86bab19454f16017a6c1a61ef25f26524c983db6750
SC-first 753a4f649355bf648fc15fc4071aa770612cfa337c7f96db59d431afa6651b59
```

Supporting single-character experiment: derive the intersection of JP/SC cmaps with fontTools, restrict to codepoints >= U+3400, and render each with the same Latin-led body stack. Of 139 shared codepoints checked, differing examples include 色、天、全、盲; where the two load orders differ, JP-first equals JP-only and SC-first equals SC-only. `天青色`, `紫色` and `色` differ under the two orders; `青` is identical. The first exploratory samples 骨/直/角/写 were unsuitable: several are absent from the small OG JP subset or both subsets, and whole strings containing SC-only characters can fall back together. No finding is based on those samples. The real accessibility-card probe above uses shipped text. The sibling actual-render regression test already documents the fallback mechanism (`apps/discord-worker/src/services/font-load-order.test.ts:1-19,103-147`).

## Positive controls

- New `.chara` issue/status keys exist as explicit key maps, with safe unknown fallbacks (`apps/web-app/src/components/chara-ui.ts:64` and its issue-key map at `:325`). The six-language changed strings retain activation-unknown, skipped-invalid-value, inferred-eye-swap and retry meanings; no new translation candidate was found in those groups.
- New count paths use `Intl.PluralRules`, including French zero, via `chara-ui.ts:98`; Glamour equipment totals call it at `glamour-block.ts:553-554`, and footer counts at `:1600-1601`. The verdict joins translated clauses with locale-aware `Intl.ListFormat` at `glamour-block.ts:1542`.
- Core is generated and must be corrected in CSV/generator sources, not JSON (`.agents/skills/i18n-manager/SKILL.md:18`, the fixed source map). Character-sheet labels were compared against the pinned `ffxiv-terminology.md:454-516` table. No new source-name discrepancy was identified.
- Card clan localization fixed by the prior audit is present: `packages/bot-logic/src/commands/chara-identity.ts:65` calls `getLocalizedClan` and uses locale-aware uppercase. CONTENT-006 is a different preferences path.
- Browser CJK stacks have explicit JP/SC/KR families and zh/ko regional overrides (`apps/web-app/src/styles/globals.css:81-116`). Shared SVG stacks also include all three (`packages/svg/src/base.ts:259-265`, `frame.ts:154-156`). Discord font loading already has locale-aware order (`apps/discord-worker/src/services/fonts.ts:126`).
- OG crawler copy uses six authored tables and explicit placeholder interpolation (`apps/og-worker/src/services/og-embed.ts`); tool-name tables use the shipped titles. No untranslated crawler sentence or incomplete variable supply was identified in the inspected branches of `og-data-generator.ts`.
- Fresh structural/font/policy gates were delegated to the coordinator; this worker did not rerun or claim independent results for them. Coordinator reports all gates green and no locale-diff structural/placeholder gaps.

## Existing catalog overlap; do not duplicate

- `2026-10-26-security/FINDING-007`: French saved-palette versus saved-preset term collision in policy/UI. The catalog also tracks related ja/ko policy wording. See its report `:32,102`.
- `2026-10-26-security/FINDING-033`: de/fr (and tracked ja) character-name promise narrows “other people” to “other players”; report `:58,110`.
- `2026-10-26-security/FINDING-034`: German `preset.shotSlot` omits “not uploaded”; source finding `:8-10`, report `:59,111`.
- Other policy fact/code mismatches (for example “a dozen small integers”, retained snapshots and browsing identity) remain security-owned; the current report catalogs them at `:35,51-52`. This pass proposes no duplicate policy finding.
- The `2026-10-26-xivcharakit-dead-code` catalog's 47 items concern the library migration and parked API surface (`README.md:3,16-21`), not these six content/runtime sites.

## Rejected suspicions and limits

- Do not file core's protected **Grey** dyes/Facewear or **Glamour** as British-spelling defects (`american-english.md:19-35`). Coordinator's fresh spelling sweep reportedly found only protected Grey; this worker ran no additional spelling sweep.
- Do not re-file English GPOSERS labels/acquisition lines, admin `/stats`, raw presets-api errors, release-note bodies, user-authored preset names, code tags or algorithm identifiers (`traps/i18n-fonts.md:32-35`; prior audit's rejected/positive controls).
- Stoat's present English surface has no locale preference source and explicitly calls the shared logic with `en` (`apps/stoat-worker/CLAUDE.md:121`). It is not a newly broken six-language reply path. Fatal-screen heading defaults are also deliberate; CONTENT-001 concerns the separately displayed English detail.
- German clan nouns Volksgruppe/Stamm and French ethnie/clan are unpinned terminology, expressly deferred in the previous plan (`2026-10-04-i18n/REMEDIATION_PLAN.md:923`). No guessed term is proposed.
- German `Sie wird` in `preset.submittedPendingReview` is the pronoun referring to the submitted Vorlage, not formal address; rejected.
- Japanese 染料/カララント house choices and short status chips remain allowed; no style-only alternative is filed. Korean 색조 findings are limited to explicit Hue-coordinate uses under the written project rule.
- This is a cross-unit content/runtime review with all 18 locale JSONs loaded and changed values compared against `50165ec6`; it is not a fresh native-speaker certification of every unchanged sentence. Policy coverage here is overlap reconciliation, English reading and targeted terminology/meaning checks using the immediately preceding security audit's five-language readers (`SECURITY_AUDIT_REPORT.md:145`), not a repeated full legal translation review. No live Discord picker or browser-failure screen was exercised; the payload probe and source traces are distinguished above. The font probe uses the actual SVG generator and actual font bytes but reproduces renderer options rather than importing the binary-bound Worker renderer.
- Some search commands named historical/nonexistent files; those returned file-not-found and were replaced by tracked source paths. No conclusion relies on a failed read.

## Read ledger

See `read-files-content.txt` for source/instruction/evidence files read or loaded. `MEMORY.md:1225` was used only to locate the previous audit authority and then verified against the current archived report/plan; it supplies no unverified current-code claim.
