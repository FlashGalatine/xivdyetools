/**
 * Local-search indexing for the console cards (node side, build time only).
 *
 * The parameter tables live in `<EndpointCard :params="[…]">` attributes and
 * the Dye Object in `theme/lib/fields.ts`, so VitePress's local search — which
 * indexes rendered Markdown and strips every tag — would never see a parameter
 * name or a field. Before the page is indexed, each card tag is expanded into
 * plain Markdown under its own `## METHOD /path` heading: the summary, one
 * line per parameter, and the folded field table when the card carries one.
 * The rendered page is untouched; only the index reads this.
 */
import { FIELD_SETS } from './theme/lib/fields'

const CARD_RE = /<EndpointCard\b([\s\S]*?)\/>/g
const PARAM_RE = /\{\s*name:\s*'([^']+)'[^}]*?description:\s*'((?:[^'\\]|\\.)*)'/g

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m?.[1]
}

export function expandCardsForSearch(src: string): string {
  return src.replace(CARD_RE, (_whole, inner: string) => {
    const lines: string[] = []
    const summary = attr(inner, 'summary')
    if (summary) lines.push(summary)

    const params: string[] = []
    for (const m of inner.matchAll(PARAM_RE)) {
      params.push(`\`${m[1]}\` — ${m[2].replace(/\\'/g, "'")}`)
    }
    if (params.length) lines.push(`Parameters: ${params.join('; ')}.`)

    const fields = attr(inner, 'fields')
    if (fields && fields in FIELD_SETS) {
      const set = FIELD_SETS[fields as keyof typeof FIELD_SETS]
      lines.push(
        `${set.label} fields: ${set.rows.map((r) => `\`${r.name}\` (${r.type}) — ${r.description}`).join('; ')}.`,
      )
    }
    return lines.length ? `\n\n${lines.join('\n\n')}\n\n` : ''
  })
}
