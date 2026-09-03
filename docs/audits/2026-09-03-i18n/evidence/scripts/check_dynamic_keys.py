import json

LOCALES = ['en', 'ja', 'de', 'fr', 'ko', 'zh']
BASE = 'apps/web-app/src/locales/{}.json'

def flatten(obj, prefix=''):
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            fk = f'{prefix}.{k}' if prefix else k
            if isinstance(v, dict):
                out.update(flatten(v, fk))
            else:
                out[fk] = v
    return out

data = {}
for loc in LOCALES:
    with open(BASE.format(loc), 'r', encoding='utf-8') as f:
        raw = json.load(f)
    data[loc] = flatten(raw)

def cap(s):
    return s[0].upper() + s[1:]

families = []

# FAMILY 1: accessibility.<key> wrapper (metric-help.ts:137) — stems x suffixes + literals
stems = ['unitPct', 'unitRatio', 'unitDe']
suffixes = ['Label', 'Desc', 'Caveat', 'Short']
keys = [f'accessibility.{s}{suf}' for s in stems for suf in suffixes]
keys += ['accessibility.notAStandard', 'accessibility.tierClear', 'accessibility.tierFine',
         'accessibility.tierTight', 'accessibility.tierCollapsed', 'accessibility.learnMore']
families.append(('FAMILY1 accessibility.${key} wrapper (metric-help.ts:137-234)', keys))

# FAMILY 3: accessibility.visionDesc<Cap(id)> (accessibility-tool.ts:1338)
vision_ids = ['normal', 'deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia']
keys = [f'accessibility.visionDesc{cap(v)}' for v in vision_ids]
families.append(('FAMILY3 accessibility.visionDesc${Cap(vision.id)} (accessibility-tool.ts:1338)', keys))

# FAMILY 4: comparison.<key> wrapper (metric-help.ts:317, comparison-tool.ts:1555,1663)
method_stems = ['mCiede2000', 'mOklab', 'mCie76', 'mRedmean', 'mRgb', 'mDistinguish']
keys = [f'comparison.{s}{suf}' for s in method_stems for suf in ['Label', 'Desc', 'Caveat']]
keys += ['comparison.kind0', 'comparison.kind1', 'comparison.kind2']
keys += ['comparison.badgeSame', 'comparison.badgeClose', 'comparison.badgeWide', 'comparison.costSame',
         'comparison.whatDiffers', 'comparison.deltaLight', 'comparison.deltaSat', 'comparison.deltaHue',
         'comparison.deltaVendor', 'comparison.deltaSource', 'comparison.same', 'comparison.differs',
         'comparison.methodsLearnMore']
families.append(('FAMILY4 comparison.${key} wrapper (metric-help.ts:317, comparison-tool.ts:1555/1663)', keys))

# FAMILY 5: comparison.<METHOD_STEM>Short (metric-help.ts:302)
keys = [f'comparison.{s}Short' for s in method_stems]
families.append(('FAMILY5 comparison.${METHOD_STEM[method]}Short (metric-help.ts:302)', keys))

# FAMILY 6: comparison.<TIER_KEYS[tier]> (comparison-tool.ts:1207)
tier_keys = ['tierSame', 'tierClose', 'tierNear', 'tierFar']
keys = [f'comparison.{k}' for k in tier_keys]
families.append(('FAMILY6 comparison.${TIER_KEYS[tier]} (comparison-tool.ts:1207)', keys))

# FAMILY 7a: swatch.gearSlot.<slot> (chara-import.ts:1121, this.t wrapper -> swatch.)
gear_slots = ['MainHand', 'OffHand', 'HeadGear', 'Body', 'Hands', 'Legs', 'Feet', 'Ears', 'Neck',
              'Wrists', 'LeftRing', 'RightRing']
keys = [f'swatch.gearSlot.{s}' for s in gear_slots]
families.append(('FAMILY7a swatch.gearSlot.${slot} (chara-import.ts:1121, CharaGearSlotId domain)', keys))

# FAMILY 7b: swatch.<literal> via this.t() wrapper, all call sites in chara-import.ts
literal_swatch_keys = [
    'slotLeftEye', 'slotRightEye', 'slotHair', 'slotHighlights', 'slotSkin', 'slotTattoo',
    'slotLimbal', 'slotLips', 'slotFacePaint', 'absentHighlightsOff', 'absentFacePaintOff',
    'absentNoLips', 'absentFurPattern', 'absentNotInFile', 'offGrid', 'offGridNote', 'charaHint',
    'dropTitle', 'dropBody', 'chooseFile', 'orGrid', 'localOnly', 'replaceFile', 'slotsHead',
    'rangeLight', 'indexWinsNote', 'equipHead', 'makePalette', 'glamourViewPieces', 'glamourViewDyes',
    'gearHint', 'namesUnavailable', 'paletteTitle', 'paletteNamePlaceholder', 'paletteNameHint',
    'saveLocal', 'submitCommunity', 'paletteDefaultName',
]
keys = [f'swatch.{k}' for k in literal_swatch_keys]
families.append(('FAMILY7b swatch.${key} via this.t() wrapper, all literal call sites in chara-import.ts', keys))

