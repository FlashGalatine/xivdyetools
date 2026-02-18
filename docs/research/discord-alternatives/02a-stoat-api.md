# Stoat Bot — API Reference

**Parent document:** [02-stoat.md](./02-stoat.md)

---

## Bot API — Deep Dive

### Bot Creation & Authentication
- Bots are created via the Stoat web interface (server settings → Manage bots).
- Each bot gets a **token** (identical concept to Discord bot tokens).
- The `Bot` class exposes an `interactionsUrl` property — an optional HTTP endpoint for receiving interactions. This is analogous to Discord's HTTP interactions model but its maturity is unclear.
- Bots authenticate with header: `x-bot-token: <token>` (via `revolt-api` client) or `x-session-token` for user accounts.

### REST API Endpoints (from OpenAPI spec)

**Bot Management:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/bots/create` | Create a new bot |
| GET | `/bots/{bot}` | Get owned bot details |
| PATCH | `/bots/{bot}` | Edit bot (name, public, interactionsUrl, etc.) |
| DELETE | `/bots/{bot}` | Delete bot |
| GET | `/bots/@me` | List all bots you own |
| POST | `/bots/{bot}/invite` | Invite bot to a server/group |

**Messaging:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/channels/{id}/messages` | Send a message |
| GET | `/channels/{id}/messages` | Fetch messages |
| PATCH | `/channels/{id}/messages/{msg}` | Edit a message |
| DELETE | `/channels/{id}/messages/{msg}` | Delete a message |
| POST | `/channels/{id}/search` | Search messages |

**Reactions:**
| Method | Endpoint | Description |
|---|---|---|
| PUT | `/channels/{id}/messages/{msg}/reactions/{emoji}` | Add reaction |
| DELETE | `/channels/{id}/messages/{msg}/reactions/{emoji}` | Remove reaction |

**Webhooks:**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/channels/{id}/webhooks` | Create a webhook for 3rd-party integration |
| GET | `/channels/{id}/webhooks` | List webhooks for a channel |

### Command Model
- **No native slash commands.** Bots respond to message events, typically using prefix commands (e.g., `!dye search white`).
- The `interactionsUrl` property on the Bot class hints at a future HTTP interactions model, but it is currently underdocumented.
- **Practical approach:** Use prefix-based commands (like Discord bots before slash commands existed) and/or message content parsing.

### SendableEmbed Structure
Stoat embeds are simpler than Discord's:
```typescript
interface SendableEmbed {
  title?: string;        // Heading text
  description?: string;  // Body text (Markdown supported)
  url?: string;          // Hyperlink on title
  icon_url?: string;     // Small icon image
  colour?: string;       // Any valid CSS color (e.g., "#FF5733")
  media?: string;        // File ID from upload — renders as image
}
```

**What's missing vs. Discord embeds:**
- No `fields` array (key-value pairs) — must format as Markdown in `description`
- No `footer` — append to description
- No `author` section — use `icon_url` + title
- No `thumbnail` — only `media` (full-width image)
- No `timestamp`

**Key advantage:** The `media` field accepts a file ID directly in the embed, meaning you can show an image *inside* the embed without a separate attachment reference. This is actually cleaner than Discord's `attachment://` pattern.

### Image / File Upload Pipeline

Files are uploaded to Stoat's **Autumn** CDN service in a two-step process:

```typescript
// Step 1: Upload file to Autumn CDN
// POST to the Autumn upload URL (obtained from API's root / endpoint → features.autumn.url)
const formData = new FormData();
formData.append("file", pngBuffer, { filename: "result.png", contentType: "image/png" });
const uploadResponse = await fetch(`${autumnUrl}/attachments`, {
  method: "POST",
  body: formData
});
const { id: fileId } = await uploadResponse.json();

// Step 2: Send message with attachment
await api.post(`/channels/${channelId}/messages`, {
  content: "Here's your dye result!",
  attachments: [fileId],       // Array of file IDs
  embeds: [{
    title: "Harmony Wheel — Triadic",
    description: "Based on **Pure White**\nHEX: `#FFFFFF`",
    colour: "#FFFFFF",
    media: fileId              // OR embed the image directly in the embed
  }]
});
```

**Using revolt-uploader (convenience library):**
```typescript
import { Uploader } from "revolt-uploader";
const uploader = new Uploader(client);

