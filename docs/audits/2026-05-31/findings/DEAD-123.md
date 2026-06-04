# DEAD-123: @deprecated legacy commands still routed (continuation of DEAD-031)

## Category
Legacy/Deprecated (Keep / Monitor)

## Location
- `apps/discord-worker/src/index.ts` — "Legacy commands" routing block (comment at L27 and L516; cases L517-547)
- Handlers: `handlers/commands/favorites.ts`, `handlers/commands/collection.ts`, `handlers/commands/language.ts`
  (plus `match.ts` / `match_image.ts` carried under the legacy comment)

## Evidence
**Continuation of 2026-02-28 DEAD-031** (KEEP/Monitor). Re-verifying, three of these handlers now carry explicit
`@deprecated` JSDoc pointing at their replacements:
```
favorites.ts:7,43   @deprecated Use /preset instead for managing saved dyes
collection.ts:7,48  @deprecated Use /preset instead for managing dye collections
language.ts:9,45    @deprecated Use /preferences set language instead
```
All three are **still registered and routed** in `index.ts` (`case 'favorites'|'collection'|'language'`, L537-547) and
remain fully functional — i.e. deprecated-but-live, not dead. `match` / `match_image` sit under the same "Legacy commands"
comment (L516-523); `/match_image`'s successor is `/extractor` (see DEAD-124), while `/match` is still a current command.

## Why It Exists
The V4 migration introduced `/preset` and `/preferences` to absorb favorites/collection/language, but the old commands
are kept so existing users and any cached slash-command schemas keep working during the deprecation window.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | LOW that these are removable now — they are **live, user-facing** commands |
| **Blast Radius** | HIGH if removed — breaks slash commands users actively invoke; requires re-registering command schemas |
| **Reversibility** | MODERATE — user-facing + requires `register-commands` redeploy |
| **Hidden Consumers** | Discord users; cached command schemas in guilds |

## Recommendation
**KEEP-MONITOR**

### Rationale
- These are intentional deprecation shims, not dead code. The `@deprecated` JSDoc (new since Feb) signals an explicit
  retirement plan — track adoption of `/preset` and `/preferences` and retire on a deliberate schedule.

### If Acting (later)
1. Watch `/stats` V4-vs-legacy usage; when legacy invocation is negligible, remove the handlers + routes and
   `npm run register-commands` to drop the schemas. Announce before removal.
