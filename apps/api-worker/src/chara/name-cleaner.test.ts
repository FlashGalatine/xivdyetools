import { describe, expect, it } from 'vitest';
import { cleanName } from './xivapi';

describe('bounded shared name cleaning', () => {
  it.each([undefined, null, 1, {}, ''])('rejects non names: %s', (value) => {
    expect(cleanName(value)).toBe('');
  });
  it('preserves whitespace boundaries and removes every unsafe control class', () => {
    expect(cleanName(' A\r\n\tB\u00ad\u0000\u001f\u007f\u0085\u009f\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069 C ')).toBe('A B C');
  });
  it('collapses whitespace exposed by stripping controls', () => {
    expect(cleanName('A \u200e B')).toBe('A B');
    expect(cleanName('A\u0085B')).toBe('A B');
  });
  it.each(['😀', '漢'])('caps at 128 Unicode code points without splitting %s', (char) => {
    expect(cleanName(char.repeat(128))).toBe(char.repeat(128));
    expect(cleanName(char.repeat(129))).toBe(char.repeat(128));
  });
  it('preserves ordinary multilingual, combining, and joiner text', () => {
    expect(cleanName('한국 中文 日本語 e\u0301 👩‍💻')).toBe('한국 中文 日本語 e\u0301 👩‍💻');
  });
});
