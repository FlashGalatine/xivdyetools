/**
 * Discord text sanitisation helpers
 *
 * FINDING-019 (2026-08-21 security audit): preset names / descriptions /
 * tags, author names, `.chara` field values and search queries are rendered
 * inside bot-authored embeds. Discord renders markdown and masked links
 * there, so unsanitised user text becomes a bot-voiced phishing / spoofing
 * surface, and `@everyone` / role mentions in message content ping people.
 * Both bots import these instead of re-implementing them.
 *
 * @module discord-markdown
 */

/** Discord inline-markdown characters that need a backslash to render literally. */
const MARKDOWN_SPECIALS = /([*_~`|>#\\[\]()])/g;

/**
 * C0/C1 controls (whitespace is collapsed separately), zero-width and
 * bidi-control code points. Written with escapes — raw control characters in
 * a regex literal do not survive every transform.
 */
const INVISIBLE = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F' +
    '\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]',
  'g',
);

/** Zero-width joiner — inserted after `@` to defuse mass mentions. */
const ZWJ = '‍';

/**
 * Escape Discord markdown so user text renders literally: `*`, `_`, `~`,
 * backtick, `|`, `>`, `#`, backslash and the `[text](url)` masked-link syntax.
 * The characters stay visible (a URL is still readable), they just stop being
 * markup.
 */
export function escapeDiscordMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIALS, '\\$1');
}

/**
 * Defuse mass mentions without destroying the words: `@everyone` / `@here`
 * get a zero-width joiner after the `@`, `<@…>` user/role mentions lose their
 * angle brackets.
 */
function defuseMentions(text: string): string {
  return text
    .replace(/@(everyone|here)/gi, `@${ZWJ}$1`)
    .replace(/<@[!&]?(\d+)>/g, '@$1');
}

/**
 * Make one user-sourced string safe to put inside an embed field/title or a
 * message body: strip control / zero-width / bidi characters, collapse
 * whitespace, defuse mentions, escape markdown, and cap the length (with an
 * ellipsis) so a single value cannot blow Discord's field limits.
 *
 * @param text  anything — non-strings yield ''
 * @param maxLength  code-point cap INCLUDING the ellipsis (default 256)
 */
export function sanitizeEmbedText(text: unknown, maxLength = 256): string {
  if (typeof text !== 'string') return '';
  const cleaned = defuseMentions(text.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim());
  const escaped = escapeDiscordMarkdown(cleaned);
  const chars = [...escaped];
  if (maxLength <= 0 || chars.length <= maxLength) return escaped;
  // Do not end on a dangling backslash that would escape the ellipsis
  let cut = chars.slice(0, Math.max(0, maxLength - 1)).join('');
  if (cut.endsWith('\\')) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * `allowed_mentions` payload that lets nothing ping: spread it into every
 * outbound message / follow-up / edit body.
 */
export const ALLOWED_MENTIONS_NONE = { parse: [] as string[] } as const;
