/**
 * Discord text sanitisation helpers (FINDING-019, 2026-08-21 security audit).
 *
 * Preset names / descriptions / tags, author names, `.chara` field values and
 * search queries are rendered inside bot-authored embeds. Discord renders
 * markdown and masked links there, so unsanitised user text becomes a
 * bot-voiced phishing / spoofing surface. One shared helper set, used by both
 * bots.
 */
import { describe, it, expect } from 'vitest';
import {
  escapeDiscordMarkdown,
  sanitizeEmbedText,
  sanitizeLineValue,
  ALLOWED_MENTIONS_NONE,
} from './discord-markdown.js';

describe('escapeDiscordMarkdown', () => {
  it('neutralises masked links', () => {
    const out = escapeDiscordMarkdown('[Click me](https://evil.example)');
    expect(out).not.toMatch(/\[Click me\]\(https:\/\/evil\.example\)/);
    expect(out).toContain('Click me');
    expect(out).toContain('https://evil.example');
  });

  it('escapes inline markdown characters', () => {
    expect(escapeDiscordMarkdown('*a* _b_ ~c~ `d` |e| > f # g')).toBe(
      '\\*a\\* \\_b\\_ \\~c\\~ \\`d\\` \\|e\\| \\> f \\# g',
    );
  });

  it('leaves plain text and CJK untouched', () => {
    expect(escapeDiscordMarkdown('Snow White スノウホワイト 1.5')).toBe('Snow White スノウホワイト 1.5');
  });
});

describe('sanitizeEmbedText', () => {
  it.each(['<#123>', '</cmd:123>', '<:e:123>', '<t:0>', '<id:customize>'])(
    'renders angle token %s literally after mention defusing', (token) => {
      expect(sanitizeEmbedText(token)).toBe(`\\<${escapeDiscordMarkdown(token.slice(1))}`);
      expect(sanitizeEmbedText(token).startsWith('\\<')).toBe(true);
      expect(sanitizeEmbedText('<@123> <@&456>')).toBe('@123 @456');
    },
  );

  it.each([0x061c, 0x2066, 0x2067, 0x2068, 0x2069, 0xe0000, 0xe0001, 0xe007f])(
    'strips invisible U+%i without losing ordinary astral emoji', (codePoint) => {
      expect(sanitizeEmbedText(`a${String.fromCodePoint(codePoint)}🎨b`)).toBe('a🎨b');
    },
  );

  it('keeps code points immediately outside the new invisible ranges', () => {
    const boundary = '\u061b\u061d\u2065\u206a\u{dffff}\u{e0080}🎨';
    expect(sanitizeEmbedText(boundary)).toBe(boundary);
  });

  it('strips control and zero-width characters and collapses whitespace', () => {
    expect(sanitizeEmbedText('a\u0000b​c‎  d\n\n\n e')).toBe('abc d e');
  });

  it('defuses @everyone / @here and role mentions', () => {
    const out = sanitizeEmbedText('hello @everyone and @here <@&123456789012345678>');
    expect(out).not.toContain('@everyone');
    expect(out).not.toContain('@here');
    expect(out).not.toContain('<@&');
  });

  it('escapes markdown and truncates to the requested length with an ellipsis', () => {
    const out = sanitizeEmbedText('*'.repeat(10) + 'x'.repeat(100), 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('**');
  });

  // The cap counts the ellipsis: maxLength 10 keeps nine characters plus '…'.
  it('cuts plain text to exactly maxLength code points, ellipsis included', () => {
    expect(sanitizeEmbedText('abcdefghijklmnop', 10)).toBe('abcdefghi…');
    expect(sanitizeEmbedText('abcdefghij', 10)).toBe('abcdefghij');
    // Code points, not UTF-16 units: an astral character is one of the ten.
    expect(sanitizeEmbedText('\u{1F3A8}'.repeat(12), 10)).toBe('\u{1F3A8}'.repeat(9) + '…');
  });

  // A cut that lands between an escape backslash and the character it
  // escapes would leave a backslash in front of the ellipsis, and Discord
  // would read that pair as an escaped '…'. The dangling backslash goes instead.
  it('never ends a cut on the backslash of a split escape', () => {
    expect(sanitizeEmbedText('ab*cdef', 4)).toBe('ab…');
  });

  it.each([['', 254], ['a', 254], ['ab', 252]] as const)(
    'keeps complete backslash escapes after prefix "%s" at the code-point cap', (prefix, slashes) => {
      const out = sanitizeEmbedText(prefix + '\\'.repeat(200), 256);
      expect(out).toBe(prefix + '\\'.repeat(slashes) + '…');
      expect([...out].length).toBeLessThanOrEqual(256);
      expect(out.match(/(\\+)…$/)![1].length % 2).toBe(0);
    },
  );

  it('returns an empty string for non-string input', () => {
    expect(sanitizeEmbedText(undefined as unknown as string)).toBe('');
  });
});

describe('sanitizeLineValue', () => {
  it('leaves parentheses, # and > bare, so a copied acquisition line carries no backslashes', () => {
    expect(sanitizeLineValue('Crafted (WVR Lvl. 1) / Vendor - Zone #2 > Outpost', 700)).toBe(
      'Crafted (WVR Lvl. 1) / Vendor - Zone #2 > Outpost',
    );
  });

  it('still neutralises masked links, inline markup and angle tokens', () => {
    expect(sanitizeLineValue('[Claim](https://evil.example)', 700)).toBe('\\[Claim\\](https://evil.example)');
    expect(sanitizeLineValue('*b* _i_ ~s~ `c` ||x|| a\\b', 700)).toBe(
      '\\*b\\* \\_i\\_ \\~s\\~ \\`c\\` \\|\\|x\\|\\| a\\\\b',
    );
    expect(sanitizeLineValue('<#123> <t:1:R> <:e:1>', 700)).toBe('\\<#123> \\<t:1:R> \\<:e:1>');
  });

  it('defuses mentions and collapses controls and line breaks like sanitizeEmbedText', () => {
    expect(sanitizeLineValue('a\u0000b​\r\n# Admin @everyone <@123>', 700)).toBe(
      'ab # Admin @‍everyone @123',
    );
  });

  it('caps by code points and never ends on a split escape', () => {
    expect(sanitizeLineValue('ab[cdef', 4)).toBe('ab…');
    const out = sanitizeLineValue('a' + '\\'.repeat(400), 700);
    expect(out).toBe('a' + '\\'.repeat(698) + '…');
    expect([...out]).toHaveLength(700);
  });

  it('returns an empty string for non-string input', () => {
    expect(sanitizeLineValue(undefined, 700)).toBe('');
  });
});

describe('ALLOWED_MENTIONS_NONE', () => {
  it('parses nothing', () => {
    expect(ALLOWED_MENTIONS_NONE).toEqual({ parse: [] });
  });
});
