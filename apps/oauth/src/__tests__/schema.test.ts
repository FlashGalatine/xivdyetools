/**
 * Schema / migration content tests
 *
 * FINDING-001 / FINDING-002 (2026-08-29 security audit). The D1 schema is data,
 * not code, so it has no other regression net: a fresh database built from
 * `schema/users.sql` must match what the worker actually writes, and the
 * migration that brings the live database into line must stay hand-runnable
 * (D1 rejects `BEGIN TRANSACTION`).
 *
 * Every DDL assertion runs against the file with `--` comment lines stripped:
 * the headers legitimately *name* the things being removed, and matching a
 * substring against the comments would make these tests pass or fail on prose.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// og-worker 2026-08-18: pass the import.meta.url STRING — with
// @cloudflare/workers-types and @types/node both loaded, the global URL is not
// node:url's URL and fileURLToPath rejects a URL instance.
const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const readAppFile = (relativePath: string): string =>
    readFileSync(join(appRoot, relativePath), 'utf8');

/** The file's executable SQL — comment lines removed. */
const sqlOnly = (source: string): string =>
    source
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');

describe('schema/users.sql', () => {
    const schema = sqlOnly(readAppFile('schema/users.sql'));

    it('should still create the users table and its provider indexes', () => {
        expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
        expect(schema).toContain('xivauth_id TEXT');
        expect(schema).toContain('idx_users_discord_id');
        expect(schema).toContain('idx_users_xivauth_id');
    });

    it('should not declare the xivauth_characters roster table (FINDING-001)', () => {
        expect(schema).not.toContain('xivauth_characters');
        expect(schema).not.toContain('lodestone_id');
        expect(schema).not.toContain('idx_characters_user_id');
    });

    it('should not declare a write-only avatar_url column (FINDING-002)', () => {
        expect(schema).not.toContain('avatar_url');
    });
});

describe('migrations/0001_drop_xivauth_characters.sql', () => {
    const source = readAppFile('migrations/0001_drop_xivauth_characters.sql');
    const statements = sqlOnly(source);

    it('should drop the roster table and the avatar_url column', () => {
        expect(statements).toContain('DROP TABLE IF EXISTS xivauth_characters;');
        expect(statements).toContain('ALTER TABLE users DROP COLUMN avatar_url;');
    });

    it('should not wrap the statements in an explicit transaction (D1 rejects it)', () => {
        const upper = statements.toUpperCase();
        expect(upper).not.toContain('BEGIN TRANSACTION');
        expect(upper).not.toContain('COMMIT');
        expect(upper).not.toContain('ROLLBACK');
    });

    it('should document that it is hand-run after the deploy, with verification queries', () => {
        expect(source).toContain('wrangler d1 execute xivdyetools-users --remote');
        expect(source).toContain('--file=migrations/0001_drop_xivauth_characters.sql');
        expect(source).toContain('SELECT COUNT(*) FROM xivauth_characters');
        expect(source).toContain('PRAGMA table_info(users)');
        // The ordering constraint is the dangerous part: running this before the
        // deploy that stops writing would 500 every sign-in. Match the actual
        // sentence that carries it, not a bare /AFTER/ — the word also appears
        // in the "# 3. AFTER —" verification-step label, so a bare match would
        // stay green even if the ordering warning sentence itself were deleted.
        expect(source).toMatch(/RUN ONLY AFTER/);
    });

    it('should document a live precondition check before the ALTER (DROP COLUMN preconditions can drift from the checked-in schema)', () => {
        expect(source).toContain('PRAGMA index_list(users)');
        expect(source).toContain("SELECT sql FROM sqlite_master WHERE tbl_name = 'users'");
    });
});
