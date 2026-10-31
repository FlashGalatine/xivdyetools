import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../migrations/0016_ban_identity_continuity.sql', import.meta.url),
  'utf8',
);
function fixture(sql = schema) {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  db.exec('PRAGMA foreign_keys=ON');
  return db;
}
function seed(db: DatabaseSync) {
  db.prepare(
    "INSERT INTO banned_users(id,discord_id,username,reason,moderator_discord_id) VALUES ('parent','123456789012345678','private','private','223456789012345678')",
  ).run();
}
describe('shipped additive schema', () => {
  it('preserves seeded old data and has identical SQLite definitions to the fresh schema', () => {
    const old = fixture(schema.split('-- Additive only.')[0]),
      fresh = fixture();
    try {
      seed(old);
      old.exec(migration);
      expect(old.prepare('SELECT username FROM banned_users').get()).toEqual({
        username: 'private',
      });
      const definitions = (db: DatabaseSync) =>
        (
          db
            .prepare('SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name')
            .all() as { name: string; sql: string }[]
        ).map((row) => ({ ...row, sql: row.sql.replace(/\r\n/g, '\n') }));
      expect(definitions(old)).toEqual(definitions(fresh));
    } finally {
      old.close();
      fresh.close();
    }
  });
  it('enforces membership FK, sources, duplicates and deletion cascade', () => {
    const db = fixture();
    try {
      seed(db);
      expect(() =>
        db.exec("INSERT INTO ban_identity_memberships VALUES ('absent','id','confirmed')"),
      ).toThrow();
      expect(() =>
        db.exec("INSERT INTO ban_identity_memberships VALUES ('parent','id','other')"),
      ).toThrow();
      db.exec("INSERT INTO ban_identity_memberships VALUES ('parent','id','confirmed')");
      expect(() =>
        db.exec("INSERT INTO ban_identity_memberships VALUES ('parent','id','continuity')"),
      ).toThrow();
      db.exec("DELETE FROM banned_users WHERE id='parent'");
      expect(db.prepare('SELECT * FROM ban_identity_memberships').all()).toEqual([]);
    } finally {
      db.close();
    }
  });
  it('enforces the effective 64-ID cap on member insert/update and legacy-column update', () => {
    const db = fixture();
    try {
      seed(db);
      const insert = db.prepare(
        "INSERT INTO ban_identity_memberships VALUES ('parent',?,'confirmed')",
      );
      for (let n = 0; n < 63; n++) insert.run(`member${n}`);
      expect(() => insert.run('overflow')).toThrow('ban scope capacity');
      expect(() => db.exec("UPDATE banned_users SET xivauth_id='new'")).toThrow(
        'ban scope capacity',
      );
      insert.run('123456789012345678');
      expect(() =>
        db.exec(
          "UPDATE ban_identity_memberships SET identity_id='new' WHERE identity_id='123456789012345678'",
        ),
      ).toThrow('ban scope capacity');
    } finally {
      db.close();
    }
  });
  it('rejects null-bypassed journal state and acknowledgement combinations', () => {
    const db = fixture();
    try {
      const insert = db.prepare(
        'INSERT INTO ban_continuity_operations(id,payload_hash,state,refusal_reason,matched_bans,expires_at,applied_at,acknowledged_at,acknowledged_outcome) VALUES (?,?,?,?,?,?,?,?,?)',
      );
      for (const fields of [
        ['applied', null, null, 1, null, null],
        ['refused', null, 0, 1, null, null],
        ['applying', null, 0, null, 1, 'complete'],
        ['applied', null, 17, 1, null, null],
        ['applied', null, 0, 1, 1, null],
        ['applied', null, 0, 1, null, 'complete'],
        ['refused', 'review_required', null, 1, null, null],
        ['refused', 'overflow', 1, 1, null, null],
      ]) {
        const [state, reason, count, at, ack, outcome] = fields;
        expect(() =>
          insert.run(
            crypto.randomUUID(),
            'a'.repeat(64),
            state,
            reason,
            count,
            900,
            at,
            ack,
            outcome,
          ),
        ).toThrow();
      }
    } finally {
      db.close();
    }
  });
  it('enforces confirmation phase/action/TTL/hash/JSON and null-safe consumed outcome', () => {
    const db = fixture();
    try {
      const insert = db.prepare(
        'INSERT INTO moderation_ban_confirmations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      );
      const valid = [
        crypto.randomUUID(),
        'actor',
        'ban',
        'new',
        'review',
        'new-parent',
        '{}',
        'a'.repeat(64),
        100,
        1000,
        null,
        null,
      ];
      expect(() => insert.run(...valid)).not.toThrow();
      for (const [index, value] of [
        [2, 'unban'],
        [4, 'select'],
        [5, null],
        [6, 'invalid'],
        [7, 'A'.repeat(64)],
        [9, 1001],
        [10, 100],
        [11, 'applied'],
      ] as const) {
        const row = [...valid];
        row[0] = crypto.randomUUID();
        row[index] = value;
        expect(() => insert.run(...row)).toThrow();
      }
    } finally {
      db.close();
    }
  });
});
