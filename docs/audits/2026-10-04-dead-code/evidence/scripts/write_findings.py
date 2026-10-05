"""Write findings/DEAD-NNN.md from the verified workflow result (evidence/workflow-result.json).

The verifier returns are the source of every field. This script numbers them, merges duplicates,
gives each overlapping deletion a single owner (OV), applies the corrections from the final
adversarial check (evidence/final-check.json, folded in as CORR), and lays the result out in the
conventions.md §3 skeleton. Re-runnable: it overwrites findings/ and evidence/catalog.json.

Extras in PLAN come in two kinds:
- 'merge': a distinct item folded into the finding (its location, evidence and steps are kept);
- 'reconfirm': an independent second verification of the same item (only its reasoning is kept).
"""
import json
import pathlib
import re

OUT = pathlib.Path('docs/audits/2026-10-04-dead-code')
data = json.loads((OUT / 'evidence/workflow-result.json').read_text(encoding='utf-8'))
V = {}
for g in data['round1'] + data['round2']:
    for v in g['verdicts']:
        V[v['cand']] = {**v, 'group': g['group']}

M, R = 'merge', 'reconfirm'
# (id, primary cand, [(extra cand, kind)], overrides)
PLAN = [
    # --- introduced by an open PR: fix inside that PR before the batch merge
    ('001', 'cand-gap1-01', [], {}),
    ('002', 'cand-dw-03', [], {'rec': 'REMOVE WITH CAUTION'}),
    # --- apps/web-app
    ('003', 'cand-web-app-ui-01', [], {}),
    ('004', 'cand-web-app-ui-02', [], {}),
    ('005', 'cand-web-app-ui-03', [], {}),
    ('006', 'cand-gap4-05', [], {}),
    ('007', 'cand-web-app-ui-04', [], {}),
    ('008', 'cand-web-app-ui-05', [], {}),
    ('009', 'cand-gap6-02', [], {'cascade': '008', 'together': True}),
    ('010', 'cand-gap6-03', [], {'cascade': '008', 'together': True}),
    ('011', 'cand-web-app-ui-07', [], {}),
    ('012', 'cand-web-app-logic-01', [], {}),
    ('013', 'cand-web-app-logic-02', [], {}),
    ('014', 'cand-web-app-logic-03', [], {}),
    ('015', 'cand-web-app-logic-04', [], {}),
    ('016', 'cand-gap5-01', [('cand-gap5-02', M)], {'cascade': '013, DEAD-015', 'together': True}),
    ('017', 'cand-web-app-logic-05', [], {}),
    ('018', 'cand-web-app-logic-06', [], {}),
    ('019', 'cand-web-app-logic-07', [], {}),
    ('020', 'cand-web-app-logic-08', [], {}),
    ('021', 'cand-web-app-logic-09', [], {}),
    ('022', 'cand-web-app-logic-10', [], {}),
    ('023', 'cand-gap2-01', [('cand-gap2-02', M)], {}),
    # --- apps/discord-worker
    ('024', 'cand-dw-02', [], {}),
    # --- apps/moderation-worker
    ('025', 'cand-moderation-worker-01', [], {}),
    ('026', 'cand-moderation-worker-02', [], {}),
    ('027', 'cand-moderation-worker-03', [], {}),
    ('028', 'cand-moderation-worker-05', [], {}),
    ('029', 'cand-moderation-worker-04', [], {}),
    ('030', 'cand-gap1-02', [('cand-gap1-03', M), ('cand-gap1-04', M)], {}),
    # --- apps/presets-api
    ('031', 'cand-presets-api-01', [], {}),
    ('032', 'cand-presets-api-02', [], {}),
    ('033', 'cand-presets-api-03', [], {}),
    ('034', 'cand-presets-api-07', [], {}),
    # --- apps/api-worker, oauth, image-worker, og-worker
    ('035', 'cand-api-worker-02', [], {}),
    ('036', 'cand-oauth-image-worker-01', [], {}),
    ('037', 'cand-oauth-image-worker-03', [], {}),
    ('038', 'cand-oauth-image-worker-04', [], {}),
    ('039', 'cand-og-worker-01', [], {}),
    ('040', 'cand-og-worker-02', [], {}),
    # --- packages/test-utils (private)
    ('041', 'cand-small-packages-02', [('cand-gap8-01', R)], {}),
    ('042', 'cand-small-packages-03', [], {}),
    ('043', 'cand-gap4-04', [], {}),
    ('044', 'cand-gap8-02', [], {}),
    # --- root (CI/scripts)
    ('045', 'cand-root-ci-01', [], {}),
    ('046', 'cand-root-ci-02', [], {}),
    # --- KEEP register
    ('047', 'cand-core-01', [], {}),
    ('048', 'cand-core-04', [], {}),
    ('049', 'cand-core-02', [('cand-core-03', M)], {}),
    ('050', 'cand-small-packages-11', [('cand-gap7-06', R)], {'cascade': '049'}),
    ('051', 'cand-gap4-01', [('cand-gap2-03', M), ('cand-gap4-02', R)], {}),
    ('052', 'cand-gap4-03', [], {}),
    ('053', 'cand-svg-bot-logic-stoat-04', [('cand-gap7-02', R)], {}),
    ('054', 'cand-small-packages-01', [('cand-gap7-03', R)], {}),
    ('055', 'cand-small-packages-12', [], {}),
    ('056', 'cand-small-packages-07', [('cand-gap7-01', R)], {}),
    ('057', 'cand-small-packages-08', [], {}),
    ('058', 'cand-small-packages-09', [('cand-gap7-04', R)], {}),
    ('059', 'cand-small-packages-13', [('cand-gap7-05', R)], {}),
    ('060', 'cand-small-packages-14', [], {}),
    ('061', 'cand-dw-01', [], {}),
    ('062', 'cand-dw-04', [], {}),
    ('063', 'cand-gap5-03', [], {}),
    ('064', 'cand-svg-bot-logic-stoat-01', [('cand-svg-bot-logic-stoat-02', M), ('cand-svg-bot-logic-stoat-03', M),
                                            ('cand-svg-bot-logic-stoat-05', M), ('cand-svg-bot-logic-stoat-08', M)], {'rec': 'KEEP'}),
]

