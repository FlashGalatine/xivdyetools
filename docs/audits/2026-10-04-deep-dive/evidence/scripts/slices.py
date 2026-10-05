"""Partition the non-test source inventory (evidence/src-files.txt, plus scripts/ and migrations/)
into review slices; write evidence/slices/<slice>.txt and print a size table. Every file lands in
exactly one slice (asserted)."""
import pathlib
import re
import subprocess

EV = pathlib.Path('docs/audits/2026-10-04-deep-dive/evidence')
files = [l for l in (EV / 'src-files.txt').read_text(encoding='utf-8').split('\n') if l]
extra = subprocess.run(['git', 'ls-files', 'scripts/*.ts', 'apps/*/scripts/*', 'packages/*/scripts/*',
                        'apps/*/migrations/*.sql', 'apps/*/schema.sql', 'apps/web-app/functions/*',
                        'apps/web-app/vite-plugin-*.ts', '.github/workflows/*.yml',
                        'apps/*/wrangler.toml', 'apps/*/package.json', 'packages/*/package.json'],
                       capture_output=True, text=True, encoding='utf-8').stdout.split()
extra = [f for f in extra if not re.search(r'\.(test|spec)\.[tj]s$', f)]
files = sorted(set(files) | set(extra))

TOOLS_A = r'apps/web-app/src/components/(swatch|gradient|mixer|harmony|budget)-tool'
TOOLS_B = r'apps/web-app/src/components/(comparison|extractor|accessibility)-tool|apps/web-app/src/components/(preset-edit-form|image-|color-|dye-)'
GLAMOUR = r'apps/web-app/src/(components|services|shared)/[^/]*(glamour|chara|gposers|twin|acquisition|item-link)'
RULES = [
    ('webapp-glamour', GLAMOUR),
    ('webapp-tools-a1', r'apps/web-app/src/components/(swatch|gradient)-tool'),
    ('webapp-tools-a2', TOOLS_A),
    ('webapp-tools-b', TOOLS_B),
    ('webapp-v4-shell', r'apps/web-app/src/components/v4/(config-sidebar|v4-layout|dye-palette-drawer|v4-app-header|tool-|mobile|v4-color)'),
    ('webapp-v4-presets', r'apps/web-app/src/components/v4/'),
    ('webapp-components', r'apps/web-app/src/components/'),
    ('webapp-services', r'apps/web-app/src/services/'),
    ('webapp-shared', r'apps/web-app/'),
    ('discord-handlers', r'apps/discord-worker/src/handlers/'),
    ('discord-services', r'apps/discord-worker/src/services/'),
    ('discord-core', r'apps/discord-worker/'),
    ('moderation-worker', r'apps/moderation-worker/'),
    ('presets-handlers', r'apps/presets-api/src/handlers/'),
    ('presets-core', r'apps/presets-api/'),
    ('api-worker', r'apps/api-worker/'),
    ('oauth', r'apps/oauth/'),
    ('og-worker', r'apps/og-worker/'),
    ('image-stoat', r'apps/(image-worker|stoat-worker)/'),
    ('core-color', r'packages/core/src/(services/color/|services/dye/(wheels|harmony|kd|KDTree|HarmonyGenerator)|blending|utils/color)'),
    ('core-chara', r'packages/core/src/[^ ]*(chara|glamour|gposers|human|cmp|twin)'),
    ('core-data', r'packages/core/'),
    ('svg', r'packages/svg/'),
    ('bot-logic', r'packages/bot-logic/'),
    ('pkg-foundation', r'packages/(auth|logger|types)/'),
    ('worker-kit-test-utils', r'packages/(worker-kit|test-utils)/'),
    ('root-ci', r'^(scripts/|\.github/)'),
]
out = {k: [] for k, _ in RULES}
unplaced = []
for f in files:
    for k, rx in RULES:
        if re.search(rx, f, re.I):
            out[k].append(f)
            break
    else:
        unplaced.append(f)
assert not unplaced, unplaced
(EV / 'slices').mkdir(exist_ok=True)
for k, fs in out.items():
    lines = 0
    for f in fs:
        try:
            lines += sum(1 for _ in open(f, encoding='utf-8', errors='ignore'))
        except OSError:
            pass
    (EV / 'slices' / f'{k}.txt').write_text('\n'.join(fs) + '\n', encoding='utf-8', newline='\n')
    print(f'{k:24} {len(fs):4} files {lines:6} lines')
