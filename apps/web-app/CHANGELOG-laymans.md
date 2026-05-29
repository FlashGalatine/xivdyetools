# What's New

---

## Web-App Version 4.10.1 — May 29, 2026

### Shared Link Embeds Now Show CJK Dye Names

When you copy a share link while using the app in Japanese, Korean, or Chinese and paste it into Discord, Twitter, or another platform that displays link preview cards, the dye names in the preview now appear in the correct script — `ブラック` instead of `Jet Black`, `제트 블랙` instead of `Jet Black`, and so on.

- **All six share-link card types updated** — Harmony Explorer, Gradient Builder, Dye Mixer, Swatch Matcher, Dye Comparison, and Accessibility Checker previews all benefit from this fix. Previously every localized embed silently fell back to English for the dye-name text.
- **The `?lang=` query parameter is what drives this** — the share links the app generates already included your language in the URL; what was missing was the font support on the image-generation side to actually render CJK text. That's now in place.

### What you don't need to do

Nothing. Existing share links that include `?lang=ja`, `?lang=ko`, or `?lang=zh` will show localized dye names as soon as the platform re-fetches the preview (typically within 24 hours or the next time someone shares the link fresh).

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
