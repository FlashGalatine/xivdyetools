export const meta = {
  name: 'reverify-2026-10-04-plan',
  description: 'Re-verify the 2026-10-04 findings whose cited files changed since the audited preview, against current main',
  phases: [
    { title: 'Verify', detail: 'one verifier per touched finding, read-only, against HEAD' },
    { title: 'Challenge', detail: 'two skeptics on every FIXED / PARTIALLY_FIXED / INVALID verdict' },
    { title: 'Notes', detail: 'unnumbered plan notes and the Pin-first terms vs the #239 dictionary table' },
  ],
}

const POST_PREVIEW = `Commits that landed on main AFTER the audited preview (non-merge, outside docs/audits):
a4a769f5 fix(core): 5.8.1 — Korean race names and Korean / Chinese clan names from the game clients  (#240; also re-cut discord-worker + og-worker CJK subsets)
b251c4af docs(reference): pin the character creator's color-sheet names from the client  (#239; docs/reference/ffxiv-terminology.md, docs/research/2026-10-05-character-sheet-terms/)
12e7f887 fix(presets-api): drop the retired api.xivdyetools.projectgalatine.com route; changelog names migration 0015
6f2bb05c fix(moderation-worker): drop the retired moderation-bot.xivdyetools.projectgalatine.com route; queue footer drops <reason>
d1f9e5c5 fix(api-worker): drop the retired proxy.xivdyetools.projectgalatine.com route
d3bf312a refactor(discord-worker): drop the unread ModerationPresetInfo.author_discord_id (DEAD-002)
91de5f8d fix(web-app): name the XIVAuth User fallback in the sign-in note and Terms (C02, TERM-014/015)
5805bf8a fix(discord-worker): bot policy — XIVAuth author names, the ban record's account ID, retention row (C06, C07, I18N-004/006)
3f662657 fix(web-app): Privacy Guide — one retention rule per log entry, the ban record's account ID (I18N-005, C07, I18N-006)
57152e77 / 44776eb8 / a8ae0d09 / 7e953989 / 65afb971 / 223b839f  docs(operations|api-worker): old-domain routes retired 2026-10-05, OPEN_ITEMS / DEPLOY_ENVIRONMENTS / DOMAIN_DEPRECATION edits
(C02/C06/C07 are 2026-10-03 security-audit IDs, not these catalogs.)
Earlier (already inside the dead-code audit's own Sprint 0, between 1e842b20 and 80262a2f): ea264d49 (DEAD-001), 10a1cb77 (presets-api comment reword).`

const RULES = `You are working in a git worktree whose HEAD is current origin/main (50165ec6). It is READ-ONLY for you: do not edit, create, stage, stash, or delete any file, and do not run builds/tests/installs (a background gate is running in this worktree). Use only read commands: git show, git diff, git log, git blame, git grep, cat/sed -n/grep, and the Read/Grep tools. Use the Bash tool with POSIX syntax (Git Bash on Windows). Prefer \`git show HEAD:<path>\` and \`git show <sha>:<path>\` to compare the audited version with today's.

${POST_PREVIEW}`

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['STILL_OPEN', 'STILL_OPEN_DRIFTED', 'PARTIALLY_FIXED', 'FIXED', 'INVALID'] },
    summary: { type: 'string', description: 'One or two sentences: what is true on HEAD today versus the finding.' },
    fixed_by: { type: 'string', description: 'Commit SHA(s) that fixed it (fully or partly), or empty.' },
    remaining: { type: 'string', description: 'Exactly what is still left to do on HEAD; empty if nothing.' },
    current_locations: { type: 'array', items: { type: 'string' }, description: 'file:line anchors on HEAD for what remains (or for the fix, if FIXED).' },
    fix_steps_still_valid: { type: 'boolean', description: 'Do the finding\'s ## Fix steps still apply as written (same lines/keys/files)?' },
    fix_step_changes: { type: 'string', description: 'If not valid as written: how the steps must change (new lines, keys removed already, new prerequisite). Empty otherwise.' },
    evidence: { type: 'array', items: { type: 'string' }, description: 'Commands run and the key lines of their output that justify the verdict.' },
  },
  required: ['verdict', 'summary', 'fixed_by', 'remaining', 'current_locations', 'fix_steps_still_valid', 'fix_step_changes', 'evidence'],
}

