/**
 * The crawler copy ×6 — og:title / og:description / the HTML body.
 *
 * @module services/og-embed
 */

import type { LocaleCode } from '@xivdyetools/types';

// ============================================================================
// The crawler copy ×6 — og:title / og:description / the HTML body
// ============================================================================

/**
 * What the crawler reads: the embed title and description for each tool, the
 * root and fallback cards, and the one body string. Authored ×6 in the same
 * vocabulary as the deck (2026-08-20 i18n audit, OG-I18N-002) — until then
 * these were English sentence templates with localized nouns spliced in
 * (`Snow White - 分裂補色 Harmony`).
 *
 * `{…}` placeholders are filled by `embed()`. Every locale carries the same
 * placeholder set as EN (`og-strings.test.ts` pins it). The `| XIV Dye Tools`
 * suffix is appended by the caller — the root name never localises. EN writes
 * EN-US. Tool names come from `OG_DECK` (the 5.0 web-app titles), never from
 * core `tools.*` — the embed title and the picture beneath it must agree.
 *
 * Lives in its own file on purpose: the crawler HTML is browser text, not
 * resvg text, so these strings need no font subset — and
 * `scripts/subset-cjk-fonts.py` parses every `  xx: {` block of
 * `og-strings.ts`, so keeping this table there would bloat the CJK subsets
 * with glyphs no card draws (and trip `font-coverage.test.ts`'s surplus
 * warning).
 */
export type EmbedKey =
  | 'harmony.title'
  | 'harmony.description'
  | 'harmony.titleNoDye'
  | 'harmony.descriptionNoDye'
  | 'gradient.title'
  | 'gradient.description'
  | 'gradient.descriptionDefault'
  | 'mixer.title2'
  | 'mixer.description2'
  | 'mixer.title3'
  | 'mixer.description3'
  | 'mixer.descriptionDefault'
  | 'swatch.title'
  | 'swatch.description'
  | 'swatch.descriptionSheet'
  | 'swatch.descriptionSheetRace'
  | 'swatch.descriptionDefault'
  | 'comparison.title'
  | 'comparison.description'
  | 'comparison.descriptionDefault'
  | 'accessibility.title'
  | 'accessibility.description'
  | 'accessibility.descriptionDefault'
  | 'accessibility.lensAll'
  | 'extractor.title'
  | 'extractor.description'
  | 'extractor.descriptionDefault'
  | 'presets.title'
  | 'presets.description'
  | 'presets.descriptionNoDyes'
  | 'presets.descriptionDefault'
  | 'budget.title'
  | 'budget.description'
  | 'budget.descriptionDefault'
  | 'root.title'
  | 'root.description'
  | 'unknown.description'
  | 'fallback.description'
  | 'gender.male'
  | 'gender.female'
  | 'body.open';