// Upload from buffer, file path, or URL
const attachmentId = await uploader.uploadFile("/path/to/image.png", "result.png");
const attachmentId = await uploader.uploadUrl("https://example.com/image.png", "result.png");
const attachmentId = await uploader.upload(bufferOrStream, "result.png");

// Send with message
channel.sendMessage({
  content: "Result:",
  attachments: [attachmentId]
});
```

**Note:** The Autumn CDN URL recently changed. Bots should dynamically fetch it from the API root endpoint's `features.autumn.url` field rather than hardcoding it.

### Message Sending — Full Parameter Reference
```typescript
// POST /channels/{id}/messages
{
  content?: string;                    // Text content
  attachments?: string[];              // Array of Autumn file IDs
  embed?: SendableEmbed;               // Single embed
  embeds?: SendableEmbed[];            // Multiple embeds
  replies?: MessageReply[];            // Reply references
  masquerade?: {                       // Override display name/avatar
    name?: string;
    avatar?: string;
  };
  interactions?: {                     // Preset reactions
    reactions?: string[];              // Emoji to add as reactions
    restrict_reactions?: boolean;      // Only allow preset reactions
  };
}
```

### Masquerade Feature

Stoat has a unique **masquerade** feature that lets bots change their display name and avatar per-message. This creates a more visually immersive experience — the bot's avatar and name can match the dye being displayed.

#### Masquerade Object

```typescript
// Per-message appearance override
{
  masquerade?: {
    name?:   string | null;  // Display name for this message
    avatar?: string | null;  // Public HTTPS URL to image (NOT an Autumn file ID)
    colour?: string | null;  // CSS color string for username (requires ManageRole permission)
  }
}
```

**Key detail:** The `avatar` field accepts any **public HTTPS image URL** — not an Autumn CDN file ID. The client proxies it through January (Stoat's media proxy) for display. Avatars render at **36×36 pixels, circular crop**.

**Permission caveat:** Setting `colour` requires the bot's role to have the **ManageRole** channel permission, not just the basic Masquerade permission. If the bot only has Masquerade permission, `name` and `avatar` work fine — just omit `colour` to avoid a permission error.

#### Usage for Dye Commands

For dye-related responses, the bot masquerades as the dye itself:

```typescript
async function sendDyeResponse(channel: Channel, dye: Dye, embed: SendableEmbed) {
  await channel.sendMessage({
    embeds: [embed],
    masquerade: {
      name: dye.name,                           // "Snow White"
      avatar: getDyeSwatchUrl(dye.hex),          // Solid-color circle PNG
      colour: dye.hex,                           // Username rendered in dye color
    },
    interactions: {
      reactions: [/* preset reactions */],
      restrict_reactions: true
    }
  });
}
```

**Effect:** The message appears to come from "Snow White" with a white circle avatar and a white-colored username. This is purely visual — it doesn't affect the bot's actual identity or permissions.

#### Swatch Avatar Strategy

The bot needs ~136 dye avatars for masquerade (125 tradeable dyes + 11 Facewear dyes). We already have **existing 3D dye sphere emoji** in the `emoji/` folder — 125 webp files named by itemID (e.g., `5729.webp`, `13114.webp`), each ~2–6 KB. These are rendered 3D spheres showing the dye color with lighting and depth, significantly more visually appealing than flat solid-color swatches.

##### Coverage

| Category | Count | Emoji Available? | Strategy |
|---|---|---|---|
| **Tradeable dyes** | 125 | Yes — 1:1 match by itemID | Upload existing webp files to Autumn |
| **Facewear dyes** | 11 | No — these have `itemID: null` (synthetic negative IDs at runtime) | Generate flat solid-color fallbacks, or use a generic "facewear" icon |

##### Approach Comparison

| Approach | Pros | Cons |
|---|---|---|
| **Pre-upload existing emoji to Autumn** (Recommended) | Zero generation needed, 3D spheres look better than flat circles, ~125 × 4 KB = ~500 KB total | One-time upload script, webp→png conversion may be needed |
| **Generate flat PNGs** | Uniform look, covers Facewear dyes | Less visually interesting, redundant work given existing assets |
| **External image host** | No Autumn dependency | Extra HTTP hop, service may go down |
| **Generate at runtime** | Always current | Wasteful — same images uploaded repeatedly |

**Recommendation: Pre-upload existing emoji to Autumn.** Write a one-time setup script that:

1. Reads existing webp files from `emoji/{itemID}.webp`
2. Converts to PNG if Autumn requires it (webp may be accepted directly — test first)
3. Uploads each to Autumn's `avatars` bucket
4. Generates flat solid-color PNG fallbacks for the 11 Facewear dyes (using sharp)
5. Saves a `dye-id → Autumn URL` mapping to a JSON file

```typescript
// One-time setup script: upload-swatch-avatars.ts
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const EMOJI_DIR = "./emoji";
const AUTUMN_URL = "https://autumn.revolt.chat";

