# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-19

### Changed

- **REFACTOR-005** (2026-07-18 audit): the `@xivdyetools/core` dependency is gone — the sole use (`ColorService.hexToRgb`) is replaced by a local strict `hexToRgb` in `conversions.ts` (throws on malformed input, accepts `#RGB`/`#RRGGBB`). The package now has **zero internal dependencies**, matching the documented dependency graph, and blending-only consumers no longer pull the dye database/k-d tree/i18n into their bundles.

## [1.0.1] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.0.0] - 2026-02-18

### Added

- Extracted color blending algorithms from `@xivdyetools/core` into a dedicated package
- `blendColors(hex1, hex2, mode, ratio?)` — core blending function supporting 6 modes
- `getBlendingModeDescription(mode)` — human-readable mode descriptions
- `isValidBlendingMode(mode)` — type guard for blending mode validation
- `BLENDING_MODES` — array of all modes with display metadata (value, name, description)
- `rgbToLab(rgb)` — public RGB→CIELAB conversion
- **6 blending algorithms:**
  - **RGB** — additive channel averaging
  - **LAB** — perceptually uniform CIELAB blending
  - **OKLAB** — modern perceptual (fixes LAB's blue→purple issue)
  - **RYB** — traditional artist's subtractive color wheel
  - **HSL** — hue-saturation-lightness interpolation
  - **Spectral** — Kubelka-Munk physics-based paint mixing simulation
- Internal color space conversions: RGB↔LAB, RGB↔OKLAB, RGB↔RYB, RGB↔HSL, RGB↔Reflectance, Reflectance↔K/S
- Type exports: `RGB`, `LAB`, `HSL`, `BlendResult`, `BlendingMode`

---

[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/color-blending-v1.0.0
