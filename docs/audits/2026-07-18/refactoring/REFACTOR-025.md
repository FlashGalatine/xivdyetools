# [REFACTOR-025]: Moderation-notification embed builder exists in three divergent copies

## Priority
LOW

## Category
Duplication / consistency (single-source embed construction)

## Location
- `apps/discord-worker/src/index.ts:186-260` (webhook path — sanitized, field-based embed + button row)
- `apps/discord-worker/src/handlers/commands/preset.ts:951-1006` (`notifyModerationChannel` — unsanitized, description-based embed + button row)
- `apps/discord-worker/src/handlers/commands/preset.ts:1011-1076` (`notifyEditModerationChannel` — edit-diff variant + button row)

## Current State
Three hand-rolled builders produce the "pending preset" moderation-channel embed with approve/reject buttons (`preset_approve_{id}` / `preset_reject_{id}`). They differ in layout (fields vs. markdown description), in sanitization (webhook path sanitizes, submit/edit paths do not — BUG-072), and each embeds its own copy of the button row.

## Issues
- Any fix to BUG-009 (which application posts these messages / whether buttons should exist) must be applied in three places.
- Sanitization inconsistency (BUG-072) is a direct product of the duplication — the hardened copy and the raw copies drifted.
- Moderators see two different embed layouts for the same event type depending on the submission source (web vs. Discord).

## Proposed Refactoring
Extract a single builder, e.g. in a `handlers/commands/preset/notifications.ts` module (or the shared package from REFACTOR-010):
```ts
export function buildModerationEmbed(
  preset: CommunityPreset,
  opts: { kind: 'new' | 'edit'; original?: CommunityPreset; adminT: Translator }
): { embeds: DiscordEmbed[]; components: DiscordActionRow[] }
```
with sanitization (`sanitizePresetName`/`sanitizePresetDescription`) applied unconditionally inside, and the button row (or its removal, per the BUG-009 resolution) defined exactly once. All three call sites collapse to `sendMessage(token, channel, buildModerationEmbed(...))`.

## Benefits
- BUG-009 and BUG-072 become one-place fixes.
- Uniform moderator UX regardless of submission source.
- ~120 lines of duplicated embed literals removed.

## Effort Estimate
Small — a few hours including test updates (existing tests assert embed shape; point them at the shared builder).

## Risk Assessment
Minimal. Embed content changes are cosmetic to Discord; the only care point is keeping `custom_id` formats byte-identical until BUG-009 decides their fate.

> Source: evidence/bot-workers-analysis.md (2026-07-18 deep-dive, bot-workers area)

## Status

**DONE 2026-07-19** — single `buildModerationNotification`/`sendModerationNotification` in preset-notifications.ts; all three call sites collapsed onto it (sanitization + button policy live in exactly one place).
