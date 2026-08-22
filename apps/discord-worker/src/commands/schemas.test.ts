/**
 * Schema ↔ runtime parity checks for option choice lists that the handlers
 * resolve against a data table at run time. A choice Discord offers that the
 * table does not know is a guaranteed "could not find …" error for the user.
 */

import { describe, it, expect } from 'vitest';
import { commands as COMMAND_SCHEMAS } from './schemas.js';
import { QUICK_PICKS } from '../services/budget/quick-picks.js';

type Choice = { name: string; value: string | number };
type Option = { name: string; options?: Option[]; choices?: Choice[] };

function findOption(path: string[], options: Option[] | undefined): Option | undefined {
  const [head, ...rest] = path;
  const hit = options?.find((o) => o.name === head);
  return rest.length === 0 ? hit : findOption(rest, hit?.options);
}

describe('/budget quick preset choices', () => {
  it('offer exactly the QUICK_PICKS the handler can resolve (getQuickPickById)', () => {
    const budget = COMMAND_SCHEMAS.find((c) => c.name === 'budget') as unknown as Option;
    const preset = findOption(['quick', 'preset'], budget.options);
    expect(preset?.choices, '/budget quick preset has no choices').toBeDefined();

    const offered = preset!.choices!.map((c) => String(c.value)).sort();
    const resolvable = QUICK_PICKS.map((p) => p.id).sort();
    expect(offered).toEqual(resolvable);
    // Discord caps a choice list at 25 entries.
    expect(offered.length).toBeLessThanOrEqual(25);
  });
});
