> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# P1: Stoat delta, FFXIV presence, and hosting (as of 2026-10-11)

Method note: only github.com and the search tool were reachable. Every other domain failed DNS in WebFetch (stoat.chat, rvlt.gg, stoatservers.com, stoatstatus.com, developers.cloudflare.com, fly.io and docs.hetzner.com were all tried). I cloned stoatchat/stoatchat (main, version.txt 0.15.5), stoatchat/gateway and stoatchat/javascript-client-sdk read-only. Hosting prices therefore come from search snippets and are labeled "snippet". I did not read the Stoat Discover pages or API, so the FFXIV search below is not exhaustive.

## 1. Delta since 2026-10-04

- **Backend releases:** Nothing is newer than v0.15.7 (2026-09-25, internal, updates the shield antispam component). v0.15.6 (2026-09-24) was the gateway test release that dual-writes events to Redis and AMQP. The release list page 1 shows nothing after it [1]. The repo's main branch still reports version 0.15.5 (`version.txt`) [2].
- **Elixir events gateway:** The `stoatchat/gateway` repo is active. It has 202 commits and no releases. 31 commits fall between 2026-09-28 and 2026-10-11, and the newest is 2026-10-11 [3][4]. Its README says it is a rewrite of Bonfire and listens on port 14703 at `/` "like Bonfire". It makes no wire-compatibility claim for bots and SDKs [3]. The stoat.js SDK shipped "fix: Increase event websocket reliability (#198)" on 2026-10-06 [5]. Whether bots stay compatible is still unverified. The README and the commit list give no migration timeline.
- **stoat.js and revolt.js:** npm `latest` is still 7.3.6 (2026-01-16) [6]. The SDK repo's package.json already says 7.3.7 and its last commit is 2026-10-06, so a release is plausibly near but is unpublished [5]. `revolt.js` stays at 7.2.0 (2025-05-12) [6]. The SDK repo is `stoatchat/javascript-client-sdk`; the name `stoat.js` is only the npm name [6].
- **Interactions:** No movement.
  - Discussion #483, "feature request: Interactions", is in `stoatchat/discussions`. It was posted 2022-07-17 and has 3 comments. The last is 2025-05-15, from a bot developer, and there is no visible team reply [7].
  - In the backend, `interactions_url` exists only as a stored bot field that can be edited and cleared. `grep` finds no code in `crates/` that sends to it. Messages carry an `interactions` object, but it only restricts reactions [2].
  - I did not re-check #1291 or #1493.
