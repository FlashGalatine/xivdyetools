"""Every user-visible string added/changed/removed since the last i18n audit's remediation merge.

BASE = 5c80fcba (merge of PR #192, the 2026-09-19 i18n remediation)
MAIN = origin/main at audit time (8ecb878f)
HEAD = the preview branch (main + the 13 open PRs)

Origin per key: PR when the HEAD value differs from MAIN's in any locale, else MAIN.
Writes evidence/delta/<set>.tsv and evidence/delta/diffs/*.diff. Read-only on the tree.
"""
import json
import os
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
EV = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(EV, 'delta')
BASE, MAIN, HEAD = '5c80fcba', '8ecb878f', 'HEAD'
LOCALES = ['en', 'ja', 'de', 'fr', 'ko', 'zh']
SETS = {
    'web-app': 'apps/web-app/src/locales',
    'bot-logic': 'packages/bot-logic/src/i18n/locales',
    'core': 'packages/core/src/data/locales',
}
TEXT_FILES = [
    'apps/og-worker/src/services/og-strings.ts',
    'apps/og-worker/src/services/og-embed.ts',
    'apps/discord-worker/src/commands/localize.ts',
    'apps/moderation-worker/src/services/bot-i18n.ts',
    'docs/reference/ffxiv-terminology.md',
    'packages/bot-logic/src/i18n/__tests__/locale-quality-allowlist.json',
    'apps/web-app/scripts/i18n-same-english-allowlist.json',
]


def git(*args):
    return subprocess.run(['git', *args], cwd=REPO, capture_output=True, text=True, encoding='utf-8').stdout


def load(rev, path):
    raw = git('show', f'{rev}:{path}')
    if not raw.strip():
        return {}
    return flatten(json.loads(raw))


def flatten(d, prefix=''):
    out = {}
    for k, v in d.items():
        key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return out


def esc(s):
    return (s or '').replace('\t', ' ').replace('\n', '\\n')


os.makedirs(os.path.join(OUT, 'diffs'), exist_ok=True)
summary = []
for name, d in SETS.items():
    data = {rev: {lc: load(rev, f'{d}/{lc}.json') for lc in LOCALES} for rev in (BASE, MAIN, HEAD)}
    keys = sorted(set(data[BASE]['en']) | set(data[HEAD]['en']))
    rows, counts = [], {'added': 0, 'changed': 0, 'removed': 0, 'MAIN': 0, 'PR': 0}
    for k in keys:
        b = [data[BASE][lc].get(k) for lc in LOCALES]
        h = [data[HEAD][lc].get(k) for lc in LOCALES]
        m = [data[MAIN][lc].get(k) for lc in LOCALES]
        if b == h:
            continue
        status = 'added' if all(x is None for x in b) else 'removed' if all(x is None for x in h) else 'changed'
        changed_locales = ','.join(lc for lc, x, y in zip(LOCALES, b, h) if x != y)
        origin = 'PR' if m != h else 'MAIN'
        counts[status] += 1
        counts[origin] += 1
        vals = h if status != 'removed' else b
        rows.append('\t'.join([k, status, origin, changed_locales] + [esc(v) for v in vals]))
    with open(os.path.join(OUT, f'{name}.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\t'.join(['key', 'status', 'origin', 'changed_locales'] + LOCALES) + '\n')
        f.write('\n'.join(rows) + ('\n' if rows else ''))
    summary.append(f'{name}: {len(rows)} keys ({counts})')

policy = [p for p in git('ls-files', 'apps/*/PRIVACY*.md', 'apps/*/TERMS_OF_SERVICE*.md').split('\n') if p]
for p in policy + TEXT_FILES:
    stem = p.replace('/', '__')
    for tag, a, b in (('main', BASE, MAIN), ('pr', MAIN, HEAD)):
        diff = git('diff', '--unified=2', f'{a}..{b}', '--', p)
        if diff.strip():
            with open(os.path.join(OUT, 'diffs', f'{stem}.{tag}.diff'), 'w', encoding='utf-8', newline='\n') as f:
                f.write(diff)
            summary.append(f'diff {tag}: {p} ({diff.count(chr(10))} lines)')

with open(os.path.join(OUT, 'SUMMARY.txt'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(summary) + '\n')
print('\n'.join(summary))
