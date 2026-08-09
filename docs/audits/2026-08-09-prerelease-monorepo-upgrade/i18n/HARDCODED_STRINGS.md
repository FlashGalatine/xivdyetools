# Hardcoded String Extraction Report — 2026-08-09

**Scan date:** 2026-08-09
**Scope:** `apps/web-app/src` (222 files) — with spot checks across `packages/bot-logic` and the Workers
**Hardcoded user-facing strings found:** **4**, all in a single component

---

## Summary by Priority

| Priority | Count | Action |
|----------|-------|--------|
| 🔴 High | 4 | Extract — 3 have locale keys already authored ×6 |
| 🟡 Medium | 0 | — |
| 🟢 Low | 0 | — |
| ⚪ Skip | — | console/debug/test strings, CSS class names, technical identifiers |

**The i18n discipline in this codebase is strong.** A scan for hardcoded English across all 17
`components/v4/` files returned essentially nothing — every button label, heading, placeholder
and `aria-label` routes through `LanguageService.t()`. All four findings are in one component
(`preset-detail.ts`), which reads as a single missed pass rather than a systemic gap.

---

## High Priority Extractions

All four live in the same action bar:
[apps/web-app/src/components/v4/preset-detail.ts](../../../../apps/web-app/src/components/v4/preset-detail.ts)

### [HC-001] "Copy Link" button label
**File:** `preset-detail.ts` · **Line:** 981

```ts
// Current (hardcoded)
<button class="action-btn share-btn" @click=${this.handleShare}>
  <span class="icon">${unsafeHTML(ICON_LINK)}</span> Copy Link
</button>

// Recommended
<button class="action-btn share-btn" @click=${this.handleShare}>
  <span class="icon">${unsafeHTML(ICON_LINK)}</span> ${LanguageService.t('preset.copyLink')}
</button>
```

**New key needed** — author ×6:
```json
{ "preset.copyLink": "Copy Link" }
```

---

### [HC-002] "Voted (n)" state label
**File:** `preset-detail.ts` · **Line:** 993

```ts
// Current
html`✓ Voted (${this.currentVoteCount})`

// Recommended — the key already exists in all six locales
html`✓ ${LanguageService.t('preset.votesCount', { count: this.currentVoteCount })}`
```

**⚠️ No new key required.** `preset.voteCount` and `preset.votesCount` are **already authored in
all six locale files** — they are simply never called. The translations exist and are shipping
dead.

This also matters for correctness beyond language: the hardcoded form has no singular/plural
handling. The existing key pair does. The design record is explicit about why that matters:

> **Counts live inside locale strings as functions of `n`** (`contrastTitle(n)`,
> `pairsLabel(n)`) — position and classifier differ per language. Any string with a number in
> it is a template.

---

### [HC-003] "Vote (n)" button label
**File:** `preset-detail.ts` · **Line:** 995

```ts
// Current
html`${unsafeHTML(ICON_CRYSTAL)} Vote (${this.currentVoteCount})`

// Recommended
html`${unsafeHTML(ICON_CRYSTAL)} ${LanguageService.t('preset.voteCount', { count: this.currentVoteCount })}`
```

**No new key required** — same authored pair as HC-002. Select `voteCount` vs `votesCount` by
count, or route both through one template if the locale engine handles plural selection
internally.

---

### [HC-004] Raw category slug rendered as a user-facing label
**File:** `preset-detail.ts` · **Line:** 880

```ts
// Current — prints the machine value
${unsafeHTML(getCategoryIcon(this.preset.category))} ${this.preset.category}
```

This renders the literal enum value — **`grand-companies`**, kebab-case and untranslated — to
the user, in every language.

```ts
// Recommended
${unsafeHTML(getCategoryIcon(this.preset.category))} ${LanguageService.t(`preset.category.${this.preset.category}`)}
```

**Keys needed** — five, matching the live `PresetCategory` union
(note: **not** `community`, which 5.0 retired — see [BUG-001](../bugs/BUG-001.md)):

```json
{
  "preset.category.jobs":            "FFXIV Jobs",
  "preset.category.grand-companies": "Grand Companies",
  "preset.category.seasons":         "Seasons",
  "preset.category.events":          "FFXIV Events",
  "preset.category.aesthetics":      "Aesthetics"
}
```

Before authoring, **check whether an equivalent key set already exists** — the submission form
(`preset-submission-form.ts:363`) renders category buttons via `LanguageService.t(cat.labelKey)`,
so a `labelKey` convention is already in use. Reuse it rather than creating a parallel set:

```bash
grep -rn "labelKey" apps/web-app/src | head
grep -n "\"category\"" apps/web-app/src/locales/en.json
```

This is the highest-value of the four — it is the only one that renders an obviously
machine-generated string to end users.

---

## Files Requiring Changes

| File | Hardcoded count | Priority |
|------|-----------------|----------|
| `apps/web-app/src/components/v4/preset-detail.ts` | 4 | High |

---

## What Was Checked and Found Clean

| Surface | Method | Result |
|---------|--------|--------|
| `components/v4/` (17 files) | regex for text between tags, `aria-label=`, `title=`, `placeholder=` starting with a capital | **0 hits** beyond the four above |
| Legacy top-level components | same scan | **0 hits** — all route through `LanguageService.t()` |
| `packages/bot-logic` commands | locale-key usage | **Clean** — 615 keys ×6, no inline English |
| Worker responses | error/status text | **Clean** — machine-readable `ErrorCode` enums, not prose |
| Console / debug / test strings | — | **Correctly skipped** — developer-only, not for extraction |

---

## Recommendations

1. **Fix HC-002 and HC-003 first — they are free.** The locale keys are authored in all six
   languages and simply are not called. This is a two-line change that activates translations
   already paid for.
2. **HC-004 is the highest user impact** — it is the only finding that shows a raw enum slug in
   the UI. Reuse the existing `labelKey` convention rather than authoring a parallel key set.
3. **HC-001 needs one new key ×6.** Author it with the curated-preset string pass if one is
   still open, so the translator does one round trip rather than two.
4. **Add an ESLint rule** (`lit/no-literal-text` or an equivalent custom rule scoped to
   `components/`) to prevent recurrence. With only four violations repo-wide, the rule can be
   turned on at `error` almost immediately — the cost of adopting it is near zero and it closes
   the class permanently.

---

## Sequencing

These edits change **locale content**, so they must land **before** the font sprint —
`FONT-001`'s re-subsetting depends on the final character inventory, and HC-001/HC-004 add new
translated strings whose characters must be in the subsets.

For the web app specifically the coupling is weak (browser fonts, not subsets), but the rule
holds for the release as a whole: **all locale text changes first, font subsetting last.**
