/**
 * XIV Dye Tools 5.0 — DYES ON THIS GLAMOUR (Turn 11 of the 10A sheet).
 *
 * What the loaded character is wearing: every piece with the dye on each
 * channel, where to look a piece up ("Open in…"), the Copy list / Export .md
 * submission template, and Make a palette — the 3–6 floor/cap enforced at the
 * action buttons, Save to this device creating a `kind: 'palette'`
 * CollectionService record, Submit to Community handing off to the host.
 *
 * Reads the loaded character from CharaSessionService. The Swatch Matcher
 * imports this module on demand, once a file wears anything, so the block is
 * charged to its own chunk instead of the swatch chunk's size budget.
 *
 * Renders inside the v4 shell's shadow DOM — inline styles + one injected
 * <style> block for the responsive grid.
 *
 * Spec: docs/research/monorepo-2.0/10a-sheet-port-spec.md (10A "Sheet")
 *
 * @module components/glamour-block
 */

import {
  charaPieceTone,
  charaTwinsOf,
  defaultCharaTwin,
  formatCharaModelLabel,
  facewearColors,
  type CharaPieceProblem,
  type CharaPieceTone,
  type CharaTwin,
  type ResolvedCharaCharacter,
  type ResolvedGearDye,
  type CharaGearSlotId,
} from '@xivdyetools/core';
import { CollectionService, LanguageService, StorageService, ToastService } from '@services/index';
import { CharaSessionService, type CharaSession } from '@services/chara-session-service';
import {
  resolveCharaEquipment,
  itemNameFor,
  charaIconUrl,
  type CharaItemNames,
  type CharaResolveResult,
  type CharaResolvedItem,
} from '@services/chara-resolve-service';
import type { ItemLinksMenuTarget } from '@components/item-links-menu';
import {
  INSET_RING,
  MONO,
  SANS,
  amber,
  dyeName,
  el,
  green,
  hasGlamour,
  monoChip,
  tSwatch,
} from '@components/chara-ui';
import { ICON_TOOL_PRESETS } from '@shared/tool-icons';
import { STORAGE_PREFIX } from '@shared/constants';
import { logger } from '@shared/logger';
import { copyRichTextToClipboard } from '@shared/clipboard';
import { clearContainer } from '@shared/utils';
import type { Dye } from '@xivdyetools/types';

/** Glamour export floor/cap (confirmed: floor 3 — Turn 10; hard cap 6 — Review). */
const PALETTE_FLOOR = 3;
const PALETTE_CAP = 6;

/** A worn piece's twins as the reader shows them (spec G3–G5). */
interface TwinState {
  twins: Array<CharaTwin<CharaItemNames>>;
  /** The twin the default rule names */
  best: CharaTwin<CharaItemNames>;
  /** The twin the list names: the player's pick, else `best` */
  picked: CharaTwin<CharaItemNames>;
  tone: CharaPieceTone;
}

/** The twelve dyeable slots — the footnote's "N slots are empty" denominator. */
const GEAR_SLOT_COUNT = 12;

/**
 * DYES ON THIS GLAMOUR lens (Turn 11, confirmed): Pieces (11a, default) puts
 * the item under the dyes' feet; Dyes (11c) flips the unit to the dye with
 * carriers as icons. Persists per user.
 */
type GlamourView = 'pieces' | 'dyes';
const GLAMOUR_VIEW_KEY = `${STORAGE_PREFIX}_swatch_glamour_view`;

function readGlamourView(): GlamourView {
  return StorageService.getItem<string>(GLAMOUR_VIEW_KEY) === 'dyes' ? 'dyes' : 'pieces';
}

/**
 * "Show all pieces" — the Pieces lens' second axis. Off, the block lists dyed
 * channels (the shipped behaviour); on, it lists every piece the character
 * actually wears, so worn-undyed armour, the five accessory slots and the
 * facewear get rows. Empty slots never become rows either way — they stay in
 * the footnote, which is the honest place for "nothing is there".
 */
const SHOW_ALL_KEY = `${STORAGE_PREFIX}_swatch_glamour_show_all`;

/**
 * The "Open in…" menu is reached by clicking a row and by nothing else, so it
 * is loaded on that click rather than shipped with the block — the same
 * arrangement as the preset submission form the host opens. Statically
 * imported it once put the swatch chunk 3 KB over its budget, and every
 * visitor who never opens the menu paid for it.
 */
let itemLinksMenu: typeof import('@components/item-links-menu') | null = null;
/** Invalidates lazy opens even before the menu module has loaded. */
let itemLinksOpenToken = 0;

/** Dismiss the menu if it was ever loaded. Never loads it just to close it. */
function closeItemLinksMenuIfLoaded(): void {
  itemLinksOpenToken += 1;
  itemLinksMenu?.closeItemLinksMenu();
}

function readShowAllPieces(): boolean {
  return StorageService.getItem<string>(SHOW_ALL_KEY) === 'on';
}

/**
 * Slots whose items carry dye channels. The five accessory slots are absent
 * on purpose: no FFXIV earring, necklace, bracelet or ring is dyeable, so a
 * chip there would invent a channel the game does not have.
 *
 * `shared/glamour-markdown` keeps its own copy (`DYEABLE`) — change both.
 */
const DYEABLE_SLOTS: ReadonlySet<CharaGearSlotId> = new Set<CharaGearSlotId>([
  'MainHand',
  'OffHand',
  'HeadGear',
  'Body',
  'Hands',
  'Legs',
  'Feet',
]);

/** The two dye channels a dyeable piece always has, in `DyeId` / `DyeId2` order. */
const DYE_CHANNELS = [1, 2] as const;

/**
 * Facewear is a thirteenth row rather than a gear slot: `.chara` carries only
 * `Glasses.GlassesId`, and neither the file nor api-worker says which of the
 * eleven facewear colours the frame is. FFXIV names most facewear by its
 * colour ("Silver Spectacles"), so the EN name is the only signal there is —
 * a match tints the chip, no match leaves it neutral. Never a guess dressed
 * as data: the chip's title says which colour was read.
 */
const FACEWEAR_ROW_SLOT = 'Facewear';

/**
 * Facewear colour names matched as whole WORDS, against the EN name only —
 * the eleven colours are EN-only data, and a substring test would read
 * "Brass" out of a hypothetical "Brassard". Ordered by first occurrence in
 * the name, so "Silver and Gold Spectacles" reads as silver.
 */
const FACEWEAR_NAME_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = facewearColors.map(
  (color) => ({ id: color.id, re: new RegExp(`\\b${color.name}\\b`, 'i') })
);

function facewearColorForName(nameEn: string): (typeof facewearColors)[number] | null {
  let best: { at: number; id: string } | null = null;
  for (const { id, re } of FACEWEAR_NAME_PATTERNS) {
    const match = re.exec(nameEn);
    if (match && (best === null || match.index < best.at)) best = { at: match.index, id };
  }
  return best ? (facewearColors.find((c) => c.id === best!.id) ?? null) : null;
}

/**
 * Responsive equipment grid — injected once per render (shadow-DOM scoped).
 * 2-up (Turn 11: rows grew 40 → 48 px and the JA/DE item names are the width
 * budget — they wrap, never ellipsise), 1-up on phones.
 */
const GLAMOUR_CSS = `
.chara-equip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
@media (max-width: 768px) {
  .chara-equip-grid { grid-template-columns: 1fr; }
}
`;

export interface GlamourBlockCallbacks {
  /** Make-a-palette submit: kept worn dyes + the panel's name draft */
  onSubmitPalette?: (dyes: Dye[], name?: string) => void;
  /**
   * Where Copy list / Export .md go. The Glamour Reader puts them in its own
   * header (design 1a); without a host they sit in the block's header.
   */
  actionsHost?: HTMLElement;
}

/**
 * DYES ON THIS GLAMOUR for whatever character is loaded; empty when none is,
 * or when the character wears nothing.
 */
