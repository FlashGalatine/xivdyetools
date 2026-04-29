#!/usr/bin/env node
/**
 * Build-time locale generator
 * Converts YAML + CSV → JSON locale files
 *
 * Usage: npm run build:locales
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { parse as parseCsv } from 'csv-parse/sync';

interface YamlLabels {
  Dye: string | null;
  General_Purpose: string | null;
  Dark: string | null;
  Metallic: string | string[] | null;
  Pastel: string | null;
  Cosmic: string | null;
  Cosmic_Exploration: string | null;
  Cosmic_Fortunes: string | null;
}

interface CsvRow {
  itemID: string;
  'English Name': string;
  'Japanese Name': string;
  'German Name': string;
  'French Name': string;
  'Korean Name': string;
  'Chinese Name': string;
}

interface Dye {
  itemID: number;
  name: string;
  category: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsv: { h: number; s: number; v: number };
  acquisition: string;
  price: number | null;
  currency: string | null;
}

type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

const LOCALE_NAMES: Record<LocaleCode, string> = {
  en: 'English',
  ja: 'Japanese',
  de: 'German',
  fr: 'French',
  ko: 'Korean',
  zh: 'Chinese',
};

async function main() {
  console.log('🌐 Building locale files...\n');

  // Use current working directory (where npm run is executed from)
  const workingDir = process.cwd();

  // Read YAML
  const yamlPath = path.join(workingDir, 'localize.yaml');
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const yamlData: Record<string, YamlLabels> = yaml.parse(yamlContent);

  // Read CSV
  const csvPath = path.join(workingDir, 'dyenames.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const csvRows: CsvRow[] = parseCsv(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Read colors_xiv.json for metallic dye IDs and categories
  const colorsPath = path.join(workingDir, 'src', 'data', 'colors_xiv.json');
  const colorsData: Dye[] = JSON.parse(fs.readFileSync(colorsPath, 'utf-8'));

  // Build each locale
  const locales: LocaleCode[] = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];
  const outputDir = path.join(workingDir, 'src', 'data', 'locales');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  for (const locale of locales) {
    console.log(`Building ${LOCALE_NAMES[locale]} (${locale})...`);

    const localeData = buildLocaleData(locale, yamlData, csvRows, colorsData);
    const outputPath = path.join(outputDir, `${locale}.json`);

    fs.writeFileSync(outputPath, JSON.stringify(localeData, null, 2), 'utf-8');
    console.log(`  ✓ Wrote ${outputPath} (${localeData.meta.dyeCount} dyes)\n`);
  }

  console.log('✅ Locale files built successfully!');
}

function buildLocaleData(
  locale: LocaleCode,
  yamlData: Record<string, YamlLabels>,
  csvRows: CsvRow[],
  colorsData: Dye[]
) {
  const labels = buildLabels(locale, yamlData[locale]);
  const dyeNames = buildDyeNames(locale, csvRows);
  const categories = buildCategories(locale);
  const metallicDyeIds = identifyMetallicDyes(colorsData);

  return {
    locale,
    meta: {
      version: '1.0.0',
      generated: new Date().toISOString(),
      dyeCount: Object.keys(dyeNames).length,
    },
    labels,
    dyeNames,
    categories,
    acquisitions: buildAcquisitions(locale),
    currencies: buildCurrencies(locale),
    metallicDyeIds,
    harmonyTypes: buildHarmonyTypes(locale),
    visionTypes: buildVisionTypes(locale),
    visions: buildVisionsShort(locale),
    tools: buildTools(locale),
    sheets: buildSheets(locale),
    jobNames: buildJobNames(locale),
    grandCompanyNames: buildGrandCompanyNames(locale),
    races: buildRaces(locale),
    clans: buildClans(locale),
  };
}

function buildLabels(
  locale: LocaleCode,
  yamlLabels: YamlLabels | undefined
): Record<string, string> {
  // Fallback labels for locales not in YAML (ko, zh)
  const fallbackLabels: Record<LocaleCode, Record<string, string>> = {
    en: {},
    ja: {},
    de: {},
    fr: {},
    ko: {
      dye: '염료',
      dark: '다크',
      metallic: '메탈릭',
      pastel: '파스텔',
      cosmic: '코스모',
      cosmicExploration: '코스모 탐사',
      cosmicFortunes: '코스모 행운',
    },
    zh: {
      dye: '染剂',
      dark: '暗色',
      metallic: '金属',
      pastel: '柔和',
      cosmic: '宇宙',
      cosmicExploration: '宇宙探索',
      cosmicFortunes: '宇宙幸运',
    },
  };

  // Use fallback if YAML data doesn't exist for this locale
  if (!yamlLabels) {
    return fallbackLabels[locale] || fallbackLabels.en;
  }

  const labels: Record<string, string> = {};

  // Add non-null labels
  if (yamlLabels.Dye) labels.dye = yamlLabels.Dye;
  if (yamlLabels.Dark) labels.dark = yamlLabels.Dark;

  // Handle French Metallic array - take first value
  if (yamlLabels.Metallic) {
    labels.metallic = Array.isArray(yamlLabels.Metallic)
      ? yamlLabels.Metallic[0]
      : yamlLabels.Metallic;
  }

  if (yamlLabels.Pastel) labels.pastel = yamlLabels.Pastel;
  if (yamlLabels.Cosmic) labels.cosmic = yamlLabels.Cosmic;
  if (yamlLabels.Cosmic_Exploration) labels.cosmicExploration = yamlLabels.Cosmic_Exploration;
  if (yamlLabels.Cosmic_Fortunes) labels.cosmicFortunes = yamlLabels.Cosmic_Fortunes;

  return labels;
}

function buildDyeNames(locale: LocaleCode, csvRows: CsvRow[]): Record<string, string> {
  const nameColumn = `${LOCALE_NAMES[locale]} Name` as keyof CsvRow;
  // Fallback to English if a locale column is missing or empty
  const fallbackColumn = 'English Name' as keyof CsvRow;
  const dyeNames: Record<string, string> = {};

  for (const row of csvRows) {
    const itemID = row.itemID.trim();
    // Try locale column first, fall back to English
    const name = row[nameColumn]?.trim() || row[fallbackColumn]?.trim();

    if (itemID && name) {
      dyeNames[itemID] = name;
    }
  }

  return dyeNames;
}

function buildCategories(locale: LocaleCode): Record<string, string> {
  // Hardcoded category translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      Neutral: 'Neutral',
      Reds: 'Reds',
      Blues: 'Blues',
      Browns: 'Browns',
      Greens: 'Greens',
      Yellows: 'Yellows',
      Purples: 'Purples',
      Special: 'Special',
      Facewear: 'Facewear',
    },
    ja: {
      Neutral: 'ニュートラル',
      Reds: '赤系',
      Blues: '青系',
      Browns: '茶系',
      Greens: '緑系',
      Yellows: '黄系',
      Purples: '紫系',
      Special: '特殊',
      Facewear: 'フェイスウェア',
    },
    de: {
      Neutral: 'Neutral',
      Reds: 'Rot',
      Blues: 'Blau',
      Browns: 'Braun',
      Greens: 'Grün',
      Yellows: 'Gelb',
      Purples: 'Violett',
      Special: 'Spezial',
      Facewear: 'Gesichtsschmuck',
    },
    fr: {
      Neutral: 'Neutre',
      Reds: 'Rouges',
      Blues: 'Bleus',
      Browns: 'Marrons',
      Greens: 'Verts',
      Yellows: 'Jaunes',
      Purples: 'Violets',
      Special: 'Spécial',
      Facewear: 'Accessoires faciaux',
    },
    ko: {
      Neutral: '중성',
      Reds: '빨강',
      Blues: '파랑',
      Browns: '갈색',
      Greens: '녹색',
      Yellows: '노랑',
      Purples: '보라',
      Special: '특수',
      Facewear: '페이스웨어',
    },
    zh: {
      Neutral: '中性',
      Reds: '红色系',
      Blues: '蓝色系',
      Browns: '棕色系',
      Greens: '绿色系',
      Yellows: '黄色系',
      Purples: '紫色系',
      Special: '特殊',
      Facewear: '脸部配饰',
    },
  };

  return translations[locale];
}

function buildAcquisitions(locale: LocaleCode): Record<string, string> {
  // Hardcoded acquisition translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      'Dye Vendor': 'Dye Vendor',
      Crafting: 'Crafting',
      'Cosmic Exploration': 'Cosmic Exploration',
      'Cosmic Fortunes': 'Cosmic Fortunes',
      'The Firmament': 'The Firmament',
      'Venture Coffers': 'Venture Coffers',
      'Facewear Collection': 'Facewear Collection',
    },
    ja: {
      'Dye Vendor': '染料販売業者',
      Crafting: '製作',
      'Cosmic Exploration': 'コスモエクスプローラー',
      'Cosmic Fortunes': 'コスモフォーチュン',
      'The Firmament': '蒼天街',
      'Venture Coffers': 'リテイナーの宝箱',
      'Facewear Collection': 'フェイスウェアコレクション',
    },
    de: {
      'Dye Vendor': 'Farbstoffverkäufer',
      Crafting: 'Handwerker',
      'Cosmic Exploration': 'Kosmo-Erkundung',
      'Cosmic Fortunes': 'Kosmo-Glück',
      'The Firmament': 'Himmelsstadt',
      'Venture Coffers': 'Gehilfen-Schatzkiste',
      'Facewear Collection': 'Gesichtsschmuck-Sammlung',
    },
    fr: {
      'Dye Vendor': 'Vendeur de teinture',
      Crafting: 'Artisanat',
      'Cosmic Exploration': "l'exploration cosmique",
      'Cosmic Fortunes': 'Roue de la fortune cosmique',
      'The Firmament': 'Azurée',
      'Venture Coffers': 'Trouvaille de servant',
      'Facewear Collection': 'Collection accessoires faciaux',
    },
    ko: {
      'Dye Vendor': '염료 판매상',
      Crafting: '제작',
      'Cosmic Exploration': '코스모 탐사',
      'Cosmic Fortunes': '코스모 행운',
      'The Firmament': '창천 거리',
      'Venture Coffers': '집사의 보물상자',
      'Facewear Collection': '페이스웨어 컬렉션',
    },
    zh: {
      'Dye Vendor': '染剂商人',
      Crafting: '制作',
      'Cosmic Exploration': '宇宙探索',
      'Cosmic Fortunes': '宇宙幸运',
      'The Firmament': '天穹街',
      'Venture Coffers': '雇员宝箱',
      'Facewear Collection': '脸部配饰收藏',
    },
  };

  return translations[locale];
}

function buildCurrencies(locale: LocaleCode): Record<string, string> {
  // Abbreviated display labels for vendor cost currencies
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      Gil: 'Gil',
      'Skybuilders Scrips': 'Scrips',
      Cosmocredits: 'CC',
      'Venture Coffer': 'Coffer',
      'Red Pigment': 'Red Pigment',
      'Blue Pigment': 'Blue Pigment',
      'Yellow Pigment': 'Yellow Pigment',
      'Green Pigment': 'Green Pigment',
      'Brown Pigment': 'Brown Pigment',
      'Purple Pigment': 'Purple Pigment',
      'Planet-specific Credit': 'Credit',
    },
    ja: {
      Gil: 'ギル',
      'Skybuilders Scrips': '振興券',
      Cosmocredits: 'CC',
      'Venture Coffer': '宝箱',
      'Red Pigment': 'レッドピグメント',
      'Blue Pigment': 'ブルーピグメント',
      'Yellow Pigment': 'イエローピグメント',
      'Green Pigment': 'グリーンピグメント',
      'Brown Pigment': 'ブラウンピグメント',
      'Purple Pigment': 'パープルピグメント',
      'Planet-specific Credit': 'クレジット',
    },
    de: {
      Gil: 'Gil',
      'Skybuilders Scrips': 'Scheine',
      Cosmocredits: 'CC',
      'Venture Coffer': 'Schatzkiste',
      'Red Pigment': 'Rote Farbpigmente',
      'Blue Pigment': 'Blaue Farbpigmente',
      'Yellow Pigment': 'Gelbe Farbpigmente',
      'Green Pigment': 'Grüne Farbpigmente',
      'Brown Pigment': 'Braune Farbpigmente',
      'Purple Pigment': 'Violette Farbpigmente',
      'Planet-specific Credit': 'Kredit',
    },
    fr: {
      Gil: 'Gil',
      'Skybuilders Scrips': 'Assignats',
      Cosmocredits: 'CC',
      'Venture Coffer': 'Trouvaille',
      'Red Pigment': 'Pigment rouge',
      'Blue Pigment': 'Pigment bleu',
      'Yellow Pigment': 'Pigment jaune',
      'Green Pigment': 'Pigment vert',
      'Brown Pigment': 'Pigment brun',
      'Purple Pigment': 'Pigment violet',
      'Planet-specific Credit': 'Crédit',
    },
    ko: {
      Gil: '길',
      'Skybuilders Scrips': '진흥권',
      Cosmocredits: 'CC',
      'Venture Coffer': '보물상자',
      'Red Pigment': '빨간색 안료',
      'Blue Pigment': '파란색 안료',
      'Yellow Pigment': '노란색 안료',
      'Green Pigment': '초록색 안료',
      'Brown Pigment': '갈색 안료',
      'Purple Pigment': '보라색 안료',
      'Planet-specific Credit': '크레딧',
    },
    zh: {
      Gil: '金币',
      'Skybuilders Scrips': '振兴票',
      Cosmocredits: 'CC',
      'Venture Coffer': '宝箱',
      'Red Pigment': '红色色素',
      'Blue Pigment': '蓝色色素',
      'Yellow Pigment': '黄色色素',
      'Green Pigment': '绿色色素',
      'Brown Pigment': '棕色色素',
      'Purple Pigment': '紫色色素',
      'Planet-specific Credit': '信用点',
    },
  };

  return translations[locale];
}

function identifyMetallicDyes(colorsData: Dye[]): number[] {
  // Metallic dyes that don't have "Metallic" prefix but are metallic
  // Gunmetal Black (30122) and Pearl White (30123) are metallic Special dyes
  const additionalMetallicIds = [30122, 30123];

  // Identify all metallic dyes based on name prefix "Metallic"
  const metallicDyes = colorsData.filter((dye) => dye.name.startsWith('Metallic'));

  const metallicIds = metallicDyes.map((dye) => dye.itemID).filter((id) => id !== null);

  // Combine with additional metallic dyes
  const allMetallicIds = [...new Set([...metallicIds, ...additionalMetallicIds])];

  return allMetallicIds.sort((a, b) => a - b);
}

function buildHarmonyTypes(locale: LocaleCode): Record<string, string> {
  // Hardcoded harmony type translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      complementary: 'Complementary',
      analogous: 'Analogous',
      triadic: 'Triadic',
      splitComplementary: 'Split-Complementary',
      tetradic: 'Tetradic',
      square: 'Square',
      monochromatic: 'Monochromatic',
      compound: 'Compound',
      shades: 'Shades',
    },
    ja: {
      complementary: '補色',
      analogous: '類似色',
      triadic: '三色配色',
      splitComplementary: '分裂補色',
      tetradic: '四色配色',
      square: '正方形配色',
      monochromatic: '単色',
      compound: '複合',
      shades: 'シェード',
    },
    de: {
      complementary: 'Komplementär',
      analogous: 'Analog',
      triadic: 'Triadisch',
      splitComplementary: 'Geteiltes Komplement',
      tetradic: 'Tetradisch',
      square: 'Quadrat',
      monochromatic: 'Monochromatisch',
      compound: 'Zusammengesetzt',
      shades: 'Schattierungen',
    },
    fr: {
      complementary: 'Complémentaire',
      analogous: 'Analogue',
      triadic: 'Triadique',
      splitComplementary: 'Complémentaire divisé',
      tetradic: 'Tétradique',
      square: 'Carré',
      monochromatic: 'Monochromatique',
      compound: 'Composé',
      shades: 'Nuances',
    },
    ko: {
      complementary: '보색',
      analogous: '유사색',
      triadic: '삼원색',
      splitComplementary: '분리보색',
      tetradic: '사색',
      square: '정사각형',
      monochromatic: '단색',
      compound: '복합',
      shades: '명암',
    },
    zh: {
      complementary: '互补色',
      analogous: '类似色',
      triadic: '三角配色',
      splitComplementary: '分裂互补',
      tetradic: '四色配色',
      square: '正方形配色',
      monochromatic: '单色',
      compound: '复合',
      shades: '明暗',
    },
  };

  return translations[locale];
}

function buildVisionTypes(locale: LocaleCode): Record<string, string> {
  // Hardcoded vision type translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      normal: 'Normal Vision',
      deuteranopia: 'Deuteranopia (Red-Green Colorblindness)',
      protanopia: 'Protanopia (Red-Green Colorblindness)',
      tritanopia: 'Tritanopia (Blue-Yellow Colorblindness)',
      achromatopsia: 'Achromatopsia (Total Colorblindness)',
    },
    ja: {
      normal: '正常視覚',
      deuteranopia: '2型色覚（赤緑色盲）',
      protanopia: '1型色覚（赤緑色盲）',
      tritanopia: '3型色覚（青黄色盲）',
      achromatopsia: '全色盲',
    },
    de: {
      normal: 'Normales Sehen',
      deuteranopia: 'Deuteranopie (Rot-Grün-Farbenblindheit)',
      protanopia: 'Protanopie (Rot-Grün-Farbenblindheit)',
      tritanopia: 'Tritanopie (Blau-Gelb-Farbenblindheit)',
      achromatopsia: 'Achromatopsie (Totale Farbenblindheit)',
    },
    fr: {
      normal: 'Vision normale',
      deuteranopia: 'Deutéranopie (Daltonisme rouge-vert)',
      protanopia: 'Protanopie (Daltonisme rouge-vert)',
      tritanopia: 'Tritanopie (Daltonisme bleu-jaune)',
      achromatopsia: 'Achromatopsie (Daltonisme total)',
    },
    ko: {
      normal: '정상 시력',
      deuteranopia: '제2색맹 (적록색맹)',
      protanopia: '제1색맹 (적록색맹)',
      tritanopia: '제3색맹 (청황색맹)',
      achromatopsia: '전색맹',
    },
    zh: {
      normal: '正常视觉',
      deuteranopia: '绿色盲（红绿色盲）',
      protanopia: '红色盲（红绿色盲）',
      tritanopia: '蓝色盲（蓝黄色盲）',
      achromatopsia: '全色盲',
    },
  };

  return translations[locale];
}

function buildVisionsShort(locale: LocaleCode): Record<string, string> {
  // Compact vision-name forms (no parenthetical explanation) — used by
  // og-worker for OG embed titles where the full visionTypes string is too
  // long. These mirror the medical-term root used in visionTypes.
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      normal: 'Normal Vision',
      protanopia: 'Protanopia',
      deuteranopia: 'Deuteranopia',
      tritanopia: 'Tritanopia',
      achromatopsia: 'Achromatopsia',
    },
    ja: {
      normal: '正常視覚',
      protanopia: '1型色覚',
      deuteranopia: '2型色覚',
      tritanopia: '3型色覚',
      achromatopsia: '全色盲',
    },
    de: {
      normal: 'Normales Sehen',
      protanopia: 'Protanopie',
      deuteranopia: 'Deuteranopie',
      tritanopia: 'Tritanopie',
      achromatopsia: 'Achromatopsie',
    },
    fr: {
      normal: 'Vision normale',
      protanopia: 'Protanopie',
      deuteranopia: 'Deutéranopie',
      tritanopia: 'Tritanopie',
      achromatopsia: 'Achromatopsie',
    },
    ko: {
      normal: '정상 시력',
      protanopia: '제1색맹',
      deuteranopia: '제2색맹',
      tritanopia: '제3색맹',
      achromatopsia: '전색맹',
    },
    zh: {
      normal: '正常视觉',
      protanopia: '红色盲',
      deuteranopia: '绿色盲',
      tritanopia: '蓝色盲',
      achromatopsia: '全色盲',
    },
  };

  return translations[locale];
}

function buildTools(locale: LocaleCode): Record<string, string> {
  // Display names for the six web-app tools. Used by og-worker for shareable
  // link previews and any UI that lists available tools.
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      harmony: 'Harmony Explorer',
      gradient: 'Gradient Builder',
      mixer: 'Dye Mixer',
      swatch: 'Swatch Matcher',
      comparison: 'Dye Comparison',
      accessibility: 'Accessibility Checker',
    },
    ja: {
      harmony: 'ハーモニーエクスプローラー',
      gradient: 'グラデーションビルダー',
      mixer: 'カララントミキサー',
      swatch: 'スウォッチマッチャー',
      comparison: 'カララント比較',
      accessibility: 'アクセシビリティチェッカー',
    },
    de: {
      harmony: 'Harmonie-Explorer',
      gradient: 'Verlaufs-Generator',
      mixer: 'Farbstoff-Mixer',
      swatch: 'Farbabgleich',
      comparison: 'Farbstoff-Vergleich',
      accessibility: 'Barrierefreiheits-Check',
    },
    fr: {
      harmony: "Explorateur d'harmonies",
      gradient: 'Créateur de dégradés',
      mixer: 'Mélangeur de teintures',
      swatch: 'Comparateur de nuances',
      comparison: 'Comparaison de teintures',
      accessibility: "Vérificateur d'accessibilité",
    },
    ko: {
      harmony: '하모니 익스플로러',
      gradient: '그라데이션 빌더',
      mixer: '염료 믹서',
      swatch: '스와치 매처',
      comparison: '염료 비교',
      accessibility: '접근성 검사기',
    },
    zh: {
      harmony: '配色探索器',
      gradient: '渐变生成器',
      mixer: '染剂调色器',
      swatch: '色板匹配器',
      comparison: '染剂对比',
      accessibility: '色彩辅助检测',
    },
  };

  return translations[locale];
}

function buildSheets(locale: LocaleCode): Record<string, string> {
  // Color-sheet category labels — FFXIV character-creator color groups
  // exposed by the Swatch Matcher tool. The "(Dark)" / "(Light)" suffixes
  // are the dye lightness bands.
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      eyeColors: 'Eye Colors',
      highlightColors: 'Highlights',
      lipColorsDark: 'Lip Colors (Dark)',
      lipColorsLight: 'Lip Colors (Light)',
      tattooColors: 'Tattoo/Limbal',
      facePaintColorsDark: 'Face Paint (Dark)',
      facePaintColorsLight: 'Face Paint (Light)',
      hairColors: 'Hair Colors',
      skinColors: 'Skin Colors',
    },
    ja: {
      eyeColors: '目の色',
      highlightColors: 'ハイライト',
      lipColorsDark: '唇の色（ダーク）',
      lipColorsLight: '唇の色（ライト）',
      tattooColors: 'タトゥー／角膜',
      facePaintColorsDark: 'フェイスペイント（ダーク）',
      facePaintColorsLight: 'フェイスペイント（ライト）',
      hairColors: '髪の色',
      skinColors: '肌の色',
    },
    de: {
      eyeColors: 'Augenfarben',
      highlightColors: 'Strähnchen',
      lipColorsDark: 'Lippenfarben (dunkel)',
      lipColorsLight: 'Lippenfarben (hell)',
      tattooColors: 'Tätowierung/Limbus',
      facePaintColorsDark: 'Gesichtsbemalung (dunkel)',
      facePaintColorsLight: 'Gesichtsbemalung (hell)',
      hairColors: 'Haarfarben',
      skinColors: 'Hautfarben',
    },
    fr: {
      eyeColors: 'Couleurs des yeux',
      highlightColors: 'Mèches',
      lipColorsDark: 'Couleurs des lèvres (foncées)',
      lipColorsLight: 'Couleurs des lèvres (claires)',
      tattooColors: 'Tatouage/Limbe',
      facePaintColorsDark: 'Peinture faciale (foncée)',
      facePaintColorsLight: 'Peinture faciale (claire)',
      hairColors: 'Couleurs des cheveux',
      skinColors: 'Couleurs de peau',
    },
    ko: {
      eyeColors: '눈동자 색',
      highlightColors: '하이라이트',
      lipColorsDark: '입술 색 (어두운)',
      lipColorsLight: '입술 색 (밝은)',
      tattooColors: '문신/홍채',
      facePaintColorsDark: '얼굴 페인트 (어두운)',
      facePaintColorsLight: '얼굴 페인트 (밝은)',
      hairColors: '머리 색',
      skinColors: '피부 색',
    },
    zh: {
      eyeColors: '眼睛颜色',
      highlightColors: '挑染',
      lipColorsDark: '唇色（深）',
      lipColorsLight: '唇色（浅）',
      tattooColors: '纹身/虹膜',
      facePaintColorsDark: '面部彩绘（深）',
      facePaintColorsLight: '面部彩绘（浅）',
      hairColors: '发色',
      skinColors: '肤色',
    },
  };

  return translations[locale];
}

function buildJobNames(locale: LocaleCode): Record<string, string> {
  // Hardcoded FFXIV job name translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      paladin: 'Paladin',
      warrior: 'Warrior',
      darkKnight: 'Dark Knight',
      gunbreaker: 'Gunbreaker',
      whiteMage: 'White Mage',
      scholar: 'Scholar',
      astrologian: 'Astrologian',
      sage: 'Sage',
      monk: 'Monk',
      dragoon: 'Dragoon',
      ninja: 'Ninja',
      samurai: 'Samurai',
      reaper: 'Reaper',
      viper: 'Viper',
      bard: 'Bard',
      machinist: 'Machinist',
      dancer: 'Dancer',
      blackMage: 'Black Mage',
      summoner: 'Summoner',
      redMage: 'Red Mage',
      pictomancer: 'Pictomancer',
      blueMage: 'Blue Mage',
    },
    ja: {
      paladin: 'ナイト',
      warrior: '戦士',
      darkKnight: '暗黒騎士',
      gunbreaker: 'ガンブレイカー',
      whiteMage: '白魔道士',
      scholar: '学者',
      astrologian: '占星術師',
      sage: '賢者',
      monk: 'モンク',
      dragoon: '竜騎士',
      ninja: '忍者',
      samurai: '侍',
      reaper: 'リーパー',
      viper: 'ヴァイパー',
      bard: '吟遊詩人',
      machinist: '機工士',
      dancer: '踊り子',
      blackMage: '黒魔道士',
      summoner: '召喚士',
      redMage: '赤魔道士',
      pictomancer: 'ピクトマンサー',
      blueMage: '青魔道士',
    },
    de: {
      paladin: 'Paladin',
      warrior: 'Krieger',
      darkKnight: 'Dunkelritter',
      gunbreaker: 'Revolverklinge',
      whiteMage: 'Weißmagier',
      scholar: 'Gelehrter',
      astrologian: 'Astrologe',
      sage: 'Weiser',
      monk: 'Mönch',
      dragoon: 'Dragoon',
      ninja: 'Ninja',
      samurai: 'Samurai',
      reaper: 'Schnitter',
      viper: 'Viper',
      bard: 'Barde',
      machinist: 'Maschinist',
      dancer: 'Tänzer',
      blackMage: 'Schwarzmagier',
      summoner: 'Beschwörer',
      redMage: 'Rotmagier',
      pictomancer: 'Piktomant',
      blueMage: 'Blaumagier',
    },
    fr: {
      paladin: 'Paladin',
      warrior: 'Guerrier',
      darkKnight: 'Chevalier noir',
      gunbreaker: 'Pistosabreur',
      whiteMage: 'Mage blanc',
      scholar: 'Érudit',
      astrologian: 'Astromancien',
      sage: 'Sage',
      monk: 'Moine',
      dragoon: 'Chevalier dragon',
      ninja: 'Ninja',
      samurai: 'Samouraï',
      reaper: 'Faucheur',
      viper: 'Rôdeur vipère',
      bard: 'Barde',
      machinist: 'Machiniste',
      dancer: 'Danseur',
      blackMage: 'Mage noir',
      summoner: 'Invocateur',
      redMage: 'Mage rouge',
      pictomancer: 'Pictomancien',
      blueMage: 'Mage bleu',
    },
    ko: {
      paladin: '나이트',
      warrior: '전사',
      darkKnight: '암흑기사',
      gunbreaker: '건브레이커',
      whiteMage: '백마도사',
      scholar: '학자',
      astrologian: '점성술사',
      sage: '현자',
      monk: '몽크',
      dragoon: '용기사',
      ninja: '닌자',
      samurai: '사무라이',
      reaper: '리퍼',
      viper: '바이퍼',
      bard: '음유시인',
      machinist: '기공사',
      dancer: '무도가',
      blackMage: '흑마도사',
      summoner: '소환사',
      redMage: '적마도사',
      pictomancer: '픽토맨서',
      blueMage: '청마도사',
    },
    zh: {
      paladin: '骑士',
      warrior: '战士',
      darkKnight: '暗黑骑士',
      gunbreaker: '绝枪战士',
      whiteMage: '白魔法师',
      scholar: '学者',
      astrologian: '占星术士',
      sage: '贤者',
      monk: '武僧',
      dragoon: '龙骑士',
      ninja: '忍者',
      samurai: '武士',
      reaper: '钐镰客',
      viper: '蝰蛇剑士',
      bard: '吟游诗人',
      machinist: '机工士',
      dancer: '舞者',
      blackMage: '黑魔法师',
      summoner: '召唤师',
      redMage: '赤魔法师',
      pictomancer: '绘灵法师',
      blueMage: '青魔法师',
    },
  };

  return translations[locale];
}

function buildGrandCompanyNames(locale: LocaleCode): Record<string, string> {
  // Hardcoded FFXIV Grand Company name translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      maelstrom: 'The Maelstrom',
      twinAdder: 'The Order of the Twin Adder',
      immortalFlames: 'The Immortal Flames',
    },
    ja: {
      maelstrom: '黒渦団',
      twinAdder: '双蛇党',
      immortalFlames: '不滅隊',
    },
    de: {
      maelstrom: 'Der Mahlstrom',
      twinAdder: 'Die Bruderschaft der Morgenviper',
      immortalFlames: 'Die Legion der Unsterblichen',
    },
    fr: {
      maelstrom: 'Le Maelstrom',
      twinAdder: "L'ordre des Deux Vipères",
      immortalFlames: 'Les Immortels',
    },
    ko: {
      maelstrom: '흑와단',
      twinAdder: '쌍사당',
      immortalFlames: '불멸대',
    },
    zh: {
      maelstrom: '黑涡团',
      twinAdder: '双蛇党',
      immortalFlames: '恒辉队',
    },
  };

  return translations[locale];
}

function buildRaces(locale: LocaleCode): Record<string, string> {
  // Hardcoded FFXIV playable race name translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      hyur: 'Hyur',
      elezen: 'Elezen',
      lalafell: 'Lalafell',
      miqote: "Miqo'te",
      roegadyn: 'Roegadyn',
      auRa: 'Au Ra',
      hrothgar: 'Hrothgar',
      viera: 'Viera',
    },
    ja: {
      hyur: 'ヒューラン',
      elezen: 'エレゼン',
      lalafell: 'ララフェル',
      miqote: 'ミコッテ',
      roegadyn: 'ルガディン',
      auRa: 'アウラ',
      hrothgar: 'ロスガル',
      viera: 'ヴィエラ',
    },
    de: {
      hyur: 'Hyuran',
      elezen: 'Elezen',
      lalafell: 'Lalafell',
      miqote: "Miqo'te",
      roegadyn: 'Roegadyn',
      auRa: 'Au Ra',
      hrothgar: 'Hrothgar',
      viera: 'Viera',
    },
    fr: {
      hyur: 'Hyuran',
      elezen: 'Élézéen',
      lalafell: 'Lalafell',
      miqote: "Miqo'te",
      roegadyn: 'Roegadyn',
      auRa: 'Ao Ra',
      hrothgar: 'Hrothgar',
      viera: 'Viéra',
    },
    ko: {
      hyur: '휴란',
      elezen: '엘레젠',
      lalafell: '라라펠',
      miqote: '미코테',
      roegadyn: '루가딘',
      auRa: '아우라',
      hrothgar: '로스갈',
      viera: '비에라',
    },
    zh: {
      hyur: '人族',
      elezen: '精灵族',
      lalafell: '拉拉菲尔族',
      miqote: '猫魅族',
      roegadyn: '鲁加族',
      auRa: '敖龙族',
      hrothgar: '硌狮族',
      viera: '维埃拉族',
    },
  };

  return translations[locale];
}

function buildClans(locale: LocaleCode): Record<string, string> {
  // Hardcoded FFXIV clan (subrace) name translations
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      midlander: 'Midlander',
      highlander: 'Highlander',
      wildwood: 'Wildwood',
      duskwight: 'Duskwight',
      plainsfolk: 'Plainsfolk',
      dunesfolk: 'Dunesfolk',
      seekerOfTheSun: 'Seeker of the Sun',
      keeperOfTheMoon: 'Keeper of the Moon',
      seaWolf: 'Sea Wolf',
      hellsguard: 'Hellsguard',
      raen: 'Raen',
      xaela: 'Xaela',
      helion: 'Helion',
      theLost: 'The Lost',
      rava: 'Rava',
      veena: 'Veena',
    },
    ja: {
      midlander: 'ミッドランダー',
      highlander: 'ハイランダー',
      wildwood: 'フォレスター',
      duskwight: 'シェーダー',
      plainsfolk: 'プレーンフォーク',
      dunesfolk: 'デューンフォーク',
      seekerOfTheSun: 'サンシーカー',
      keeperOfTheMoon: 'ムーンキーパー',
      seaWolf: 'ゼーヴォルフ',
      hellsguard: 'ローエンガルデ',
      raen: 'アウラ・レン',
      xaela: 'アウラ・ゼラ',
      helion: 'ヘリオン',
      theLost: 'ロスト',
      rava: 'ラヴァ・ヴィエラ',
      veena: 'ヴィナ・ヴィエラ',
    },
    de: {
      midlander: 'Wiesländer',
      highlander: 'Hochländer',
      wildwood: 'Erlschatten',
      duskwight: 'Dunkelalb',
      plainsfolk: 'Halmling',
      dunesfolk: 'Sandling',
      seekerOfTheSun: 'Goldtatze',
      keeperOfTheMoon: 'Mondstreuner',
      seaWolf: 'Seewolf',
      hellsguard: 'Lohengarde',
      raen: 'Auri-Raen',
      xaela: 'Auri-Xaela',
      helion: 'Helion',
      theLost: 'Losgesagter',
      rava: 'Rava-Viera',
      veena: 'Veena-Viera',
    },
    fr: {
      midlander: 'Hyurois',
      highlander: 'Hyurgoth',
      wildwood: 'Sylvestre',
      duskwight: 'Crépusculaire',
      plainsfolk: 'Peuple des Plaines',
      dunesfolk: 'Peuple des Dunes',
      seekerOfTheSun: 'Tribu du Soleil',
      keeperOfTheMoon: 'Tribu de la Lune',
      seaWolf: 'Clan de la Mer',
      hellsguard: 'Clan du Feu',
      raen: 'Raen',
      xaela: 'Xaela',
      helion: 'Hélion',
      theLost: 'Égaré',
      rava: 'Rava',
      veena: 'Veena',
    },
    ko: {
      midlander: '미드랜더',
      highlander: '하이랜더',
      wildwood: '숲의 민',
      duskwight: '황혼의 민',
      plainsfolk: '평원의 민',
      dunesfolk: '사막의 민',
      seekerOfTheSun: '태양의 추종자',
      keeperOfTheMoon: '달의 수호자',
      seaWolf: '바다늑대',
      hellsguard: '불꽃 파수꾼',
      raen: '렌',
      xaela: '젤라',
      helion: '헬리온',
      theLost: '로스트',
      rava: '라바',
      veena: '비나',
    },
    zh: {
      midlander: '中原之民',
      highlander: '高地之民',
      wildwood: '森林之民',
      duskwight: '黑影之民',
      plainsfolk: '平原之民',
      dunesfolk: '沙漠之民',
      seekerOfTheSun: '逐日之民',
      keeperOfTheMoon: '护月之民',
      seaWolf: '北洋之民',
      hellsguard: '红焰之民',
      raen: '晨曦之民',
      xaela: '暮晖之民',
      helion: '日光之民',
      theLost: '迷失之民',
      rava: '拉瓦族',
      veena: '维纳族',
    },
  };

  return translations[locale];
}

main().catch((error) => {
  console.error('❌ Error building locales:', error);
  process.exit(1);
});
