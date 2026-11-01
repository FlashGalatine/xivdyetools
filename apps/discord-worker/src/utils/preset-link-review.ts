/** App-local wire view: present malformed metadata must never become null. */
export type PresetLinkMetadata = { example_link?: unknown };

export const INCOMPLETE_LINK_REVIEW =
  'Link details do not fit safely in this review. Ask the author to shorten the link before approval.';

/** Project a link onto complete, nonclickable path text. Identity stays internal. */
export function projectPresetLink(preset: PresetLinkMetadata, legacyTarget = false): {
  text: string;
  complete: boolean;
  identity?: string | null;
} {
  if (!Object.hasOwn(preset, 'example_link')) {
    return {
      text: legacyTarget ? 'Link details unavailable for this older snapshot.' : 'Link details unavailable.',
      complete: true,
    };
  }
  const raw = preset.example_link;
  if (raw === null) return { text: 'No example link.', complete: true, identity: null };
  const incomplete = { text: INCOMPLETE_LINK_REVIEW, complete: false };
  if (typeof raw !== 'string' || raw.length > 300 || /\p{Cc}/u.test(raw)) {
    return incomplete;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return incomplete;
    // Same byte-run decoding as presets-api's moderation input. Malformed
    // percent syntax stays literal; invalid UTF-8 uses visible replacement.
    const path = url.pathname.replace(/(?:%[0-9a-f]{2})+/gi, (encoded) => {
      const bytes = Uint8Array.from(encoded.match(/%[0-9a-f]{2}/gi)!, (hex) =>
        Number.parseInt(hex.slice(1), 16));
      return new TextDecoder().decode(bytes);
    });
    // One code span contains all Markdown/mentions. Escape its delimiter and
    // invisible formatting visibly, preserving every projected codepoint.
    const escaped = path.replace(
      /[`\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u2028\u2029]/gu,
      (character) => {
        const codepoint = character.codePointAt(0)!;
        return codepoint > 0xffff
          ? `\\u{${codepoint.toString(16)}}`
          : `\\u${codepoint.toString(16).padStart(4, '0')}`;
      },
    );
    const text = `\`${escaped}\``;
    return text.length <= 1024 ? { text, complete: true, identity: url.href } : incomplete;
  } catch {
    return incomplete;
  }
}