# Coordinator overrides: one owner per deletion, measured line counts, titles that match them.
# Config lines (vitest/tsconfig/package.json/workspace/turbo) count as source.
OV = {
    '008': {
        'title': 'empty-state.ts: 6 of the 7 EMPTY_STATE_PRESETS factories are test-only — 50 source + 53 test lines',
        'src': 50,
        'steps': '1) apps/web-app/src/components/empty-state.ts: delete the factories at 53-76 and 87-108. From the import at 13-21 drop ICON_STATE_COINS, ICON_STATE_ALERT, ICON_STATE_WAIT_ANIMATED and ICON_DETAIL_EXTRACTOR, and also ICON_STATE_SEARCH and ICON_STATE_FUNNEL: the deleted factories were their only users in this file, and web-app\'s tsconfig sets noUnusedLocals. ICON_STATE_SEARCH/FUNNEL stay exported from state-icons.ts, since dye-grid.ts:7/89/96 and v4/preset-tool.ts:19/1145 use them. 2) empty-state.test.ts: trim the preset list at 117-123 to noHarmonyResults and delete the describes at 257-281 and 291-313. 3) In the same pull request, as separate commits: DEAD-009 (the four icons) and DEAD-010 (the locale strings). 4) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check.',
    },
    '009': {'steps_note': 'Lands in the same pull request as DEAD-008, as the next commit: once DEAD-008 removes their last importer, web-app\'s knip gate (inside `lint`) fails on these four exports, so the gate cannot be green between the two.'},
    '010': {'steps_note': 'Lands in the same pull request as DEAD-008 and DEAD-009. Leaving the strings behind would not fail a gate (the orphan analyzer treats every key ending in `.title`/`.description` as reachable), so re-grep each key before deleting rather than relying on the gate.'},
    '013': {
        'title': 'getFeaturedPresets: HybridPresetService\'s has no caller and CommunityPresetService\'s is test-only — 33 source + 31 test lines',
        'steps': 'Delete hybrid-preset-service.ts 331-352 and community-preset-service.ts 330-340. In community-preset-service.integration.test.ts delete the \'Featured Presets Tests\' banner and describe at 158-182 (the method\'s only test). The msw handler and the e2e route that only served this method are DEAD-016, the next commit in the same pull request. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.',
    },
    '016': {
        'title': 'web-app: the msw mocks for /presets/featured and /presets/rate-limit and the e2e /featured route only serve removed methods — 34 test lines',
        'test': 34,
        'steps': '1. apps/web-app/src/__tests__/mocks/handlers.ts: delete :162-167 (featured handler and blank) and :296-309 (rate-limit handler and blank). 2. apps/web-app/e2e/preset-gallery-api.spec.ts: delete :129-142 (the 7-line comment, the page.route(\'**/api/v1/presets/featured\') block and the trailing blank), and the \'Featured section\' doc line at e2e/preset-browser.spec.ts:18. 3. pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check, then pnpm --filter xivdyetools-web-app exec playwright test e2e/preset-gallery-api.spec.ts --reporter=list (port 5173 free; the gate does not run e2e).',
        'steps_note': 'Lands in the same pull request as DEAD-013 and DEAD-015, as the commit after them: the handlers mock endpoints whose only callers those two findings remove.',
    },
    '023': {'title': 'web-app LanguageService.getLabel and preloadLocales are test-only — 17 source + 43 test lines'},
    '025': {'title': 'rateLimitMiddleware in moderation-worker rate-limit.ts is a never-mounted no-op reached only by its test — 25 source + 13 test lines'},
    '030': {'title': 'moderation-worker bot-i18n.ts: older orphan strings (preset.categories.*, three ban.* keys, the meta block, common.success) — 24 source + 12 test lines'},
    '037': {'src': 3, 'test': 0},
    '038': {'src': 10, 'test': 0},
    '049': {
        'title': 'core: getToolName and getLabel, with the `tools`/`labels` locale sections, have no consumer outside core\'s tests — about 257 source + 100 test lines',
        'src': 257,
        'steps': 'At a core major. getToolName: 1. Delete LocalizationService.ts:489-509 and TranslationProvider.ts:~336-370. 2. In build-locales.ts delete buildTools (:815-~870) and the `tools:` line (:250), then regenerate the locales (`tools` is optional, so LocaleLoader needs no change). 3. Prune the getToolName tests in LocalizationService.test.ts, TranslationProvider.test.ts and TranslationProvider.optional-sections.test.ts. The types half (ToolKey, LocaleData.tools) is DEAD-050, in the types major that follows. getLabel, in the same change set: 4. Delete LocalizationService.ts:343-358 and TranslationProvider.ts:49-82, and change LocaleLoader.ts:97 so it stops requiring `labels`. 5. In build-locales.ts delete buildLabels and fallbackLabels (:258-307) and the `labels` lines (:227/:241), plus localize.yaml `labels`; regenerate. 6. In types (same types major as DEAD-050), make LocaleData.labels optional or remove it, and delete TranslationKey (localization/index.ts:17-~30) and its barrel line index.ts:142. 7. Confirm DEAD-023 has landed: it removes web-app\'s LanguageService.getLabel wrapper, which would otherwise break. 8. pnpm turbo run build type-check lint test --filter=...@xivdyetools/core && pnpm dead-code:check.',
    },
    '050': {
        'title': 'types: ToolKey and LocaleData.tools outlive core\'s getToolName — 13 source lines, for the types major after DEAD-049',
        'src': 13, 'test': 0,
        'steps': 'At the types major, after core has shipped DEAD-049: delete packages/types/src/localization/index.ts:46-54 (ToolKey) and :145-147 (LocaleData.tools), and the ToolKey line in the barrel at packages/types/src/index.ts:145. Update packages/types/CLAUDE.md:118 and og-worker\'s CLAUDE.md:325, and add a BREAKING CHANGELOG entry. Then pnpm turbo run build type-check lint test --filter=...@xivdyetools/types && pnpm dead-code:check.',
    },
    '051': {'title': 'core LocalizationService.setLocaleFromPreference and preloadLocales are test-only published API — 52 source + 60 test lines'},
    '064': {
        'title': 'stoat-worker: five more parked-feature leftovers (MessageContextStore.get/delete/size, isAuthorized, the Upstash config fields, HELP_TOPICS, two StoatMessage fields) — 54 source + 106 test lines',
        'recDetail': 'The app is parked, so these join the 2026-09-15-dead-code/DEAD-019 entry. Revisit trigger: Stoat is resumed or retired (docs/research/discord-alternatives/07-2026-10-refresh.md recommends parking or archiving it). On retirement the whole app goes; on resumption each item is re-judged against the new command set. HELP_TOPICS needs a refactor first, since help.ts builds its text inline.',
    },
}