- **New bot API items in 0.15.x:** Discover endpoints for bots and servers (0.15.2, SDK #191 on 2026-08-30), relationship info for bots, and rate limits moved into Redis [1][5].
- **Outages:** A status aggregator snapshot taken 2026-10-10 said all systems were operational. I found no major outage for September or October. Its longest recent item was a 3h19m email incident [8]. I could not open the official feed. This does not conflict with the 07 timeline, which ends 2026-08-29.
- **Users:** I found no new official figure. 07's 1M registered accounts (2026-03-29) is the best available [9].
- **Online Safety Act and Ofcom:** I found no Ofcom action naming Stoat [10]. Discussion #572 was not re-checked.
- **Org activity:** 43 repos. `stoatchat` and `javascript-client-api` were updated 2026-10-10, and `for-web` and `for-android` on 2026-10-11 [11]. The project is actively maintained.

## 2. FFXIV presence on Stoat: still tiny

- **stoatservers.com tag `ffxiv`:** One server, "FFXIV", with 53 members and 11 online. The listing was last bumped "5 months ago" [12].
  - The server ID is a ULID. I decoded it to a creation date of 2026-02-10. That is the Discord age-verification news window.
  - The count measures members, not activity, and it is a snapshot from a third-party directory.
- **Second server (6 members, in 07):** not re-found; kept as in 07.
- **Existing FFXIV bots on Stoat or Revolt:** none in `awesome-stoat`. Its bot list is Lightning, Remix, revcord, matrix-appservice-revolt, Borgar and CartelBot [13]. No dye bot exists there either.
- **Searches that returned nothing:**
  - "FFXIV Free Company Stoat server Revolt community" found only the one server above and no Free Company.
  - The Japanese query "FF14 ステラ OR Stoat OR Revolt サーバー FC 移行" found no FC migration to Stoat.
  - "FFXIV Stoat OR Revolt Discord alternative reddit" found only generic Discord-exodus coverage.
  - "FFXIV Stoat bot OR xivapi OR dye Revolt bot" found no FFXIV bot on Stoat.
- **Bottom line:** Evidence of FFXIV demand on Stoat is one 53-member server created in February 2026 and quiet since. I saw no sign of an FFXIV audience large enough to justify an un-park on demand alone. Discord is where the FFXIV community is, and this search found no sign of a shift.

## 3. Hosting an always-on bot

**Durable Object relay (re-confirmed).** Cloudflare's docs say [14][15]:
- "an open outbound WebSocket connection prevents eviction for up to 15 minutes. The connection itself may remain open after that."
- "Outgoing WebSockets do not hibernate."
- "Starting another I/O operation later can extend the Durable Object's time in memory."
- "Events such as alarms, incoming requests, and scheduled callbacks prevent hibernation."

The change is dated 2026-06-19 [15]. It replaced the earlier behavior of eviction after 70-140 s without incoming traffic. Whether inbound frames on the outbound socket reset the 15-minute timer is still undocumented [16]. A workerd issue reports an outbound DO WebSocket closed with code 1005 after a concurrent streaming subrequest ended [17]. A watchdog alarm remains mandatory. The 07 claim that frames arriving on the socket do not count as activity is consistent with the docs but not stated by them. It is plausible, not confirmed.

**Cloudflare Containers.**
- Containers reached GA on 2026-04-13 [18]. The `durable_object` scheduling policy is public beta (2026-09-30) [18].
- Rates (snippet of the pricing page [19]): $0.0000025 per GiB-second of memory, $0.000020 per vCPU-second (active use only, since the November 2025 change), and $0.00000007 per GB-second of disk. Workers Paid includes 25 GiB-h, 375 vCPU-min and 200 GB-h.
- Instance types [19]: lite is 1/16 vCPU, 256 MiB and 2 GB disk. basic is 1/4 vCPU, 1 GiB and 4 GB disk.
- My arithmetic for a 30-day month, before the included amounts and the $5 Workers Paid base:

| Instance | Memory | Disk | Total |
|---|---|---|---|
| lite | about $1.62 | about $0.36 | about $2.0 |
| basic | about $6.48 | about $0.73 | about $7.2 |

- Lifecycle [20]:
  - The default idle timeout is 10 minutes. A background WebSocket does not count as activity unless `renewActivityTimeout()` is called, and newer docs rename this to `setInactivityTimeout()`.
  - On stop, SIGTERM is sent, then SIGKILL after 15 minutes.
  - A host restart can stop a running instance at an irregular cadence, and Cloudflare does not guarantee any run duration.
  - Disk is ephemeral.
- I found no cold-start figure.
- Fit: a Node bot can run in a container, but it needs a Worker plus a Container class holding the process alive and reconnecting. That is more moving parts than a plain VPS, and it has no 24/7 guarantee.

**Other hosts (snippets; prices not confirmed on primary pages):**
- **Fly.io:** shared-cpu-1x with 256 MB is listed at $2.19/month. A 2026-10-01 memory price rise to $6.00 per GB-month was reported via a GitHub issue and not opened on Fly's own page [21].
- **Railway:** Hobby is $5/month with $5 of usage included. Compute rates conflict across Railway docs pages ($20 or $50 per vCPU-month) [22].
- **Render:** a Starter background worker is $7/month (512 MB, 0.5 vCPU) and is always on. Render's own text says workers have no free tier [23].
- **Hetzner:** CAX11 was raised to €5.99/month for new orders (June 2026), and one source says cost-optimized CX/CAX plans were "Currently not available" in late September or October [24]. The February estimate of $3-5 per month is stale.
- **Oracle Always Free:** third-party sources conflict on the ARM allowance (4 OCPU / 24 GB versus 2 OCPU / 12 GB) and on idle reclaim thresholds. "Out of capacity" errors and account holds are common complaints [25]. Not recommended for a service we promise to keep up.

## 4. API limits that shape the adapter (repo, backend main = 0.15.5 config)

- **Message:** content up to 2000 characters. `message_embeds = 5` in the config, but the edit payload validates up to 10 embeds [2].
- **Attachments:** 5 per message, 20,000,000 bytes per file, 20,000,000-byte body limit. This is the same for new and default users [2].
- **Embed fields** (`SendableEmbed`): title up to 100 characters, description up to 2000, `colour` up to 128, icon URL and media. There are no fields [2].
- **Edits:** `DataEditMessage` takes only `content` and `embeds`, so a placeholder cannot gain an attachment [2].
- **Masquerade:** name 1-32 characters, avatar URL up to 256, colour up to 128 (needs ManageRole) [2].
- **Reactions:** `message_reactions = 20` [2].
- **Rate limit buckets** (`ratelimits.rs`): messaging (POST `/channels/{id}/messages`, per channel) 10, channels 15, bots 10, users 20, servers 5, default 20 [2]. The window length was not read from code; 07's "10 per 10 s" is plausible but not re-verified here.
- **Upload flow:** the CDN upload with `X-Bot-Token` was not re-verified. It remains as in 07.

## 5. Net assessment for un-parking

Nothing in the last week changes 07's decision logic. Interactions are unchanged, FFXIV demand on Stoat is one 53-member server, and the gateway rewrite is in flux with its bot compatibility unknown. If un-parked anyway, a plain VPS or Fly machine (about $2-6/month) is simpler and cheaper than Containers or a Durable Object relay. A Durable Object relay is possible but needs the alarm watchdog and cuts against the no-Node-built-ins posture. Start with a half-day smoke test on stoat.js 7.3.6, and re-test after the gateway cutover.

## Sources
[1] https://github.com/stoatchat/stoatchat/releases (fetched 2026-10-11)
[2] Repo read: /home/user/stoatchat/stoatchat (shallow clone of main, 2026-10-11) — `version.txt`; `Revolt.toml` [features.limits]; `crates/core/models/src/v0/messages.rs`; `crates/delta/src/util/ratelimits.rs`; `crates/core/database/src/models/bots/model.rs`
[3] https://github.com/stoatchat/gateway (README; fetched 2026-10-11)
[4] Clone /home/user/stoatchat/gateway, `git log` (commits 2026-09-28 to 2026-10-11)
[5] Clone /home/user/stoatchat/sdk (javascript-client-sdk), `git log` and package.json (7.3.7)
[6] https://registry.npmjs.org/stoat.js and https://registry.npmjs.org/revolt.js (fetched 2026-10-11)
[7] https://github.com/stoatchat/discussions/discussions/483 (fetched 2026-10-11)
[8] https://statusgator.com/services/stoat (search snippets; snapshot 2026-10-10)
[9] 07-2026-10-refresh.md §4 sources [34][47]
[10] Search "Stoat Online Safety Act Ofcom" (2026-10-11): nothing naming Stoat
[11] https://github.com/orgs/stoatchat/repositories (fetched 2026-10-11)
[12] https://stoatservers.com/tag/ffxiv and https://stoatservers.com/server/01KH2HWGT8WRFYCCYXJN4T1QA0 (search snippets, 2026-10-11)
[13] https://github.com/stoatchat/awesome-stoat (fetched 2026-10-11)
[14] https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/durable-objects/best-practices/websockets.mdx (fetched 2026-10-11)
[15] https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/ (search snippet)
[16] https://github.com/ojiverse/datawarehouse/issues/18
[17] https://github.com/cloudflare/workerd/issues/6774
[18] https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/ and https://developers.cloudflare.com/changelog/post/2026-09-30-durable-object-scheduling-policy/ (search snippets)
[19] https://developers.cloudflare.com/containers/pricing/ (search snippet)
[20] https://developers.cloudflare.com/containers/platform-details/architecture/ and https://developers.cloudflare.com/containers/container-class/ (search snippets)
[21] https://fly.io/docs/about/pricing/ (snippet) and https://github.com/robhunter/agentdeals/issues/2247
[22] https://docs.railway.com/reference/pricing/plans (snippet)
[23] https://render.com/pricing.md (snippet)
[24] https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ (snippet) and https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/
[25] https://braindetox.kr/en/posts/oracle_always_free_tier_reduced_2026.html and https://servercompass.app/blog/oracle-cloud-free-tier-changes-migrate-to-low-cost-vps (snippets)


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Stoat | tiny — One FFXIV server on stoatservers.com: 53 members, 11 online, created 2026-02-10 (ULID), last bumped about 5 months ago. awesome-stoat lists no FFXIV bot. English and Japanese searches found no FC or linkshell moving to Stoat. Discover was not readable (domain blocked), so this is not exhaustive. | Poor. Persistent WebSocket only, no HTTP push. A Node host is the natural fit. A DO relay is possible with an alarm watchdog. | watch. Do not un-park on demand evidence. If un-parked for privacy reasons, run the half-day stoat.js 7.3.6 smoke test first, and re-test after the Elixir gateway cutover. | 5-6.5 for T1 parity incl. 2-2.5 shared extraction (07 estimate, unchanged) | No interactions movement since 2022 (#483 has no team reply, interactions_url is stored but never dispatched). Bot compatibility with the new gateway is unverified. Cost is about 5-6.5 weeks for T1 parity. The project is healthy and very active (gateway commits through 2026-10-11, SDK change 2026-10-06), so keeping the archive tag option open is cheap. |
| Cloudflare Durable Object relay | n/a — n/a | Native to the Workers stack but needs a watchdog; stoat.js Node-builtin-free status unverified. | skip unless staying Workers-only matters. Needs a spike first. | +1-2 over a plain Node host (estimate) | Docs confirm an outbound WebSocket keeps the DO alive for at most 15 minutes (changelog 2026-06-19), no hibernation, and alarms or later I/O extend it. Inbound-frame behavior is undocumented, and a workerd issue shows runtime teardown cases. Reconnect, resume, and a watchdog alarm are mandatory. 07's Free-plan GB-s arithmetic was not re-checked. |
| Cloudflare Containers | n/a — n/a | Same account and tooling; weaker 24/7 guarantees than a VPS. | spike only if consolidating on Cloudflare is a goal. Not first choice. | +1 over plain Node host (estimate) | GA since 2026-04-13. Derived 24/7 cost is about $2 (lite, 256 MiB) or about $7.2 (basic, 1 GiB) per month, plus the $5 Workers Paid base. But the idle timeout defaults to 10 minutes and a background socket does not renew it, host restarts can stop instances with no guaranteed run time, disk is ephemeral, and I found no cold-start figures. It needs a Worker-plus-container wrapper to keep it alive. |
| Fly.io | n/a — n/a | External to Cloudflare; talks to Workers over HTTP. | build-if-asked. Best simple always-on host pending price confirmation. | 0.5 (Dockerfile, CI deploy) | shared-cpu-1x 256 MB listed at $2.19/mo (snippet); Oct 2026 memory price rise reported secondhand, so 512 MB (needed for resvg and fonts) is likely about $3-4/mo, which is my estimate. Dockerfile plus a long-running Machine fits a gateway-style bot. |
| Railway | n/a — n/a | External. | skip. Equivalent to Fly with murkier pricing. | 0.5 | Hobby $5/mo includes $5 usage; compute rates conflict across docs pages ($20 vs $50 per vCPU-month), so true cost is unconfirmed. |
| Render | n/a — n/a | External. | skip. Costlier than Fly. | 0.5 | Starter background worker $7/mo, always on; no free tier for workers. |
| Hetzner VPS | n/a — n/a | External; needs patching and monitoring by us. | build-if-asked, subject to stock. Cheapest durable option, but the February $3-5 figure is stale. | 0.5-1 incl. setup and runbook | CAX11 raised to EUR 5.99/mo for new orders from 2026-06-15; one source says CX/CAX plans were unavailable in late Sep/Oct and provisioning was limited since 2026-06-26. You maintain the OS, Node and systemd yourself. |
| Oracle Cloud Always Free | n/a — n/a | External. | skip. | 1 incl. capacity hunting | Free, but sources conflict on the allowance (4 OCPU/24 GB vs 2 OCPU/12 GB) and the idle-reclaim threshold; 'out of capacity' and account holds are common. Too brittle for a bot with users. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| C1 | No Stoat backend release after v0.15.7 (2026-09-25); v0.15.6 (2026-09-24) is the gateway dual-write test build; backend main still version.txt 0.15.5. | primary | https://github.com/stoatchat/stoatchat/releases | accessed 2026-10-11 |
| C2 | Elixir gateway repo stoatchat/gateway is active (202 commits, 31 in 2026-09-28..2026-10-11, newest 2026-10-11), has no releases, and makes no wire-compatibility claim beyond 'like Bonfire' port 14703. | primary | https://github.com/stoatchat/gateway | accessed 2026-10-11 |
| C3 | stoat.js npm latest is 7.3.6 (2026-01-16); SDK repo javascript-client-sdk package.json says 7.3.7, last commit 2026-10-06 'Increase event websocket reliability (#198)'; revolt.js frozen at 7.2.0 (2025-05-12). | primary | https://registry.npmjs.org/stoat.js | accessed 2026-10-11 |
| C4 | Interactions request is discussion #483 in stoatchat/discussions (posted 2022-07-17, 3 comments, last 2025-05-15, no visible team reply). Backend stores bot interactions_url but no code dispatches to it; message 'interactions' only restricts reactions. | repo | /home/user/stoatchat/stoatchat/crates/core/database/src/models/bots/model.rs:33 | 2026-10-11 |
| C5 | Message limits from Revolt.toml: content 2000 chars, 5 attachments, 20 MB per file, 20 MB body, 5 embeds (edit payload allows up to 10), 20 reactions, 5 replies. Embed: title 100, description 2000, no fields. Masquerade name 32, avatar URL 256. | repo | /home/user/stoatchat/stoatchat/crates/core/config/Revolt.toml:234-335 | 2026-10-11 |
| C6 | Rate-limit bucket for POST /channels/{id}/messages is 'messaging' with limit 10; channels 15, bots 10, users 20, servers 5, default 20. | repo | /home/user/stoatchat/stoatchat/crates/delta/src/util/ratelimits.rs | 2026-10-11 |
| C7 | FFXIV on Stoat: one server 'FFXIV' with 53 members and 11 online (members/online snapshot), last bumped about 5 months ago; its ULID decodes to creation 2026-02-10. | snippet | https://stoatservers.com/server/01KH2HWGT8WRFYCCYXJN4T1QA0 | accessed 2026-10-11 |
| C8 | awesome-stoat lists no FFXIV or game-data bot; searches (English and Japanese) found no FC or linkshell migrating to Stoat. | primary | https://github.com/stoatchat/awesome-stoat | accessed 2026-10-11 |
| C9 | Cloudflare DO docs: an open outbound WebSocket prevents eviction for up to 15 minutes; outgoing sockets do not hibernate; later I/O can extend time in memory; alarms prevent hibernation. Whether inbound frames reset the timer is undocumented. | primary | https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/durable-objects/best-practices/websockets.mdx | accessed 2026-10-11 (changelog 2026-06-19) |
| C10 | Cloudflare Containers GA on 2026-04-13 (Workers Paid); durable_object scheduling policy is public beta (2026-09-30). Docs: default idle timeout 10 min, SIGTERM then SIGKILL after 15 min, host restarts can stop running instances, no guaranteed run duration, ephemeral disk. | snippet | https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/ | 2026-04-13 |
| C11 | Containers rates: $0.0000025/GiB-s memory, $0.000020/vCPU-s active CPU, $0.00000007/GB-s disk; lite 256MiB, basic 1GiB. Derived 30-day cost about $2.0 (lite) or $7.2 (basic) plus $5 Workers Paid base. | snippet | https://developers.cloudflare.com/containers/pricing/ | accessed 2026-10-11 |
| C12 | Fly.io shared-cpu-1x 256MB listed at $2.19/mo; a 2026-10-01 memory price increase ($6.00/GB-month) is reported secondhand. | snippet | https://fly.io/docs/about/pricing/ | accessed 2026-10-11 |
| C13 | Render Starter background worker $7/mo always on, no free tier for workers; Railway Hobby $5/mo including $5 usage with conflicting rate pages; Hetzner CAX11 EUR 5.99 for new orders from 2026-06-15 and CX/CAX reported unavailable in late Sep/Oct; Oracle Always Free limits and reclaim policy disputed. | snippet | https://render.com/pricing.md | accessed 2026-10-11 |
| C14 | No Ofcom action against Stoat found; official status aggregator snapshot on 2026-10-10 showed all systems operational and no major Sep/Oct outage found. | snippet | https://statusgator.com/services/stoat | 2026-10-10 |


## Corrections to the 2026-10-04 refresh

- 07 §4 says the FFXIV server count is 'two servers (53 and 6 members)'. Refinement: the 53-member server was created 2026-02-10 (ULID decode of 01KH2HWGT8...) and last bumped about 5 months ago, so it is neither new nor active (stoatservers.com, search snippet, 2026-10-11). The 6-member server was not re-found.
- 07 §4 says DO frames arriving on a client socket do not count as activity, cited as fact. Cloudflare's docs say only that an open outbound WebSocket prevents eviction for up to 15 minutes and that later I/O can extend it. Inbound-frame behavior is undocumented, so 07's statement is plausible but unconfirmed (websockets.mdx; changelog 2026-06-19).
- 07 §4 says Fly/VPS about $3-5/month, unchecked. Updated: Fly shared-cpu-1x 256 MB $2.19 (snippet) with an Oct 2026 memory rise reported; Hetzner CAX11 EUR 5.99 for new orders since 2026-06-15 and stock limited; Render $7; Railway $5 minimum.
- 07 §4 lists the Bot API 'interactions' requests as #483 from 2022. Confirmed, but #483 lives in stoatchat/discussions, not the backend repo (the backend repo's #483 is an unrelated CI PR). Last comment 2025-05-15, no team reply.
- 07 §4 'Embed text counts toward the 2,000-character cap' and '5 embeds per message' were not re-checked here. Config shows message_embeds = 5, but the edit payload (DataEditMessage) validates up to 10 embeds. Minor inconsistency to test in the smoke test.
- 07 marks the 'Elixir gateway bot compatibility' unverified. Still unverified. New data point: the gateway repo has no releases and 31 commits in the 14 days to 2026-10-11, so it is under active development.


## Open questions

- Does the new Elixir gateway keep Bonfire's wire protocol for bots (Authenticate, Ready, Message events, ping interval)? Answer by reading stoatchat/gateway lib/ against crates/bonfire, or by asking in the Stoat dev channels.
- How many members do Stoat's official Discover pages and API show for FFXIV-related servers right now? rvlt.gg and api.stoat.chat were unreachable from this environment, so the maintainer should check Discover by hand.
- What is the exact window length of the 10-message 'messaging' rate-limit bucket (crates/ratelimits)? Not read from code.
- Do inbound frames on a DO's outbound WebSocket reset the 15-minute eviction timer? Needs a spike or Cloudflare clarification.
- What are current confirmed prices on Fly.io's own pricing page after the 2026-10-01 update, and is Hetzner CAX/CX stock restored? Search snippets only.
- Containers cold-start time and whether a Worker-driven keep-alive can hold a container up 24/7 in practice (not documented; needs a spike).
- Will stoat.js 7.3.7 publish soon, and does it work with the new gateway? Check npm weekly.
