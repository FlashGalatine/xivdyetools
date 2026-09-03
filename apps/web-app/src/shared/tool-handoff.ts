/**
 * Sending a dye from one tool to another.
 *
 * There is exactly one copy of this grammar because every time it has been
 * copied it has gone wrong:
 *
 * - **BUG-018** — Budget's four hand-offs all sent `{ dye: dye.name }`. No
 *   receiver has read a dye *name* since the 5.0 id rewrite, so one passed the
 *   right key with an unparseable value and three passed a key nobody reads.
 * - **BUG-012** — Result Card's "Inspect in → Harmony" sent an `itemID`, which
 *   `ShareService.resolveSharedDye` refuses for every id `>= 5729`; all 125
 *   dyes have itemIDs in 5729–48227, so it failed every time.
 * - **2026-09-03 review** — the same `itemID` bug survived at Gradient's two
 *   context actions, and Harmony's three "send to" actions passed `add=`,
 *   a key **no tool in this app reads at all**.
 *
 * Four tools now hand dyes to each other. A fifth private copy of the table is
 * the next instance of this bug, so the table lives here.
 *
 * @module shared/tool-handoff
 */

import type { Dye } from '@xivdyetools/types';
// Via the barrel, not `@services/router-service` directly: the components that
// call this resolve RouterService through `@services/index`, and so do the
// mocks in their tests. Importing the module directly gives this file a second
// instance that no component test can intercept — the hand-off then silently
// does nothing under test while looking correct.
import { RouterService } from '@services/index';

/**
 * The query-param name each hand-off target reads a dye from.
 *
 * Keep this table next to the receivers it mirrors — each was read off the
 * consumer, not assumed:
 *
 * | target          | reads                                    | at |
 * |-----------------|------------------------------------------|----|
 * | `harmony`       | `params.get('dye') ?? params.get('dyeId')` | `harmony-tool.ts` |
 * | `comparison`    | `params.dyes` (array; see `LIST_PARAMS`)   | `comparison-tool.ts` |
 * | `accessibility` | `params.dyes` (array; see `LIST_PARAMS`)   | `accessibility-tool.ts` |
 * | `mixer`         | `params.dyeA`                              | `mixer-tool.ts` |
 *
 * `comparison` and `accessibility` take a LIST. `ShareService`'s `LIST_PARAMS`
 * makes `dyes` array-valued even for a single id (BUG-015), so one dye is a
 * valid hand-off and arrives as `[id]` rather than a bare number.
 */
export const HANDOFF_PARAM = {
  harmony: 'dye',
  comparison: 'dyes',
  accessibility: 'dyes',
  mixer: 'dyeA',
} as const;

/** A tool that can receive a dye from another tool. */
export type HandoffTarget = keyof typeof HANDOFF_PARAM;

/**
 * Send a dye to another tool using that tool's own param grammar.
 *
 * The value is always a **stainID**. `ShareService.resolveSharedDye` treats any
 * id `>= 5729` as a pre-5.0 item id and refuses it with a toast, so an itemID
 * here does not degrade — it fails outright, for every dye.
 *
 * A dye with no stainID (a custom colour) is not navigated at all: not moving
 * beats moving and then apologising for it.
 */
export function handoffTo(tool: HandoffTarget, dye: Dye): void {
  if (dye.stainID === null) return;
  RouterService.navigateTo(tool, { [HANDOFF_PARAM[tool]]: String(dye.stainID) });
}
