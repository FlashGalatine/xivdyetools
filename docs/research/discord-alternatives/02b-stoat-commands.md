# Stoat Bot — Command Design

**Parent document:** [02-stoat.md](./02-stoat.md)

---

### Dye Input Resolution (Replacing Autocomplete)

Since Stoat has no autocomplete, users type dye identifiers as raw text. The bot needs a **multi-strategy resolver** that accepts flexible input and finds the right dye. This is actually an improvement over Discord's English-only autocomplete.

#### Accepted Input Formats

| Input Type | Example | Resolution Method | Priority |
|---|---|---|---|
| **ItemID** (numeric) | `5729` | `getDyeById(5729)` — O(1) hash map | 1st (exact) |
| **English name** (exact) | `Snow White` | `searchByName()` → exact match | 2nd (exact) |
| **Localized name** (exact) | `スノウホワイト` | `searchByLocalizedName()` → exact match | 2nd (exact) |
| **English name** (partial) | `Snow` | `searchByName()` → substring match | 3rd (fuzzy) |
| **Localized name** (partial) | `スノウ` | `searchByLocalizedName()` → substring match | 3rd (fuzzy) |

#### Resolution Algorithm

```typescript
function resolveDyeInput(input: string, locale: LocaleCode): Dye | Dye[] | null {
  const trimmed = input.trim();

  // 1. Try ItemID (if input is purely numeric)
  if (/^\d+$/.test(trimmed)) {
    const dye = dyeService.getDyeById(Number(trimmed));
    if (dye) return dye;
    // Fall through — could be a name that looks numeric (unlikely for dyes)
  }

  // 2. Try exact name match (English)
  const exactEnglish = dyeService.searchByName(trimmed)
    .find(d => d.nameLower === trimmed.toLowerCase());
  if (exactEnglish) return exactEnglish;

  // 3. Try exact localized name match
  if (locale !== 'en') {
    const exactLocalized = dyeService.searchByLocalizedName(trimmed)
      .find(d => {
        const locName = LocalizationService.getDyeName(d.itemID);
        return locName?.toLowerCase() === trimmed.toLowerCase();
      });
    if (exactLocalized) return exactLocalized;
  }

  // 4. Partial / substring match (all languages)
  const partialResults = dyeService.searchByLocalizedName(trimmed)
    .filter(d => d.category !== 'Facewear');

  if (partialResults.length === 1) return partialResults[0];   // Unambiguous — execute
  if (partialResults.length > 1) return partialResults;         // Ambiguous — caller decides
  return null;                                                   // No match — error + suggestions
}

// Caller uses the result like this:
const result = resolveDyeInput(input, locale);

if (result === null) {
  // No match — show "did you mean?" with fuzzy suggestions
} else if (Array.isArray(result)) {
  if (result.length <= MULTI_MATCH_THRESHOLD) {
    // Small set (2-4) — execute command for all matches
  } else {
    // Large set (5+) — show disambiguation list
  }
} else {
  // Single dye — execute command directly
}
```

#### Ambiguity Handling — Adaptive Strategy

When multiple dyes match a partial query, the bot adapts its behavior based on the result count:

**Small result set (2–4 matches) → Execute for all matches**

Since Stoat supports multiple embeds per message, the bot can just run the command for every match. No second round-trip needed.

Example: `!dye info turquoise` finds 2 matches → show both info cards:

```
Found 2 dyes matching "turquoise":

┌─────────────────────────────────┐
│ Embed: Turquoise Green (5743)   │
│ [info card image]               │
│ HEX: #70A883 · RGB: 112,168,131│
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Embed: Turquoise Blue (5744)    │
│ [info card image]               │
│ HEX: #3B8D90 · RGB: 59,141,144 │
└─────────────────────────────────┘
```

This works well because:
- Stoat supports multiple embeds + multiple attachments per message.
- 2–4 images is visually manageable without flooding the channel.
- Zero friction — the user gets their answer immediately.

**Large result set (5+ matches) → Disambiguation list**

Too many embeds/images would flood the channel. Instead, show a compact list:

```
Found 12 dyes matching "white":
  1. Snow White (5729)
  2. Pure White (6738)
  3. Pearl White (5730)
  4. Loam White (36224)
  5. Frost White (44844)
  ... and 7 more

Use the full name or ItemID for an exact match.
Example: !dye info Snow White  or  !dye info 5729
```

