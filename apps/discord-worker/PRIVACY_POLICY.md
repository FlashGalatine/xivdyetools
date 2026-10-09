# XIV Dye Tools Discord Bot - Privacy Policy

> Also available in: [日本語](PRIVACY_POLICY.ja.md) · [Deutsch](PRIVACY_POLICY.de.md) · [Français](PRIVACY_POLICY.fr.md) · [한국어](PRIVACY_POLICY.ko.md) · [中文](PRIVACY_POLICY.zh.md). This English version is the authoritative text.

**Last Updated**: October 9, 2026

## 1. Introduction

This Privacy Policy explains how XIV Dye Tools Discord Bot ("the Bot", "we", "our") collects, uses, and protects your information when you use our services.

We are committed to protecting your privacy and being transparent about our data practices. This Bot is a fan-made community tool and is not affiliated with Square Enix.

## 2. Data We Collect

### Information Collected Automatically

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Discord User ID | Identify users for preferences, preset favorites, voting, rate limiting, and the first-run notice flag; also keys a daily per-user activity marker and is counted (never listed) in usage statistics — see *Usage Analytics* below | Until data deletion requested (usage-statistics records: see *Usage Analytics*) |
| Author name: your Discord display name (your username if you have no display name). A preset you submit on the web app after signing in with XIVAuth shows the name of your verified character instead, or "XIVAuth User" followed by the first 8 characters of your XIVAuth ID if no verified character is available when you sign in | Shown publicly as the author of community presets you submit | Until data deletion requested |
| User Locale | Provide localized bot responses; the Discord client language (bucketed to one of the six the Bot supports, or "other") is also recorded in usage statistics — see *Usage Analytics* below | Stored preference: until cleared. Usage-statistics bucket: see *Usage Analytics* |
| Guild ID / Channel ID | Process commands in context | Not stored. Usage statistics record only *whether* a command ran in a server or in a DM (the values `guild` / `dm`) — never the server's or channel's ID |

### Information You Provide

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Preferences | Language, blending mode, matching algorithm, result count, clan, gender, default world / data center, whether to show Market Board prices by default, color-display toggles, theme, and which dye categories to exclude from search results (metallic, pastel, dark, cosmic, Ishgardian, expensive, vendor-sold, crafted), plus the time you last changed them | Until you reset them or request deletion |
| Preset favorites | Up to 50 community presets you mark with `/preset favorite add` — the preset's id and the name it had when you saved it | Until you remove them or request deletion |
| First-run notice flag | A per-user marker that the 5.0 welcome notice was shown to you; carries no content | Expires automatically after 180 days |
| Preset Submissions | Name, description, dyes, tags, category — and, if our automatic check holds an edit's new name or description for review, the version from before the first such edit, kept until a moderator restores it or the preset is deleted | Until you delete it (in the web app's My Submissions, signed in with the same Discord account) or request deletion |
| Votes | Your votes on community presets. Submitting a preset counts as your vote for it; if a published preset already has the same dyes, your submission becomes a vote for that preset instead | Until you remove vote or request deletion |

### Rate Limiting Data

- Per-user, per-command counters are held by Cloudflare's Workers rate-limiting service for the 60-second window and are never written to KV.
- **Fallback**: on a deployment without the native rate-limiting bindings, the counters are kept in Cloudflare KV instead, under a key containing your Discord User ID and the command name, with a 120-second expiry. Both production and beta bind the native service, so this path is not in use there.
- The Bot never sees or uses your IP address for rate limiting — it identifies you by Discord User ID, because commands arrive from Discord's servers rather than from you directly.
- No third party is involved.

### Usage Analytics

To keep the Bot healthy and to power the `/stats` dashboard we record, for each command you run or copy button you press:

