# 1A Dial — Harmony Explorer port spec (distilled from the design project)

Source: `Harmony Tool Directions.dc.html` (Turns 1+2, fetched 2026-08-08) +
`HarmonyScreen.dc.html`. CONFIRMED: **1A Dial is the Harmony reference spec, carrying
2B's title-menu tool switcher; 1B (Strip) and 1C (Dock) stay as the record.** 1A is the
frame the other eight tools follow — Console shell, Ticket result cards, hero wheel with
tappable nodes are shared vocabulary that later turns built on.

Note on scope: much of this doc describes the 5.0 shell at large (2B switcher, ☾/☼
theme flip, EN/DE/JA button, Advanced accordion with ALL TOOLS / THIS TOOL scope
badges) — those landed with the shell phases. This spec covers the harmony workspace
deltas the 2.6f pass owes.

## The 1A workspace (the straight read: wheel → picker → grid)

1. **Hero wheel with tappable nodes**: a big dial with 44px node pucks — tapping a puck
   jumps the base dye to that node. The base swatch lives in the hub. **The wheel is
   always drawn**: empty state just desaturates it and drops the nodes, so the tool
   never renders as a blank canvas.
2. **Type rail**: all nine harmony types as a scrolling icon rail (icons from the
   Phase-0 icon home's harmony-type ring set). Desktop: type chips centred over the
   wheel. Mobile: the rail carries a first-run swipe hint that clears the moment the
   user scrolls or picks a type.
3. **Two-up Ticket grid** below: one Result Card per harmony slot. **Companion
   alternates are swatch dots on each card** — one tap swaps that slot's dye without
   leaving the grid. The alternates count comes from Advanced's "Companion dyes" slider
   (1–5, desc: "Alternates offered per harmony slot.").
4. **Market rows resolve in place** inside the Ticket rather than blocking the card; a
   failed fetch degrades to **one dismissible strip** instead of an error per card.
   Empty and market-fetch states sit at the bottom of the flow.
5. Base-dye picker: pool count + category chips + search (the drawn sheet), reachable
   from the hub/base card.

## Deltas vs the shipped tool (the 2.6f work list)

- The shipped wheel display is passive — nodes are not tappable pucks and the base does
  not live in a hub. Port the interaction: puck tap → base jump.
- Harmony types today are a dropdown/chips in varying places; 1A makes them the icon
  rail/centred chips with the ring-set icons.
- Companion alternates exist as data (harmony generator offers alternates) but not as
  swatch dots on cards with one-tap swap.
- Empty state today blanks the workspace; 1A never blanks the wheel.
- Market failure today errors per-card; 1A uses the single dismissible strip.
- v4-shell reality applies (9C lesson): leftPanel === rightPanel — one main flow;
  non-Lit tool content is inside the shell's shadow DOM → inline styles.

## Strings

The doc's UI/L blocks carry en/de/ja verbatim for: baseDye, companionDyes, results,
share, done, marketBoard/showPrices notes, alternate/alternates, slots. Most already
exist in the shipped harmony.* namespace — the string pass should diff rather than
re-add; alternates/slot vocabulary is the likely gap. fr/ko/zh authored for any new
keys.

## Order within 2.6f

Harmony (this spec) → Gradient → Mixer → Extractor, each with its own direction-doc
fetch + spec + strings + port, per the standing loop.
