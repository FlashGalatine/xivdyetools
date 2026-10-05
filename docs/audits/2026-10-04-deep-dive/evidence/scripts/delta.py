"""Lead lists for the 2026-10-04 deep dive (read-only git; run from the preview worktree root).

evidence/commits-since-last-audit.txt   non-merge commits 79a69d1f (2026-09-16 deep-dive commit)..HEAD
evidence/changed-src-since-79a69d1f.txt  non-test source files changed since then, by deploy unit, with
                                        the open PR (if any) that changes each one
"""
import collections
import pathlib
import re
import subprocess

EV = pathlib.Path('docs/audits/2026-10-04-deep-dive/evidence')
BASE = '79a69d1f'
MAIN = '8ecb878f'
PRS = [(226, '065e2987'), (223, 'ffd22726'), (230, '7517a35d'), (224, '10a1cb77'), (225, 'ea264d49'),
       (227, '4ebd09f2'), (228, '9073d0df'), (229, '1eaefd63'), (231, '7c97fc1d'), (232, '6e8c7d81'),
       (233, '600f0568'), (234, '01465700'), (235, 'b5f551e0')]


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, text=True, encoding='utf-8', check=True).stdout


log = git('log', '--no-merges', '--format=%h %ad %s', '--date=short', f'{BASE}..HEAD')
(EV / 'commits-since-last-audit.txt').write_text(log, encoding='utf-8', newline='\n')

SRC = re.compile(r'^(apps|packages)/[^/]+/(src|scripts|functions|migrations)/.+\.(ts|tsx|js|mjs|sql)$|^scripts/.+\.ts$')
TEST = re.compile(r'\.(test|spec)\.[tj]sx?$|/__tests__/|/tests?/')
changed = [p for p in git('diff', '--name-only', f'{BASE}..HEAD').split() if SRC.search(p) and not TEST.search(p)]
by_pr = collections.defaultdict(list)
for n, sha in PRS:
    base = 'ffd22726' if n == 230 else git('merge-base', MAIN, sha).strip()
    for p in git('diff', '--name-only', f'{base}..{sha}').split():
        by_pr[p].append(f'#{n}')
by_unit = collections.defaultdict(list)
for p in changed:
    parts = p.split('/')
    unit = '/'.join(parts[:2]) if parts[0] in ('apps', 'packages') else 'root'
    by_unit[unit].append(p + (f"   [open PR {', '.join(by_pr[p])}]" if p in by_pr else ''))
out = [f'# Non-test source files changed {BASE}..HEAD (preview branch), grouped by deploy unit.',
       '# [open PR #N] = also changed by an open PR (code not yet on main).']
for u in sorted(by_unit):
    out.append(f'\n## {u} ({len(by_unit[u])})')
    out.extend('  ' + x for x in sorted(by_unit[u]))
(EV / f'changed-src-since-{BASE}.txt').write_text('\n'.join(out) + '\n', encoding='utf-8', newline='\n')
print(len(log.splitlines()), 'commits;', len(changed), 'changed source files;',
      ', '.join(f'{u}={len(v)}' for u, v in sorted(by_unit.items())))
