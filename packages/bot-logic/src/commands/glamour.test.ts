/**
 * /glamour — the Glamour Reader in the bot (design 2a + its embed).
 *
 * The stress file from the design: a Midlander woman whose file names three
 * items she can't wear as saved (each fixed by a twin), one free choice, one
 * piece nothing fixes, an undyed pair of boots, and a quiver that is the
 * bow's own off-hand model.
 */
import { describe, it, expect, vi } from 'vitest';
import { CHARA_WEAR_RACE_COLUMNS, type CharaGearModel } from '@xivdyetools/core';
import { executeGlamour, type GlamourInput, type GlamourResolveAnswer } from './glamour.js';
import { createTranslator } from '../i18n/index.js';

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

  it('answers a file that wears nothing without calling the resolver', async () => {
    const i = input({ fileText: JSON.stringify({ Race: 'Hyur', Tribe: 'Midlander', Gender: 'Feminine', REyeColor: 42 }) });
    const result = await executeGlamour(i);
    expect(result).toMatchObject({ ok: false, error: 'NO_GEAR' });
    expect(i.resolve).not.toHaveBeenCalled();
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
