# Research

**Investigations that preceded a build.** Each directory answers "what are the options and which
should we take?" for one decision. Once the decision ships, the directory is **frozen** — it
records why the code looks the way it does, not how it looks today.

For the "what and how" of a build, see the spec/plan pairs in [`../superpowers/`](../superpowers/README.md).

| Directory | Question | Outcome |
|-----------|----------|---------|
| [2026-09-04-harmony-color-wheels/](2026-09-04-harmony-color-wheels/README.md) | Which colour wheels should the Harmony Explorer offer, and is Munsell licensable? | Shipped 2026-09-05 (PR #167): five wheels in core 5.2.0; Munsell licence cleared |
| [2026-09-03-algorithm-fact-check/](2026-09-03-algorithm-fact-check/README.md) | Are the matching and mixing algorithms correct? | Matching verified (CIEDE2000 passes Sharma's 34 pairs); mixing had a live P0 — fixed in PR #164 (core 4.4.0 / 5.0.0 / 5.1.0) |
| [api/](api/README.md) | Design of the public REST API | Shipped as `apps/api-worker` (`data.xivdyetools.app`) |
| [chara-equipment-resolution/](chara-equipment-resolution/README.md) | Can a `.chara` file's gear be resolved to item names? | Shipped 2026-08-20: core `chara-models`, api-worker `POST /v1/chara/resolve`, the Swatch Matcher glamour block |
| [color-matching/](color-matching/README.md) | Which colour-difference formula should matching use? | Shipped: the one matching vocabulary (`ciede2000` default, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish`) |
| [color-mixing/](color-mixing/README.md) | Which colour spaces and mixing models should the Gradient Builder and Dye Mixer offer? | Shipped as `@xivdyetools/core/blending` (six modes); re-examined by the 2026-09-03 fact-check |
| [discord-alternatives/](discord-alternatives/README.md) | Where could the bot live if Discord's age verification drove users away? | Stoat (Revolt) chosen; `apps/stoat-worker` built and then **parked** |
| [monorepo-2.0/](monorepo-2.0/README.md) | Monorepo 2.0 / Web-App 5.0 — data format, stainID migration, maintainer retirement, theme consolidation, package audit, per-tool port specs | Shipped 2026-08-28 (PR #123) |
| [monorepo-consolidation/](monorepo-consolidation/README.md) | Should the 15 repositories become one monorepo, and how? | Shipped: this pnpm + Turborepo monorepo (12 → 8 packages after Tier 1) |
| [patch-7.5/](patch-7.5/README.md) | What does Patch 7.5's dye consolidation change? | Shipped 2026-04-28: `CONSOLIDATED_DYES`, `getMarketItemID()`, itemIDs 52254/52255/52256 |
