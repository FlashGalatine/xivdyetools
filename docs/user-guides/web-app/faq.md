# Frequently Asked Questions

**Common questions about the XIV Dye Tools web app**

---

## General Questions

### What is XIV Dye Tools?

XIV Dye Tools is a free web application for exploring FFXIV dye colors. It helps you find the perfect dyes for glamours, housing, and more.

### Do I need to log in?

No, you can use all tools without logging in. You can sign in with either **Discord** or **XIVAuth**,
which lets you:
- Submit, edit and delete your community presets
- Vote on presets

Favorites and saved palettes are stored in your browser and do not need a login.

### Is it free?

Yes, completely free with no ads.

### How accurate are the colors?

The colors are extracted from actual FFXIV game data and are highly accurate. However, in-game lighting and gear textures can affect how colors appear.

---

## Color Matching

### Why doesn't my match look right in-game?

Several factors affect in-game appearance:
- **Lighting** - Different zones have different lighting
- **Textures** - Some gear materials show colors differently
- **Monitor calibration** - Your display may differ from in-game

### What does Delta E mean?

Delta E measures perceptual color difference. Lower is better. On the default method (ΔE2000), match
results are labelled with four bands:

| ΔE2000 | Band | Meaning |
|--------|------|---------|
| under 5 | SAME | You would not tell them apart |
| 5 to 10 | CLOSE | A very good stand-in |
| 10 to 20 | NEAR | In the same family, but visibly different |
| 20 and up | FAR | A different colour |

Every other matching method has its own calibrated cut-offs on its own scale, so compare the band,
never the raw number, across methods. See the [Glossary](../../reference/glossary.md) for more.

### Can I match colors from screenshots?

Yes! Use the image upload feature in Palette Extractor. Note that screenshot colors may be affected by in-game lighting/effects.

---

## Presets

### How do I submit a preset?

1. Log in with Discord
2. Go to Community Presets
3. Click "Submit Preset"
4. Add 3-6 dyes and pick a category
5. Name and describe it
6. Submit

### Why was my preset rejected?

Presets may be rejected for:
- Inappropriate name/description
- Duplicate of existing preset
- Fewer than 3 dyes
- Rate limit exceeded (10/day max)

### How do I report a preset?

There is no in-app report button yet. If a preset needs attention, contact a moderator in the
[community Discord](https://discord.gg/5VUSKTZCe5) with the preset's name. Every submission passes an automated content check first: anything it flags waits for a moderator, and anything that clears it goes live at once — so please do report what slips through.

---

## Favorites & Saved Palettes

### Where is my data stored?

In your browser (localStorage), whether or not you are logged in. Clearing site data clears them, so
export what you want to keep.

### How many favorites can I have?

Maximum 40 favorites, and 50 saved palettes of up to 20 dyes each.

### Can I export my saved palettes?

Yes. Open any tool with a dye picker (Color Harmony, Dye Mixer, Gradient Builder, Dye Comparison or
the Accessibility Checker), expand the **Favorites** panel above the dye list, and press **Manage
Collections**. That window has **Export All** and **Import** buttons, plus a download button on each
individual palette. The file is plain JSON.

---

## Technical Issues

### The site isn't loading

Try:
1. Clear browser cache
2. Disable browser extensions
3. Try incognito/private mode
4. Try a different browser

### Colors look wrong

1. Check your monitor's color calibration
2. Try a different browser
3. Disable dark mode/night shift

### I can't log in

1. Make sure pop-ups are allowed
2. Clear cookies for the site
3. Try a different browser

---

## Discord Bot

### Is there a Discord bot?

Yes! Use `/about` or `/manual` in any server with the bot to see commands.

### How do I add the bot to my server?

The invite link is posted in the [community Discord](https://discord.gg/5VUSKTZCe5), and `/about` in
any server that already has the bot prints it too. The web app itself does not carry an invite link.

### Do favorites sync between web and Discord?

No. Web favorites and saved palettes live in your browser, and the bot's own `/favorites` /
`/collection` commands were removed in 5.0 — every bot result carries a share link that opens in the
web app instead.

---

## Data & Privacy

### What data do you collect?

- Discord ID (if logged in)
- Preset submissions and votes
- Anonymous usage analytics — **only if you turn them on**. The **Enable Analytics** switch under
  **Behaviour** in Advanced Settings (the gear icon) is off by default, and nothing is sent while
  it is off.

### Can I delete my data?

Yes, contact us via GitHub issues or Discord to request data deletion.

### Do you sell data?

No, never.

---

## Still Have Questions?

- **GitHub Issues**: Report bugs or request features
- **Discord**: Join the community server for help

---

## Related Documentation

- [Getting Started](getting-started.md) - New user guide
- [All Tools](../index.md) - Tool overview
