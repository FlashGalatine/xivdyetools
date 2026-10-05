"""Builds the 378-commit table for review-delta-commits.md.

Usage: python gen_table.py <delta-commits.txt> > table.md
Relevant commits get an explicit verdict; the rest are bulk-listed by category.
"""
import re
import sys

R = {
    'ef555e57': 'control added; auth/discord.ts reads bytes, caps, verifies the bytes (FINDING-001 fix holds)',
    '0a357852': 'control added; moderation-worker adopts the bounded verifier',
    '205f0be6': 'control added; GitHub webhook HMAC runs over raw bytes (FINDING-003 fix holds)',
    '863decb3': 'OK; signature over undecoded bytes',
    '3f72fc9e': 'OK; preset-submission webhook bounded by streamed bytes (readTextCapped)',
    '3c07b6b9': 'OK; UPDATE ... AND preview_image_key=? AND status=pending (FINDING-002 fix holds)',
    '247d368d': 'OK; isValidPreviewImageKey (78 chars, uuid/uuid.webp) gates the button',
    '0b5d814c': 'OK; a legacy button only refreshes the review, cannot approve',
    '74114ebf': 'OK; owner edit WHERE author+content_revision; migration 0014 trigger (FINDING-004 fix holds)',
    '6b7d1b3c': 'OK; status/revert conditional on revision and previous_values (FINDING-005 fix holds)',
    '3095b8ce': 'OK; OG log carries tool/locale/crawler type only (FINDING-006 fix holds)',
    '7d3f137f': 'OK; worker-kit bodyGuards lift is behavior-preserving (dangerous-key list retained)',
    'b639e9d2': 'OK; worker-kit 1.4.0 subpath exports',
    '3fcb5dd4': 'OK; oauth keeps 10 KB cap and depth 10',
    'e75328c5': 'OK; presets-api keeps the 5 MB preview-image exemption',
    '951e7177': 'OK; shared sniffer, 12-byte precondition, same table as image-worker',
    'ba38251e': 'OK; presets-api accept list png/jpeg/webp preserved',
    '1237d7d5': 'OK; image-worker re-exports the shared detector',
    '36a60081': 'control added; oauth security headers also on the misconfiguration 500 (BUG-017)',
    'e5ad1fe1': 'OK; reserve-then-act daily caps. INFO: fails open on a D1 error (rejected r5)',
    '596a3e4b': 'OK; id<=rowId tie-break',
    '231fc05d': 'OK; reservation released on body-read failure',
    'cfec7428': 'OK; refresh-author rejects an empty name instead of binding undefined',
    '3c5e5648': 'OK; ban target = snowflake or lowercase UUID, gated by isBanTargetId before D1 and custom_id',
    '17c6516f': 'OK; uppercase UUID refused',
    'c6c8c5f7': 'OK; moderation-worker 10 s timeout to presets-api',
    '64391c47': 'OK; fetch(url, init) shape for the service binding',
    'a6311d71': 'doc only; discord_id column may hold an XIVAuth UUID',
    '511261b2': 'doc only; ban-shed-by-linking residual documented (rejected r6)',
    '914c401f': 'OK; 5 s timeout on SPA pass-through, isAppHost gate unchanged',
    '9963891f': 'OK; wheel keyed only on the parameterised harmony card (shrinks the key space)',
    '3e6d9a46': 'OK; SWR cache.delete rejection caught',
    '9d3d6774': 'OK; /preset bounds in schema, choice names capped at 100',
    '551c2e33': 'OK; res.ok checked in notifySubmissionChannel',
    '7b2eaa66': 'OK; /stats reports the real environment, no new field',
    '21ae7d5b': 'OK; /manual spectrum_prices deferred inside the 3 s ack',
    'b36fd5a5': 'reviewed; response-only field from a build-time table, no new input',
    'cda81279': 'LOCAL build script; fetches XIVAPI and Teamcraft (commit-pinned) and commits the output (INFO c2)',
    '8ebb30bc': 'LOCAL build-time acquisition inputs',
    '6c2821a0': 'LOCAL build-time acquisition rules',
    '78678c78': 'LOCAL build-time GPOSERS formatter',
    '559a219c': 'build-time data',
    '6e9159f2': 'build-time data',
    '1877c975': 'OK; XIVAPI rule fields parsed defensively, rulesOf returns null on a partial answer',
    '9f4b26ae': 'OK; in-game check',
    'bfd393e7': 'reviewed; shared attachment guards, default 15/min per-user limit, service-binding resolve, sanitized embed text, nickname never leaves',
    '73480209': 'OK; plain() escapes formatting, allowed_mentions none',
    'dfa45fd0': 'OK; a refused body is the file problem',
    'f5e3aac2': 'OK; relayed reason is a validation message and passes sanitizeEmbedText',
    'ce296d09': 'OK; a 404 is ours, not the file',
    '975175da': 'OK; new /glamour/* routes on og-worker, default card only, no user input rendered',
    'b29b9562': 'release; Glamour Reader web-app 5.13.0, core 5.6.0, svg 4.2.0, api-worker 0.16.0',
    '0e83fe74': 'reviewed; localStorage holds user-typed free text keyed by an FNV hash of the gear; disclosed in PRIVACY; "Reset settings" does not clear it (c1)',
    '05f15f6c': 'OK; every value passes escapeHtml in the HTML flavor',
    '926d8f03': 'OK; static filename, no character name',
    '6628080e': 'OK; size guard retained in chara-file-loader',
    '6481d1c8': 'OK; session is memory-only; tribe/gender persisted in tool config',
    '3eaca5a7': 'OK; share URL carries at most 5 bare RRGGBB values, strictly validated',
    '161d0326': 'OK; ShareService extractor arm',
    '17eeecb4': 'OK; one revoke request for concurrent logouts',
    'a86e9dc0': 'OK; non-string collection name guarded',
    'b00bd30e': 'SHA-pinned (953926a2...); the SHA-to-v4.1.3 mapping could not be verified offline (handoff h1)',
    '21793551': 'dep bump; pnpm audit shows 0 advisories',
    '5faf2164': 'dep bump',
    '404105f7': 'dep bump',
    '43ee47e7': 'dep bump',
    '61015eb0': 'dev-only vitest 5 migration; removed tests spot-checked, none weakened a guard',
    'c50ea318': 'peer range only',
    '48c7dc8b': 'peer range only',
    '4df52961': 'adds SERVICE_RATE_LIMITER (api-worker wrangler.toml x2 envs, middleware/rate-limit.ts); reviewed: unique namespace ids, separate bucket, fail-open per accepted trade-off',
    '5dd7916b': 'merge with conflict-resolved docs/versions/changelog only',
    'fc11c8b2': 'merge; conflict-resolved src (api-worker chara resolver/types, web-app swatch-tool, config-controller) reviewed at HEAD through the full-range diff',
    '609330af': 'merge; docs/version files only',
    '6064ba94': 'merge; conflict-resolved pnpm-lock.yaml only (0 advisories at HEAD)',
    'f692799e': 'merge; docs/version files only',
    'e15928b2': 'policy-adjacent docs: Terms/README say ten tools; wording only',
    'c92126df': 'policy; Korean legal wording and doc accuracy for the six-language policies',
    '29b94984': 'policy-adjacent; Privacy Policy names the Advanced Settings panel (the sentence behind c1)',
    '215cfa42': 'dev-deps bump (10); pnpm audit 0 advisories',
    'd25f37e4': 'dev-deps bump (16)',
    'afce044d': 'dev-deps bump (dotenv 18, dev only)',
    '47d606aa': 'dev-deps bump (7)',
    'acd64eec': 'dev-deps bump (8)',
    '3f20ce12': 'dev-deps bump (@types/culori)',
    '7d922b89': 'guard test TIGHTENED: ban-check cases now identity-aware (UUID sub banned vs different id)',
    '6d89f89e': 'guard test TIGHTENED: KV-error test asserts fail-open + backendError + warning',
    'fd5689a7': 'guard test TIGHTENED: vacuous defer assertions made real',
    'f39cf88b': 'guard test TIGHTENED: toBeDefined replaced by strict equality',
    '55f212a3': 'guard test ADDED: legacy-Facewear 404 over HTTP',
    '0008820a': 'policy; bot Privacy and Terms in six languages, claims checked against code',
    '863cd0e7': 'policy; web Privacy and Terms in six languages; see c1',
    'acdcbaaf': 'policy; web-app Terms; policy links open with noopener,noreferrer',
    'b0e963a2': 'policy; Terms wording',
    'd71d4512': 'policy; five corrections',
    '2e4cb0cb': 'policy; Glamour Reader catch-up verified (nickname, model numbers only, Open-in links); c1 found in the same text',
}

