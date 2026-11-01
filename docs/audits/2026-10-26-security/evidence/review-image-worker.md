# image-worker security review (2026-10-26)

Unit: apps/image-worker 1.3.4 (HEAD 13c386e5). No .chara code touches this unit; changes since 0ab33466 are dependency bumps and a dead-alias removal.

## Route table / authz matrix

| Route | Method | Auth | Caller | Input | Caps |
|---|---|---|---|---|---|
| /health | GET | none (service binding only) | any | none | n/a |
| /extract | POST | none; binding-only, host guard returns 404 for *.workers.dev (index.ts:98-104) | discord-worker image-client.ts:53 | JSON {url, maxDimension} | url allowlisted to cdn.discordapp.com / media.discordapp.net, https, 1 validated redirect (validators.ts:25,171-177,423-456); 10 MB streamed (readBodyWithCap); 10 s timeout; header dimension gate; maxDimension int 16..4096 |
| /thumbnail | POST | none; binding-only | presets-api preview-image-service.ts:143 | raw bytes | Content-Length pre-check + streamed 10 MB cap (index.ts:172-185); header dimension gate |

No routes/workers_dev/preview_urls in either env (wrangler.toml:23-24, 43-44), no vars/secrets/KV/D1/R2, observability off. Pinned by src/wrangler-config.test.ts.

## Positive controls
- Dimension gate from container headers (PNG/JPEG/GIF/WebP/BMP) before decode, fail closed on unreadable header (dimensions.ts, validators.ts:302-312, photon.ts:187,279). Non-image formats (TIFF/ICO) have no parser, so they are rejected.
- Streamed byte cap with reader.cancel (validators.ts:323-360); fetch redirect:manual with re-validated target; AbortController covers the body read.
- SSRF: exact-host allowlist, userinfo tricks resolve to the real hostname, https only.
- computeCropBox clamps (BUG-053) and resize minor axis clamp (photon.ts:124-127, 259-262); wasm images freed in finally.
- Error envelope returns messages only (no stack/env); no secrets or personal fields logged (logger middleware logs path only; URL with Discord signature is in the body, never logged).
- Probes (scratchpad, real @cf-wasm/photon in Node): VP8X canvas 1x1 wrapping a 4000x4000 VP8L chunk decodes to 1x1; GIF logical screen 1x1 with a 4000x4000 frame decodes to 1x1. Header and decoder agree, no gate bypass shown.

## Rejected
- Uncapped JSON body on /extract (c.req.json): binding-only, caller sends ~200 bytes; platform limit applies. INFO at most.
- Header/decoder dimension mismatch (WebP VP8X, GIF frame vs screen): probed, decoder honored the header canvas.
- Redirect first-response body not cancelled (validators.ts:433): trivial resource, 10 s timeout.
- No auth/rate limit on binding-only worker: documented design (FINDING-023), accepted.
- error.message echoed to caller: contract with discord-worker markers, messages are generic.

## FILES COVERED
21 tracked files in apps/image-worker (src/*, wrangler.toml, package.json, tests skimmed: wrangler-config, photon-gate), plus callers apps/discord-worker/src/services/image-client.ts, apps/presets-api/src/services/preview-image-service.ts, wrangler.toml service bindings, packages/worker-kit/src/image-sniff/detect.ts.

## Candidate
image-worker-01: 16-bit RGBA PNG within the pixel cap exceeds the 128 MB isolate limit. Probe: 3072x3072 (9,437,184 px = cap) RGBA PNG; wasm linear memory after PhotonImage.new_from_byteslice: 8-bit 110.25 MB, 16-bit 146.9 MB (file 73 KB). Measured in Node, not workerd.