# Corrections from the final adversarial check (evidence/final-check.json): every one of the twelve
# largest REMOVE findings survived refutation; these refine their fix steps.
CORR = {
    '003': 'harmony-tool.ts\'s handleContextAction (1653-1683) handles only the six removed actions, so, as in budget-tool and swatch-tool, its whole listener (1638-1642), the method and its ContextAction import (line 68) go too. Rewrite rather than delete the vocabulary guard test: it also checks that swatch-tool.ts and mixer-tool.ts never contain the \'navigate-to-tool\' event string, which must survive.',
    '004': 'The \'Accessibility Tool Styles & Global Helper Classes\' comment header is at v4-layout-shell.ts:425-427, not 424-426 (424 closes the mobile @media block). The deletion range 446-783 and the closing backtick at 784 are correct.',
    '010': 'Five presets read these keys (noSearchResults, allFilteredOut, noPriceData, noImage, loading); the sixth test-only preset, `error`, reads errors.somethingWentWrong/tryAgain, which stay live.',
    '020': 'The test file is apps/web-app/src/services/__tests__/api-service-wrapper.test.ts; the cited line ranges (68-85, 93-124, 477-498) are correct for it.',
    '021': 'Also update apps/web-app/CLAUDE.md:283, whose Testing section uses this file as the single-file example command; docs:check-links cannot see it because it is inside a code block.',
    '022': 'Port the 8-digit alpha case (\'#FF0000FF\') to packages/types branded.test.ts first; every other case already has a counterpart in the package tests.',
    '029': 'The steps miss three test breakages. (1) ban-reason.test.ts \'should return processing message and ban user\' (:375-420) and \'should ban user and send success message\' (:422-491) get \'BadUser\'/\'SpamUser\' only from the legacy suffix; mock banService.getPresetAuthorName to return the name when stripping the suffix at :390 and :437. (2) ban-confirmation.test.ts:99-114 uses \'ban_confirm__TestUser\' and expects \'Invalid target user\'; after the change the handler answers \'Invalid button data.\', so update the expectation. (3) The comment to trim in ban-reason.ts starts at :57, not :58.',
    '041': 'jwt-validation.test.ts is the only test inside test-utils that checks createTestJWT produces a valid HS256 signature (tests/auth/jwt.test.ts only decodes header and payload). After the deletion that check lives in presets-api tests/middleware/auth.test.ts:225 and :289, which the --filter=...@xivdyetools/test-utils gate still runs.',
    '048': 'Step 4\'s pruning of web-app color-service.test.ts applies only if DEAD-021 has not landed; DEAD-021 deletes that whole file.',
    '053': 'At core\'s major, HarmonyOptions is moved to a surviving module, not deleted (DEAD-047 step 1), because this field still names it. It can leave core only after bot-logic\'s major has removed the field.',
}

