# FINDING-009: web-app persists uploaded / pasted / camera images to IndexedDB (≤ 8 MiB) and restores them on the next visit — the privacy guide says they are discarded on reload, and Reset settings / logout do not clear them
**Severity:** MEDIUM · **Exposure:** LOCAL (never leaves the device) · **Deploy unit:** web-app · **Rotation:** NONE · **CWE:** CWE-359, CWE-312 (cleartext storage)

## Location
- `apps/web-app/src/components/extractor-tool.ts:92` (`MAX_IMAGE_STORAGE_SIZE = 8 MiB`), `:437-447` `persistImage` → `indexedDBService.set(STORES.IMAGE_CACHE, …)`, `:1562-1565` called on every image load; restore path `:488`
- `apps/web-app/src/components/image-upload-display.ts:488-491`; `advanced-options-panel.ts:249-254` (Reset settings — localStorage only); `services/auth-service.ts:721-747` (logout — no IndexedDB)

## Evidence
- `apps/web-app/PRIVACY.md:13-14`: images "are read with the browser's Canvas API and discarded when you clear the image, close the tab or reload"; `:28-31` the on-device inventory omits the image cache.
- A pasted screenshot or webcam capture (OPT-012 perf nicety) is the next visitor's first view on a shared device.

## Fix
- Drop the persistence, or make it an explicit opt-in ("remember last image"), clear it on Reset settings / logout / "clear image", and document it in the on-device list.

## Status
FIXED 2026-08-30 73fbf59f (web-app: the IndexedDB image persistence is gone — images live only in component memory for the session; `DB_VERSION` 2→3 deletes the `image_cache` store on the next visit (one-time purge of blobs stored by earlier visits; an old tab holding the v2 connection defers it until closed) and `mount()` idempotently removes the legacy `v3_matcher_image` localStorage key; PRIVACY.md's images bullet is now literally true and the on-device inventory names IndexedDB's one real content — the market-price cache. Ruling S6-R1: removal over an opt-in.)
