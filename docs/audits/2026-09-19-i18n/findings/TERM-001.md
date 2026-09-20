# TERM-001: "Market Board" is named 2–3 different ways per locale inside web-app, and only one form per locale is the official client term
**Tier:** P2 · **Locale(s):** fr ko zh · **Deploy unit:** web-app (6 keys), bot-logic (zh, 4 keys), docs (dictionary row) · **Official term + source:** `evidence/official-terms-research.md`

## Location
| Locale | Official | web-app uses | bot-logic uses |
|---|---|---|---|
| fr | tableau des ventes | `Tableau des ventes` ×3 (`marketBoard.title`, `errors.apiFailed`, `footer.universalisCredit`) · **`Tableau des marchés` ×2** (`config.marketBoard`, `config.enableMarketBoard`) | tableau des ventes ×4 ✅ |
| ko | 장터 | **`시장 게시판` ×3** (`config.*`, `footer.universalisCredit`) · **`마켓보드` ×3** (`marketBoard.title`, `errors.apiFailed`, `harmony.marketFailBody`) — neither is official | 장터 ×4 ✅ |
| zh | 市场布告板 | `市场布告板` ×2 (`marketBoard.title`, `errors.apiFailed`) · `市场板` ×2 · **`市场版` ×2** (`config.*` — in no source; typo) | `市场板` ×4 (player shorthand) |
- ja `マーケットボード` and de `Marktbrett` are consistent and official on both surfaces.

## Evidence
- `evidence/market-board-term.txt` (tally by `scripts/market-board-term.py`); official forms fetched from the fr/de/jp Lodestone UI guide, `ff14.co.kr` guide no. 8, and the CN wiki + SDO headlines.
- The split is structural: the config sidebar (`config.*`) and the Market Board panel (`marketBoard.*`) were translated separately. `docs/reference/ffxiv-terminology.md` has no Market Board row, so nothing pinned either.

## Fix
- web-app: fr `config.*` → `Tableau des ventes`; ko all six → `장터`; zh all six → `市场布告板`. bot-logic zh ×4 → `市场布告板` (then re-subset both workers' CJK fonts — `布`/`告` may be new glyphs). Add a Market Board row to the dictionary so `term-check.py` guards it.

## Status
OPEN