/** Upload an existing dye sphere emoji (webp → png → Autumn) */
async function uploadExistingEmoji(itemId: number): Promise<string> {
  const webpPath = path.join(EMOJI_DIR, `${itemId}.webp`);
  const pngBuffer = await sharp(await fs.readFile(webpPath))
    .resize(64, 64)  // Ensure consistent size for avatars
    .png()
    .toBuffer();

  return uploadToAutumn(pngBuffer);
}

/** Generate a flat solid-color fallback for Facewear dyes */
async function generateFallbackPng(hex: string): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 64, channels: 4, background: hex }
  }).png().toBuffer();
}

async function uploadToAutumn(buffer: Buffer): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "image/png" }));
  const res = await fetch(`${AUTUMN_URL}/avatars`, { method: "POST", body: form });
  const { id } = await res.json();
  return `${AUTUMN_URL}/avatars/${id}`;
}

// Result: { "5729": "https://autumn.revolt.chat/avatars/abc123", "-1": "...", ... }
```

The resulting JSON is loaded once at startup. When masquerading as a dye:
- **Tradeable dyes** (`itemID > 0`): Look up `avatarMap[dye.itemID]` → 3D sphere avatar
- **Facewear dyes** (`itemID < 0`): Look up `avatarMap[dye.itemID]` → flat color fallback

Zero runtime image generation in either case.

#### Per-Command Masquerade Behavior

Not every command should masquerade. Use it where it adds visual value:

| Command | Masquerade? | Name | Avatar | Colour |
|---|---|---|---|---|
| `!xd info Snow White` | Yes | "Snow White" | Dye swatch | Dye hex |
| `!xd random` | Yes (per result) | Dye name | Dye swatch | Dye hex |
| `!xivdye harmony Pure White` | Yes | "Pure White — Triadic" | Base dye swatch | Base dye hex |
| `!xivdye gradient X > Y` | No | Default bot name | Default avatar | — |
| `!xivdye comparison X > Y > Z` | No | Default bot name | Default avatar | — |
| `!xivdye match #FF5733` | Yes | Matched dye name | Matched dye swatch | Matched hex |
| `!xivdye extract` | No | Default bot name | Default avatar | — |
| `!xivdye budget` | No | Default bot name | Default avatar | — |
| Help / errors / prefs | No | Default bot name | Default avatar | — |

**Rule of thumb:** Masquerade when the response is *about a single dye*. Skip it for multi-dye commands (gradient, comparison), image extraction, and utility commands.

#### Edge Cases

- **Multiple results** (ambiguity, 2–4 matches): Masquerade as the first result. The message name becomes "Turquoise Green (+1 more)" to indicate multiple.
- **`colour` permission missing**: Gracefully degrade — send masquerade without `colour`. The avatar and name still work.
- **Facewear dyes**: These have valid hex values for `colour`, but use flat solid-color fallback avatars (no 3D emoji exists). The `name` and `colour` fields work identically — only the avatar source differs. Lookup key is the synthetic negative itemID (e.g., `-1`).

### Reactions as Interactions (Button Replacement)

Stoat has a feature Discord lacks: **preset reactions with restriction**. When sending a message, the bot can define which emoji reactions appear and optionally lock reactions to *only* those presets. Combined with the `MessageReact` WebSocket event, this creates a lightweight interactive button system.

#### How It Works

