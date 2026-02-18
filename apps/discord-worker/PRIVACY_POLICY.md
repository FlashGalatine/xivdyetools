# XIV Dye Tools Discord Bot - Privacy Policy

**Last Updated**: December 7, 2025

## 1. Introduction

This Privacy Policy explains how XIV Dye Tools Discord Bot ("the Bot", "we", "our") collects, uses, and protects your information when you use our services.

We are committed to protecting your privacy and being transparent about our data practices. This Bot is a fan-made community tool and is not affiliated with Square Enix.

## 2. Data We Collect

### Information Collected Automatically

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Discord User ID | Identify users for favorites, collections, voting, rate limiting | Until data deletion requested |
| Discord Username | Attribute community preset submissions | Until data deletion requested |
| User Locale | Provide localized bot responses | Until preference cleared |
| Guild ID / Channel ID | Process commands in context | Not stored (ephemeral) |

### Information You Provide

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Favorite Dyes | Save up to 20 favorite dye IDs | Until you remove them or request deletion |
| Collections | Up to 50 custom collections with names, descriptions, and dyes | Until you delete them or request deletion |
| Preset Submissions | Name, description, dyes, tags, category | Indefinitely (community content) |
| Votes | Your votes on community presets | Until you remove vote or request deletion |

### Rate Limiting Data

- Per-user, per-command counters stored in Cloudflare KV
- **Retention**: 70 seconds (automatic TTL expiration)

## 3. Data We Do NOT Collect

We explicitly do **not** collect:

- ❌ Message content (beyond command parameters)
- ❌ Personal information (email, real name, phone number)
- ❌ IP addresses (abstracted by Cloudflare Workers)
- ❌ Server membership lists
- ❌ Direct messages
- ❌ Voice data
- ❌ Images (processed in-memory, not stored)

### Image Processing

When you use `/match_image`, your uploaded image is:
1. Processed in-memory on Cloudflare's edge servers
2. Analyzed for dominant colors
3. **Immediately discarded** after processing
4. **Never stored** on our servers

## 4. How We Use Your Data

| Purpose | Data Used |
|---------|-----------|
| Provide Bot functionality | User ID, Guild ID, Channel ID |
| Save your preferences | User ID, Locale |
| Manage your favorites | User ID, Dye IDs |
| Manage your collections | User ID, Collection data |
| Community presets | User ID, Username, Preset content |
| Voting system | User ID, Preset ID |
| Prevent abuse | User ID, Rate limit counters |

## 5. Data Storage

### Where Your Data is Stored

| Service | Data Stored | Location |
|---------|-------------|----------|
| Cloudflare KV | Favorites, Collections, Preferences, Rate limits | Global edge network |
| Cloudflare D1 | Community presets, Votes, Moderation history | Cloudflare's database infrastructure |

All data is stored on Cloudflare's infrastructure. See [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/) for more information.

### Data Security

- All data transmitted over HTTPS
- No server-side sessions (stateless architecture)
- Access controlled via Discord authentication
- No plaintext password storage (we don't collect passwords)

## 6. Third-Party Services

The Bot integrates with these third-party services:

| Service | Purpose | Their Privacy Policy |
|---------|---------|---------------------|
| Discord | Bot platform, authentication | [Discord Privacy Policy](https://discord.com/privacy) |
| Cloudflare | Hosting, data storage (KV, D1) | [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/) |
| Universalis | FFXIV market board data | [Universalis](https://universalis.app/) |
| Perspective API | Content moderation (optional) | [Google Privacy Policy](https://policies.google.com/privacy) |

We do not sell, trade, or share your personal data with third parties for marketing purposes.

## 7. Your Rights

You have the right to:

### Access Your Data
- Use `/favorites` to view your saved favorites
- Use `/collection list` to view your collections
- Contact us to request a full data export

### Delete Your Data
- Use `/favorites remove` to remove favorites
- Use `/collection delete` to remove collections
- Contact us to request complete data deletion

### Request Full Data Deletion

To request deletion of all your data:

1. **Email**: FlashGalatineFGC@gmail.com
   - Subject: "XIV Dye Tools Privacy"
   - Include your Discord User ID
2. **Discord**: Join https://discord.gg/rzxDHNr6Wv and DM "Flash Galatine"

We will process deletion requests within 30 days.

## 8. Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Rate limit counters | 70 seconds |
| User preferences | Until deleted by user |
| Favorites | Until deleted by user |
| Collections | Until deleted by user |
| Community presets | Indefinitely (public content) |
| Votes | Until removed or account deletion |

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
