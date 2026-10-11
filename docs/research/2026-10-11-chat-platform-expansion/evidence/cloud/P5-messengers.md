> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# P5: Messengers outside East Asia (Telegram, WhatsApp, Signal, Messenger), as of 2026-10-11

**Method limits.** WebFetch failed with DNS errors on every host I tried (core.telegram.org, tgstat.com), so nothing here was read from a primary page. Every web claim rests on WebSearch result summaries, which makes it snippet-level at best. About 20 searches ran. A bot-API doc read and a tgstat/telemetr.io direct lookup are still open. I read the 07-2026-10 refresh file (sections 1, 3 table, ruled-out list, 7, 8) in this checkout.

## 1. Telegram delta since 2026-10-04

- **No Bot API 10.4 found.** A search for "Bot API 10.4" returned nothing. The newest versions surfaced were 10.2 (a migration guide dates it 2026-07-14) and 10.3 (a library PR title dates it 2026-08-24) [1][2][3]. This is absence in search results, not proof that 10.4 does not exist. Re-check the official changelog.
- **Ephemeral lifetime is still undocumented.** Official text, as quoted in search summaries, only says an ephemeral message ID may be reused after the message is deleted or expires, and that bots can delete ephemeral messages early. It gives no duration [4]. The 07 watch item stays open.
- **10.3 parameter shape is confirmed by a second source.** `ephemeral_message_parameters` (fields `receiver_user_id`, `callback_query_id`, `replace_callback_query_message`) replaced the older `receiver_user_id` and `callback_query_id` parameters in the send methods [4][5]. This agrees with 07 step 7. One library notes `sendLocation.live_period` must be 0 for ephemeral messages [4].
- **Ofcom probe: no outcome yet.** The investigation opened 2026-04-21 over CSAM and illegal-content duties under the Online Safety Act. Telegram "categorically" denies it. Process is evidence gathering, then a provisional decision, then a final decision. Maximum fine is the greater of GBP 18M or 10% of qualifying worldwide revenue [6][7]. I found no provisional or final decision.
- **Bot Developer Terms: no 2026 change confirmed.** The page shows no revision date. It covers Bots and Mini Apps, and says terms may be amended at Telegram's discretion, with continued use counting as acceptance [8]. 07's §4.4 data-handling obligations are neither confirmed nor contradicted here.
- **Age rules:** nothing newer than 07 found (searched only indirectly).

## 2. FFXIV presence on Telegram: 07's "no evidence" holds, and it is now backed by a wider search

What I searched: tgstat.com, tgstat.ru and telemetr.io for FFXIV, FF14 and "Final Fantasy XIV"; Russian ("Telegram группа Final Fantasy XIV"); Japanese; Portuguese; Spanish; general English. What I found:

