# Glamour Reader

**Read a character file as a glamour**

The Glamour Reader shows what a character is wearing. Load a `.chara` file and it lists every piece of gear with the dyes on it, checks whether the game lets this character wear each piece the way the file shows it, and writes the whole outfit in the format glamour showcases such as GPOSERS ask for, with where each piece comes from.

> **Note**: New in 5.13.0. In the tool rail this is the **Glamour** chip, and the `0` key opens it. It has no settings column and no Color Palette drawer: the character file is the input. Before 5.13.0, DYES ON THIS GLAMOUR was a section of the [Swatch Matcher](swatch-matcher.md).

---

## Loading a Character File

### Drop a `.chara` file

Until a file is loaded, the reader shows a **Drop a .chara file** zone. Drag a file onto it, or click it (or **Choose file**) to browse. It reads character files exported by **Anamnesis, Ktisis or Brio**, up to 20 MB. A file it can't read gets a message naming what went wrong.

The file is parsed on your device. To put names to the gear, the reader sends the XIV Dye Tools API one request with the model numbers of the worn pieces and the ID of the facewear, and nothing else: not the character's name, not its colors, not the file. The line under the card says so: *"Parsed on this device. To name the gear, only its model numbers and the facewear ID are sent to our API. The character name and colors stay here."* For the same reason this card has no **LOCAL ONLY** chip. The Swatch Matcher's card keeps one, because the Swatch Matcher sends nothing.

### The file card

Once a file is loaded, the drop zone becomes a card with:

- a strip of the character's own colors, a chip naming the tool that made the file, and the character's name (the file name when the file has none);
- the clan and gender, a count of the color slots it read, and the file name;
- **Swatch Matcher →**, which opens the [Swatch Matcher](swatch-matcher.md) with the same file loaded;
- **SWAP**, which clears the file and brings the drop zone back.

Problems reading the character's colors are listed on an amber card under it. They affect the Swatch Matcher's color matches, not the gear.

### One file, two tools

The Glamour Reader and the Swatch Matcher share the loaded file: load it in either tool and the other already has it, and **SWAP** in either clears it for both. The file is held in memory only and never written to browser storage. It stays loaded while you visit other tools or change the language, and a page reload clears it.

A file whose character wears no gear and no facewear gets one line: *This file wears no gear.*

---

## IN THE GAME

A posing tool can put any piece on any character and any dye on any piece. The game can't. Once the gear has names, a verdict opens the section:

- a headline built from what it found, such as *"1 piece named from a twin and 1 piece this character can't wear"*, or *"Every piece can be worn the way the file shows it"* when there is nothing to report;
- a fixed explanation: since patch 7.4 any job can wear any piece for glamour, so what is left to check is dye channels, the glamour flag, race, gender and Grand Company;
- one chip per outcome, for the outcomes that occur.