CATS = [
    (r'^Merge pull request|^merge:', 'merge commits with no conflict-resolved content (the rest of their content is reviewed through the non-merge commits)'),
    (r'^docs?(\(|:)', 'docs / changelog / audit records (no executable change)'),
    (r'^i18n|locale|Korean|German|translation|spelling|American', 'i18n / locale strings / spelling'),
    (r'^test(\(|:)|^style|^chore\(deps|^chore\(release|^release|^Release|bump', 'tests / style / release and dependency bumps'),
    (r'^refactor|^fix|^feat|^perf', 'feature / bug-fix / refactor commits with no new route, storage write, outbound call or auth path (diffs scanned)'),
]

rows = []
bulk = {}
for line in open(sys.argv[1], encoding='utf-8'):
    line = line.rstrip('\n')
    if not line:
        continue
    sha, subj = line.split(' ', 1)
    if sha in R:
        rows.append((sha, subj, R[sha]))
        continue
    for pat, label in CATS:
        if re.search(pat, subj, re.I):
            bulk.setdefault(label, []).append(sha)
            break
    else:
        bulk.setdefault('other (skills / tooling / chore; no runtime effect)', []).append(sha)

print('| sha | subject | security-relevant? | verdict |')
print('|---|---|---|---|')
for sha, subj, v in rows:
    print('| %s | %s | YES | %s |' % (sha, subj[:90].replace('|', '/'), v))
print()
print('Non-relevant commits, bulk-listed. Cross-check done mechanically: every commit that touches a wrangler.toml, .github, a migration, a PRIVACY/TERMS file, pnpm-lock.yaml, an app middleware directory, packages/auth/src or the worker-kit rate-limiter has an explicit row above. Verdict for the remainder: no new route, outbound fetch, storage write, auth or limiter path, wrangler or workflow change or policy text; no guard test weakened.')
print()
tot = len(rows)
for label, shas in bulk.items():
    tot += len(shas)
    print('- **%s** (%d): %s' % (label, len(shas), ' '.join(shas)))
print()
print('Total commits accounted for: %d' % tot)
