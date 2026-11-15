// Shared export boundary. Subject identifiers and records must remain in memory.
export const MIN_SUBJECTS = 5;
export class InvalidInput extends Error {}
export function requireInput(condition) {
  if (!condition) throw new InvalidInput();
}
export function count(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid count');
  return value;
}
export function identity(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid identity');
  return value.trim().toLowerCase();
}
export function array(value) {
  if (!Array.isArray(value)) throw new Error('Invalid collection');
  return value;
}
export function text(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error('Invalid text');
  return value;
}
export function result(mode, requested, succeeded, failed, metrics) {
  return { schemaVersion: 2, mode, requested: count(requested), succeeded: count(succeeded), failed: count(failed), suppressed: metrics === null, metrics };
}
export function followerBands(subjects) {
  const bands = { under100: 0, '100to999': 0, '1000plus': 0 };
  for (const value of subjects.values()) {
    count(value);
    bands[value < 100 ? 'under100' : value < 1000 ? '100to999' : '1000plus']++;
  }
  // Suppress the WHOLE histogram, including its total, to prevent complementary disclosure.
  if (subjects.size < MIN_SUBJECTS || Object.values(bands).some((n) => n > 0 && n < MIN_SUBJECTS)) return null;
  return { followerBands: bands };
}
export const share = (part, whole) => whole ? Math.round((10000 * part) / whole) / 100 : 0;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function safeCli(run) {
  try {
    const out = await run();
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  } catch (error) {
    // Never serialize an exception, upstream body, CLI token, path or account identifier.
    process.stderr.write(error instanceof InvalidInput ? 'Invalid input.\n' : 'Collection failed.\n');
    process.exitCode = error instanceof InvalidInput ? 2 : 1;
  }
}