| Chip | Meaning |
|------|---------|
| **FIXED BY A TWIN** (green) | The first item with this look (the lowest item number) fails a check, but an identical twin passes, so the list names the twin. See [Twins](#twins-the-same-look) |
| **NO FIX** (amber) | The piece fails, and nothing that looks the same passes. Also shown when you pick a twin that fails |
| **FINE AS IS** | The piece passes |
| **NEEDS A GRAND COMPANY** | The piece passes, but only members of one Grand Company can wear it |

Each piece counts once, so the chips add up to the pieces checked. A piece that passes but needs a Grand Company counts there and not as fine; a fixed piece that needs one stays fixed, and its row mentions the company.

### What is checked

| Check | A piece fails when… | Its row says |
|-------|---------------------|--------------|
| **Dye channels** | the file puts more dyes on it than it takes. A piece takes none, one or two, and a dye on **Dye 2** needs a piece that takes two | *It can't take the dyes the file puts on it* |
| **Glamour flag** | the item can't be a glamour at all, as with relic weapons, whose Replicas carry the look | *It can't be a glamour* |
| **Race and gender** | only some races, or only one gender, can wear the item, and this character isn't among them | *This character can't wear it* |
| **An item behind the model** | the file wears an NPC or prop model that no item uses. The row shows **MODEL** and the model number instead of a name | *A model with no item behind it* |
| **Grand Company** | never: a `.chara` file doesn't record a Grand Company, so a locked piece is only flagged | *Needs the right Grand Company* |

The check runs in your browser. Only the rules come from the API; your dyes, race and gender stay on your device. If the API can't be reached, or answers without the rules, there is no verdict and the rest of the section still works.

An off hand that belongs to the main weapon, such as a bow's quiver, is checked with the main hand and not counted twice.

---

## Twins: the Same Look

A `.chara` file stores the model a piece draws, not the item. One model often stands for several items that the game draws identically: *Dated Hempen Coif* and *Hempen Coif*, *Curtana Zenith* and its *Replica*, *Lord's Yukata* and *Lady's Yukata*. Their rules can differ (one takes a dye and its twin doesn't), so for each piece the reader names the twin the list will write:

1. one that passes the check for this file and this character,
2. preferring one that takes dyes (GPOSERS asks for an identical dyeable version over an undyeable one),
3. then one that members of any Grand Company can wear,
4. then one that isn't a **Dated** version,
5. then the one with more dye channels,
6. then the lowest item number.

When no twin passes, the reader names the one with the lowest item number.

### The +N chip

A piece with twins carries a **+N** chip after its slot name, counting the other items with its look. Hover it for their names. The chip's color tells you why the row names the item it does:

- **green**: a twin was named to fix a problem, and the row says which item it replaced (*"Named instead of …, which can't take these dyes"*);
- **amber**: nothing fixes the piece (*"Nothing with the same look fixes it"*), or you picked a failing twin while another one works (*"… can be worn instead"*);
- **gray**: the choice is free (*"Same look as … · either is fine"*).

A piece marked **FIXED BY A TWIN** or **NO FIX** gets a row even when it is undyed, so the rows explain the verdict.

### Pick a twin yourself

Click **+N** to open the picker: a popover on a desktop, or a sheet from the bottom of the screen on a phone. It is headed **SAME LOOK · N ITEMS** (*"The game draws these identically. Pick the one your list names."*) and lists each twin with its item number and its facts:

| Chip | Meaning |
|------|---------|
| **BEST FIT** | The twin the reader names by default, when one passes |
| **DYE ×N** | How many dyes it takes. Green when that is enough for the file's dyes, amber when it isn't |
| **ANY RACE** / **FITS THIS CHARACTER** / **NOT FOR THIS CHARACTER** | Who can wear it |
| **DATED** | A retired version the game still draws |
| **GRAND COMPANY** | Only members of one Grand Company can wear it |
| **NO GLAMOUR** | It can't be a glamour |

A twin that fails a check says why under its name. Pick one and the row, its **Open in…** menu and the Glamour list all follow your pick. As the picker's footer puts it, *"Copy list and Save .md write the one you pick."* `Esc` or a click outside closes the picker, and the arrow keys move between twins.

Picks belong to the loaded file. They are kept while you visit other tools and come back, and are never written to storage. A new file starts over from the defaults.

---

## DYES ON THIS GLAMOUR

Under the verdict, the section's header counts the dyed channels and the distinct dyes (for example *"5 channels · 3 dyes"*). Beside it are the **Pieces / Dyes** toggle, the **Show all** switch and **Make a palette**.

### Pieces and Dyes

The toggle switches how the section is laid out, and your choice is remembered on this device.

- **Pieces** (the default) gives each dyed piece a row, slot by slot: Main Hand, Off Hand, Head, Body, Hands, Legs, Feet, Ears, Neck, Wrists, Left Ring, Right Ring. A row shows the piece's icon, its slot, its name, its dyes in words, and two chips at the end. The chips are positional: the first is **Dye 1** and the second is **Dye 2**. A plain solid chip is an undyed channel. A dashed chip is a dye this version of the app doesn't know, named by its number instead. Earrings, necklaces, bracelets and rings can't be dyed, so they carry no chips.
- **Dyes** gives each distinct dye a row instead: its swatch, its name, its dye number (**ID**), small icons for the pieces wearing it, and **×N** when it is on more than one channel. Hover an icon for its slot and piece.

Names follow the app's language. In Korean and Chinese, an item the regional game data doesn't have yet is shown in English.

### Show all

By default the **Pieces** view lists dyed pieces only, plus any piece marked **FIXED BY A TWIN** or **NO FIX**. Turn on **Show all** to list every piece worn, with undyed ones marked **Undyed**, and a **Facewear** row after the gear when the character wears facewear. The switch is remembered on this device, and it is grayed out in the **Dyes** view, which has no undyed pieces to show. If nothing on the glamour is dyed, the section says so and points you at the switch.

The **Facewear** row names the piece and its color. Facewear colors are not dyes and are not matched against the dye database. The color is read from the item's name (most facewear is named for its color), and when the name doesn't give one, the row says *Facewear color unknown*.

Under the rows, a footnote separates worn pieces that are undyed from slots that are empty, out of the twelve gear slots: *"2 worn pieces are undyed (DyeId 0) · 3 slots are empty."* Hover it for a reminder that DyeId 0 means undyed, not black.

### While names load, and when they can't

Dyes never wait: they come straight from your file. Names, icons and the verdict arrive a moment later, and until then a gray bar holds each name's place. If the names can't be looked up, the section says *"Item names unavailable — showing slots only. Dyes are read locally from the file and are unaffected."* The rows keep their slot and their dyes, with no verdict, no **+N** chip and no **Open in…** menu.

### Open a piece elsewhere

Click a piece's icon or its name in the **Pieces** view (in **Dyes**, the small icons on the right of each row) for an **Open in…** menu with five lookup sites: **Mirapri**, **GarlandTools**, **Teamcraft**, **GamerEscape** and **The Lodestone**, which opens into five regional searches (North America, Europe, Japan, Germany and France). The menu opens the twin the row names. A piece with no item behind it, such as an NPC outfit or a prop, has no menu, because there is nothing to look up.

The **Facewear** row's menu is shorter. The game files facewear under a different kind of ID than gear, so it offers only **Mirapri**, **GamerEscape** and **The Lodestone**. It looks up the plain, untinted version of the item first (a tinted pair is not a real item), so those entries can take a moment to appear. If the lookup fails, the menu says so instead of offering a link that would go nowhere.

---

## Make a Palette

**Make a palette** opens a panel under the rows, titled **New palette from this glamour**:

1. Every distinct dye the glamour wears is a chip. Click a chip to leave that dye out, and click it again to bring it back. A strip under the chips previews the dyes you are keeping, and a counter beside the title shows how many (**4 / 6**), green when the count is allowed.
2. Type a name. The field starts empty and is never filled in with your character's name, because a community preset's name is public. As the hint under it says, preset names and descriptions are not translated: every player sees what you type.
3. Press **Save to this device** or **Submit to Community**. Both work with **3 to 6** dyes. Outside that range they stay disabled, and an amber card says why: **NEEDS 3**, or **3–6** when you are keeping more than six.

**Save to this device** keeps the palette in your browser. It appears under **Community Presets → Saved** (see [Favorites & Collections](favorites-collections.md)). If you leave the name empty, the palette is named after the character, or after the file when it has no character name; that name never leaves your device.

**Submit to Community** opens the preset form with the dyes already filled in, and the name if you typed one. Submitting needs you to sign in; see [Submitting Presets](community-presets.md#submitting-presets).

Dyes this version of the app doesn't know (the dashed chips) are left out of the palette.

---

## The Glamour List

### Copy list and Save .md

**Copy list** and **Save .md** sit at the top of the reader, beside its title. (Older versions labeled the second one **Export .md**.) They appear once the loaded file wears something, and stay grayed out while item names are loading, because a list copied a second early would be missing them. If the names never arrive, the buttons still work from the slots and dyes in your file.

Neither button copies or downloads anything by itself. Both open the **Glamour list** sheet, where you can check and edit the list first. The button you pressed has focus in the sheet's footer.

### What the list says

The list follows the GPOSERS submission form: a **Glamour Items:** heading, then each worn piece under its slot label in bold, a **Dye 1:** and **Dye 2:** line for each dye it wears, and an **Acquisition:** line:

```
Glamour Items:
Main Hand: <the weapon>
Dye 1: <its dye>
Acquisition: <where it comes from>

Body: <the piece>
Dye 1: <its first dye>
Dye 2: <its second dye>
Acquisition: <where it comes from>

Rings: <the ring>
Acquisition: <where it comes from>

Facewear: <the facewear>
Acquisition:
```

- **Only what you are wearing is listed.** Empty slots get no entry, and a dye line appears only for a dye the piece is wearing. An undyed channel, accessories and facewear get none.
- **The labels are the form's own English words in every language:** Main Hand, Off Hand, Head, Body, Hands, Legs, Feet, Earrings, Necklace, Bracelets, Right Ring, Left Ring and Facewear, with Right Ring before Left Ring and Facewear last. Item and dye names are in the app's language, as on screen.
- **Two identical rings are written once**, as **Rings:**.
- **Each piece is the twin the reader names**, or the one you picked.
- **The whole glamour is written.** The **Pieces / Dyes** view and **Show all** change what is on screen, not what is in the list.
- **A piece whose name never arrived** keeps its slot label with nothing after it, for you to fill in after copying.
- **Your character's name is never in the list**, and the download is always called `glamour-equipment.md`.

### The Glamour list sheet

The sheet is headed **Glamour list** (*"GPOSERS format · N pieces · edit anything before you copy it"*). It has one row per piece: the slot, the piece's name, its dyes, and an editable **Acquisition:** field. Only the Acquisition line can be edited; everything else comes from your file and your twin picks. On a desktop, **WHAT GETS COPIED** beside the rows shows the finished list as you edit; on a phone it is under them.

Each row is marked, and the header counts the marks:

| Mark | Meaning |
|------|---------|
| **FILLED** | The line comes from the site's own table of where items come from, in the form's format, such as *Crafted (WVR Lvl. 92) / Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil)* or *Hell on Rails (Extreme)* |
| **EDITED** | You changed the line, or emptied it on purpose |
| **BLANK** | No source is known, so the field is empty: *"No source found: type one, or leave it blank"* |

The table is rebuilt after each game patch from the game's data and Teamcraft's data files. It is in English, like the form, and covers the twin the list names: pick another twin and its own line comes with it. Facewear always starts blank. A line is always one line, so a line break you type becomes a space in the list.

Typing a filled line back to what it was turns the row back to **FILLED**.

### Your edits stay on this device

Only the lines you edit are saved, in this browser's storage; filled lines are never saved, because the table supplies them again. As the sheet's footer says, *"Edits are kept on this device for each piece of gear. The character's name is never in the list, and the file itself is never saved."*

"For each piece of gear" means an edit is filed under the piece itself (its slot, the item with all its twins, and the dyes on it), not under the file or the character. Load another file that wears the same piece in the same slot with the same dyes, and your edit is already there. Change the dyes and it is a different piece as far as the list is concerned. If your browser refuses to save (a private window, or storage turned off), your edits last until you leave the page.

Picking another twin never overwrites an edit. The row warns you instead (*"You picked …, which has its own source. Your edited line is still here."*) and offers **Keep mine** or **Use new source**.

**Reset all** forgets your edits for this outfit's pieces, and nothing else.

### Copy or save

- **Copy list** copies the list with real bold, which survives a paste into Word or Google Docs. Anywhere that takes only plain text gets the same lines, without `**` marks.
- **Save .md** downloads the same list as `glamour-equipment.md`, with the bold written as Markdown `**…**`.

Close the sheet with **×**, `Esc` or a click outside it.

---

## Tips

- **Read the filled lines before you submit.** They are a starting point from game data, and a showcase may want a source the table doesn't list.
- **Check the verdict before a submission.** A piece marked **NO FIX** can't be worn in the game the way the file shows it.
- **Pick twins before you copy.** The list writes whatever each row names, and an edited Acquisition line stays with the piece when you change twins.
- **Keep the file loaded** while you work. A reload clears it, along with your twin picks; your edited Acquisition lines stay.

---

## Related Tools

- [Swatch Matcher](swatch-matcher.md) - Match the same file's hair, eye and skin colors to dyes
- [Community Presets](community-presets.md) - Where a submitted glamour palette goes
- [Favorites & Collections](favorites-collections.md) - Where palettes saved to this device go
- [Harmony Explorer](color-harmony.md) - Build on a dye from the glamour
