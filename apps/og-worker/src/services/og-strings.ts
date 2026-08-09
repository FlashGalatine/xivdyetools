/**
 * The og default-card deck strings ×6 — verbatim from
 * `String Pass - OG One-liners.dc.html` (CONFIRMED 2026-08-07), the worker's
 * first tool-describing card strings.
 *
 * Vocabulary anchors, not new coinage: names quote the shipped tool titles,
 * part 1's extractor retranslation, 1b's FR *Nuancier*, the shipped presets
 * community title — with two deliberate card-shortenings ×6 (harmony drops
 * the Explorer suffix; budget drops Suggestions). The root name
 * `XIV Dye Tools` never localises; EN writes EN-US (Color, not Colour —
 * superseding the 2a mock drafts). The deck renders on the Discord frame
 * only (the X degrade drops it), and the picture never localises without
 * `?lang=`.
 */

import type { LocaleCode } from '@xivdyetools/types';

export interface OgDeckStrings {
  name: string;
  sub: string;
}

type DeckKey =
  | 'harmony'
  | 'gradient'
  | 'mixer'
  | 'swatch'
  | 'comparison'
  | 'accessibility'
  | 'extractor'
  | 'presets'
  | 'budget'
  | 'root';

export const OG_DECK: Record<LocaleCode, Record<DeckKey, OgDeckStrings>> = {
  en: {
    harmony: { name: 'Color Harmony', sub: 'Build a palette around any dye. Six harmony types, real dyes only.' },
    extractor: { name: 'Palette Extractor', sub: 'Pull the palette from any image and match every color to a buyable dye.' },
    comparison: { name: 'Dye Comparison', sub: 'Two to four dyes side by side — every distance, closest pair first.' },
    gradient: { name: 'Gradient Builder', sub: 'The dyes along a gradient between two colors — distinct steps, no repeats.' },
    mixer: { name: 'Dye Mixer', sub: 'Blend two dyes and find the real dyes nearest the mix — five ratios, best first.' },
    accessibility: { name: 'Accessibility Checker', sub: 'See any pair as players with color-vision deficiencies see it — five lenses.' },
    budget: { name: 'Budget', sub: 'The cheapest dye near the one you want, priced from the market board.' },
    swatch: { name: 'Swatch Matcher', sub: 'Load a character file and match every color on it to a dye.' },
    presets: { name: 'Community Presets', sub: 'Curated and community palettes — browse, vote, submit your own.' },
    root: { name: 'XIV Dye Tools', sub: 'Color tools for FFXIV dyes — harmony, matching, prices, accessibility.' },
  },
  de: {
    harmony: { name: 'Farbharmonie', sub: 'Baue eine Palette um einen beliebigen Farbstoff — sechs Harmonietypen, nur echte Farbstoffe.' },
    extractor: { name: 'Paletten-Extraktor', sub: 'Ziehe die Palette aus jedem Bild und gleiche jede Farbe mit einem kaufbaren Farbstoff ab.' },
    comparison: { name: 'Farbstoffvergleich', sub: 'Zwei bis vier Farbstoffe nebeneinander — alle Distanzen, engstes Paar zuerst.' },
    gradient: { name: 'Verlauf-Ersteller', sub: 'Die Farbstoffe entlang eines Verlaufs zwischen zwei Farben — klare Stufen, keine Wiederholungen.' },
    mixer: { name: 'Farbstoffmixer', sub: 'Mische zwei Farbstoffe und finde die echten Farbstoffe nahe der Mischung — fünf Verhältnisse.' },
    accessibility: { name: 'Barrierefreiheitsprüfung', sub: 'Sieh jedes Paar so, wie es Spieler mit Farbsehschwäche sehen — fünf Linsen.' },
    budget: { name: 'Budget', sub: 'Der günstigste Farbstoff nahe deinem Wunschton — Preise vom Marktbrett.' },
    swatch: { name: 'Charakter-Matcher', sub: 'Lade eine Charakterdatei und gleiche jede Farbe darauf mit einem Farbstoff ab.' },
    presets: { name: 'Community-Vorlagen', sub: 'Kuratierte und Community-Paletten — stöbern, abstimmen, eigene einreichen.' },
    root: { name: 'XIV Dye Tools', sub: 'Farbwerkzeuge für FFXIV-Farbstoffe — Harmonie, Abgleich, Preise, Barrierefreiheit.' },
  },
  fr: {
    harmony: { name: 'Harmonies de couleurs', sub: "Construisez une palette autour d'une teinture — six types d'harmonie, teintures réelles uniquement." },
    extractor: { name: 'Extracteur de palette', sub: "Extrayez la palette de n'importe quelle image et associez chaque couleur à une teinture achetable." },
    comparison: { name: 'Comparaison de teintures', sub: "Deux à quatre teintures côte à côte — toutes les distances, la paire la plus proche d'abord." },
    gradient: { name: 'Constructeur de dégradé', sub: 'Les teintures le long d’un dégradé entre deux couleurs — des paliers distincts, sans doublons.' },
    mixer: { name: 'Mélangeur de teintures', sub: 'Mélangez deux teintures et trouvez les teintures réelles proches du mélange — cinq ratios.' },
    accessibility: { name: 'Vérification d’accessibilité', sub: 'Voyez chaque paire comme la voient les joueurs daltoniens — cinq filtres.' },
    budget: { name: 'Budget', sub: 'La teinture la moins chère proche de celle que vous voulez — prix du marché.' },
    swatch: { name: 'Nuancier', sub: 'Chargez un fichier de personnage et associez chacune de ses couleurs à une teinture.' },
    presets: { name: 'Palettes Communautaires', sub: 'Palettes sélectionnées et communautaires — parcourir, voter, proposer les vôtres.' },
    root: { name: 'XIV Dye Tools', sub: 'Outils couleur pour les teintures FFXIV — harmonie, correspondance, prix, accessibilité.' },
  },
  ja: {
    harmony: { name: 'カラーハーモニー', sub: '好きなカララントを軸にパレットを構築。6種類のハーモニー、実在の染料のみ。' },
    extractor: { name: 'パレット抽出', sub: '画像からパレットを抽出し、各色を入手可能な染料にマッチング。' },
    comparison: { name: 'カララント比較', sub: '2〜4つのカララントを並べて比較——全距離を表示、最も近いペアから。' },
    gradient: { name: 'グラデーションビルダー', sub: '2色間のグラデーションに沿った染料——重複のない明確なステップ。' },
    mixer: { name: 'カララントミキサー', sub: '2つのカララントをブレンドし、混色に近い実在の染料を探す——5つの比率、最良から。' },
    accessibility: { name: 'アクセシビリティチェッカー', sub: '色覚特性のあるプレイヤーの見え方でペアを確認——5つのレンズ。' },
    budget: { name: '予算', sub: '欲しい色に近い最安の染料——マーケットボードの価格で。' },
    swatch: { name: 'キャラクターマッチャー', sub: 'キャラクターファイルを読み込み、各色を染料にマッチング。' },
    presets: { name: 'コミュニティプリセット', sub: 'キュレーション＆コミュニティパレット——閲覧、投票、投稿。' },
    root: { name: 'XIV Dye Tools', sub: 'FFXIV染料のためのカラーツール——ハーモニー、マッチング、価格、アクセシビリティ。' },
  },
  ko: {
    harmony: { name: '색상 조화', sub: '원하는 염료를 중심으로 팔레트 구성 — 6가지 조화 유형, 실제 염료만.' },
    extractor: { name: '팔레트 추출', sub: '이미지에서 팔레트를 추출하고 모든 색을 구매 가능한 염료에 매칭.' },
    comparison: { name: '염료 비교', sub: '염료 2~4개를 나란히 — 모든 거리, 가장 가까운 쌍부터.' },
    gradient: { name: '그라데이션 빌더', sub: '두 색 사이 그라데이션을 따라 놓인 염료 — 중복 없는 뚜렷한 단계.' },
    mixer: { name: '염료 믹서', sub: '두 염료를 섞어 혼합색에 가까운 실제 염료 찾기 — 5가지 비율, 최적 우선.' },
    accessibility: { name: '접근성 검사기', sub: '색각 이상이 있는 플레이어의 시점으로 색 조합 확인 — 5가지 렌즈.' },
    budget: { name: '예산', sub: '원하는 색에 가까운 가장 저렴한 염료 — 시장 가격 기준.' },
    swatch: { name: '캐릭터 매처', sub: '캐릭터 파일을 불러와 모든 색을 염료에 매칭.' },
    presets: { name: '커뮤니티 프리셋', sub: '큐레이션 및 커뮤니티 팔레트 — 둘러보고, 투표하고, 직접 제출.' },
    root: { name: 'XIV Dye Tools', sub: 'FFXIV 염료를 위한 색상 도구 — 조화, 매칭, 가격, 접근성.' },
  },
  zh: {
    harmony: { name: '色彩和谐', sub: '以任意染剂为中心构建调色板——六种和谐类型，仅限真实染剂。' },
    extractor: { name: '调色板提取', sub: '从任意图像提取调色板，并将每种颜色匹配到可购买的染剂。' },
    comparison: { name: '染剂比较', sub: '两到四种染剂并排——全部距离，最接近的一对在前。' },
    gradient: { name: '渐变生成器', sub: '两色渐变沿线的染剂——步进清晰，不重复。' },
    mixer: { name: '染剂混合器', sub: '混合两种染剂，寻找最接近混色的真实染剂——五种比例，最佳在前。' },
    accessibility: { name: '无障碍检查器', sub: '以色觉障碍玩家的视角查看任意配色——五种滤镜。' },
    budget: { name: '预算', sub: '最接近目标色的低价染剂——按市场布告板价格。' },
    swatch: { name: '角色配色器', sub: '载入角色文件，将其中每种颜色匹配到染剂。' },
    presets: { name: '社区预设', sub: '精选与社区调色板——浏览、投票、提交你的作品。' },
    root: { name: 'XIV Dye Tools', sub: 'FFXIV 染剂的色彩工具——和谐、匹配、价格与无障碍。' },
  },
};

