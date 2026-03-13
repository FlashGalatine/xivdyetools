# Discord Worker — Interactions (v4.1.2)

Documentation for button, modal, and autocomplete handlers in the XIV Dye Tools Discord bot.

## HTTP Interactions Model

Unlike traditional Gateway bots, the discord-worker uses Discord HTTP Interactions. There is no persistent WebSocket connection; instead, the bot runs serverless on the Cloudflare Workers edge network.

- Discord sends an HTTP POST for each interaction to `POST /`
- Ed25519 signature verification runs on every request (via `@xivdyetools/auth`)
- No persistent WebSocket connection or Gateway heartbeat
- Stateless: each interaction is an independent request/response cycle

## Interaction Types

Discord sends different `type` values in the interaction payload:

| Type | Name                             | Description                    |
|------|----------------------------------|--------------------------------|
| 1    | PING                             | Return `{ type: 1 }` (pong)   |
| 2    | APPLICATION_COMMAND              | Slash command execution        |
| 3    | MESSAGE_COMPONENT                | Button click                   |
| 4    | APPLICATION_COMMAND_AUTOCOMPLETE | Autocomplete suggestions       |
| 5    | MODAL_SUBMIT                     | Modal form submission          |

## Button Handlers (`src/handlers/buttons/`)

Buttons use `custom_id` patterns for routing. The router parses the custom ID string and dispatches to the appropriate handler.

| Pattern                                    | Description                   |
|--------------------------------------------|-------------------------------|
| `preset_vote_{presetId}`                   | Vote on a preset              |
| `preset_next_{page}`                       | Pagination for preset list    |
| `preset_prev_{page}`                       | Pagination backward           |
| `favorites_add_{dyeId}`                    | Add dye to favorites          |
| `favorites_remove_{dyeId}`                 | Remove dye from favorites     |
| `collection_add_{collectionId}_{dyeId}`    | Add dye to a collection       |

## Modal Handlers (`src/handlers/modals/`)

Modals collect multi-field input from the user via Discord's modal forms.

| Custom ID                          | Description                          | Fields                     |
|------------------------------------|--------------------------------------|----------------------------|
| `preset_submit`                    | Preset submission form               | name, description, tags    |
| `collection_create`               | New collection creation              | name, description          |
| `collection_rename_{collectionId}` | Rename an existing collection        | name                       |

## Autocomplete Handlers

Dye name autocomplete runs for all commands that accept a `dye` parameter.

- Searches by localized dye name using the user's language preference
- Returns up to 25 suggestions (Discord's maximum)
- Filters by partial match against the query string
- Uses `DyeService.searchByName()` from `@xivdyetools/core`

## Response Types

Defined in `src/utils/response.ts`:

| Function                            | Discord Response Type | Description                                        |
|-------------------------------------|-----------------------|----------------------------------------------------|
| `pongResponse()`                    | Type 1                | Reply to PING                                      |
| `messageResponse(data)`             | Type 4                | CHANNEL_MESSAGE_WITH_SOURCE                        |
| `ephemeralResponse(content)`        | Type 4 + flag 64      | Private message visible only to the invoking user  |
| `deferredResponse()`                | Type 5                | DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE               |
| `errorEmbed(title, description)`    | Type 4                | Standard error embed format                        |

## Deferred Response Pattern

Long-running operations (such as image rendering) use a deferred response to avoid Discord's 3-second interaction timeout:

1. Return `deferredResponse()` immediately to acknowledge the interaction.
2. Schedule async work via `ctx.waitUntil(asyncFunction())`.
3. When the work completes, call `editOriginalResponse(applicationId, token, data)` with the final payload.
4. The user sees a "thinking..." indicator until the final response arrives.

## Follow-up Messages

`sendFollowUp(applicationId, token, options)` sends additional messages after the initial response.

- Used by: preset notifications, announcement webhooks
- Supports embeds, components (buttons), and file attachments
- Timeouts: 5 seconds (no file), 10 seconds (with file)

## Webhook Endpoints

In addition to Discord interactions, the worker exposes webhook endpoints for external services:

| Endpoint                            | Source       | Description                                            |
|-------------------------------------|-------------|--------------------------------------------------------|
| `POST /webhooks/preset-submission`  | presets-api  | Receives new preset notifications via Service Binding  |
| `POST /webhooks/github`            | GitHub       | Receives push events, posts changelog to announcement channel |

## Security

- **Ed25519 signature verification** on all interaction requests using the `X-Signature-Ed25519` and `X-Signature-Timestamp` headers
- **Max body size**: 100 KB for interaction payloads
- **Timing-safe comparison** for webhook secret validation
- **Webhook payload limit**: 10 KB

## Related Documentation

- [Overview](overview.md) — Architecture and project structure
- [Commands](commands.md) — Slash command definitions and handlers
- [Rendering](rendering.md) — Image generation pipeline
- [Deployment](deployment.md) — Wrangler configuration and deployment process
