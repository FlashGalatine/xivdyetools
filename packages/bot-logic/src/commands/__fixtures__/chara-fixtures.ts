/**
 * .chara fixture texts for the swatch tests, vendored from core's corpus
 * (`packages/core/src/services/chara/__tests__/fixtures/`) — bot-logic is a
 * Workers-safe package with no node:fs, so the texts live inline. If core's
 * fixtures change, re-copy.
 */

export const DUSKWIGHT_HETEROCHROMIA = "{\n  \"ModelType\": 0,\n  \"Race\": \"Elezen\",\n  \"Gender\": \"Feminine\",\n  \"Age\": \"Normal\",\n  \"Tribe\": \"Duskwight\",\n  \"Height\": 100,\n  \"Head\": 4,\n  \"Hair\": 183,\n  \"EnableHighlights\": true,\n  \"Skintone\": 0,\n  \"REyeColor\": 42,\n  \"HairTone\": 71,\n  \"Highlights\": 36,\n  \"FacialFeatures\": \"First, Second, Third, Fifth\",\n  \"LimbalEyes\": 7,\n  \"Eyebrows\": 2,\n  \"LEyeColor\": 169,\n  \"Eyes\": 2,\n  \"Nose\": 3,\n  \"Jaw\": 1,\n  \"Mouth\": 2,\n  \"LipsToneFurPattern\": 53,\n  \"EarMuscleTailSize\": 100,\n  \"TailEarsType\": 3,\n  \"Bust\": 100,\n  \"FacePaint\": 0,\n  \"FacePaintColor\": 55,\n  \"MainHand\": {\n    \"Color\": \"0, 0, 0\",\n    \"Scale\": \"0, 0, 0\",\n    \"ModelSet\": 5603,\n    \"ModelBase\": 9,\n    \"ModelVariant\": 3,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"OffHand\": {\n    \"Color\": \"0, 0, 0\",\n    \"Scale\": \"0, 0, 0\",\n    \"ModelSet\": 0,\n    \"ModelBase\": 0,\n    \"ModelVariant\": 0,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"HeadGear\": {\n    \"ModelBase\": 813,\n    \"ModelVariant\": 2,\n    \"DyeId\": 92,\n    \"DyeId2\": 1\n  },\n  \"Body\": {\n    \"ModelBase\": 876,\n    \"ModelVariant\": 1,\n    \"DyeId\": 97,\n    \"DyeId2\": 92\n  },\n  \"Hands\": {\n    \"ModelBase\": 835,\n    \"ModelVariant\": 2,\n    \"DyeId\": 97,\n    \"DyeId2\": 0\n  },\n  \"Legs\": {\n    \"ModelBase\": 835,\n    \"ModelVariant\": 2,\n    \"DyeId\": 97,\n    \"DyeId2\": 0\n  },\n  \"Feet\": {\n    \"ModelBase\": 6135,\n    \"ModelVariant\": 1,\n    \"DyeId\": 97,\n    \"DyeId2\": 0\n  },\n  \"Ears\": {\n    \"ModelBase\": 124,\n    \"ModelVariant\": 6,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"Neck\": {\n    \"ModelBase\": 111,\n    \"ModelVariant\": 2,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"Wrists\": {\n    \"ModelBase\": 134,\n    \"ModelVariant\": 6,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"LeftRing\": {\n    \"ModelBase\": 53,\n    \"ModelVariant\": 1,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"RightRing\": {\n    \"ModelBase\": 53,\n    \"ModelVariant\": 1,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"Glasses\": {\n    \"GlassesId\": 0\n  },\n  \"Transparency\": 1,\n  \"HeightMultiplier\": 1.01,\n  \"MuscleTone\": 1,\n  \"SkinColor\": \"0.8858132, 0.6977163, 0.7579239\",\n  \"SkinGloss\": null,\n  \"LeftEyeColor\": \"0.7443291, 0.53204155, 0.17937717\",\n  \"RightEyeColor\": \"0.28027683, 0.56692046, 0.40859672\",\n  \"LimbalRingColor\": \"0.12456748, 0.005551711, 0.01777778\",\n  \"HairColor\": \"0.5610304, 0.18948098, 0.16955018\",\n  \"HairGloss\": null,\n  \"HairHighlight\": \"0.24804306, 0.06903499, 0.16315264\",\n  \"MouthColor\": \"0.041584007, 0.0015378702, 0.012056901, 0.6\",\n  \"BustScale\": null,\n  \"IsExtendedAppearanceValid\": true,\n  \"Author\": null,\n  \"Description\": null,\n  \"Version\": null,\n  \"Base64Image\": null,\n  \"Tags\": null\n}\n";

