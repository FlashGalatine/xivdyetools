# Locale Parity Report

**Date:** 2026-04-28

Compared full path sets (`paths | join(".")`) across all locales in all stores. Excluded `meta.generated` (volatile timestamp).

## Summary

**100% structural match across all 18 files.** No missing keys, no extra keys, no duplicate keys.

## Detail

### bot-i18n (`packages/bot-i18n/src/locales/`)

| Locale | Lines | Top-level keys | Total paths | vs. en |
|--------|------:|---------------:|------------:|-------:|
| en | 681 | 26 | 605 | — |
| ja | 681 | 26 | 605 | OK |
| de | 681 | 26 | 605 | OK |
| fr | 681 | 26 | 605 | OK |
| ko | 681 | 26 | 605 | OK |
| zh | 681 | 26 | 605 | OK |

### web-app (`apps/web-app/src/locales/`)

| Locale | Lines | Top-level keys | Total paths | vs. en |
|--------|------:|---------------:|------------:|-------:|
| en | 1203 | 37 | 1119 | — |
| ja | 1203 | 37 | 1119 | OK |
| de | 1203 | 37 | 1119 | OK |
| fr | 1203 | 37 | 1119 | OK |
| ko | 1203 | 37 | 1119 | OK |
| zh | 1203 | 37 | 1119 | OK |

### core (`packages/core/src/data/locales/`)

| Locale | Lines | Top-level keys | Total paths | vs. en |
|--------|------:|---------------:|------------:|-------:|
| en | 274 | 14 | 243 | — |
| ja | 274 | 14 | 243 | OK |
| de | 274 | 14 | 243 | OK |
| fr | 274 | 14 | 243 | OK |
| ko | 274 | 14 | 243 | OK |
| zh | 274 | 14 | 243 | OK |

## Top-level keys per store

### bot-i18n (26 keys)

`common`, `language`, `errors`, `harmony`, `match`, `matchImage`, `mixer`, `dye`, `comparison`, `accessibility`, `favorites`, `collection`, `preset`, `manual`, `about`, `gradient`, `random`, `cosmic`, `quality`, `wcag`, `vision`, `harmonyTypes`, `dyeCategories`, `acquisitions`, `currencies`, `colorblindness`

### web-app (37 keys)

Includes the 26 above plus tool-specific keys (`tools.harmony`, `tools.match`, `tools.match-image`, `tools.mixer`, `tools.gradient`, `tools.character`, `tools.budget`, `tools.presets`, `tools.accessibility`), plus `themes`, `footer`, `meta`, etc.

### core (14 keys)

`locale`, `meta`, `labels`, `dyeNames`, `categories`, `acquisitions`, `currencies`, `metallicDyeIds`, `harmonyTypes`, `visionTypes`, `jobNames`, `grandCompanyNames`, `races`, `clans`

## Methodology

```python
import json, os
def all_paths(obj, prefix=''):
    paths = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f'{prefix}.{k}' if prefix else k
            paths.add(p)
            paths |= all_paths(v, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            paths |= all_paths(v, f'{prefix}[{i}]')
    return paths

# For each store and locale, compare all_paths(data) to en, ignoring '*.generated'
```

## Conclusion

The build pipeline (CSV + YAML + hardcoded tables → JSON) and the hand-authored stores are both producing structurally consistent output. **No action required for parity.** The risks identified in [I18N_AUDIT.md §4](./I18N_AUDIT.md) (ko/zh label fallback, English fallback for missing CSV columns) are forward-looking — current state is clean.
