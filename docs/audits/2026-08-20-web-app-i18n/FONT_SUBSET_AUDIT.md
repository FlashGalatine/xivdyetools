# Font / Script Coverage — web-app — 2026-08-20

**Scope:** `apps/web-app` only. The CJK subset fonts live in `discord-worker` and `og-worker` (last verified 2026-08-09: og-worker 100 % coverage; discord-worker re-subset in sprint 1 of that plan) — not re-scanned here.

---

## Non-Latin script summary (web-app locale files)

| Locale | Scripts present | Font path |
|--------|-----------------|-----------|
| ja | Hiragana, Katakana, CJK Unified, CJK punctuation, fullwidth forms | `--font-cjk` (local families) |
| ko | Hangul Syllables, CJK punctuation | `--font-cjk` |
| zh | CJK Unified, CJK punctuation, fullwidth forms | `--font-cjk` |
| de, fr | Latin-1 / Latin Extended-A (ä ö ü ß é è ç œ …) | Space Grotesk / Onest / Fragment Mono (self-hosted woff2) — cover Latin Extended |

**No subset fonts exist in the web-app, by design.** `src/styles/globals.css:81` declares

```css
--font-cjk: 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans KR', 'Hiragino Sans', 'Yu Gothic UI', 'Microsoft YaHei', 'Malgun Gothic';
```

— every name is a *locally installed* family; nothing is downloaded and the CSP `font-src` is `'self'`. So there is no glyph-coverage question for the web-app: whatever the OS has, renders. ✅ No missing glyphs, no stale subsets.

---

## Findings

### FONT-WEB-001 · Han-unification: `--font-cjk` puts Noto Sans **JP** first for *every* locale 🟢 Low
`--font-cjk` is one ordered list used for ja, ko **and zh**. A Simplified-Chinese user who has both Noto Sans JP and Noto Sans SC installed (common on dev machines, and on any machine that has Google Noto CJK installed as a family pack) gets Han characters drawn with **Japanese glyph forms** (骨, 直, 曜, 令, 糸 …) because the JP face matches first and has the codepoint. Korean users see the same for the Hanja that appear in ko strings (few, but present: the ko locale contains CJK Unified codepoints).

The `:lang()` hook already exists — `LanguageService.setLocale` sets `document.documentElement.lang` precisely so "`:lang()` CSS (CJK mono-label fallback) can match" — but only `modal-container.ts:119-120` uses it today.

**Fix (CSS only, ~6 lines):**
```css
:root:lang(zh) { --font-cjk: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans JP', 'Noto Sans KR'; }
:root:lang(ko) { --font-cjk: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans JP', 'Noto Sans SC'; }
/* ja keeps the current order */
```
This mirrors how `FONTS.cjk` would be chosen per-locale in `packages/svg` for the card renderers, and costs nothing when the families are absent.

### FONT-WEB-002 · Font stack ordering — verified OK ✅
| Context | Stack | CJK fallback |
|---------|-------|--------------|
| `--font-display` | Space Grotesk → `--font-cjk` → system | ✅ |
| `--font-body` | Onest → `--font-cjk` → system | ✅ |
| `--font-mono` | Fragment Mono → ui-monospace → … → `--font-cjk` → `monospace` → `sans-serif` | ✅ (generic `sans-serif` last on purpose so a CJK dye name inside a mono label degrades to real glyphs, not tofu) |
| `:lang(ja/ko/zh) .m16-eyebrow/.m16-label` | drops the mono face for CJK | ✅ |

`tailwind.config.js` points `sans`/`mono` at the same variables; `tool-content.css` `.number` rule is loaded both page-side and inside the shell's shadow root (the shadow-DOM CSS boundary is documented in web-app `CLAUDE.md`). No component names a family directly (grep: only `globals.css` and the `.number` rule carry `font-family:`). **Correction (2026-08-21, Task 19 remediation):** the exception is not a single site — `my-submissions-modal.ts` inlines `font-family: 'Fragment Mono', monospace` in a style attribute at **four** call sites (the `statValue()` helper's big stat-card numbers, predating this audit, plus the votes/status badge pair the original grep caught) — it bypasses the `--font-mono` contract and so has **no CJK fallback** and no `:lang()` override; a ja preset name in that row would fall to the browser's default monospace. All four were fixed in the same commit (`13b84fdb`) by switching to `font-family: var(--font-mono)`.

### FONT-WEB-003 · `<html lang>` and `og:locale` 📝 Info
`src/index.html` ships `lang="en"` and `og:locale="en_US"`; the runtime flips `documentElement.lang` on `setLocale`. Because the locale is a localStorage preference, not a URL segment, there is no per-language URL for crawlers to index, so `hreflang`/`og:locale:alternate` do not apply. `public/manifest.json` has no `lang` field and English-only `shortcuts[]` — a PWA manifest cannot be localized per user without a manifest per locale; acceptable.

---

## Recommendations
1. ✅ DONE 2026-08-21 (commit `13b84fdb`) — added the two `:lang()` `--font-cjk` overrides (FONT-WEB-001) — one CSS edit, no bundle impact.
2. ✅ DONE 2026-08-21 (commit `13b84fdb`) — replaced all four inline `font-family: 'Fragment Mono', monospace` occurrences in `my-submissions-modal.ts` with `var(--font-mono)` (see correction above — the original count of one was wrong).
3. Nothing to subset; nothing to re-subset. Re-run the **worker** font-coverage checks whenever `packages/core` or `bot-logic` locale strings change — that is where stale subsets bite (see 2026-08-09 FONT-001).