OV.update({
    '003': {
        'recDetail': "budget-tool's, swatch-tool's and harmony-tool's whole listeners and methods die, not just their cases. The guard test must be rewritten, not deleted, so it keeps its navigate-to-tool check. Keep success.copiedToClipboard (still used at budget-tool.ts:1188). common.copied loses its only caller (gradient-tool.ts:2107).",
        'steps': "1) result-card.ts: delete lines 127-133 (the legacy comment plus 6 members) and rewrite the docblock at 100-110. 2) budget-tool.ts: delete the listener at 1136-1140 and the method at 1832-1853; drop ContextAction from the import type on line 32 (handoffTo is still used at 1180/1183). 3) swatch-tool.ts: delete the listener at 2407-2412 and the method at 2418-2428; drop ContextAction from the import on line 63. 4) gradient-tool.ts: delete the legacy cases at 2088-2109. 5) harmony-tool.ts: handleContextAction (1653-1683) handles only the six removed actions, so delete its listener at 1638-1642, the whole method, and the ContextAction import at line 68. 6) mixer-tool.ts: delete the copy-hex case at 2030-2034. 7) Rewrite src/components/__tests__/v4/context-action-vocabulary.test.ts (126 lines): keep its check that swatch-tool.ts and mixer-tool.ts never contain the 'navigate-to-tool' event string, and drop the parts that read the removed methods (extractMethodBody throws once swatch's method is gone, and DEAD_LEGACY_ACTIONS: ContextAction[] stops type-checking). 8) Remove common.copied (line ~127) from all 6 locales if the orphan test flags it. 9) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check.",
    },
    '004': {
        'recDetail': "Rename the 425-427 section header to drop 'Accessibility Tool Styles'.",
        'steps': "1) v4-layout-shell.ts: delete lines 446-783 (the blank line plus .contrast-table-container through the .warning-callout strong rule), keeping the closing backtick at 784. 2) Update the comment header at 425-427 (line 424 closes the mobile @media block). 3) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check.",
    },
    '009': {
        'src': 33,
        'steps': "1) apps/web-app/src/shared/state-icons.ts: delete lines 28-29 (COINS), 31-32 (ALERT), 43-44 (EXTRACTOR) and 46-72 (the WAIT_ANIMATED doc block and template), with their blank separators. Keep the panelGlyph, toolGlyph and themedAccent imports, which SEARCH, FUNNEL, FOLDER, PRESETS_EMPTY and HARMONY still use. The matching names in empty-state.ts's import go with DEAD-008. 2) Update the icon list in docs/projects/web-app/components.md:92. 3) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app, then pnpm dead-code:check and pnpm docs:check-links.",
    },
    '029': {
        'title': 'Legacy base64-username suffix parsing in ban-reason.ts:57-92 and ban-confirmation.ts:70-78 is unreachable: no emitter has produced the suffix since the 2026-08-21 FINDING-007 fix, and those flows are ephemeral — about 16 source lines, with a test-fixture rewrite',
        'steps': "1. ban-reason.ts: replace lines 62-64 with `const targetUserId = idPart;`, delete lines 86-92 (the legacy decode block), the base64UrlDecode import at line 18 and the comment at lines 57-60, and fix the header pattern at line 6. 2. ban-confirmation.ts: replace lines 77-78 with `const targetUserId = idPart;`, trim the comment at lines 71-75, and fix the header at line 7. 3. ban-confirmation.test.ts: delete the legacy-specific tests ('underscore in username' ~148-165, 'special characters' ~203-220, 'still accepts a legacy custom_id' ~299-315), strip the `_${encodedUsername}` suffix from the remaining fixtures, and drop the base64UrlEncode import at line 10. The 'ban_confirm__TestUser' test at :99-114 now gets 'Invalid button data.' instead of 'Invalid target user'; update its expectation. 4. ban-reason.test.ts: delete the 'underscores in username' (633-678) and 'special characters' (730-775) tests; strip `_TestUser` / `_${encodedUsername}` from the fixtures at lines 81, 113, 206, 237, 390, 437, 507, 549, 595, 691, 790 and 839; change the expected error of the `ban_reason_modal__TestUser` test (line 175; it no longer hits !targetUserId); update the isBanReasonModal fixtures (881-882) if desired; and drop the base64UrlEncode import at line 6. In 'should return processing message and ban user' (:375-420) and 'should ban user and send success message' (:422-491), mock banService.getPresetAuthorName to return 'BadUser' / 'SpamUser': those names came only from the legacy suffix. 5. Run `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker`, then `pnpm dead-code:check`.",
    },
})
OV['008']['src'] = 54
OV['008']['title'] = 'empty-state.ts: 6 of the 7 EMPTY_STATE_PRESETS factories are test-only — 54 source + 53 test lines'
OV['041'] = {'recon_text': 'Re-verified independently in the completeness re-sweep, which also traced the config and doc mentions of the directory that the steps now list.'}
for _k in ('003', '004', '029'):
    CORR.pop(_k, None)