| Data | Where | Retention |
|------|-------|-----------|
| Command name and subcommand, whether it was answered and — if anything went wrong — a coarse failure class (rate-limited, request rejected by the preset or market service, market data unavailable, preset service unavailable, the uploaded image or `.chara` file could not be read, rendering failed, unknown; never an error message), how long it took, whether it ran in a server or a DM (`guild` / `dm` — never the server's ID), your Discord client language (one of the six the Bot supports, or "other"), which copy button you pressed (hex / RGB / HSV), and your Discord User ID (used only to count unique users) | Cloudflare Workers Analytics Engine | Cloudflare's Analytics Engine retention window (3 months at the time of writing) |
| Aggregate counters — total commands, per-command counts, successes/failures (no user data) | Cloudflare KV | 30 days (automatic TTL) |
| One key per user per day (`usertrack:{date}:{userId}`, value `1`) so daily active users can be counted | Cloudflare KV | 30 days (automatic TTL) |

These records never include message content, command option values, server names or channel IDs. Analytics Engine data cannot be edited or deleted per user once written; it expires on Cloudflare's schedule.

### Moderation Records

Community presets are moderated. To enforce bans and to keep moderation accountable, we keep:

- **Ban records.** If a moderator bans you from community presets, the ban record holds your Discord User ID or, if you signed in on the web app with an XIVAuth account that is not linked to Discord, the account ID our sign-in service gave you instead (a random identifier, not your XIVAuth ID), the author name shown on your presets at the time of the ban, the Discord User IDs of the moderator who issued the ban and of the one who lifted it, the reason the moderator gave, and the dates of the ban and of its lifting.
- **The moderation log.** Each moderation action is logged with the moderator's Discord User ID, the action, an optional reason, and the time. An action on a preset (such as approve, reject or revert) names the preset. A ban, unban, hide or restore also names the user it applied to.

How long each record is kept is listed under *Data Retention*.

## 3. Data We Do NOT Collect

We explicitly do **not** collect:

- ❌ Message content (beyond command parameters)
- ❌ Personal information (email, real name, phone number)
- ❌ IP addresses (abstracted by Cloudflare Workers)
- ❌ Server membership lists
- ❌ Direct messages
- ❌ Voice data
- ❌ Images (processed in-memory, not stored)
- ❌ `.chara` files (processed in-memory, not stored)
- ❌ Character names from `.chara` files (never displayed on cards or embeds, never stored)

### Image Processing

When you use `/extractor image`, your uploaded image is:
1. Processed in-memory on Cloudflare's edge servers
2. Analyzed for dominant colors
3. **Immediately discarded** after processing
4. **Never stored** on our servers

### Character Files

When you use `/swatch` or `/glamour`, your uploaded `.chara` file is:
1. Downloaded from Discord and read in-memory on Cloudflare's edge servers
2. Read for its colors, dyes and equipment
3. **Immediately discarded** after processing
4. **Never stored** on our servers

To name the gear, `/glamour` sends the equipment model numbers from the file and the id of its facewear to our own API, which looks them up in XIVAPI. Nothing else from the file is sent, and nothing about you or your Discord account.

## 4. How We Use Your Data

| Purpose | Data Used |
|---------|-----------|
| Provide Bot functionality | User ID, Guild ID, Channel ID |
| Save your preferences | User ID and the preference values you set |
| Manage your preset favorites | User ID, Preset ID |
| Community presets | User ID, author name (shown publicly), Preset content |
| Moderation | Ban records and moderation-log entries (see *Moderation Records*) |
| Voting system | User ID, Preset ID |
| Prevent abuse | User ID, Rate limit counters |
| Usage statistics (`/stats`) | Command name and subcommand, outcome class, latency, server-or-DM flag, client language bucket, copy-button kind, User ID (counted, never listed) |

## 5. Data Storage

### Where Your Data is Stored

| Service | Data Stored | Location |
|---------|-------------|----------|
| Cloudflare KV | Preferences, preset favorites, the first-run notice flag, usage counters and daily-activity keys (30-day TTL), and the rate-limit counters only on a deployment without the native rate-limiting bindings (120-second TTL) | Global edge network |
| Cloudflare D1 | Community presets, Votes, Moderation records (see *Moderation Records*), moderation-notification failure records, daily submission / edit counters (see *Data Retention*) | Cloudflare's database infrastructure |
| Cloudflare Workers Analytics Engine | Command usage telemetry (see *Usage Analytics*) | Cloudflare's analytics infrastructure |
| Discord | Posts in two private channels of our Discord server. The moderation channel gets each preset, edit or preview image that needs review: the post shows the preset (such as its name, description, category and dyes) and the author name, or, for a preview image, the preset's name and the image, and it is updated when a moderator decides. If a moderator bans you, the moderation channel also gets a post with your author name, the reason and how many of your presets were hidden. Moderators can also post the list of presets waiting for review, with their author names, in the moderation channel. The submission-log channel gets each preset published without review, with its author name, and a note naming the preset when a moderator approves, rejects or reverts one, with the reason for a rejection or a revert. Posts made after 2026-10-05 do not show your Discord User ID; posts made on or before that date may | Discord's infrastructure |

Everything except those Discord posts is stored on Cloudflare's infrastructure. See [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/) for more information. The Discord posts stay in those channels, under [Discord's Privacy Policy](https://discord.com/privacy), until a moderator deletes them or until you request deletion (see *Your Rights*).

### Data Security

- All data transmitted over HTTPS
- No server-side sessions (stateless architecture)
- Access controlled via Discord authentication
- No plaintext password storage (we don't collect passwords)

### Operational Logs

While handling a command the Bot can print short diagnostic lines. Two of them include **your Discord User ID** — one when a command starts, one when a command is rate limited — alongside the command name. They never include command option values, message content, server names, channel IDs, or anything from an uploaded image or `.chara` file.

Persistent log collection (Cloudflare Workers Logs) is switched **off** for the Bot, so these lines exist only in a live debugging stream a maintainer is watching at that moment, and are not retained afterwards. They are not a data store, are not queryable, and are separate from the usage analytics described above. If we ever enable persistent logging, this policy will be updated first.

## 6. Third-Party Services

The Bot integrates with these third-party services:

| Service | Purpose | Their Privacy Policy |
|---------|---------|---------------------|
| Discord | Bot platform, authentication | [Discord Privacy Policy](https://discord.com/privacy) |
| Cloudflare | Hosting, data storage (KV, D1), rate limiting, analytics | [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/) |
| Universalis | FFXIV market board data | [Universalis](https://universalis.app/) |
| XIVAPI | FFXIV item names for `/glamour` | [XIVAPI](https://xivapi.com/) |
| Perspective API | Content moderation (optional) | [Google Privacy Policy](https://policies.google.com/privacy) |

We do not sell, trade, or share your personal data with third parties for marketing purposes.

## 7. Your Rights

You have the right to:

### Access Your Data
- Use `/preferences show` to view your saved preferences
- Use `/preset favorite list` to view your favorited presets
- Contact us to request a full data export

### Delete Your Data
- Use `/preferences reset` to reset all your preferences, or `/preferences reset key:<preference>` to reset just one
- Use `/preset favorite remove` to remove a favorited preset
- Contact us to request complete data deletion

The first-run notice flag is not user-manageable — it expires on its own after 180 days.

### Request Full Data Deletion

To request deletion of all your data:

1. **Email**: FlashGalatineFGC@gmail.com
   - Subject: "XIV Dye Tools Privacy"
   - Include your Discord User ID
2. **Discord**: Join https://discord.gg/rzxDHNr6Wv and DM "Flash Galatine"

We will process deletion requests within 30 days. A deletion request also removes the posts about you and your presets from our Discord server, except the post about a ban that is still active. An active ban record is not deleted on request; once the ban is lifted, the record follows the retention under *Data Retention*.

## 8. Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Rate limit counters | 60 seconds (120 seconds on a deployment without the native rate-limiting bindings) |
| Usage counters (Cloudflare KV) | 30 days |
| Daily per-user activity keys (Cloudflare KV) | 30 days |
| Command usage telemetry (Analytics Engine) | Cloudflare's Analytics Engine retention window (3 months at the time of writing) |
| User preferences | Until deleted by user |
| Preset favorites | Until removed by you |
| First-run notice flag | 180 days |
| Community presets | Until you delete them (web app → My Submissions) or request deletion |
| Votes | Until removed or account deletion; also deleted when the preset is deleted |
| Moderation-notification failure records (preset id, error, timestamps) | 30 days after resolution, 90 days if unresolved — deleted immediately if the preset is deleted |
| Daily submission / edit counters (user id, kind, preset id, timestamp) | 30 days |
| Ban records | While the ban is active. When it is lifted, the author name and the reason are cleared from the record at once, and the record is deleted 90 days later |
| Moderation-log entries for a ban, unban, hide or restore (these keep the moderator's reason) | 12 months, or sooner for a hide or restore if its preset is deleted |
| Other moderation-log entries about a preset (such as approve, reject or revert) | As long as the preset exists |
| Moderation-channel and submission-log posts in our Discord server | Until a moderator deletes them, or until you request deletion (the post about a ban that is still active stays) |

## 9. Children's Privacy

The Bot is intended for users who meet Discord's minimum age requirement (13 years or older, or the minimum age in your country). We do not knowingly collect data from children under these age limits.

If you believe a child under the minimum age has provided us data, please contact us for removal.

## 10. International Data Transfers

Your data may be processed in any country where Cloudflare operates edge servers. By using the Bot, you consent to this transfer. Cloudflare maintains appropriate safeguards for international data transfers.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be:

- Posted to this document with an updated "Last Updated" date
- Announced in our Discord server for significant changes

Continued use of the Bot after changes constitutes acceptance of the updated policy.

## 12. Contact

For privacy-related questions or data requests:

- **Email**: FlashGalatineFGC@gmail.com (Subject: "XIV Dye Tools Privacy")
- **Discord**: https://discord.gg/rzxDHNr6Wv
- **Support Channel**: #dyetools-issues-and-suggestions

---

**By using XIV Dye Tools Discord Bot, you acknowledge that you have read and understood this Privacy Policy.**
