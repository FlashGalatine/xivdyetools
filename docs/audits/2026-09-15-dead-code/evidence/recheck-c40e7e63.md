# Dead Code Audit Evidence — Reference Count Check at c40e7e63

## A. Reference hits at c40e7e63

### getWithContext

**Declared at apps/web-app/src/services/indexeddb-service.ts:183**

apps/web-app/src/services/indexeddb-service.ts:183:   async getWithContext<T>(storeName: StoreName, key: string): Promise<GetResult<T>> {

prod=1 test= docs=

### isSaved

**Declared at apps/web-app/src/services/saved-presets-service.ts:121**

apps/web-app/src/services/saved-presets-service.ts:121:   static isSaved(id: string): boolean {
docs/audits/2026-09-02-deep-dive/evidence/review-webapp-services.md:419: **Failing input → wrong outcome.** Any call to `SavedPresetsService.getAll()` / `isSaved()` that lands

prod=2 test= docs=1

### getBaseUrl

**Declared at apps/web-app/src/services/share-service.ts:578**

apps/web-app/src/services/share-service.ts:578:   static getBaseUrl(): string {

prod=3 test= docs=1

### getRequiredColor

**Declared at apps/web-app/src/services/theme-service.ts:329**

apps/web-app/CHANGELOG.md:597:   surviving `getRequiredColor()` twin, which has no production caller — using it would have
apps/web-app/src/services/__tests__/theme-service.test.ts:302:         // uses — NOT through the surviving `getRequiredColor()` twin, which has no
apps/web-app/src/services/theme-service.ts:329:   static getRequiredColor(
docs/audits/2026-09-05-documentation/findings/sweep-C1-discord-worker-web-app.md:58: | WEB-04 | `docs/projects/web-app/theming.md:34` | `ThemeService.getCurrentThemeObject()` | statics: `initialize`, `getC
docs/audits/2026-09-05-documentation/findings/sweep-C1-discord-worker-web-app.md:61: | WEB-07 | `theming.md:42` | `ThemeService.getColor(key)` | only `getRequiredColor(key)` (`:329`) | HIGH | fix; add `isD
docs/projects/web-app/theming.md:39: ThemeService.getRequiredColor(key, …)         // Throws rather than returning undefined

prod=4 test=1 docs=5

### setStyle

**Declared at apps/web-app/src/components/base-component.ts:703**

apps/web-app/src/components/base-component.ts:703:   setStyle(styles: Partial<CSSStyleDeclaration>): void {
docs/historical/web-app/20251201-Optimize/03-TYPE-SAFETY.md:28: setStyle(styles: Partial<CSSStyleDeclaration>): void {
docs/historical/web-app/20251201-Optimize/03-TYPE-SAFETY.md:34: this.setStyle({ backgroundColor: 'red', display: 'flex' });

prod=5 test=1 docs=7

### setOptions

**Declared at apps/web-app/src/components/empty-state.ts:215**

apps/web-app/src/components/__tests__/empty-state.test.ts:252:   describe('setOptions', () => {
apps/web-app/src/components/__tests__/empty-state.test.ts:260:       emptyState.setOptions({ title: 'Updated title' });
apps/web-app/src/components/__tests__/empty-state.test.ts:274:       emptyState.setOptions({ description: 'New description' });
apps/web-app/src/components/__tests__/empty-state.test.ts:286:       emptyState.setOptions({ icon: '<svg data-glyph="b"></svg>' });
apps/web-app/src/components/__tests__/empty-state.test.ts:377:       expect(() => emptyState!.setOptions({ title: 'New' })).not.toThrow();
apps/web-app/src/components/empty-state.ts:215:   setOptions(options: Partial<EmptyStateOptions>): void {

prod=6 test=6 docs=7

### onStatusChange

**Declared at apps/web-app/src/components/offline-banner.ts:179**

apps/web-app/src/components/__tests__/offline-banner.test.ts:303:   describe('onStatusChange', () => {
apps/web-app/src/components/__tests__/offline-banner.test.ts:308:       banner.onStatusChange(callback);
apps/web-app/src/components/__tests__/offline-banner.test.ts:318:       banner.onStatusChange(callback);
apps/web-app/src/components/__tests__/offline-banner.test.ts:328:       const unsubscribe = banner.onStatusChange(callback);
apps/web-app/src/components/offline-banner.ts:179:   onStatusChange(callback: (isOnline: boolean) => void): () => void {

prod=7 test=10 docs=7

### updateMessage

**Declared at apps/web-app/src/components/offline-banner.ts:199**

apps/web-app/src/components/__tests__/offline-banner.test.ts:341:   describe('updateMessage', () => {
apps/web-app/src/components/__tests__/offline-banner.test.ts:346:       banner.updateMessage();
apps/web-app/src/components/offline-banner.ts:199:   updateMessage(): void {

prod=8 test=12 docs=7

### getPreference

**Declared at apps/discord-worker/src/services/preferences.ts:156**

apps/discord-worker/src/services/preferences.exhaustive.test.ts:16:   getPreference,
apps/discord-worker/src/services/preferences.exhaustive.test.ts:338: describe('getPreference', () => {
apps/discord-worker/src/services/preferences.exhaustive.test.ts:343:     expect(await getPreference(kv, 'user-1', 'theme')).toBe('light');
apps/discord-worker/src/services/preferences.exhaustive.test.ts:349:     expect(await getPreference(kv, 'user-1', 'theme')).toBe(getDefaultValue('theme'));
apps/discord-worker/src/services/preferences.exhaustive.test.ts:357:       expect(await getPreference(kv, 'user-1', key)).toBeUndefined();
apps/discord-worker/src/services/preferences.ts:156: export async function getPreference<K extends PreferenceKey>(

prod=9 test=17 docs=7

### hideUserPresets

**Declared at apps/moderation-worker/src/services/ban-service.ts:631**

apps/moderation-worker/CHANGELOG.md:147:   Migration `0013_moderation_log_user_actions.sql` (presets-api, hand-run — see Deploy notes) makes `preset_id` nullab
apps/moderation-worker/src/services/ban-service.test.ts:10:   hideUserPresets,
apps/moderation-worker/src/services/ban-service.test.ts:662:   describe('hideUserPresets', () => {
apps/moderation-worker/src/services/ban-service.test.ts:666:       const count = await hideUserPresets(db as unknown as D1Database, 'user-123');
apps/moderation-worker/src/services/ban-service.test.ts:677:       await hideUserPresets(db as unknown as D1Database, 'user-456');
apps/moderation-worker/src/services/ban-service.test.ts:685:       const count = await hideUserPresets(db as unknown as D1Database, 'user-789');
apps/moderation-worker/src/services/ban-service.test.ts:693:       const count = await hideUserPresets(db as unknown as D1Database, 'user-123');
apps/moderation-worker/src/services/ban-service.ts:631: export async function hideUserPresets(db: D1Database, discordId: string): Promise<number> {
apps/moderation-worker/src/services/ban-service.ts:643:  * (FINDING-018) — this and `hideUserPresets` above are the only
docs/audits/2026-08-21-security/evidence/review-moderation-worker.md:112: - **Location:** `apps/moderation-worker/src/services/ban-service.ts:231-284` (`banUser`), `:289-338` (`unbanUser`), `:34
docs/audits/2026-08-21-security/evidence/review-moderation-worker.md:117: const presetsHidden = await hideUserPresets(db, discordId);
docs/audits/2026-08-21-security/evidence/review-moderation-worker.md:214: - **Fix:** either drop the `xivauth` branch from the autocomplete or add `xivauth_id` support to `getActiveBan`/`unbanUs

prod=11 test=23 docs=11

### restoreUserPresets

**Declared at apps/moderation-worker/src/services/ban-service.ts:628**

apps/moderation-worker/CHANGELOG.md:147:   Migration `0013_moderation_log_user_actions.sql` (presets-api, hand-run — see Deploy notes) makes `preset_id` nullab
apps/moderation-worker/src/services/ban-service.test.ts:11:   restoreUserPresets,
apps/moderation-worker/src/services/ban-service.test.ts:699:   describe('restoreUserPresets', () => {
apps/moderation-worker/src/services/ban-service.test.ts:703:       const count = await restoreUserPresets(db as unknown as D1Database, 'user-123');
apps/moderation-worker/src/services/ban-service.test.ts:714:       await restoreUserPresets(db as unknown as D1Database, 'user-456');
apps/moderation-worker/src/services/ban-service.test.ts:722:       const count = await restoreUserPresets(db as unknown as D1Database, 'user-789');
apps/moderation-worker/src/services/ban-service.test.ts:730:       await restoreUserPresets(db as unknown as D1Database, 'discord-id-abc');
apps/moderation-worker/src/services/ban-service.ts:628:  * this and `restoreUserPresets` below are the only preset-status-flipping
apps/moderation-worker/src/services/ban-service.ts:646: export async function restoreUserPresets(db: D1Database, discordId: string): Promise<number> {
docs/audits/2026-08-21-security/evidence/review-moderation-worker.md:112: - **Location:** `apps/moderation-worker/src/services/ban-service.ts:231-284` (`banUser`), `:289-338` (`unbanUser`), `:34

prod=13 test=29 docs=13

### sanitizeFetchRequest

**Declared at apps/moderation-worker/src/utils/url-sanitizer.ts:214**

apps/moderation-worker/src/utils/url-sanitizer.test.ts:6:   sanitizeFetchRequest,
apps/moderation-worker/src/utils/url-sanitizer.test.ts:337:   describe('sanitizeFetchRequest', () => {
apps/moderation-worker/src/utils/url-sanitizer.test.ts:339:       const result = sanitizeFetchRequest(
apps/moderation-worker/src/utils/url-sanitizer.test.ts:347:       const result = sanitizeFetchRequest('/api/data', {
apps/moderation-worker/src/utils/url-sanitizer.test.ts:360:       const result = sanitizeFetchRequest('/api', { method: 'POST' });
apps/moderation-worker/src/utils/url-sanitizer.test.ts:366:       const result = sanitizeFetchRequest('/api');
apps/moderation-worker/src/utils/url-sanitizer.test.ts:372:       const result = sanitizeFetchRequest('/api');
apps/moderation-worker/src/utils/url-sanitizer.test.ts:380:       const result = sanitizeFetchRequest(new URL('https://api.example.com/data'));
apps/moderation-worker/src/utils/url-sanitizer.test.ts:386:       const result = sanitizeFetchRequest('/api', { method: 'DELETE' });
apps/moderation-worker/src/utils/url-sanitizer.ts:214:  * const logData = sanitizeFetchRequest(url, {
apps/moderation-worker/src/utils/url-sanitizer.ts:233: export function sanitizeFetchRequest(
docs/audits/2026-01-05/xivdyetools-moderation-worker.md:557: - **Fetch Helpers**: `sanitizeFetchRequest()` and `sanitizeFetchResponse()` for consistent logging

prod=15 test=38 docs=14

### sanitizeFetchResponse

**Declared at apps/moderation-worker/src/utils/url-sanitizer.ts:262**

apps/moderation-worker/src/utils/url-sanitizer.test.ts:7:   sanitizeFetchResponse,
apps/moderation-worker/src/utils/url-sanitizer.test.ts:392:   describe('sanitizeFetchResponse', () => {
apps/moderation-worker/src/utils/url-sanitizer.test.ts:401:       const result = sanitizeFetchResponse(mockResponse);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:414:       const result = sanitizeFetchResponse(mockResponse);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:432:       const result = sanitizeFetchResponse(mockResponse);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:455:         const result = sanitizeFetchResponse(mockResponse);
apps/moderation-worker/src/utils/url-sanitizer.ts:262:  * const logData = sanitizeFetchResponse(response);
apps/moderation-worker/src/utils/url-sanitizer.ts:273: export function sanitizeFetchResponse(response: Response): {
docs/audits/2026-01-05/xivdyetools-moderation-worker.md:557: - **Fetch Helpers**: `sanitizeFetchRequest()` and `sanitizeFetchResponse()` for consistent logging

prod=17 test=44 docs=15

### sanitizeHeaders

**Declared at apps/moderation-worker/src/utils/url-sanitizer.ts:128**

apps/moderation-worker/src/utils/url-sanitizer.test.ts:4:   sanitizeHeaders,
apps/moderation-worker/src/utils/url-sanitizer.test.ts:154:   describe('sanitizeHeaders', () => {
apps/moderation-worker/src/utils/url-sanitizer.test.ts:160:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:169:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:178:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:187:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:196:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:205:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:214:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:224:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:236:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:245:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:255:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:268:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.test.ts:284:         const result = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.ts:128:  * const sanitized = sanitizeHeaders(headers);
apps/moderation-worker/src/utils/url-sanitizer.ts:135: export function sanitizeHeaders(
apps/moderation-worker/src/utils/url-sanitizer.ts:245:       ? sanitizeHeaders(options.headers as Record<string, string>)
apps/moderation-worker/src/utils/url-sanitizer.ts:283:     headers: sanitizeHeaders(response.headers),

prod=21 test=59 docs=15

### SENSITIVE_HEADERS

**Declared at apps/moderation-worker/src/utils/url-sanitizer.ts:68**

apps/moderation-worker/src/utils/url-sanitizer.ts:68: const SENSITIVE_HEADERS: string[] = [
apps/moderation-worker/src/utils/url-sanitizer.ts:147:     if (SENSITIVE_HEADERS.includes(lowerKey)) {

prod=23 test=59 docs=15

### getMeta

**Declared at apps/moderation-worker/src/services/bot-i18n.ts:203**

apps/moderation-worker/src/services/bot-i18n.test.ts:209:     describe('getMeta()', () => {
apps/moderation-worker/src/services/bot-i18n.test.ts:212:         const meta = translator.getMeta();
apps/moderation-worker/src/services/bot-i18n.test.ts:225:           const meta = translator.getMeta();
apps/moderation-worker/src/services/bot-i18n.ts:203:   getMeta(): LocaleData['meta'] {
docs/audits/2026-08-18-discord-worker-dead-code/CLEANUP_PLAN.md:60: 2. Remove the 211 orphan keys AND the 38 test-only keys from all six `packages/bot-logic/src/i18n/locales/*.json` (keep 
docs/audits/2026-08-18-discord-worker-dead-code/CLEANUP_PLAN.md:90: 2. DEAD-013: remove the `matches`/`count` plumbing from `executeMixer` (`MixerInput.count`, `MixerResult.matches`, `Mixe
docs/audits/2026-08-18-discord-worker-dead-code/DEAD_CODE_REPORT.md:74: | [DEAD-013](findings/DEAD-013.md) | `MixerResult.matches` dead runtime work, `getMeta()`, 3 core-type re-exports, unuse
docs/audits/2026-08-18-discord-worker-dead-code/DEAD_CODE_REPORT.md:184: 1. DEAD-011 bot locale orphans (decide `stats.*` first) + orphan-key gate · DEAD-013 `getMeta` keys · DEAD-028 `charac
docs/audits/2026-08-18-discord-worker-dead-code/by-category/unused-exports-and-types.md:19: | DEAD-013 | bot-logic mixer/translator/barrel | `MixerResult.matches` runtime work, `getMeta()`, 3 core-type re-exports
docs/audits/2026-08-18-discord-worker-dead-code/evidence/track-C-svg-botlogic.md:109: `Translator.getMeta()` (translator.ts:94-96) has **no caller** anywhere (0 non-test hits) — the `meta.flag`/`meta.nati
docs/audits/2026-08-18-discord-worker-dead-code/evidence/track-C-svg-botlogic.md:152: | meta | 4 | 0 | 0 | 2 | **2** | `flag`, `nativeName` — only reachable via the uncalled `getMeta()` |
docs/audits/2026-08-18-discord-worker-dead-code/evidence/track-C-svg-botlogic.md:188: | bot-logic `Translator.getMeta` | 4 |
docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-011.md:20: Whole namespaces dead: `swatch.*` 37/37 (the 4.x `/swatch color|grid` surface, replaced by the `.chara` frame), `stats.*
docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-013.md:1: # [DEAD-013]: bot-logic — dead runtime work in `/mixer` (`MixerResult.matches`), uncalled `Translator.getMeta()`, redu
docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-013.md:8: - `packages/bot-logic/src/i18n/translator.ts:94-96` — `Translator.getMeta()`; 0 callers anywhere; the `meta.flag` / `m
docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-013.md:13: `grep -rn "\.matches\b\|\.blendedHex\|\.inputDyes\|\.sweep" apps/discord-worker/src/handlers/commands/mixer-v4.ts` → 0
docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-013.md:28: 2. Delete `getMeta()` and the two `meta.*` keys ×6 (fold into DEAD-011).
docs/research/discord-alternatives/06c-bot-i18n.md:123:   getMeta(): LocaleData['meta'];
docs/research/discord-alternatives/06c-bot-i18n.md:412:   test('getMeta returns locale metadata', () => {
docs/research/discord-alternatives/06c-bot-i18n.md:414:     const meta = t.getMeta();
packages/bot-logic/CHANGELOG.md:304: - `meta.locale` / `meta.name` / `meta.flag` / `meta.nativeName` were **kept at the time** (unlike the rest of the test-o
packages/bot-logic/CHANGELOG.md:311: - **`Translator.getMeta()` deleted** (0 callers) along with `meta.flag` / `meta.nativeName` from `LocaleData` and all si
packages/bot-logic/src/i18n/__tests__/locale-orphans.test.ts:48:  *          `Translator.getMeta()` (DEAD-013 / Task 7) and were removed from

prod=24 test=63 docs=33

### truncateUnicodeSafe

**Declared at apps/presets-api/src/services/moderation-service.ts:53**

apps/presets-api/CHANGELOG.md:521:   - Added `truncateUnicodeSafe()` function that preserves Unicode code points
apps/presets-api/src/services/moderation-service.ts:53: export function truncateUnicodeSafe(str: string, maxLength: number, suffix = '…'): string {
apps/presets-api/tests/services/moderation-service.test.ts:11:     truncateUnicodeSafe,
apps/presets-api/tests/services/moderation-service.test.ts:101:     // truncateUnicodeSafe
apps/presets-api/tests/services/moderation-service.test.ts:104:     describe('truncateUnicodeSafe', () => {
apps/presets-api/tests/services/moderation-service.test.ts:106:             expect(truncateUnicodeSafe('hello', 10)).toBe('hello');
apps/presets-api/tests/services/moderation-service.test.ts:110:             const result = truncateUnicodeSafe('hello world', 8);
apps/presets-api/tests/services/moderation-service.test.ts:117:             const result = truncateUnicodeSafe(emoji, 3);
apps/presets-api/tests/services/moderation-service.test.ts:125:             const result = truncateUnicodeSafe('hello world', 8, '...');
apps/presets-api/tests/services/moderation-service.test.ts:130:             expect(truncateUnicodeSafe('hello', 5)).toBe('hello');
apps/presets-api/tests/services/moderation-service.test.ts:134:             expect(truncateUnicodeSafe('', 10)).toBe('');
apps/presets-api/tests/services/moderation-service.test.ts:138:             const result = truncateUnicodeSafe('hello', 1);
docs/audits/2025-12-24/03-CF-WORKERS-AUDIT.md:47: | PRESETS-HIGH-003 | UTF-8 truncation in embeds | Added `truncateUnicodeSafe()` function using `Array.from()` |
docs/audits/2026-09-05-documentation/findings/sweep-C2-workers.md:28: | PRE-20 | `moderation.md:125` | `truncateUnicodeSafe()` used in notifications | no caller (`moderation-service.ts:48-52
docs/projects/presets-api/moderation.md:162: `truncateUnicodeSafe()` splits by code points with `Array.from()` (`PRESETS-HIGH-003`) so a

prod=25 test=73 docs=37

### duplicateResponse

**Declared at apps/presets-api/src/utils/api-response.ts:174**

apps/presets-api/src/utils/api-response.ts:174: export function duplicateResponse(c: AnyContext, message: string): Response {
apps/presets-api/tests/utils/api-response.test.ts:17:   duplicateResponse,
apps/presets-api/tests/utils/api-response.test.ts:131:     it('duplicateResponse returns 409 DUPLICATE_RESOURCE', async () => {
apps/presets-api/tests/utils/api-response.test.ts:132:       const app = createApp((c) => duplicateResponse(c, 'Already exists'));

prod=26 test=76 docs=37

### VoteRow

**Declared at apps/presets-api/src/types.ts:189**

apps/presets-api/CHANGELOG.md:632: **Note:** Project-specific types (Env, PresetRow, CategoryRow, VoteRow) remain unchanged.
apps/presets-api/src/types.ts:189: export interface VoteRow {
apps/presets-api/tests/types.test.ts:21:     VoteRow,
apps/presets-api/tests/types.test.ts:319:         it('VoteRow should track vote timestamps', () => {
apps/presets-api/tests/types.test.ts:320:             const row: VoteRow = {

prod=27 test=79 docs=38

### CacheConfigKey

**Declared at apps/api-worker/src/universalis/config/cache.ts:49**

apps/api-worker/src/universalis/config/cache.test.ts:6: import { CACHE_CONFIGS, type CacheConfigKey } from './cache';
apps/api-worker/src/universalis/config/cache.test.ts:120:       const keys: CacheConfigKey[] = ['aggregated', 'dataCenters', 'worlds'];
apps/api-worker/src/universalis/config/cache.ts:49: export type CacheConfigKey = keyof typeof CACHE_CONFIGS;

prod=28 test=81 docs=38

### ENVIRONMENT

**Declared at apps/image-worker/src/types.ts:12**

apps/image-worker/CHANGELOG.md:191: - **`wrangler.toml` with the BUG-008 two-env layout from birth**: the top-level env is `xivdyetools-image-worker-dev` wi
apps/image-worker/CLAUDE.md:168: `ENVIRONMENT` member of `types.ts`'s `Env` interface is never actually populated — it is inert
apps/image-worker/src/index-limits.test.ts:24: const env: Env = { ENVIRONMENT: 'test' };
apps/image-worker/src/index.test.ts:5: const env: Env = { ENVIRONMENT: 'test' };
apps/image-worker/src/types.ts:12:   ENVIRONMENT?: string;

prod=29 test=83 docs=40

## B. Test structure lines

### apps/web-app/src/components/__tests__/empty-state.test.ts

**468 lines**

```
36:describe('EmptyState', () => {
61:  describe('Basic Rendering', () => {
62:    it('should render empty state wrapper', () => {
72:    it('should render title', () => {
83:    it('should render description when provided', () => {
95:    it('should not render description when not provided', () => {
111:  describe('Icon Rendering', () => {
115:    it('should hand out SVG glyphs from every preset', () => {
130:    it('should render SVG icon as innerHTML', () => {
142:    it('should have aria-hidden on icon', () => {
158:  describe('Action Buttons', () => {
159:    it('should render primary action button', () => {
174:    it('should call onAction when primary button clicked', () => {
190:    it('should render secondary action button', () => {
206:    it('should call onSecondaryAction when secondary button clicked', () => {
224:    it('should not render action container when no actions provided', () => {
235:    it('should not render button without callback', () => {
252:  describe('setOptions', () => {
253:    it('should update title', () => {
265:    it('should add description', () => {
279:    it('should update icon', () => {
296:  describe('Presets', () => {
297:    describe('noSearchResults', () => {
298:      it('should create preset with query in title', () => {
304:      it('should include clear action callback', () => {
312:    describe('allFilteredOut', () => {
313:      it('should create preset with reset action', () => {
322:    describe('noHarmonyResults', () => {
323:      it('should create preset with select dye action', () => {
331:    describe('error', () => {
332:      it('should create error preset with message', () => {
338:      it('should include retry action', () => {
346:    describe('loading', () => {
347:      it('should create loading preset without actions', () => {
360:  describe('createEmptyState', () => {
361:    it('should create and initialize empty state', () => {
370:    it('should return initialized component', () => {
381:  describe('getEmptyStateHTML', () => {
382:    it('should return valid HTML string', () => {
394:    it('should include description when provided', () => {
405:    it('should render SVG icons directly', () => {
416:    it('should reject non-SVG icons outright', () => {
428:    it('escapes markup in the title and description', () => {
455:  describe('Lifecycle', () => {
456:    it('should clean up on destroy', () => {
```

### apps/web-app/src/components/__tests__/offline-banner.test.ts

**391 lines**

```
26:describe('OfflineBanner', () => {
61:  describe('Singleton', () => {
62:    it('should return same instance on multiple getInstance calls', () => {
69:    it('should create new instance after destroy', () => {
83:  describe('Initialization', () => {
84:    it('should create banner element on initialize', () => {
91:    it('should have role="alert"', () => {
99:    it('should have aria-live="polite"', () => {
107:    it('should contain offline message', () => {
116:    it('should contain dismiss button', () => {
129:  describe('Online Status', () => {
130:    it('should report online status correctly', () => {
137:    it('should report offline status correctly', () => {
149:  describe('Banner Visibility', () => {
150:    it('should hide banner when online', () => {
159:    it('should show banner when offline', () => {
169:    it('should add body padding when banner shown', () => {
178:    it('should remove body padding when banner hidden', () => {
192:  describe('Programmatic Control', () => {
193:    it('should show banner with showBanner()', () => {
204:    it('should hide banner with hideBanner()', () => {
220:  describe('Dismiss Button', () => {
221:    it('should hide banner when dismiss button clicked', () => {
236:    it('should have aria-label on dismiss button', () => {
249:  describe('Online/Offline Events', () => {
250:    it('should update on online event', () => {
262:    it('should update on offline event', () => {
274:    it('should show banner when going offline', () => {
286:    it('should hide banner when going online', () => {
303:  describe('onStatusChange', () => {
304:    it('should call callback on online event', () => {
314:    it('should call callback on offline event', () => {
324:    it('should return unsubscribe function', () => {
341:  describe('updateMessage', () => {
342:    it('should update message text', () => {
357:  describe('Cleanup', () => {
358:    it('should remove banner element on destroy', () => {
370:    it('should reset body padding on destroy', () => {
382:    it('should clear singleton instance on destroy', () => {
```

### apps/moderation-worker/src/services/ban-service.test.ts

**1134 lines**

```
16:describe('ban-service', () => {
29:  describe('isUserBannedByDiscordId', () => {
30:    it('should return true when user is banned', async () => {
38:    it('should return false when user is not banned', async () => {
45:    it('should check for unbanned_at IS NULL', async () => {
53:    it('should use correct binding', async () => {
62:  describe('searchPresetAuthors', () => {
63:    it('should return preset authors with counts', async () => {
89:    it('should escape SQL LIKE special characters', async () => {
98:    it('should exclude already banned users', async () => {
107:    it('should use LIKE with ESCAPE clause', async () => {
115:    it('should apply limit parameter', async () => {
123:    it('should order by preset count DESC and name ASC', async () => {
131:    it('should handle empty results', async () => {
139:    it('should handle null results', async () => {
147:    it('should fallback to simpler query on error', async () => {
165:  describe('searchBannedUsers', () => {
166:    it('should return currently banned users', async () => {
198:    it('should escape special characters in search query', async () => {
207:    it('should search both username and discord_id', async () => {
226:    it('lists the top of the list for an empty query rather than nothing', async () => {
239:    it('still bounds an over-long query', async () => {
249:    it('should only return users where unbanned_at IS NULL', async () => {
257:    it('should handle errors gracefully', async () => {
267:    it('should handle empty results', async () => {
276:  describe('getUserForBanConfirmation', () => {
277:    it('should return user details with recent presets', async () => {
331:    it('falls back to the raw snowflake for a user with no presets', async () => {
349:    it('should handle user with fewer than 3 presets', async () => {
368:    it('should construct correct share URLs', async () => {
388:  describe('banUser', () => {
389:    it('should successfully ban user and hide presets', async () => {
415:    it('should prevent double-banning', async () => {
432:    it('should insert ban record with correct data', async () => {
465:    it('should generate UUID for ban record', async () => {
485:    it('should handle missing banned_users table', async () => {
502:    it('should handle database errors', async () => {
521:    it('should hide user presets after banning', async () => {
543:  describe('unbanUser', () => {
544:    it('should successfully unban user and restore presets', async () => {
571:    it('should fail when user is not currently banned', async () => {
585:    it('should update ban record with unban timestamp', async () => {
620:    it('should fail if ban record update fails', async () => {
641:    it('should handle database errors', async () => {
662:  describe('hideUserPresets', () => {
663:    it('should hide approved presets', async () => {
674:    it('should only hide approved presets, not pending or rejected', async () => {
682:    it('should return 0 when no presets to hide', async () => {
690:    it('should handle undefined changes', async () => {
699:  describe('restoreUserPresets', () => {
700:    it('should restore hidden presets to approved status', async () => {
711:    it('should only restore hidden presets, not rejected or pending', async () => {
719:    it('should return 0 when no presets to restore', async () => {
727:    it('should use correct binding', async () => {
741:  describe('getActiveBan', () => {
742:    it('should return active ban record', async () => {
770:    it('should return null when no active ban exists', async () => {
778:    it('should query for unbanned_at IS NULL', async () => {
788:    it('should use correct binding', async () => {
799:describe('ban-service hardening (FINDING-034)', () => {
812:  describe('banUser (MOD-4 atomicity, MOD-8 safe errors)', () => {
813:    it('writes the ban row and hides presets in ONE db.batch', async () => {
839:    it('maps a UNIQUE-constraint race to "already banned" instead of echoing D1', async () => {
858:    it('never returns a raw D1 message; keeps the cause for logging', async () => {
879:  describe('unbanUser (MOD-4 atomicity, MOD-8 safe errors)', () => {
880:    it('closes the ban row and restores presets in ONE db.batch', async () => {
896:    it('never returns a raw D1 message; keeps the cause for logging', async () => {
911:  describe('isPresetAuthorBanned (MOD-4: approve must refuse banned authors)', () => {
912:    it('returns true when the preset author has an active ban', async () => {
924:    it('returns false otherwise', async () => {
936:describe('ban-service moderation_log rows (FINDING-018)', () => {
965:  describe('banUser', () => {
974:    it('batches the ban row, the hide rows, the banned_users insert and the hide UPDATE in that order', async () => {
992:    it('binds a UUID id, the moderator, the reason and the ban target — and never the username', async () => {
1004:    it('logs one hide row per preset the UPDATE flips, selected before it flips them', async () => {
1026:    it('tells the moderator to apply migration 0013 when the schema is out of date', async () => {
1056:  describe('unbanUser', () => {
1065:    it('batches the ban-row UPDATE, the unban row, the restore rows and the restore UPDATE in that order', async () => {
1084:    it('binds a UUID id, the moderator and the target on the unban row, with a NULL reason', async () => {
1093:    it('logs one restore row per preset the UPDATE flips, selected before it flips them', async () => {
1105:    it('writes no unban row when another moderator closed the ban first', async () => {
```

### apps/moderation-worker/src/utils/url-sanitizer.test.ts

**462 lines**

```
10:describe('url-sanitizer', () => {
11:  describe('sanitizeUrl', () => {
12:    describe('Discord webhook URLs', () => {
13:      it('should redact webhook token in simple webhook URL', () => {
20:      it('should redact webhook token in full URL', () => {
28:      it('should redact webhook token with message path', () => {
35:      it('should redact webhook token with message ID', () => {
42:      it('should handle URL object', () => {
49:      it('should not redact short tokens (under 64 chars)', () => {
57:    describe('query parameter tokens', () => {
58:      it('should redact api_key parameter', () => {
65:      it('should redact token parameter', () => {
72:      it('should redact key parameter', () => {
79:      it('should redact secret parameter', () => {
86:      it('should redact password parameter', () => {
93:      it('should handle multiple sensitive params', () => {
100:      it('should be case-insensitive for param names', () => {
108:    describe('Bearer tokens in text', () => {
109:      it('should redact Bearer token', () => {
116:      it('should handle lowercase bearer', () => {
124:      it('should not redact short Bearer values', () => {
132:    describe('safe URLs', () => {
133:      it('should not modify normal URLs', () => {
140:      it('should not modify URLs with normal query params', () => {
147:      it('should handle empty string', () => {
154:  describe('sanitizeHeaders', () => {
155:    describe('sensitive headers', () => {
156:      it('should redact Authorization header', () => {
165:      it('should redact x-api-key header', () => {
174:      it('should redact x-auth-token header', () => {
183:      it('should redact x-request-signature header', () => {
192:      it('should redact cookie header', () => {
201:      it('should redact set-cookie header', () => {
210:      it('should handle short sensitive values', () => {
219:      it('should be case-insensitive for header names', () => {
231:    describe('non-sensitive headers', () => {
232:      it('should not modify Content-Type', () => {
241:      it('should not modify Accept header', () => {
250:      it('should not modify custom safe headers', () => {
262:    describe('Headers instance', () => {
263:      it('should handle Headers object', () => {
276:    describe('mixed headers', () => {
277:      it('should handle mix of sensitive and non-sensitive', () => {
294:  describe('sanitizeErrorMessage', () => {
295:    it('should sanitize URLs in error messages', () => {
302:    it('should handle string errors', () => {
309:    it('should sanitize stack traces', () => {
317:    it('should handle non-string, non-error values', () => {
324:    it('should handle null and undefined', () => {
329:    it('should sanitize Bearer tokens in error messages', () => {
337:  describe('sanitizeFetchRequest', () => {
338:    it('should sanitize URL', () => {
346:    it('should sanitize headers', () => {
359:    it('should include method', () => {
365:    it('should default method to GET', () => {
371:    it('should handle missing options', () => {
379:    it('should handle URL object', () => {
385:    it('should handle missing headers in options', () => {
392:  describe('sanitizeFetchResponse', () => {
393:    it('should sanitize response URL', () => {
406:    it('should include status and statusText', () => {
420:    it('should sanitize response headers', () => {
438:    it('should handle various status codes', () => {
```

### apps/moderation-worker/src/services/bot-i18n.test.ts

**349 lines**

```
20:describe('bot-i18n', () => {
29:  describe('Translator', () => {
30:    describe('constructor', () => {
31:      it('should create translator with English locale', () => {
37:      it('should create translator with Japanese locale', () => {
43:      it('should create translator with logger', () => {
49:      it('should fallback to English for unsupported locales', () => {
59:    describe('t() - translation', () => {
60:      it('should translate simple keys', () => {
67:      it('should translate nested keys', () => {
74:      it('should translate deeply nested keys', () => {
85:      it('should interpolate variables', () => {
93:      it('should interpolate multiple variables', () => {
101:      it('should handle numeric variable interpolation', () => {
109:      it('should return key for missing translations', () => {
117:      it('should log warning for missing translations when logger provided', () => {
127:      it('should not log warning without logger', () => {
136:      it('should handle missing variables gracefully', () => {
145:      it('should handle extra variables gracefully', () => {
159:      it('should translate ban-related keys', () => {
169:      it('should translate category keys', () => {
181:    describe('fallback behavior', () => {
182:      it('should fallback to English for non-English locale missing keys', () => {
189:      it('should use English data when locale not found', () => {
197:    describe('getLocale()', () => {
198:      it('should return current locale', () => {
209:    describe('getMeta()', () => {
210:      it('should return locale metadata for English', () => {
220:      it('should return locale metadata for all supported locales', () => {
236:  describe('createUserTranslator', () => {
237:    it('should create translator with user preference from KV', async () => {
246:    it('should fallback to Discord locale when no preference', async () => {
252:    it('should fallback to English when no preference and no Discord locale', async () => {
258:    it('should use user preference over Discord locale', async () => {
266:    it('should pass logger to translator', async () => {
274:    it('should handle Discord locale mapping', async () => {
281:    it('should handle unsupported Discord locale', async () => {
289:  describe('interpolation edge cases', () => {
290:    it('should handle empty string interpolation', () => {
298:    it('should handle zero as variable value', () => {
306:    it('should handle special characters in variables', () => {
314:    it('should handle unicode in variables', () => {
323:  describe('path traversal edge cases', () => {
324:    it('should return key for null in path', () => {
332:    it('should return key for array index access', () => {
340:    it('should handle single-segment keys', () => {
```

### apps/discord-worker/src/services/preferences.exhaustive.test.ts

**465 lines**

```
91:describe('validatePreferenceValue', () => {
118:  describe('the seven boolean keys', () => {
138:  it('parses a numeric string for count', () => {
148:  describe('world (FINDING-019)', () => {
149:    it('rejects a value longer than the schema cap', () => {
156:    it('accepts a value exactly at the cap', () => {
180:    it('accepts a padded value — length is measured after trimming', () => {
185:    it('still rejects a whitespace-only value', () => {
194:describe('setPreference — one arm per key', () => {
226:  it('refuses an invalid value without touching KV', async () => {
233:  it('reports a KV write failure rather than claiming success', async () => {
247:  it('logs the shape of a failed value, never the value itself', async () => {
262:  it('records no length for a non-string failed value', async () => {
279:  it('stores a world without its surrounding whitespace', async () => {
285:  it('refuses an over-long world without touching KV', async () => {
292:  it('survives a KV write failure with no logger', async () => {
302:  it('preserves other preferences when writing one', async () => {
312:describe('getUserPreferences', () => {
313:  it('returns the stored object', async () => {
320:  it('returns an empty object rather than throwing on malformed JSON', async () => {
330:  it('returns an empty object rather than throwing when KV itself fails', async () => {
338:describe('getPreference', () => {
339:  it('returns the stored value when one is set', async () => {
346:  it('falls back to the system default when unset', async () => {
362:describe('resetPreference', () => {
363:  it('removes a set preference', async () => {
375:  it('deletes the whole record once the last real preference goes', async () => {
384:  it('drops every preference when no key is given', async () => {
393:  it('is a no-op for a preference that was never set', async () => {
397:  it('reports a KV failure', async () => {
408:  it('reports a KV failure with no logger', async () => {
416:describe('getDefaultValue', () => {
431:  it('returns a default that its own validator accepts', () => {
440:describe('getAffectedCommands', () => {
```

### apps/presets-api/tests/services/moderation-service.test.ts

**734 lines**

```
21:describe('ModerationService', () => {
40:    describe('escapeRegex', () => {
41:        it('should escape special regex characters', () => {
50:        it('should leave normal characters unchanged', () => {
60:    describe('compileProfanityPatterns', () => {
61:        it('should compile word lists into CompiledProfanity structure', () => {
73:        it('should create case-insensitive patterns', () => {
81:        it('should use word boundary matching', () => {
93:        it('should handle empty word lists', () => {
104:    describe('truncateUnicodeSafe', () => {
105:        it('should return string unchanged if within limit', () => {
109:        it('should truncate long strings with ellipsis', () => {
115:        it('should handle emoji/surrogate pairs correctly', () => {
124:        it('should use custom suffix', () => {
129:        it('should handle exact length strings', () => {
133:        it('should handle empty string', () => {
137:        it('should handle maxLength of 1 with suffix', () => {
147:    describe('checkLocalFilter', () => {
148:        it('should return null for clean content with custom patterns', () => {
154:        it('should flag content matching custom pattern in name', () => {
164:        it('should flag content matching custom pattern in description only', () => {
174:        it('should check against multiple patterns', () => {
184:        it('should use injected patterns when set via _setTestPatterns', () => {
195:        it('should return clean after patterns are reset', () => {
207:        it('should handle case insensitivity correctly', () => {
224:    describe('moderateContent - Local Filter', () => {
225:        it('should pass clean content', async () => {
238:        it('should pass content when local lists are empty (relies on Perspective API)', async () => {
253:        it('should return local method when no Perspective API configured', async () => {
266:        it('should handle empty name gracefully', async () => {
278:        it('should handle empty description gracefully', async () => {
290:        it('should handle unicode content gracefully', async () => {
302:        it('should handle special regex characters in content', async () => {
315:        it('should handle very long content', async () => {
327:        it('should handle content with multiple whitespace', async () => {
339:        it('should return early when local filter catches flagged content', async () => {
361:        it('should flag description when local filter matches only description', async () => {
385:    describe('moderateContent - Perspective API', () => {
386:        it('should skip Perspective API if not configured', async () => {
394:        it('should call Perspective API when configured', async () => {
422:        it('should flag high toxicity from Perspective API', async () => {
451:        it('should flag any score above threshold', async () => {
477:        it('should handle missing score attributes from Perspective API', async () => {
505:        it('should call Perspective API regardless since local lists are empty', async () => {
539:    describe('moderateContent - Perspective request hygiene (FINDING-006)', () => {
556:        it('sends the API key in the x-goog-api-key header and never in the URL', async () => {
572:        it('asks Perspective not to retain the comment, and keeps the abort signal', async () => {
589:    describe('moderateContent - fails closed when Perspective cannot answer (FINDING-005)', () => {
679:describe('CJK profanity matching (BUG-002)', () => {
688:    it('compiles CJK words into cjkPattern, not the \\b-anchored one', () => {
698:    it('keeps ASCII words in the \\b-anchored pattern', () => {
708:    it('splits a mixed list across both patterns', () => {
731:    it('still accepts clean CJK text', () => {
```

### apps/presets-api/tests/utils/api-response.test.ts

**160 lines**

```
29:describe('API Response Utilities', () => {
30:  describe('errorResponse', () => {
31:    it('should return error JSON with default 400 status', async () => {
44:    it('should accept custom status code', async () => {
51:  describe('successResponse', () => {
52:    it('should return success JSON without message', async () => {
62:    it('should include message when provided', async () => {
75:    it('should accept custom status code', async () => {
82:  describe('common error responses', () => {
83:    it('invalidJsonResponse returns 400 INVALID_JSON', async () => {
92:    it('validationErrorResponse returns 400 VALIDATION_ERROR', async () => {
102:    it('unauthorizedResponse returns 401 with default message', async () => {
112:    it('forbiddenResponse returns 403', async () => {
121:    it('notFoundResponse returns 404 with resource name', async () => {
131:    it('duplicateResponse returns 409 DUPLICATE_RESOURCE', async () => {
141:    it('internalErrorResponse returns 500 with default message', async () => {
151:    it('internalErrorResponse returns 500 with custom message', async () => {
```

### apps/presets-api/tests/types.test.ts

**467 lines**

```
27:describe('Types', () => {
32:    describe('PresetStatus', () => {
33:        it('should allow valid status values', () => {
46:    describe('PresetCategory', () => {
47:        it('should allow valid category values', () => {
65:    describe('AuthSource', () => {
66:        it('should allow valid auth source values', () => {
77:    describe('CommunityPreset', () => {
78:        it('should have all required fields', () => {
103:        it('should allow optional fields', () => {
139:    describe('PresetSubmission', () => {
140:        it('should have required submission fields', () => {
158:    describe('PresetEditRequest', () => {
159:        it('should allow partial updates', () => {
185:    describe('PresetFilters', () => {
186:        it('should allow all optional filter fields', () => {
201:        it('should allow empty filters', () => {
212:    describe('Response Types', () => {
213:        it('PresetListResponse should have pagination fields', () => {
226:        it('VoteResponse should have vote result fields', () => {
252:        it('ModerationResult should have moderation outcome fields', () => {
275:    describe('Row Types', () => {
276:        it('PresetRow should store JSON as strings', () => {
305:        it('CategoryRow should have display ordering', () => {
319:        it('VoteRow should track vote timestamps', () => {
334:    describe('AuthContext', () => {
335:        it('should represent unauthenticated state', () => {
346:        it('should represent authenticated user', () => {
359:        it('should represent moderator', () => {
376:    describe('RateLimitResult', () => {
377:        it('should indicate allowed submission', () => {
389:        it('should indicate rate limited', () => {
405:    describe('ModerationLogEntry', () => {
406:        it('should have all moderation action details', () => {
420:        it('should allow all action types', () => {
442:    describe('CategoryMeta', () => {
443:        it('should have optional preset_count', () => {
```

### apps/api-worker/src/universalis/config/cache.test.ts

**140 lines**

```
9:describe('CACHE_CONFIGS', () => {
10:  describe('structure validation', () => {
11:    it('should have all required endpoint configurations', () => {
17:    it('should have correct CacheConfig structure for all configs', () => {
31:    it('should have all numeric TTL values', () => {
38:    it('should have string keyPrefix values', () => {
46:  describe('aggregated config', () => {
49:    it('should have short TTL for frequently changing price data', () => {
54:    it('should have reasonable SWR window', () => {
59:    it('should have SWR window shorter than TTL', () => {
63:    it('should have correct key prefix', () => {
68:  describe('dataCenters config', () => {
71:    it('should have long TTL for static data', () => {
76:    it('should have longer SWR window for static data', () => {
81:    it('should have correct key prefix', () => {
86:  describe('worlds config', () => {
89:    it('should have long TTL for static data', () => {
94:    it('should have longer SWR window for static data', () => {
99:    it('should have correct key prefix', () => {
104:  describe('TTL consistency', () => {
105:    it('should have positive TTL values', () => {
112:    it('should have static data configs with longer TTLs than dynamic data', () => {
118:  describe('type safety', () => {
119:    it('should allow type-safe access to config keys', () => {
126:    it('should satisfy CacheConfig interface', () => {
```

## C. Bundle before at c40e7e63 (KiB raw / gzip)

