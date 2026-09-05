# Munsell hue-wheel data: licence / redistribution check

**This is fact-finding for a product owner, not legal advice.** I am not a lawyer; every conclusion below is a reading of primary sources I actually fetched, quoted verbatim where it matters. Anything I could not confirm from a primary source is marked **[UNVERIFIED]**.

**Scope of the need:** ~40 rows — for each principal Munsell hue (2.5R … 10RP) at one representative value/chroma, an sRGB or hue-angle number. Not a Munsell renderer, not a colour-order-system reproduction.

---

## 1. The renotation data itself (Newhall, Nickerson & Judd 1943)

**Publisher today:** RIT's Munsell Color Science Laboratory / Program of Color Science, at
`https://www.rit.edu/science/munsell-color-science-lab-educational-resources`, with the files served from `rit-mcsl.org`:

- `http://www.rit-mcsl.org/MunsellRenotation/real.dat`
- `http://www.rit-mcsl.org/MunsellRenotation/all.dat`
- `http://www.rit-mcsl.org/MunsellRenotation/1929.dat`
- `http://www.rit-mcsl.org/MunsellRenotation/real_sRGB.xls` and `real_CIELAB.xls`

**Exact wording accompanying the downloads** (quoted verbatim from the live page):

> "These files are available for download. All come "as is." We have found them useful, and done our best to ensure their accuracy. If you find out otherwise, please let us know."

> "real.dat: by the book … These are real colors only, "real" being those lying inside the Macadam limits. Specifically, these are those colors listed the original 1943 renotation article (Newhall, Judd, and Nickerson, JOSA, 1943)."

> "Flash! Here are sRGB values and CIELAB for most of the colors in the real.dat file. There are some important notes regarding these data in the spreadsheet."

> "NONE OF THESE DATA SHOULD BE CONFUSED WITH ACTUAL MEASUREMENTS FROM A MUNSELL BOOK OF COLOR!"

**There is no licence, no copyright notice, and no "educational and research use only" statement attached to the renotation files.** This is a meaningful *contrast*, not an absence I inferred: the very same page carries an explicit restriction on a *different* asset —

> "PLEASE NOTE: THESE IMAGES ARE MADE AVAILABLE FOR RESEARCH PURPOSES ONLY. All other uses are prohibited. Copyright remains with PoCS / MCSL." (METACOW test target)

and a credit request on a third —

> "We ask only that you credit the Munsell Color Science Laboratory in any publications." (METACOW)

So MCSL clearly knows how to attach terms when it wants to, and attached none to the renotation `.dat` files. The page footer carries only the boilerplate site notice, "Copyright © Rochester Institute of Technology. All Rights Reserved."

**I downloaded `real.dat` directly.** It is a 2,735-line whitespace table, header `h V C x y Y`, 40 distinct hues, V ∈ {1…9}, C ∈ {2,4,…,38}. **V=6 / C=8 exists for exactly all 40 principal hues** — i.e. the product's entire requirement is 40 rows of this file.

**Copyright status of the 1943 tables.** Optica's page for the article (`doi:10.1364/JOSA.33.000385`, JOSA 33(7):385–418) still displays "© 1943 Optical Society of America". Under US law, works published 1929–1963 needed a renewal filing in year 28 or they fell into the public domain. Whether OSA renewed this specific 1943 issue is **[UNVERIFIED]** — I did not find a Catalog of Copyright Entries record either way.

That question is largely moot, because of *Feist Publications v. Rural Telephone*, 499 U.S. 340 (1991): "Raw data are uncopyrightable facts… Copyright rewards originality, not effort," and the Court expressly rejected "sweat of the brow." Originality can subsist in "selection, coordination, and arrangement," but "the copyright does not extend to facts contained in the compilation." A 40-row extraction of measured chromaticities, re-expressed as sRGB hue angles, takes the facts and none of the arrangement.

- **EU/UK:** Directive 96/9/EC creates a *sui generis* right for substantial investment in "obtaining, verifying and presenting" contents. CJEU "spin-off" case law holds that investment in *creating* the underlying data does not count. Two mitigations here: (a) the right runs 15 years from completion, so a 1943 dataset is long expired even if it ever qualified; (b) the right protects extraction of a *substantial part* — 40 of 2,734 rows is ~1.5%.
- **Japan:** Copyright Act Art. 12-2 protects a database only where "by reason of the selection or systematic construction of information contained therein" it constitutes a creation; the individual facts are not protected.

## 2. IEEE DataPort "Munsell Re-renotation: Revised"

`https://ieee-dataport.org/documents/munsell-re-renotation-revised` (Timofeev et al., doi:10.21227/yv46-3p40, 2025-02-24).

