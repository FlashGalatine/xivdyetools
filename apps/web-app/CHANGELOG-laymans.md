# What's New

---

## Web-App Version 4.9.0 — April 28, 2026

### Patch 7.5 Is Here: Dye Consolidation Goes Live

FINAL FANTASY XIV Patch 7.5, TRAIL TO THE HEAVENS launched on April 28, 2026, consolidating 105 individual dye items into 3 marketable items on the market board. XIV Dye Tools has been ready for this for weeks, and the new behavior is now live for everyone.

- **Consolidated market prices** — the 105 affected dyes now share one of three market prices behind the scenes (Standard Spectrum Dye, Wide Spectrum #1 Dye, Wide Spectrum #2 Dye), matching how Square Enix has restructured the items in-game. You'll still see each individual dye in your tools — only the price lookup changes.
- **Faster price refreshes** — the web app makes far fewer market board API calls per refresh because consolidated dyes share a single price lookup instead of 105 separate ones.
- **Streamlined Price Settings** — the "Price Categories" panel (with checkboxes for base / craft / Allied Society / cosmic / special dyes) has been removed. Those buckets stopped being meaningful once consolidated dyes started sharing market IDs. The refresh button now lives directly above your prices, where it belongs.
- **Pure White, Jet Black, and unconsolidated dyes** — still priced individually, no change in behavior. Special dyes that aren't part of the consolidation continue to fetch their own prices.
- **All six languages supported on day one** — the three consolidated items display with their official Korean (`염료: 기본 색상` / `염료: 추가 색상 1` / `염료: 추가 색상 2`) and Chinese (`通用染剂` / `追加染剂1` / `追加染剂2`) names, alongside the existing English, Japanese, German, and French translations.

### What you don't need to do

Nothing. If you had market board pricing turned on before, it's still on. If you had specific dye categories ticked, those settings are gone — but pricing now applies to every relevant dye automatically, so you're not missing anything.

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
