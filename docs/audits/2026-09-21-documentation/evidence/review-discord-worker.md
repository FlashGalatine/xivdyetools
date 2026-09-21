# discord-worker cluster review

| cand-id | sev | file:line | one-line claim | evidence pointer |
|---|---|---|---|---|
| cand-001 | HIGH | docs/user-guides/discord-bot/faq.md:37 | "Autocomplete requires: ... Typing at least 2 characters" | apps/discord-worker/src/index.ts:1166 `getDyeAutocompleteChoices`: `query.length >= 1 ? searchDyesByName(query, locale) : dyeService.getAllDyes()` — fires on ONE character; `handleAutocomplete` (index.ts:1003-1145) and core's `searchByName` (packages/core/src/services/dye/DyeSearch.ts:79-89, only rejects length===0) impose no 2-char minimum anywhere in the path |
| cand-002 | MEDIUM | docs/projects/discord-worker/commands.md:224 | `/budget quick`'s 22 choices are "`jet_black` and `pure_white` plus the 20 Cosmic Exploration dyes" | apps/discord-worker/src/services/budget/quick-picks.ts:149-177 labels 4 of those 20 (`metallic_pink`, `metallic_ruby_red`, `metallic_cobalt_green`, `metallic_dark_blue`) "Cosmic Fortunes Dyes" in its own comment, not Cosmic Exploration — only 16 (lines 35-97, the Wave-1/Wave-2 "Cosmic Exploration Dyes" comments) are actually Cosmic Exploration; docs/user-guides/discord-bot/command-reference.md:212-217 lists the same 22 by name without this mislabel (cross-surface disagreement — schemas.ts decides, and it just re-exports `QUICK_PICKS` verbatim) |

POSITIVE:
- Full 17-registration/16-distinct-command roster (`registry.ts`) is completely and correctly covered by both commands.md and command-reference.md; `/a11y` sharing `/accessibility`'s handler is correctly noted every place it's mentioned.
- Every rate-limit figure quoted across commands.md, faq.md, getting-started.md and overview.md (5/10/15/20/30 per min, `/stats`→`default` 15, `/changelog`→`LOCAL_COMMAND_LIMITS` 30, autocomplete 60+10 burst) matches `DISCORD_COMMAND_LIMITS`/`LOCAL_COMMAND_LIMITS` (packages/worker-kit/src/rate-limiter/presets/configs.ts, apps/discord-worker/src/services/rate-limiter.ts) exactly.
- Every schema-derived choice list checked verbatim against schemas.ts: 10 harmony types, 5 colour wheels (order rgb/ryb/munsell/oklch-hue/oklch-lightness = core's `COLOR_WHEEL_IDS`), 6 matching methods, 9 gradient colour spaces, 6 blend modes, 5 vision lenses, 8 dye-list categories, 8 preset categories, 6 `/manual` topics (= core's `MANUAL_TOPICS`) — all present, correctly ordered, nothing stale or missing.
- Numeric/behavioural constants all check out byte-exact: `PREFERENCE_DEFAULTS` (blending=`ryb`, matching=`ciede2000`, count=`1`), `MAX_PRESET_FAVORITES`=50, `DAILY_SUBMISSION_LIMIT`=10, swatch's 1 MiB cap, changelog `COLLAPSED_COUNT`=5, budget Type-A/B/C itemIDs 52254/52255/52256 + vendor floor 216, mixer sweep 25/40/50/65/80, interaction body 100 KB / preset-submission webhook 10 KB / GitHub webhook 1 MiB, follow-up timeouts 5s/10s, `CARD_WIDTH`=400/`CARD_MAX_HEIGHT`=350, pinned announce repo `FlashGalatine/xivdyetools`.
- `/contrast`'s 13A/13B/13C·1 routing, "no AA/AAA letter grades," and the 3/4.5/7 log-axis criterion lines match `contrast.ts` + `contrast-card.ts` verbatim; `/accessibility`'s 13D/13E/13H routing and "`vision:all`, worst lens named" match `accessibility.ts` + `a11y-card.ts`.
- Quoted bot strings match en.json verbatim, including interpolation: favourite-limit ("You've reached the limit of {max} favorited presets."), `listTitleCount`, and interactions.md's `handleModal` → "Unknown modal submission."

SPELLING-EXCEPTION:
- "Glamour" in favorites-collections.md:26,37,50 and getting-started.md:166,168 (example preset name "Tank Glamour") is correct as-is — FFXIV's own name for its appearance system, never "Glamor" in-game or in source.
- "Grey" does not occur anywhere in this cluster's 8 files, so there is no instance to except here.

COVERED: 8/8 files read in full — docs/projects/discord-worker/{commands,interactions,overview,rendering}.md and docs/user-guides/discord-bot/{command-reference,faq,favorites-collections,getting-started}.md. Nothing unfinished.
