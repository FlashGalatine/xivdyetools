import json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

keys_to_check = [
    ('preset', 'gateTitle'),
    ('accessibility', 'notAStandard'),
    ('comparison', 'kind0'),
    ('comparison', 'kind1'),
    ('comparison', 'kind2'),
    ('comparison', 'same'),
    ('comparison', 'differs'),
    ('comparison', 'badgeSame'),
    ('comparison', 'badgeClose'),
    ('comparison', 'badgeWide'),
]

for loc in ['en', 'ja', 'ko', 'zh']:
    with open(f'apps/web-app/src/locales/{loc}.json', encoding='utf-8') as f:
        d = json.load(f)
    print(f'--- {loc} ---')
    for ns, k in keys_to_check:
        v = d.get(ns, {}).get(k)
        print(f'  {ns}.{k} = {v!r}')
