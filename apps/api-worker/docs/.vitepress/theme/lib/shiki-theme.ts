/**
 * Two-colour code: keys in the accent text, everything else in body text, with
 * punctuation and comments in the muted grey. Markdown code fences and the
 * console card's own JSON view then read the same, so a reader meets one
 * palette for code everywhere on the site.
 */
export const xdtShikiTheme = {
  name: 'xdt-console',
  type: 'dark' as const,
  colors: {
    'editor.background': '#17171A',
    'editor.foreground': '#ECECEE',
  },
  settings: [
    { settings: { foreground: '#ECECEE', background: '#17171A' } },
    {
      scope: [
        'support.type.property-name',
        'meta.object-literal.key',
        'variable.other.property',
        'entity.name.tag',
        'entity.other.attribute-name',
        'keyword.other.http',
      ],
      settings: { foreground: '#FF6257' },
    },
    { scope: ['string'], settings: { foreground: '#FF6257' } },
    { scope: ['string.json', 'string.quoted.double.json'], settings: { foreground: '#ECECEE' } },
    { scope: ['punctuation', 'meta.brace', 'keyword.operator', 'punctuation.support.type.property-name'], settings: { foreground: '#9C9CA2' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#9C9CA2' } },
    { scope: ['constant.numeric', 'constant.language', 'keyword', 'storage'], settings: { foreground: '#ECECEE' } },
  ],
};
