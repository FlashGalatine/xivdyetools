/**
 * FINDING-031 (2026-10-03 security audit): the content-revision trigger exists
 * twice — hand-applied in migrations/0014 and again in schema.sql, which is
 * what every revision test builds its database from. Nothing tied the two
 * together, so the copy production runs could drift from the copy the tests
 * prove. This extracts both bodies and requires them to be identical.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (relative: string): string =>
  readFileSync(join(__dirname, '..', relative), 'utf-8').replace(/\r\n/g, '\n');

const TRIGGER_NAME = 'presets_content_revision_after_update';

/** The CREATE TRIGGER statement, whitespace-collapsed and without IF NOT EXISTS. */
function extractTrigger(sql: string): string | undefined {
  // Strip line comments first so a comment between statements cannot leak in.
  const code = sql.replace(/--[^\n]*/g, '');
  const match = code.match(
    new RegExp(`CREATE TRIGGER (?:IF NOT EXISTS )?${TRIGGER_NAME}\\b[\\s\\S]*?\\bEND;`)
  );
  return match?.[0].replace(/IF NOT EXISTS\s+/g, '').replace(/\s+/g, ' ').trim();
}

describe(`${TRIGGER_NAME} parity`, () => {
  const migration = extractTrigger(read('migrations/0014_add_content_revision.sql'));
  const schema = extractTrigger(read('schema.sql'));

  it('is present in both migration 0014 and schema.sql', () => {
    expect(migration).toContain(`CREATE TRIGGER ${TRIGGER_NAME}`);
    expect(schema).toContain(`CREATE TRIGGER ${TRIGGER_NAME}`);
  });

  it('has the same body in migration 0014 and schema.sql', () => {
    expect(schema).toBe(migration);
  });

  it('extracts the whole statement, through its closing END', () => {
    expect(migration).toMatch(/BEGIN UPDATE presets SET content_revision = OLD\.content_revision \+ 1 WHERE id = NEW\.id; END;$/);
  });

  it('normalizes away only whitespace and IF NOT EXISTS (a real difference is still caught)', () => {
    const base = read('migrations/0014_add_content_revision.sql');
    const drifted = base.replace('NEW.status IS NOT OLD.status', 'NEW.status IS OLD.status');
    expect(extractTrigger(drifted)).not.toBe(schema);
  });
});
