# Reviewed source excerpts

Snapshot commit: 0332fcc5768a4477301ed5b15590eee16a772f87

## packages/auth/src/discord.ts

SHA256: `9317ce6733398243733e99444b229be8f777834feb62191a566035cca4cb98ba`

```text
77:   // Check Content-Length header first (if present) to reject obviously large requests
78:   const contentLength = request.headers.get('Content-Length');
79:   if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
80:     return {
81:       isValid: false,
82:       body: '',
83:       error: 'Request body too large',
84:     };
85:   }
86:
87:   // Get required headers
88:   const signature = request.headers.get('X-Signature-Ed25519');
89:   const timestamp = request.headers.get('X-Signature-Timestamp');
90:
91:   if (!signature || !timestamp) {
92:     return {
93:       isValid: false,
94:       body: '',
95:       error: 'Missing signature headers',
96:     };
97:   }
98:
99:   // FINDING-021: freshness — reject stale or far-future timestamps BEFORE
100:   // reading the body so a replayed capture costs nothing
101:   const maxAge = options.maxTimestampAgeSeconds ?? DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS;
102:   const futureSkew = options.maxFutureSkewSeconds ?? DEFAULT_FUTURE_SKEW_SECONDS;
103:   const timestampSeconds = Number(timestamp);
104:   if (!Number.isFinite(timestampSeconds)) {
105:     return { isValid: false, body: '', error: 'Invalid signature timestamp' };
106:   }
107:   const nowSeconds = Date.now() / 1000;
108:   if (nowSeconds - timestampSeconds > maxAge || timestampSeconds - nowSeconds > futureSkew) {
109:     return { isValid: false, body: '', error: 'Signature timestamp outside the accepted window' };
110:   }
111:
112:   // Get the raw body
113:   const body = await request.text();
114:
115:   // Verify actual body size (Content-Length can be spoofed).
116:   // BUG-059: measure BYTES — String.length counts UTF-16 code units, so CJK
117:   // (3 bytes/char) and emoji (4 bytes) payloads could exceed the intended
118:   // byte cap by up to ~4× before this check fired.
119:   if (new TextEncoder().encode(body).byteLength > maxBodySize) {
120:     return {
121:       isValid: false,
122:       body: '',
123:       error: 'Request body too large',
124:     };
125:   }
126:
127:   // Verify the signature using discord-interactions library
128:   try {
129:     const isValid = await verifyKey(body, signature, timestamp, publicKey);
130:
131:     return {
132:       isValid,
133:       body,
134:       error: isValid ? undefined : 'Invalid signature',
135:     };
136:   } catch (error) {
137:     return {
138:       isValid: false,
139:       body,
140:       error: error instanceof Error ? error.message : 'Verification failed',
141:     };
142:   }
143: }

```

## apps/discord-worker/src/index.ts

SHA256: `a0441b1dda1f13e1a23386d6d62520f1ae328356af52b81f89f9d04787acbafe`

```text
315:     const imageRes = await sendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
316:       embeds: [
317:         {
318:           title: `🖼️ ${adminT.t('webhook.previewImagePending')}`,
319:           description: `**${safeName}**`,
320:           color: STATUS_DISPLAY.pending.color,
321:           // Built here rather than read from the API: for a pending image the
322:           // API withholds preview_image_url by design, and this embed is
323:           // exactly where an unapproved image is meant to be seen.
324:           ...(payload.preview_image_key
325:             ? { image: { url: `https://shots.xivdyetools.app/${payload.preview_image_key}` } }
326:             : {}),
327:           footer: { text: `ID: ${payload.preset.id}` },
328:         },
329:       ],
330:       components: [
331:         {
332:           type: 1, // Action Row
333:           components: [
334:             {
335:               type: 2, // Button
336:               style: 3, // Success (green)
337:               label: adminT.t('webhook.buttons.approve'),
338:               custom_id: `previewimg_approve_${payload.preset.id}`,
339:               emoji: { name: '✅' },
340:             },
341:             {
342:               type: 2, // Button
343:               style: 4, // Danger (red)
344:               label: adminT.t('webhook.buttons.reject'),
345:               custom_id: `previewimg_reject_${payload.preset.id}`,
346:               emoji: { name: '❌' },
347:             },
348:           ],
349:         },
350:       ],