# Applied after IDs are mapped: process wording that must read as a finding statement.
POSTREPL = [
    ('DEAD-008/DEAD-008', 'DEAD-008'),
    (", which clears the reviewer's caveat.", '.'),
    ('so it is a candidate for a later row.', 'so re-check it as a follow-on once this lands.'),
    ('File them as a separate row rather than widening this one.', 'Re-check them as a separate follow-up rather than widening this finding.'),
    ("; row cited :127, which is the previous route's closing brace", ''),
    ('Confirmed for 6 methods', 'Applies to 6 methods'),
    ('getAllWorlds is EXCLUDED', 'getAllWorlds is not included'),
    ('Confirmed for getAll/count/deleteDatabase', 'Applies to getAll/count/deleteDatabase'),
    ('isReady and close are EXCLUDED', 'isReady and close are not included'),
    ('getLocale is REJECTED as part of this row', 'getLocale is not included'),
    ('The getLabel half is a duplicate of getLabel / locale `labels` section / buildLabels.', 'The getLabel half is DEAD-049.'),
    ('CONFIRMED for isAuthorized only.', 'Applies to isAuthorized only.'),
    (', which the reviewer missed', ''),
    ("so the reviewer's REMOVE suggestion contradicts a standing tag.", 'so removing it now would contradict a standing tag.'),
    (", plus integration describe('getFeaturedPresets')", ''),
    ('Re-verified independently in the completeness sweep: ', 'Re-verified independently in the completeness re-sweep: '),
]
AMENDS = re.compile(r'This amends the round-1 grading of [^.]*?(?: and is not a new finding)?\.\s*')

