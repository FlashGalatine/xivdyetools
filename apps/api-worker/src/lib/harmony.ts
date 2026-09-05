/**
 * Response shapes for the colour-wheel and harmony routes.
 *
 * Everything here reads core's wheel registry and harmony selector; the API
 * holds no wheel list, no offsets table and no hue maths of its own.
 */

import {
  COLOR_WHEEL_TAGS,
  DEFAULT_COLOR_WHEEL,
  LocalizationService,
} from '@xivdyetools/core';
import type { ColorWheelId, HarmonySlot } from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { serializeDye, localizedNameFor } from './dye-serializer.js';
import type { ApiDye } from './dye-serializer.js';
import { harmonyLocaleKey } from './validation.js';

/** A wheel as the list and the harmony response describe it. */
export interface ApiWheelSummary {
  id: ColorWheelId;
  /** Short untranslated token, the one the OG cards print */
  tag: string;
  /** Localized display name */
  name: string;
  isDefault: boolean;
}

export function serializeWheelSummary(id: ColorWheelId, locale: string): ApiWheelSummary {
  return {
    id,
    tag: COLOR_WHEEL_TAGS[id],
    name: LocalizationService.getColorWheelName(id, locale as never),
    isDefault: id === DEFAULT_COLOR_WHEEL,
  };
}

export function localizedHarmonyTypeName(harmonyType: string, locale: string): string {
  return LocalizationService.getHarmonyType(harmonyLocaleKey(harmonyType) as never, locale as never);
}

/** A dye's position on one wheel — the `/v1/wheels/:id` table row. */
export interface ApiWheelPosition {
  stainID: number | null;
  itemID: number;
  name: string;
  localizedName?: string;
  hex: string;
  wheelHue: number;
}

export function serializeWheelPosition(dye: Dye, wheelHue: number, locale: string): ApiWheelPosition {
  const localizedName = localizedNameFor(dye, locale);
  return {
    stainID: dye.stainID,
    itemID: dye.itemID,
    name: dye.name,
    ...(localizedName && { localizedName }),
    hex: dye.hex,
    wheelHue: round3(wheelHue),
  };
}

/** One harmony slot as the API returns it: core's `HarmonySlot`, dyes serialized, `deviance` → `distance`. */
export interface ApiHarmonySlot {
  index: number;
  offset: number;
  wheelHue: number;
  targetHue: number;
  targetHex: string;
  dye: ApiDye | null;
  /** In the method's unit when `strict`, degrees of hue otherwise; `null` when no dye was available */
  distance: number | null;
  companions: ApiDye[];
}

export function serializeHarmonySlot(slot: HarmonySlot, locale: string): ApiHarmonySlot {
  return {
    index: slot.index,
    offset: slot.offset,
    wheelHue: round3(slot.wheelHue),
    targetHue: round3(slot.targetHue),
    targetHex: slot.targetHex,
    dye: slot.dye ? serializeDye(slot.dye, localizedNameFor(slot.dye, locale)) : null,
    distance: slot.dye ? Math.round(slot.deviance * 10000) / 10000 : null,
    companions: slot.companions.map((d) => serializeDye(d, localizedNameFor(d, locale))),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
