/**
 * The locale generator's gates (2026-10-04 audits: deep-dive BUG-128 / BUG-130,
 * i18n TERM-021).
 *
 * `build-locales.ts` reads every source from `process.cwd()`, so the fixture
 * cases run the real script in a throwaway directory as a subprocess. That
 * exercises the actual exit code and what reaches disk. No exported function is
 * involved, so nothing here can drift from what `pnpm run build:locales` does.
 *
 * The real-data cases read the committed sources and the committed generated
 * JSON. They live beside the script rather than under `src/__tests__/` because
 * core's `tsconfig.json` sets `rootDir: ./src`, the same reason as
 * `lib/oklch-hue-table.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(here, '..');
const script = path.join(here, 'build-locales.ts');
// Absolute, so the subprocess never resolves tsx from the temp directory.
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');

const LOCALES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;
type Locale = (typeof LOCALES)[number];

const SUBPROCESS_TIMEOUT = 60_000;

interface DyeEntry {
  stainID: number;
  name: string;
  hex: string;
  category: string;
  acquisition: string;
  consolidationType: string | null;
  legacyItemID: number | null;
}

interface LocaleJson {
  meta: { version: string; generated: string; dyeCount: number };
  dyeNames: Record<string, string>;
  sheets: Record<string, string>;
  [section: string]: unknown;
}

const CSV_HEADER = 'itemID,English Name,Japanese Name,German Name,French Name,Korean Name,Chinese Name';

function dye(stainID: number, name: string, legacyItemID: number | null): DyeEntry {
  return {
    stainID,
    name,
    hex: '#e4dfd0',
    category: 'Neutral',
    acquisition: 'Dye Vendor',
    consolidationType: 'A',
    legacyItemID,
  };
}

/** One full CSV row; `overrides` blanks or replaces individual cells. */
function csvRow(itemID: string | number, english: string, overrides: Partial<Record<Locale, string>> = {}): string {
  const cell = (l: Locale, fallback: string): string => overrides[l] ?? fallback;
  return [
    String(itemID),
    cell('en', `${english} `), // the real CSV carries trailing spaces; the parser trims
    cell('ja', `${english}-ja`),
    cell('de', `${english}-de`),
    cell('fr', `${english}-fr`),
    cell('ko', `${english}-ko`),
    cell('zh', `${english}-zh`),
  ].join(',');
}

interface Fixture {
  dyes: DyeEntry[];
  csv: string[];
  /** `facewear-names.csv` data rows; the committed file when omitted. */
  facewearCsv?: string[];
}

const FACEWEAR_CSV_HEADER = 'id,English Name,Japanese Name,German Name,French Name,Korean Name,Chinese Name';

/**
 * The committed `facewear-names.csv` data rows, which agree with the committed
 * `facewear_colors.json` that every fixture copies.
 */
const FACEWEAR_ROWS: string[] = fs
  .readFileSync(path.join(pkgDir, 'facewear-names.csv'), 'utf-8')
  .split(/\r?\n/)
  .slice(1)
  .filter((line) => line.trim() !== '');

/** The committed row for `slug`, with its first cell or English cell replaced. */
function facewearRow(slug: string, change: { id?: string; english?: string } = {}): string {
  const row = FACEWEAR_ROWS.find((line) => line.startsWith(`${slug},`));
  if (!row) throw new Error(`facewear-names.csv has no ${slug} row`);
  const cells = row.split(',');
  if (change.id !== undefined) cells[0] = change.id;
  if (change.english !== undefined) cells[1] = change.english;
  return cells.join(',');
}

