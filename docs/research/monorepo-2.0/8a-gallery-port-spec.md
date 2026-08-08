# 8A Gallery + 8S Flows — Community Presets port spec (distilled from the design project)

Source: `Presets Tool Directions.dc.html` + `PresetsScreen/PresetsDesktop/PresetsFlows.dc.html`
in design project `993f0c5c-05b9-439b-8047-66a9c5ab1bd6` (fetched 2026-08-08). CONFIRMED:
**8A Gallery is the Community Presets spec, with 8S as its shared flows; 8B (Shelf) and
8C (Bench) stay as the record.** Decided going in: community-first · curated is a category ·
voting stays · favourites become real local saves · submissions gain an example link.

The tool is Lit-based (`v4/preset-tool.ts` + `preset-card.ts` + `preset-detail.ts` +
`preset-submission-form.ts` / `preset-edit-form.ts`) with its own element styles — no
shadow-DOM/Tailwind trap here; restyle in place, keep Lit.

## The question the direction answers

Is a preset a post, a palette, or a place to start? 8A says **a post** — a picture-led feed
you vote on. The example link is the whole idea: it gets the top of the card and the top of
the page, and someone will actually look at a submission, which is what makes submitting
feel worth doing.

## Deltas between the drawn doc and shipped reality (build against reality)

- The doc's sample data says 42/44 curated presets; the shipped `presets.json` is
  **15 rows (v2.0.0, stainIDs)** after the Phase-1 migration. Never hardcode counts — tab
  badges and the offline strip's "the N official palettes are still here" read live counts.
- `PresetCategory` already lost `community` in Phase 1 (types + D1 + web literals). The
  five categories + All map 1:1 to the doc's rail. Sorts already match
  (`popular` / `recent` / `name`).
- The doc's `costOf` (vendor gil per dye) predates the Patch 7.5 vocabulary that 9C
  established. Palette cost uses the same honesty rules: sum vendor gil for
  consolidation-A dyes (216 each); B/C dyes are scrip/credit (named, never converted);
  coffer dyes are "not sold" with their acquisition named. The PALETTE COST note keeps the
  doc's two shapes: "All N are vendor stock — buy the whole palette for X gil." /
  "X of Y are vendor stock. {names} not sold — {acquisitions}."

## Layout (8A Gallery)

1. **Tabs**: Community (default) · Official · Saved · Mine, with live counts. Community
   holds worker submissions; Official is the curated set (a category now, not a chip);
   Saved is the local shelf; Mine is the user's submissions (signed-in only).
2. **Category rail** (desktop) / chip row (mobile): All · Aesthetics · Jobs · Seasons ·
   Events · Grand Companies, with per-category counts of the active tab's pool.
3. **Search** one field over names, dyes, tags; an applied search renders as a removable
   token chip. Sort is a cycling control: Most voted → Newest → A–Z.
4. **Cards, picture-led**, two states that must both look intentional:
   - With example link: image area on top (cached thumbnail when available — see backend),
     palette as a thin proportional band between image and name, then name, two-line
     description, byline avatar, category, age.
   - Without (most at launch; all 15 curated): the palette itself becomes the picture —
     full-bleed proportional gradient band with the `NO EXAMPLE LINK — PALETTE SHOWN`
     treatment from the doc.
   - Votes sit on the card face: `Vote · N` / `Voted · N` toggle (community only; curated
     shows Official, votes as —). Save toggle (`Save`/`Saved`) on the face too.
5. **Detail page** (route `/presets/{id}`, drawn as a real page not a modal): glamour link
   block at full width (or palette band), palette as a readable list — swatch · localized
   dye name · hex · short source · vendor price or "not sold" — the PALETTE COST note,
   tags, and a `TAKE THIS PALETTE INTO` handoff row (Harmony "Build around one of these" ·
   Comparison "Measure them against each other" · Gradient "Blend two of them" ·
   Accessibility "Check they stay distinct").
6. **Offline strip** — community-first makes an API outage empty the default tab, so the
   failure state is designed: `Community feed unavailable / The presets service is not
   responding. The {n} official palettes are still here.` The Official tab is what is left
   standing; Saved still works (local).
7. **Config sidebar sections** (presets tool): Feed (show example images · blend Official
   into the feed [off by default — the shipped mixing becomes opt-in] · hide palettes I
   cannot buy), Saved presets (show saved first · keep deleted presets), Result card
   fields, Account.

## Saved = local saves (the only offline-proof shelf)

