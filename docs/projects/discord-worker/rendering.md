# SVG Generation & PNG Rendering

> Discord bot v4.1.2

Commands that produce images follow a three-stage pipeline: build an SVG from a shared template library, render it to a PNG with resvg-wasm, and send the PNG as a Discord file attachment.

## SVG to PNG Pipeline

1. Build SVG using `@xivdyetools/svg` templates.
2. Render SVG to PNG via `@resvg/resvg-wasm`.
3. Send as a Discord file attachment.

```typescript
const svg = buildComparisonSvg(dyes);
const png = await renderSvgToPng(svg);
await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
  embeds: [...],
  file: { name: 'comparison.png', data: png, contentType: 'image/png' },
});
```

## @xivdyetools/svg Package

Shared SVG template library used by both `discord-worker` and `og-worker`:

| Function | Description |
|----------|-------------|
| `buildDyeInfoCard(dye, options)` | Single dye info card |
| `buildComparisonSvg(dyes)` | 2-4 dye comparison grid |
| `buildGradientSvg(dye1, dye2, steps, mode)` | Gradient visualization |
| `buildHarmonySvg(baseDye, harmonies)` | Harmony combinations |
| `buildAccessibilitySvg(dye, visionTypes)` | Colorblindness simulation |
| `buildSwatchSvg(matches)` | Character color matches |
| `buildMixerSvg(dye1, dye2, result, mode)` | Blend result |
| `buildBudgetSvg(alternatives)` | Budget alternatives with prices |

## CJK Font Rendering

SVG text elements that show localized dye names require CJK fonts. The font-family fallback chain is:

```
Onest, Noto Sans SC, Noto Sans KR
```

- **Noto Sans SC** covers Chinese and Japanese katakana (~222 KiB subset).
- **Noto Sans KR** covers Korean Hangul (~155 KiB subset).
- Both fonts are subsetted to include only dye name characters, keeping bundle size manageable.
- If new dyes are added, fonts need re-subsetting via the `fonttools` Python package.

## resvg-wasm

Rust-based SVG renderer compiled to WebAssembly.

- ~2.4 MiB bundle size
- Runs inside Cloudflare Workers (no browser needed)
- High-fidelity rendering with support for text, gradients, filters, and embedded fonts

## @cf-wasm/photon

Image processing library used by the extractor command for color extraction from uploaded images.

- ~1.6 MiB bundle size
- Performs K-means++ clustering on pixel data to identify dominant colors

## Bundle Size Constraints

Cloudflare Workers paid plan enforces a 10 MiB limit. The current bundle sits at ~8 MiB (gzip: ~2.4 MiB).

| Dependency | Size |
|------------|------|
| resvg-wasm | ~2.4 MiB |
| photon-wasm | ~1.6 MiB |
| Skin/hair color JSONs | ~1 MiB each |

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
- [Deployment](deployment.md)
- [Overview](overview.md)