**No matches → Helpful error**

```
No dye found matching "turqoise".
Did you mean: Turquoise Green, Turquoise Blue?

Tip: You can also use an ItemID (e.g. !dye info 5743).
```

For the "did you mean" suggestion on typos, a lightweight Levenshtein distance check against all dye names could catch common misspellings. This is optional for v1 but a nice future enhancement.

#### Threshold Summary

| Match Count | Behavior | Rationale |
|---|---|---|
| **0** | Error + "did you mean?" suggestions | Help the user recover from typos |
| **1** | Execute command immediately | Unambiguous — just do it |
| **2–4** | Execute for all matches | Small enough to show inline; zero friction |
| **5+** | Show disambiguation list | Too many to display; user narrows with name/ID |

> **Note:** The threshold of 4 is tunable. For image-heavy commands (harmony, gradient), we may want to lower it to 2–3 to avoid generating too many PNGs per message. For text-only commands (mixer, extractor color), 4 is fine.

#### Per-Command Behavior

Not all commands should handle ambiguity the same way:

| Command Type | Multi-match behavior | Why |
|---|---|---|
| **Single-dye, image output** (`!dye info`, `!harmony`) | Show all (2–4) or disambiguate (5+) | Each generates a separate PNG; keep it bounded |
| **Single-dye, text output** (`!extractor color`, `!mixer`) | Show all (2–4) or disambiguate (5+) | Text is lightweight; showing a few is fine |
| **Multi-dye commands** (`!comparison`, `!gradient`) | Disambiguate immediately if *any* argument is ambiguous | Don't want combinatorial explosion (2 ambiguous × 2 ambiguous = 4 combinations) |
| **Budget commands** (`!budget find`) | Disambiguate immediately | Each match triggers a Universalis API call; don't waste quota |

#### Why This Is Better Than Discord's Current Autocomplete

| Aspect | Discord (current) | Stoat (proposed) |
|---|---|---|
| **Language support** | English only | All 6 languages (en, ja, de, fr, ko, zh) |
| **ItemID lookup** | Not supported | Direct O(1) lookup |
| **Small ambiguity** | User must pick from dropdown | Bot shows all matches — no extra step |
| **Large ambiguity** | Silent top-25 dropdown | Explicit list with ItemIDs for precision |
| **Typo recovery** | No results, no guidance | "Did you mean?" suggestions |
| **Offline-friendly** | Requires typing + waiting for API | User can bookmark ItemIDs |

### Command Prefix & Syntax

#### Prefix: `!xivdye`

All commands use the `!xivdye` namespace prefix to avoid collisions with other bots:

```
!xivdye <command> [subcommand] [arguments...]
```

This is longer than a bare `!` prefix, but the tradeoff is worth it:
- **Zero collision risk** — no other bot will claim `!xivdye`
- **Brand recognition** — every command reinforces the tool's identity
- **Clear intent** — in a busy channel, it's immediately obvious which bot is being addressed

#### Command Mapping (Discord → Stoat)

| Discord | Stoat | Notes |
|---|---|---|
| `/dye info Snow White` | `!xivdye dye info Snow White` | Subcommand preserved |
| `/dye search white` | `!xivdye dye search white` | |
| `/dye list Reds` | `!xivdye dye list Reds` | |
| `/dye random` | `!xivdye dye random` | |
| `/harmony color:Pure White type:triadic` | `!xivdye harmony Pure White triadic` | Positional args, greedy dye name |
| `/gradient start:Pure White end:Jet Black steps:5` | `!xivdye gradient Pure White > Jet Black 5` | `>` separator between two dye args |
| `/mixer dye1:Snow White dye2:Jet Black mode:spectral` | `!xivdye mixer Snow White > Jet Black spectral` | Same separator pattern |
| `/comparison dye1:X dye2:Y dye3:Z` | `!xivdye comparison X > Y > Z` | `>` separates each dye |
| `/extractor color #FF5733` | `!xivdye match #FF5733` | Renamed for clarity |
| `/extractor image [attachment]` | `!xivdye extract` (with image attachment) | Detects attached image |
| `/accessibility dye:X` | `!xivdye a11y X` | Shortened alias |
| `/budget find target:Pure White` | `!xivdye budget Pure White` | |
| `/budget set_world Famfrit` | `!xivdye budget world Famfrit` | |
| `/swatch color skin 5` | `!xivdye swatch skin 5` | |
| `/preferences show` | `!xivdye prefs` | |
| `/preferences set language:ja` | `!xivdye prefs set language ja` | |
| `/preset list` | `!xivdye preset list` | |
| `/about` | `!xivdye about` | |