const SKEPTIC_SCHEMA = {
  type: 'object',
  properties: {
    agrees: { type: 'boolean', description: 'true only if, after actively trying, you could not show the verdict wrong.' },
    corrected_verdict: { type: 'string', enum: ['STILL_OPEN', 'STILL_OPEN_DRIFTED', 'PARTIALLY_FIXED', 'FIXED', 'INVALID'] },
    reasoning: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
  },
  required: ['agrees', 'corrected_verdict', 'reasoning', 'evidence'],
}

const verifyPrompt = (it) => `${RULES}

TASK: re-verify one finding from the 2026-10-04 audits against today's main. The audit read a preview branch at ${it.sha}; since then these files it cites changed: ${it.touched.join(', ')}. It is scheduled in the merged plan (docs/audits/2026-10-04-i18n/REMEDIATION_PLAN.md) as ${it.sprint === 'S00' ? 'Sprint 0 (decisions before the batch merge — some were fixed inside their PRs before merging)' : 'Sprint ' + it.sprint.slice(1)}.

1. Read the finding file in full: ${it.file}. Note EVERY distinct claim it makes (each file, each locale variant, each key, each line) — a finding about six locale variants is only FIXED if all of them are.
2. For each touched file, run \`git diff ${it.sha} HEAD -- <file>\` and \`git log --oneline ${it.sha}..HEAD -- <file>\`, then read the current text on HEAD at the cited places.
3. Decide:
   - STILL_OPEN: the defect is exactly as described, at the same anchors.
   - STILL_OPEN_DRIFTED: the defect is still fully present but anchors (lines/keys/wording around it) moved — give the new anchors.
   - PARTIALLY_FIXED: some of its claims are fixed, some remain — say precisely which remain.
   - FIXED: every claim is resolved on HEAD — name the commit.
   - INVALID: the finding no longer applies for another reason (the code it describes was deleted or rewritten so the claim is moot) — explain.
4. Check whether the finding's "## Fix" steps still apply literally (line numbers, keys, files, prerequisite PRs such as #239/#240 now being merged). Record any change needed.
${it.key === 'i18n/HC-001' || it.key === 'i18n/TERM-004' ? `5. Special: this finding depends on #239 (dictionary table "Character-Creation Color Sheets" in docs/reference/ffxiv-terminology.md) and/or #240 (core 5.8.1 Korean/Chinese race and clan names in packages/core/src/data/locales/*.json, generated by packages/core/scripts/build-locales.ts). Confirm the prerequisite is now on HEAD and whether it changes the fix (e.g. which core getter/locale section bot-logic should read the clan name from, and whether core ships clan names for all six locales).` : ''}
${it.key === 'deep-dive/BUG-128' || it.key === 'i18n/TERM-021' || it.key === 'i18n/TERM-003' ? `5. Special: #240 rewrote part of packages/core/scripts/build-locales.ts (race/clan names) and #239 added the dictionary table. Check precisely whether either touched the code this finding is about, and whether the fix must now follow the #239 table.` : ''}
${it.sprint === 'S00' ? `5. Special: this is a Sprint 0 item. The plan offered to fix it inside its PR before merging. Determine whether that happened (look for the commit among the post-preview commits above) and whether the fix is complete — for policy documents, check ALL SIX variants (en, de, fr, ja, ko, zh) of every document the finding names, and check that the "Last updated" date moved where the finding/plan required it.` : ''}

Return the structured verdict. Be concrete: quote the current line text in evidence.`

const skepticPrompt = (it, v, lens) => `${RULES}

A verifier re-checked finding ${it.key} (file: ${it.file}; audit SHA ${it.sha}) against today's HEAD and concluded:
VERDICT: ${v.verdict}
SUMMARY: ${v.summary}
FIXED_BY: ${v.fixed_by || '(none)'}
REMAINING: ${v.remaining || '(nothing)'}
EVIDENCE: ${v.evidence.join(' | ')}

