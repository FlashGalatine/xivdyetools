# Discord Bot FAQ

**Common questions about the XIV Dye Tools Discord bot**

---

## General Questions

### How do I add the bot to my server?

Visit the XIV Dye Tools website and click "Add to Discord" in the footer. You'll need the "Manage Server" permission.

### Is the bot free?

Yes, completely free with no premium features or paywalls.

### What servers is it available on?

The bot can be added to any Discord server. It's not limited to specific servers.

---

## Commands

### How do I see all commands?

Use `/manual` for a help overview, or type `/` and look for "XIV Dye Tools" in the command menu.

### Why isn't autocomplete working?

Autocomplete requires:
- The bot to be online
- You to wait a moment for suggestions
- Typing at least 2 characters

### Commands are slow. Why?

Image generation takes 1-3 seconds. Complex commands (like `/match_image`) may take longer.

---

## Dye Names

### I can't find a dye by name

Try:
- Using the autocomplete suggestions
- Partial names (e.g., "red" instead of "Dalamud Red")
- English names (even if using another language)

### Names don't match in-game

The bot uses the official localized names from FFXIV. If there's a mismatch:
- Check your `/language` setting
- Report the issue on GitHub

---

## Images & Colors

### Image colors don't match exactly

Several factors affect this:
- **In-game lighting** varies by zone
- **Gear textures** display colors differently
- **Monitor calibration** affects perception

### Can I use screenshots from FFXIV?

Yes! Use `/match_image` and upload your screenshot. Note that in-game lighting/effects affect the extracted colors.

---

## Favorites & Collections

### Where is my data stored?

Your favorites and collections are stored securely on our servers, linked to your Discord ID.

### Do favorites sync with the web app?

Yes! Log in to the web app with Discord, and your data syncs automatically.

### I lost my favorites!

Favorites are never deleted by us. Check:
- You're using the same Discord account
- The bot is online and responding
- Try `/favorites list` again

---

## Presets

### How do I submit a preset?

Use `/preset submit` with your dye names. Requires 2-6 dyes.

### Why was my preset rejected?

Common reasons:
- Inappropriate name/description
- Duplicate of existing preset
- Rate limit (10/day maximum)

### Can I delete my preset?

Contact a moderator or submit a request via GitHub issues.

---

## Rate Limits

### I'm getting rate limit errors

The bot has per-user limits:
- Image commands: 5/minute
- Standard commands: 15/minute
- Preset submissions: 10/day

Wait a moment and try again.

---

## Bot Issues

### Bot isn't responding

Check:
- Bot is online (check status)
- You have permission to use slash commands
- The server hasn't restricted bot commands

### Commands aren't showing up

If you just added the bot:
1. Wait up to 1 hour for commands to register
2. Try restarting Discord
3. Kick and re-invite the bot

### Images aren't displaying

Check:
- The bot has "Attach Files" permission
- The channel allows attachments
- Your Discord isn't blocking images

---

## Moderation

### Someone is abusing presets

Use the report feature on presets, or contact a moderator.

### How do I become a moderator?

Moderation is by invite only for trusted community members.

---

## Privacy

### What data do you collect?

- Your Discord ID
- Favorites and collections
- Preset submissions and votes
- Anonymous usage statistics

### Can I delete my data?

Yes, contact us via GitHub issues to request deletion.

---

## Still Need Help?

- **GitHub Issues**: Report bugs or problems
- **Discord Support**: Ask in the support server

---

## Related Documentation

- [Command Reference](command-reference.md) - All commands
- [Getting Started](getting-started.md) - First steps
- [Favorites & Collections](favorites-collections.md) - Saving dyes
