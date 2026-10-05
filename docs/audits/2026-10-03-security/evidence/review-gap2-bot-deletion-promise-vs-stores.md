# Review gap2-bot-deletion-promise-vs-stores (2026-10-03)

## 1. Entry points / authz
Scope is a policy-vs-stores reconciliation, not a route review. The deletion path is manual: PRIVACY_POLICY.md:154-161 (email / Discord DM, "within 30 days"). No route, command or runbook performs it: docs/operations has no deletion runbook (grep deletion/erasure over docs/operations, docs/maintainer = 0 hits); MODERATION.md covers ban/unban only. /preferences reset and /preset favorite remove are self-service (PRIVACY_POLICY.md:147-148).

## Store-by-store table
| Store (user id key) | Written at | Operator-deletable by id? | Policy says |
|---|---|---|---|
| Analytics Engine blob2 = user id | analytics.ts:90-92 | NO (no per-row delete; ~3 mo expiry) | §2 :51 says AE data "cannot be edited or deleted per user"; §8 :170 gives retention. §7 :154-161 "all your data" has no exception |
| KV usertrack:{date}:{id} | analytics.ts:223 | Yes by key, but date is part of the key; kv list prefix 'usertrack:' + suffix filter (30 d TTL, self-expires) | 30 d TTL disclosed :49,:169 |
| KV firstrun:v5:{id} | index.ts:787 | Yes, exact key | 180 d disclosed :30,:173 |
| KV prefs:v1:{id}, favorites keys | preferences.ts:277, preset-favorites.ts:56-60 | Yes, exact keys | disclosed |
| KV legacy i18n:user:{id}, budget:world:v1:{id} | read-only migration, preferences.ts:59-60,519-526 | Yes if present; not mentioned | policy silent (already filed discord-worker-core#c1) |
| D1 votes (user_discord_id) | schema.sql:120 | Yes (DELETE by user id) | :175 "until removed or account deletion" |
| D1 submission_events | 0011:17-23 | Yes, but 30 d prune per policy :177 | disclosed |
| D1 presets.author_discord_id/author_name | presets | Operator must anonymise/delete; presets "Indefinitely" :174 | :20 username "until data deletion requested" vs presets indefinite: ambiguous |
| D1 moderation_log (moderator_/target_discord_id), banned_users | 0013:91-100, 0003:12 | Yes, but retained deliberately | filed elsewhere (moderation-worker#c2, policy-bot-en#c5) |
| Discord channel copies (submission log embed: author name, preset text) | discord-worker index.ts:430-447 | NO from our side (operator can delete own channel messages manually; Discord retains) | policy silent |
| Workers Logs | off | n/a | :120 |

## 2. Positive controls
- Analytics blob3 stores guild/dm only, never guild id (analytics.ts:93-94).
- Persistent logging off, disclosed (PRIVACY_POLICY.md:120).
- Usertrack keys carry a 30 d TTL (analytics.ts:228) and firstrun a TTL (index.ts:791).
- All five translations carry the same 30-day promise and the AE caveat (ja:163, ko:163, zh:161, de:187, fr:161; "Analytics Engine" appears 4x in each).

## 3. Rejected
- usertrack/firstrun unfindable: rejected, exact key construction known; list by prefix works.
- Translation drift: rejected, all five say the same (grep above).
- Raw author mention in moderation embeds: not confirmed beyond author display name (index.ts:433,446); did not file a separate mention claim.
- Operations runbook absence as a security defect: handoff only.

## 4. Files covered
apps/discord-worker/PRIVACY_POLICY.md (+ .ja/.ko/.zh/.de/.fr grep of §7/§8 lines), src/services/analytics.ts, command-trace.ts (grep), preferences.ts (grep), src/index.ts (:425-470, :780-800), presets-api migrations 0003/0011/0013, schema.sql (grep), notification-service.ts (grep), docs/operations/* (grep), MODERATION.md (grep).

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/discord-worker/PRIVACY_POLICY.md:154-161 | §7 promises deletion of "all your data" within 30 days, but the Discord User ID in Analytics Engine blob2 cannot be deleted (admitted only at :51 and in §8 :170) and the Discord-channel copy of submissions is not covered. CORRECT the §7 text to carve out those two (six-file edit). |

## 6. Handoffs
- Documentation: add a deletion runbook to docs/operations listing exact KV keys (prefs:v1:, favorites, firstrun:v5:, legacy i18n:user:, budget:world:v1:), D1 statements (votes, submission_events, presets author fields) and the not-deletable stores.
- Documentation: policy :20 (username until deletion) vs :174 (presets indefinitely) should state that deletion anonymises author_name.