A wrong FIXED/INVALID silently drops a live defect from the remediation schedule, so your job is to try to REFUTE this verdict. Default to agrees=false if you cannot positively confirm it.
Your lens: ${lens}
Read the finding file in full yourself, then check HEAD directly. Return agrees, the verdict you believe is right (corrected_verdict), and evidence with quoted current text.`

const LENSES = [
  'COMPLETENESS — enumerate every claim, file, locale variant (en/de/fr/ja/ko/zh), key and test the finding names; show any one that is still wrong on HEAD. A fix to the English alone, or to five of six variants, is PARTIALLY_FIXED, not FIXED.',
  'ATTRIBUTION — check that the cited fixing commit actually changes the specific text/code the finding is about (not an adjacent sentence or a different key), that it is reachable from HEAD (`git merge-base --is-ancestor <sha> HEAD`), and that nothing later reverted it. For INVALID, check the code really is gone rather than moved/renamed (git grep for the symbol/string).',
]

const NEEDS_CHALLENGE = new Set(['FIXED', 'PARTIALLY_FIXED', 'INVALID'])

phase('Verify')
const findingsP = pipeline(
  args.items,
  (it) => agent(verifyPrompt(it), { label: `verify:${it.key}`, phase: 'Verify', schema: VERIFY_SCHEMA }),
  async (v, it) => {
    if (!v) return { key: it.key, sprint: it.sprint, verify: null, challenges: [], final: 'ERROR' }
    if (!NEEDS_CHALLENGE.has(v.verdict)) return { key: it.key, sprint: it.sprint, verify: v, challenges: [], final: v.verdict }
    const ch = (await parallel(LENSES.map((lens, i) => () =>
      agent(skepticPrompt(it, v, lens), { label: `challenge${i + 1}:${it.key}`, phase: 'Challenge', schema: SKEPTIC_SCHEMA, effort: 'high' })))).filter(Boolean)
    const allAgree = ch.length === LENSES.length && ch.every(c => c.agrees)
    return { key: it.key, sprint: it.sprint, verify: v, challenges: ch, final: allAgree ? v.verdict : 'DISPUTED' }
  },
)

const NOTES_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          status: { type: 'string', enum: ['STILL_OPEN', 'FIXED', 'NOW_PINNABLE', 'STILL_UNPINNED', 'CHANGED'] },
          detail: { type: 'string' },
          locations: { type: 'array', items: { type: 'string' } },
        },
        required: ['item', 'status', 'detail', 'locations'],
      },
    },
  },
  required: ['items'],
}

const notesP = agent(`${RULES}

TASK: check the merged plan's UNNUMBERED notes against HEAD. Read docs/audits/2026-10-04-i18n/REMEDIATION_PLAN.md around "Also here (no ID)" (Sprint 2, line ~137, and Sprint 6, line ~249) and the Sprint 0 "Question" about the three projectgalatine.com domains (line ~70).
For each, return one item:
1. "S02 Korean /preferences set clan tooltip": find where that Korean option description lives (bot-logic or discord-worker locales / command definitions; git grep 미드랜더 and 렌 across apps/ and packages/), and whether it still uses core's OLD clan names now that #240 (a4a769f5) changed core's Korean clan names. Give the exact location and the clients' names it should use (from core's ko.json on HEAD and the plan text).
2. "S06 swatch.absentFurPattern Hrothgar 로스갈": is the web-app ko value still 로스갈 while core says 로스가르? And what does each of the five translations call the fur pattern vs the client name, if docs/reference/ffxiv-terminology.md (after #239) or the research folder docs/research/2026-10-05-character-sheet-terms/ pins it?
3. "S00 domain question": are the proxy./api./moderation-bot.xivdyetools.projectgalatine.com routes gone from every wrangler.toml and are docs/operations/DOMAIN_DEPRECATION.md and OPEN_ITEMS.md consistent with that? (status FIXED if fully answered/settled.)
Return structured items.`, { label: 'notes:no-id-items', phase: 'Notes', schema: NOTES_SCHEMA })

const pinP = agent(`${RULES}

TASK: the merged plan's "Pin first" table (docs/audits/2026-10-04-i18n/REMEDIATION_PLAN.md, section "Pin first (terminology without a source)") lists seven terminology concepts that could not be fixed until a cited publisher source pinned the word. Since the plan was written, #239 (b251c4af) added a "Character-Creation Color Sheets" table and other rows to docs/reference/ffxiv-terminology.md, read from the game client in all six languages (research: docs/research/2026-10-05-character-sheet-terms/, including lobby-rows.json).
For EACH of the seven rows, decide whether the dictionary or the research data on HEAD now pins the needed word (status NOW_PINNABLE, with the pinned word per language and the exact dictionary line / json key as the location), or still does not (STILL_UNPINNED, with what is still missing). Search the research JSON for the concept (e.g. clan, gender/sex, color slot, dye channel) in de/fr/ja/ko/zh. Do not guess from fluency: only a value present in the dictionary or the extracted client data counts. Return one item per row, item = the Concept column text.`, { label: 'notes:pin-first', phase: 'Notes', schema: NOTES_SCHEMA })

const [findings, notes, pins] = await Promise.all([findingsP, notesP, pinP])
const tally = {}
for (const f of findings.filter(Boolean)) tally[f.final] = (tally[f.final] || 0) + 1
log(`verdicts: ${JSON.stringify(tally)}`)
return { tally, findings, notes, pins }