**Correction to the brief's premise:** I could not find CC BY-NC-SA anywhere. The page's schema.org JSON-LD says `"license": "https://creativecommons.org/licenses/by/4.0/"`, and IEEE's own FAQ ("Who Owns the Datasets on IEEE DataPort?") says datasets are made available "under the terms of the 'Creative Commons' Attribution (CC-BY) license" while "the dataset owner maintains ownership." No visible per-dataset licence field renders on the page. **The CC BY-NC-SA belief is [UNVERIFIED] and appears to be wrong**; CC BY 4.0 is what the metadata asserts. Either way there is a harder blocker:

> "This dataset requires an IEEE DataPort Subscription to access." / "LOGIN TO ACCESS DATASET FILES"

Yes, the original renotation is bundled: the page states the set "includes Munsell Renotation data sourced from https://www.rit.edu/science/munsell-color-science-lab-educational-resources (file real.dat), converted to .csv format for ease of use" — that is `munsell_2-0.csv`. So this path adds a paywall and a licence obligation to obtain data that is free and unencumbered at source. Pointless.

## 3. colour-science (Python, BSD-3-Clause)

`colour/notation/datasets/munsell/all.py` (287 KB), `real.py` (158 KB), `experimental.py` (56 KB). The file header, verbatim:

```
References
----------
-   :cite:`MunsellColorSciencec` : Munsell Color Science. (n.d.). Munsell
    Colours Data. Retrieved August 20, 2014, from
    http://www.cis.rit.edu/research/mcsl2/online/munsell.php
"""
__author__ = "Colour Developers"
__copyright__ = "Copyright 2013 Colour Developers"
__license__ = "BSD-3-Clause - https://opensource.org/licenses/BSD-3-Clause"
```

The data file **declares itself BSD-3-Clause**, with the RIT page cited only as provenance. There is no third-party-data carve-out in the repo LICENSE ("Copyright 2013 Colour Developers", standard BSD-3 text) and none on colour-science.org, which says only that the library is "freely available under the BSD-3-Clause terms." Sister project `colour-datasets` is likewise BSD-3-Clause, with individual datasets hosted on Zenodo under their own terms — but the *renotation* data is in `colour` proper, not `colour-datasets`.

Implication: a well-known BSD-3 project treats the renotation table as freely redistributable and licenses its own transcription permissively. BSD-3 is MIT-compatible; the only cost of using it is carrying the Colour Developers copyright notice.

## 4. R `munsell` (Charlotte Wickham) — the cleanest source

CRAN: License **"MIT + file LICENSE"**; `LICENSE` reads `YEAR: 2016` / `COPYRIGHT HOLDER: Charlotte Wickham`.

The repo ships `inst/raw/real.dat`, `inst/raw/greys.dat`, and `inst/raw/getmunsellmap.R`. That script is the whole provenance story, verbatim in relevant part:

```r
col.map <- read.table("real.dat",  header = TRUE)
# 1. convert xyY to XYZ ... 2. Bradford C -> D65 ... 3. XYZ -> hex (sRGB)
col.map$hex <- hex(XYZ(100 * as.matrix(col.map[, c("X", "Y", "Z")])))
...
save(munsell.map,  file  = "../../R/sysdata.rda")
```

So `munsell.map` = RIT `real.dat` → XYZ → Bradford C→D65 → sRGB hex, with greys appended, shipped as `R/sysdata.rda` under MIT. The README states the basis plainly:

> "`munsell` relies directly on the published tables in Newhall, Nickerson, and Judd (1943) of CIE XYZ (Illuminant C) values for Munsell colours."

