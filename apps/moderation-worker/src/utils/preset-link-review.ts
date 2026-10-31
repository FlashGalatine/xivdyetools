import { createTranslator } from '@xivdyetools/bot-logic/i18n';

const adminT = createTranslator('en');
export const CURRENT_LINK_FIELD = adminT.t('about.links');
export const REVERT_LINK_FIELD = 'Revert link';
export const INCOMPLETE_LINK_REVIEW =
  'Link details do not fit safely in this review. Ask the author to shorten the link before approval.';

/** Project only the producer-reviewed pathname; never include other URL components. */
export function projectReviewLink(
  source: unknown,
  legacyTarget = false,
): {
  value: string;
  safe: boolean;
  known: boolean;
} {
  if (!source || typeof source !== 'object' || !Object.hasOwn(source, 'example_link')) {
    return {
      value: legacyTarget
        ? 'Link details unavailable for this older snapshot.'
        : 'Link details unavailable.',
      safe: true,
      known: false,
    };
  }
  const link: unknown = (source as { example_link: unknown }).example_link;
  if (link === null) return { value: 'No example link.', safe: true, known: true };
  const invalid = { value: INCOMPLETE_LINK_REVIEW, safe: false, known: true };
  if (typeof link !== 'string' || link.length > 300 || /[\p{Cc}]/u.test(link)) return invalid;
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return invalid;
    const path = url.pathname.replace(/(?:%[0-9a-f]{2})+/gi, (encoded) => {
      const bytes = Uint8Array.from(encoded.match(/%[0-9a-f]{2}/gi)!, (hex) =>
        Number.parseInt(hex.slice(1), 16),
      );
      return new TextDecoder().decode(bytes);
    });
    const escaped = path.replace(
      /[`\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u2028\u2029]/gu,
      (char) => {
        const point = char.codePointAt(0)!;
        return point <= 0xffff
          ? `\\u${point.toString(16).padStart(4, '0')}`
          : `\\u{${point.toString(16)}}`;
      },
    );
    const value = `\`${escaped}\``;
    return value.length <= 1024 ? { value, safe: true, known: true } : invalid;
  } catch {
    return invalid;
  }
}

/** Full URL identity is used only here; it never enters a returned review message. */
export function linkChangeSummary(
  current: { example_link?: string | null },
  previous: { example_link?: string | null },
): string[] {
  const next = projectReviewLink(current);
  const before = projectReviewLink(previous);
  if (!next.known || !before.known || !next.safe || !before.safe) return [];
  const identity = (link: string | null | undefined): string | null =>
    link ? new URL(link).href : null;
  if (identity(current.example_link) === identity(previous.example_link)) return [];
  return [
    next.value === before.value
      ? 'Link path is unchanged; other URL parts changed and are not shown.'
      : 'Link changed; only path text is shown.',
  ];
}