# FAMILY 7c: swatch.slotError.* (SLOT_ERROR_KEY map + fallback, chara-import.ts:85-89,356-357)
keys = ['swatch.slotError.midRangeIndex', 'swatch.slotError.indexOutOfRange', 'swatch.slotError.noTribe',
        'swatch.slotError.unknown']
families.append(('FAMILY7c swatch.slotError.* (SLOT_ERROR_KEY Record, chara-import.ts:85-89)', keys))

# FAMILY 8: themes.<localeKey> (theme-modal.ts:131)
keys = ['themes.standardLight', 'themes.standardDark']
families.append(('FAMILY8 themes.${localeKey} (theme-modal.ts:131, ThemeService.getAllThemes() domain)', keys))

# FAMILY 9: preset.<id>.<field> (preset-i18n.ts:38)
curated_ids = ['gc-maelstrom', 'gc-adders', 'gc-flames', 'season-spring', 'season-summer',
               'season-autumn', 'season-winter', 'event-starlight', 'event-moonfire', 'event-rising',
               'event-hatching', 'event-valentione', 'event-heavensturn', 'event-littleladies',
               'event-allsaints']
keys = [f'preset.{i}.{f}' for i in curated_ids for f in ['name', 'description']]
families.append(('FAMILY9 preset.${id}.${field} (preset-i18n.ts:38, presets.json curated ids; has fallback to preset\'s own text)', keys))

# FAMILY 10: ${tool.translationKey}.title/.shortName/.description (v4-app-header.ts:533/534/565/588)
translation_keys = ['tools.harmony', 'tools.matcher', 'tools.accessibility', 'tools.comparison',
                     'tools.gradient', 'tools.mixer', 'tools.presets', 'tools.budget', 'tools.character']
keys = [f'{tk}.{suf}' for tk in translation_keys for suf in ['title', 'shortName', 'description']]
families.append(('FAMILY10 ${tool.translationKey}.title/.shortName/.description (v4-app-header.ts:533/534/565/588, TOOL_MENU domain)', keys))

# FAMILY 11: mixer.model<Cap(model)> (mixer-tool.ts:1251,1886)
models = ['ryb', 'spectral', 'oklab', 'lab', 'hsl', 'rgb']
keys = [f'mixer.model{cap(m)}' for m in models]
families.append(('FAMILY11 mixer.model${Cap(model)} (mixer-tool.ts:1251/1886, MODELS domain)', keys))

# Secondary / indirect-but-fixed (Record<Type,string> maps, still invisible to the literal-regex
# validator because the call site passes a variable, not a quoted literal)
keys = ['preset.categories.all', 'preset.categories.jobs', 'preset.categories.grandCompanies',
        'preset.categories.seasons', 'preset.categories.events', 'preset.categories.aesthetics',
        'preset.categories.appearance', 'preset.categories.zones', 'preset.categories.raidsTrials']
families.append(('SECONDARY preset-i18n.ts CATEGORY_LABEL_KEYS (Record indirection)', keys))

keys = ['preset.validation.nameMin', 'preset.validation.nameMax', 'preset.validation.descMin',
        'preset.validation.descMax', 'preset.validation.category', 'preset.validation.dyesMin',
        'preset.maxDyesAllowed', 'preset.validation.dyesInvalid', 'errors.unexpectedError',
        'preset.validation.tagsMax', 'preset.validation.tagLength']
families.append(('SECONDARY preset-i18n.ts VALIDATION_KEYS (Record indirection)', keys))

keys = ['preset.loginToSubmit', 'preset.loginToEdit', 'errors.submitPresetFailed',
        'errors.saveChangesFailed', 'errors.requestTimeout', 'errors.networkError',
        'preset.duplicateFound', 'preset.anotherPreset']
families.append(('SECONDARY preset-i18n.ts PRESET_ERROR_KEYS (Record indirection)', keys))

# ============================================================================
# Run checks
# ============================================================================

total_keys = 0
total_problems = 0
for name, keys in families:
    print(f'\n=== {name} ({len(keys)} keys) ===')
    for key in keys:
        total_keys += 1
        missing_in = [loc for loc in LOCALES if key not in data[loc]]
        non_string_in = [loc for loc in LOCALES if key in data[loc] and not isinstance(data[loc][key], str)]
        if missing_in or non_string_in:
            total_problems += 1
            print(f'  PROBLEM {key}: missing_in={missing_in} non_string_in={non_string_in}')

print(f'\n\nTOTAL dynamic/indirect keys checked: {total_keys}')
print(f'TOTAL problems found: {total_problems}')
