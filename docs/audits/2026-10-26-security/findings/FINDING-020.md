# FINDING-020: 16-bit PNG within the pixel cap overruns the isolate memory limit (pixel budget assumes 4 B/px)
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** image-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-789

## Location
- `apps/image-worker/src/validators.ts:104` — 16-bit PNG within the pixel cap overruns the isolate memory limit (pixel budget assumes 4 B/px)

## Evidence
- validators.ts:104 MAX_PIXEL_COUNT = floor(PIXEL_MEMORY_BUDGET_BYTES / (BYTES_PER_RGBA_PIXEL * CONCURRENT_RGBA_COPIES)); dimensions.ts:46 readPng returns ok(u32be(b,16), u32be(b,20)) with no bit-depth read. Verifier probe (scratchpad g17/probe.mjs), wasm memory after new_from_byteslice: 8-bit 3072^2 = 110.25 MiB; 16-bit RGBA = 146.88 MiB; 16-bit RGB = 128.88 MiB.
- Reach: A Discord user attaches a ~73 KB 3072x3072 16-bit RGBA PNG to /extractor (discord-worker image-client.ts:53 -> image-worker POST /extract), or a signed-in preset author uploads it as a preview image (presets-api preview-image-service.ts:143 -> POST /thumbnail, under its 5 MB gate). Both reach processImageForExtraction / processImageForThumbnail, whose only pre-decode gate is assertImageDimensionsFromHeader (validators.ts:302) -> validateDimensions (281-283), which passes at exactly MAX_PIXEL_COUNT.
- MAX_PIXEL_COUNT (validators.ts:104-106) is 72 MiB / (4 B x 2 copies), and readPng (dimensions.ts:46-50) reads only width/height, never bit depth or color type; nothing in image-worker, discord-worker or presets-api checks bit depth. I reproduced this independently with the repo's @cf-wasm/photon 0.4.0 in Node (wasm memory hooked): a 3072x3072 PNG grows wasm linear memory to 110.25 MiB at 8-bit, 146.88 MiB at 16-bit RGBA (73,452 B file) and 128.88 MiB at 16-bit RGB. That is over the 128 MiB isolate limit before any JS buffers are counted, and wasm memory never shrinks. The effect is bounded to availability: the isolate is killed and… Preconditions: The sender needs a Discord account (a signed interaction) for /extractor, or a valid user JWT for a preset preview upload. The precondition is that workerd counts wasm linear memory against the 128 MiB isolate limit and enforces it the way Node's growth figures suggest. The figures were measured in…
- Live state the repo cannot show: This depends on how workerd and Cloudflare production actually enforce the 128 MiB per-isolate limit against wasm memory: whether the isolate is killed mid-request or after it completes. It could not be run under workerd here.

## Fix
- Read the PNG IHDR bit depth (byte 24) and color type (byte 25) in dimensions.ts. Either refuse 16-bit input or charge it a bytes-per-pixel factor of 2x or more against the pixel budget. Then re-measure the real wasm peak (8-bit at the cap is already 110 MiB) and lower PIXEL_MEMORY_BUDGET_BYTES until it leaves real headroom, with a regression test on a 16-bit PNG at the cap.

## Status
OPEN