**Step 1 — Send message with preset reactions:**
```typescript
await channel.sendMessage({
  content: "**Snow White** — HEX: `#ECECEC` · RGB: `236,236,236` · HSV: `0,2,93`",
  embeds: [{ title: "Snow White", colour: "#ECECEC", media: imageFileId }],
  interactions: {
    reactions: [
      encodeURIComponent("🎨"),   // "Show hex"
      encodeURIComponent("🔢"),   // "Show RGB"
      encodeURIComponent("📊"),   // "Show HSV"
      encodeURIComponent("🔍"),   // "Find similar"
    ],
    restrict_reactions: true       // Users can ONLY use these 4 emoji
  }
});
```

The message appears with pre-attached reaction buttons. Users tap one to trigger an action. With `restrict_reactions: true`, they can't add random emoji — it's a clean, controlled interaction.

**Step 2 — Listen for `MessageReact` event:**
```typescript
// WebSocket event payload:
{
  "type": "MessageReact",
  "id": "{message_id}",        // Which message was reacted to
  "channel_id": "{channel_id}",
  "user_id": "{user_id}",      // Who reacted
  "emoji_id": "{emoji_id}"     // Which emoji (URL-encoded for unicode)
}
```

```typescript
client.on("messageReact", async (message, userId, emojiId) => {
  // Look up the original message to determine context
  // (which dye was shown, what command generated it)

  const emoji = decodeURIComponent(emojiId);

  switch (emoji) {
    case "🎨":
      // Send hex value as a follow-up
      await message.channel.sendMessage(`\`#ECECEC\``);
      break;
    case "🔢":
      await message.channel.sendMessage(`\`rgb(236, 236, 236)\``);
      break;
    case "📊":
      await message.channel.sendMessage(`\`hsv(0, 2%, 93%)\``);
      break;
    case "🔍":
      // Run a "find similar dyes" command
      await handleFindSimilar(message, dyeId);
      break;
  }

  // Remove the user's reaction so the button is "re-usable"
  // (keeps the preset reactions clean for the next user)
});
```

**Step 3 — Track message context:**

The bot needs to remember which dye/command each message corresponds to. When a user reacts, the bot looks up the message ID to determine context.

```typescript
// Simple in-memory cache (TTL-based, or bounded LRU)
const messageContext = new Map<string, { dyeId: number; command: string }>();

// When sending a dye info message:
const sent = await channel.sendMessage({ /* ... */ });
messageContext.set(sent.id, { dyeId: 5729, command: "dye-info" });

// When reaction comes in:
const ctx = messageContext.get(messageId);
if (!ctx) return; // Message too old or not ours
```

#### Reaction Data Model

```typescript
// Message.reactions — who reacted with what
ReactiveMap<string, ReactiveSet<string>>
// Key: emoji string (encoded)
// Value: set of user IDs who reacted

// Message.interactions — the preset configuration
{
  reactions?: string[] | null;      // Preset emoji list
  restrict_reactions?: boolean;     // Lock to presets only
}
```

#### Events Reference

| Event | Payload | When |
|---|---|---|
| `MessageReact` | `{ id, channel_id, user_id, emoji_id }` | User adds a reaction |
| `MessageUnreact` | `{ id, channel_id, user_id, emoji_id }` | User removes a reaction |

#### Practical Considerations

**Emoji as buttons — mapping:**

| Emoji | Action | Discord equivalent |
|---|---|---|
| 🎨 | Copy HEX value | "HEX" button |
| 🔢 | Copy RGB value | "RGB" button |
| 📊 | Copy HSV value | "HSV" button |
| 🔍 | Find similar dyes | (new feature) |
| ❤️ | Save to favorites | (new feature) |
| 🔄 | Re-roll (for `!dye random`) | (new feature) |

**Advantages over Discord buttons:**
- **Persist after bot restart** — reactions stay on the message; buttons become invalid when the bot's interaction token expires.
- **Visually familiar** — emoji reactions are a natural chat paradigm.
- **Extensible** — can add new "actions" without UI framework changes.
- **Re-usable by multiple users** — any user can react, not just the command invoker.

**Limitations vs. Discord buttons:**
- **No labels** — emoji alone must convey meaning; new users need to learn the mapping. Mitigate by including a legend in the embed description (e.g., "🎨 HEX · 🔢 RGB · 📊 HSV").
- **No custom styling** — can't color-code or group reactions like button rows.
- **State management** — bot must track message→context mapping in memory or a cache. Messages older than the cache TTL lose interactivity.
- **Response visibility** — Discord buttons can respond ephemerally; reaction responses are public messages in the channel.
- **Race conditions** — if two users react simultaneously, both get responses. Manageable but worth noting.

**Recommendation:** Use preset reactions for `!dye info` (copy values) and `!dye random` (re-roll). Include an emoji legend in the embed description so users know what each reaction does. Skip reactions for commands where they don't add value (gradients, accessibility checks).

---