const GOOD: Fixture = {
  dyes: [dye(1, 'Snow White', 5729), dye(24, 'Opo-opo Brown', 5752)],
  csv: [csvRow(5729, 'Snow White'), csvRow(5752, 'Opo-opo Brown')],
};

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-locales-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeFixture({ dyes, csv, facewearCsv = FACEWEAR_ROWS }: Fixture): void {
  fs.copyFileSync(path.join(pkgDir, 'localize.yaml'), path.join(dir, 'localize.yaml'));
  fs.writeFileSync(
    path.join(dir, 'facewear-names.csv'),
    [FACEWEAR_CSV_HEADER, ...facewearCsv].join('\n') + '\n',
    'utf-8',
  );
  fs.writeFileSync(path.join(dir, 'dyenames.csv'), [CSV_HEADER, ...csv].join('\n') + '\n', 'utf-8');
  fs.mkdirSync(path.join(dir, 'src', 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'data', 'dyes.json'), JSON.stringify(dyes, null, 2), 'utf-8');
  fs.copyFileSync(
    path.join(pkgDir, 'src', 'data', 'facewear_colors.json'),
    path.join(dir, 'src', 'data', 'facewear_colors.json'),
  );
}

function run(cwd: string, ...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [tsxCli, script, ...args], { cwd, encoding: 'utf-8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const localesDir = (root: string): string => path.join(root, 'src', 'data', 'locales');

function writtenLocales(root: string): string[] {
  const out = localesDir(root);
  return fs.existsSync(out) ? fs.readdirSync(out).sort() : [];
}

function readLocale(root: string, locale: Locale): LocaleJson {
  return JSON.parse(fs.readFileSync(path.join(localesDir(root), `${locale}.json`), 'utf-8')) as LocaleJson;
}

describe('build-locales: writes nothing unless every source checks out (BUG-128)', () => {
  it(
    'writes all six locales from consistent sources',
    () => {
      writeFixture(GOOD);
      const r = run(dir);
      expect(r.status, r.stderr).toBe(0);
      expect(writtenLocales(dir)).toEqual(LOCALES.map((l) => `${l}.json`).sort());
      expect(readLocale(dir, 'ko').dyeNames).toEqual({ '5729': 'Snow White-ko', '5752': 'Opo-opo Brown-ko' });
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    'an empty translation cell exits 1 before any locale reaches disk',
    () => {
      writeFixture({ ...GOOD, csv: [csvRow(5729, 'Snow White', { zh: '' }), GOOD.csv[1]!] });
      const r = run(dir);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('dye 5729 (zh)');
      // en..ko are built before zh: none of them may be written either.
      expect(writtenLocales(dir)).toEqual([]);
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    'a failed build leaves the existing locale files byte-for-byte untouched',
    () => {
      // A real, well-formed previous build...
      writeFixture(GOOD);
      expect(run(dir).status).toBe(0);
      // ...made stale, so a build that reached the write step WOULD rewrite it.
      const enPath = path.join(localesDir(dir), 'en.json');
      const previous = readLocale(dir, 'en');
      previous.dyeNames['5729'] = 'Stale White';
      const stale = JSON.stringify(previous, null, 2);
      fs.writeFileSync(enPath, stale, 'utf-8');
      const before = Object.fromEntries(
        LOCALES.map((l) => [l, fs.readFileSync(path.join(localesDir(dir), `${l}.json`), 'utf-8')]),
      );

      // en sorts first, ja's cell is the empty one.
      writeFixture({ ...GOOD, csv: [csvRow(5729, 'Snow White', { ja: '' }), GOOD.csv[1]!] });
      const r = run(dir);
      expect(r.status).toBe(1);
      for (const l of LOCALES) {
        expect(fs.readFileSync(path.join(localesDir(dir), `${l}.json`), 'utf-8'), l).toBe(before[l]);
      }
      expect(fs.readFileSync(enPath, 'utf-8')).toBe(stale);
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    'regenerates a locale file that parses but is not a locale, instead of crashing',
    () => {
      writeFixture(GOOD);
      fs.mkdirSync(localesDir(dir), { recursive: true });
      fs.writeFileSync(path.join(localesDir(dir), 'en.json'), '{"stale": true}\n', 'utf-8');
      const r = run(dir);
      expect(r.status, r.stderr).toBe(0);
      expect(readLocale(dir, 'en').dyeNames['5729']).toBe('Snow White');
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    '--allow-missing still builds, with the English fallback in the empty cell',
    () => {
      writeFixture({ ...GOOD, csv: [csvRow(5729, 'Snow White', { zh: '' }), GOOD.csv[1]!] });
      const r = run(dir, '--allow-missing');
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).toContain('dye 5729 (zh)');
      expect(readLocale(dir, 'zh').dyeNames['5729']).toBe('Snow White');
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    'a dye in dyes.json with no dyenames.csv row exits 1 and writes nothing',
    () => {
      writeFixture({ ...GOOD, dyes: [...GOOD.dyes, dye(126, 'New Dye', 99999)] });
      const r = run(dir, '--allow-missing');
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('99999');
      expect(writtenLocales(dir)).toEqual([]);
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    'a dyenames.csv row with no dye in dyes.json exits 1 and writes nothing',
    () => {
      writeFixture({ ...GOOD, csv: [...GOOD.csv, csvRow(88888, 'Orphan')] });
      const r = run(dir, '--allow-missing');
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('88888');
      expect(writtenLocales(dir)).toEqual([]);
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    'a duplicated dyenames.csv itemID exits 1 instead of letting the later row win',
    () => {
      writeFixture({ ...GOOD, csv: [...GOOD.csv, csvRow(5729, 'Snow White')] });
      const r = run(dir, '--allow-missing');
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('5729');
      expect(writtenLocales(dir)).toEqual([]);
    },
    SUBPROCESS_TIMEOUT,
  );

  it(
    'keys a dye with no legacyItemID by its stainID, as DyeDatabase does',
    () => {
      writeFixture({
        dyes: [...GOOD.dyes, dye(130, 'Future Dye', null)],
        csv: [...GOOD.csv, csvRow(130, 'Future Dye')],
      });
      const r = run(dir);
      expect(r.status, r.stderr).toBe(0);
      expect(readLocale(dir, 'en').dyeNames['130']).toBe('Future Dye');
    },
    SUBPROCESS_TIMEOUT,
  );

  // A dye with no legacyItemID falls back to its stainID, which can equal
  // another dye's legacyItemID: both would then resolve to one CSV row and one
  // locale name. With the same English name ('A'), the name check cannot catch
  // it, so only the shared-key check stands between this and an exit 0.
  for (const secondName of ['A', 'B']) {
    it(
      `two dyes keyed to one itemID through the stainID fallback exit 1 and write nothing (second dye "${secondName}")`,
      () => {
        writeFixture({ dyes: [dye(1, 'A', 5729), dye(5729, secondName, null)], csv: [csvRow(5729, 'A')] });
        const r = run(dir, '--allow-missing');
        expect(r.status).toBe(1);
        expect(r.stderr).toContain(`stainID 5729 "${secondName}" (itemID 5729) shares its itemID`);
        expect(writtenLocales(dir)).toEqual([]);
      },
      SUBPROCESS_TIMEOUT,
    );
  }
});

describe("build-locales: dyes.json's English name must match dyenames.csv (BUG-130)", () => {
  it(
    'a case-only disagreement exits 1, even with --allow-missing, and writes nothing',
    () => {
      writeFixture({ ...GOOD, dyes: [GOOD.dyes[0]!, dye(24, 'Opo-Opo Brown', 5752)] });
      const r = run(dir, '--allow-missing');
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Opo-Opo Brown');
      expect(r.stderr).toContain('Opo-opo Brown');
      expect(writtenLocales(dir)).toEqual([]);
    },
    SUBPROCESS_TIMEOUT,
  );
});

describe('build-locales: facewear-names.csv must match facewear_colors.json', () => {
  // Each case runs with --allow-missing: these are integrity errors, which
  // that flag never waives.
  const cases: { name: string; facewearCsv: string[]; stderr: string[] }[] = [
    {
      name: 'a duplicated slug exits 1 instead of letting the later row win',
      facewearCsv: [...FACEWEAR_ROWS, facewearRow('brass')],
      stderr: ['brass', 'more than one row'],
    },
    {
      name: 'an English cell that differs from FacewearColor.name exits 1, case included',
      facewearCsv: FACEWEAR_ROWS.map((row) =>
        row.startsWith('grey,') ? facewearRow('grey', { english: 'GREY' }) : row,
      ),
      stderr: ['"Grey"', '"GREY"'],
    },
    {
      name: 'a row with an empty slug exits 1',
      facewearCsv: [...FACEWEAR_ROWS, facewearRow('brass', { id: '' })],
      stderr: ['has no id'],
    },
    {
      name: 'a slug with no FacewearColor exits 1',
      facewearCsv: [...FACEWEAR_ROWS, facewearRow('brass', { id: 'copper' })],
      stderr: ['copper', 'matches no FacewearColor'],
    },
    {
      name: 'a FacewearColor with no row exits 1',
      facewearCsv: FACEWEAR_ROWS.filter((row) => !row.startsWith('purple,')),
      stderr: ['purple', 'has no facewear-names.csv row'],
    },
  ];

  for (const c of cases) {
    it(
      `${c.name}, writing nothing`,
      () => {
        writeFixture({ ...GOOD, facewearCsv: c.facewearCsv });
        const r = run(dir, '--allow-missing');
        expect(r.status).toBe(1);
        for (const text of c.stderr) expect(r.stderr).toContain(text);
        expect(writtenLocales(dir)).toEqual([]);
      },
      SUBPROCESS_TIMEOUT,
    );
  }
});

// ---------------------------------------------------------------------------
// The committed data
// ---------------------------------------------------------------------------

const realDyes = JSON.parse(fs.readFileSync(path.join(pkgDir, 'src', 'data', 'dyes.json'), 'utf-8')) as DyeEntry[];

function committedLocale(locale: Locale): LocaleJson {
  return JSON.parse(
    fs.readFileSync(path.join(pkgDir, 'src', 'data', 'locales', `${locale}.json`), 'utf-8'),
  ) as LocaleJson;
}

describe('the committed dye data agrees with the committed locales', () => {
  it('dyes.json and en.json give every dye the same English name (BUG-130)', () => {
    const en = committedLocale('en');
    const disagree = realDyes
      .map((d) => ({ d, key: String(d.legacyItemID ?? d.stainID) }))
      .filter(({ d, key }) => en.dyeNames[key] !== d.name)
      .map(({ d, key }) => `stainID ${d.stainID} (${key}): dyes.json "${d.name}" vs en.json "${en.dyeNames[key]}"`);
    expect(disagree).toEqual([]);
  });

  for (const locale of LOCALES) {
    it(`${locale}.json names exactly the ${realDyes.length} dyes in dyes.json (BUG-128)`, () => {
      const keys = realDyes.map((d) => String(d.legacyItemID ?? d.stainID)).sort();
      const data = committedLocale(locale);
      expect(Object.keys(data.dyeNames).sort()).toEqual(keys);
      expect(data.meta.dyeCount).toBe(realDyes.length);
      for (const key of keys) expect(data.dyeNames[key], `${locale}/${key}`).toBeTruthy();
    });
  }

  it(
    'regenerating from the committed sources reproduces the committed JSON',
    () => {
      fs.copyFileSync(path.join(pkgDir, 'localize.yaml'), path.join(dir, 'localize.yaml'));
      fs.copyFileSync(path.join(pkgDir, 'facewear-names.csv'), path.join(dir, 'facewear-names.csv'));
      fs.copyFileSync(path.join(pkgDir, 'dyenames.csv'), path.join(dir, 'dyenames.csv'));
      fs.mkdirSync(path.join(dir, 'src', 'data'), { recursive: true });
      for (const file of ['dyes.json', 'facewear_colors.json']) {
        fs.copyFileSync(path.join(pkgDir, 'src', 'data', file), path.join(dir, 'src', 'data', file));
      }
      const r = run(dir);
      expect(r.status, r.stderr).toBe(0);
      const strip = ({ meta, ...rest }: LocaleJson) => ({ ...rest, meta: { ...meta, generated: '' } });
      for (const locale of LOCALES) {
        expect(strip(readLocale(dir, locale)), locale).toEqual(strip(committedLocale(locale)));
      }
    },
    SUBPROCESS_TIMEOUT,
  );
});

/**
 * TERM-021: the character-creation sheet names are the game client's, per
 * docs/reference/ffxiv-terminology.md § Character-Creation Color Sheets (the
 * `Lobby` rows its palette table names). English is the house wording and is
 * pinned unchanged; og-worker's descriptions quote it.
 */
const EXPECTED_SHEETS: Record<Locale, Record<string, string>> = {
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
    eyeColors: '瞳の色',
    highlightColors: 'メッシュの色',
    lipColorsDark: '唇の色（濃い）',
    lipColorsLight: '唇の色（薄い）',
    // ' / ' as in every other locale, web-app swatch.palTattoo and bot-logic
    // card.swatchSlotName.limbal: never the fullwidth ／.
    tattooColors: '刺青 / 瞳の輪郭',
    facePaintColorsDark: 'フェイスペイント（濃い）',
    facePaintColorsLight: 'フェイスペイント（薄い）',
    hairColors: '髪の色',
    skinColors: '肌の色',
  },
  de: {
    eyeColors: 'Augenfarben',
    highlightColors: 'Strähnen',
    lipColorsDark: 'Lippenfarben (Dunkel)',
    lipColorsLight: 'Lippenfarben (Hell)',
    tattooColors: 'Tattoo / Äußere Iris',
    facePaintColorsDark: 'Farbe des Merkmals (Dunkel)',
    facePaintColorsLight: 'Farbe des Merkmals (Hell)',
    hairColors: 'Haarfarben',
    skinColors: 'Hautfarben',
  },
  fr: {
    eyeColors: 'Couleurs des yeux',
    highlightColors: 'Reflets',
    lipColorsDark: 'Couleurs des lèvres (Opaque)',
    lipColorsLight: 'Couleurs des lèvres (Translucide)',
    tattooColors: "Tatouage / Contour de l'iris",
    facePaintColorsDark: 'Maquillage (Opaque)',
    facePaintColorsLight: 'Maquillage (Translucide)',
    hairColors: 'Couleurs des cheveux',
    skinColors: 'Couleurs de peau',
  },
  ko: {
    eyeColors: '눈동자 색',
    highlightColors: '부분염색 색상',
    lipColorsDark: '입술 색 (짙게)',
    lipColorsLight: '입술 색 (옅게)',
    tattooColors: '문신 / 눈동자 테두리',
    facePaintColorsDark: '얼굴 치장 (짙게)',
    facePaintColorsLight: '얼굴 치장 (옅게)',
    hairColors: '머리 색',
    skinColors: '피부색',
  },
  zh: {
    eyeColors: '瞳色',
    highlightColors: '挑染',
    lipColorsDark: '唇色（浓艳）',
    lipColorsLight: '唇色（清淡）',
    tattooColors: '刺青 / 瞳孔轮廓',
    facePaintColorsDark: '面妆（浓艳）',
    facePaintColorsLight: '面妆（清淡）',
    hairColors: '发色',
    skinColors: '肤色',
  },
};

/** The glossary's "not the client's word" lists, per locale. */
const NOT_THE_CLIENTS_WORD: Partial<Record<Locale, RegExp>> = {
  ja: /角膜|タトゥー|ハイライト|目の色|ダーク|ライト|リンバル|リムバル/,
  de: /Limbus|Limbal|Tätowierung|Strähnchen|Gesichtsbemalung|Schminke/,
  fr: /Limbe|limbal|Peinture faciale|[Ff]onc|[Cc]lair/,
  ko: /홍채|림발|림벌|하이라이트|브릿지|페인트|어두운|밝은/,
  zh: /虹膜|纹身|角膜环|轮环|面部彩绘|彩绘|眼睛颜色|（深）|（浅）/,
};

describe('character-creation sheet names are the game client wording (TERM-021)', () => {
  for (const locale of LOCALES) {
    it(`${locale}.json sheets match docs/reference/ffxiv-terminology.md`, () => {
      expect(committedLocale(locale).sheets).toEqual(EXPECTED_SHEETS[locale]);
    });

    const banned = NOT_THE_CLIENTS_WORD[locale];
    if (banned) {
      it(`${locale}.json sheets use none of the words the glossary rules out`, () => {
        const hits = Object.entries(committedLocale(locale).sheets).filter(([, v]) => banned.test(v));
        expect(hits).toEqual([]);
      });
    }
  }
});
