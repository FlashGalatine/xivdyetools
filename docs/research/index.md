# Research

**Investigations that preceded a build.** Each directory answers "what are the options and which
should we take?" for one decision. Once the decision ships, the directory is **frozen** — it
records why the code looks the way it does, not how it looks today.

For the "what and how" of a build, see the spec/plan pairs in [`../superpowers/`](../superpowers/README.md).

| Directory | Question | Outcome |
|-----------|----------|---------|
| [2026-10-05-character-sheet-terms/](2026-10-05-character-sheet-terms/README.md) | What does each FFXIV client call the character creator's color palettes, word for word? | Tabled in the glossary → [Character-Creation Color Sheets](../reference/ffxiv-terminology.md#character-creation-color-sheets): the `Lobby` labels (202–250, 1742–1748, 2122–2129) in all six languages. Not yet applied to core / web-app / bot. Also found core's ko race and clan names and four zh clans are not the client's |
| [2026-09-28-equipment-slot-terms/](2026-09-28-equipment-slot-terms/README.md) | What does each FFXIV client call the equipment slots, word for word? | Adopted in PR #208 / #210: the `Addon` slot labels (738–750, 16050) in all six languages; glossary → [Equipment Slots](../reference/ffxiv-terminology.md#equipment-slots) |
| [2026-09-28-chara-corpus-profile/](2026-09-28-chara-corpus-profile/README.md) | Do the `.chara` parser's rules hold across 1,142 real files? | Eye pairing and float decoding overturned, phantom gear dyes dropped — core 5.6.0; `human.cmp`'s creator and shader palettes read separately (the tattoo sheet had been the eye palette) — core 5.7.0 |
| [2026-09-27-glamour-acquisition/](2026-09-27-glamour-acquisition/README.md) | Can the glamour export fill its Acquisition line, and from which data (XIVAPI, Teamcraft, Garland Tools)? | Design proposed: Teamcraft files + XIVAPI at build time, served by the api-worker ([spec](../superpowers/specs/2026-09-27-glamour-acquisition-design.md)) |
| [2026-09-04-harmony-color-wheels/](2026-09-04-harmony-color-wheels/README.md) | Which colour wheels should the Harmony Explorer offer, and is Munsell licensable? | Shipped 2026-09-05 (PR #167): five wheels in core 5.2.0; Munsell licence cleared |
| [2026-09-03-algorithm-fact-check/](2026-09-03-algorithm-fact-check/README.md) | Are the matching and mixing algorithms correct? | Matching verified (CIEDE2000 passes Sharma's 34 pairs); mixing had a live P0 — fixed in PR #164 (core 4.4.0 / 5.0.0 / 5.1.0) |
| [api/](api/README.md) | Design of the public REST API | Shipped as `apps/api-worker` (`data.xivdyetools.app`) |
| [chara-equipment-resolution/](chara-equipment-resolution/README.md) | Can a `.chara` file's gear be resolved to item names? | Shipped 2026-08-20: core `chara-models`, api-worker `POST /v1/chara/resolve`, the Swatch Matcher glamour block |
| [color-matching/](color-matching/README.md) | Which colour-difference formula should matching use? | Shipped: the one matching vocabulary (`ciede2000` default, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish`) |
| [color-mixing/](color-mixing/README.md) | Which colour spaces and mixing models should the Gradient Builder and Dye Mixer offer? | Shipped as `@xivdyetools/core/blending` (six modes); re-examined by the 2026-09-03 fact-check |
| [discord-alternatives/](discord-alternatives/README.md) | Where could the bot live if Discord's age verification drove users away? | Stoat (Revolt) chosen; `apps/stoat-worker` built and then **parked**. [2026-10 refresh](discord-alternatives/07-2026-10-refresh.md): the bot needs no change for Discord's new age model; poll the community, promote the web app, Telegram if a second bot is built |
| [monorepo-2.0/](monorepo-2.0/README.md) | Monorepo 2.0 / Web-App 5.0 — data format, stainID migration, maintainer retirement, theme consolidation, package audit, per-tool port specs | Shipped 2026-08-28 (PR #123) |
| [monorepo-consolidation/](monorepo-consolidation/README.md) | Should the 15 repositories become one monorepo, and how? | Shipped: this pnpm + Turborepo monorepo (12 → 8 packages after Tier 1) |
| [patch-7.5/](patch-7.5/README.md) | What does Patch 7.5's dye consolidation change? | Shipped 2026-04-28: `CONSOLIDATED_DYES`, `getMarketItemID()`, itemIDs 52254/52255/52256 |