# Remediation status (mirrored in the report's status table).
STATUS = {'001': ('FIX COMMITTED, NOT MERGED (PR #225)', '`ea264d49`')}
STATUS_TEXT = {'001': 'FIX COMMITTED, NOT MERGED 2026-10-04 `ea264d49` — the five strings deleted on `fix/security-2026-10-03-sprint4` (PR #225); the moderation-worker gate passes (763 tests).'}

# Folder-qualify references to earlier audits' IDs (conventions.md §2); this audit's IDs stay bare.
OLD_REF = [
    (re.compile(r'(?<![/\w-])DEAD-00([24])\b'), r'2026-08-18-discord-worker-dead-code/DEAD-00\1'),
    (re.compile(r'(?<!2026-09-15 )(?<!audit\'s )(?<![/\w-])DEAD-0(18|19|20|21)\b'), r'2026-09-15-dead-code/DEAD-0\1'),
    (re.compile(r'2026-09-15 (2026-09-15-dead-code/)?DEAD-0(18|19|20|21)\b'), r'2026-09-15-dead-code/DEAD-0\2'),
]


def clean(s):
    s = (s or '').replace('�', '—').strip()
    for rx, rep in OLD_REF:
        s = rx.sub(rep, s)
    return s


CAND2ID = {c: f'DEAD-{fid}' for fid, p, e, _ in PLAN for c in [p] + [x for x, _ in e]}
CAND2ID['cand-gap6-01'] = 'DEAD-008'
# Reviewer/verifier shorthand that must not leak into the catalog (conventions.md §7).
REPL = [
    ('Apply this together with gap1-02/03/04 as one edit to bot-i18n.ts and bot-i18n.test.ts.',
     'The older orphans in the same file (DEAD-030) are scheduled separately, after the batch merge.'),
    ('Apply this with gap1-01/02/03 as one edit', 'DEAD-001 will already have landed in PR #225; apply this with the other DEAD-030 keys as one edit'),
    ('gap1-01/02/03', 'the other DEAD-030 keys'),
    ('Apply this with the other gap-1 rows', 'Apply this with the other DEAD-030 keys'),
    ('the other gap-1 rows', 'the other DEAD-030 keys'),
    ('the six C5 presets', 'the six presets of DEAD-008'),
    ('the C5 presets', 'the DEAD-008 presets'),
    ('round-1 C5', 'DEAD-008'),
    ('C5', 'DEAD-008'),
    ('after cand-01 lands', 'after DEAD-012 lands'),
    ('the round-1 core getLabel/labels removal', 'the core getLabel/labels removal (DEAD-049)'),
    ('the round-1 HybridPresetService.getPresetWithDyes duplicate', 'web-app HybridPresetService.getPresetWithDyes (DEAD-012)'),
    ('round-1 grading', 'first verification'),
    ('with C1:', 'with DEAD-047:'),
    ('gap sweeps 2 and 4', 'two separate sweeps'),
    (' (the row says :9)', ''),
    ('the recGuess of REMOVE', 'the reviewer\'s REMOVE suggestion'),
    (' (round-1 confirmed)', ' (this finding)'),
    ('DEAD-008/DEAD-008', 'DEAD-008'),
    ('cand-gap2-02', 'DEAD-023 (preloadLocales)'),
]
FILTER_FIX = (re.compile(r'xivdyetools-oauth(?![-\w])'), 'xivdyetools-oauth-worker')