/** A fixture text as an object, for format-proof field injection. */
export function charaFixtureObject(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * Privacy canaries for the library-backed import (Task 6). Every value starts
 * with `CANARY`, so one case-insensitive search covers upper-cased card text
 * too. Covers the nickname, the author/description (the description is shaped
 * like an export filename, which players name after themselves), an unknown
 * top-level field, an unknown array field, an unknown lane inside a worn piece
 * and an unknown key beside a valid `GlassesId`.
 */
export const CHARA_CANARY_PATTERN = /canary/i;

export function withCharaCanaries(doc: Record<string, unknown>): Record<string, unknown> {
  const body = (doc.Body as Record<string, unknown> | undefined) ?? {
    ModelBase: 812,
    ModelVariant: 2,
    DyeId: 12,
  };
  return {
    ...doc,
    Nickname: 'CANARY_NICK Firstname Lastname',
    Author: 'CANARY_AUTHOR',
    Description: 'CANARY_DESC Firstname Lastname.chara',
    CANARY_UNKNOWN_KEY: 'CANARY_UNKNOWN_VALUE',
    Tags: ['CANARY_TAG'],
    Body: { ...body, CANARY_LANE: 'CANARY_LANE_VALUE' },
    Glasses: { GlassesId: 4, CANARY_GLASSES: 'CANARY_GLASSES_VALUE' },
  };
}

/** UTF-8 bytes of a document (object or text). */
export function charaBytes(doc: Record<string, unknown> | string): Uint8Array {
  return new TextEncoder().encode(typeof doc === 'string' ? doc : JSON.stringify(doc));
}

/**
 * A document whose `Nickname` value carries one lone 0xFF byte: well-formed
 * JSON around invalid UTF-8. A non-fatal decode turns it into U+FFFD and the
 * rest of the file still parses; the library reader refuses it as
 * `INVALID_UTF8`.
 */
export function charaBytesWithInvalidUtf8(doc: Record<string, unknown>): Uint8Array {
  const head = new TextEncoder().encode(`${JSON.stringify(doc).slice(0, -1)},"Nickname":"`);
  const tail = new TextEncoder().encode('"}');
  const out = new Uint8Array(head.byteLength + 1 + tail.byteLength);
  out.set(head, 0);
  out[head.byteLength] = 0xff;
  out.set(tail, head.byteLength + 1);
  return out;
}

/** The document padded with trailing spaces (valid JSON) to exactly `bytes` UTF-8 bytes. */
export function charaTextOfBytes(doc: Record<string, unknown>, bytes: number): string {
  const text = JSON.stringify(doc);
  if (/[^\x20-\x7e]/.test(text)) throw new Error('charaTextOfBytes pads ASCII documents only');
  return text.padEnd(bytes);
}

export const HROTHGAR_HELIONS ="{\n  \"ModelType\": 0,\n  \"Race\": \"Hrothgar\",\n  \"Gender\": \"Feminine\",\n  \"Age\": \"Normal\",\n  \"Tribe\": \"Helions\",\n  \"Height\": 73,\n  \"Head\": 2,\n  \"Hair\": 22,\n  \"EnableHighlights\": false,\n  \"Skintone\": 104,\n  \"REyeColor\": 165,\n  \"HairTone\": 152,\n  \"Highlights\": 1,\n  \"FacialFeatures\": \"Fourth\",\n  \"LimbalEyes\": 60,\n  \"Eyebrows\": 4,\n  \"LEyeColor\": 165,\n  \"Eyes\": 3,\n  \"Nose\": 3,\n  \"Jaw\": 1,\n  \"Mouth\": 131,\n  \"LipsToneFurPattern\": 35,\n  \"EarMuscleTailSize\": 44,\n  \"TailEarsType\": 3,\n  \"Bust\": 56,\n  \"FacePaint\": 106,\n  \"FacePaintColor\": 171,\n  \"MainHand\": {\n    \"Color\": \"0, 0, 0\",\n    \"Scale\": \"0, 0, 0\",\n    \"ModelSet\": 301,\n    \"ModelBase\": 31,\n    \"ModelVariant\": 1,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"OffHand\": {\n    \"Color\": \"0, 0, 0\",\n    \"Scale\": \"0, 0, 0\",\n    \"ModelSet\": 351,\n    \"ModelBase\": 31,\n    \"ModelVariant\": 1,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"HeadGear\": {\n    \"ModelBase\": 6229,\n    \"ModelVariant\": 1,\n    \"DyeId\": 33,\n    \"DyeId2\": 0\n  },\n  \"Body\": {\n    \"ModelBase\": 436,\n    \"ModelVariant\": 1,\n    \"DyeId\": 105,\n    \"DyeId2\": 0\n  },\n  \"Hands\": {\n    \"ModelBase\": 0,\n    \"ModelVariant\": 0,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"Legs\": {\n    \"ModelBase\": 6223,\n    \"ModelVariant\": 2,\n    \"DyeId\": 72,\n    \"DyeId2\": 0\n  },\n  \"Feet\": {\n    \"ModelBase\": 6221,\n    \"ModelVariant\": 2,\n    \"DyeId\": 33,\n    \"DyeId2\": 0\n  },\n  \"Ears\": {\n    \"ModelBase\": 0,\n    \"ModelVariant\": 0,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"Neck\": {\n    \"ModelBase\": 0,\n    \"ModelVariant\": 0,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"Wrists\": {\n    \"ModelBase\": 0,\n    \"ModelVariant\": 0,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"LeftRing\": {\n    \"ModelBase\": 0,\n    \"ModelVariant\": 0,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"RightRing\": {\n    \"ModelBase\": 0,\n    \"ModelVariant\": 0,\n    \"DyeId\": 0,\n    \"DyeId2\": 0\n  },\n  \"Glasses\": {\n    \"GlassesId\": 0\n  },\n  \"Transparency\": 1,\n  \"HeightMultiplier\": 1.0444,\n  \"MuscleTone\": 1,\n  \"SkinColor\": \"0.2069358, 0.10851212, 0.0865052\",\n  \"SkinGloss\": \"0.0625, 0.0625, 0.0625\",\n  \"LeftEyeColor\": \"0.014778932, 0.095978476, 0.06903499\",\n  \"RightEyeColor\": \"0.014778932, 0.095978476, 0.06903499\",\n  \"LimbalRingColor\": \"0.27203387, 0.10340639, 0.012056901\",\n  \"HairColor\": \"0.53204155, 0.35530952, 0.3839139\",\n  \"HairGloss\": \"0.65261054, 0.5206613, 0.5435448\",\n  \"HairHighlight\": \"0.53204155, 0.35530952, 0.3839139\",\n  \"MouthColor\": \"0, 0, 0, 0\",\n  \"BustScale\": null,\n  \"IsExtendedAppearanceValid\": true,\n  \"Author\": null,\n  \"Description\": null,\n  \"Version\": null,\n  \"Base64Image\": null,\n  \"Tags\": null\n}\n";