export const OG_EMBED: Record<LocaleCode, Record<EmbedKey, string>> = {
  en: {
    'harmony.title': '{dye} - {harmony} Harmony',
    'harmony.description': 'Explore {harmony} color harmonies for {dye} ({hex}) in FFXIV. Find matching dyes for your glamour!',
    'harmony.titleNoDye': '{harmony} Harmony',
    'harmony.descriptionNoDye': 'Explore {harmony} color harmonies for FFXIV dyes.',
    'gradient.title': '{start} to {end} Gradient',
    'gradient.description': '{n}-step gradient from {start} ({startHex}) to {end} ({endHex}). Find the perfect dye progression for your FFXIV glamour!',
    'gradient.descriptionDefault': 'Create smooth color gradients between FFXIV dyes.',
    'mixer.title2': '{ratio}% {a} + {ratioB}% {b}',
    'mixer.description2': 'Mix {ratio}% {a} with {ratioB}% {b} to find matching FFXIV dyes for your perfect blend!',
    'mixer.title3': '{a} + {b} + {c}',
    'mixer.description3': 'Mix {a}, {b}, and {c} to find matching FFXIV dyes for your perfect blend!',
    'mixer.descriptionDefault': 'Mix FFXIV dyes and find the closest matching result.',
    'swatch.title': 'Match {hex}',
    'swatch.description': 'Find the top {n} FFXIV dyes that match {hex}. Perfect for matching character colors or custom palettes!',
    'swatch.descriptionSheet': 'Find FFXIV dyes matching this {sheet} ({hex}).',
    'swatch.descriptionSheetRace': 'Find FFXIV dyes matching this {gender} {race} {sheet} ({hex}).',
    'swatch.descriptionDefault': 'Find the FFXIV dyes nearest any color — from a character file or a hex.',
    'comparison.title': 'Compare: {names}',
    'comparison.description': 'Side-by-side comparison of {n} FFXIV dyes: {names}. See how they look together!',
    'comparison.descriptionDefault': 'Compare up to 4 FFXIV dyes side by side.',
    'accessibility.title': '{lens}: {names}',
    'accessibility.description': 'See how {names} appear with {lens}. Design inclusive glamours!',
    'accessibility.descriptionDefault': 'Check how FFXIV dyes appear to players with color vision differences.',
    'accessibility.lensAll': 'Color Vision',
    'extractor.title': '{n}-color palette',
    'extractor.description': 'Colors extracted from an image ({list}), each matched to the nearest FFXIV dye.',
    'extractor.descriptionDefault': 'Pull the palette from any image and match every color to a buyable FFXIV dye.',
    'presets.title': '{preset} — {tool}',
    'presets.description': 'Curated FFXIV dye palette: {names}.',
    'presets.descriptionNoDyes': 'Curated FFXIV dye palette.',
    'presets.descriptionDefault': 'Curated and community FFXIV dye palettes — browse, vote, submit your own.',
    'budget.title': 'Budget alternatives for {dye}',
    'budget.description': 'Cheaper FFXIV dyes near {dye} ({hex}), ranked by color distance and priced from the market board.',
    'budget.descriptionDefault': 'The cheapest FFXIV dye near the one you want, priced from the market board.',
    'root.title': 'XIV Dye Tools - FFXIV Color & Dye Companion',
    'root.description': 'Explore FFXIV dye colors, create harmonious palettes, build gradients, mix colors, and find your perfect glamour combinations. Free web tools for Final Fantasy XIV players.',
    'unknown.description': 'Explore FFXIV dye colors, create harmonious palettes, and find your perfect glamour combinations.',
    'fallback.description': 'FFXIV Color & Dye Companion',
    'gender.male': 'male',
    'gender.female': 'female',
    'body.open': 'Open XIV Dye Tools →',
  },
  de: {
    'harmony.title': '{dye} – {harmony}-Harmonie',
    'harmony.description': 'Erkunde {harmony}-Farbharmonien für {dye} ({hex}) in FFXIV. Finde passende Farbstoffe für deinen Glamour!',
    'harmony.titleNoDye': '{harmony}-Harmonie',
    'harmony.descriptionNoDye': 'Erkunde {harmony}-Farbharmonien für FFXIV-Farbstoffe.',
    'gradient.title': 'Verlauf von {start} zu {end}',
    'gradient.description': 'Verlauf in {n} Stufen von {start} ({startHex}) zu {end} ({endHex}). Finde die perfekte Farbstoff-Abfolge für deinen FFXIV-Glamour!',
    'gradient.descriptionDefault': 'Erstelle weiche Farbverläufe zwischen FFXIV-Farbstoffen.',
    'mixer.title2': '{ratio} % {a} + {ratioB} % {b}',
    'mixer.description2': 'Mische {ratio} % {a} mit {ratioB} % {b} und finde passende FFXIV-Farbstoffe für deine perfekte Mischung!',
    'mixer.title3': '{a} + {b} + {c}',
    'mixer.description3': 'Mische {a}, {b} und {c} und finde passende FFXIV-Farbstoffe für deine perfekte Mischung!',
    'mixer.descriptionDefault': 'Mische FFXIV-Farbstoffe und finde das nächstgelegene Ergebnis.',
    'swatch.title': 'Abgleich {hex}',
    'swatch.description': 'Finde die {n} FFXIV-Farbstoffe, die {hex} am nächsten kommen. Ideal für Charakterfarben oder eigene Paletten!',
    'swatch.descriptionSheet': 'Finde FFXIV-Farbstoffe passend zu dieser {sheet} ({hex}).',
    'swatch.descriptionSheetRace': 'Finde FFXIV-Farbstoffe passend zu dieser {sheet} ({hex}) – {race}, {gender}.',
    'swatch.descriptionDefault': 'Finde die FFXIV-Farbstoffe, die jeder Farbe am nächsten kommen – aus einer Charakterdatei oder einem Hexcode.',
    'comparison.title': 'Vergleich: {names}',
    'comparison.description': '{n} FFXIV-Farbstoffe nebeneinander: {names}. Sieh, wie sie zusammen wirken!',
    'comparison.descriptionDefault': 'Vergleiche bis zu 4 FFXIV-Farbstoffe nebeneinander.',
    'accessibility.title': '{lens}: {names}',
    'accessibility.description': 'Sieh, wie {names} bei {lens} erscheinen. Gestalte inklusive Glamours!',
    'accessibility.descriptionDefault': 'Prüfe, wie FFXIV-Farbstoffe für Spieler mit Farbsehschwäche aussehen.',
    'accessibility.lensAll': 'Farbsehen',
    'extractor.title': 'Palette mit {n} Farben',
    'extractor.description': 'Aus einem Bild extrahierte Farben ({list}), jede dem nächsten FFXIV-Farbstoff zugeordnet.',
    'extractor.descriptionDefault': 'Ziehe die Palette aus jedem Bild und gleiche jede Farbe mit einem kaufbaren FFXIV-Farbstoff ab.',
    'presets.title': '{preset} — {tool}',
    'presets.description': 'Kuratierte FFXIV-Farbstoffpalette: {names}.',
    'presets.descriptionNoDyes': 'Kuratierte FFXIV-Farbstoffpalette.',
    'presets.descriptionDefault': 'Kuratierte und Community-Paletten für FFXIV-Farbstoffe – stöbern, abstimmen, eigene einreichen.',
    'budget.title': 'Günstige Alternativen zu {dye}',
    'budget.description': 'Günstigere FFXIV-Farbstoffe nahe {dye} ({hex}), nach Farbabstand sortiert und mit Preisen vom Marktbrett.',
    'budget.descriptionDefault': 'Der günstigste FFXIV-Farbstoff nahe deinem Wunschton – Preise vom Marktbrett.',
    'root.title': 'XIV Dye Tools – Farb- und Farbstoff-Begleiter für FFXIV',
    'root.description': 'Erkunde FFXIV-Farbstoffe, erstelle harmonische Paletten, baue Verläufe, mische Farben und finde deine perfekte Glamour-Kombination. Kostenlose Web-Tools für Final-Fantasy-XIV-Spieler.',
    'unknown.description': 'Erkunde FFXIV-Farbstoffe, erstelle harmonische Paletten und finde deine perfekte Glamour-Kombination.',
    'fallback.description': 'Farb- und Farbstoff-Begleiter für FFXIV',
    'gender.male': 'männlich',
    'gender.female': 'weiblich',
    'body.open': 'XIV Dye Tools öffnen →',
  },
  fr: {
    'harmony.title': '{dye} – Harmonie {harmony}',
    'harmony.description': "Explorez les harmonies {harmony} autour de {dye} ({hex}) dans FFXIV. Trouvez les teintures assorties pour votre mirage !",
    'harmony.titleNoDye': 'Harmonie {harmony}',
    'harmony.descriptionNoDye': 'Explorez les harmonies {harmony} pour les teintures FFXIV.',
    'gradient.title': 'Dégradé de {start} à {end}',
    'gradient.description': 'Dégradé en {n} paliers de {start} ({startHex}) à {end} ({endHex}). Trouvez la progression de teintures idéale pour votre mirage FFXIV !',
    'gradient.descriptionDefault': 'Créez des dégradés de couleurs entre les teintures FFXIV.',
    'mixer.title2': '{ratio} % {a} + {ratioB} % {b}',
    'mixer.description2': 'Mélangez {ratio} % de {a} et {ratioB} % de {b} pour trouver les teintures FFXIV les plus proches de votre mélange !',
    'mixer.title3': '{a} + {b} + {c}',
    'mixer.description3': 'Mélangez {a}, {b} et {c} pour trouver les teintures FFXIV les plus proches de votre mélange !',
    'mixer.descriptionDefault': 'Mélangez des teintures FFXIV et trouvez le résultat le plus proche.',
    'swatch.title': 'Correspondance {hex}',
    'swatch.description': 'Trouvez les {n} teintures FFXIV les plus proches de {hex}. Idéal pour les couleurs de personnage ou vos palettes !',
    'swatch.descriptionSheet': 'Trouvez les teintures FFXIV correspondant à cette {sheet} ({hex}).',
    'swatch.descriptionSheetRace': 'Trouvez les teintures FFXIV correspondant à cette {sheet} ({hex}) – {race} {gender}.',
    'swatch.descriptionDefault': "Trouvez les teintures FFXIV les plus proches de n'importe quelle couleur – depuis un fichier de personnage ou un code hexa.",
    'comparison.title': 'Comparaison : {names}',
    'comparison.description': '{n} teintures FFXIV côte à côte : {names}. Voyez comment elles s’accordent !',
    'comparison.descriptionDefault': 'Comparez jusqu’à 4 teintures FFXIV côte à côte.',
    'accessibility.title': '{lens} : {names}',
    'accessibility.description': 'Voyez comment {names} apparaissent avec {lens}. Concevez des mirages inclusifs !',
    'accessibility.descriptionDefault': 'Vérifiez comment les teintures FFXIV apparaissent aux joueurs daltoniens.',
    'accessibility.lensAll': 'Vision des couleurs',
    'extractor.title': 'Palette de {n} couleurs',
    'extractor.description': 'Couleurs extraites d’une image ({list}), chacune associée à la teinture FFXIV la plus proche.',
    'extractor.descriptionDefault': "Extrayez la palette de n'importe quelle image et associez chaque couleur à une teinture FFXIV achetable.",
    'presets.title': '{preset} — {tool}',
    'presets.description': 'Palette de teintures FFXIV sélectionnée : {names}.',
    'presets.descriptionNoDyes': 'Palette de teintures FFXIV sélectionnée.',
    'presets.descriptionDefault': 'Palettes de teintures FFXIV sélectionnées et communautaires – parcourir, voter, proposer les vôtres.',
    'budget.title': 'Alternatives économiques à {dye}',
    'budget.description': 'Teintures FFXIV moins chères proches de {dye} ({hex}), classées par distance de couleur et au prix du tableau des ventes.',
    'budget.descriptionDefault': 'La teinture FFXIV la moins chère proche de celle que vous voulez – prix du tableau des ventes.',
    'root.title': 'XIV Dye Tools – Compagnon couleurs et teintures pour FFXIV',
    'root.description': 'Explorez les teintures FFXIV, créez des palettes harmonieuses, des dégradés, des mélanges, et trouvez votre combinaison de mirage idéale. Outils web gratuits pour les joueurs de Final Fantasy XIV.',
    'unknown.description': 'Explorez les teintures FFXIV, créez des palettes harmonieuses et trouvez votre combinaison de mirage idéale.',
    'fallback.description': 'Compagnon couleurs et teintures pour FFXIV',
    'gender.male': 'homme',
    'gender.female': 'femme',
    'body.open': 'Ouvrir XIV Dye Tools →',
  },
  ja: {
    'harmony.title': '{dye} - {harmony}ハーモニー',
    'harmony.description': 'FFXIVの{dye}（{hex}）を軸にした{harmony}のカラーハーモニー。ミラプリに合うカララントを探そう！',
    'harmony.titleNoDye': '{harmony}ハーモニー',
    'harmony.descriptionNoDye': 'FFXIVのカララントで{harmony}のカラーハーモニーを探す。',
    'gradient.title': '{start}から{end}へのグラデーション',
    'gradient.description': '{start}（{startHex}）から{end}（{endHex}）への{n}段階グラデーション。FFXIVのミラプリにぴったりのカララントの流れを見つけよう！',
    'gradient.descriptionDefault': 'FFXIVのカララント間で滑らかなグラデーションを作成。',
    'mixer.title2': '{a} {ratio}% + {b} {ratioB}%',
    'mixer.description2': '{a} {ratio}%と{b} {ratioB}%を混ぜて、その混色に近いFFXIVのカララントを探そう！',
    'mixer.title3': '{a} + {b} + {c}',
    'mixer.description3': '{a}、{b}、{c}を混ぜて、その混色に近いFFXIVのカララントを探そう！',
    'mixer.descriptionDefault': 'FFXIVのカララントを混ぜて、最も近い結果を見つける。',
    'swatch.title': '{hex} のマッチング',
    'swatch.description': '{hex} に最も近いFFXIVのカララント{n}色。キャラクターの色や自作パレットの照合に！',
    'swatch.descriptionSheet': 'この{sheet}（{hex}）に合うFFXIVのカララントを探す。',
    'swatch.descriptionSheetRace': '{race}（{gender}）のこの{sheet}（{hex}）に合うFFXIVのカララントを探す。',
    'swatch.descriptionDefault': 'どんな色にも最も近いFFXIVのカララントを探す——キャラクターファイルからでも、16進数からでも。',
    'comparison.title': '比較：{names}',
    'comparison.description': 'FFXIVのカララント{n}色を並べて比較：{names}。組み合わせた見え方を確認！',
    'comparison.descriptionDefault': 'FFXIVのカララントを最大4色まで並べて比較。',
    'accessibility.title': '{lens}：{names}',
    'accessibility.description': '{lens}での{names}の見え方を確認。誰にでも伝わるミラプリを！',
    'accessibility.descriptionDefault': '色覚特性のあるプレイヤーにFFXIVのカララントがどう見えるかを確認。',
    'accessibility.lensAll': '色覚',
    'extractor.title': '{n}色のパレット',
    'extractor.description': '画像から抽出した色（{list}）を、それぞれ最も近いFFXIVのカララントにマッチング。',
    'extractor.descriptionDefault': '画像からパレットを抽出し、各色を入手可能なFFXIVのカララントにマッチング。',
    'presets.title': '{preset} — {tool}',
    'presets.description': 'キュレーションされたFFXIVのカララントパレット：{names}。',
    'presets.descriptionNoDyes': 'キュレーションされたFFXIVのカララントパレット。',
    'presets.descriptionDefault': 'キュレーション＆コミュニティのFFXIVカララントパレット——閲覧、投票、投稿。',
    'budget.title': '{dye}の低予算な代替',
    'budget.description': '{dye}（{hex}）に近い、より安いFFXIVのカララント——色差順に並べ、マーケットボードの価格付き。',
    'budget.descriptionDefault': '欲しい色に近い最安のFFXIVカララント——マーケットボードの価格で。',
    'root.title': 'XIV Dye Tools - FFXIVカララント＆カラーコンパニオン',
    'root.description': 'FFXIVのカララントを探索し、調和するパレットやグラデーション、混色を作り、理想のミラプリの組み合わせを見つけよう。ファイナルファンタジーXIVプレイヤーのための無料ウェブツール。',
    'unknown.description': 'FFXIVのカララントを探索し、調和するパレットを作り、理想のミラプリの組み合わせを見つけよう。',
    'fallback.description': 'FFXIVカララント＆カラーコンパニオン',
    'gender.male': '男性',
    'gender.female': '女性',
    'body.open': 'XIV Dye Tools を開く →',
  },
  ko: {
    'harmony.title': '{dye} - {harmony} 조화',
    'harmony.description': 'FFXIV의 {dye}({hex})를 중심으로 한 {harmony} 색상 조화. 환영 장비에 어울리는 염료를 찾아보세요!',
    'harmony.titleNoDye': '{harmony} 조화',
    'harmony.descriptionNoDye': 'FFXIV 염료로 {harmony} 색상 조화를 탐색하세요.',
    'gradient.title': '{start}에서 {end}까지 그라데이션',
    'gradient.description': '{start}({startHex})에서 {end}({endHex})까지 {n}단계 그라데이션. FFXIV 환영 장비에 딱 맞는 염료 흐름을 찾아보세요!',
    'gradient.descriptionDefault': 'FFXIV 염료 사이의 부드러운 색상 그라데이션을 만드세요.',
    'mixer.title2': '{a} {ratio}% + {b} {ratioB}%',
    'mixer.description2': '{a} {ratio}%와 {b} {ratioB}%를 섞어 혼합색에 가장 가까운 FFXIV 염료를 찾아보세요!',
    'mixer.title3': '{a} + {b} + {c}',
    'mixer.description3': '{a}, {b}, {c}를 섞어 혼합색에 가장 가까운 FFXIV 염료를 찾아보세요!',
    'mixer.descriptionDefault': 'FFXIV 염료를 섞고 가장 가까운 결과를 찾으세요.',
    'swatch.title': '{hex} 매칭',
    'swatch.description': '{hex}에 가장 가까운 FFXIV 염료 {n}개. 캐릭터 색상이나 나만의 팔레트 매칭에 딱!',
    'swatch.descriptionSheet': '이 {sheet}({hex})에 맞는 FFXIV 염료를 찾으세요.',
    'swatch.descriptionSheetRace': '{race} {gender}의 이 {sheet}({hex})에 맞는 FFXIV 염료를 찾으세요.',
    'swatch.descriptionDefault': '어떤 색이든 가장 가까운 FFXIV 염료 찾기 — 캐릭터 파일이나 16진수 코드로.',
    'comparison.title': '비교: {names}',
    'comparison.description': 'FFXIV 염료 {n}개 나란히 비교: {names}. 함께 놓았을 때 어떻게 보이는지 확인하세요!',
    'comparison.descriptionDefault': 'FFXIV 염료를 최대 4개까지 나란히 비교하세요.',
    'accessibility.title': '{lens}: {names}',
    'accessibility.description': '{lens}에서 {names}이(가) 어떻게 보이는지 확인하세요. 모두를 위한 환영 장비를 디자인하세요!',
    'accessibility.descriptionDefault': '색각 이상이 있는 플레이어에게 FFXIV 염료가 어떻게 보이는지 확인하세요.',
    'accessibility.lensAll': '색각',
    'extractor.title': '{n}색 팔레트',
    'extractor.description': '이미지에서 추출한 색({list})을 각각 가장 가까운 FFXIV 염료에 매칭.',
    'extractor.descriptionDefault': '어떤 이미지에서든 팔레트를 추출하고 모든 색을 구매 가능한 FFXIV 염료에 매칭하세요.',
    'presets.title': '{preset} — {tool}',
    'presets.description': '큐레이션된 FFXIV 염료 팔레트: {names}.',
    'presets.descriptionNoDyes': '큐레이션된 FFXIV 염료 팔레트.',
    'presets.descriptionDefault': '큐레이션 및 커뮤니티 FFXIV 염료 팔레트 — 둘러보고, 투표하고, 직접 제출하세요.',
    'budget.title': '{dye}의 저렴한 대안',
    'budget.description': '{dye}({hex})에 가까운 더 저렴한 FFXIV 염료 — 색상 거리순 정렬, 시장 게시판 가격 기준.',
    'budget.descriptionDefault': '원하는 색에 가까운 가장 저렴한 FFXIV 염료 — 시장 게시판 가격 기준.',
    'root.title': 'XIV Dye Tools - FFXIV 색상 & 염료 도우미',
    'root.description': 'FFXIV 염료 색상을 탐색하고, 조화로운 팔레트와 그라데이션, 혼합색을 만들고, 완벽한 환영 장비 조합을 찾아보세요. 파이널 판타지 XIV 플레이어를 위한 무료 웹 도구.',
    'unknown.description': 'FFXIV 염료 색상을 탐색하고, 조화로운 팔레트를 만들고, 완벽한 환영 장비 조합을 찾아보세요.',
    'fallback.description': 'FFXIV 색상 & 염료 도우미',
    'gender.male': '남성',
    'gender.female': '여성',
    'body.open': 'XIV Dye Tools 열기 →',
  },
  zh: {
    'harmony.title': '{dye} - {harmony}配色',
    'harmony.description': '以 FFXIV 的{dye}（{hex}）为中心探索{harmony}色彩和谐。为你的幻化找到相配的染剂！',
    'harmony.titleNoDye': '{harmony}配色',
    'harmony.descriptionNoDye': '用 FFXIV 染剂探索{harmony}色彩和谐。',
    'gradient.title': '从{start}到{end}的渐变',
    'gradient.description': '从{start}（{startHex}）到{end}（{endHex}）的 {n} 步渐变。为你的 FFXIV 幻化找到完美的染剂过渡！',
    'gradient.descriptionDefault': '在 FFXIV 染剂之间创建平滑的色彩渐变。',
    'mixer.title2': '{ratio}% {a} + {ratioB}% {b}',
    'mixer.description2': '混合 {ratio}% 的{a}与 {ratioB}% 的{b}，找到最接近混色的 FFXIV 染剂！',
    'mixer.title3': '{a} + {b} + {c}',
    'mixer.description3': '混合{a}、{b}与{c}，找到最接近混色的 FFXIV 染剂！',
    'mixer.descriptionDefault': '混合 FFXIV 染剂并找到最接近的结果。',
    'swatch.title': '匹配 {hex}',
    'swatch.description': '找出最接近 {hex} 的 {n} 种 FFXIV 染剂。适合匹配角色颜色或自定义调色板！',
    'swatch.descriptionSheet': '找出与这个{sheet}（{hex}）相配的 FFXIV 染剂。',
    'swatch.descriptionSheetRace': '找出与{race}（{gender}）的这个{sheet}（{hex}）相配的 FFXIV 染剂。',
    'swatch.descriptionDefault': '找出最接近任意颜色的 FFXIV 染剂——来自角色文件或十六进制色值。',
    'comparison.title': '比较：{names}',
    'comparison.description': '{n} 种 FFXIV 染剂并排比较：{names}。看看它们搭在一起的效果！',
    'comparison.descriptionDefault': '最多 4 种 FFXIV 染剂并排比较。',
    'accessibility.title': '{lens}：{names}',
    'accessibility.description': '看看{names}在{lens}下的样子。设计人人可辨的幻化！',
    'accessibility.descriptionDefault': '查看色觉障碍玩家眼中的 FFXIV 染剂。',
    'accessibility.lensAll': '色觉',
    'extractor.title': '{n} 色调色板',
    'extractor.description': '从图像提取的颜色（{list}），各自匹配到最接近的 FFXIV 染剂。',
    'extractor.descriptionDefault': '从任意图像提取调色板，并将每种颜色匹配到可购买的 FFXIV 染剂。',
    'presets.title': '{preset} — {tool}',
    'presets.description': '精选 FFXIV 染剂调色板：{names}。',
    'presets.descriptionNoDyes': '精选 FFXIV 染剂调色板。',
    'presets.descriptionDefault': '精选与社区 FFXIV 染剂调色板——浏览、投票、提交你的作品。',
    'budget.title': '{dye}的平价替代',
    'budget.description': '接近{dye}（{hex}）的更便宜的 FFXIV 染剂——按色差排序，按市场布告板价格计价。',
    'budget.descriptionDefault': '最接近目标色的低价 FFXIV 染剂——按市场布告板价格。',
    'root.title': 'XIV Dye Tools - FFXIV 色彩与染剂助手',
    'root.description': '探索 FFXIV 染剂色彩，创建和谐的调色板、渐变与混色，找到你的完美幻化搭配。为最终幻想 XIV 玩家打造的免费网页工具。',
    'unknown.description': '探索 FFXIV 染剂色彩，创建和谐的调色板，找到你的完美幻化搭配。',
    'fallback.description': 'FFXIV 色彩与染剂助手',
    'gender.male': '男性',
    'gender.female': '女性',
    'body.open': '打开 XIV Dye Tools →',
  },
};

/** An embed string with every `{name}` filled from `vars`, EN fallback. */
export function embed(
  key: EmbedKey,
  locale: LocaleCode,
  vars: Record<string, string | number> = {}
): string {
  const template = OG_EMBED[locale]?.[key] ?? OG_EMBED.en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}
