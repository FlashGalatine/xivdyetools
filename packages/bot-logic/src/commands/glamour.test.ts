/**
 * /glamour — the Glamour Reader in the bot (design 2a + its embed).
 *
 * The stress file from the design: a Midlander woman whose file names three
 * items she can't wear as saved (each fixed by a twin), one free choice, one
 * piece nothing fixes, an undyed pair of boots, and a quiver that is the
 * bow's own off-hand model.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CHARA_WEAR_RACE_COLUMNS,
  formatCharaModelLabel,
  resolveCharaColors,
  type CharaGearModel,
} from '@xivdyetools/core';
import { AppError } from '@xivdyetools/types';
import { executeGlamour, type GlamourInput, type GlamourResolveAnswer } from './glamour.js';
import { createTranslator } from '../i18n/index.js';
import { dyeService } from '../input-resolution.js';

// A passthrough — every test reads with the real resolver unless one asks it
// to throw once, so the bot side of the read can fail (as in swatch.test.ts).
vi.mock('@xivdyetools/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/core')>();
  return { ...actual, resolveCharaColors: vi.fn(actual.resolveCharaColors) };
});

/** Stain IDs: Snow White 1, Wine Red 12, Dalamud Red 10, Coral Pink 13, Jet Black 102, Metallic Gold 113. */
const STRESS = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  Nickname: 'Real Name',
  Race: 'Hyur',
  Tribe: 'Midlander',
  Gender: 'Feminine',
  REyeColor: 42,
  MainHand: { ModelSet: 201, ModelBase: 20, ModelVariant: 1, DyeId: 113, DyeId2: 0 },
  OffHand: { ModelSet: 201, ModelBase: 60, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
  Body: { ModelBase: 812, ModelVariant: 2, DyeId: 12, DyeId2: 10 },
  Hands: { ModelBase: 640, ModelVariant: 1, DyeId: 102, DyeId2: 13 },
  Legs: { ModelBase: 777, ModelVariant: 1, DyeId: 102, DyeId2: 0 },
  Feet: { ModelBase: 99, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
});

const names = (en: string, ja = en) => ({ en, ja, de: en, fr: en });
const rules = (itemIds: number[], over: Partial<{ dyeCount: number; glamourable: boolean; wearMask: number; grandCompany: number }> = {}) => ({
  itemIds,
  dyeCount: 1,
  glamourable: true,
  wearMask: 0xffff,
  grandCompany: 0,
  ...over,
});
const MALE_ONLY = 0x5555;
const FEMALE_ONLY = 0xaaaa;
const VIERA_ONLY = 0xc000;

const ANSWER: GlamourResolveAnswer = {
  items: {
    MainHand: {
      itemId: 7863,
      names: names('Curtana Zenith'),
      alternates: [{ itemId: 25000, names: names('Curtana Zenith Replica'), acquisition: 'Zodiac Weapons Saga' }],
      rules: [rules([7863], { glamourable: false }), rules([25000])],
      acquisition: 'Zodiac Weapons Saga',
    },
    OffHand: { itemId: 7863, names: names('Curtana Zenith'), alternates: [], viaMainHand: true, rules: [] },
    HeadGear: {
      itemId: 372,
      names: names('Dated Hempen Coif', 'ヘンプコイフ(旧)'),
      alternates: [
        { itemId: 2629, names: names('Hempen Coif', 'ヘンプコイフ'), acquisition: 'Crafted (WVR Lvl. 1)' },
        { itemId: 2630, names: names('Hempen Coif', 'ヘンプコイフ') },
      ],
      rules: [rules([372], { dyeCount: 0 }), rules([2629, 2630])],
    },
    Body: {
      itemId: 8001,
      names: names('Lord’s Yukata'),
      alternates: [{ itemId: 8002, names: names('Lady’s Yukata') }],
      rules: [rules([8001], { dyeCount: 2, wearMask: MALE_ONLY }), rules([8002], { dyeCount: 2, wearMask: FEMALE_ONLY })],
    },
    Hands: {
      itemId: 9001,
      names: names('Augmented Deepshadow Gloves of Striking'),
      alternates: [{ itemId: 9002, names: names('Deepshadow Gloves of Striking') }],
      rules: [rules([9001, 9002], { dyeCount: 2 })],
    },
    Legs: {
      itemId: 9500,
      names: names('Viera Gaskins'),
      alternates: [],
      rules: [rules([9500], { wearMask: VIERA_ONLY })],
    },
    Feet: { itemId: 3000, names: names('Hempen Boots'), alternates: [], rules: [rules([3000])] },
  },
};

const input = (over: Partial<GlamourInput> = {}): GlamourInput => ({
  fileText: STRESS,
  locale: 'en',
  resolve: vi.fn(async () => ANSWER),
  ...over,
});