#### Argument Parsing: Greedy Dye Name with `>` Separator

The key parsing challenge is multi-word dye names. The resolver handles this with **greedy matching from the left**:

```typescript
// For single-dye commands:
// "!xivdye harmony Pure White triadic oklch"
//
// Parser tries (longest first):
//   "Pure White triadic oklch" → no dye match
//   "Pure White triadic"       → no dye match
//   "Pure White"               → MATCH! → remaining: ["triadic", "oklch"]
//   "Pure"                     → would also match, but greedy prefers longer
```

For **multi-dye commands**, the `>` character separates dye arguments:

```
!xivdye gradient Pure White > Jet Black 5 oklch
                  ^^^^^^^^^^   ^^^^^^^^^  ^ ^^^^^
                  dye 1        dye 2      steps  color_space
```

Why `>` instead of `|` or `,`:
- `>` visually suggests "from → to" (fitting for gradient/mixer)
- `|` is a pipe character with shell connotations
- `,` could appear in some dye-related values
- `>` is unlikely to appear in dye names or option values

#### Short Aliases

Power users shouldn't have to type `!xivdye` every time. Register short aliases for the most common operations:

| Full Command | Alias | Notes |
|---|---|---|
| `!xivdye dye info` | `!xd info` | Most used command |
| `!xivdye dye search` | `!xd search` | |
| `!xivdye dye random` | `!xd random` | |
| `!xivdye harmony` | `!xd harmony` | |
| `!xivdye match` | `!xd match` | |
| `!xivdye help` | `!xd help` | |

The bot listens for both `!xivdye` and `!xd` as prefixes. `!xd` is short, memorable, and still unlikely to collide.

---

### Ephemeral Messages — Hybrid Approach

Stoat has no ephemeral messages. Different response types get different treatments:

| Response Type | Discord (current) | Stoat (proposed) | Rationale |
|---|---|---|---|
| **Errors / validation** | Ephemeral | Public reply | Brief, contextually useful — others learn from mistakes |
| **Preferences show/set** | Ephemeral | DM to user | Contains user-specific settings; not relevant to channel |
| **Help / manual** | Ephemeral | DM to user | Long text would flood the channel |
| **Budget set_world** | Ephemeral | DM confirmation | User-specific configuration |
| **Copy-value buttons** | Ephemeral response to button click | Public (via reactions) | Values already visible in embed description; reaction response is supplementary |
| **Rate limit notices** | Ephemeral | Public reply (brief) | User needs to know; others benefit from awareness |

#### DM Implementation

```typescript
async function sendDM(userId: string, content: string, embeds?: SendableEmbed[]) {
  // Open or get existing DM channel
  const dmChannel = await client.api.post(`/users/${userId}/dm`);

  // Send message in DM
  await client.api.post(`/channels/${dmChannel.id}/messages`, {
    content,
    embeds
  });
}

// Usage in preferences command:
async function handlePrefsShow(message: Message) {
  const prefs = await getUserPreferences(message.author.id);
  await sendDM(message.author.id, "", [{
    title: "Your Preferences",
    description: formatPreferences(prefs),
    colour: "#5865F2"
  }]);

  // Acknowledge in channel so user knows to check DMs
  await message.channel.sendMessage({
    content: "Sent your preferences via DM.",
    replies: [{ id: message.id, mention: false }]
  });
}
```

#### Error Responses (Public)

Errors are posted as brief public replies. They include inline help so others benefit:

```
Invalid color format. Expected hex (e.g., #FF5733) or dye name.
Usage: !xivdye match <color or dye name>
```

---

### Deferred Responses — Reaction Loading Indicator

For image-generating commands (1–5 second processing time), the bot uses a reaction-based loading indicator:

#### Flow

