# Favorites & Collections (Discord)

**Save and organize dyes directly from Discord**

> **5.0 note — these commands no longer exist.** `/favorites` and `/collection` were removed from
> the bot in 5.0 (with their storage); everything below describes the retired v4 commands and is
> kept only for reference. Saved dyes and palettes now live in the [web app](../web-app/favorites-collections.md)
> — every bot result carries a share link that opens there — and the one thing you can still keep
> in Discord is a list of favourite community presets:
>
> ```
> /preset favorite add preset_name:Tank Glamour
> /preset favorite remove preset_name:Tank Glamour
> /preset favorite list
> ```
>
> Note also that the v4 lists never synced with the web app; the sentence below was aspirational.

Your favorites and collections sync between the Discord bot and web app when you're logged in.

---

## Favorites

### View Favorites

```
/favorites list
```

Shows all your saved favorite dyes.

### Add a Favorite

```
/favorites add name:Dalamud Red
```

Adds a dye to your favorites list.

### Remove a Favorite

```
/favorites remove name:Dalamud Red
```

Removes a dye from favorites.

### Limits

- Maximum 20 favorites
- Synced with web app when logged in

---

## Collections

### List Collections

```
/collection list
```

Shows all your custom collections.

### View Collection

```
/collection show name:Tank Glamour
```

Displays all dyes in a specific collection.

### Create Collection

```
/collection create name:Tank Glamour description:Colors for my warrior set
```

Creates a new empty collection.

### Add Dye to Collection

```
/collection add collection:Tank Glamour dye:Dalamud Red
```

Adds a dye to an existing collection.

### Remove Dye from Collection

```
/collection remove collection:Tank Glamour dye:Dalamud Red
```

Removes a dye from a collection.

### Delete Collection

```
/collection delete name:Tank Glamour
```

Deletes an entire collection (requires confirmation).

### Limits

- Maximum 50 collections
- Maximum 20 dyes per collection
- Synced with web app when logged in

---

## Web App Sync

Your data syncs automatically when:
- You're logged in with Discord on the web app
- You use the same Discord account

Changes made on one platform appear on the other within moments.

---

## Organization Tips

| Collection Name | Use Case |
|-----------------|----------|
| "Tank Glamours" | Dyes for tank jobs |
| "Housing Colors" | For your house/apartment |
| "Holiday Looks" | Seasonal event colors |
| "FC Uniform" | Free Company coordination |

---

## Quick Workflow

1. **Find dyes** using `/extractor color` or `/harmony`
2. **Favorite** immediately with button click
3. **Organize** later by moving to collections
4. **Reference** when shopping in-game

---

## Related Commands

- `/extractor color` - Find dyes to save
- `/harmony` - Find harmonious combinations
- `/preset list` - Browse community presets to save

---

## Related Documentation

- [Command Reference](command-reference.md) - All commands
- [Getting Started](getting-started.md) - First steps
- [Web App Guide](../web-app/favorites-collections.md) - Web favorites