The dead `showFavorites` toggle becomes a real store on CollectionService: works signed
out, works with the worker down, holds curated and community presets side by side. Store a
**snapshot** of the preset (id, name, description, dyes as stainIDs, category, author,
example link), not just an id — a saved preset whose author later deletes it survives with
a **tombstone state** (marked, not vanished), per the existing CollectionService tombstone
mechanism. Curated saves can re-resolve live; community saves render from snapshot when
the worker no longer has them.

## 8S shared flows (16A modals over the workspace)

Scrim starts below the browser chrome; round × close; one content column each.

- **Sign in · 460px**: headline "Browsing and saving work without an account.", the
  what-an-account-adds table (browse/save free ✓ · vote/submit gated ★, one vote per
  preset per account, name shown on card), Discord + XIVAuth provider buttons, privacy
  line ("display name and provider ID; no character data, no email, nothing sold").
- **Submit a preset · 560px**: live preview band (`HOW IT WILL LOOK` + DRAFT badge),
  fields Name (required, 40) · Description (required, 180) · Category (five values — the
  `community` option is already gone) · Tags (optional, 8, job abbreviations searchable) ·
  **Example link (NEW, optional)** — Eorzea Collection / Imgur / Flickr only, validated on
  blur not per keystroke, honest hint: the link is stored, never a copy of the image; if
  the author takes it down it disappears here too. Dyes 3–6 required, slot picker only —
  no hex field, no native picker: a preset has to be buyable, so every slot must be a real
  dye. Rules line: duplicates, code-of-conduct names, and unresolvable links bounce;
  expect a day.
- **My submissions · 620px**: stats row (PUBLISHED · TOTAL VOTES · AWAITING REVIEW), one
  row per submission with status chip — `LIVE` (green) · `IN REVIEW` (amber, note "Queued
  for moderation. Most submissions clear within a day.") · `NOT PUBLISHED` (red, with the
  actual rejection reason) — and actions View/Edit/Delete (LIVE), Edit/Delete (review),
  Edit/Resubmit/Delete (rejected). **The rejected state is the screen the shipped app
  never had** — a rejected submission currently just fails to appear, with the reason
  living only in the moderation worker.

## Backend contract (presets-api + moderation-worker)

- `example_link TEXT NULL` column on presets (D1 migration, user-run in deploy window).
  Server-side validation mirrors the client allowlist (host ∈ eorzeacollection.com,
  imgur.com, flickr.com; https; store the URL string only). Submission + edit + response
  shapes and `@xivdyetools/types` `CommunityPreset`/`PresetSubmission` gain the field.
- "My submissions" needs the author's own list including rejected rows **with the
  rejection reason** — extend the existing user-presets route/response if it lacks either.
- Moderation flow: reason entry already exists in moderation-worker; surface it to the
  author via the API response.
- **Thumbnails are a staged follow-up, not a blocker**: the card design survives absence
  by contract. When built: presets-api fetches the linked page's OG image on approval,
  caches to R2, serves `thumbnail_url`; cards use it when present. Never hotlink the
  target site from the browser.

## Localization rule

Chrome switches with the language picker; preset names, descriptions and tags are
user-submitted and stay in the language they were written in — never machine-localized.
The 15 curated presets are ours and already carry `preset.<id>.*` strings ×6 (Phase 1).
Strings for the 8A chrome (tabs, badges, offline strip, card labels, cost notes, handoff
row) and the 8S flows (sign-in gates/privacy, submit fields/hints/rules, submission
statuses/notes) ship ×6 — en/de/ja verbatim from the doc's UI / FLOW_L / STATUS_L blocks;
fr/ko/zh authored at port time.

## Cut / kept

CUT: the purple Community chip (tabs replace source-mixing), the config-sidebar
category/sort dropdowns (rail + cycling sort on the page), the dead `showFavorites`
switch, the detail page whose only working button was Copy Link. KEPT: voting (one per
preset per account), the submission → moderation pipeline, deep links (`?preset=` /
`/presets/{id}` on stainID-safe ids), Lit componentry.

## Staged implementation order

1. Spec (this file) + locale strings ×6.
2. Web tool rewrite: tabs/rail/search/sort, both card states, detail page, offline strip,
   saved shelf on CollectionService (snapshot + tombstone), config sections.
3. 8S modals on the 16A shell (sign-in, submit with example-link field UI, my submissions
   with status/reason rows).
4. presets-api: `example_link` migration + validation + response field; my-submissions
   reason exposure; types bump. (Migration script user-run.)
5. Thumbnail pipeline (R2) — follow-up; cards already honest without it.
