# DEAD-035: Palette provider guards (table, palette type, shader lipsLight/facePaint) the library never trips
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core · **Semver:** NONE · **Category:** Legacy

## Location
- `packages/core/src/services/chara/chara-palette-provider.ts:109,110,133`

## Evidence
- Read xivcharakit@0.1.0-beta.4 dist/palettes/types.d.ts:1-10: table and palette are closed unions, so :109/:110 trip only for untyped JS. appearance.js:309-320 asks for shader only as lipsDark or the slot palette, never facePaint. :133 is still reachable by a typed request: web-app chara-inspection-protocol.ts:300-311,824-834 checks table and palette separately, so {shader, lipsLight} gets through to chara-inspection-service.ts:208. charaShaderHex (chara-shader-colors.ts:71) would throw on it, and chara-palette-provider.test.ts:62-63 pins null. index.ts:278 tags it @public, and npm view @xivdyetools/core version = 5.15.0, the same as local.
- The library never trips these guards, but the provider is published core 5.15.0 API (@public at index.ts:278). Untyped npm JS callers can reach :109 and :110. The :133 guard is reachable from a well-typed request that the web-app worker relay lets through. Without it, charaShaderHex throws a TypeError. The guards are small and deliberate (header :5-6), and a test pins them.
- Still live: apps/web-app/src/services/chara-inspection-service.ts:84,208 (relays worker requests); packages/core/src/services/chara/chara-library-resolve.ts:38

## Fix
- **KEEP** — revisit trigger: Revisit :109/:110 only at a core MAJOR that removes createCharaPaletteProvider from the published barrel (drops the @public export at index.ts:278), and only if every remaining caller validates the request first (web-app parsePaletteRequestMessage does). Keep :133 for as long as charaShaderHex throws for a palette outside SHADER_PALETTES.
- Published: createCharaPaletteProvider is /** @public */ in @xivdyetools/core 5.15.0 (npm latest = local). Narrowing its runtime behavior would be MAJOR.

## Status
OPEN
