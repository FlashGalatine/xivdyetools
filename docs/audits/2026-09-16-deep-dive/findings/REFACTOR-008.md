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
OPEN
