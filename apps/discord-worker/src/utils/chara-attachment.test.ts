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
const MAX_FILE_BYTES = 8_192;

function makeInteraction(url: string, size = 2048, filename = 'look.chara'): DiscordInteraction {
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
          'att-1': { id: 'att-1', filename, size, url, proxy_url: url, content_type: 'application/json' },
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
  it.each(['tooLarge', 'notChara', 'notOnDiscord', 'downloadFailed', 'unreadable'])('%s is a real key in en', (reason) => {
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
    expect(result).toEqual({ ok: false, message: 'Could not read the file — it is larger than 8 KB; if you attached an image in Anamnesis, save the character again without it' });
  });

  it('…and in the reader’s language, with no English reason inside', () => {
    const result = checkCharaAttachment(makeInteraction(CDN_URL, 2 * MAX_FILE_BYTES), de);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.message).toBe(refusal(de, 'tooLarge', { kb: 8 }));
    expect(result.message).not.toMatch(OLD_ENGLISH);
  });

  it('passes a file exactly at the 8 KiB cap and refuses one byte more', () => {
    expect(checkCharaAttachment(makeInteraction(CDN_URL, MAX_FILE_BYTES), en).ok).toBe(true);
    expect(checkCharaAttachment(makeInteraction(CDN_URL, MAX_FILE_BYTES + 1), en).ok).toBe(false);
  });

  /**
   * FINDING-003 (2026-10-15 import review): a `.pose` was downloaded and
   * parsed before it failed. The filename decides, case-insensitive; the
   * MIME type Discord guessed and the CDN URL do not.
   */
  it.each(['Trick & Treat Duo (L).pose', 'look.png', 'look.chara.txt', 'look.json', 'chara'])(
    'refuses %s by name, before the size or host checks',
    (filename) => {
      // Oversized and off-CDN too: the name is checked first
      const result = checkCharaAttachment(makeInteraction('https://evil.example/x', 2 * MAX_FILE_BYTES, filename), de);
      expect(result).toEqual({ ok: false, message: refusal(de, 'notChara') });
    },
  );

  it.each(['look.chara', 'LOOK.CHARA', 'look.Chara', 'look.pose.chara'])('passes %s', (filename) => {
    expect(checkCharaAttachment(makeInteraction(CDN_URL, 2048, filename), en)).toEqual({ ok: true, url: CDN_URL });
  });

  it('passes a .chara whatever MIME type Discord reports, or none', () => {
    const interaction = makeInteraction(CDN_URL);
    const attachment = interaction.data!.resolved!.attachments!['att-1']!;
    for (const contentType of [undefined, 'application/octet-stream', 'text/plain; charset=utf-8']) {
      attachment.content_type = contentType;
      expect(checkCharaAttachment(interaction, en).ok).toBe(true);
    }
  });

  it('says a wrong file type in English and in the reader’s language', () => {
    expect(checkCharaAttachment(makeInteraction(CDN_URL, 2048, 'look.pose'), en)).toEqual({
      ok: false,
      message: 'Could not read the file — it must be a .chara file',
    });
    const result = checkCharaAttachment(makeInteraction(CDN_URL, 2048, 'look.pose'), de);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.message).not.toContain('must be a .chara');
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

  it('reads a body exactly at the cap', async () => {
    const text = 'x'.repeat(MAX_FILE_BYTES);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(text)));
    expect(await downloadCharaAttachment(CDN_URL, de)).toEqual({ ok: true, text });
  });

  it('says a body past the cap is too large in the reader’s language', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(MAX_FILE_BYTES + 1))));
    const result = await downloadCharaAttachment(CDN_URL, de);
    if (result.ok) throw new Error('expected a refusal');
    expect(result.message).toBe(refusal(de, 'tooLarge', { kb: 8 }));
    expect(result.message).not.toMatch(OLD_ENGLISH);
  });
});
