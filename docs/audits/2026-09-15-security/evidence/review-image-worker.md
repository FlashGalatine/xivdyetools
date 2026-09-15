# Image worker security review — 2026-09-15

## Surface and trust boundary

| Surface | Authority / sink | Evidence |
|---|---|---|
| `POST /extract` | Service binding from discord-worker; fetches a validated Discord CDN URL, returns bounded resized RGBA | `src/index.ts:135-175`; `src/validators.ts:473-550` |
| `POST /thumbnail` | Service binding from presets-api; receives capped bytes and returns 640×264 WebP | `src/index.ts:181-220`; `src/photon.ts:271-303` |
| `/health` | Binding-only diagnostic; public hostname guard runs before it | `src/index.ts:66-126` |

## Candidates

| Candidate | Severity / exposure | File:line | Claim | Evidence |
|---|---|---|---|---|
| No confirmed candidate | — | — | Thumbnail and extraction both enforce predecode dimensions for PNG/JPEG/GIF/WebP/BMP. | `processImageForExtraction()` and `processImageForThumbnail()` both call the same fail-closed header parser before Photon decode (`src/photon.ts:176-188,277-290`; `src/dimensions.ts:46-133`). |

## Positive controls

- Both Wrangler environments set `workers_dev = false` and `preview_urls = false`, production has no routes, and code rejects `*.workers.dev` before body/fetch/decode (`wrangler.toml:1-29`; `src/index.ts:66-126`). This is binding-only defense in depth, not caller authentication.
- `/extract` restricts to exact HTTPS Discord CDN hosts, disallows IP/private targets, validates a single redirect hop against the same allowlist, uses a shared 10 s abort, and stream-caps bytes at 10 MB (`validators.ts:23-31,134-136,473-550`).
- `/thumbnail` checks declared and actual streamed body size; both formats reject unreadable headers and dimensions beyond 4096px/9.4 MP before Photon allocation (`index.ts:187-211`; `validators.ts:305-373`; `photon.ts:277-290`).
- Photon frees every image handle on success and failure; thumbnail output is re-encoded WebP, dropping source metadata such as EXIF GPS (`photon.ts:209-225,271-303`).
- Error responses only expose fixed processing/validation messages. No Analytics Engine binding, IP/UA capture, user-text logging, persistent store, or public cache is present in this unit.

## Rejected suspicions

- A Discord CDN redirect cannot pivot to an arbitrary/internal address: redirect mode is manual, destination is host-allowlisted, and the second response is not followed (`validators.ts:481-520`).
- An unchecked `maxDimension` cannot force a zero/full-resolution resize: it must be an integer 16–4096 before fetch/decode (`index.ts:147-153`; `validators.ts:125-130`).
- A public `workers.dev` surface is not configured: both environment settings plus the hostname guard must drift for any unauthenticated decode to run (`wrangler.toml:17-29`; `index.ts:100-126`).

## Coverage and limits

Covered tracked source/config: complete `src/index.ts`, validators, header parsers, Photon processing, types, and `wrangler.toml`; checked binding-only configuration and extraction/thumbnail paths. Read-only source review; no production probes, dependency inspection, source edits, or runtime decoding tests.