(The README's line about "hue in 2.5-step increments, value in steps of 2, chroma in steps of 1" transposes value and chroma relative to the actual `real.dat`, which is V steps of 1 and C steps of 2 — cosmetic, and the file is authoritative.)

**This is a complete, MIT-licensed Munsell→sRGB-hex table covering all 40 hues, including V=6/C=8.** It answers the requirement outright.

## 5. munsell.js (privet-kitty, MPL-2.0)

Repo LICENSE is verbatim MPL 2.0; npm `munsell@1.1.6` declares `MPL-2.0`. Data lives in `src/MRD.ts` (372 KB), whose first line is:

> `/* This file is automatically generated by fetch-mrd.lisp. */`

and `src/fetch-mrd.lisp` downloads the source at generation time:

> `(defparameter *dat-url* "http://www.rit-mcsl.org/MunsellRenotation/all.dat")`

MPL-2.0 is **file-level** copyleft. §1.4 defines Covered Software as the source form carrying the Exhibit A notice plus its Modifications; §1.10 defines Modifications as changes to, or new files containing, Covered Software; §3.3 permits a Larger Work "under terms of Your choice" provided the Covered Software files stay under MPL. **The licence text is silent on program output** — there is no output clause. The mainstream reading is that a table you *generate by running* the tool is not Covered Software, but this is an inference, not a quoted grant, so I mark it **[UNVERIFIED as a licensor position]**. If you shipped `MRD.ts` itself, that file would stay MPL inside your MIT package — legal, but it puts a copyleft file in your tree.

The same author's **`munsell-inversion-data` (MIT code)** is the useful precedent, because it addresses derived data head-on:

> "## Copying
> I don't claim any rights on the generated data (i.e. files in dat/ directory), which are all based on the [Munsell renotation data](https://www.rit.edu/cos/colorscience/rc_munsell_renotation.php). The other codes are under the MIT lincense."

`dufy` (Common Lisp), the generator behind both, is **MIT** per its GitHub licence metadata.

## 6. Other Munsell packages (one line each)

- **`munsellinterpol` (CRAN)** — GPL (≥ 3); "Based on the work by Paul Centore, 'The Munsell and Kubelka-Munk Toolbox'", follows ASTM D-1535. GPL ⇒ unusable in MIT.
- **`@pawells/colors-luts-munsell` (npm, v0.1.2)** — **MIT**, described as "Full ASTM D1535 Munsell renotation lookup-table backend (RIT/Newhall-Nickerson-Judd real.dat)". A second independent MIT npm package shipping exactly this data.
- **`munsell` (npm 1.1.6)** = munsell.js, MPL-2.0.
- **`colour-datasets` (PyPI)** — BSD-3-Clause repo; Munsell *spectral* sets (glossy/matt) hosted on Zenodo under per-dataset terms; not the renotation table.
- **`coloria-dev/color-data`** — has a `munsell/` directory; GitHub reports **no detected licence**. Avoid.
- **`pymunsell` / `munsellkit`** — not verified; **[UNVERIFIED]**.

## 7. Wikipedia / Wikimedia Commons

`https://en.wikipedia.org/wiki/Munsell_color_system` does contain a "Munsell hues; value 6 / chroma 6" table with sRGB swatches — tantalisingly close to the need. But the footer reads:

> "Text is available under the Creative Commons Attribution-ShareAlike 4.0 License; additional terms may apply."

CC BY-SA 4.0 is a copyleft licence with a ShareAlike condition on adaptations. Embedding it in an MIT npm package would either (a) fail the SA condition, or (b) force a BY-SA carve-out inside an otherwise-MIT distribution — exactly the licence contamination the monorepo's uniform MIT posture exists to avoid. Also, the article gives no derivation method for its swatches, so provenance is untraceable. **Do not use.**

## 8. JIS Z 8721 and JCRI / PCCS

**JIS Z 8721:1993 ("色の表示方法―三属性による表示")** is a Japanese Industrial Standard sold by the Japanese Standards Association; the JSA web desk footer reads "Copyright 2002- Japanese Standards Association. All Rights Reserved." The *document* is a copyrighted publication you buy; it contains no licence grant of any kind over the tables printed inside it, and JSA sells access rather than licensing redistribution. Even though JIS Z 8721 is a Munsell-derived notation, the standard is not a data source you may copy from.

**JCRI / PCCS.** PCCS (日本色研配色体系, 1966) is published by the Japan Color Research Institute (jcri.jp) and commercialised through Japan Color Enterprise Co., Ltd. (sikiken.co.jp), which sells the colour charts and the "PCCS Color Calc" software. I found **no published redistribution grant** for the PCCS tables anywhere on either site; reproduction is handled by permission request. **[UNVERIFIED negative]** — absence of a grant is what I observed, not a licensor statement that redistribution is forbidden. Treat PCCS as off-limits without written permission.

## 9. Trademark

**MUNSELL is a live, registered US trademark.** USPTO Reg. No. **1570854**, Serial **73721875**, filed 1988-04-11, registered 1989-12-12, status "800 - Registered And Renewed" (status date 2020-08-10), current owner **AMAZYS HOLDING GMBH** (the X-Rite/Veralto entity; `munsell.com` now 301-redirects to `pantone.com`). Goods and services are Class 016 —

> "COLOR CARDS, INDIVIDUAL AND WALL SIZE COLOR CHARTS, CHARTS AND FILES AND OTHER COLLECTIONS OF COLOR STANDARDS, BOOKS CONTAINING COLOR CHARTS AND COLOR STANDARDS, AND RELATED TEXT MATERIAL FOR USE IN CONNECTION WITH COLOR COMPARISON"

— and Class 020 (display fixtures, colour disks, test sets, colour fans). **Notably not Class 009 (software)** in this registration.

Using "Munsell" as a *label for the wheel mode* is classic nominative fair use: you are referring to the colour-order system by the only name it has, not branding your product. The practical hygiene is (a) do not name the feature "Munsell Wheel™"-style as if it were a product name, (b) never imply X-Rite/Pantone endorsement or that the wheel reproduces a Munsell Book of Color, and (c) carry a short "Munsell is a registered trademark of X-Rite / Amazys Holding GmbH; XIV Dye Tools is not affiliated with or endorsed by X-Rite" line. Prefer descriptive phrasing in UI copy: "Munsell hue wheel (perceptual)". Note RIT's own shouted caveat is a useful model: the data are *not* measurements from a Munsell Book of Color, and your UI should not claim otherwise.

---

## Decision: ranked paths

**(a) R `munsell` MIT data — CLEANEST. Recommended.**
Explicit MIT + named copyright holder, an unambiguous derivation script (`getmunsellmap.R`) you can read and re-run, and full 40-hue coverage. You inherit one short attribution obligation and zero copyleft. It also gives you an *independent second party* who has already made the "this is MIT-redistributable" call, which is worth more than your own judgement call on facts-vs-copyright.

**(c) RIT `real.dat` directly — equally clean legally, slightly heavier to defend.** No licence, no restriction, an explicit "as is" grant-shaped statement, contrasted on the same page with restrictions MCSL *did* attach elsewhere; measured colorimetric facts under *Feist*; 40 of 2,734 rows. RIT even publishes `real_sRGB.xls` (775 KB, live, HTTP 200) — the sRGB conversion done for you. The only wrinkle is that "no licence" means "no express permission", so you are relying on the facts doctrine rather than a grant. In practice this is what colour-science, R `munsell`, munsell.js and `@pawells/colors-luts-munsell` all do.

**(b) colour-science BSD-3 — clean, marginally more notice text.** BSD-3 is MIT-compatible; you must reproduce "Copyright 2013 Colour Developers", the conditions and the disclaimer, and you must not use the Colour name to endorse. Fine, just more NOTICE than (a).

**(e) Generate with munsell.js at build time — workable, avoids shipping MPL files, but rests on an unquoted inference.** MPL has no output clause; the standard reading says generated tables are not Covered Software, but you would be relying on that reading. It also adds an MPL devDependency and a build step for 40 numbers. Not worth it when (a) exists.

**(d) IEEE DataPort — reject.** Subscription-gated, licence field not actually displayed (metadata says CC BY 4.0, not the CC BY-NC-SA the brief assumed), and its Munsell renotation content is literally RIT's `real.dat` in CSV. All cost, no benefit.

**(f) Skip Munsell — unnecessary.** Two independent MIT sources plus an unrestricted primary source make this a non-issue.

### What I would do

Take path **(a) + (c) together**: derive the 40-row table from RIT `real.dat` at V=6/C=8, and cross-check it row-by-row against R `munsell`'s `munsell.map` hex values for the same 40 notations. Ship a generator script plus the committed 40-row JSON so the derivation is auditable. Do **not** vendor `real.dat`, `all.py`, or `MRD.ts` into the package — ship only the 40 derived pairs, which keeps you clearly on the facts side of *Feist* and clearly under the EU substantial-part threshold.

### Attribution / NOTICE text this needs

Add to `packages/core/NOTICE` (create it) and reference it from the package README:

```
Munsell hue-wheel data
----------------------
The Munsell hue-angle table in src/data/munsell-hues.json is derived from
the Munsell renotation data (real.dat) published by the Munsell Color
Science Laboratory / Program of Color Science, Rochester Institute of
Technology:
  https://www.rit.edu/science/munsell-color-science-lab-educational-resources
which in turn reproduces the tables of Newhall, S. M., Nickerson, D., &
Judd, D. B. (1943). "Final Report of the O.S.A. Subcommittee on the
Spacing of the Munsell Colors." JOSA 33(7), 385-418.
doi:10.1364/JOSA.33.000385

sRGB values were cross-checked against the R package `munsell`
(https://github.com/cwickham/munsell), Copyright (c) 2016 Charlotte
Wickham, MIT licence.

These values are computed colorimetric renotations, not measurements of
any physical Munsell Book of Color, and are not endorsed by or affiliated
with X-Rite, Pantone or Amazys Holding GmbH. MUNSELL is a registered
trademark (USPTO Reg. No. 1570854) of Amazys Holding GmbH.
```

Add the same trademark disclaimer sentence, once, to the Harmony Explorer's Munsell-wheel UI (an info tooltip is enough).

### Claims I could not verify from a primary source

1. Whether OSA renewed the copyright on the 1943 JOSA issue in 1971. **[UNVERIFIED]**
2. The brief's premise that the IEEE DataPort dataset is CC BY-NC-SA 4.0. The only licence assertion I found is CC BY 4.0 in JSON-LD plus the platform-wide CC-BY FAQ; no per-dataset licence renders on the page. **[UNVERIFIED / likely incorrect]**
3. That MPL-2.0 does not attach to a lookup table produced by running munsell.js. The licence text contains no output clause either way. **[UNVERIFIED as a licensor position]**
4. `pymunsell` / `munsellkit` licences and data sources — not examined.
5. JCRI/PCCS: I confirmed no published redistribution grant exists on their sites; I did not find an affirmative prohibition. **[UNVERIFIED negative]**
6. The full JSA terms of use for JIS documents (I have the footer copyright notice only, not the 利用規約 text).

---

## Sources

- https://www.rit.edu/science/munsell-color-science-lab-educational-resources (fetched, full HTML)
- http://www.rit-mcsl.org/MunsellRenotation/real.dat (downloaded and analysed)
- http://www.rit-mcsl.org/MunsellRenotation/real_sRGB.xls (HEAD, 200, 775,168 bytes)
- https://www.rit.edu/cos/colorscience/rc_munsell_renotation.php
- https://opg.optica.org/josa/abstract.cfm?uri=josa-33-7-385
- https://ieee-dataport.org/documents/munsell-re-renotation-revised (fetched, full HTML + JSON-LD)
- https://ieee-dataport.org/faq/who-owns-datasets-ieee-dataport
- https://raw.githubusercontent.com/colour-science/colour/develop/colour/notation/datasets/munsell/all.py
- https://api.github.com/repos/colour-science/colour/contents/colour/notation/datasets/munsell
- https://raw.githubusercontent.com/colour-science/colour/develop/LICENSE
- https://www.colour-science.org/
- https://github.com/colour-science/colour-datasets
- https://cran.r-project.org/web/packages/munsell/index.html
- https://raw.githubusercontent.com/cwickham/munsell/master/DESCRIPTION
- https://raw.githubusercontent.com/cwickham/munsell/master/LICENSE
- https://raw.githubusercontent.com/cwickham/munsell/master/README.md
- https://github.com/cwickham/munsell/tree/master/inst/raw
- https://raw.githubusercontent.com/cwickham/munsell/master/inst/raw/getmunsellmap.R
- https://github.com/privet-kitty/munsell.js
- https://raw.githubusercontent.com/privet-kitty/munsell.js/master/src/MRD.ts
- https://raw.githubusercontent.com/privet-kitty/munsell.js/master/src/fetch-mrd.lisp
- https://raw.githubusercontent.com/privet-kitty/munsell.js/master/LICENSE
- https://api.github.com/repos/privet-kitty/munsell.js/contents/src
- https://raw.githubusercontent.com/privet-kitty/munsell-inversion-data/master/README.MD
- https://api.github.com/repos/privet-kitty/munsell-inversion-data
- https://api.github.com/repos/privet-kitty/dufy
- https://cran.r-project.org/web/packages/munsellinterpol/index.html
- https://registry.npmjs.org/@pawells/colors-luts-munsell
- https://registry.npmjs.org/munsell
- https://registry.npmjs.org/-/v1/search?text=munsell
- https://api.github.com/repos/coloria-dev/color-data
- https://en.wikipedia.org/wiki/Munsell_color_system
- https://www.mozilla.org/en-US/MPL/2.0/
- https://supreme.justia.com/cases/federal/us/499/340/ (Feist)
- https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:01996L0009-20190606 (Database Directive)
- https://edri.org/our-work/edrigramnumber2-22databases/ (spin-off doctrine)
- https://www.japaneselawtranslation.go.jp/en/laws/view/3379 (Japan Copyright Act, Art. 12-2)
- https://kikakurui.com/z8/Z8721-1993-01.html (JIS Z 8721:1993 text)
- https://webdesk.jsa.or.jp/ (JSA copyright footer)
- https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+Z+8721:1993
- https://www.jcri.jp/achievement_1 (PCCS)
- https://sikiken.co.jp/products/cat_01.html (PCCS charts, Japan Color Enterprise)
- https://trademarks.justia.com/737/21/munsell-73721875.html (USPTO Reg. 1570854)
- https://en.wikipedia.org/wiki/X-Rite
- https://en.wikipedia.org/wiki/Copyright_renewal_in_the_United_States
