# FINDING-019: Preview-upload daily slot is refunded when the image-worker decode fails, so decode work is uncapped per day
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-770

## Location
- `apps/presets-api/src/handlers/presets.ts:1293` — Preview-upload daily slot is refunded when the image-worker decode fails, so decode work is uncapped per day

## Evidence
- presets.ts:1290-1299 try { key = await storePreviewImage(c.env, presetId, bytes); } catch { await uploadReservation.release?.(); return c.json({... 'Image could not be processed' }, 400); }; rate-limit-service.ts:320-322 release = DELETE FROM submission_events WHERE id = ?
- Reach: Any Discord user authenticated by web JWT who authors a preset (they can create one themselves, at most 10 per day) sends POST /api/v1/presets/:id/preview-image with up to 5 MB of bytes. The bytes pass sniffImageType but fail in image-worker /thumbnail (non-OK or the 10 s timeout). The catch at presets.ts:1293-1294 calls uploadReservation.release(), which runs DELETE FROM submission_events (rate-limit-service.ts:320-322), so the attempt never counts toward DAILY_PREVIEW_UPLOAD_LIMIT=20 (rate-limit-service.ts:30).
- The code does what the claim says. storePreviewImage (preview-image-service.ts:131-153) throws on !response.ok or an abort, the handler releases the reservation, and the only remaining bound on image-worker decode calls is the 100/min per-user limiter (index.ts:182, native RL_PUBLIC, approximate per colo). That undercuts the stated purpose of the FINDING-008 cap at presets.ts:1215 ("each upload costs an image-worker decode"). The BUG-015 comment at :1218-1224 makes the refund deliberate, but no entry in security-trade-offs.md accepts it. Impact is bounded: image-worker's header gate (4096 px per side, MAX_PIXEL_COUNT, 10 MB cap) re… Preconditions: Valid web JWT or bot-signed identity, the caller is not banned (requireNotBanned), and the caller authors the target preset (presets.ts:1204). Bytes must pass the PNG/JPEG/WebP magic-byte sniff and the 5 MB cap but fail in image-worker. How much CPU photon burns on a header-valid but corrupt image…
- Live state the repo cannot show: How strictly the RL_PUBLIC native rate-limit binding (100/60 s) is enforced in production, and image-worker's per-invocation CPU limit, which are set in the Cloudflare dashboard and plan.

## Fix
- Keep the slot (do not release) when the image-worker call failed, or count decode failures as their own kind (for example preview_decode_fail, with a small daily cap) and keep releasing only on cheap pre-decode exits (empty, oversized, sniff fail, body-read error) and the DB UPDATE failure. Add a test that a decode failure still consumes a slot.
- **Maintainer decision:** The BUG-015 refund is deliberate. Choose whether a failed decode keeps its daily slot, or record the refund as an accepted trade-off in security-trade-offs.md.

## Status
OPEN
