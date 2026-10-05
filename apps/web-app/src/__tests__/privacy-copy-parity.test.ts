/**
 * XIV Dye Tools - Sign-in privacy copy parity
 *
 * The sign-in modal's `preset.privacyNote` and PRIVACY.md both describe the
 * account record the oauth worker writes on first login. Nothing tied the copy
 * to the code, so the copy said "No character data" while the worker stored
 * the verified character's name (2026-10-03 security audit, FINDING-004).
 *
 * This reads the oauth handler's source and pins the copy to what it stores:
 * while the code keeps a field, the documents must say so. If one of these
 * fails, the code changed (or the copy did) - update the document named in the
 * message, or the code, so they agree again.
 *
 * Regexes, not exact lines, so reformatting the handler does not break it.
 *
 * @module __tests__/privacy-copy-parity.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const XIVAUTH_SRC = readFileSync(resolve(APP_ROOT, '../oauth/src/handlers/xivauth.ts'), 'utf-8');
const PRIVACY_MD = readFileSync(resolve(APP_ROOT, 'PRIVACY.md'), 'utf-8');
const EN = JSON.parse(readFileSync(resolve(APP_ROOT, 'src/locales/en.json'), 'utf-8')) as {
  preset: { privacyNote: string };
};
const NOTE = EN.preset.privacyNote;
// PRIVACY.md wraps lines, so compare against whitespace-collapsed text.
const PRIVACY = PRIVACY_MD.replace(/\s+/g, ' ');
const TERMS = readFileSync(resolve(APP_ROOT, 'TERMS_OF_SERVICE.md'), 'utf-8').replace(/\s+/g, ' ');
// The fallback label is stored verbatim, so every translation quotes it in English.
const NOTES_BY_LOCALE = Object.fromEntries(
  ['en', 'ja', 'de', 'fr', 'ko', 'zh'].map((lc) => {
    const locale = JSON.parse(
      readFileSync(resolve(APP_ROOT, `src/locales/${lc}.json`), 'utf-8')
    ) as { preset: { privacyNote: string } };
    return [lc, locale.preset.privacyNote];
  })
);

const STORES_CHARACTER_NAME = /verifiedCharacter\s*\?\.\s*name/.test(XIVAUTH_SRC);
const STORES_LINKED_DISCORD_ID = /discord_id\s*:\s*linkedDiscordId/.test(XIVAUTH_SRC);
const STORES_FALLBACK_NAME = /XIVAuth User \$\{[^}]*\.slice\(\s*0\s*,\s*8\s*\)\s*\}/.test(
  XIVAUTH_SRC
);

describe('sign-in privacy copy matches what the oauth worker stores', () => {
  it('detects the handler behaviours it pins (guards against a silently vacuous test)', () => {
    expect(
      STORES_CHARACTER_NAME,
      'apps/oauth/src/handlers/xivauth.ts changed shape: update the regexes'
    ).toBe(true);
    expect(
      STORES_LINKED_DISCORD_ID,
      'apps/oauth/src/handlers/xivauth.ts changed shape: update the regexes'
    ).toBe(true);
    expect(
      STORES_FALLBACK_NAME,
      'apps/oauth/src/handlers/xivauth.ts changed shape: update the regexes'
    ).toBe(true);
  });

  it('en preset.privacyNote mentions the verified character while the worker stores its name', () => {
    if (!STORES_CHARACTER_NAME) return;
    expect(
      /verified character/i.test(NOTE),
      'xivauth.ts stores the verified character name: update preset.privacyNote in apps/web-app/src/locales/en.json (and the other locales) to say so'
    ).toBe(true);
    expect(
      /no character data/i.test(NOTE),
      'xivauth.ts stores the verified character name: remove "No character data" from preset.privacyNote in apps/web-app/src/locales/en.json'
    ).toBe(false);
  });

  it('en preset.privacyNote mentions a Discord ID while the worker stores a linked one', () => {
    if (!STORES_LINKED_DISCORD_ID) return;
    expect(
      /discord id/i.test(NOTE),
      'xivauth.ts stores a linked Discord ID: update preset.privacyNote in apps/web-app/src/locales/en.json to mention the Discord ID'
    ).toBe(true);
  });

  it('PRIVACY.md documents the "XIVAuth User" fallback name and its first 8 characters', () => {
    if (!STORES_FALLBACK_NAME) return;
    expect(
      PRIVACY.includes('XIVAuth User'),
      'xivauth.ts falls back to "XIVAuth User <id>": update apps/web-app/PRIVACY.md to name the fallback'
    ).toBe(true);
    expect(
      PRIVACY.includes('first 8 characters'),
      'xivauth.ts slices the XIVAuth id to 8 characters: update apps/web-app/PRIVACY.md to say "first 8 characters"'
    ).toBe(true);
  });

  it('every preset.privacyNote and the Terms name the "XIVAuth User" fallback', () => {
    if (!STORES_FALLBACK_NAME) return;
    for (const [lc, note] of Object.entries(NOTES_BY_LOCALE)) {
      expect(
        note.includes('XIVAuth User'),
        `xivauth.ts falls back to "XIVAuth User <id>": update preset.privacyNote in apps/web-app/src/locales/${lc}.json to name the fallback`
      ).toBe(true);
    }
    expect(
      TERMS.includes('XIVAuth User'),
      'xivauth.ts falls back to "XIVAuth User <id>": update apps/web-app/TERMS_OF_SERVICE.md (Accounts) to name the fallback'
    ).toBe(true);
  });
});
