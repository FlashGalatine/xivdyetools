# FONT-001: Chinese OG cards can select Japanese CJK glyphs because their font buffers always load JP first
**Tier:** P3 · **Locale(s):** zh · **Deploy unit:** apps/og-worker · **Generated?:** No

## Location
- `apps/og-worker/src/services/fonts.ts:68`
- `apps/og-worker/src/services/fonts.ts:81`
- `apps/og-worker/src/services/renderer.ts:112`

## Evidence
- OG getFontBuffers has one cache and always returns the Latin faces, JP, SC, KR; its renderer accepts no locale. With the real bundled fonts and resvg-wasm, a generated zh achromatopsia accessibility card (dyeIds:[1]) contains 全色盲 · 1 种染剂 and hashes 8a6489e3327c10046bcaf86bab19454f16017a6c1a61ef25f26524c983db6750 in current order versus 753a4f649355bf648fc15fc4071aa770612cfa337c7f96db59d431afa6651b59 in SC-first order. Shared single-character probes select the JP-only result in current order and the SC-only result in reversed order. The sibling Discord renderer already threads locale and tests this behavior. This is regional font selection, not missing glyphs/tofu.
- Reproduce: Use the saved read-only render probe in review-content.md with apps/og-worker as cwd; compare real generated zh card renders under current and SC-first buffer order. No production HTTP request or stored image is needed.
- Test gap: Coverage/face-presence tests do not assert regional load order with actual rendered glyphs. See [review and verification evidence](../evidence/).

## Fix
- Thread locale to the OG renderer/font loader and use JP-first for ja, SC-first for zh (and the existing intended fallback for the other locales), mirroring the tested Discord approach. Add actual regional-face render assertions. Schedule after string fixes; no re-subset is inherently required for a load-order change.

## Status
OPEN — audit only; no implementation change.