def unit_of(v):
    parts = v['file'].split('/')
    if parts[0] in ('apps', 'packages') and len(parts) > 2:
        return '/'.join(parts[:2])
    return 'root (CI/scripts)'


CATEGORIES = ['Unused Export', 'Orphaned File', 'Dead Path', 'Unused Dep', 'Legacy', 'Unused Type', 'Stale Test',
              'Dead CSS', 'Dead Asset', 'Orphan i18n', 'Test-only', 'Redundant Re-export']


def category_of(v):
    c = clean(v['category'])
    return next((k for k in CATEGORIES if c.startswith(k)), c)


def finish(text):
    for old, new in REPL:
        text = text.replace(old, new)
    for cand, did in sorted(CAND2ID.items(), key=lambda kv: -len(kv[0])):
        text = text.replace(cand, did)
    text = FILTER_FIX[0].sub(FILTER_FIX[1], text)
    for old, new in POSTREPL:
        text = text.replace(old, new)
    return AMENDS.sub('', text)


catalog = []
fdir = OUT / 'findings'
fdir.mkdir(exist_ok=True)
for p in fdir.glob('DEAD-*.md'):
    p.unlink()
for fid, prim, extra, base_ov in PLAN:
    ov = {**base_ov, **OV.get(fid, {})}
    v = V[prim]
    assert v['verdict'] == 'CONFIRMED', prim
    merged = [V[c] for c, k in extra if k == M]
    recon = [V[c] for c, k in extra if k == R]
    rec = ov.get('rec', v['rec'])
    title = clean(ov.get('title', v.get('title')))
    src = ov.get('src', (v.get('srcLines') or 0) + sum((e.get('srcLines') or 0) for e in merged))
    tst = ov.get('test', (v.get('testLines') or 0) + sum((e.get('testLines') or 0) for e in merged))
    origin = clean(v.get('origin')) or 'MAIN'
    unit = unit_of(v)
    row = dict(id=f'DEAD-{fid}', title=finish(title), conf=v['confidence'], blast=v['blast'], semver=v['semver'], unit=unit,
               category=category_of(v), origin=origin, rec=rec, src=src, test=tst,
               cascade=ov.get('cascade'), together=bool(ov.get('together')), cands=[prim] + [c for c, _ in extra])
    L = [f"# DEAD-{fid}: {title}",
         f"**Confidence:** {v['confidence']} · **Blast radius:** {v['blast']} · **Deploy unit:** {unit} · **Semver:** {v['semver']} · "
         f"**Category:** {row['category']} · **Origin:** {origin}" + (f" · **Cascade of:** DEAD-{ov['cascade']}" if ov.get('cascade') else ''),
         '', '## Location']
    for x in [v] + merged:
        L.append(f"- `{x['file']}:{x['line']}` — {clean(x['symbol'])}")
    L += ['', '## Evidence']
    for x in [v] + merged:
        L.append(f"- {clean(x['reason'])}")
        if x.get('evidence'):
            L.append('  - Commands: ' + clean(x['evidence']).replace('\n', '; '))
    for x in recon:
        if ov.get('recon_text'):
            L.append(f"- {ov['recon_text']}")
        else:
            L.append(f"- Re-verified independently in the completeness sweep: {AMENDS.sub('', clean(x['reason']))}")
    L.append(f"- Origin: {clean(v.get('originEvidence'))}")
    detail = clean(ov.get('recDetail', v.get('recDetail')))
    L += ['', '## Fix', f"**{rec}.** {detail}"]
    if 'steps' in ov:
        L += ['', 'Steps: ' + ov['steps']]
    else:
        for x in [v] + merged:
            if x.get('fixSteps'):
                L += ['', ('Steps' if x is v else f"Steps ({clean(x['symbol'])})") + ': ' + clean(x['fixSteps'])]
    if ov.get('steps_note'):
        L += ['', 'Sequencing: ' + ov['steps_note']]
    if fid in CORR:
        L += ['', 'Correction from the final adversarial check: ' + CORR[fid]]
    status = STATUS.get(fid, ('OPEN', '—') if rec != 'KEEP' else ('KEEP', '—'))
    row['status'], row['commit'] = status
    L += ['', '## Status', STATUS_TEXT.get(fid, 'OPEN' if rec != 'KEEP' else 'KEEP (register) — revisit on the trigger above'), '']
    text = finish('\n'.join(L))
    row['detail'] = finish(detail)
    catalog.append(row)
    (fdir / f'DEAD-{fid}.md').write_text(text, encoding='utf-8', newline='\n')

(OUT / 'evidence/catalog.json').write_text(json.dumps(catalog, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')
act = [c for c in catalog if c['rec'] != 'KEEP']
keep = [c for c in catalog if c['rec'] == 'KEEP']
print(f"{len(catalog)} findings: {len(act)} actionable ({sum(c['src'] for c in act)} src + {sum(c['test'] for c in act)} test lines), {len(keep)} KEEP")
used = {c for _, p, e, _ in PLAN for c in [p] + [x for x, _ in e]}
conf = {k for k, v in V.items() if v['verdict'] == 'CONFIRMED'}
print('confirmed but unplaced:', sorted(conf - used - {'cand-gap6-01'}))
