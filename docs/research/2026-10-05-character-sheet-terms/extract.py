"""Re-derive the character creator's color labels from the game data, in six languages.

Run: python docs/research/2026-10-05-character-sheet-terms/extract.py   (writes lobby-rows.json beside it)

- EN / JA / DE / FR: XIVAPI v2 (the global client's sheets), cross-checked against a second,
  independent extraction (InfSein/ffxiv-datamining-mixed, GLOBAL 7.56 hotfix 2).
- KO: the KR client dump (Ra-Workspace/ffxiv-datamining-ko, patch 7.56h).
- ZH: the CN client dump (thewakingsands/ffxiv-datamining-cn, 2026.09.15), cross-checked against the
  same mixed repository's `chs` extraction.
Every GitHub URL is pinned to the commit read on 2026-10-05.
"""
import collections
import csv
import io
import json
import pathlib
import urllib.request

UA = {'User-Agent': 'xivdyetools-terminology-research/1.0'}   # XIVAPI answers 403 without one
XIVAPI = 'https://v2.xivapi.com/api/sheet/{sheet}?{query}'
KO = 'https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko/6be5d8cafd3450b7bcf4676d7d55bc2d7a4d6569/csv/{}.csv'
ZH = 'https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/9ac8b57bd3f716262bd5c713e8678ee510b07fb8/{}.csv'
MIXED = 'https://raw.githubusercontent.com/InfSein/ffxiv-datamining-mixed/e0c2c8f969019baade598294c030b675efb47bb5/{}/{}.csv'

# Customize indices of the color palettes (CharaMakeType.CharaMakeStruct[].Customize)
PALETTES = {8: 'skin', 9: 'eyes', 10: 'hair', 13: 'tattoo / limbal ring / ear clasps', 20: 'lips', 24: 'face paint (pattern)', 25: 'face paint (color)'}
# The color picker's own tab labels (no CharaMakeType reference): Dark / Light, Eye Color / Odd Eyes, Hair Color / Highlights
PICKER = [2122, 2123, 2124, 2125, 2128, 2129]
# Menu nouns beside their color menus, and the classic "Highlights" label
EXTRA = [237, 249, 1742, 1746]


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read().decode('utf-8-sig')


def csv_sheet(url):
    rows = list(csv.reader(io.StringIO(fetch(url))))
    return rows[1], {line[0]: line for line in rows[3:] if line}


def csv_menus(url):
    names, data = csv_sheet(url)
    menu = [i for i, n in enumerate(names) if n.startswith('Menu[')]
    cust = [i for i, n in enumerate(names) if n.startswith('Customize[')]
    use = collections.defaultdict(collections.Counter)
    for line in data.values():
        for mi, ci in zip(menu, cust):
            if mi < len(line) and int(line[ci] or 0) in PALETTES and line[mi] not in ('0', ''):
                use[int(line[ci])][int(line[mi])] += 1
    return {c: dict(v) for c, v in sorted(use.items())}


# 1. The global creator's menus: which Lobby row labels each palette, for which tribe / gender
q = 'limit=100&fields=Tribe.Masculine,Gender,CharaMakeStruct[].Menu.Text,CharaMakeStruct[].Customize&language=en'
cmt = json.loads(fetch(XIVAPI.format(sheet='CharaMakeType', query=q)))
menus = collections.defaultdict(lambda: collections.defaultdict(list))
for r in cmt['rows']:
    f = r['fields']
    who = f"{f['Tribe']['fields']['Masculine']} {'♂' if f['Gender'] == 0 else '♀'}"
    for s in f['CharaMakeStruct']:
        if s['Customize'] in PALETTES and s['Menu'].get('row_id'):
            menus[s['Customize']][s['Menu']['row_id']].append(who)
rows = sorted({row for c in menus.values() for row in c} | set(PICKER) | set(EXTRA))

# 2. Their text in six languages
text = {}
for lang in ('en', 'ja', 'de', 'fr'):
    d = json.loads(fetch(XIVAPI.format(sheet='Lobby', query=f"rows={','.join(map(str, rows))}&fields=Text&language={lang}")))
    text[lang] = {x['row_id']: x['fields']['Text'] for x in d['rows']}
for lang, url in (('ko', KO), ('zh', ZH)):
    names, data = csv_sheet(url.format('Lobby'))
    t = names.index('Text')
    text[lang] = {row: data[str(row)][t] for row in rows}

# 3. Cross-checks: a second extraction of the global client and of the CN client; the KR / CN menus
second = {}
for lang, folder in (('en', 'en'), ('ja', 'ja'), ('de', 'de'), ('fr', 'fr'), ('zh', 'chs')):
    names, data = csv_sheet(MIXED.format(folder, 'Lobby'))
    t = names.index('Text')
    second[lang] = [row for row in rows if data[str(row)][t] != text[lang][row]]
regional_menus = {'ko': csv_menus(KO.format('CharaMakeType')), 'zh': csv_menus(ZH.format('CharaMakeType'))}
global_menus = {c: {row: len(who) for row, who in v.items()} for c, v in sorted(menus.items())}

out = {
    'xivapi': {'schema': cmt.get('schema'), 'version': cmt.get('version')},
    'palettes': {str(c): {'what': PALETTES[c], 'lobby_rows': {str(row): sorted(set(who)) for row, who in v.items()}} for c, v in sorted(menus.items())},
    'text': {str(row): {lang: text[lang][row] for lang in ('en', 'ja', 'de', 'fr', 'ko', 'zh')} for row in rows},
    'checks': {
        'second_extraction_mismatches': second,
        'regional_menus_equal_global': {lang: {str(c): v for c, v in m.items()} == {str(c): v for c, v in global_menus.items()} for lang, m in regional_menus.items()},
    },
}
path = pathlib.Path(__file__).with_name('lobby-rows.json')
path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf-8', newline='\n')
print('rows:', len(rows), '| second-extraction mismatches:', {k: len(v) for k, v in second.items()},
      '| KR/CN menus equal global:', out['checks']['regional_menus_equal_global'])
