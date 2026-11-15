# FINDING-040: Message-component (button) interactions bypass the per-user rate limiter
**Severity:** INFO · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `apps/discord-worker/src/index.ts:1482` — Message-component (button) interactions bypass the per-user rate limiter
- `apps/discord-worker/src/index.ts:1483` — Message-component interactions bypass the per-user rate limiter

## Evidence
- index.ts:1482-1489 `if (componentType === 2) { const kind = buttonKindOf(customId ?? ''); if (kind) trackButtonClick(env, ctx, logger, interaction, kind); return handleButtonInteraction(interaction, env, ctx, logger); }`; analytics.ts:253 `if (event.kind === 'button' || event.outcome === 'rate_limited') return;`
- Reach: A Discord user clicks a bot-posted copy_hex_/copy_rgb_/copy_hsv_ button repeatedly. Each click arrives as a signed MESSAGE_COMPONENT interaction at POST / (index.ts:846), then goes to handleComponent (index.ts:1471), and on to trackButtonClick and handleButtonInteraction with no checkRateLimit call.
- The claim is accurate. checkRateLimit is called only for commands (index.ts:954) and autocomplete (index.ts:1113), never in handleComponent (index.ts:1482-1489). The effect is bounded: trackCommandWithKV returns before any KV counter write when kind==='button' (analytics.ts:253), so each click costs one Analytics Engine write. rgb/hsv clicks add one KV prefs read (buttons/index.ts:73-84, bot-i18n.ts:38), and preview-image buttons check presetApi.isModerator before any API call (preview-image.ts:161). Discord's client-side throttling adds a further cap, so this is hardening only. Preconditions: The attacker needs a Discord account and a bot message that has copy buttons. Discord's own client and interaction throttling limits the click rate.
- Live state the repo cannot show: This depends on whether the Analytics Engine write volume and KV read quota on the deployed account matter, and the repo cannot show that.

## Fix
- Optionally add a cheap checkRateLimit(..., 'button') tier, a native RL binding, before trackButtonClick in handleComponent and fail soft with an ephemeral notice. Alternatively, record this as an accepted trade-off in docs/architecture/security-trade-offs.md, since the only effects are Analytics Engine writes and KV reads.

## Status
OPEN
