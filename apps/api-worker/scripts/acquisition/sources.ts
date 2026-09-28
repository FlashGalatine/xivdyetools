/**
 * Stage 1 of the acquisition build: every raw route the data knows for one
 * item, before any rule removes or rewrites one. Order does not matter here;
 * `format.ts` sorts.
 */

import type { Inputs, Source } from './model.js';

export function collectSources(itemId: number, inputs: Inputs): Source[] {
  const out: Source[] = [];
  const saga = inputs.relics.get(itemId);
  if (saga) out.push({ kind: 'relic', saga });
  for (const dutyId of inputs.duties.get(itemId) ?? []) out.push({ kind: 'duty', dutyId });
  for (const questId of inputs.quests.get(itemId) ?? []) out.push({ kind: 'quest', questId });
  for (const fate of inputs.fates.get(itemId) ?? []) out.push({ kind: 'fate', ...fate });
  for (const name of inputs.achievements.get(itemId) ?? []) out.push({ kind: 'achievement', name });
  for (const recipe of inputs.recipes.get(itemId) ?? []) out.push({ kind: 'craft', ...recipe });
  for (const offer of inputs.offers.get(itemId) ?? []) out.push({ kind: 'offer', offer });
  for (const containerId of inputs.containers.get(itemId) ?? []) out.push({ kind: 'container', containerId });
  for (const voyage of inputs.voyages.get(itemId) ?? []) out.push({ kind: 'voyage', voyage });
  for (const desynth of inputs.desynth.get(itemId) ?? []) out.push({ kind: 'desynth', ...desynth });
  if (inputs.onlineStore.has(itemId)) out.push({ kind: 'onlineStore' });
  return out;
}
