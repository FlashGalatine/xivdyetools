/**
 * Response-object field tables, authored once as data so the console card can
 * fold them under its parameter form (`<EndpointCard fields="dye">`). The
 * rows mirror `src/lib/dye-serializer.ts` — the serializer is the contract,
 * this is its description.
 */

export interface FieldRow {
  name: string;
  type: string;
  description: string;
}

export interface FieldSet {
  label: string;
  rows: FieldRow[];
}

export type FieldSetName = 'dye' | 'wheel' | 'wheelPosition' | 'harmonySlot';

export const FIELD_SETS: Record<FieldSetName, FieldSet> = {
  wheel: {
    label: 'Wheel',
    rows: [
      { name: 'id', type: 'string', description: 'rgb · ryb · munsell · oklch-hue · oklch-lightness — the wire format everywhere (share URLs, the bot, this API)' },
      { name: 'tag', type: 'string', description: 'Short untranslated token the cards print: RGB · RYB · MUNSELL · OKLCH·H · OKLCH·L' },
      { name: 'name', type: 'string', description: 'Display name in the requested locale' },
      { name: 'isDefault', type: 'boolean', description: 'true for rgb — what an absent wheel means everywhere in the suite' },
    ],
  },
  wheelPosition: {
    label: 'Wheel Position',
    rows: [
      { name: 'stainID', type: 'integer', description: 'Stain table ID (1–254)' },
      { name: 'itemID', type: 'integer', description: 'Legacy game item ID' },
      { name: 'name', type: 'string', description: 'English dye name' },
      { name: 'localizedName', type: 'string?', description: 'Present only when locale ≠ en' },
      { name: 'hex', type: 'string', description: 'Hex color (#RRGGBB)' },
      { name: 'wheelHue', type: 'number', description: 'Where the dye sits on this wheel, 0–360 (3 decimals)' },
    ],
  },
  harmonySlot: {
    label: 'Harmony Slot',
    rows: [
      { name: 'index', type: 'integer', description: 'Position in the harmony type’s offset list' },
      { name: 'offset', type: 'integer', description: 'The slot’s ideal hue offset from the base, degrees 0–359' },
      { name: 'wheelHue', type: 'number', description: 'The slot’s angle on the selected wheel: (baseWheelHue + offset) mod 360' },
      { name: 'targetHue', type: 'number', description: 'The ideal colour’s sRGB/HSV hue, 0–360 — what the non-strict ranking compares dye hues to' },
      { name: 'targetHex', type: 'string', description: 'The ideal colour for the slot, carrying whatever the wheel preserves from the base (S/V, or OKLCH lightness)' },
      { name: 'dye', type: 'Dye | null', description: 'The dye chosen for the slot — a Dye Object — or null when no candidate survived the filters' },
      { name: 'distance', type: 'number | null', description: 'How far the chosen dye is from the ideal: in the method’s unit when strict, degrees of hue otherwise (see distanceUnit); null with a null dye' },
      { name: 'companions', type: 'Dye[]', description: 'Runners-up, nearest first, excluding the chosen dye — as many as ?companions= asked for' },
    ],
  },
  dye: {
    label: 'Dye Object',
    rows: [
      { name: 'itemID', type: 'integer', description: 'Legacy game item ID (equals stainID for future consolidated-only dyes)' },
      { name: 'stainID', type: 'integer', description: 'Stain table ID (1–254)' },
      { name: 'id', type: 'integer', description: 'Same as itemID' },
      { name: 'name', type: 'string', description: 'English dye name' },
      { name: 'localizedName', type: 'string?', description: 'Present only when locale ≠ en' },
      { name: 'hex', type: 'string', description: 'Hex color (#RRGGBB)' },
      { name: 'rgb', type: 'object', description: '{ r, g, b } — 0–255' },
      { name: 'hsv', type: 'object', description: '{ h, s, v } — hue 0–360, sat/val 0–100' },
      { name: 'category', type: 'string', description: 'Blues · Browns · Greens · Neutral · Purples · Reds · Special · Yellows' },
      { name: 'acquisition', type: 'string', description: 'Dye Vendor · The Firmament · Cosmic Exploration · Venture Coffers' },
      { name: 'cost', type: 'integer', description: 'Vendor price' },
      { name: 'currency', type: 'string | null', description: 'Gil · Skybuilders Scrips · Cosmocredits · Venture Coffer (one per acquisition)' },
      { name: 'isMetallic', type: 'boolean', description: 'Metallic sheen' },
      { name: 'isPastel', type: 'boolean', description: 'Pastel shade' },
      { name: 'isDark', type: 'boolean', description: 'Dark shade' },
      { name: 'isCosmic', type: 'boolean', description: 'From Cosmic Exploration' },
      { name: 'isIshgardian', type: 'boolean', description: 'From Ishgardian Restoration' },
      { name: 'consolidationType', type: 'string | null', description: 'Patch 7.5 group: A, B, C, or null' },
      {
        name: 'marketItemID',
        type: 'integer',
        description:
          'Item ID for market-board lookups only (Universalis) — never a dye lookup key. 105 dyes share 52254 / 52255 / 52256 since Patch 7.5; GET /v1/dyes/:id rejects those with a hint pointing at /v1/dyes/consolidation-groups',
      },
    ],
  },
};
