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
| ko | HIGH for 장터 / 서버 / 데이터 센터 | `m.ff14.co.kr/guide/start/detail.asp?no=8` (heading "1. 장터란?"), `…detail.asp?no=1025` ("1개의 데이터 센터 에 여러개의 서버가 존재한다"), `www.ff14.co.kr/news/notice/view/944` ("신규 서버 '톤베리' 오픈 안내"). First read through WebFetch's summarizer; **`장터` and `서버` then verified verbatim from raw full-page captures the maintainer supplied on 2026-09-20** (guide no. 8: title 장터, "1. 장터란?" — "장터란 아이템을 구입할 수 있는 공간이다. 장터는 도시에만 존재하며, "집사" 를 통해서 판매한 아이템만 구입할 수 있는 공간이다.", in-game map labels `장터 게시판` ×3; notice 944: "기존 3개 서버들", "신규 서버명: 톤베리", "기존 서버(카벙클, 모그리, 초코보)", "무료 서버 이전" — no `월드` anywhere on the page). `데이터 센터` (guide no. 1025) was not among the captures; **verified 2026-09-20 by loading the page in a real browser and reading the raw DOM text**: page heading "데이터 센터 선택하기", "1. 파이널판타지14 데이터 센터 란?" — "데이터 센터 란 여러개의 서버를 그룹하고 있는 상위 개념으로 1개의 데이터 센터 에 여러개의 서버가 존재한다." Counts on that page: `데이터 센터` ×38 (always with the space), `데이터센터` ×0, `서버` ×7, `월드` ×0. |
| zh | HIGH (was MED-HIGH until 2026-09-20) | Official `ff.web.sdo.com` renders client-side and could not be fetched; evidence = indexed official headlines ("《最终幻想14》中国版大区调整计划") + `ff14.huijiwiki.com/wiki/市场布告板` via search snippet (live fetch 403) — **then verified verbatim from the maintainer's raw page capture, 2026-09-20**: page title 市场布告板; "市场布告板即本游戏的玩家交易市场。玩家可在市场布告板上购买其他玩家的雇员出售的道具。" `服务器` / `大区` were not on a captured page; **verified 2026-09-20 on the official site itself** — `ff.web.sdo.com/web8/index.html#/servers` renders client-side, which is why no fetch could read it, so it was loaded in a real browser and the raw DOM text read: nav item "服务器状况", heading "全服务器状况一览", "※可创建角色的服务器将根据服务器承载状态动态开启/关闭新角色创建。", "※每个大区仅限获得1次100万金币，且仅限正式账号", "向特别优待服务器转服时…". Counts: `服务器` ×16, `大区` ×1, `世界` ×0, `数据中心` ×0. Confidence is now HIGH for all three zh nouns. |

## What this refutes

- **fr `Tableau des marchés`** (web-app `config.marketBoard`, `config.enableMarketBoard`) — on no official page. Official running-prose form is lowercase `tableau des ventes`.
- **ko `시장 게시판` and `마켓보드`** (web-app, 3 keys each) — neither appears on any official page. bot-logic's `장터` was right all along. **Corrected 2026-09-20:** the researcher reported the coordinator's prior belief `장터 게시판` as "player/Inven usage only" — that was wrong. The maintainer's raw capture of the official guide shows the in-game map labelling the board object `장터 게시판` three times, under the guide's own heading "3. 장터 위치". Both are official: `장터` = the feature (what the apps mean), `장터 게시판` = the board object.
- **zh `市场版`** (web-app `config.*`) — appears in no source, official or fan; a homophone typo of `市场板`. `市场板` itself is accepted player shorthand, not the client string.
- **ko `월드` / zh `世界` for a World** — the KR and CN clients say `서버` / `服务器`. `전체 월드`, `모든 월드`, `所有世界` are glosses of the Global term. An exact official "All Worlds" compound was not found for ko (LOW confidence on the compound; HIGH on the base noun).
