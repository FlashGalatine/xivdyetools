/**
 * The `.chara` attachment guards `/swatch` and `/glamour` share — and the
 * language their refusals speak (HC-002, 2026-10-04 i18n audit). Each guard
 * used to put an English reason ("file too large (N bytes)", "download failed
 * (404)") into the translated frame, so a German reader got
 * "Datei nicht lesbar — file too large (2097152 bytes)". Every reason is a
 * bot-logic key now, in the reader's locale.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator, type Translator } from '@xivdyetools/bot-logic/i18n';
import { checkCharaAttachment, downloadCharaAttachment } from './chara-attachment.js';
import type { DiscordInteraction } from '../types/env.js';

const CDN_URL = 'https://cdn.discordapp.com/attachments/1/2/look.chara';
const MAX_FILE_BYTES = 1_048_576;

function makeInteraction(url: string, size = 2048): DiscordInteraction {
  return {
    id: 'int-1',
    application_id: 'app-1',
    type: 2,
    token: 'token-1',
    data: {
      name: 'swatch',
      options: [{ name: 'file', type: 11, value: 'att-1' }],
      resolved: {
        attachments: {
          'att-1': { id: 'att-1', filename: 'look.chara', size, url, proxy_url: url, content_type: 'application/json' },
        },
      },
    },
  } as unknown as DiscordInteraction;
}

const en = createTranslator('en');
const de = createTranslator('de');

/** The frame every refusal shares, around one reason key. */
const refusal = (t: Translator, reason: string, vars?: Record<string, string | number>): string =>
  t.t('card.swatchParseError', { message: t.t(`card.charaFileReason.${reason}`, vars) });

/** The English reasons every locale printed before HC-002. */
const OLD_ENGLISH = /file too large|attachment must be uploaded|download failed \(\d/;

describe('the reasons', () => {
  it.each(['tooLarge', 'notOnDiscord', 'downloadFailed', 'unreadable'])('%s is a real key in en', (reason) => {
    expect(en.t(`card.charaFileReason.${reason}`)).not.toBe(`card.charaFileReason.${reason}`);
  });
});

describe('checkCharaAttachment', () => {
  it('passes an attachment on the Discord CDN under the cap', () => {
    expect(checkCharaAttachment(makeInteraction(CDN_URL), de)).toEqual({ ok: true, url: CDN_URL });
  });

  it('asks for the file when the option names no attachment', () => {
    const interaction = makeInteraction(CDN_URL);
    interaction.data!.options = [];
    expect(checkCharaAttachment(interaction, de)).toEqual({ ok: false, message: de.t('errors.missingInput') });
  });

  it('says a file past the cap is too large, in English…', () => {
    const result = checkCharaAttachment(makeInteraction(CDN_URL, 2 * MAX_FILE_BYTES), en);
    expect(result).toEqual({ ok: false, message: 'Could not read the file — it is larger than 1 MB' });
  });

  it('…and in the reader’s language, with no English reason inside', () => {
    const result = checkCharaAttachment(makeInteraction(CDN_URL, 2 * MAX_FILE_BYTES), de);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.message).toBe(refusal(de, 'tooLarge', { mb: 1 }));
    expect(result.message).not.toMatch(OLD_ENGLISH);
  });

  it('refuses a file that is not on a Discord CDN host in the reader’s language', () => {
    const result = checkCharaAttachment(makeInteraction('https://evil.example/look.chara'), de);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.message).toBe(refusal(de, 'notOnDiscord'));
    expect(result.message).not.toMatch(OLD_ENGLISH);
  });
});

describe('downloadCharaAttachment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the text of a file the CDN hands over', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"REyeColor":42}')));
    expect(await downloadCharaAttachment(CDN_URL, de)).toEqual({ ok: true, text: '{"REyeColor":42}' });
  });

  it('names the status of a refused download in the reader’s language', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gone', { status: 403 })));
    const result = await downloadCharaAttachment(CDN_URL, de);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.message).toBe(refusal(de, 'downloadFailed', { status: 403 }));
    expect(result.message).toContain('403');
    expect(result.message).not.toMatch(OLD_ENGLISH);
  });

  it('says a body past the cap is too large in the reader’s language', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(MAX_FILE_BYTES + 1))));
    const result = await downloadCharaAttachment(CDN_URL, de);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.message).toBe(refusal(de, 'tooLarge', { mb: 1 }));
    expect(result.message).not.toMatch(OLD_ENGLISH);
  });
});