491: app.post('/webhooks/github', async (c) => {
492:   const env = c.env;
493:   const logger = c.get('logger');
494:
495:   // Ensure webhook secret is configured
496:   if (!env.GITHUB_WEBHOOK_SECRET) {
497:     logger.error('GitHub webhook secret not configured');
498:     return c.json({ error: 'Unauthorized' }, 401);
499:   }
500:
501:   if (!env.ANNOUNCEMENT_CHANNEL_ID) {
502:     logger.error('Announcement channel ID not configured');
503:     return c.json({ error: 'Not configured' }, 500);
504:   }
505:
506:   // BUG-005: Check Content-Length before reading body to avoid buffering oversized payloads
507:   const contentLength = parseInt(c.req.header('content-length') || '0', 10);
508:   if (contentLength > GITHUB_WEBHOOK_MAX_BYTES) {
509:     logger.warn('GitHub webhook payload too large', { contentLength });
510:     return c.json({ error: 'Payload too large' }, 413);
511:   }
512:
513:   // Read raw body for signature verification
514:   const rawBody = await c.req.text();
515:
516:   // Defense-in-depth: verify actual body size (Content-Length can be missing or spoofed)
517:   if (rawBody.length > GITHUB_WEBHOOK_MAX_BYTES) {
518:     logger.warn('GitHub webhook body exceeds limit despite Content-Length', {
519:       size: rawBody.length,
520:     });
521:     return c.json({ error: 'Payload too large' }, 413);
522:   }
523:
524:   // Verify GitHub signature (HMAC-SHA256)
525:   const signature = c.req.header('X-Hub-Signature-256') || '';
526:   const { verifyGitHubSignature } = await import('./utils/github-verify.js');
527:
528:   if (!(await verifyGitHubSignature(env.GITHUB_WEBHOOK_SECRET, rawBody, signature))) {
529:     logger.error('GitHub webhook signature verification failed');
530:     return c.json({ error: 'Unauthorized' }, 401);
531:   }
532:
533:   // FINDING-021: the signature says the sender holds the secret, not what the
534:   // body is — GitHub signs pings and every other event type too. The event name

681: app.post('/', async (c) => {
682:   const env = c.env;
683:
684:   // Verify the request signature
685:   const { isValid, body, error } = await verifyDiscordRequest(c.req.raw, env.DISCORD_PUBLIC_KEY);
686:
687:   const logger = c.get('logger');
688:
689:   if (!isValid) {
690:     logger.error('Signature verification failed', undefined, { error: error || 'Unknown error' });
691:     return unauthorizedResponse(error);
692:   }
693:
694:   // Parse the interaction
695:   let interaction: DiscordInteraction;
696:   try {

```

## apps/discord-worker/src/handlers/buttons/preview-image.ts

SHA256: `2395098ad722c9aa5995de946ffb04ab70bf7e993f6096cfe14013039c5e634c`

```text
153:
154: async function processPreviewImageAction(
155:   interaction: ButtonInteraction,
156:   env: Env,
157:   action: PreviewImageAction,
158:   presetId: string,
159:   moderatorId: string,
160:   moderatorName: string | undefined,
161:   logger?: ExtendedLogger,
162: ): Promise<void> {
163:   const adminT = createTranslator('en');
164:   const displayName = moderatorName ? `<@${moderatorId}>` : moderatorId;
165:
166:   try {
167:     await presetApi.setPreviewImageStatus(env, presetId, action, moderatorId, moderatorName);
168:
169:     if (interaction.channel_id && interaction.message?.id) {
170:       const originalEmbed = interaction.message.embeds?.[0] || {};
171:       const footerText =
172:         action === 'approve'
173:           ? adminT.t('previewImage.approvedFooter', { moderator: displayName })
174:           : adminT.t('previewImage.rejectedFooter', { moderator: displayName });
175:

```

## apps/moderation-worker/src/index.ts

SHA256: `04f0ac2ee007c4951b64508d362f0322d8afdee0414bb0df2f02394fdc227b96`

```text
155: app.post('/', async (c) => {
156:   const env = c.env;
157:
158:   // Verify the request signature
159:   const { isValid, body, error } = await verifyDiscordRequest(
160:     c.req.raw,
161:     env.DISCORD_PUBLIC_KEY
162:   );
163:
164:   const logger = c.get('logger');
165:
166:   if (!isValid) {
167:     logger.error('Signature verification failed', undefined, { error: error || 'Unknown error' });
168:     return unauthorizedResponse(error);
169:   }
170:
171:   // Parse the interaction with safety checks
172:   const parseResult = safeParseJSON<DiscordInteraction>(body, {
173:     maxDepth: 10, // Discord interactions are shallow
174:     validateStructure: true,
175:     freezeResult: true,

```

## apps/presets-api/src/handlers/moderation.ts

SHA256: `1b3c469aa0385aa3e01f1e9716a2a4b6915620cf522425645b9044f0c08bc8db`

```text
198:   }
199:
200:   // Get current preset
201:   const preset = await getPresetById(c.env.DB, presetId);
202:   if (!preset) {
203:     return notFoundResponse(c, 'Preset');
204:   }
205:
206:   // Check if there are previous values to revert to
207:   if (!preset.previous_values) {
208:     return validationErrorResponse(c, 'This preset has no previous values to revert to');
209:   }
210:
211:   // BUG-020 (2026-07-18 audit): revert + audit log in one atomic batch — the
212:   // old ordering (revert first, log after) could lose the audit trail for a
213:   // revert that did happen. changes() gates the log on the revert applying.
214:   const logId = crypto.randomUUID();
215:   const now = new Date().toISOString();
216:
217:   // BUG-041: `prepareRevert` sets `status = 'approved'` unconditionally, so it
218:   // has the identical exposure to the status route above — reverting a preset
219:   // back into the index can collide with whatever took its signature meanwhile.
220:   let revertResult: D1Result<PresetRow>;
221:   try {
222:     [revertResult] = await c.env.DB.batch<PresetRow>([
223:       prepareRevert(c.env.DB, presetId, preset.previous_values, now),
224:       c.env.DB
225:         .prepare(
226:           `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
227:            SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`
228:         )
229:         .bind(logId, presetId, auth.userDiscordId!, 'revert', body.reason, now),
230:     ]);
231:   } catch (error) {
232:     if (!isDyeSignatureCollision(error)) throw error;
233:     return dyeSignatureConflictResponse(c, presetId, preset.dye_signature);

254: moderationRouter.patch('/:presetId/preview-image', async (c) => {
255:   const modError = requireModerator(c);
256:   if (modError) return modError;
257:
258:   const presetId = c.req.param('presetId');
259:
260:   let body: { action?: string };
261:   try {
262:     body = await c.req.json();
263:   } catch {
264:     return invalidJsonResponse(c);
265:   }
266:
267:   if (body.action !== 'approve' && body.action !== 'reject') {
268:     return validationErrorResponse(c, "action must be 'approve' or 'reject'");
269:   }
270:
271:   // Row-level read: CommunityPreset hides preview_image_key by design.
272:   const preset = await getPresetImageState(c.env.DB, presetId);
273:   if (!preset) {
274:     return notFoundResponse(c, 'Preset');
275:   }
276:
277:   const now = new Date().toISOString();
278:
279:   if (body.action === 'approve') {
280:     await c.env.DB.prepare(
281:       `UPDATE presets SET preview_image_status = 'approved', updated_at = ? WHERE id = ?`
282:     )
283:       .bind(now, presetId)
284:       .run();
285:     return c.json({ success: true, preview_image_status: 'approved' });
286:   }
287:
288:   // Capture the key before the UPDATE clears it — deletePreviewImage below
289:   // needs the pre-update value.
290:   const previousKey = preset.preview_image_key;
291:
292:   // DB UPDATE before the R2 delete, deliberately (Task 4 ruling, same logic
293:   // applies here): if the UPDATE throws, leaving the delete undone just
294:   // orphans the object in R2 — invisible and cheap to clean up later. Delete
295:   // first would risk the opposite: a row still pointing at a key that no
296:   // longer exists, so the card serves a broken image. Never trade a broken
297:   // live image for a tidy bucket.
298:   await c.env.DB.prepare(
299:     `UPDATE presets SET preview_image_key = NULL, preview_image_status = 'none', updated_at = ? WHERE id = ?`
300:   )
301:     .bind(now, presetId)
302:     .run();
303:
304:   // The DB already reflects the rejection, so the moderator's action has
305:   // succeeded. An R2 hiccup here must not 500 a request whose state is already
306:   // correct — the orphaned object is the accepted failure mode by design.
307:   try {
308:     await deletePreviewImage(c.env, previousKey, c.get('logger'));
309:   } catch (err) {
310:     c.get('logger')?.error('[preview-image] R2 delete failed after rejection', err, { presetId });
311:   }
312:
313:   return c.json({ success: true, preview_image_status: 'none' });

```

## apps/presets-api/src/handlers/presets.ts

SHA256: `14ef8369a5e2bd9fb2d5f26546abf52a0151bb588f96a0e20acc380c8e1be05b`

```text
463: function ownerEditOutcome(
464:   status: string,
465:   { textChanged, flaggedByThisEdit }: { textChanged: boolean; flaggedByThisEdit: boolean }
466: ): { nextStatus: 'pending' | undefined; notifiesModerators: boolean } {
467:   // Text a moderator has not judged in this form yet: either it differs from
468:   // what is stored, or the filter just tripped on what was sent.
469:   const newTextToJudge = textChanged || flaggedByThisEdit;
470:
471:   switch (status) {
472:     // Already in the queue — nothing to write, and moderators only need to
473:     // re-read it when the text they judge changed. (PRESETS-BUG-002's "any
474:     // edit re-queues" affordance was the workflow bypass FINDING-004 closed:
475:     // `PATCH {"tags":["a"]}` used to be an uncapped moderation-channel ping.)
476:     case 'pending':
477:       return { nextStatus: undefined, notifiesModerators: newTextToJudge };
478:
479:     // Live. It leaves public view only because the owner's own new text just
480:     // tripped moderation; a clean edit of an approved preset is nobody's
481:     // business and must never re-queue it.
482:     case 'approved':
483:       return flaggedByThisEdit
484:         ? { nextStatus: 'pending', notifiesModerators: true }
485:         : { nextStatus: undefined, notifiesModerators: false };
486:
487:     // Judged and out of public view, but the next move is the author's:
488:     // editing the text IS the resubmission (the web app's "Resubmit" button
489:     // reopens the edit form and PATCHes it, and the user guide says so). It
490:     // re-enters the queue and is charged to the same daily cap as every other
491:     // notifying edit. A tag / dye / category edit, or text re-sent unchanged,
492:     // gives a moderator nothing new, so it still changes nothing.
493:     case 'rejected':
494:       return newTextToJudge
495:         ? { nextStatus: 'pending', notifiesModerators: true }
496:         : { nextStatus: undefined, notifiesModerators: false };
497:
498:     // `flagged` — and any status this router does not know — is the
499:     // moderator's alone: no owner edit moves it or puts it in front of them.
500:     default:
501:       return { nextStatus: undefined, notifiesModerators: false };
502:   }

520:   const auth = c.get('auth');
521:   const id = c.req.param('id');
522:
523:   // Get preset to check ownership
524:   const preset = await getPresetById(c.env.DB, id);
525:   if (!preset) {
526:     return notFoundResponse(c, 'Preset');
527:   }
528:
529:   // FINDING-016: a preset the caller could not GET does not exist for them
530:   if (!canSeePreset(auth, preset)) {
531:     return notFoundResponse(c, 'Preset');
532:   }
533:
534:   // Only owner can edit (moderators cannot edit others' presets)
535:   if (preset.author_discord_id !== auth.userDiscordId) {
536:     return forbiddenResponse(c, 'You can only edit your own presets');
537:   }
538:

584:   // BUG-001 (2026-07-18 audit) / FINDING-004 (2026-08-29 security audit): a
585:   // status is a moderator's decision, and an owner edit may move it only in
586:   // the two cases `ownerEditOutcome` above allows — both of them *into* the
587:   // queue, never out of it. Hidden presets cannot be edited at all.
588:   if (preset.status === 'hidden') {
589:     return forbiddenResponse(c, 'This preset cannot be edited');
590:   }
591:
592:   // Determine if content moderation is needed (name or description changed)
593:   // PRESETS-BUG-003: Vote counts are preserved during edits - this is intentional
594:   // as users voted on the dye combination, not just the name/description.
595:   let previousValues: PresetPreviousValues | null | undefined;
596:   // Did the text *this* request supplied trip moderation? (A preset that is
597:   // merely still pending has not; see `ownerEditOutcome` above.)
598:   let flaggedByThisEdit = false;
599:
600:   // FINDING-004: the two fields a moderator actually reads. Tags, dyes, the

1136:   // Capture the OLD key before the UPDATE overwrites it, so the delete below
1137:   // can never target the object we just wrote.
1138:   const previousKey = preset.preview_image_key;
1139:
1140:   // DB UPDATE before the old-object delete, deliberately: if the UPDATE
1141:   // throws, leaving the delete undone just orphans the old object in R2
1142:   // (invisible, negligible cost, cleanable later). Doing it the other way
1143:   // round — delete then UPDATE — risks the opposite failure: a row left
1144:   // pointing at a key that no longer exists, so an approved preset's card
1145:   // starts 404ing on every view. Never trade a broken live image for a tidy
1146:   // bucket.
1147:   await c.env.DB.prepare(
1148:     `UPDATE presets SET preview_image_key = ?, preview_image_status = 'pending', updated_at = ? WHERE id = ?`
1149:   )
1150:     .bind(key, new Date().toISOString(), presetId)
1151:     .run();

```

## apps/presets-api/src/services/preset-service.ts

SHA256: `e7d20359bf6f8b254ab0822e7374c0e6049659d6040b4e025fad86338f0eb398`

```text
467: export function prepareRevert(
468:   db: D1Database,
469:   id: string,
470:   previous: PresetPreviousValues,
471:   now: string
472: ): D1PreparedStatement {
473:   const query = `
474:     UPDATE presets
475:     SET name = ?, description = ?, dyes = ?, tags = ?, dye_signature = ?,
476:         status = 'approved', previous_values = NULL, updated_at = ?
477:     WHERE id = ?
478:     RETURNING *
479:   `;
480:   return db
481:     .prepare(query)
482:     .bind(
483:       previous.name,
484:       previous.description,
485:       JSON.stringify(previous.dyes),
486:       JSON.stringify(previous.tags),
487:       generateDyeSignature(previous.dyes),
488:       now,
489:       id
490:     );

685:   if (previousValues !== undefined) {
686:     setClauses.push('previous_values = ?');
687:     params.push(previousValues ? JSON.stringify(previousValues) : null);
688:   }
689:
690:   if (newStatus !== undefined) {
691:     setClauses.push('status = ?');
692:     params.push(newStatus);
693:   }
694:
695:   // Add WHERE clause
696:   params.push(id);
697:
698:   // OPT-013 (2026-07-18 audit): RETURNING * instead of a re-read — halves the
699:   // D1 round trips and guarantees the returned entity reflects exactly this
700:   // request's write rather than a concurrent writer's
701:   const query = `
702:     UPDATE presets
703:     SET ${setClauses.join(', ')}
704:     WHERE id = ?
705:     RETURNING *
706:   `;
707:
708:   const row = await db.prepare(query).bind(...params).first<PresetRow>();
709:   return row ? rowToPreset(row) : null;

```

## apps/og-worker/src/index.ts

SHA256: `e73a30fe2416404060dd2e1152d534be4b667e0b81420930b130928508115916`

```text
501: function createToolHandler(tool: ToolId) {
502:   return async (c: Context<{ Bindings: Env }>) => {
503:     const request = c.req.raw;
504:     const env = c.env;
505:     const url = new URL(request.url);
506:     const crawlerInfo = detectCrawlerFromRequest(request);
507:     const locale = resolveLocale(url.searchParams);
508:
509:     // If not a crawler, let the request pass through to the origin (SPA)
510:     if (!crawlerInfo.isCrawler) {
511:       // BUG-069 / FINDING-024 (OG-5): only the app host has the SPA behind
512:       // it. On the og. custom domain this worker IS the origin (fetch(request)
513:       // would self-fetch → CF error 1042), and a workers.dev hostname or
514:       // wrangler dev has no origin at all — send humans to the app instead.
515:       if (!isAppHost(url, env)) {
516:         return Response.redirect(env.APP_BASE_URL, 302);
517:       }
518:       // Pass through to origin - the SPA will handle it
519:       return fetch(request);
520:     }
521:
522:     // Track analytics — FINDING-024 / OG-7: one datapoint per crawler hit.
523:     // Human page views are the SPA's business (they were only cost here).
524:     trackAnalytics(env, {
525:       event: 'og_request',
526:       tool,
527:       crawler: crawlerInfo.type,
528:       timestamp: Date.now(),
529:     });
530:
531:     // Generate OG data for this tool (locale-aware display names). Presets are
532:     // shared as a PATH (/presets/<id>) — hand the segment through.
533:     const pathId = tool === 'presets' ? (c.req.param('presetId') ?? null) : null;
534:     const ogData = await generateOGDataForTool(tool, url.searchParams, env, locale, pathId);
535:
536:     // Structured request log (replaces ad-hoc console.log). The crawler's UA
537:     // is logged HERE, and only here (OG-7) — it is the string you need when a
538:     // new crawler wants a detector pattern.
539:     getLogger(c)?.info('Serving OG metadata', {
540:       tool,
541:       locale,
542:       crawler: getCrawlerName(crawlerInfo.type),
543:       userAgent: crawlerInfo.userAgent,
544:       url: url.toString(),
545:       title: ogData.title,
546:     });

```
