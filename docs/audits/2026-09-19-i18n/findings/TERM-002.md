# TERM-002: web-app names five of its own tools differently in the result card's "send to tool" menu than in the tools' titles
**Tier:** P2 · **Locale(s):** de fr ja ko · **Deploy unit:** web-app · **Official term:** the tool's own `tools.<id>.title` (house term — there is no game noun)

## Location
- `apps/web-app/src/components/v4/result-card.ts:1809-1858` — menu items render `resultCard.tools.<id>`; the nav, headers and `document.title` render `tools.<id>.title`.

| Tool | Locale | `tools.<id>.title` | `resultCard.tools.<id>` |
|---|---|---|---|
| accessibility | de | Barrierefreiheitsprüfung | Barrierefreiheits-Prüfer |
| accessibility | fr | Vérification d'Accessibilité | Vérificateur d'Accessibilité |
| budget | fr | Suggestions Budget | Suggestions de Budget |
| comparison | ja | カララント比較 | 染料比較 |
| comparison | de | Farbstoffvergleich | Farbstoff-Vergleich |
| mixer | ja | カララントミキサー | 染料ミキサー |
| mixer | de | Farbstoffmixer | Farbstoff-Mischer |
| gradient | de | Verlauf-Ersteller | Farbverlauf-Ersteller |
| gradient | fr | Constructeur de Dégradé | Créateur de Dégradé |
| gradient | ko | 그라데이션 빌더 | 그라디언트 빌더 |

## Evidence
- `evidence/tool-name-consistency.txt` (`scripts/tool-name-consistency.py`): same EN value, divergent non-EN value, 5 of 9 tools. The ja rows are not the settled 染料/カララント *per-surface* house style — both keys are the same surface (web-app).
- The user clicks "Farbstoff-Mischer" and lands on a page titled "Farbstoffmixer".

## Fix
- Delete the seven `resultCard.tools.*` keys (×6) and render `tools.<id>.title` (or `.shortName` if width requires) in `result-card.ts`; one source per tool name. `@shared/tool-handoff` is the natural owner of the label lookup.

## Status
OPEN
