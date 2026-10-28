# FINDING-041: Preset edit form renders preview_image_url without the https read-path guard (consistency hardening only)
**Severity:** INFO · **Exposure:** INTERNET-AUTH · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-20

## Location
- `apps/web-app/src/components/preset-edit-form.ts:580` — Preset edit form renders preview_image_url without the https read-path guard (consistency hardening only)

## Evidence
- preset-edit-form.ts:578-580 `if (hasStoredImage && state.previewImageStatus === 'approved' && state.previewImageUrl) { const img = document.createElement('img'); img.src = state.previewImageUrl;` vs preset-service.ts:120-123 `preview_image_url: row.preview_image_status === 'approved' && row.preview_image_key ? `${PREVIEW_IMAGE_PUBLIC_BASE}/${row.preview_image_key}` : null`
- Reach: A signed-in author opens Edit on their own preset (my-submissions-modal.ts:221 or v4/preset-tool.ts:1131, owner check at preset-edit-form.ts:111). The edit form copies preset.preview_image_url (line 135) and assigns it to img.src at line 580 with no sanitizePreviewImageUrl call.
- The facts hold: the card/detail paths (v4/preset-tool.ts:793, hybrid-preset-service.ts:237) apply sanitizePreviewImageUrl (shared/example-link.ts:73) and the edit form does not. There is no effect, though. presets-api builds the value itself from the hardcoded `https://shots.xivdyetools.app` base plus a server-generated `${presetId}/${uuid}.webp` key, and only for an approved image (preset-service.ts:26, :120-123; preview-image-service.ts:156). Only the owner's own preset reaches the form, an img src cannot run script, and the CSP img-src in public/_headers:31 limits the hosts. Preconditions: To get a non-https or hostile value into the form, an attacker would first have to compromise presets-api or its responses, because the URL is composed on the server and never taken from user input.
- Live state the repo cannot show: The CSP img-src applies only if the deployed _headers matches the repo. The reviewer reports confirming that live in evidence/live-headers.txt.

## Fix
- At preset-edit-form.ts:135, set `previewImageUrl: sanitizePreviewImageUrl(preset.preview_image_url)`, imported from @shared/example-link, so every read path uses the same guard. Optionally add a unit test where a non-https stored URL renders no img.

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; affected CI, whole-graph verification and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md).
