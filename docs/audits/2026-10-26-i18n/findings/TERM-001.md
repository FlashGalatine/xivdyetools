# TERM-001: Five Korean web strings still call the Hue coordinate 색조 instead of the pinned 색상
**Tier:** P2 · **Locale(s):** ko · **Deploy unit:** apps/web-app · **Generated?:** No

## Location
- `apps/web-app/src/locales/ko.json:145`
- `apps/web-app/src/locales/ko.json:198`
- `apps/web-app/src/locales/ko.json:201`

## Evidence
- The house rule explicitly pins Korean Hue to 색상, not 색조. config.hueMatchingDesc says 색조 각도, config.colorSpaceHsvDesc and colorSpaceLchDesc say 색조, harmony.types.monochromaticDesc says 단일 색조, and gradient.mode.hsv says 색조 기반. English explicitly means hue in each case. The same file already uses 색상 for config.mixingHsl, mixer.modelHsl and comparison.deltaHue. The 2026-09-19 pass corrected two HSL config keys but left these five distinct-English strings outside same-English parity.
- Reproduce: Select Korean. Inspect the Harmony matching description, Gradient HSV option and interpolation descriptions; compare them with the Mixer HSL label. The terminology split is visible despite structural and same-English gates passing.
- Test gap: Structural and same-English parity gates do not enforce this five-key term rule. See [review and verification evidence](../evidence/).

## Fix
- Apply the established 색상 house term to these five Hue uses, retaining the surrounding Korean wording. This is an existing project terminology decision, not a new translation or a guessed game-client term.

## Status
OPEN — audit only; no implementation change.
