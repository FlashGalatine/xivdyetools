# DEAD-032: KEEP shader tables + chara-shader-colors.ts (live via palette bridge; deliberate duplicate of xivcharakit corpus)
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core · **Semver:** NONE · **Category:** Legacy

## Location
- `packages/core/src/data/character_colors/shader/shared.json (681), packages/core/src/data/character_colors/shader/race_specific.json (12485), packages/core/src/services/chara/chara-shader-colors.ts`

## Evidence
- git grep -w charaShaderHex: chara-palette-provider.ts:121,136 and legacy chara-resolver.ts:403 (resolveCharaColors). chara-shader-colors.ts:37,47 dynamic-import both shader JSONs. createCharaPaletteProvider is used in production at apps/web-app/src/services/chara-inspection-service.ts:84 and by resolveCharaForTools (chara-library-resolve.ts:38). That function is called from bot-logic chara-identity.ts:51 -> swatch.ts:405 / glamour.ts:444, both registered in discord-worker registry.ts:33-34. Both are @public in core index.ts:277-278 (npm 5.15.0 == local). xivcharakit createDefaultPaletteProvider is imported only by 2 tests. CHANGELOG 5.15.0:25-26 says "no second palette corpus ships".
- The files are not dead. Both shader tables load through charaShaderHex. That function feeds createCharaPaletteProvider, which the web-app's .chara inspection uses (chara-inspection-service.ts:84). It also feeds resolveCharaForTools, which the bot's /swatch and /glamour reach through chara-identity.ts:51, and the published legacy resolveCharaColors (chara-resolver.ts:403). Swapping in xivcharakit's bundled corpus would ship a second palette corpus, which the 5.15.0 design rules out. Removing the tables would break both apps at runtime and the published API (MAJOR). The KEEP stands.
- Still live: apps/web-app/src/services/chara-inspection-service.ts:84; packages/bot-logic/src/commands/chara-identity.ts:51 (swatch.ts:405, glamour.ts:444); packages/core/src/services/chara/chara-resolver.ts:403

## Fix
- **KEEP** — revisit trigger: Re-audit when either of two conditions holds. (a) An xivcharakit release after 0.1.0-beta.4 exports a lazy, shader-only PaletteProvider entry, and switching core to it keeps web-app `run build:check` within budget. (b) A core MAJOR removes both createCharaPaletteProvider and the legacy resolveCharaColors. Before removing anything, git grep -w charaShaderHex must show no production caller.
- Cascade: Removing these files would break createCharaPaletteProvider, resolveCharaForTools and resolveCharaColors. That breaks the web-app .chara import and the discord /swatch and /glamour commands.
- Published: @xivdyetools/core 5.15.0 exports createCharaPaletteProvider and resolveCharaForTools as @public, and resolveCharaColors is published too. All three depend on this module, so any removal is MAJOR.

## Status
OPEN
