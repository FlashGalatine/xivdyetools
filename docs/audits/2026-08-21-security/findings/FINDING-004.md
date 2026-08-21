# FINDING-004: image-worker decodes untrusted images with no dimension/pixel gate (decompression bomb → isolate OOM); byte caps applied only after full buffering

## Severity
**MEDIUM** — reachable by any Discord user (`/extractor` attachment → discord-worker → `POST /extract`) and any signed-in web user (preset preview upload → presets-api → `POST /thumbnail`); each hit can kill the image-worker isolate and burn CPU. Reviewer IDs: IMG-1, IMG-2, IMG-3, PAPI-3. Coordinator-verified (`validateDimensions` has no production caller).

## Category
CWE-400 Uncontrolled Resource Consumption · CWE-409 Improper Handling of Highly Compressed Data

## Location
- `apps/image-worker/src/photon.ts:77-85` — `loadImage()` → `PhotonImage.new_from_byteslice(buffer)` decodes the whole image to RGBA before any check.
- `apps/image-worker/src/photon.ts:162-209` (`processImageForExtraction`) and `:273-297` (`processImageForThumbnail`) — never call `validateDimensions()`.
- `apps/image-worker/src/validators.ts:42-52, 204-224` — `MAX_IMAGE_DIMENSION = 4096`, `MAX_PIXEL_COUNT = 16 MP`, `validateDimensions()` exist but are **referenced only by tests**.
- `apps/image-worker/src/index.ts:54-59` — `body.maxDimension` forwarded unvalidated (NaN / 0 / huge → `resize(img,0,0)` or full-res RGBA); `:84-92` — `/thumbnail` has no byte cap; `validators.ts:366-384` — `/extract` cap enforced after `arrayBuffer()`.
- `apps/presets-api/src/handlers/presets.ts:713-731`, `middleware/body-validation.ts:63-68` — preview upload buffers the body before the 5 MB check.

## Description
A 5–10 MB PNG/WebP can encode tens of thousands of pixels per side (20 000 × 20 000 → 1.6 GB RGBA). Decoding runs inside a 128 MB Worker isolate, so the request dies with an out-of-memory error. The dimension guards were written but never wired into the decode path.

## Evidence
```
$ grep -n "validateDimensions\|MAX_PIXEL_COUNT" apps/image-worker/src/*.ts | grep -v test
(only validators.ts definitions)
```

## Impact
Cheap, repeatable crashes/CPU burn of the shared image service (affects `/extractor` for all bot users and preview generation for all web users); no persistent damage.

## Recommendation
1. Parse dimensions from the container header **before** decoding (PNG IHDR, JPEG SOFn, GIF logical screen, WebP VP8/VP8L/VP8X, BMP) and reject when `w*h > MAX_PIXEL_COUNT` or either side > `MAX_IMAGE_DIMENSION` — i.e. wire `validateDimensions()` in.
2. Validate `maxDimension` (integer, 16 ≤ n ≤ 4096).
3. Enforce byte caps before buffering (`Content-Length` check + bounded streaming read) on both routes, and give `/thumbnail` its own cap.

## References
- Evidence: `../evidence/review-og-image-workers.md` (IMG-1..3), `../evidence/review-presets-api.md` (PAPI-3)

## Status
**FIXED 2026-08-21** — `fix(image-worker,presets-api): pre-decode dimension gate + streamed size caps (FINDING-004)`: image-worker 1.1.0 reads width×height from the container header (`src/dimensions.ts`) and rejects >4096 px / >16 MP (or unreadable headers) before `PhotonImage.new_from_byteslice`; `maxDimension` validated (integer 16–4096) at the route and in photon.ts; `/extract` fetches and `/thumbnail` bodies are read with a streaming cap (Content-Length pre-check + `readBodyWithCap`); presets-api 2.1.0 applies a streamed 5 MB `bodyLimit` to the preview-image route instead of exempting it.
