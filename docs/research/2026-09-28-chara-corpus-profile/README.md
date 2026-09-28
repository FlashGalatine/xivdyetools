# `.chara` parser — profile of 1,142 real files (2026-09-28)

**Question:** does the `.chara` parser hold up against a large real-world corpus, and do the rules
in its header (measured on 112 files for Swatch Matcher 10A, and on 47 for the equipment work)
still stand?

**Outcome:** every file parses, but the corpus overturned the eye-pairing and float-decoding
rules, showed that a dye can sit on an empty slot, and found that the game stores skin, hair and
light-lip floats as shading values rather than as the creator's swatch (confirmed in the
creator). All fixed in core 5.6.0; live-float files now show OFF GRID only for a real custom
color. One question stays open: [the creator's highlight swatches](#open-highlight-swatches).

## Corpus and method

1,142 `.chara` files collected by the maintainer (7.7 MB, kept outside the repo; 45 groups of
byte-identical files, 94 files in all, so counts that depend on independence are taken over
distinct files). Producers, by `TypeName`:

| `TypeName` | Files | Extended floats | `IsExtendedAppearanceValid` |
|---|---:|---|---|
| `Anamnesis Character File` | 961 | 957 carry them | never written |
| *(none)* | 99 | 88 carry them, 11 write `null` | 66 write `true` |
| `Ktisis/Anamnesis Character File` | 57 | none | never written |
| `Ktisis Character File` | 25 | none | never written |

The files with no `TypeName` also leave `Author`, `Description`, `Version`, `Tags` and
`Base64Image` null and carry the Dawntrail-era `SkinGloss` / `HairGloss` / `MuscleTone`, so they
are recent — probably Brio, not the "old Anamnesis" the test suite named them. They are the only
producer whose floats can count as live.

Method: the corpus was run through core's own `parseCharaFile` and `resolveCharaColors` (from
source, under `tsx`), and each float compared with the palette entry its index names, in
ΔE2000. Where one palette entry recurs across files, the floats were compared with each other too.

- **Nothing failed to parse.** All 16 tribes, both genders and every `Race` spelling are known.
- **Floats are deterministic.** For every tribe/gender/index seen in two or more distinct files,
  the float is identical in all of them (hair 122 of 122 groups, skin 103 of 104, limbal 61 of
  62). They are values the game derives from the palette entry, not colors players edited. A few
  real custom colors do exist (3 eye floats and 1 limbal float land on no palette entry at all).

## Fixed in core 5.6.0

### Floats are the color squared, not sRGB-linear

The game stores each channel as `(n/255)²` — a gamma-2.0 linear light. The square root is the
color: the fitted exponent is 2.000, and eye and highlight floats land on their palette entry at
ΔE 0.00 (median and p10). The sRGB curve the parser used read every one about 3 ΔE off, under
the OFF GRID threshold of 6, so the error hid as "agreeing".

22 files (all with no `TypeName`) store zeros in every channel of every float, `MouthColor` alpha
included. Nothing was read; the block now counts as absent rather than as a black character
with no lip.

### Eye keys pair by name

The 10A rule said `REyeColor` holds the **left** eye, crossed against the float names. With the
floats decoded correctly, each lands exactly on one palette entry, and the pairing can be read
off the data:

| Heterochromia files with floats | Pairing |
|---|---:|
| `REyeColor` ↔ `RightEyeColor` (by name) | 153 (all 143 Anamnesis, 10 with no `TypeName`) |
| `REyeColor` ↔ `LeftEyeColor` (crossed) | 4 (all with no `TypeName`, all marked valid) |

Crossing is per file: one player's files go both ways ("[Reporter]" crossed; "[Default]",
"[Wuxia]" and "[Halloween]" by name). The fixture the 10A rule was read from,
`duskwight-heterochromia.chara`, is one of the four. The parser now pairs by name, and the
resolver swaps a file's two eye floats only when each lands on the *other* eye's palette entry and
neither on its own.

### The limbal/tattoo float carries a factor of 0.643