/** Deck strings for a tool (or 'root') in a locale, EN fallback. */
export function getOgDeck(key: DeckKey, locale: LocaleCode): OgDeckStrings {
  return OG_DECK[locale]?.[key] ?? OG_DECK.en[key];
}

// ============================================================================
// The header tool tag ×6
// ============================================================================

export type ToolTagKey = Exclude<DeckKey, 'root'>;

/**
 * The tool tag beside the header glyph — the design's `S` table verbatim
 * (`OG Card Directions` carries Harmony's row, `OG X Variants` the other
 * eight; they agree everywhere they overlap).
 *
 * The tag is a card label, not a tool title: it is deliberately shorter than
 * the deck name (COMPARE not Dye Comparison, VISION not Accessibility
 * Checker) because it shares a 30px strip with the wordmark. The glyph beside
 * it is redundancy, not a replacement — an unfurl has no embed title naming
 * the tool the way the bot's does.
 */
export const TOOL_TAG: Record<LocaleCode, Record<ToolTagKey, string>> = {
  en: {
    harmony: 'HARMONY',
    gradient: 'GRADIENT',
    mixer: 'MIXER',
    swatch: 'SWATCH',
    comparison: 'COMPARE',
    accessibility: 'VISION',
    extractor: 'EXTRACT',
    presets: 'PRESET',
    budget: 'BUDGET',
  },
  de: {
    harmony: 'HARMONIE',
    gradient: 'VERLAUF',
    mixer: 'MISCHER',
    swatch: 'FARBPROBE',
    comparison: 'VERGLEICH',
    accessibility: 'SEHKRAFT',
    extractor: 'EXTRAKT',
    presets: 'VORLAGE',
    budget: 'BUDGET',
  },
  fr: {
    harmony: 'HARMONIE',
    gradient: 'DÉGRADÉ',
    mixer: 'MÉLANGE',
    swatch: 'ÉCHANTILLON',
    comparison: 'COMPARER',
    accessibility: 'VISION',
    extractor: 'EXTRAIRE',
    presets: 'PRÉRÉGLAGE',
    budget: 'BUDGET',
  },
  ja: {
    harmony: 'ハーモニー',
    gradient: 'グラデーション',
    mixer: 'ミックス',
    swatch: 'カラー照合',
    comparison: '比較',
    accessibility: '色覚',
    extractor: '抽出',
    presets: 'プリセット',
    budget: '予算',
  },
  ko: {
    harmony: '하모니',
    gradient: '그라데이션',
    mixer: '믹서',
    swatch: '색상 대조',
    comparison: '비교',
    accessibility: '색각',
    extractor: '추출',
    presets: '프리셋',
    budget: '예산',
  },
  zh: {
    harmony: '配色',
    gradient: '渐变',
    mixer: '混色',
    swatch: '色样匹配',
    comparison: '比较',
    accessibility: '色觉',
    extractor: '提取',
    presets: '预设',
    budget: '预算',
  },
};

