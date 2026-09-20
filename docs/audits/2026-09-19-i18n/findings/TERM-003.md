# TERM-003: ko/zh "World" and "Data Center" use the Global gloss, not the KR/CN client's term — and web-app disagrees with itself
**Tier:** P3 · **decided 2026-09-19: adopt the KR/CN client terms** · **Locale(s):** ko zh · **Deploy unit:** web-app, bot-logic · **Official term + source:** `evidence/official-terms-research.md`

## Location
| Noun | Locale | Official client term | web-app | bot-logic |
|---|---|---|---|---|
| World | ko | 서버 | `config.allWorlds` = 모든 월드 · `marketBoard.allWorlds` = 전체 월드 | 월드 throughout (`budget.*`, `preferences.*`) |
| World | zh | 服务器 | `config.allWorlds` = 所有服务器 ✅ · `marketBoard.allWorlds` = **所有世界** | 服务器 ✅ |
| Data Center | ko | 데이터 센터 (spaced) | — (no key) | 데이터센터 (unspaced) |
| Data Center | zh | 大区 | — | 数据中心 |

## Evidence
- `evidence/world-terms-web.txt`, `evidence/world-terms-bot.txt`. KR: `ff14.co.kr` notices say "신규 서버", never 월드. CN: every source says 服务器 / 大区.
- The zh web-app split (所有服务器 vs 所有世界) is an unambiguous inconsistency. The ko 월드 → 서버 change is a judgement call: Universalis serves KR and CN data centers, so those users do see their own client's vocabulary; but 월드 is understood and consistent in the bot.

## Fix
- **Maintainer decision: adopt the client terms on both surfaces.** ko: 월드 → `서버`, 데이터센터 → `데이터 센터` (spaced); zh: 世界 → `服务器`, 数据中心 → `大区`.
- web-app: `config.allWorlds` + `marketBoard.allWorlds` → ko `모든 서버` (one form for both keys), zh `所有服务器`. bot-logic: every ko `월드` / `데이터센터` and zh `数据中心` in `budget.*`, `preferences.*`, `manual*` (sweep with `scripts/en-needle-values.py bot world` / `"data center"`); slash-command option names (`world`) stay ASCII.
- Add World + Data Center rows to `ffxiv-terminology.md` with the sources in `evidence/official-terms-research.md`. bot-logic text change → CJK re-subset (terminal sprint). Eyeball the two `ff14.co.kr` guide pages once before shipping (read via a summarizing fetch).

## Status
FIXED 2026-09-20 `329fcc58` + `b76623dd` — ko `서버` / `데이터 센터`, zh `服务器` / `大区` on both surfaces, Korean particles re-agreed
