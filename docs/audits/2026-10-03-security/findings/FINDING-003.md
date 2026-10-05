# FINDING-003: apps/web-app/PRIVACY.md says images never leave the device and that the list is complete, but the preset form's optional preview image is POSTed to presets-api and stored in R2
**Severity:** MEDIUM · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.md §Images and camera captures, §Network access item 3 (Community presets), §How to verify — variants: `apps/web-app/PRIVACY.md`, `apps/web-app/PRIVACY.ja.md`, `apps/web-app/PRIVACY.ko.md`, `apps/web-app/PRIVACY.zh.md`, `apps/web-app/PRIVACY.de.md`, `apps/web-app/PRIVACY.fr.md` · **CWE:** CWE-359
**Reconcile case:** 3 (Step 3a)

## Location
- apps/web-app/PRIVACY.md:16-18 — 'Uploaded, pasted, dragged-in and camera-captured images never leave your device'; :158 'You will see no image upload'; :65-74 Community presets item does not mention a user-uploaded preview image
- apps/web-app/src/components/preset-submission-form.ts:751 (and preset-edit-form.ts:841) — calls uploadPreviewImage(presetId, file) after the preset is created
- apps/web-app/src/services/preset-submission-service.ts:230-247 — POST ${PRESETS_API_URL}/api/v1/presets/:id/preview-image with the raw File as body; handled at apps/presets-api/src/handlers/presets.ts:1077 (re-encoded by image-worker, written to R2, served from shots.xivdyetools.app)

## Evidence
- PRIVACY.md:16 `- Uploaded, pasted, dragged-in and camera-captured images never leave your device, and are never` / :158 `3. You will see no image upload — only the requests listed above`
- preset-submission-service.ts:236-246: `fetch(`${PRESETS_API_URL}/api/v1/presets/${encodeURIComponent(presetId)}/preview-image`, { method: 'POST', headers: {...authService.getAuthHeaders()}, body: file })`
- en.json fieldPreviewImageHint: 'PNG, JPEG or WebP, up to 5 MB. Shown on your card once a moderator approves it.' — the UI discloses it but the policy does not; PRIVACY.md:73 says only 'Preset preview images are served from shots.xivdyetools.app'

## Fix
- Scope §Images and camera captures to the colour tools, and add one exception: an optional preset Preview image you choose to attach is uploaded to api.xivdyetools.app, re-encoded to WebP, stored, and shown publicly from shots.xivdyetools.app once a moderator approves it.
- In §Network access item 3, list the preview image beside name and description, say how to remove it (DELETE route / the edit form, or the Questions? contact), and change §How to verify step 3 to exempt that deliberate upload.
- Make the same six-file edit in PRIVACY.ja/ko/zh/de/fr.md and bump 'Last updated'. No code change is needed, since the document is aligning to existing behavior.

## Status
FIX COMMITTED, NOT DEPLOYED — `3daa83fd` (local branch `fix/security-2026-10-03-sprint2`, web-app 5.13.4; PR #223, open); all six locale variants.