`LimbalRingColor` is `0.643 × (n/255)²` (1,039 bright channels: p10 0.6415, median 0.6426, p90
0.6485). Divided out, every limbal float in the corpus lands within ΔE 3.5 of its palette entry;
the lone exception (a factor of 4–6.5) is a real custom color. Tattoo entry 7 is stored as an
exact zero: all 194 files with a zero `LimbalRingColor` sit on entry 7, and entry 7 never carries
anything else.

### A dye on an empty slot

33 files carry a `DyeId` on a slot with nothing in it (main hand 14, hands 12, off hand 10, head
9, feet 2, legs 1), including stains 254/255 that Anamnesis writes on a hidden weapon (model set
0, base 0, variant 1). The parser emitted them, and the GPOSERS export printed a bare slot plus
its dye for gloves nobody wore. A dye is now read only off a worn slot.

### Effect, in the 66 files whose floats are live

| Slot | OFF GRID before | After |
|---|---:|---:|
| Left / right eye | 11 / 11 | 1 / 1 (a real custom color) |
| Limbal / tattoo | 32 | 0 |
| Skin | 66 | 0 |
| Hair | 31 | 0 |
| Lip | 7 | 0 |

Skin, hair and lip reach zero through the shading-value finding below.

Across the whole corpus, 22 lips that read as "no lip" off the never-read block now resolve
from their index.

## Skin, hair and light-lip floats are shading values

These floats are as deterministic as the rest, but none of them is the palette color our sheets
hold, so every live file reported them OFF GRID although nobody edited them:

- **Skin** matches in no file (0 of 338 distinct entries). Red is kept; green and blue rise by
  about 1.47× and 1.78× in linear light.
- **Hair** indices 0–31 match 70% of the time; from 32 up, 2% or less — in every tribe and in
  files from 2022 to 2026 alike. The mismatches read as the swatch desaturated.
- **Light-palette lips** (index 128+): the float equals the **dark** sheet's entry at the same
  position in 358 of 358 files. Dark-palette lips match exactly (270 of 271).

Either the game shades these slots from values other than the creator's swatches, or our sheets
were wrong; the files cannot tell which, so the maintainer checked the character creator on
2026-09-28. On the Hair Color screen with Raen ♀ hair 42 selected, the hair palette reads
**RGB 255,220,152 — `#FFDC98`, exactly our sheet** — while every file stores `#E5D2AC` for that
entry. Sampling the whole screenshot confirms it beyond the one readout: the creator draws its
swatches about 1.086× brighter than their values (clipping the brightest cells and lifting the
darkest), and with that divided out its hair grid matches our Au Ra hair sheet to within 0–2
levels in the mid-tone columns of all 24 rows. (Raen ♀, Raen ♂ and Xaela ♀ share one hair sheet.)

So the sheets hold the swatch and the game stores a shading value derived from it. Core 5.6.0
no longer judges skin or hair floats against the swatch, and judges a light-palette lip against
the dark entry the game stores for it. Nothing real is lost: no file in the corpus had edited
one, since the float is identical wherever an entry recurs.

## Open: highlight swatches

The same screenshot shows the highlights palette beside the hair palette, and there the check
runs the other way. At all 98 highlight indices used in the corpus, the stored float equals our
highlight sheet exactly, so comparisons are sound. But the creator's own highlight swatch
differs at some cells: with 42 selected it reads **RGB 225,186,112**, where the stored value
(and our sheet) is 255,186,86. With the brightening divided out, the creator's highlight grid
matches our sheet in most mid-tone cells but not around 40–43 or in rows 12, 20 and 21, where it
is less saturated. For those entries the Swatch Matcher shows the stored color rather than the
one the player picked from. Correcting them needs each cell's RGB readout; a screenshot's
pixels are not exact enough.

## Also seen, no change needed

- `FacePaintColor` 127 (in the gap between the dark and light ranges) in 2 files — the resolver's
  loud `midRangeIndex` slot error is the intended answer.
- 2022-era Anamnesis writes `{}` for a slot with nothing in it (it omits zero fields); the parser
  already reads that as empty.
- A worn piece with model variant 0 (7 files) and an off hand worn with no main hand (1 file) —
  questions for the item lookup, not the parser.