/** The header tool tag for a tool in a locale, EN fallback. */
export function getToolTag(key: ToolTagKey, locale: LocaleCode): string {
  return TOOL_TAG[locale]?.[key] ?? TOOL_TAG.en[key];
}

// ============================================================================
// Deck lines ×6 — the four headlines that are not pure data
// ============================================================================

/**
 * Five of the nine deck headlines compose themselves out of data the card
 * already localises (dye names, a preset name, Δ, the shipped harmony-type
 * and lens keys). These four do not, so they are authored here ×6 against the
 * suite's existing vocabulary. EN writes EN-US, per the String Pass.
 *
 * `{n}` / `{hex}` are substituted by `deckLine()`.
 */
export type DeckLineKey = 'swatchNearest' | 'extractorCount' | 'budgetBest' | 'a11yDyeCount';

export const OG_DECK_LINE: Record<LocaleCode, Record<DeckLineKey, string>> = {
  en: {
    swatchNearest: 'Nearest {n} to {hex}',
    extractorCount: '{n} colors from an image',
    budgetBest: 'Best per point:',
    a11yDyeCount: '{n} dyes',
  },
  de: {
    swatchNearest: 'Die {n} nächsten zu {hex}',
    extractorCount: '{n} Farben aus einem Bild',
    budgetBest: 'Bestes pro Punkt:',
    a11yDyeCount: '{n} Farbstoffe',
  },
  fr: {
    swatchNearest: 'Les {n} plus proches de {hex}',
    extractorCount: '{n} couleurs extraites d’une image',
    budgetBest: 'Meilleur par point :',
    a11yDyeCount: '{n} teintures',
  },
  ja: {
    swatchNearest: '{hex} に最も近い{n}色',
    extractorCount: '画像から{n}色',
    budgetBest: 'ポイント当たり最良：',
    a11yDyeCount: '{n}色の染料',
  },
  ko: {
    swatchNearest: '{hex}에 가장 가까운 {n}개',
    extractorCount: '이미지에서 {n}색',
    budgetBest: '포인트당 최적:',
    a11yDyeCount: '염료 {n}개',
  },
  zh: {
    swatchNearest: '最接近 {hex} 的 {n} 种',
    extractorCount: '从图像提取 {n} 种颜色',
    budgetBest: '每点最优：',
    a11yDyeCount: '{n} 种染剂',
  },
};

/** An authored deck line with `{n}` / `{hex}` filled in, EN fallback. */
export function deckLine(
  key: DeckLineKey,
  locale: LocaleCode,
  vars: { n?: number | string; hex?: string } = {}
): string {
  const template = OG_DECK_LINE[locale]?.[key] ?? OG_DECK_LINE.en[key];
  return template
    .replace('{n}', String(vars.n ?? ''))
    .replace('{hex}', vars.hex ?? '');
}
