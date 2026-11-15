# FINDING-014: /glamour embed's plain() leaves masked-link syntax in upstream item names and acquisition lines unescaped
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** bot-logic + discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-74

## Location
- `packages/bot-logic/src/commands/glamour.ts:385` — /glamour embed's plain() leaves masked-link syntax in upstream item names and acquisition lines unescaped
- `packages/bot-logic/src/commands/glamour.ts:384` — Bot /glamour embed lets masked links and markdown headings through from upstream names

## Evidence
- glamour.ts:385 `return text.replace(/([*_~`|\\])/g, '\\$1');` ; xivapi.ts:97 `value.replace(/­/g, '').trim()`
- Reach: Any Discord user runs /glamour with a .chara file. The worker posts a public embed whose description holds item names that api-worker fetched live from XIVAPI (apps/api-worker/src/chara/xivapi.ts:186-189, cleanName strips only soft hyphens) and acquisition lines from the bundled acquisition.en.json, all passed through plain() at glamour.ts:412, 581, 591 and 598. If an upstream name were poisoned to contain [text](https://evil), it would render as a clickable masked link.
- plain() at glamour.ts:384-386 escapes only * _ ~ ` | \, and its doc comment (378-383) says leaving brackets and parentheses unescaped is deliberate. The safer escapeDiscordMarkdown/defuseMentions helpers in discord-markdown.ts are not used here. Exploiting this needs XIVAPI or the build-time acquisition table to be compromised: no string from the user's file reaches these sinks (missing items show only the numeric formatCharaModelLabel), committed data has 0 "](" and 0 mention tokens, mentions inside embeds never ping, and # or > only take effect at line start, which needs a newline injected into the name. That makes this upstream-… Preconditions: A third party (XIVAPI) is compromised, or the build-time acquisition/regional-name data is poisoned. Both reviewers' sub-claims hold. The mention-ping part has no effect because embeds never ping and edits pin allowed_mentions to none. The heading/blockquote part also needs an injected newline, bec…
- Live state the repo cannot show: Live XIVAPI response content (third party); the repo cannot show whether current upstream names contain markup.

## Fix
- In plain(), also escape [ and ] (enough to break masked links without the paren backslashes the comment wants to avoid), defuse <@…>/<#…>/<t:…>/@everyone, and collapse \r\n to a space. Alternatively, have api-worker's cleanName reject or strip those tokens at the source. Add a test with a "[x](https://e)" name.

## Status
OPEN
