# Official terms — "glamour" (web research, 2026-09-20)

Requested by the maintainer after remediation: `docs/reference/ffxiv-terminology.md` had no row for
"glamour", and the surfaces disagreed (`evidence/glamour-terms-web.txt`). Three `sonnet`
researchers (ja+de+fr · ko · zh), web search + fetch, publisher sites first. "Glamour" is three
things and the languages do not use one word for all of them, so each is recorded separately.

| Sense | ja | de | fr | ko | zh (CN client) |
|---|---|---|---|---|---|
| **A — the system** ("Glamours", Cast Glamour) | 武具投影 | die Projektion (command `Projizieren`) | le mirage (section « Les mirages », command `Projeter`) | 장비 투영 (verb 투영하다) | 武具投影 (patch-note register); 幻化 (SDO's own contest / section branding) |
| B — Glamour Prism | ミラージュプリズム | Projektionsprisma | prisme mirage | 환상의 프리즘 | 幻象棱晶 |
| B — Glamour Dresser | ミラージュドレッサー | Projektionskommode | coiffeuse mirage | 환상의 옷장 | 投影台 |
| B — Glamour Plate | ミラージュプレート | Projektionsplatte | planche mirage | 투영세트 | 投影模板 |
| B — Glamour Dispeller | ミラージュディスペラー | Entprojizierungskristall | dissipateur de mirage | 해제의 프리즘 | 驱幻晶 (MED) |
| **C — a glamour = one outfit / look** | ミラプリ (player shorthand that SE's own campaigns use: 「あなたの推しにミラプリしよう！」); formal Play-Guide noun コーディネート | die Projektion, **feminine**, countable ("eine Projektion"); contest prose: Projektions-Ensemble | le mirage, **masculine** ("Confectionnez votre mirage parfait et montrez-**le**") | no official noun — official copy says 의상 / 스타일, the genre is 패션 (패션 콘테스트, 패션 체크); players say **코디** / 룩 | 幻化 ("幻化大赛", "石之家幻化项目"; players: "这套幻化") |

## What the app said, and what that was

| Locale | web-app | bot-logic | Verdict |
|---|---|---|---|
| ja | ミラプリ | グラマー | ミラプリ is fine for tool copy. **グラマー is a false friend** — everyday Japanese for a curvy figure; zero hits on jp.finalfantasyxiv.com. |
| de | `Mirage` **and** `Glamour` (`dieser Mirage` / `diesem Glamour`) | Glamour | Neither is the German client's word. `Mirage` appears on no official German page; `Glamour` only in the one marketing banner "Glamour ist das Endgame!". Official: **die Projektion**. |
| fr | `mirage` **and** `glamour` (`cette mirage` / `ce glamour`) | glamour | `glamour` appears on no official French page. Official: **le mirage** — and it is masculine, so `cette mirage` was wrong twice. |
| ko | 글래머 | 패션 | **글래머 is a false friend** — everyday Korean for a voluptuous woman ("이 글래머의 염료" reads accordingly) and is never official. 패션 is the official *genre* word and is fine in "glamour enthusiasts"; for one outfit use **코디**. |
| zh | 幻化 | 时装 | 幻化 is right. 时装 is not an FFXIV term (a CN source: "FF14 游戏中并没有所谓'时装'的东西"). |

## Sources and confidence

| Locale | Confidence | Source |
|---|---|---|
| ja | HIGH (A, B) · MED (C — register split) | `jp.finalfantasyxiv.com/uiguide/fashion/` ("武具投影は、アクションリストの「武具投影」アクションを選択して始めます。"); `…/glamours_prism.html`, `…/fashion_dresser_where.html`, `…/fashion_plate_what.html`; Eorzea Database item `6d5e25c2fb9`; `…/fashion_dresser_save.html` ("お気に入りのコーディネートを保存して…"); Lodestone topic `6740e150…` (official campaign "あなたの推しにミラプリしよう！") |
| de | HIGH (A, B) · MED (C) | `de.finalfantasyxiv.com/uiguide/fashion/equipment-glamours/glamours_about.html` ("Mit einem Projektionsprisma und dem Kommando „Projizieren" …"; "…dass eine Projektion auf dem Gegenstand liegt."); official contest announcement ("…extravagan(za)testes Projektions-Ensemble…"); official-forum thread "Zeigt her eure Projektionen…" |
| fr | HIGH | `fr.finalfantasyxiv.com/uiguide/fashion/` (« Les mirages »); `…/glamours_prism.html` (« Les prismes mirage »), « La coiffeuse mirage », « Les planches mirage … »; Lodestone topic `6015c365…` ("Confectionnez votre mirage parfait et montrez-le…") |
| ko | HIGH (A, B) · player usage for C | `guide.ff14.co.kr/lodestone/playguide/view/154` (title "장비 투영"); patch 4.20 notes `www.ff14.co.kr/news/notice/view/1169` ("투영세트는 장비의 외형을 등록해서…", "환상의 옷장은 '환영화' 하여…"); item DB titles 환상의 프리즘 / 해제의 프리즘; contest `www.ff14.co.kr/events/2026/A0721` ("…모험가님만의 스타일을 완성해 주세요!"); 코디 attested on the official domain's community board (`…/community/knowledge/view/563`). `guide.ff14.co.kr` is client-rendered — titles plus corroborating static pages. |
| zh | HIGH (A, B except 驱幻晶) · MED-HIGH (C) | SDO patch-4.2 page `actff1.web.sdo.com/project/FF14Patch4.2/` ("现在可以将装备幻影化，存放在各城市旅馆中的「投影台」中…记录进投影模板进行全身投影。"); official contest page title "幻化大赛"; official Tencent channel post "石之家幻化项目正式启动"; `ff14.huijiwiki.com` item titles 幻象棱晶 / 驱幻晶 (403 to fetchers — indexed titles) |

## Refuted along the way

- The coordinator's guess **幻化棱晶** for the Glamour Prism is found nowhere; the item is 幻象棱晶.
- The coordinator's guessed Korean compounds (투영 서랍장, 투영 도안) are wrong: 환상의 옷장, 투영세트.
- The compounds do not template: de's Dispeller is `Entprojizierungskristall` (not `Projektions-…`),
  fr's is `dissipateur **de** mirage` while the other three drop the `de`. Verify each one.

## House choice where no official noun exists

Korean has no official noun for "one glamour (an outfit)". The house word is **코디** (the
researcher's recommendation: natural as a countable noun — "이 코디의 염료", "코디 팔레트"). 의상 is the
neutral, official-register alternative and 룩 the other player word; switching is a one-word change
and is the maintainer's call.
