# Official terms — Market Board / World / Data Center (web research, 2026-09-19)

Requested by the maintainer mid-audit because `docs/reference/ffxiv-terminology.md` has no row for
any of the three. Three `sonnet` researchers (ja+de+fr · ko · zh), web search + fetch, official
publisher sites first. English: Market Board / World / Data Center.

| Noun | ja | de | fr | ko | zh (CN client) |
|---|---|---|---|---|---|
| Market Board | マーケットボード | Marktbrett | tableau des ventes | 장터 | 市场布告板 |
| World | ワールド | Welt (pl. Welten) | Monde (capitalized by SE convention) | 서버 | 服务器 |
| Data Center | データセンター | Datenzentrum | centre de données | 데이터 센터 (with space) | 大区 |

## Sources and confidence

| Locale | Confidence | Source |
|---|---|---|
| ja | HIGH — fetched live | `jp.finalfantasyxiv.com/uiguide/item/item-market/market_how_to.html` ("マーケットボードの使い方がわかりません"); `jp.finalfantasyxiv.com/lodestone/worldstatus/` ("ワールド稼働状況", "物理データセンター") |
| de | HIGH — fetched live | `de.finalfantasyxiv.com/uiguide/item/item-market/market_how_to.html` ("Wie benutze ich ein Marktbrett?"); `de…/lodestone/worldstatus/` ("Status der Welten", "Logisches Datenzentrum") |
| fr | HIGH — fetched live | `fr.finalfantasyxiv.com/uiguide/item/item-market/market_how_to.html` ("Utiliser le tableau des ventes"); `fr…/lodestone/worldstatus/` ("État des Mondes", "Centre de données logique") |
| ko | HIGH for 장터 / 서버 / 데이터 센터 | `m.ff14.co.kr/guide/start/detail.asp?no=8` (heading "1. 장터란?"), `…detail.asp?no=1025` ("1개의 데이터 센터 에 여러개의 서버가 존재한다"), `www.ff14.co.kr/news/notice/view/944` ("신규 서버 '톤베리' 오픈 안내"). Read through WebFetch's summarizer, not raw HTML — eyeball the two guide pages once before shipping. |
| zh | MED-HIGH | Official `ff.web.sdo.com` renders client-side and could not be fetched; evidence = indexed official headlines ("《最终幻想14》中国版大区调整计划") + `ff14.huijiwiki.com/wiki/市场布告板` via search snippet (live fetch 403). Consistent across every source found. |

## What this refutes

- **fr `Tableau des marchés`** (web-app `config.marketBoard`, `config.enableMarketBoard`) — on no official page. Official running-prose form is lowercase `tableau des ventes`.
- **ko `시장 게시판` and `마켓보드`** (web-app, 3 keys each) — neither appears on any official page. The coordinator's own prior belief, `장터 게시판`, was also **refuted**: that is player/Inven usage for the physical object; the client noun is plain `장터`. bot-logic's `장터` was right all along.
- **zh `市场版`** (web-app `config.*`) — appears in no source, official or fan; a homophone typo of `市场板`. `市场板` itself is accepted player shorthand, not the client string.
- **ko `월드` / zh `世界` for a World** — the KR and CN clients say `서버` / `服务器`. `전체 월드`, `모든 월드`, `所有世界` are glosses of the Global term. An exact official "All Worlds" compound was not found for ko (LOW confidence on the compound; HIGH on the base noun).
