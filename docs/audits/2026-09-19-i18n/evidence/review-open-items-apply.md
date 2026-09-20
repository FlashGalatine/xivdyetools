# Reviewer hand-back — strings written while applying the solutions (opus verifier, 2026-09-20)

Brief: [open-items-apply-review-brief.md](open-items-apply-review-brief.md). Read-only, five
languages, everything already applied; asked to return only what was wrong. Kept as returned,
lightly reflowed. **All of it was applied** (`scripts/edits-05-apply-review.json`,
`scripts/unwrap-cjk-policy.py`) except where marked.

## A — German register pass: 53 of 54 correct

| key | old → new | why |
|---|---|---|
| `tutorial.comparison.favorites.description` | `Greife schnell auf deine Lieblingsfarbstoffe zu, …` → `Greife schnell auf deine Favoriten zu, um sie zum Vergleich hinzuzufügen.` | The Farbe → Farbstoff swap turned a natural compound (`Lieblingsfarben`) into "favourite dyestuffs" — a calque no native speaker writes — and coined a second term for something the UI already names: the step's title is `Favoriten verwenden`, the harmony step says `Deine Favoriten`. |

The other 53: du-imperatives well formed throughout (`überprüfe`, `stelle … ein`, `passe … an`,
`schalte … um`, `melde dich … an`, `lade … hoch`), `dein` / `deine` capitalised where it should
be, every Farbe → Farbstoff swap carries its agreement (`derselbe Farbstoff`, `eines Farbstoffs`,
`einen Farbstoff, den …`), meaning tracks the English. Recorded, not changed: `blendet` → `mischt`
fixed a real false friend (*blenden* = to dazzle) at the cost of a mild echo with `zum Mischen`.

## B — mixing-model labels

de: oklab = `Perzeptuell (modern)`, lab = `Perzeptuell`. `Moderne Wahrnehmung` / `Perzeptuell`
paired a noun ("modern perception") with an adjective for one family of models, and the noun
names the faculty rather than the model. The parenthetical keeps both the same part of speech,
avoids the ungrammatical `Modern perzeptuell`, and follows a pattern the file already uses
(`Linear (graue Mittelpunkte)`, `Farbtonbasiert (lebendig)`). Applied to `config.mixingOklab` and
`mixer.modelOklab`, which must stay identical. fr / ja / ko / zh pairs are internally parallel —
left. The de and zh Paint values read right in place.

## C — `changelog.olderReleases`

| lc | old → new | why |
|---|---|---|
| ko | `이전 릴리스는 GitHub에서 보기` → `더 오래된 릴리스는 GitHub에서 보기` | It reused `changelog.pastLabel` (`이전 릴리스`) verbatim, directly under that heading, so the link read as a duplicate of its section; English varies the adjective (EARLIER vs Older) and Korean can too. |

de / fr / ja / zh each vary the adjective exactly as the English does, on their block's own
word for "release".

## D — Terms of Service: all fine

de bot `das nach diesem Recht unabdingbar ist` is the German term of art and names the law as the
source; de web `auf das du nach diesem Recht nicht verzichten kannst` says the same in the plainer
register; both say `das an deinem Wohnort geltende Recht` — residence, not country, not "örtlich".
fr: `le droit de votre lieu de résidence` + `auquel ce même droit ne vous permet pas de renoncer`,
register split carried by `Rien dans ces Conditions` vs `Rien ici`. ko: `사용자가 거주하는 지역의
법이 부여하고 그 법이 포기할 수 없도록 정한` — `지역` covers state / province as well as country.
zh: `您居住地法律赋予且该法律不允许放弃的`. Nothing softened or added; no document reintroduces
"local law"; bot §3 English reads well; all twelve dates are 2026-09-20.

**ja verdict: correct as it stands, no change.** 「ユーザーの居住地の法律が付与し、放棄することを
認めていない消費者保護の権利」 already carries both clarifications: 居住地 is place of residence
(not 国), and が on 法律 governs both 付与し and 認めていない, so a reading where the user or the
Terms forbids waiver is not grammatically available.

## NOTES

- de `tutorial.harmony.baseColor.title`: `Basisfarbe wählen` → `Basisfarbstoff wählen` — the only
  place left calling it a Farbe. **Applied.**
- de `share.legacyLink`: `eine veraltete Farb-ID` → `eine veraltete Farbstoff-ID`. **Applied.**
- ko names HSL's H two ways for one model: `config.mixingHsl` = `색조 기반` (+ its Desc) but
  `mixer.modelHsl` = `색상`. 색상 is the standard Korean term for Hue (색상 / 채도 / 명도); 색조 is
  "tone". `색조 기반` → `색상 기반` in both config keys. Pre-existing. **Applied.**
- `apps/web-app/TERMS_OF_SERVICE.zh.md` hard-wraps mid-clause; a Markdown soft break renders as a
  space, so GitHub showed `您居住地 法律赋予`. **Applied more widely than noted:** all four zh policy
  files were hard-wrapped (74 CJK-to-CJK breaks; ja and ko had none) and were unwrapped with a
  whitespace-only invariant.