export class GlamourBlock {
  private container: HTMLElement;
  private callbacks: GlamourBlockCallbacks;
  /** The loaded character this block is drawing (from the session) */
  private resolved: ResolvedCharaCharacter | null = null;
  private fileName: string | null = null;
  /** Deduped worn dyes; entries toggled off before palette actions */
  private droppedStainIds = new Set<number>();
  /** Make-a-palette panel expansion state (survives re-renders) */
  private paletteOpen = false;
  /** Name field draft; null = empty field (deliberately NOT the character's nickname) */
  private paletteNameDraft: string | null = null;
  /** Equipment identity from api-worker — null until the round-trip lands */
  private equipment: CharaResolveResult | null = null;
  private resolveState: 'idle' | 'resolving' | 'ready' | 'unavailable' = 'idle';
  private resolveAbort: AbortController | null = null;
  /** Pieces (11a, default) or Dyes (11c) — persists per user */
  private glamourView: GlamourView;
  /** Show all pieces, not just dyed ones — Pieces lens only; persists per user */
  private showAllPieces: boolean;
  private glamourBox: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  /**
   * Twin picks, by slot: which identical item the list names. They live with
   * the session and never in storage (design 1a), so a new file starts clean.
   */
  private picks = new Map<CharaGearSlotId, number>();

  constructor(container: HTMLElement, callbacks: GlamourBlockCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.glamourView = readGlamourView();
    this.showAllPieces = readShowAllPieces();
  }

  init(): void {
    this.unsubscribe = CharaSessionService.subscribe((session) => this.show(session));
    this.show(CharaSessionService.getSession());
  }

  /**
   * Draw into `container` from now on. The host calls this when it re-renders
   * around the block (a language switch rebuilds the Swatch Matcher's panel),
   * so the palette draft, dropped chips and item names survive the redraw.
   */
  moveTo(container: HTMLElement, actionsHost?: HTMLElement): void {
    clearContainer(this.container);
    this.container = container;
    if (actionsHost) this.callbacks.actionsHost = actionsHost;
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.resolveAbort?.abort();
    this.resolveAbort = null;
    // The menu lives in document.body, so nothing here would remove it — it
    // would float over the next tool, anchored to a row that is gone.
    closeItemLinksMenuIfLoaded();
    clearContainer(this.container);
    if (this.callbacks.actionsHost) clearContainer(this.callbacks.actionsHost);
    this.resolved = null;
    this.fileName = null;
    this.equipment = null;
    this.glamourBox = null;
  }

  /**
   * Adopt the loaded character (or none). A new file starts from a clean
   * palette draft and its own item lookup; the lens and Show all are the
   * user's, so they carry over.
   */
  private show(session: CharaSession | null): void {
    this.resolved = session?.resolved ?? null;
    this.fileName = session?.fileName ?? null;
    this.droppedStainIds.clear();
    this.picks.clear();
    this.paletteOpen = false;
    this.paletteNameDraft = null;
    // Dyes never wait: the round-trip is started first so the block renders
    // in its RESOLVING state (skeleton where the name lands) with the file's
    // stains already on it; the names re-render the block in place.
    this.startResolve();
    this.render();
  }

  private render(): void {
    closeItemLinksMenuIfLoaded();
    clearContainer(this.container);
    const glamour = this.resolved ? this.renderGlamour() : null;
    if (!glamour) {
      this.glamourBox = null;
      // No file, no list: the host's Copy list / Export .md go with it.
      if (this.callbacks.actionsHost) clearContainer(this.callbacks.actionsHost);
      return;
    }
    const style = document.createElement('style');
    style.textContent = GLAMOUR_CSS;
    this.container.appendChild(style);
    this.container.appendChild(glamour);
  }

  // ==========================================================================
  // Equipment identity (Turn 11) — the resolve round-trip
  // ==========================================================================

  /**
   * One POST per file — model keys only, nothing else from the file. A
   * failure costs labels, not data: the rows fall back to exactly the shipped
   * row (slot tag + dye names) plus one quiet line under the list.
   */
  private startResolve(): void {
    this.resolveAbort?.abort();
    this.resolveAbort = null;
    this.equipment = null;
    const resolved = this.resolved;
    if (!resolved) {
      this.resolveState = 'idle';
      return;
    }
    if (resolved.gearModels.length === 0 && resolved.glassesId === null) {
      this.resolveState = 'ready';
      this.equipment = { items: {}, glasses: null, version: null };
      return;
    }
    const controller = new AbortController();
    this.resolveAbort = controller;
    this.resolveState = 'resolving';
    void resolveCharaEquipment(resolved.gearModels, resolved.glassesId, controller.signal).then(
      (result) => {
        if (controller.signal.aborted || this.resolved !== resolved) return;
        this.equipment = result;
        this.resolveState = 'ready';
        this.rerenderGlamour();
      },
      (error: unknown) => {
        if (controller.signal.aborted || this.resolved !== resolved) return;
        logger.warn('[GlamourBlock] Equipment names unavailable:', error);
        this.resolveState = 'unavailable';
        this.rerenderGlamour();
      }
    );
  }

  /**
   * What api-worker said about a slot: an item, `null` for "no Item row"
   * (NPC / prop model), or `undefined` when nothing has been said yet — not
   * resolved, unavailable, or a dye on a slot the file wears nothing in.
   */
  private itemFor(slot: CharaGearSlotId): CharaResolvedItem | null | undefined {
    return this.equipment?.items[slot];
  }

  /** Swap the mounted block for a fresh render, in place. */
  private rerenderGlamour(): void {
    const old = this.glamourBox;
    if (!old || !old.isConnected) return;
    // Switching lens or toggling Show all replaces every row, so a menu open
    // over one of them is anchored to a node about to be discarded.
    closeItemLinksMenuIfLoaded();
    const fresh = this.renderGlamour();
    if (fresh) old.replaceWith(fresh);
    else old.remove();
  }

