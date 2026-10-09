# Confirmed acquisition repairs and retired item resolution

Status: Implemented on PR #278; not merged or deployed.

The user confirmed these acquisition sources following the initial gap review:

| Family | Acquisition line | Items covered | Newly filled lines |
| --- | --- | ---: | ---: |
| Palazzo Diamond weapons | Dancing Mad (Ultimate) | 22 | 22 |
| First Light and Sacramental weapons, including Word of the Radiant / Blest | Pilgrim's Traverse | 44 | 44 |
| Level-44 Templar armor | Dzemael Darkhold | 5 | 1 |
| Great Shin-Zantetsuken / Shin-Zantetsuken | Baldesion Arsenal | 2 | 2 |

Regeneration using the original Teamcraft and XIVAPI pins added 69 acquisition lines, with no preexisting line changed or removed. The table now has 23,690 filled lines. Four Templar armor pieces already had the correct source. Name overrides in the generator preserve the Templar, Pilgrim and Arsenal mappings; the Palazzo Diamond token now maps to the existing Dancing Mad instance.

The user also identified three retired item families. The resolver now excludes Dated items with a known equipment level of 50 or below, every Aetherial item and every Deepmist item. It picks the lowest eligible row from the exact same slot and packed model family. Retired rows also disappear from alternate choices and grouped wear rules. A family with no eligible replacement resolves to null; Dated rows above level 50 or with an unknown level remain eligible. This is a resolution rule rather than deletion of client Item records from the acquisition generator's source inventory.

Pinned client probes confirmed these exact families:

- Dated Hempen Coif (372, level 1, Head / ModelMain 65540) → Hempen Coif (2629) or Hempen Coif of Gathering (2630).
- Deepmist Helm of Fending (13443, level 60, Head / ModelMain 196794) → Titanium Helm of Fending (10673).

Equipment rows now cache `LevelEquip`, under row-cache shape version 4. This invalidates older cached shapes instead of replaying them without a level. The selected item's own name, icon, regional names, acquisition and wear rules continue to be used. An excluded main-hand twin's ModelSub cannot cause a genuine shield to be named as the main weapon.

Validation: all 36 API/web dependency build, type-check, lint and test tasks passed (668 API tests, 3,127 web tests, coverage thresholds intact). The final focused regression run passed 119 tests, including a further off-hand guard test added after the full run, and final API type-check passed. Bundle budgets and documentation link/version checks passed. No game assets were modified.

The original [blank-item inventory](blank-items.csv) and [coffer inventory](coffer-lines.csv) remain frozen to the pre-repair snapshot. Unrelated acquisition candidates remain research work.