- **Only generic Final Fantasy channels:** "Final Fantasy Club" (@finalfantasychannel), about 1.63K subscribers (tgstat snapshot, about 59 days old, franchise-wide) [9]. A Russian repost channel @finalfantasyone and a confessions channel @finalfanconf (no relevant counts) [9]. Final Fantasy STL, 2,258 subscribers, a 3D-print-model channel, not a community [10].
- **One FFXIV-named chat:** "Night Hawks FFXIV Freecompany" (@ffxiv_nh) is listed on tgstat. Language, size and activity were not retrievable [11]. Treat it as a single small free-company chat.
- **Dead or dormant:** a 2016 Square Enix forum post announcing an FFXIV Telegram group, whose invite is likely dead [12]. A GitHub bot, seth-rah/FFXIV_Telegram_News, that posts Lodestone news to a chat, which is a tool and not a community [13].
- **Russian-speaking players:** the evidence points to Discord, Steam groups and VK, not Telegram. Steam group "[Rus] Final Fantasy XIV" shows 109 members; both Russian Steam groups look stale. A Discord server list by "Chuchelo Myauchelo" and a Laodizea guild Discord and VK group are mentioned [14]. This is thin evidence and says nothing about private Telegram chats.
- **Brazil:** the main hub is the Discord server "Final Fantasy XIV Brasil" (4,860 members, 1,853 online, from the Discord discovery page; created 2017) [15]. Fanbyte covers Brazilian fan projects (Moogle's Cave, Baitzkrieg) but names no Telegram or WhatsApp group [16]. No WhatsApp or Telegram group found.
- **Spanish-speaking:** Discord servers FFXIV[ESP] (about 6,200 members, created 2019) and FFXIV Latinoamerica (about 3,000 members, created 2017) per directory listings [17]. One 2017 Steam comment mentions a Latin American free company on WhatsApp, Discord and Facebook [17]. Stale and anecdotal.
- **Japan/Taiwan:** no FF14 Telegram community found. Search returned Discord communities only [18].

Conclusion: no FFXIV Telegram community of any size was found. Private invite-only groups would not appear in these indexes, so this is not proof of absence. Only an in-app Telegram search or a community poll can close it.

## 3. Telegram Mini Apps and inline mode

- **Mini App:** secondary sources describe the setup. Enable a Main App under BotFather Settings, then Mini Apps, and paste an HTTPS URL on a publicly reachable domain with valid TLS [19]. initData is validated server-side with HMAC-SHA256, using a key derived from the bot token with the "WebAppData" constant. Check `auth_date` for freshness, and use a vetted library such as `@tma.js/init-data-node` [19]. I could not read official theme-params, viewport or size limits, so those are unverified.
- **Fit:** apps/web-app is a Vite and Lit SPA with tools that need no account. In principle it can be pointed at from a bot menu button with no adapter code. A bot is still needed to host the entry point. Real work is Telegram-aware theming, the back button and viewport behavior, and the auth model (presets sign-in via XIVAuth does not map to Telegram identity). I did not test this against the app. Effort estimate (opinion, not measured): about 1 to 2 weeks for a launcher bot plus polish, versus 4.5 to 6 weeks for a full command bot in 07. The Mini App route skips the shared bot-logic extraction, the policy-per-platform question for stored IDs (if initData identity is not stored), and the 20 msgs/min group cap.
- **Inline mode:** `InlineQueryResultPhoto` needs `photo_url` as JPEG, at most 5 MB, plus a required `thumbnail_url`; caption up to 1024 characters; result `id` 1 to 64 bytes [20]. Our cards are PNG, so inline photo results would need a JPEG hosting path (a new hosted-image surface, like LINE in 07). `InlineQueryResultArticle` with text and a link avoids that. Dimension limits unverified.

## 4. WhatsApp

- **Groups API:** third-party write-ups still say 8 participants per group, up to 10,000 groups per number, Official Business Account required, invite-only joining, interactive messages unsupported, and the Cloud API can send text, media and templates into groups [21][22]. No official Meta changelog entry found; unchanged vs 07 [21][22].
- **New policy risk:** Meta's WhatsApp Business terms barred general-purpose AI chatbots from 2026-01-15; customer-service bots stay allowed [23]. A dye bot is not an LLM assistant, but the policy shows Meta restricting bot use cases.
- **Communities:** search returned only generic Brazil rollout news (a 5,000-person themed group feature) and nothing about FFXIV [24]. No FFXIV WhatsApp presence found beyond the 2017 anecdote above.

## 5. Signal, Messenger, Viber

- **Signal:** no official bot API. Community bots use signal-cli and signal-cli-rest-api with a linked phone number, with ban risk for automated behavior and breakage on protocol updates [25]. I did not find Signal's terms on automation. FFXIV presence: none found.
- **Messenger:** the Messenger Platform still exists, with the 24-hour messaging window [26]. A marketing blog claims messenger.com the website closed in April 2026 (unverified) [26]. Meta killed neither the bot API nor imposed anything new that I could find. FFXIV presence: none found.
- **Viber:** searched; no Viber bot status or FFXIV result came back. Unverified, not assessed.

## 6. Bottom line

- Telegram is still technically the best-fitting second bot (webhooks, ephemeral replies, photos) but has no FFXIV audience evidence. 07's default stands: only build after a community poll names it.
- If a cheap Telegram test is wanted before a full bot, the Mini App launcher is the lowest-cost probe, because it reuses the web app and needs no bot-logic work. Inline mode is cheap only in text-link form.
- WhatsApp, Signal and Messenger stay skipped. Viber is unassessed.

## Sources

[1] Search result on Bot API 10.x, DEV Community migration guide for 10.2, https://dev.to/unifyport/telegram-bot-api-102-migration-guide-rich-messages-ephemeral-edits-and-communities-gfe (snippet, accessed 2026-10-11)
[2] Library release notes for 10.3, https://github.com/yabx-net/telegram/releases/tag/10.3.0 (snippet)
[3] telegramium PR "Telegram Bot API August 24, 2026 updates (v10.3)", https://github.com/apimorphism/telegramium/pull/660 (snippet)
[4] Telegram Bot API docs and Bot Features, https://core.telegram.org/bots/api and https://core.telegram.org/bots/features (snippet via search, not fetched)
[5] opencrabs-windows issue #96 quoting the changelog, https://github.com/adi805/opencrabs-windows/issues/96 (snippet)
[6] Ofcom case page, https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/investigation-into-the-provider-of-telegram-and-its-compliance-with-duties-to-protect-users-from-illegal-content-under-the-online-safety-act-2023 (2026-04-21, snippet)
[7] TNW, https://thenextweb.com/news/ofcom-telegram-investigation-csam-online-safety-act (2026-04-21, snippet)
[8] Telegram Bot Developer Terms, https://telegram.org/tos/bot-developers (undated, snippet)
[9] TGStat @finalfantasyone, https://tgstat.ru/en/channel/@finalfantasyone ; Final Fantasy Club https://t.me/s/finalfantasychannel (snippet)
[10] telemetr.io @finalfantasystl, https://telemetr.io/en/channels/1501851765-finalfantasystl/active (snippet)
[11] TGStat @ffxiv_nh, https://tgstat.com/chat/@ffxiv_nh (listing only)
[12] Square Enix forum, https://forum.square-enix.com/ffxiv/threads/286194 (2016)
[13] https://github.com/seth-rah/FFXIV_Telegram_News
[14] Steam groups https://steamcommunity.com/groups/Rus_FFXIV and https://steamcommunity.com/groups/ffxivru ; guide https://steamcommunity.com/sharedfiles/filedetails/?id=1837841162
[15] https://discord.com/servers/final-fantasy-xiv-brasil-329043063500701696 (snippet, figure date unknown)
[16] Fanbyte, https://www.fanbyte.com/games/features/how-the-brazilian-ffxiv-community-keeps-the-game-alive-in-an-unsupported-country
[17] https://discord.com/servers/ffxivesp-537956000569753600 ; https://discord.com/servers/ffxiv-latinoamerica-272183207229915136 ; https://steamcommunity.com/groups/fantasyxiv/comments
[18] Japanese-language search results (Discord, Steam only), e.g. https://progameguides.com/final-fantasy/is-there-a-final-fantasy-xiv-discord/
[19] https://docs.telegram-mini-apps.com/platform/init-data and https://docs.telegram-mini-apps.com/packages/tma-js-init-data-node/validating (secondary)
[20] InlineQueryResultPhoto mirrors, https://aiogram.readthedocs.io/en/stable/api/types/inline_query_result_photo.html and https://docs.python-telegram-bot.org/telegram.inlinequeryresultphoto.html (secondary)
[21] Unipile, https://www.unipile.com/whatsapp-group-api/ (secondary, 2026)
[22] Kapso, https://kapso.ai/blog/whatsapp-groups-api-state-2026 (secondary, 2026)
[23] GSMArena, https://m.gsmarena.com/meta_bans_thirdparty_llm_chatbots_in_whatsapp_-amp-70460.php (secondary)
[24] MoneyTimes, https://www.moneytimes.com.br/whatsgram-ou-teleapp-whatsapp-brasil-lanca-funcao-de-criar-grupos-tematicos-com-ate-5-mil-pessoas/
[25] Signal bot libs, https://pypi.org/project/signalbot/0.2.3 ; https://www.vaquill.ai/docs/integrations/chatbots/signal.md (secondary)
[26] https://chatmaxima.com/blog/meta-killing-messenger-website-business-messaging/ (marketing blog, unverified)
[27] Repo: /home/user/xivdyetools/docs/research/discord-alternatives/07-2026-10-refresh.md lines 128, 162-164, 365, 386-392, 449-459


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Telegram bot | none-found — tgstat/telemetr.io searches (EN, RU, JA, PT, ES) found only franchise-wide channels (Final Fantasy Club about 1.63K subscribers) and one small FC chat @ffxiv_nh of unknown size. Regional communities are on Discord. | Webhook with secret-token header; fits Cloudflare Workers. 20 msgs/min group cap. | build-if-asked: only if the poll names Telegram; default second platform per 07. | 4.5-6 (from 07, not re-estimated) | Best technical fit (webhooks, ephemeral replies in groups, photos) but no demand evidence. No change to 07's cost estimate. No Bot API 10.4 or ephemeral lifetime found. |
| Telegram Mini App | none-found — Same as Telegram bot; requires a Telegram user base. | Static web app already on Pages/Workers; initData check is a small Worker route. | spike: if a cheap Telegram test is wanted, a launcher bot plus Mini App is the lowest-cost probe. Not worth doing before the poll. | 1-2 (my estimate, unmeasured) | Reuses apps/web-app; needs BotFather Main App, HTTPS URL and initData validation. Theming/viewport details unverified. Does not give chat-native commands or cards. |
| WhatsApp | none-found — No FFXIV WhatsApp group found; one 2017 anecdote of a Latin American FC. Brazil and LATAM hub is Discord. | Webhook model fits, but group limits make it unusable for community servers. | skip | n/a | Groups API reported capped at 8 participants, needs Official Business Account, no interactive messages. Meta also restricts bot use cases (AI chatbot ban from 2026-01-15). |
| Signal | none-found — No FFXIV Signal community found. | Poor: needs a persistent signal-cli process. | skip | n/a | No official bot API; community signal-cli bots risk account bans and need a persistent host. |
| Messenger | none-found — No FFXIV Messenger community found in searches. | Webhook model fits technically. | skip | n/a | Platform exists with a 24-hour messaging window and business-page requirements; no FFXIV audience and no evidence of fit for community group use. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| c1 | No Bot API 10.4 found; newest seen are 10.2 (about 2026-07-14) and 10.3 (about 2026-08-24). | snippet | https://dev.to/unifyport/telegram-bot-api-102-migration-guide-rich-messages-ephemeral-edits-and-communities-gfe | accessed 2026-10-11 |
| c2 | Ephemeral message lifetime is still undocumented; docs only say IDs are reusable after delete or expiry. | snippet | https://core.telegram.org/bots/api | accessed 2026-10-11 |
| c3 | Ofcom Telegram investigation opened 2026-04-21; no provisional or final decision found. | snippet | https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/investigation-into-the-provider-of-telegram-and-its-compliance-with-duties-to-protect-users-from-illegal-content-under-the-online-safety-act-2023 | 2026-04-21 |
| c4 | No FFXIV-dedicated Telegram channel or chat of any size found on tgstat/telemetr.io searches; only generic FF channels (Final Fantasy Club about 1.63K subscribers) and one small FC chat @ffxiv_nh of unknown size. | snippet | https://t.me/s/finalfantasychannel | accessed 2026-10-11 |
| c5 | Russian-, Brazilian- and Spanish-speaking FFXIV players are visible on Discord (FFXIV Brasil 4,860 members; FFXIV[ESP] about 6,200; Latinoamerica about 3,000), not on Telegram or WhatsApp. | snippet | https://discord.com/servers/final-fantasy-xiv-brasil-329043063500701696 | accessed 2026-10-11 |
| c6 | InlineQueryResultPhoto requires a JPEG photo_url at most 5 MB plus thumbnail_url; our cards are PNG. | secondary | https://aiogram.readthedocs.io/en/stable/api/types/inline_query_result_photo.html | accessed 2026-10-11 |
| c7 | Mini App needs a public HTTPS URL set in BotFather; initData validated server-side by HMAC-SHA256 with auth_date freshness check. | secondary | https://docs.telegram-mini-apps.com/platform/init-data | accessed 2026-10-11 |
| c8 | WhatsApp Groups API still reported as 8 participants, OBA required, no interactive messages; no official changelog entry found. | secondary | https://kapso.ai/blog/whatsapp-groups-api-state-2026 | 2026 |
| c9 | Signal has no official bot API; bots use signal-cli with ban risk. | secondary | https://www.vaquill.ai/docs/integrations/chatbots/signal.md | accessed 2026-10-11 |
| c10 | Telegram Bot Developer Terms show no revision date and no 2026 change was confirmed. | snippet | https://telegram.org/tos/bot-developers | accessed 2026-10-11 |
| c11 | 07 estimate: Telegram T1 at 4.5 to 6 dev-weeks including 2.0 to 2.5 weeks shared extraction; Telegram IDs must stay out of Analytics Engine. | repo | /home/user/xivdyetools/docs/research/discord-alternatives/07-2026-10-refresh.md:128 | 2026-10-04 |


## Corrections to the 2026-10-04 refresh

- None proven wrong. 07's 'no FFXIV evidence on Telegram' and the WhatsApp 8-participant/no-interactive claims were re-confirmed by wider searches, but only at snippet or secondary level because WebFetch was unavailable.
- 07 §7 line 128 lists ephemeral messages as 'Bot API 10.2+' while step 7 says target 10.3 parameters; consistent with sources, but the 10.2 vs 10.3 attribution of ephemeral edit/delete is described differently in different sources and should be checked against the official changelog.


## Open questions

- Official Bot API changelog and ephemeral-message docs were not read (WebFetch DNS failure); confirm no 10.4 and the ephemeral lifetime.
- Is @ffxiv_nh active, and how big is it? tgstat could not be fetched.
- Do private or invite-only FFXIV Telegram groups exist? Only an in-app search or a community poll can tell.
- Mini App theming, viewport and size constraints are unverified from primary docs.
- Viber bot status was not found; Messenger bot policy changes in 2026 not verified from Meta docs.
- Whether Telegram inline JPEG hosting is acceptable for our PNG cards (new hosted-image surface).
