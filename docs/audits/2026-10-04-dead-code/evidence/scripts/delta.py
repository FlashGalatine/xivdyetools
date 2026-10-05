"""Write the two delta inventories this audit's reviewers start from (read-only git commands).

evidence/delta-since-2026-09-15.txt — files changed since the previous dead-code audit's snapshot
    (main@0332fcc5) on the preview branch, code files only, grouped by deploy unit.
evidence/pr-delta.txt — for each of the 13 open PRs merged into the preview branch, the code files
    it changes relative to main@8ecb878f (its merge base for #230 is #223's head, handled by diffing
    against the merge base).
Run from the monorepo root of the preview worktree.
"""
import collections
import pathlib
import re
import subprocess

OUT = pathlib.Path('docs/audits/2026-10-04-dead-code/evidence')
PREV = '0332fcc5768a4477301ed5b15590eee16a772f87'
MAIN = '8ecb878f'
PRS = [(226, '065e2987'), (223, 'ffd22726'), (230, '7517a35d'), (224, 'e34ea70a'), (225, '3a69828c'),
       (227, '4ebd09f2'), (228, '9073d0df'), (229, '1eaefd63'), (231, '7c97fc1d'), (232, '6e8c7d81'),
       (233, '600f0568'), (234, '01465700'), (235, 'b5f551e0')]
CODE = re.compile(r'\.(ts|tsx|js|mjs|cjs|vue|css|json|jsonc|toml|sql|yml|yaml|py|sh)$')


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, text=True, encoding='utf-8', check=True).stdout


def unit(path):
    p = path.split('/')
    return '/'.join(p[:2]) if p[0] in ('apps', 'packages') and len(p) > 1 else p[0]


def numstat(base, head):
    rows = []
    for line in git('diff', '--numstat', '-M', f'{base}..{head}').splitlines():
        add, rem, path = line.split('\t', 2)
        if '=>' in path:
            path = re.sub(r'\{[^}]*=> ([^}]*)\}', r'\1', path).replace('//', '/')
        if CODE.search(path) and not path.startswith('docs/audits/'):
            rows.append((unit(path), path, add, rem))
    return rows


lines = [f'# Code files changed {PREV[:8]} (2026-09-15 dead-code snapshot) .. preview HEAD',
         '# columns: +added -removed path (docs/audits/** and non-code files excluded)']
by_unit = collections.defaultdict(list)
for u, path, add, rem in numstat(PREV, 'HEAD'):
    by_unit[u].append(f'  +{add} -{rem} {path}')
for u in sorted(by_unit):
    lines.append(f'\n## {u} ({len(by_unit[u])} files)')
    lines.extend(sorted(by_unit[u]))
(OUT / 'delta-since-2026-09-15.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')

lines = [f'# Code files each open PR changes, relative to its merge base with the preview chain',
         f'# main = {MAIN}; #230 is stacked on #223, so its base is #223\'s head']
for n, sha in PRS:
    base = 'ffd22726' if n == 230 else git('merge-base', MAIN, sha).strip()
    rows = numstat(base, sha)
    lines.append(f'\n## PR #{n} @{sha} (base {base[:8]}, {len(rows)} code files)')
    lines.extend(f'  +{a} -{r} {p}' for _, p, a, r in sorted(rows, key=lambda x: x[1]))
(OUT / 'pr-delta.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')
print('written')
