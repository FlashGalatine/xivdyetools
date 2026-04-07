# What's New in Version 1.11.0

*Released: April 7, 2026*

---

## Under the Hood: Security & Stability

This release is a maintenance update — nothing changes from your perspective in how the tools look or work, but a lot happened behind the scenes to make XIV Dye Tools more secure and reliable.

- **More secure modals** — Internal popups and dialogs now use a safer construction method that eliminates a class of potential web security vulnerabilities. You won't notice any difference in how they work.
- **Request validation** — The servers behind the Discord bot and community presets now enforce stricter limits on incoming data (size limits, depth limits), making them more resilient to malformed or malicious requests.
- **Cleaner error handling** — Error responses from the bot and API servers no longer expose internal details, even if something unexpected goes wrong.
- **Shared infrastructure** — Request tracking and rate-limit reporting are now handled by a single tested shared library across all backend services, reducing the chance of inconsistencies.

---

## Patch 7.5 Dye Consolidation — Ready When You Are

- **Forward-looking preparation** — this release gets XIV Dye Tools ready for FFXIV Patch 7.5, where Square Enix is expected to consolidate 105 individual dye items into just 3 on the market board
- **Automatic handling** — when Patch 7.5 launches, our tools will handle the new consolidated items with no action needed on your end
- **Faster Discord bot responses** — the `/budget` command will make ~80% fewer market board API calls
- **Correct price mapping** — the web app will correctly map new consolidated items back to individual dyes
- **Nothing changes right now** — all existing tools and features continue to work exactly as before

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