  /**
   * Make `node` raise the "Open in…" menu for one piece.
   *
   * The icon tile and the item name are both triggers, so the whole readout a
   * reader looks at is the thing they can click. `node` becomes a real button:
   * a `<span>` with a click handler is reachable by mouse only, and the tile
   * in particular is `aria-hidden` decoration until it earns a label here.
   *
   * Rows without a resolved item pass nothing to this — an NPC or prop model
   * has no Item id and no name, and there is no honest link to offer.
   */
  private attachItemLinks(node: HTMLElement, target: ItemLinksMenuTarget, title: string): void {
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
    node.removeAttribute('aria-hidden');
    node.setAttribute('aria-haspopup', 'menu');
    node.setAttribute('aria-expanded', 'false');
    node.setAttribute(
      'aria-label',
      LanguageService.tInterpolate('swatch.itemLinks.openInFor', { item: title })
    );
    node.style.cursor = 'pointer';
    node.dataset.itemLinks = 'trigger';

    const open = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      const token = ++itemLinksOpenToken;
      void import('@components/item-links-menu')
        .then((module) => {
          itemLinksMenu = module;
          if (token !== itemLinksOpenToken || !node.isConnected) return;
          module.showItemLinksMenu({ target, anchorElement: node, title });
        })
        .catch((error: unknown) => logger.warn('[ItemLinks] menu unavailable', error));
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') open(event);
    });
  }

  /** The menu target for a gear slot — the twin the list names — or null when the row has no item. */
  private itemLinkTarget(slot: CharaGearSlotId): ItemLinksMenuTarget | null {
    const item = this.itemFor(slot);
    if (!item) return null;
    const shown = this.twinState(slot)?.picked ?? item;
    return { kind: 'gear', itemId: shown.itemId, names: shown.names };
  }

  /** Worn dyes deduped by stain ID, in wear order. */
  private wornDyes(): Array<{ stainId: number; dye: Dye | null }> {
    if (!this.resolved) return [];
    const seen = new Map<number, Dye | null>();
    for (const gear of this.resolved.gearDyes) {
      if (!seen.has(gear.stainId)) seen.set(gear.stainId, gear.dye);
    }
    return Array.from(seen.entries()).map(([stainId, dye]) => ({ stainId, dye }));
  }

  // ==========================================================================
  // DYES ON THIS GLAMOUR + Make a palette
  // ==========================================================================

  /**
   * Turn 11 (confirmed): 11a Named rows is the default lens — each dyed piece
   * gains the item it sits on (icon, slot overline, name, dyes, chips at the
   * row's end); 11c Dye-led is the second lens — one row per unique dye with
   * its carriers as icons. Both sit behind the Pieces/Dyes toggle in the
   * block head. Only DYED pieces are rows; the footnote splits worn-undyed
   * pieces from empty slots. Five states ride either lens: RESOLVING
   * (skeleton where the name lands), NAMES UNAVAILABLE (shipped row + one
   * quiet line), SAME MODEL ×N (badge + tooltip), NO ITEM ROW (the packed
   * key), ICON MISSING (a blank tile, never a broken row).
   */
  private renderGlamour(): HTMLElement | null {
    const resolved = this.resolved!;
    // The block used to appear only for a dyed glamour. Show all pieces has to
    // be reachable from a wholly undyed one too, so anything WORN earns the
    // block (facewear included); a character wearing nothing still gets none.
    if (!hasGlamour(resolved)) {
      this.glamourBox = null;
      return null;
    }

    const box = el(
      'div',
      'padding: 11px 12px; border-radius: 14px; margin-bottom: 12px; background: var(--theme-background-secondary); border: 1px solid var(--theme-border); display: flex; flex-direction: column; gap: 9px; width: 100%; box-sizing: border-box;'
    );
    box.dataset.role = 'glamour-block';
    this.glamourBox = box;

    // The reader's verdict comes first; the rows explain it (design 1a).
    const verdict = this.renderVerdict();
    if (verdict) box.appendChild(verdict);

    // Header: equipHead + counts left; Pieces/Dyes toggle + Make-a-palette right.
    const uniq = this.wornDyes();
    const channelCount = resolved.gearDyes.length;

    const header = el(
      'div',
      'display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;'
    );
    const headerLeft = el(
      'span',
      'display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap;'
    );
    headerLeft.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; color: var(--theme-text-muted); text-transform: uppercase;`,
        tSwatch('equipHead')
      )
    );
    headerLeft.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 9px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        LanguageService.tInterpolate('swatch.equipCount', {
          channels: channelCount,
          dyes: uniq.length,
        })
      )
    );
    header.appendChild(headerLeft);

    const headerRight = el(
      'span',
      'display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0;'
    );
    headerRight.appendChild(this.renderViewToggle());
    headerRight.appendChild(this.renderShowAllSwitch());
    const actionsHost = this.callbacks.actionsHost;
    if (actionsHost) {
      clearContainer(actionsHost);
      for (const action of this.renderListActions()) actionsHost.appendChild(action);
    } else {
      for (const action of this.renderListActions()) headerRight.appendChild(action);
    }

    const paletteBtn = el(
      'button',
      `display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 11px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; ${
        this.paletteOpen
          ? 'background: var(--theme-primary); color: #fff; border: 1px solid var(--theme-primary);'
          : 'background: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);'
      }`
    );
    (paletteBtn as HTMLButtonElement).type = 'button';
    const glyph = el(
      'span',
      'display: block; width: 14px; height: 14px; flex-shrink: 0; color: currentColor;'
    );
    glyph.innerHTML = ICON_TOOL_PRESETS || '';
    paletteBtn.appendChild(glyph);
    paletteBtn.appendChild(el('span', '', tSwatch('makePalette')));
    paletteBtn.addEventListener('click', () => {
      this.paletteOpen = !this.paletteOpen;
      this.render();
    });
    headerRight.appendChild(paletteBtn);
    header.appendChild(headerRight);
    box.appendChild(header);

    const bySlot = this.dyesBySlot();
    // With nothing dyed there is no row to draw in either lens — one quiet
    // line stands in, so the block (and the switch above it) stays reachable.
    box.appendChild(
      resolved.gearDyes.length === 0 && !this.showAllActive()
        ? this.renderNoDyedPieces()
        : this.glamourView === 'dyes'
          ? this.renderDyeRows()
          : this.renderPieceRows(bySlot)
    );
    box.appendChild(this.renderGlamourFoot(bySlot));

    if (this.paletteOpen) {
      box.appendChild(this.renderPalettePanel());
    }

    return box;
  }

  /** Dyed channels grouped by slot, in file slot order. */
  private dyesBySlot(): Map<CharaGearSlotId, ResolvedGearDye[]> {
    const bySlot = new Map<CharaGearSlotId, ResolvedGearDye[]>();
    for (const gear of this.resolved!.gearDyes) {
      const list = bySlot.get(gear.slot) ?? [];
      list.push(gear);
      bySlot.set(gear.slot, list);
    }
    return bySlot;
  }

  /** Localised slot label (the design's GEAR_LABELS) — the mono overline uppercases it. */
  private gearSlotLabel(slot: CharaGearSlotId): string {
    return tSwatch(`gearSlot.${slot}`);
  }

  /** Pieces | Dyes — two-position pill, accent on the live lens. */
  private renderViewToggle(): HTMLElement {
    const wrap = el(
      'span',
      'display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--theme-card-background); border: 1px solid var(--theme-border);'
    );
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', tSwatch('equipHead'));
    for (const view of ['pieces', 'dyes'] as const) {
      const active = this.glamourView === view;
      const btn = el(
        'button',
        `min-height: 26px; padding: 0 10px; border-radius: 6px; cursor: pointer; font-family: ${SANS}; font-weight: 600; font-size: 11px; border: none; ${
          active
            ? 'background: var(--theme-primary); color: #fff;'
            : 'background: transparent; color: var(--theme-text-muted);'
        }`,
        tSwatch(view === 'pieces' ? 'glamourViewPieces' : 'glamourViewDyes')
      );
      (btn as HTMLButtonElement).type = 'button';
      btn.setAttribute('aria-pressed', String(active));
      btn.dataset.glamourView = view;
      btn.addEventListener('click', () => {
        if (this.glamourView === view) return;
        this.glamourView = view;
        StorageService.setItem(GLAMOUR_VIEW_KEY, view);
        this.rerenderGlamour();
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  /** True when the Pieces lens is listing every worn piece, not just dyed ones. */
  private showAllActive(): boolean {
    return this.showAllPieces && this.glamourView === 'pieces';
  }

  /**
   * Show all — a switch, not a third pill position: it is orthogonal to the
   * lens rather than another value of it. The Dyes lens has no undyed unit to
   * show, so there it goes inert rather than vanishing; a control that
   * disappears reflows the header every time you change lens.
   */
  private renderShowAllSwitch(): HTMLElement {
    const inert = this.glamourView !== 'pieces';
    const on = this.showAllPieces;
    const btn = el(
      'button',
      `display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 9px 0 7px; border-radius: 8px; font-family: ${SANS}; font-size: 11px; font-weight: 600; background: var(--theme-card-background); border: 1px solid var(--theme-border); color: ${
        inert ? 'var(--theme-text-muted)' : 'var(--theme-text)'
      }; cursor: ${inert ? 'not-allowed' : 'pointer'}; opacity: ${inert ? '0.55' : '1'};`
    );
    const button = btn as HTMLButtonElement;
    button.type = 'button';
    button.disabled = inert;
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', String(on));
    btn.dataset.role = 'show-all-switch';

    // Track + knob. `aria-checked` is the accessible truth; this is its picture.
    const track = el(
      'span',
      `display: block; position: relative; width: 26px; height: 15px; flex-shrink: 0; border-radius: 999px; transition: background 120ms ease; background: ${
        on ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text) 22%, transparent)'
      };`
    );
    track.setAttribute('aria-hidden', 'true');
    track.appendChild(
      el(
        'span',
        `display: block; position: absolute; top: 2px; left: ${on ? '13px' : '2px'}; width: 11px; height: 11px; border-radius: 50%; background: #fff; transition: left 120ms ease;`
      )
    );
    btn.appendChild(track);
    btn.appendChild(el('span', '', tSwatch('glamourShowAll')));

    btn.addEventListener('click', () => {
      if (inert) return;
      this.showAllPieces = !this.showAllPieces;
      StorageService.setItem(SHOW_ALL_KEY, this.showAllPieces ? 'on' : 'off');
      this.rerenderGlamour();
    });
    return btn;
  }

  // --------------------------------------------------------------------------
  // Copy list / Export .md — the GPOSERS submission template
  // --------------------------------------------------------------------------

  /**
   * Two quiet secondary buttons beside Make a palette. Both write the WHOLE
   * worn glamour in the template's fixed order — the lens and the Show all
   * switch are ways of looking at the list, not of trimming it — and both
   * wait for item names to land, because a list copied a second early is
   * missing every piece. NAMES UNAVAILABLE still enables them: the slots and
   * dyes come from the file, and a form with blank names beats no form.
   */
  private renderListActions(): HTMLElement[] {
    const resolving = this.resolveState === 'resolving';
    const make = (role: string, label: string, onClick: () => void): HTMLElement => {
      const btn = el(
        'button',
        `min-height: 30px; padding: 0 10px; border-radius: 8px; font-family: ${SANS}; font-size: 11px; font-weight: 600; background: var(--theme-card-background); border: 1px solid var(--theme-border); color: ${
          resolving ? 'var(--theme-text-muted)' : 'var(--theme-text)'
        }; cursor: ${resolving ? 'progress' : 'pointer'}; opacity: ${resolving ? '0.55' : '1'};`,
        label
      );
      const button = btn as HTMLButtonElement;
      button.type = 'button';
      button.disabled = resolving;
      btn.dataset.role = role;
      btn.addEventListener('click', onClick);
      return btn;
    };
    return [
      make('copy-list', tSwatch('copyList'), () => this.copyList()),
      make('export-markdown', tSwatch('exportMarkdown'), () => this.exportList()),
    ];
  }

  /**
   * What either action starts from, or null before a file has resolved (the
   * buttons are not drawn then, so a click cannot reach here without one).
   */
  private listSource(): import('@components/glamour-list-actions').GlamourListSource | null {
    if (!this.resolved) return null;
    const picked: import('@components/glamour-list-actions').GlamourListSource['picked'] = {};
    for (const model of this.resolved.gearModels) {
      const state = this.twinState(model.slot);
      if (state) {
        picked[model.slot] = {
          names: state.picked.names,
          ...(state.picked.acquisition ? { acquisition: state.picked.acquisition } : {}),
        };
      }
    }
    return { resolved: this.resolved, equipment: this.equipment, picked };
  }

  /**
   * The list's builders live in `glamour-list-actions`, loaded on demand like
   * the item-links menu: only a click needs them. A load that fails (offline,
   * blocked) surfaces through the same toast the action itself would.
   */
  private loadListActions(): Promise<typeof import('@components/glamour-list-actions')> {
    return import('@components/glamour-list-actions');
  }

  /**
   * Copy starts the clipboard write HERE, synchronously in the click, and
   * hands the content over as a promise that lands once the chunk has
   * loaded. WebKit (Safari, every iOS browser) drops the click's user
   * activation across that load: a write that waited for the module would
   * be refused there, and the command fallback, gated the same way, would
   * fail behind it — a "couldn't copy" toast on every iPhone.
   */
  private copyList(): void {
    const source = this.listSource();
    if (!source) return;
    const payload = this.loadListActions().then((m) => m.glamourCopyPayload(source));
    void copyRichTextToClipboard(payload)
      .then((ok) => {
        if (ok) ToastService.success(tSwatch('listCopied'));
        else ToastService.error(tSwatch('listCopyFailed'));
      })
      .catch((error: unknown) => {
        logger.error('[GlamourBlock] Glamour list copy failed', error);
        ToastService.error(tSwatch('listCopyFailed'));
      });
  }

  /** A download needs no activation, so Export can wait for the module whole. */
  private exportList(): void {
    const source = this.listSource();
    if (!source) return;
    void this.loadListActions()
      .then((m) => m.exportGlamourList(source))
      .catch((error: unknown) => {
        logger.error('[GlamourBlock] Glamour list export failed', error);
        ToastService.error(tSwatch('listExportFailed'));
      });
  }

  /** Nothing on this glamour is dyed — say so, rather than draw an empty grid. */
  private renderNoDyedPieces(): HTMLElement {
    const line = el(
      'div',
      'font-size: 11px; line-height: 1.5; color: var(--theme-text-muted); padding: 6px 2px; overflow-wrap: anywhere;',
      tSwatch('noDyedPieces')
    );
    line.dataset.role = 'no-dyed-pieces';
    return line;
  }

  /** 20×26 dye chip — the suite's swatch vocabulary; dashed when the stain is unknown. */
  private dyeChip(gear: ResolvedGearDye): HTMLElement {
    const chip = el(
      'span',
      `display: block; width: 20px; height: 26px; border-radius: 5px; background: ${
        gear.dye?.hex ?? 'transparent'
      }; ${gear.dye ? INSET_RING : 'border: 1px dashed var(--theme-border); box-sizing: border-box;'}`
    );
    chip.title = gear.dye ? `${dyeName(gear.dye)} · ${gear.stainId}` : `#${gear.stainId}`;
    chip.dataset.role = 'dye-chip';
    chip.dataset.channel = String(gear.channel);
    return chip;
  }

  /**
   * The stand-in for a dye channel the player left empty. Deliberately a
   * SOLID recessed fill and not the dashed chip above: dashed already means
   * "a stain ID this build does not know", and undyed must not wear the
   * costume of unknown.
   */
  private undyedChip(channel: 1 | 2): HTMLElement {
    const chip = el(
      'span',
      `display: block; width: 20px; height: 26px; border-radius: 5px; background: var(--theme-background-secondary); ${INSET_RING}`
    );
    chip.title = tSwatch('undyed');
    chip.dataset.role = 'undyed-chip';
    chip.dataset.channel = String(channel);
    return chip;
  }

  /**
   * A dyeable piece's chips, always both channels in `DyeId` / `DyeId2` order,
   * so chip POSITION is readable as the channel. Before this, a piece dyed
   * only on its second channel drew a single chip in the first chip's place —
   * the picture said channel 1 and the file said channel 2.
   */
  private channelChips(slot: CharaGearSlotId, dyes: ResolvedGearDye[]): HTMLElement[] {
    if (!DYEABLE_SLOTS.has(slot)) {
      // An accessory carrying a dye is not a thing FFXIV can produce, but if a
      // file says so, show what it says rather than dropping the data.
      return dyes.map((gear) => this.dyeChip(gear));
    }
    return DYE_CHANNELS.map((channel) => {
      const gear = dyes.find((g) => g.channel === channel);
      return gear ? this.dyeChip(gear) : this.undyedChip(channel);
    });
  }

  /**
   * The row's dye line. A piece with no dye at all reads "Undyed" once, not
   * twice — the doubled form only earns its place when it is telling you
   * WHICH channel is empty.
   */
  private dyeLineText(slot: CharaGearSlotId, dyes: ResolvedGearDye[]): string {
    const undyed = tSwatch('undyed');
    if (dyes.length === 0) return undyed;
    if (!DYEABLE_SLOTS.has(slot)) {
      return dyes.map((g) => (g.dye ? dyeName(g.dye) : `#${g.stainId}`)).join(' + ');
    }
    return DYE_CHANNELS.map((channel) => {
      const gear = dyes.find((g) => g.channel === channel);
      if (!gear) return undyed;
      return gear.dye ? dyeName(gear.dye) : `#${gear.stainId}`;
    }).join(' + ');
  }

  /** 11a — one 48px row per DYED piece: icon · slot overline (+N) · name · dyes · chips. */
  private renderPieceRows(bySlot: Map<CharaGearSlotId, ResolvedGearDye[]>): HTMLElement {
    const grid = el('div', '');
    grid.className = 'chara-equip-grid';
    grid.dataset.role = 'piece-rows';
    const lang = LanguageService.getCurrentLocale();
    for (const slot of this.pieceRowSlots(bySlot)) {
      grid.appendChild(this.renderPieceRow(slot, bySlot.get(slot) ?? [], lang));
    }
    if (this.showAllActive()) {
      const facewear = this.renderFacewearRow(lang);
      if (facewear) grid.appendChild(facewear);
    }
    return grid;
  }

  /**
   * Which slots get a row. Off, that is exactly the dyed ones (the shipped
   * set). On, it is every WORN piece in file slot order — `gearModels` is
   * already in that order — with any dyed slot the file wears nothing in
   * appended, since dropping a dye the file states would lose data.
   */
  private pieceRowSlots(bySlot: Map<CharaGearSlotId, ResolvedGearDye[]>): CharaGearSlotId[] {
    if (!this.showAllActive()) return [...bySlot.keys()];
    const slots: CharaGearSlotId[] = [];
    for (const model of this.resolved!.gearModels) {
      if (!slots.includes(model.slot)) slots.push(model.slot);
    }
    for (const slot of bySlot.keys()) {
      if (!slots.includes(slot)) slots.push(slot);
    }
    return slots;
  }

  private renderPieceRow(
    slot: CharaGearSlotId,
    dyes: ResolvedGearDye[],
    lang: string
  ): HTMLElement {
    const item = this.itemFor(slot);
    const model = this.resolved!.gearModels.find((m) => m.slot === slot) ?? null;

    const row = el(
      'div',
      'display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 6px 8px; border-radius: 9px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-sizing: border-box; min-width: 0;'
    );
    row.dataset.slot = slot;

    // 28px icon tile. A failed asset leaves the tile blank — ICON MISSING
    // costs the tile, not the row (background-image errors are silent).
    const tile = el(
      'span',
      'display: block; width: 28px; height: 28px; flex-shrink: 0; border-radius: 6px; background-color: var(--theme-background-secondary); background-size: cover; background-position: center;'
    );
    tile.setAttribute('aria-hidden', 'true');
    tile.dataset.role = 'item-icon';
    if (item?.iconId) tile.style.backgroundImage = `url("${charaIconUrl(item.iconId)}")`;
    row.appendChild(tile);

    const state = this.twinState(slot);
    const shownNames = state?.picked.names ?? item?.names ?? null;
    const linkTarget = this.itemLinkTarget(slot);
    const linkTitle = shownNames ? itemNameFor(shownNames, lang) : '';
    if (linkTarget) this.attachItemLinks(tile, linkTarget, linkTitle);
    const note = this.pieceNote(slot, state, lang);

    const text = el(
      'span',
      'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;'
    );

    // Overline: localised slot tag (mono, uppercased) + SAME MODEL badge.
    const overline = el('span', 'display: flex; align-items: baseline; gap: 6px; min-width: 0;');
    overline.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.7px; color: var(--theme-text-muted); text-transform: uppercase; white-space: nowrap;`,
        this.gearSlotLabel(slot)
      )
    );
    if (item && item.familySize > 1) {
      // A third of all keys are families of visually identical items. The
      // name never pretends to be unique: +N counts the rest, the tooltip
      // lists them, prefixes are never stripped. Its colour is the row's tone
      // (design 1a): green when a twin was named to fix a problem, amber when
      // nothing fixes it, grey when the pick is just a choice.
      const tone = state?.tone ?? 'choice';
      const ink = tone === 'fix' ? green() : tone === 'block' ? amber() : 'var(--theme-text-muted)';
      const badge = el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; color: ${ink}; background: color-mix(in srgb, ${ink} 12%, transparent); border: 1px solid color-mix(in srgb, ${ink} 35%, transparent); border-radius: 4px; padding: 1px 5px; cursor: help; white-space: nowrap;`,
        `+${item.familySize - 1}`
      );
      badge.dataset.tone = tone;
      // `Intl.ListFormat` rather than `join(', ')`: a comma is not the list
      // separator in every language (ja/zh use 、, and ko/de/fr add a
      // conjunction), and the tooltip is prose, not data.
      const alternates = new Intl.ListFormat(lang, { style: 'short', type: 'unit' }).format(
        item.alternates.map((a) => itemNameFor(a.names, lang))
      );
      const truncated = item.familySize - 1 > item.alternates.length ? ' …' : '';
      badge.title = `${LanguageService.tInterpolate('swatch.sameModelList', {
        list: alternates,
      })}${truncated}`;
      badge.dataset.role = 'twin-chip';
      overline.appendChild(badge);
    }
    if (note.tag) {
      const tag = monoChip(
        LanguageService.t(note.tag === 'fixed' ? 'glamour.row.tagFixed' : 'glamour.row.tagBlocked'),
        note.tag === 'fixed' ? green() : amber(),
        'var(--theme-background-secondary)'
      );
      tag.dataset.role = 'piece-tag';
      overline.appendChild(tag);
    }
    text.appendChild(overline);

    if (item && shownNames) {
      // The item name is the label here: it wraps with lang + hyphens,
      // never an ellipsis. It is the twin the list names, not the lowest row.
      const name = el(
        'span',
        'font-size: 11.5px; line-height: 1.3; font-weight: 600; color: var(--theme-text); overflow-wrap: anywhere; hyphens: auto;',
        itemNameFor(shownNames, lang)
      );
      name.lang = lang;
      name.dataset.role = 'item-name';
      if (linkTarget) this.attachItemLinks(name, linkTarget, linkTitle);
      text.appendChild(name);
    } else if (this.resolveState === 'resolving') {
      // RESOLVING — a skeleton where the name will land, never a spinner
      // over the chips.
      const skeleton = el(
        'span',
        'display: block; width: 128px; max-width: 100%; height: 9px; margin: 3px 0; border-radius: 4px; background: color-mix(in srgb, var(--theme-text) 12%, transparent);'
      );
      skeleton.setAttribute('aria-hidden', 'true');
      skeleton.dataset.role = 'name-skeleton';
      text.appendChild(skeleton);
    } else if (item === null && model) {
      // NO ITEM ROW — NPC and prop models have none. The packed key is the
      // honest label: never an error, never a guess.
      const key = el(
        'span',
        `font-family: ${MONO}; font-size: 10px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        LanguageService.tInterpolate('swatch.modelKeyTag', {
          key: formatCharaModelLabel(model),
        })
      );
      key.dataset.role = 'model-key';
      text.appendChild(key);
    }
    // NAMES UNAVAILABLE (or a dye on a slot wearing nothing): exactly the
    // shipped row — slot tag and dye names — with no name line at all.

    const dyeLine = el(
      'span',
      'font-size: 10px; line-height: 1.3; color: var(--theme-text-muted); overflow-wrap: anywhere;',
      this.dyeLineText(slot, dyes)
    );
    dyeLine.dataset.role = 'dye-line';
    text.appendChild(dyeLine);
    if (note.text) {
      const noteLine = el(
        'span',
        'font-size: 10px; line-height: 1.35; color: var(--theme-text-muted); overflow-wrap: anywhere;',
        note.text
      );
      noteLine.dataset.role = 'piece-note';
      text.appendChild(noteLine);
    }
    row.appendChild(text);

    const chips = el('span', 'display: flex; gap: 3px; flex-shrink: 0;');
    for (const chip of this.channelChips(slot, dyes)) chips.appendChild(chip);
    row.appendChild(chips);

    if (shownNames) row.title = itemNameFor(shownNames, lang);
    return row;
  }

  /**
   * Facewear's row. It is not a gear slot and carries no dye channel, so it
   * only appears under Show all, and its chip is a facewear colour rather
   * than a stain. Renders as soon as the file declares a `GlassesId`: while
   * the resolve is in flight the name is a skeleton, exactly like a piece.
   */
  private renderFacewearRow(lang: string): HTMLElement | null {
    const glassesId = this.resolved!.glassesId;
    if (glassesId === null || glassesId === 0) return null;
    const glasses = this.equipment?.glasses ?? null;

    const row = el(
      'div',
      'display: flex; align-items: center; gap: 9px; min-height: 48px; padding: 6px 8px; border-radius: 9px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-sizing: border-box; min-width: 0;'
    );
    row.dataset.slot = FACEWEAR_ROW_SLOT;

    const tile = el(
      'span',
      'display: block; width: 28px; height: 28px; flex-shrink: 0; border-radius: 6px; background-color: var(--theme-background-secondary); background-size: cover; background-position: center;'
    );
    tile.setAttribute('aria-hidden', 'true');
    tile.dataset.role = 'item-icon';
    if (glasses?.iconId) tile.style.backgroundImage = `url("${charaIconUrl(glasses.iconId)}")`;
    row.appendChild(tile);

    // Facewear links by NAME only — `glassesId` is a Glasses sheet row, not an
    // Item id, so Eorzea Collection / GarlandTools / Teamcraft would each open
    // an unrelated item. The menu resolves the untinted base name itself.
    const linkTarget: ItemLinksMenuTarget | null = glasses
      ? { kind: 'facewear', glassesRowId: glassesId, names: glasses.names }
      : null;
    const linkTitle = glasses ? itemNameFor(glasses.names, lang) : '';
    if (linkTarget) this.attachItemLinks(tile, linkTarget, linkTitle);

    const text = el(
      'span',
      'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;'
    );
    text.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.7px; color: var(--theme-text-muted); text-transform: uppercase; white-space: nowrap;`,
        tSwatch('facewearSlot')
      )
    );

    if (glasses) {
      const name = el(
        'span',
        'font-size: 11.5px; line-height: 1.3; font-weight: 600; color: var(--theme-text); overflow-wrap: anywhere; hyphens: auto;',
        itemNameFor(glasses.names, lang)
      );
      name.lang = lang;
      name.dataset.role = 'item-name';
      if (linkTarget) this.attachItemLinks(name, linkTarget, linkTitle);
      text.appendChild(name);
    } else if (this.resolveState === 'resolving') {
      const skeleton = el(
        'span',
        'display: block; width: 128px; max-width: 100%; height: 9px; margin: 3px 0; border-radius: 4px; background: color-mix(in srgb, var(--theme-text) 12%, transparent);'
      );
      skeleton.setAttribute('aria-hidden', 'true');
      skeleton.dataset.role = 'name-skeleton';
      text.appendChild(skeleton);
    }

    const colour = glasses ? facewearColorForName(glasses.names.en) : null;
    const line = el(
      'span',
      'font-size: 10px; line-height: 1.3; color: var(--theme-text-muted); overflow-wrap: anywhere;',
      colour ? LanguageService.getFacewearColorName(colour.id) : tSwatch('facewearColorUnknown')
    );
    line.dataset.role = 'dye-line';
    text.appendChild(line);
    row.appendChild(text);

    const chips = el('span', 'display: flex; gap: 3px; flex-shrink: 0;');
    const chip = el(
      'span',
      `display: block; width: 20px; height: 26px; border-radius: 5px; background: ${
        colour ? colour.hex : 'var(--theme-background-secondary)'
      }; ${INSET_RING}`
    );
    chip.dataset.role = colour ? 'facewear-chip' : 'undyed-chip';
    if (colour) chip.dataset.facewearColor = colour.id;
    chip.title = colour
      ? LanguageService.tInterpolate('swatch.facewearColorTag', { color: colour.name })
      : tSwatch('facewearColorUnknown');
    chips.appendChild(chip);
    row.appendChild(chips);

    if (glasses) row.title = itemNameFor(glasses.names, lang);
    return row;
  }

  /** 11c — one 44px row per unique dye: chip · name + ID · carriers as icons · ×N. */
  private renderDyeRows(): HTMLElement {
    const grid = el('div', '');
    grid.className = 'chara-equip-grid';
    grid.dataset.role = 'dye-rows';
    const lang = LanguageService.getCurrentLocale();

    // Unique dyes in wear order, each with its channel count and carriers.
    const order: number[] = [];
    const info = new Map<
      number,
      { dye: Dye | null; channels: number; carriers: CharaGearSlotId[] }
    >();
    for (const gear of this.resolved!.gearDyes) {
      let entry = info.get(gear.stainId);
      if (!entry) {
        entry = { dye: gear.dye, channels: 0, carriers: [] };
        info.set(gear.stainId, entry);
        order.push(gear.stainId);
      }
      entry.channels++;
      if (!entry.carriers.includes(gear.slot)) entry.carriers.push(gear.slot);
    }

    for (const stainId of order) {
      const entry = info.get(stainId)!;
      const row = el(
        'div',
        'display: flex; align-items: center; gap: 9px; min-height: 44px; padding: 6px 8px; border-radius: 9px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-sizing: border-box; min-width: 0;'
      );
      row.dataset.stainId = String(stainId);

      row.appendChild(
        el(
          'span',
          `display: block; width: 22px; height: 28px; flex-shrink: 0; border-radius: 5px; background: ${
            entry.dye?.hex ?? 'transparent'
          }; ${entry.dye ? INSET_RING : 'border: 1px dashed var(--theme-border); box-sizing: border-box;'}`
        )
      );

      const text = el(
        'span',
        'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;'
      );
      text.appendChild(
        el(
          'span',
          'font-size: 11.5px; line-height: 1.3; font-weight: 600; color: var(--theme-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
          entry.dye ? dyeName(entry.dye) : `#${stainId}`
        )
      );
      // Stain ID is an identifier by decision (2026-08-20 i18n audit) — mono,
      // never localised.
      text.appendChild(
        el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.7px; color: var(--theme-text-muted);`,
          `ID ${stainId}`
        )
      );
      row.appendChild(text);

      // Carriers: one 20px icon tile per piece wearing the dye; the slot
      // retreats into the tooltip (the accepted cost of this lens).
      const right = el('span', 'display: flex; align-items: center; gap: 4px; flex-shrink: 0;');
      for (const slot of entry.carriers) {
        const item = this.itemFor(slot);
        const tile = el(
          'span',
          'display: block; width: 20px; height: 20px; border-radius: 5px; background-color: var(--theme-background-secondary); background-size: cover; background-position: center; cursor: help;'
        );
        tile.dataset.role = 'carrier';
        tile.dataset.slot = slot;
        if (item?.iconId) tile.style.backgroundImage = `url("${charaIconUrl(item.iconId)}")`;
        const slotLabel = this.gearSlotLabel(slot).toUpperCase();
        tile.title = item ? `${slotLabel} — ${itemNameFor(item.names, lang)}` : slotLabel;
        // This lens names the dye, not the piece, so the carrier tile is the
        // only handle on the item — it opens the same menu the Pieces lens does.
        const carrierTarget = this.itemLinkTarget(slot);
        if (carrierTarget && item) {
          this.attachItemLinks(tile, carrierTarget, itemNameFor(item.names, lang));
        }
        right.appendChild(tile);
      }
      right.appendChild(
        el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; color: var(--theme-text-muted); min-width: 16px; text-align: right;`,
          entry.channels > 1 ? `×${entry.channels}` : ''
        )
      );
      row.appendChild(right);
      grid.appendChild(row);
    }
    return grid;
  }

  // ==========================================================================
  // IN THE GAME — the reader's verdict, and the twins behind each row
  // ==========================================================================

  /** The highest channel the file dyes on a slot: 0, 1 or 2. */
  private dyedChannel(slot: CharaGearSlotId): number {
    return this.resolved!.gearDyes.filter((gear) => gear.slot === slot).reduce(
      (max, gear) => Math.max(max, gear.channel),
      0
    );
  }

  /**
   * A worn piece's twins: the named item and its alternates checked against
   * this file and character, the one the list names (the player's pick, else
   * the default rule), and the row's tone. A paired off-hand (quiver, focus)
   * IS the main weapon, so it follows the main hand's pick. Null when
   * api-worker has not named the piece.
   */
  private twinState(slot: CharaGearSlotId): TwinState | null {
    const item = this.itemFor(slot);
    if (!item) return null;
    if (item.viaMainHand) return slot === 'MainHand' ? null : this.twinState('MainHand');
    const resolved = this.resolved!;
    const twins = charaTwinsOf(item, this.dyedChannel(slot), {
      race: resolved.race,
      gender: resolved.gender,
    });
    if (twins.length === 0) return null;
    const best = defaultCharaTwin(twins);
    const pickedId = this.picks.get(slot);
    const picked = twins.find((t) => t.itemId === pickedId) ?? best;
    return { twins, best, picked, tone: charaPieceTone(twins, picked) };
  }

  /** One problem, as a standalone sentence (a NO FIX row, a picker's why line). */
  private problemText(problem: CharaPieceProblem): string {
    return LanguageService.t(
      {
        noItem: 'glamour.row.blockedNoItem',
        dye: 'glamour.row.blockedDye',
        glamour: 'glamour.row.blockedGlamour',
        wear: 'glamour.row.blockedWear',
      }[problem]
    );
  }

  /**
   * What a row says under its dyes (design 1a): why a twin was named, why
   * nothing fixes it, or which twin it could just as well be — plus the Grand
   * Company flag, which never fails a piece (a .chara records no company).
   */
  private pieceNote(
    slot: CharaGearSlotId,
    state: TwinState | null,
    lang: string
  ): { tag: 'fixed' | 'blocked' | null; text: string | null } {
    const item = this.itemFor(slot);
    if (item === null) {
      // An NPC or prop model: only a verdict once api-worker has spoken.
      return this.resolveState === 'ready'
        ? { tag: 'blocked', text: LanguageService.t('glamour.row.blockedNoItem') }
        : { tag: null, text: null };
    }
    if (!state || !item?.rules?.length) return { tag: null, text: null };
    const { twins, picked, tone } = state;
    const parts: string[] = [];
    let tag: 'fixed' | 'blocked' | null = null;
    if (tone === 'fix') {
      tag = 'fixed';
      const lowest = twins[0];
      const key = {
        noItem: 'glamour.row.fixedWear',
        dye: 'glamour.row.fixedDye',
        glamour: 'glamour.row.fixedGlamour',
        wear: 'glamour.row.fixedWear',
      }[lowest.problems[0] ?? 'wear'];
      parts.push(LanguageService.tInterpolate(key, { name: itemNameFor(lowest.names, lang) }));
    } else if (tone === 'block') {
      tag = 'blocked';
      parts.push(this.problemText(picked.problems[0] ?? 'wear'));
      const passing = twins.find((t) => t.rules !== null && t.problems.length === 0);
      parts.push(
        passing
          ? LanguageService.tInterpolate('glamour.row.otherWorks', {
              name: itemNameFor(passing.names, lang),
            })
          : LanguageService.t('glamour.row.noFix')
      );
    } else if (tone === 'choice') {
      const other = twins.find((t) => t.itemId !== picked.itemId);
      if (other) {
        parts.push(
          LanguageService.tInterpolate('glamour.row.choice', {
            name: itemNameFor(other.names, lang),
          })
        );
      }
    }
    if (tone !== 'block' && (picked.rules?.grandCompany ?? 0) > 0) {
      parts.push(LanguageService.t('glamour.row.company'));
    }
    return { tag, text: parts.length > 0 ? parts.join(' · ') : null };
  }

  /**
   * The verdict (design 1a): can the look be worn the way the file shows it?
   * Drawn only once api-worker has answered WITH rules, so an older worker
   * (or an unavailable one) leaves the block exactly as it was. The check
   * runs here, in the browser: the file's dyes and the character's race and
   * gender never leave the device.
   */
  private renderVerdict(): HTMLElement | null {
    const resolved = this.resolved;
    if (this.resolveState !== 'ready' || !resolved || !this.equipment) return null;
    const answered = Object.values(this.equipment.items).some((item) => item?.rules?.length);
    if (!answered) return null;

    let fixed = 0;
    let blocked = 0;
    let fine = 0;
    let company = 0;
    for (const model of resolved.gearModels) {
      const item = this.itemFor(model.slot);
      if (item === undefined || item?.viaMainHand) continue;
      if (item === null) {
        blocked++;
        continue;
      }
      if (!item.rules?.length) continue;
      const state = this.twinState(model.slot);
      if (!state) continue;
      if (state.tone === 'block') blocked++;
      else if (state.tone === 'fix') fixed++;
      else fine++;
      if (state.tone !== 'block' && (state.picked.rules?.grandCompany ?? 0) > 0) company++;
    }

    const panel = el(
      'div',
      'display: flex; flex-direction: column; gap: 6px; padding: 11px 12px; border-radius: 12px; background: var(--theme-card-background); border: 1px solid var(--theme-border);'
    );
    panel.dataset.role = 'verdict';
    panel.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; color: var(--theme-text-muted); text-transform: uppercase;`,
        LanguageService.t('glamour.verdict.head')
      )
    );
    const head = el(
      'span',
      `font-family: ${SANS}; font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--theme-text);`,
      LanguageService.t(
        blocked > 0
          ? 'glamour.verdict.headBlocked'
          : fixed > 0
            ? 'glamour.verdict.headFixed'
            : 'glamour.verdict.headClear'
      )
    );
    head.dataset.role = 'verdict-head';
    panel.appendChild(head);
    panel.appendChild(
      el(
        'span',
        'font-size: 11.5px; line-height: 1.45; color: var(--theme-text-muted);',
        LanguageService.t('glamour.verdict.explain')
      )
    );

    const chips = el('span', 'display: flex; gap: 6px; flex-wrap: wrap;');
    const chip = (n: number, key: string, fg: string): void => {
      if (n === 0) return;
      const c = monoChip(
        LanguageService.tInterpolate(key, { n: String(n) }),
        fg,
        'var(--theme-background-secondary)'
      );
      c.dataset.role = 'verdict-count';
      chips.appendChild(c);
    };
    chip(fixed, 'glamour.verdict.countFixed', green());
    chip(blocked, 'glamour.verdict.countBlocked', amber());
    chip(fine, 'glamour.verdict.countFine', 'var(--theme-text-muted)');
    chip(company, 'glamour.verdict.countCompany', 'var(--theme-text-muted)');
    panel.appendChild(chips);
    return panel;
  }

  /**
   * Footnote: worn-undyed pieces vs empty slots — the two things the shipped
   * `12 − dyed` line conflated. Plus, when the resolve failed, one quiet line
   * saying names are off and dyes are not. DyeId 0 is undyed, not black
   * (`gearHint`, on hover).
   */
  private renderGlamourFoot(bySlot: Map<CharaGearSlotId, ResolvedGearDye[]>): HTMLElement {
    const resolved = this.resolved!;
    const worn = resolved.gearModels.length;
    const undyedWorn = resolved.gearModels.filter((m) => !bySlot.has(m.slot)).length;
    const empty = Math.max(0, GEAR_SLOT_COUNT - worn);

    const foot = el('div', 'display: flex; flex-direction: column; gap: 3px;');
    const split = el(
      'div',
      'font-size: 10px; line-height: 1.5; color: var(--theme-text-muted); overflow-wrap: anywhere;',
      LanguageService.tInterpolate('swatch.footSplit', {
        undyed:
          undyedWorn === 1
            ? LanguageService.t('swatch.footWornUndyedOne')
            : LanguageService.tInterpolate('swatch.footWornUndyedMany', { n: undyedWorn }),
        empty:
          empty === 1
            ? LanguageService.t('swatch.footEmptyOne')
            : LanguageService.tInterpolate('swatch.footEmptyMany', { n: empty }),
      })
    );
    split.title = tSwatch('gearHint');
    split.dataset.role = 'glamour-foot';
    foot.appendChild(split);

    if (this.resolveState === 'unavailable') {
      const note = el(
        'div',
        'font-size: 10px; line-height: 1.45; color: var(--theme-text-muted); overflow-wrap: anywhere;',
        tSwatch('namesUnavailable')
      );
      note.dataset.role = 'names-unavailable';
      foot.appendChild(note);
    }
    return foot;
  }

  /**
   * Make-a-palette panel. Floor 3 / hard cap 6 are ENFORCED at the action
   * buttons (disabled + inert outside the window), not just recoloured.
   */
  private renderPalettePanel(): HTMLElement {
    const worn = this.wornDyes().filter((w) => w.dye !== null) as Array<{
      stainId: number;
      dye: Dye;
    }>;
    const kept = worn.filter((w) => !this.droppedStainIds.has(w.stainId));
    const tooFew = kept.length < PALETTE_FLOOR;
    const overCap = kept.length > PALETTE_CAP;
    const valid = !tooFew && !overCap;

    const panel = el(
      'div',
      'border-top: 1px solid var(--theme-border); padding-top: 9px; display: flex; flex-direction: column; gap: 8px;'
    );

    // Title + 3–6 counter (colour = validity).
    const titleRow = el(
      'div',
      'display: flex; align-items: baseline; justify-content: space-between; gap: 8px;'
    );
    titleRow.appendChild(
      el(
        'span',
        'font-size: 12.5px; font-weight: 600; color: var(--theme-text);',
        tSwatch('paletteTitle')
      )
    );
    titleRow.appendChild(
      el(
        'span',
        `font-family: ${MONO}; font-size: 10.5px; color: ${valid ? green() : amber()};`,
        `${kept.length} / ${PALETTE_CAP}`
      )
    );
    panel.appendChild(titleRow);

    // Name input — deliberately NOT pre-filled with the character's nickname
    // (it may be a real name and this name can be published to the community).
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = this.paletteNameDraft ?? '';
    nameInput.placeholder = tSwatch('paletteNamePlaceholder');
    nameInput.maxLength = 50;
    nameInput.setAttribute(
      'style',
      'height: 36px; box-sizing: border-box; width: 100%; padding: 0 10px; border-radius: 9px; font-family: inherit; font-size: 12.5px; background: var(--theme-input-background); border: 1px solid var(--theme-border); color: var(--theme-text);'
    );
    nameInput.addEventListener('input', () => {
      this.paletteNameDraft = nameInput.value;
    });
    panel.appendChild(nameInput);
    panel.appendChild(
      el(
        'div',
        'font-size: 10px; line-height: 1.5; color: var(--theme-text-muted);',
        tSwatch('paletteNameHint')
      )
    );

    // Dye toggle chips — 18px swatch + name + mono stainID; dimmed when dropped.
    const chipRow = el('div', 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap;');
    for (const entry of worn) {
      const dropped = this.droppedStainIds.has(entry.stainId);
      const chip = el(
        'button',
        `display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 999px; cursor: pointer; font-family: inherit; border: 1px solid var(--theme-border); background: ${
          dropped ? 'transparent' : 'var(--theme-card-background)'
        }; color: var(--theme-text); opacity: ${dropped ? '0.5' : '1'};`
      );
      (chip as HTMLButtonElement).type = 'button';
      chip.appendChild(
        el(
          'span',
          `width: 18px; height: 18px; border-radius: 5px; flex: 0 0 auto; background: ${entry.dye.hex}; ${INSET_RING}`
        )
      );
      chip.appendChild(el('span', 'font-size: 11px;', dyeName(entry.dye)));
      chip.appendChild(
        el(
          'span',
          `font-family: ${MONO}; font-size: 8.5px; color: var(--theme-text-muted);`,
          String(entry.stainId)
        )
      );
      chip.title = `${dyeName(entry.dye)} · ${entry.stainId}`;
      chip.addEventListener('click', () => {
        if (dropped) this.droppedStainIds.delete(entry.stainId);
        else this.droppedStainIds.add(entry.stainId);
        this.render();
      });
      chipRow.appendChild(chip);
    }
    panel.appendChild(chipRow);

    // 24px strip preview of the kept dyes.
    if (kept.length > 0) {
      const strip = el(
        'div',
        `display: flex; height: 24px; border-radius: 6px; overflow: hidden; ${INSET_RING}`
      );
      for (const entry of kept) {
        strip.appendChild(el('span', `flex: 1; background: ${entry.dye.hex};`));
      }
      panel.appendChild(strip);
    }

    // Amber card saying why the actions are locked, in both directions.
    if (!valid) {
      const warn = el(
        'div',
        'display: flex; align-items: flex-start; gap: 7px; padding: 7px 9px; border-radius: 9px; background: rgba(244, 191, 79, 0.07); border: 1px solid rgba(244, 191, 79, 0.3);'
      );
      warn.appendChild(
        monoChip(
          tooFew ? LanguageService.t('swatch.tooFewTag') : `${PALETTE_FLOOR}–${PALETTE_CAP}`,
          amber(),
          'rgba(244, 191, 79, 0.18)'
        )
      );
      warn.appendChild(
        el(
          'span',
          'font-size: 11px; line-height: 1.45; color: var(--theme-text);',
          tooFew
            ? LanguageService.t('swatch.tooFewBody')
            : LanguageService.tInterpolate('swatch.overCapBody', { n: kept.length })
        )
      );
      panel.appendChild(warn);
    }

    // Actions: Save to this device (outlined chip) · Submit to Community
    // (accent solid). Both 40px; both dead outside 3–6.
    const actions = el('div', 'display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px;');
    const actionState = valid
      ? 'cursor: pointer; opacity: 1;'
      : 'cursor: not-allowed; opacity: 0.45;';

    const saveBtn = el(
      'button',
      `height: 40px; padding: 0 14px; border-radius: 10px; font-family: inherit; font-size: 12.5px; font-weight: 600; background: var(--theme-card-background); border: 1px solid var(--theme-border); color: var(--theme-text); ${actionState}`,
      tSwatch('saveLocal')
    );
    (saveBtn as HTMLButtonElement).type = 'button';
    (saveBtn as HTMLButtonElement).disabled = !valid;
    if (valid) {
      saveBtn.addEventListener('click', () => this.saveLocalPalette(kept));
    }
    actions.appendChild(saveBtn);

    if (this.callbacks.onSubmitPalette) {
      const submitBtn = el(
        'button',
        `height: 40px; padding: 0 14px; border-radius: 10px; font-family: inherit; font-size: 12.5px; font-weight: 600; background: var(--theme-primary); border: none; color: #fff; ${actionState}`,
        tSwatch('submitCommunity')
      );
      (submitBtn as HTMLButtonElement).type = 'button';
      (submitBtn as HTMLButtonElement).disabled = !valid;
      if (valid) {
        submitBtn.addEventListener('click', () => {
          this.callbacks.onSubmitPalette?.(
            kept.map((w) => w.dye),
            this.communityPaletteName()
          );
        });
      }
      actions.appendChild(submitBtn);
    }
    panel.appendChild(actions);

    return panel;
  }

  /**
   * The name handed to `onSubmitPalette` (the community preset submission
   * form): the typed draft only. Deliberately NOT the character's nickname
   * or the attachment filename — players use their real name in both — and
   * not a generic default either, which would satisfy the form's own
   * minimum length unedited. Empty means the user still has to type one;
   * the form enforces that.
   */
  private communityPaletteName(): string {
    return (this.paletteNameDraft ?? '').trim().slice(0, 50);
  }

  /**
   * The name for the on-device `kind: 'palette'` record: the draft, else the
   * same local-only fallback `saveCharacterRecord` uses (nickname → file name
   * → localized default). It stays in this browser's storage like the
   * character record; the community path above never reads it.
   */
  private localPaletteName(): string {
    const draft = (this.paletteNameDraft ?? '').trim();
    const fallback =
      this.resolved?.nickname ||
      this.fileName?.replace(/\.chara$/i, '') ||
      tSwatch('paletteDefaultName');
    return (draft || fallback).slice(0, 50);
  }

  /**
   * Save to this device — a `kind: 'palette'` record in the one
   * CollectionService store (the 10A glamour export's sibling record).
   */
  private saveLocalPalette(kept: Array<{ stainId: number; dye: Dye }>): void {
    const base = this.localPaletteName();
    let name = base;
    let suffix = 1;
    while (CollectionService.getCollectionByName(name)) {
      // Trim the base, never the suffix — a 50-char base would otherwise
      // truncate back to itself and never terminate.
      const tag = ` (${suffix++})`;
      name = `${base.slice(0, 50 - tag.length)}${tag}`;
    }
    const record = CollectionService.createCollection(name, undefined, { kind: 'palette' });
    if (!record) {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
      return;
    }
    for (const entry of kept) {
      CollectionService.addDyeToCollection(record.id, entry.stainId);
    }
    logger.info(`[GlamourBlock] Saved glamour palette "${name}" (${kept.length} dyes)`);
    ToastService.success(LanguageService.t('palette.saveSuccess'));
  }
}