```typescript
async function handleImageCommand(message: Message, generateFn: () => Promise<Buffer>) {
  // 1. React with ⏳ to acknowledge
  await message.react(encodeURIComponent("⏳"));

  try {
    // 2. Generate image
    const png = await generateFn();

    // 3. Upload to Autumn CDN
    const fileId = await uploadToAutumn(png, "result.png");

    // 4. Send result as a reply to the original command message
    const sent = await message.channel.sendMessage({
      replies: [{ id: message.id, mention: false }],
      embeds: [{ title: "Result", media: fileId, colour: "#5865F2" }],
      interactions: {
        reactions: [/* preset action reactions */],
        restrict_reactions: true
      }
    });

    // 5. Track context for reaction interactions
    messageContext.set(sent.id, { /* command context */ });

  } catch (error) {
    // Error: reply with message
    await message.channel.sendMessage({
      content: `Something went wrong: ${error.message}`,
      replies: [{ id: message.id, mention: false }]
    });

  } finally {
    // 6. Remove ⏳ regardless of success/failure
    await message.unreact(encodeURIComponent("⏳"));
  }
}
```

#### Why Reaction > Placeholder Message

| Approach | Pros | Cons |
|---|---|---|
| **Placeholder → edit** | Closest to Discord model | Creates a notification for the placeholder, then content shifts when edited |
| **Reaction ⏳ → reply** | Lightweight, no extra notification, result arrives as a clean reply | User might not notice the ⏳ on their own message |
| **No indicator** | Simplest | User doesn't know if the bot heard them |

The reaction approach wins because:
- **No channel noise** — doesn't create an extra message
- **Clear acknowledgment** — ⏳ on the user's message means "I'm working on it"
- **Clean result** — the final reply stands on its own as a complete response
- **Reply threading** — Stoat's reply feature visually links the result to the command

---

### Help & Discoverability — Layered Approach

Without a slash command menu, users need multiple ways to discover what the bot can do.

#### Layer 1: `!xivdye help` Command

```
!xivdye help              → Overview of all command categories
!xivdye help dye          → All dye subcommands with examples
!xivdye help harmony      → Detailed harmony command help
!xivdye help syntax       → Argument format guide (>, aliases, ItemIDs)
```

The top-level `!xivdye help` is sent via **DM** to avoid flooding the channel:

```
XIV Dye Tools — Command Reference

Dye Lookup
  !xd info <dye>              Look up a dye's color values
  !xd search <query>          Search dyes by name
  !xd list [category]         List dyes in a category
  !xd random                  Show 5 random dyes

Color Tools
  !xivdye harmony <dye> [type]              Color harmonies
  !xivdye gradient <dye> > <dye> [steps]    Color gradients
  !xivdye mixer <dye> > <dye> [mode]        Blend two dyes
  !xivdye comparison <dye> > <dye> [> ...]  Compare dyes side-by-side
  !xivdye match <color>                     Find closest dye to a color
  !xivdye extract                           Extract colors from an image

Accessibility
  !xivdye a11y <dye> [dye2..4]             Colorblind simulation / contrast

Market Board
  !xivdye budget <dye> [world]              Find affordable alternatives
  !xivdye budget world <world>              Set your default world

Settings
  !xivdye prefs                             Show your preferences
  !xivdye prefs set <key> <value>           Update a preference

Tip: Use !xd as a shortcut for !xivdye.
     Dye names, ItemIDs (e.g., 5729), and localized names are all accepted.
     Use > to separate multiple dyes: !xivdye gradient Pure White > Jet Black
```

#### Layer 2: ❓ Reaction on Bot Responses

Every bot response includes a ❓ in its preset reactions. When tapped, the bot sends a DM with contextual help for that specific command:

```typescript
// In the reaction handler:
case "❓": {
  const ctx = messageContext.get(messageId);
  if (!ctx) return;

  const helpText = getCommandHelp(ctx.command);
  await sendDM(userId, helpText);
  break;
}
```

This means users can discover how to tweak a command *from the result itself* — they don't need to remember to type `!xivdye help harmony`.

#### Layer 3: Inline Hints on Errors

Every error response includes the correct syntax:

```
Unknown subcommand "infp". Did you mean "info"?

Usage: !xivdye dye info <name or ItemID>
Examples:
  !xivdye dye info Snow White
  !xd info 5729
  !xd info スノウホワイト
```

#### Layer 4: `!xivdye about` with Quick-Start

The about command (ported from Discord) includes a brief "getting started" section for new users:

```
XIV Dye Tools v4.x — Stoat Edition

Quick start:
  !xd info Pure White       ← Try this first!
  !xd random                ← Discover new dyes
  !xd help                  ← Full command list (sent via DM)

React with ❓ on any bot message for help with that command.
```

---
