import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getPlatformProxy } = require('wrangler') as typeof import('wrangler');

/** Local-only workerd D1 using current schema, including complete trigger bodies. */
export async function createD1Runtime() {
  const directory = mkdtempSync(join(tmpdir(), 'xivdyetools-test-d1-'));
  const configPath = join(directory, 'wrangler.toml');
  writeFileSync(
    configPath,
    `name = "xivdyetools-local-d1-test"\ncompatibility_date = "2026-10-01"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "local-test-only"\ndatabase_id = "${crypto.randomUUID()}"\n`,
  );
  const schemaDb = new DatabaseSync(':memory:');
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>> | undefined;
  function cleanupFiles() {
    unlinkSync(configPath);
    rmdirSync(directory);
  }
  try {
    schemaDb.exec(
      readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url).toString()), 'utf8'),
    );
    proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath,
      remoteBindings: false,
      envFiles: [],
      persist: false,
    });
    const db = proxy.env.DB;
    // SQLite parses the real schema; introspection yields complete CREATEs,
    // avoiding semicolon-splitting which would corrupt the revision trigger.
    const definitions = schemaDb
      .prepare(
        `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
      ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, rowid`,
      )
      .all() as { sql: string }[];
    await db.batch(definitions.map(({ sql }) => db.prepare(sql)));
    const categories = schemaDb
      .prepare('SELECT id,name,description,icon,is_curated,display_order FROM categories')
      .all();
    await db.batch(
      categories.map((row) =>
        db
          .prepare(
            'INSERT INTO categories (id,name,description,icon,is_curated,display_order) VALUES (?,?,?,?,?,?)',
          )
          .bind(row.id, row.name, row.description, row.icon, row.is_curated, row.display_order),
      ),
    );
    const activeProxy = proxy;
    return {
      db,
      async dispose() {
        try {
          await activeProxy.dispose();
        } finally {
          cleanupFiles();
        }
      },
    };
  } catch (error) {
    try {
      await proxy?.dispose();
    } finally {
      cleanupFiles();
    }
    throw error;
  } finally {
    schemaDb.close();
  }
}
