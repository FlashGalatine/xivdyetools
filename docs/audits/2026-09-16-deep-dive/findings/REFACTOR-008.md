# REFACTOR-008: Magic-byte image sniffing is duplicated between image-worker and presets-api, and presets-api's copy lacks GIF/BMP
**Priority:** P3 · **Effort:** MEDIUM · **Risk:** LOW · **Deploy unit:** presets-api + image-worker

## Location
- `apps/image-worker/src/validators.ts:141-147,386-423`
- `apps/presets-api/src/services/preview-image-service.ts:113-144`

## Evidence
- Reviewer row `image-stoat-16`; presets-api forwards to image-worker anyway, so the client-side copy is a pre-filter that can disagree with the authority

## Fix
- Move the sniffer to `@xivdyetools/worker-kit` (or have presets-api trust image-worker's 415), then delete the copy

## Status
FIXED (Sprints 13 + 15 + 16, `951e7177`, `1237d7d5`, `ba38251e`) — `@xivdyetools/worker-kit/image-sniff` holds image-worker's table as the single source; image-worker imports it (byte-table test unchanged); presets-api keeps a pre-filter through `sniffImageType(bytes, [png, jpeg, webp])` (coordinator ruling: a GIF/BMP is still refused before the image-worker round trip).