/** Text content of every <text> run, in document order. */
const svgTexts = (svg: string): string[] => [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe('executeGlamour', () => {
  it('asks the resolver for every worn piece, weapons with their set', async () => {
    const i = input();
    await executeGlamour(i);
    const gear = (i.resolve as ReturnType<typeof vi.fn>).mock.calls[0][0] as CharaGearModel[];
    expect(gear.map((g) => g.slot)).toEqual(['MainHand', 'OffHand', 'HeadGear', 'Body', 'Hands', 'Legs', 'Feet']);
    expect(gear[0]).toEqual({ slot: 'MainHand', set: 201, base: 20, variant: 1 });
  });

  it('draws the dyed pieces in slot order, each named as the twin it can be worn as', async () => {
    const result = await executeGlamour(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = svgTexts(result.svgString);

    expect(t.filter((s) => ['MAIN HAND', 'HEAD', 'BODY', 'HANDS', 'LEGS'].includes(s))).toEqual([
      'MAIN HAND',
      'HEAD',
      'BODY',
      'HANDS',
      'LEGS',
    ]);
    // The boots take no dye and the quiver is the bow: neither is a row
    expect(t).not.toContain('FEET');
    expect(t).not.toContain('OFF HAND');
    expect(t).toContain('Curtana Zenith Replica');
    expect(t).toContain('Hempen Coif');
    expect(t).toContain('Lady’s Yukata');
    expect(t).not.toContain('Dated Hempen Coif');
    expect(t).not.toContain('Lord’s Yukata');
  });

  it('marks three twins, one free choice, and a Viera-only piece nothing fixes', async () => {
    const result = await executeGlamour(input());
    if (!result.ok) throw new Error(result.errorMessage);
    const t = svgTexts(result.svgString);

    expect(t.filter((s) => s === 'TWIN')).toHaveLength(3);
    expect(t).toContain('OK');
    expect(t).toContain('VIERA');
    expect(t).toContain('+2 LOOKS');
    expect(t).toContain('ONE LOOK');
  });

  it('heads the card with the counts and the file by producer and tribe', async () => {
    const result = await executeGlamour(input());
    if (!result.ok) throw new Error(result.errorMessage);
    const t = svgTexts(result.svgString);

    expect(t).toContain('5 dyed pieces · 6 dyes');
    expect(t).toContain('MIDLANDER ♀ · ANAMNESIS');
    expect(t.join(' ')).toContain('5 of 5 dyed pieces · 3 named from a twin · 1 with no fix');
  });

  it("names the clan in the reader's language, as the game does (HC-001)", async () => {
    const de = await executeGlamour(input({ locale: 'de' }));
    if (!de.ok) throw new Error(de.errorMessage);
    expect(svgTexts(de.svgString)).toContain('WIESLÄNDER ♀ · ANAMNESIS');
    expect(de.svgString).not.toContain('MIDLANDER');

    // The header fits a pixel budget. A long localized clan pushes the producer
    // into the ellipsis, never the gender symbol (the card's only one).
    const ja = await executeGlamour(input({ locale: 'ja' }));
    if (!ja.ok) throw new Error(ja.errorMessage);
    expect(svgTexts(ja.svgString).find((s) => s.startsWith('ミッドランダー'))).toMatch(/^ミッドランダー ♀/);
  });

  it('counts one other look in the singular (I18N-016)', async () => {
    const one: GlamourResolveAnswer = {
      items: { ...ANSWER.items, HeadGear: { ...ANSWER.items.HeadGear!, familySize: 2 } },
    };
    const result = await executeGlamour(input({ resolve: async () => one }));
    if (!result.ok) throw new Error(result.errorMessage);
    const t = svgTexts(result.svgString);

    expect(t).toContain('+1 LOOK');
    expect(t).not.toContain('+1 LOOKS');
  });

  it('never prints the character name', async () => {
    const result = await executeGlamour(input());
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.svgString).not.toContain('Real Name');
    expect(JSON.stringify(result.embed)).not.toContain('Real Name');
  });

  it('keeps five rows and counts the rest in the footer', async () => {
    const seven = JSON.stringify({
      ...(JSON.parse(STRESS) as Record<string, unknown>),
      Feet: { ModelBase: 99, ModelVariant: 1, DyeId: 1, DyeId2: 0 },
      Ears: { ModelBase: 5, ModelVariant: 1 },
      Wrists: { ModelBase: 7, ModelVariant: 1 },
    });
    const result = await executeGlamour(input({ fileText: seven }));
    if (!result.ok) throw new Error(result.errorMessage);
    const t = svgTexts(result.svgString);

    expect(t).not.toContain('FEET');
    expect(t.join(' ')).toContain('5 of 6 dyed pieces');
  });

  it('writes every piece in the GPOSERS form in the embed', async () => {
    const result = await executeGlamour(input());
    if (!result.ok) throw new Error(result.errorMessage);
    const d = result.embed.description ?? '';

    expect(result.embed.title).toBe('Glamour · 5 dyed pieces');
    expect(d).toContain('**Glamour Items:**');
    expect(d).toContain('**Main Hand:** Curtana Zenith Replica\nDye 1: Metallic Gold\nAcquisition: Zodiac Weapons Saga');
    expect(d).toContain('**Head:** Hempen Coif\nDye 1: Snow White\nAcquisition: Crafted (WVR Lvl. 1)');
    expect(d).toContain('**Body:** Lady’s Yukata\nDye 1: Wine Red\nDye 2: Dalamud Red\nAcquisition:');
    // Undyed pieces are in the list too — the embed carries what the cap drops
    expect(d).toContain('**Feet:** Hempen Boots\nAcquisition:');
    expect(d).not.toContain('Off Hand');
  });

  it('says in the embed which pieces were named from a twin, and why', async () => {
    const result = await executeGlamour(input());
    if (!result.ok) throw new Error(result.errorMessage);
    const d = result.embed.description ?? '';

    expect(d).toContain('Named from a twin:');
    expect(d).toContain("Hempen Coif (not Dated Hempen Coif, which can't take these dyes)");
    expect(d).toContain("Curtana Zenith Replica (not Curtana Zenith, which can't be a glamour)");
    expect(d).toContain("Lady’s Yukata (not Lord’s Yukata, which this character can't wear)");
    expect(d).toContain("No fix: Viera Gaskins (this character can't wear it)");
    expect(d).toContain('/manual topic:👤');
    expect(d).toContain('https://xivdyetools.app/glamour');
  });

  it('writes two identical rings once, as Rings', async () => {
    const ringed = JSON.stringify({
      ...(JSON.parse(STRESS) as Record<string, unknown>),
      RightRing: { ModelBase: 50, ModelVariant: 1 },
      LeftRing: { ModelBase: 50, ModelVariant: 1 },
    });
    const ring = { itemId: 4000, names: names('Silver Ring'), alternates: [], rules: [rules([4000])] };
    const answer: GlamourResolveAnswer = { items: { ...ANSWER.items, RightRing: ring, LeftRing: ring } };
    const result = await executeGlamour(input({ fileText: ringed, resolve: async () => answer }));
    if (!result.ok) throw new Error(result.errorMessage);
    const d = result.embed.description ?? '';

    expect(d).toContain('**Rings:** Silver Ring');
    expect(d).not.toContain('Right Ring');
    expect(d).not.toContain('Left Ring');
  });

  describe('a piece with no item behind it (BUG-124)', () => {
    /** The stress file's head model, as the card labels it (the note puts the slot first). */
    const HEAD_LABEL = `Model ${formatCharaModelLabel({ slot: 'HeadGear', base: 361, variant: 5 })}`;
    const noHead: GlamourResolveAnswer = { items: { ...ANSWER.items, HeadGear: null } };

    it('keeps its slot label bare in the list, as a prompt to fill in — never the model placeholder', async () => {
      const result = await executeGlamour(input({ resolve: async () => noHead }));
      if (!result.ok) throw new Error(result.errorMessage);
      const d = result.embed.description ?? '';
      const list = d.slice(0, d.indexOf('\n\n'));

      // The GPOSERS form: the bare label, the dyes the file puts on it, an empty Acquisition line
      expect(list).toContain('**Head:**\nDye 1: Snow White\nAcquisition:\n');
      expect(list).not.toContain('Model');
      // The card row and the note still say which model it is — the note by slot too
      expect(svgTexts(result.svgString)).toContain(HEAD_LABEL);
      expect(d).toContain(`No fix: HEAD ${HEAD_LABEL} (a model with no item behind it)`);
    });

    /**
     * The list line is the bare slot now, and the card draws dyed pieces only
     * (five at most), so for an undyed model the note is the one place it is
     * named: without the slot, two identical ring models read the same.
     */
    describe('names the slot in the no-fix note', () => {
      const ringed = JSON.stringify({
        ...(JSON.parse(STRESS) as Record<string, unknown>),
        RightRing: { ModelBase: 50, ModelVariant: 1 },
        LeftRing: { ModelBase: 50, ModelVariant: 1 },
      });
      const answer: GlamourResolveAnswer = { items: { ...ANSWER.items, RightRing: null, LeftRing: null } };
      const right = formatCharaModelLabel({ slot: 'RightRing', base: 50, variant: 1 });
      const left = formatCharaModelLabel({ slot: 'LeftRing', base: 50, variant: 1 });

      it('for undyed unresolved rings beside the dyed pieces', async () => {
        const result = await executeGlamour(input({ fileText: ringed, resolve: async () => answer }));
        if (!result.ok) throw new Error(result.errorMessage);
        const d = result.embed.description ?? '';

        // Undyed: neither ring is a card row, so the note is all that names them
        expect(svgTexts(result.svgString)).not.toContain('RIGHT RING');
        expect(svgTexts(result.svgString)).not.toContain('LEFT RING');
        expect(d).toContain(
          `No fix: Viera Gaskins (this character can't wear it) · RIGHT RING Model ${right} (a model with no item behind it) · LEFT RING Model ${left} (a model with no item behind it)`
        );
      });

      it('in the reader’s language', async () => {
        const result = await executeGlamour(input({ locale: 'de', fileText: ringed, resolve: async () => answer }));
        if (!result.ok) throw new Error(result.errorMessage);
        const d = result.embed.description ?? '';

        expect(d).toContain(`FINGER (RECHTS) Modell ${right} (ein Modell ohne Gegenstand dahinter)`);
        expect(d).toContain(`FINGER (LINKS) Modell ${left} (ein Modell ohne Gegenstand dahinter)`);
      });
    });

    it('treats a slot the answer leaves out the same way', async () => {
      const { HeadGear: _omitted, ...rest } = ANSWER.items;
      const result = await executeGlamour(input({ resolve: async () => ({ items: rest }) }));
      if (!result.ok) throw new Error(result.errorMessage);
      const d = result.embed.description ?? '';

      expect(d).toContain('**Head:**\nDye 1: Snow White\nAcquisition:\n');
      expect(d).not.toContain(`**Head:** ${HEAD_LABEL}`);
    });

    it('writes two unresolved rings as two bare slots, not one merged "Rings: Model …"', async () => {
      const ringed = JSON.stringify({
        ...(JSON.parse(STRESS) as Record<string, unknown>),
        RightRing: { ModelBase: 50, ModelVariant: 1 },
        LeftRing: { ModelBase: 50, ModelVariant: 1 },
      });
      const answer: GlamourResolveAnswer = { items: { ...ANSWER.items, RightRing: null, LeftRing: null } };
      const result = await executeGlamour(input({ fileText: ringed, resolve: async () => answer }));
      if (!result.ok) throw new Error(result.errorMessage);
      const d = result.embed.description ?? '';

      // An unknown name is not known to match, so the rings stay apart (core gposersSameRings)
      expect(d).toContain('**Right Ring:**\nAcquisition:\n**Left Ring:**\nAcquisition:');
      expect(d).not.toContain('**Rings:**');
    });
  });

  describe('facewear (BUG-124)', () => {
    const withGlasses = JSON.stringify({ ...(JSON.parse(STRESS) as Record<string, unknown>), Glasses: { GlassesId: 5 } });

    it('asks the resolver for the glasses the file wears', async () => {
      const i = input({ fileText: withGlasses });
      await executeGlamour(i);
      expect((i.resolve as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(5);
    });

    it('names the facewear last in the list when it resolves', async () => {
      const answer: GlamourResolveAnswer = { ...ANSWER, glasses: { names: names('Round Glasses', '丸眼鏡') } };
      const result = await executeGlamour(input({ fileText: withGlasses, resolve: async () => answer }));
      if (!result.ok) throw new Error(result.errorMessage);
      const d = result.embed.description ?? '';

      expect(d).toContain('**Feet:** Hempen Boots\nAcquisition:\n**Facewear:** Round Glasses\nAcquisition:\n\n');
    });

    it('names it in the reader’s language', async () => {
      const answer: GlamourResolveAnswer = { ...ANSWER, glasses: { names: names('Round Glasses', '丸眼鏡') } };
      const result = await executeGlamour(input({ locale: 'ja', fileText: withGlasses, resolve: async () => answer }));
      if (!result.ok) throw new Error(result.errorMessage);
      expect(result.embed.description).toContain('**Facewear:** 丸眼鏡\n');
    });

    it.each([
      ['null', null],
      ['absent', undefined],
    ])('keeps the worn facewear as a bare slot when the glasses do not resolve (%s)', async (_label, glasses) => {
      const answer: GlamourResolveAnswer = { items: ANSWER.items, ...(glasses === undefined ? {} : { glasses }) };
      const result = await executeGlamour(input({ fileText: withGlasses, resolve: async () => answer }));
      if (!result.ok) throw new Error(result.errorMessage);
      const d = result.embed.description ?? '';

      expect(d).toContain('**Feet:** Hempen Boots\nAcquisition:\n**Facewear:**\nAcquisition:\n\n');
    });

    it('writes no facewear for a file that wears none, even if the answer names some', async () => {
      const answer: GlamourResolveAnswer = { ...ANSWER, glasses: { names: names('Round Glasses') } };
      const result = await executeGlamour(input({ resolve: async () => answer }));
      if (!result.ok) throw new Error(result.errorMessage);
      expect(result.embed.description).not.toContain('Facewear');
    });
  });

  describe('what blocks a piece nothing fixes (BUG-127)', () => {
    it('says the dyes or the glamour rule, on the card and in the notes', async () => {
      const answer: GlamourResolveAnswer = {
        items: {
          ...ANSWER.items,
          // One twin, relic-style: no glamourable Replica in the family
          MainHand: { itemId: 7863, names: names('Curtana Zenith'), alternates: [], rules: [rules([7863], { glamourable: false })] },
          // The file dyes both channels; the only twin takes none
          Hands: { itemId: 9001, names: names('Leather Gloves'), alternates: [], rules: [rules([9001], { dyeCount: 0 })] },
        },
      };
      const result = await executeGlamour(input({ resolve: async () => answer }));
      if (!result.ok) throw new Error(result.errorMessage);
      const t = svgTexts(result.svgString);
      const d = result.embed.description ?? '';

      expect(t).toContain('NO GLAM');
      expect(t).toContain('DYES');
      expect(t.join(' ')).toContain('5 of 5 dyed pieces · 2 named from a twin · 3 with no fix');
      expect(d).toContain(
        "No fix: Curtana Zenith (it can't be a glamour) · Leather Gloves (it can't take the dyes the file puts on it) · Viera Gaskins (this character can't wear it)"
      );
    });

    it('reads an item the worker gave no rules for as wearable, not as a problem', async () => {
      const answer: GlamourResolveAnswer = {
        items: { ...ANSWER.items, HeadGear: { itemId: 2629, names: names('Hempen Coif'), alternates: [] } },
      };
      const result = await executeGlamour(input({ resolve: async () => answer }));
      if (!result.ok) throw new Error(result.errorMessage);
      const t = svgTexts(result.svgString);
      const d = result.embed.description ?? '';

      expect(t).toContain('Hempen Coif');
      // Head was one of three twins; with no rules it is simply OK
      expect(t.filter((s) => s === 'TWIN')).toHaveLength(2);
      expect(t.filter((s) => s === 'OK')).toHaveLength(2);
      expect(d).not.toMatch(/Hempen Coif \(/);
      expect(d).not.toContain('Grand Company');
    });
  });

  it('names the pieces locked to a Grand Company (BUG-127)', async () => {
    const answer: GlamourResolveAnswer = {
      items: {
        ...ANSWER.items,
        Body: {
          ...ANSWER.items.Body!,
          rules: [rules([8001], { dyeCount: 2, wearMask: MALE_ONLY }), rules([8002], { dyeCount: 2, wearMask: FEMALE_ONLY, grandCompany: 1 })],
        },
        Feet: { itemId: 3000, names: names('Serpent *Boots*'), alternates: [], rules: [rules([3000], { grandCompany: 2 })] },
      },
    };
    const result = await executeGlamour(input({ resolve: async () => answer }));
    if (!result.ok) throw new Error(result.errorMessage);

    expect(result.embed.description).toContain('Needs the right Grand Company: Lady’s Yukata · Serpent \\*Boots\\*');
  });

  it('writes no Grand Company line when nothing is locked to one', async () => {
    const result = await executeGlamour(input());
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.embed.description).not.toContain('Grand Company');
  });

  it('names an item in English when the regional tables do not know it (ko / zh)', async () => {
    const answer: GlamourResolveAnswer = {
      items: { ...ANSWER.items, Feet: { ...ANSWER.items.Feet!, names: { ...names('Hempen Boots'), ko: '마 장화' } } },
    };
    const result = await executeGlamour(input({ locale: 'ko', resolve: async () => answer }));
    if (!result.ok) throw new Error(result.errorMessage);
    const d = result.embed.description ?? '';

    expect(d).toContain('**Feet:** 마 장화\n');
    expect(d).toContain('**Head:** Hempen Coif\n');
    expect(svgTexts(result.svgString)).toContain('Hempen Coif');
  });

  it('writes a stain the dye table does not know as its number, and draws no chip for it', async () => {
    const fileText = JSON.stringify({
      TypeName: 'Anamnesis Character File',
      Tribe: 'Midlander',
      Gender: 'Feminine',
      REyeColor: 42,
      Feet: { ModelBase: 99, ModelVariant: 1, DyeId: 240, DyeId2: 0 },
    });
    const result = await executeGlamour(input({ fileText, resolve: async () => ({ items: { Feet: ANSWER.items.Feet } }) }));
    if (!result.ok) throw new Error(result.errorMessage);

    expect(result.embed.description).toContain('**Feet:** Hempen Boots\nDye 1: #240\nAcquisition:');
    expect(svgTexts(result.svgString)).toContain('FEET');
    expect(svgTexts(result.svgString)).not.toContain('#240');
    // No colour is known, so the embed takes the brand red
    expect(result.embed.color).toBe(0xea4133);
  });

  it('colours the embed with the first dye on the card', async () => {
    const result = await executeGlamour(input());
    if (!result.ok) throw new Error(result.errorMessage);
    const gold = dyeService.getByStainId(113)!;
    expect(result.embed.color).toBe(parseInt(gold.hex.slice(1), 16));
  });

  describe('a file with no dyes on it (BUG-127)', () => {
    const PLAIN = JSON.stringify({
      TypeName: 'Some Other Tool',
      Tribe: 'Midlander',
      Gender: 'Feminine',
      REyeColor: 42,
      Body: { ModelBase: 812, ModelVariant: 2, DyeId: 0, DyeId2: 0 },
      Feet: { ModelBase: 99, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
    });
    const PLAIN_ANSWER: GlamourResolveAnswer = {
      items: {
        Body: { itemId: 8002, names: names('Lady’s Yukata'), alternates: [], rules: [rules([8002], { dyeCount: 2 })] },
        Feet: ANSWER.items.Feet,
      },
    };

    it('draws every worn piece and counts pieces, not dyed pieces', async () => {
      const result = await executeGlamour(input({ fileText: PLAIN, resolve: async () => PLAIN_ANSWER }));
      if (!result.ok) throw new Error(result.errorMessage);
      const t = svgTexts(result.svgString);

      expect(result.embed.title).toBe('Glamour · 2 pieces');
      expect(t).toContain('2 pieces · no dyes');
      expect(t.filter((s) => ['BODY', 'FEET'].includes(s))).toEqual(['BODY', 'FEET']);
      const foot = t.join(' ');
      expect(foot).toContain('2 of 2 pieces');
      expect(foot).not.toContain('named from a twin');
      expect(foot).not.toContain('with no fix');
      // An unknown producer is left out of the header rather than printed
      expect(t).toContain('MIDLANDER ♀');
      expect(result.svgString).not.toContain('Some Other Tool');
    });

    it('writes no twin or no-fix notes and takes the brand red', async () => {
      const result = await executeGlamour(input({ fileText: PLAIN, resolve: async () => PLAIN_ANSWER }));
      if (!result.ok) throw new Error(result.errorMessage);
      const d = result.embed.description ?? '';

      expect(d).toContain('**Body:** Lady’s Yukata\nAcquisition:\n**Feet:** Hempen Boots\nAcquisition:\n\n');
      expect(d).not.toContain('Named from a twin:');
      expect(d).not.toContain('No fix:');
      expect(result.embed.color).toBe(0xea4133);
    });

    it('counts a single piece in the singular', async () => {
      const one = JSON.stringify({ ...(JSON.parse(PLAIN) as Record<string, unknown>), Body: undefined });
      const result = await executeGlamour(input({ fileText: one, resolve: async () => PLAIN_ANSWER }));
      if (!result.ok) throw new Error(result.errorMessage);

      expect(result.embed.title).toBe('Glamour · 1 piece');
      expect(svgTexts(result.svgString).join(' ')).toContain('1 of 1 piece');
    });
  });

  describe('a list longer than an embed (BUG-127)', () => {
    const LONG = `Purchased from ${'a very patient vendor '.repeat(40).trim()}`;
    const plainItem = (itemId: number, name: string) => ({
      itemId,
      names: names(name),
      alternates: [],
      rules: [rules([itemId], { dyeCount: 2 })],
      acquisition: LONG,
    });
    const LONG_ANSWER: GlamourResolveAnswer = {
      items: {
        MainHand: plainItem(7001, 'Long Sword'),
        OffHand: ANSWER.items.OffHand,
        HeadGear: plainItem(7002, 'Long Hat'),
        Body: plainItem(7003, 'Long Coat'),
        Hands: plainItem(7004, 'Long Gloves'),
        Legs: plainItem(7005, 'Long Trousers'),
        Feet: plainItem(7006, 'Long Boots'),
      },
    };

    it('cuts the list at a whole line and keeps the closing lines', async () => {
      const result = await executeGlamour(input({ resolve: async () => LONG_ANSWER }));
      if (!result.ok) throw new Error(result.errorMessage);
      const d = result.embed.description ?? '';
      const tail = '\n\nMore on character files: `/manual topic:👤`\nhttps://xivdyetools.app/glamour';

      // The uncut list would be six acquisition lines of ~900 characters each
      expect(LONG.length * 6).toBeGreaterThan(4096);
      expect(d.length).toBeLessThanOrEqual(4096);
      expect(d.endsWith(`\n…${tail}`)).toBe(true);
      const kept = d.slice(0, -(`\n…${tail}`).length).split('\n');
      expect(kept[0]).toBe('**Glamour Items:**');
      expect(kept.length).toBeGreaterThan(4);
      // Every line kept is whole: no Acquisition line is cut mid-sentence
      for (const line of kept.filter((l) => l.startsWith('Acquisition:'))) expect(line).toBe(`Acquisition: ${LONG}`);
      expect(d).not.toContain('Long Boots');
    });

    it('leaves a list that fits alone', async () => {
      const result = await executeGlamour(input());
      if (!result.ok) throw new Error(result.errorMessage);
      expect(result.embed.description).not.toContain('…');
    });
  });

  describe('a card that fails to draw (BUG-125)', () => {
    /** A canDraw that throws `thrown` — the first call inside the drawing try. */
    const throwing =
      (thrown: unknown) =>
      (): boolean => {
        throw thrown;
      };
    /** Every argument the logger received, one string per argument. */
    const loggedLines = (warn: ReturnType<typeof vi.fn>): string[] => warn.mock.calls.flat().map(String);

    it('answers GENERATION_FAILED in the reader’s language and logs the error class', async () => {
      const warn = vi.fn();
      const result = await executeGlamour(
        input({ locale: 'de', canDraw: throwing(new TypeError("Cannot read properties of undefined (reading 'hex')")), logger: { warn } })
      );

      expect(result).toMatchObject({ ok: false, error: 'GENERATION_FAILED' });
      if (result.ok) return;
      expect(result.errorMessage).toBe(createTranslator('de').t('errors.generationFailed'));
      expect(loggedLines(warn)).toContain('[glamour] generation failed: TypeError');
    });

    it('never logs the message — it can quote what it was given', async () => {
      const warn = vi.fn();
      await executeGlamour(input({ canDraw: throwing(new RangeError('Real Name')), logger: { warn } }));
      const lines = loggedLines(warn);

      expect(lines).toContain('[glamour] generation failed: RangeError');
      for (const line of lines) expect(line).not.toContain('Real Name');
    });

    it('names an AppError by its code', async () => {
      const warn = vi.fn();
      await executeGlamour(input({ canDraw: throwing(new AppError('INVALID_INPUT', 'Real Name')), logger: { warn } }));
      const lines = loggedLines(warn);

      expect(lines).toContain('[glamour] generation failed: AppError INVALID_INPUT');
      for (const line of lines) expect(line).not.toContain('Real Name');
    });

    it('names a thrown non-error by its type only', async () => {
      const warn = vi.fn();
      await executeGlamour(input({ canDraw: throwing('Real Name'), logger: { warn } }));
      const lines = loggedLines(warn);

      expect(lines).toContain('[glamour] generation failed: string');
      for (const line of lines) expect(line).not.toContain('Real Name');
    });

    it('still answers without a logger', async () => {
      const result = await executeGlamour(input({ canDraw: throwing(new TypeError('x')) }));
      expect(result).toMatchObject({ ok: false, error: 'GENERATION_FAILED' });
    });
  });

  it('speaks the requested locale on the card', async () => {
    const result = await executeGlamour(input({ locale: 'ja' }));
    if (!result.ok) throw new Error(result.errorMessage);
    const t = svgTexts(result.svgString);

    expect(t).toContain('ヘンプコイフ');
    expect(t).toContain('頭');
  });

  it('draws a name the fonts cannot draw in English, and keeps it in the embed', async () => {
    const kanji: GlamourResolveAnswer = {
      items: { ...ANSWER.items, Legs: { ...ANSWER.items.Legs!, names: names('Viera Gaskins', 'ヴィエラ・脚甲') } },
    };
    const result = await executeGlamour(
      input({ locale: 'ja', resolve: async () => kanji, canDraw: (text) => !text.includes('脚甲') })
    );
    if (!result.ok) throw new Error(result.errorMessage);

    expect(svgTexts(result.svgString)).toContain('Viera Gaskins');
    expect(result.svgString).not.toContain('脚甲');
    expect(result.embed.description).toContain('ヴィエラ・脚甲');
  });

  /**
   * Every race with a tribe the parser maps to it and the card's English race
   * name. The wear-mask column comes from core's sheet order, matched without
   * the apostrophe: Miqo'te is the one race whose sheet column (`Miqote`) is
   * not spelled like our `Race` identifier (`Miqo'te`).
   */
  const RACES = [
    { race: 'Hyur', tribe: 'Midlander', shown: 'HYUR' },
    { race: 'Elezen', tribe: 'Wildwood', shown: 'ELEZEN' },
    { race: 'Lalafell', tribe: 'Plainsfolk', shown: 'LALAFELL' },
    { race: "Miqo'te", tribe: 'SeekerOfTheSun', shown: 'MIQO&apos;TE' },
    { race: 'Roegadyn', tribe: 'SeaWolf', shown: 'ROEGADYN' },
    { race: 'AuRa', tribe: 'Raen', shown: 'AU RA' },
    { race: 'Hrothgar', tribe: 'Helions', shown: 'HROTHGAR' },
    { race: 'Viera', tribe: 'Rava', shown: 'VIERA' },
  ].map((r) => ({ ...r, column: (CHARA_WEAR_RACE_COLUMNS as readonly string[]).indexOf(r.race.replace("'", '')) }));

  /** The stress file as another character, with Legs locked to `wearMask`. */
  const wearing = async (tribe: string, gender: 'Masculine' | 'Feminine', wearMask: number) => {
    const fileText = JSON.stringify({ ...(JSON.parse(STRESS) as Record<string, unknown>), Race: undefined, Tribe: tribe, Gender: gender });
    const answer: GlamourResolveAnswer = {
      items: { ...ANSWER.items, Legs: { ...ANSWER.items.Legs!, rules: [rules([9500], { wearMask })] } },
    };
    const result = await executeGlamour(input({ fileText, resolve: async () => answer }));
    if (!result.ok) throw new Error(result.errorMessage);
    return svgTexts(result.svgString);
  };

  it.each(RACES)(
    'names the race only when the race is what blocks it: $race man, piece for $race women → LOCKED',
    async ({ tribe, shown, column }) => {
      expect(column).toBeGreaterThanOrEqual(0);
      const t = await wearing(tribe, 'Masculine', 1 << (2 * column + 1));

      expect(t).toContain('LOCKED');
      expect(t).not.toContain(shown);
    }
  );

  it.each(RACES)('and the other way round: $race woman, piece for $race men → LOCKED', async ({ tribe, shown, column }) => {
    const t = await wearing(tribe, 'Feminine', 1 << (2 * column));

    expect(t).toContain('LOCKED');
    expect(t).not.toContain(shown);
  });

  it.each(RACES)('but a piece for $race alone names the race to anyone else', async ({ race, shown, column }) => {
    const other = RACES[(column + 1) % RACES.length];
    const t = await wearing(other.tribe, 'Feminine', 0b11 << (2 * column));

    expect(other.race).not.toBe(race);
    expect(t).toContain(shown);
    expect(t).not.toContain('LOCKED');
  });

  it('counts the whole family in +N, as the web does, not just the named alternates', async () => {
    const big: GlamourResolveAnswer = {
      items: { ...ANSWER.items, HeadGear: { ...ANSWER.items.HeadGear!, familySize: 53 } },
    };
    const result = await executeGlamour(input({ resolve: async () => big }));
    if (!result.ok) throw new Error(result.errorMessage);
    expect(svgTexts(result.svgString)).toContain('+52 LOOKS');
  });

  it('escapes Discord formatting in the note lines too', async () => {
    const starred: GlamourResolveAnswer = {
      items: {
        ...ANSWER.items,
        Legs: { ...ANSWER.items.Legs!, names: names('Gaskins *Viera*') },
      },
    };
    const result = await executeGlamour(input({ resolve: async () => starred }));
    if (!result.ok) throw new Error(result.errorMessage);
    expect(result.embed.description).toContain('No fix: Gaskins \\*Viera\\*');
  });

  it('says the lookup is busy, not broken, when api-worker rate-limits it', async () => {
    const result = await executeGlamour(
      input({
        resolve: async () => {
          throw Object.assign(new Error('api-worker answered 429'), { status: 429 });
        },
      })
    );
    expect(result).toMatchObject({ ok: false, error: 'RESOLVE_BUSY' });
    if (!result.ok) expect(result.errorMessage).toMatch(/busy/i);
  });

  it.each([400, 413, 422])(
    'answers api-worker refusing what the file describes (%i) as a problem with the file, not an outage',
    async (status) => {
      const reason = 'gear[0].base must be an integer between 0 and 65535';
      const result = await executeGlamour(
        input({
          resolve: async () => {
            throw Object.assign(new Error(reason), { status });
          },
        })
      );
      expect(result).toMatchObject({ ok: false, error: 'PARSE_FAILED' });
      if (result.ok) return;
      // HC-002: a localized reason, never api-worker's English one
      expect(result.errorMessage).toBe('Could not read the file — it is not a .chara file the bot can read');
      expect(result.errorMessage).not.toContain('65535');
      expect(result.errorMessage).not.toMatch(/try again/i);
    }
  );

  describe('a file it cannot read is refused in the reader’s language (HC-002)', () => {
    const de = createTranslator('de');
    const unreadable = de.t('card.swatchParseError', { message: de.t('card.charaFileReason.unreadable') });

    it('the reason is a real key, not its own name', () => {
      expect(de.t('card.charaFileReason.unreadable')).not.toBe('card.charaFileReason.unreadable');
    });

    it('when api-worker refuses what the file describes', async () => {
      const reason = 'gear[0].base must be an integer between 0 and 65535';
      const result = await executeGlamour(
        input({
          locale: 'de',
          resolve: async () => {
            throw Object.assign(new Error(reason), { status: 400 });
          },
        })
      );
      if (result.ok) throw new Error('expected a refusal');
      expect(result.errorMessage).toBe(unreadable);
      expect(result.errorMessage).not.toContain(reason);
    });

    it('when the parser refuses the file', async () => {
      const result = await executeGlamour(input({ locale: 'de', fileText: 'not json' }));
      if (result.ok) throw new Error('expected a refusal');
      expect(result).toMatchObject({ error: 'PARSE_FAILED' });
      expect(result.errorMessage).toBe(unreadable);
      expect(result.errorMessage).not.toContain('not valid JSON');
    });
  });

  // A missing route or a refused caller is our deploy or config, not the file
  it.each([401, 403, 404])('answers a %i as RESOLVE_FAILED: the fault is ours', async (status) => {
    const result = await executeGlamour(
      input({
        resolve: async () => {
          throw Object.assign(new Error('Route POST /v1/chara/resolve not found'), { status });
        },
      })
    );
    expect(result).toMatchObject({ ok: false, error: 'RESOLVE_FAILED' });
    if (result.ok) return;
    expect(result.errorMessage).not.toContain('Route POST');
  });

  it('still answers a server error with a status as RESOLVE_FAILED', async () => {
    const result = await executeGlamour(
      input({
        resolve: async () => {
          throw Object.assign(new Error('api-worker answered 503'), { status: 503 });
        },
      })
    );
    expect(result).toMatchObject({ ok: false, error: 'RESOLVE_FAILED' });
  });

  it('answers a file it cannot read with the parse error', async () => {
    const result = await executeGlamour(input({ fileText: 'not json' }));
    expect(result).toMatchObject({ ok: false, error: 'PARSE_FAILED' });
  });

  /**
   * The read's catch was bare, and its try also runs the resolver — so a
   * bot-side bug there answered PARSE_FAILED with nothing in the log, looking
   * exactly like a bad file. The line names the class and code only: the
   * parser's reason quotes field values from the player's file.
   */
  describe('a read that fails is logged', () => {
    const loggedLines = (warn: ReturnType<typeof vi.fn>): string[] => warn.mock.calls.flat().map(String);

    it('logs a bot-side failure inside the read, so it is not mistaken for a bad file', async () => {
      vi.mocked(resolveCharaColors).mockImplementationOnce(() => {
        throw new TypeError('Real Name');
      });
      const warn = vi.fn();
      const result = await executeGlamour(input({ logger: { warn } }));

      expect(result).toMatchObject({ ok: false, error: 'PARSE_FAILED' });
      const lines = loggedLines(warn);
      expect(lines).toContain('[glamour] parse failed: TypeError');
      for (const line of lines) expect(line).not.toContain('Real Name');
    });

    it('logs the parser refusing the file by class and code, never the file', async () => {
      const warn = vi.fn();
      const i = input({
        fileText: JSON.stringify({ IsExtendedAppearanceValid: true, LeftEyeColor: 'Real Name' }),
        logger: { warn },
      });
      const result = await executeGlamour(i);

      expect(result).toMatchObject({ ok: false, error: 'PARSE_FAILED' });
      expect(i.resolve).not.toHaveBeenCalled();
      const lines = loggedLines(warn);
      expect(lines).toContain('[glamour] parse failed: AppError INVALID_INPUT');
      for (const line of lines) expect(line).not.toContain('Real Name');
    });

    it('still answers without a logger', async () => {
      vi.mocked(resolveCharaColors).mockImplementationOnce(() => {
        throw new TypeError('Real Name');
      });
      const result = await executeGlamour(input());
      expect(result).toMatchObject({ ok: false, error: 'PARSE_FAILED' });
    });
  });

  it('answers a file that wears nothing without calling the resolver', async () => {
    const i = input({ fileText: JSON.stringify({ Race: 'Hyur', Tribe: 'Midlander', Gender: 'Feminine', REyeColor: 42 }) });
    const result = await executeGlamour(i);
    expect(result).toMatchObject({ ok: false, error: 'NO_GEAR' });
    expect(i.resolve).not.toHaveBeenCalled();
  });

  /**
   * RESOLVE_FAILED used to be answered with nothing logged, so a missing
   * binding, a malformed envelope and an api-worker outage all looked alike.
   * The line names the error's class and the HTTP status — never the message:
   * an api-worker 4xx reason can echo the file's gear values.
   */
  describe('a lookup that fails is logged (BUG-125)', () => {
    const loggedLines = (warn: ReturnType<typeof vi.fn>): string[] => warn.mock.calls.flat().map(String);
    const SENTINEL = 'gear[0].base Sentinel 361';
    const failing = (thrown: unknown) => async (): Promise<GlamourResolveAnswer> => {
      throw thrown;
    };

    it.each([401, 403, 404, 500, 503])('names the class and the status of a %i', async (status) => {
      const warn = vi.fn();
      const result = await executeGlamour(
        input({ resolve: failing(Object.assign(new Error(SENTINEL), { status })), logger: { warn } })
      );

      expect(result).toMatchObject({ ok: false, error: 'RESOLVE_FAILED' });
      const lines = loggedLines(warn);
      expect(lines).toContain(`[glamour] resolve failed: Error (status ${status})`);
      for (const line of lines) expect(line).not.toContain('Sentinel');
    });

    it('names the class alone when there is no status', async () => {
      const warn = vi.fn();
      await executeGlamour(input({ resolve: failing(new TypeError(SENTINEL)), logger: { warn } }));
      const lines = loggedLines(warn);

      expect(lines).toContain('[glamour] resolve failed: TypeError');
      for (const line of lines) expect(line).not.toContain('Sentinel');
    });

    it('names an AppError by its code', async () => {
      const warn = vi.fn();
      await executeGlamour(input({ resolve: failing(new AppError('API_CALL_FAILED', SENTINEL)), logger: { warn } }));

      expect(loggedLines(warn)).toContain('[glamour] resolve failed: AppError API_CALL_FAILED');
    });

    it.each([
      ['a string', SENTINEL, 'string'],
      ['null', null, 'object'],
    ])('names %s thrown by its type only', async (_label, thrown, kind) => {
      const warn = vi.fn();
      const result = await executeGlamour(input({ resolve: failing(thrown), logger: { warn } }));

      expect(result).toMatchObject({ ok: false, error: 'RESOLVE_FAILED' });
      const lines = loggedLines(warn);
      expect(lines).toContain(`[glamour] resolve failed: ${kind}`);
      for (const line of lines) expect(line).not.toContain('Sentinel');
    });

    it('still answers without a logger', async () => {
      const result = await executeGlamour(input({ resolve: failing(new Error(SENTINEL)) }));
      expect(result).toMatchObject({ ok: false, error: 'RESOLVE_FAILED' });
    });
  });

  it('answers a resolver failure as RESOLVE_FAILED, never a half-drawn card', async () => {
    const result = await executeGlamour(
      input({
        resolve: async () => {
          throw new Error('api-worker answered 503');
        },
      })
    );
    expect(result).toMatchObject({ ok: false, error: 'RESOLVE_FAILED' });
  });
});
