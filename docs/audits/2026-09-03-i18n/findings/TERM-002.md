# TERM-002: three Japanese game nouns in core disagree with the terminology dictionary; all three are hardcoded in the generator
**Tier:** P2 (`categories.Neutral`, `acquisitions.Dye Vendor`) · P3 (`acquisitions.Crafting`, where the dictionary is the likely error) · **Locale(s):** ja · **Deploy unit:** core (published package — every app inherits it) · **Generated?** **yes — fix `build-locales.ts`, never the JSON**

## Location
- `packages/core/scripts/build-locales.ts:283` — `Neutral: 'ニュートラル'`
- `packages/core/scripts/build-locales.ts:355` — `'Dye Vendor': '染料販売業者'`
- `packages/core/scripts/build-locales.ts:356` — `Crafting: '製作'`

## Evidence
- `evidence/term-check.txt`: 45 dictionary rows map to a core key; exactly these 3 mismatch.
- `categories.Neutral` — core's own eight sibling categories use the game's 〜系 pattern (`赤系 青系 茶系 緑系 黄系 紫系`, plus `特殊`), and `docs/reference/ffxiv-terminology.md` gives `無彩色系`. `ニュートラル` is a bare transliteration and the only category that breaks the pattern.
- `acquisitions.Dye Vendor` — `染料販売業者` is a literal "dye sales business operator"; the dictionary's `染色師` is the in-game NPC name.
- `acquisitions.Crafting` — dictionary says `制作`, core says `製作`. **FFXIV's Japanese client uses 製作 for crafting**, so here core looks right and the dictionary wrong. Do not "fix" the code on this row.

## Fix
- Change lines 283 and 355 to `無彩色系` and `染色師`, re-run `pnpm --filter @xivdyetools/core run build:locales`, and commit the regenerated locale JSON with it.
- For line 356, correct the dictionary row instead — or record the disagreement there if 製作 is intentional. Needs a human who can check the JP client.
- core is published: this changes user-visible strings in every consumer, so it wants a minor bump and a changelog line, and both resvg workers should be re-subset afterwards (new glyphs 無, 彩, 色, 師).

## Status
OPEN
