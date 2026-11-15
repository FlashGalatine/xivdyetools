import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Maintenance output boundary; filesystem write failures are not transactional. */
export async function writeAcquisitionOutput(
  directory: string,
  output: { acquisition: string; facewear: string; meta: string },
  review: () => Promise<void>,
): Promise<void> {
  await review();
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'acquisition.en.json'), output.acquisition);
  writeFileSync(join(directory, 'facewear-unlocks.json'), output.facewear);
  writeFileSync(join(directory, 'acquisition.meta.json'), output.meta);
}
