# SVG Generation & PNG Rendering

Commands that produce images follow a three-stage pipeline: build an SVG from a shared template library, render it to a PNG with resvg-wasm, and send the PNG as a Discord file attachment.

## SVG to PNG Pipeline

1. Build SVG using `@xivdyetools/svg` templates.
2. Render SVG to PNG via `@resvg/resvg-wasm`.
3. Send as a Discord file attachment.

```typescript
const svg = generateComparisonCard({ dyes, theme, labels, lang });
const png = await renderSvgToPng(svg);
await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
  embeds: [...],
  file: { name: 'comparison.png', data: png, contentType: 'image/png' },
});
```

## @xivdyetools/svg Package

Shared SVG template library (`@xivdyetools/svg`) used by both `discord-worker` and `og-worker`. 5.0 rebuilt every generator on the card frame system in `frame.ts` (400 px canvas, 350 px ceiling, `CARD_DARK` / `CARD_LIGHT` themes, command chip, app-icon mark); the 4.x `build*Svg` modules are deleted. Every generator takes a **single options object** — the dyes, the theme, the labels and the locale all travel in it.

| Generator | Card |
|-----------|------|
| `generateDyeInfoCard` | `/dye info` — 11B sheet |
| `generateRandomDyesGrid` | `/dye random` — 11B table |
| `generateHarmonyCard` | `/harmony` — 11A ideal-vs-found |
| `generatePaletteGrid` | `/extractor image` — 14K ramp |
| `generateNearestSheet` | `/extractor color`, `/swatch slot:` — 14J·2 colour sheet |
| `generateGradientCard` | `/gradient` — 12H strip |
| `generateMixerCard` | `/mixer` — 12F ratio sweep |
| `generateA11yCard` | `/accessibility`, `/a11y` — 13D / 13E / 13H |
| `generateContrastCard` | `/contrast` — 13A / 13B / 13C·1 |
| `generateComparisonCard` | `/comparison` — 14A / 14C·2 / 14C |
| `generateBudgetLedger` | `/budget` — 13G ledger |
| `generateSwatchCard` | `/swatch` — character-file frame |
| `generatePresetSwatch` | `/preset` swatch strip |

## CJK Font Rendering

SVG text elements that show localized dye names require CJK fonts. Bundled fonts (`src/fonts/`): Onest and Space Grotesk (UI text), Fragment Mono (hex / numeric columns — replaced Habibi in 5.0), and three CJK subsets — `NotoSansJP-Subset.ttf`, `NotoSansSC-Subset.ttf`, `NotoSansKR-Subset.ttf`. Every card text stack is Latin-led (`Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR` and its Space Grotesk / Fragment Mono variants), so the Latin face draws what it has, and resvg fills every other glyph from the loaded faces **in load order** — the font-family list does not choose the fallback face. `renderSvgToPng(svg, { locale })` passes the card's locale to `getFontBuffers(locale)` (`src/services/fonts.ts`), which loads the CJK subsets JP, SC, KR for `ja` and SC, KR, JP for every other locale. So `ja` draws in Japanese letterforms, `zh` keeps SC's Chinese forms (JP draws only what SC and KR both lack), and Hangul always comes from KR, the only face that carries it. Until 2026-10-06 every locale loaded SC first, and `ja` drew every kanji SC carries from SC, in its Chinese form wherever the two designs differ; `src/services/font-load-order.test.ts` renders both orders through resvg-wasm.

- The subsets cover the dye names **and** every bot-UI string from `@xivdyetools/bot-logic/i18n`, plus the localized market-item names in `packages/core/src/config/consolidated-ids.ts` and the ko / zh / ja equippable-item names `/glamour` draws (`apps/api-worker/src/chara/data/item-names.*.json`, FONT-001). `scripts/subset-cjk-fonts.py` scans those sources and cuts each Noto Sans face down to only the codepoints they use — SC carries the ideographs and kana of every language's locale text plus the ko / zh item names (the catch-all, and the face that draws CJK first outside `ja`), JP is scoped to `ja` text and `ja` item names, and KR is scoped to Hangul + ASCII (Korean strings use no CJK ideographs). The codepoint count shifts with every locale-text edit, so no fixed number stays accurate here — re-run the script to print the current totals and each subset's size/glyph count.
- `src/services/font-coverage.test.ts` is what actually guarantees 0 tofu: it reads the bundled fonts' cmaps directly and fails the test suite if any runtime string's codepoints — or a glyph the card code itself emits — aren't covered by the union of the bundled fonts, plus a dedicated check that `ja` CJK codepoints land specifically in the JP subset and `ko` Hangul lands in the KR subset.
- If new dyes or locale strings are added, re-run `scripts/subset-cjk-fonts.py` (`fonttools`; downloads sources into the git-ignored `scripts/.font-sources/`).

## resvg-wasm

Rust-based SVG renderer compiled to WebAssembly.

- ~2.4 MiB bundle size
- Runs inside Cloudflare Workers (no browser needed)
- High-fidelity rendering with support for text, gradients, filters, and embedded fonts

## Image decoding (image-worker)

`@cf-wasm/photon` is no longer bundled here. `/extractor image` sends the attachment to `xivdyetools-image-worker` over the `IMAGE_WORKER` service binding (`POST /extract`, `services/image-client.ts`), which decodes/resizes with Photon and returns pixels; K-means++ clustering then runs in this worker via `@xivdyetools/core`. See [`docs/operations/IMAGE_WORKER_SPLIT.md`](../../operations/IMAGE_WORKER_SPLIT.md).

## Bundle Size Constraints

Cloudflare enforces a 3,072 KiB **gzip** limit on the deployed script. Photon had pushed the bot to 3,209 KiB; after the split it sits at ~2,632 KiB (~14 % headroom).

| Dependency | Notes |
|------------|-------|
| resvg-wasm | the largest single item |
| Fonts | Onest, Space Grotesk, Fragment Mono + three CJK subsets |
| Photon | moved to image-worker |

## Discord File Attachment Format

Images are sent as multipart form data:

```
Content-Disposition: form-data; name="payload_json"
{...JSON payload...}

Content-Disposition: form-data; name="files[0]"; filename="image.png"
Content-Type: image/png
{binary data}
```

The image is referenced in the embed via `"url": "attachment://image.png"`.

## Related Documentation

- [Commands](commands.md)
- [Interactions](interactions.md)
- [Overview](overview.md) (including [Deployment](overview.md#deployment))
