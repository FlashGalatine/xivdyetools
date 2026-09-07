/**
 * XIV Dye Tools - "Open in…" menu for a glamour piece.
 *
 * Raised from the Swatch Manager's equipment rows (icon or item name). The
 * URLs themselves live in `@shared/item-links`, which is pure and tested on
 * its own; this file is the popup around them — positioning, dismissal, the
 * Lodestone submenu, and the one asynchronous case.
 *
 * THE ASYNCHRONOUS CASE. Facewear is stored as a Glasses sheet row id, and the
 * eleven tinted rows of each family carry the tint in their NAME ("Silver Oval
 * Spectacles"). No such item exists — only the untinted base does — so a
 * name-addressed link built from the row's own name 404s. `glassesBaseRowId`
 * gives the base row by arithmetic; api-worker turns that into authoritative
 * names in every language. Until it answers the entries are skeletons, and if
 * it never answers they stay disabled: a dead link here would look like our
 * bug, not the wiki's.
 *
 * Rendered into `document.body` rather than the tool's shadow root, so the
 * page's Tailwind and theme variables reach it — the same arrangement as
 * `add-to-collection-menu`.
 *
 * @module components/item-links-menu
 */

import { LanguageService } from '@services/index';
import { resolveCharaEquipment, type CharaItemNames } from '@services/chara-resolve-service';
import { logger } from '@shared/logger';
import {
  buildItemLinkMenu,
  glassesBaseRowId,
  isGlassesTint,
  type ItemLinkId,
  type ItemLinkMenu,
} from '@shared/item-links';
/**
 * What the menu was raised on. Facewear carries its Glasses row id because the
 * menu, not the caller, owns the base-name round trip.
 */
export type ItemLinksMenuTarget =
  | { kind: 'gear'; itemId: number; names: CharaItemNames }
  | { kind: 'facewear'; glassesRowId: number; names: CharaItemNames };

export interface ItemLinksMenuOptions {
  target: ItemLinksMenuTarget;
  /** The element the menu is positioned against (the icon or the name). */
  anchorElement: HTMLElement;
  /** Heading — the item name as the row shows it. */
  title: string;
  onClose?: () => void;
}

/** Labels are `swatch.itemLinks.*`; regions are `swatch.itemLinks.lodestone.*`. */
const LINK_LABEL_KEY: Record<ItemLinkId, string> = {
  mirapri: 'mirapri',
  garlandTools: 'garlandTools',
  teamcraft: 'teamcraft',
  gamerEscape: 'gamerEscape',
  lodestone: 'lodestone',
};

const MENU_WIDTH = 236;
const SUBMENU_WIDTH = 176;

let activeMenu: HTMLElement | null = null;
let activeSubmenu: HTMLElement | null = null;
let activeAnchor: HTMLElement | null = null;
let submenuAnchor: HTMLButtonElement | null = null;
let cleanupListeners: (() => void) | null = null;
/** Bumped on open and close; a late resolve for a stale menu is dropped. */
let openToken = 0;

function t(key: string): string {
  return LanguageService.t(`swatch.itemLinks.${key}`);
}

/** Close whatever is open. Safe to call when nothing is. */
export function closeItemLinksMenu(restoreFocus = false): void {
  openToken += 1;
  const anchor = activeAnchor;
  activeAnchor = null;
  anchor?.setAttribute('aria-expanded', 'false');
  const cleanup = cleanupListeners;
  cleanupListeners = null;
  cleanup?.();
  closeSubmenu();
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
  if (restoreFocus && anchor?.isConnected) anchor.focus({ preventScroll: true });
}

function closeSubmenu(restoreFocus = false): void {
  const anchor = submenuAnchor;
  submenuAnchor = null;
  anchor?.setAttribute('aria-expanded', 'false');
  if (activeSubmenu) {
    activeSubmenu.remove();
    activeSubmenu = null;
  }
  if (restoreFocus) anchor?.focus({ preventScroll: true });
}

/** Clamp a popup of `width`×`height` into the viewport near `rect`. */
function place(node: HTMLElement, rect: DOMRect, width: number, height: number): void {
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + width > window.innerWidth) left = Math.max(8, window.innerWidth - width - 8);
  if (top + height > window.innerHeight) top = Math.max(8, rect.top - height - 4);
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

function menuItemButton(label: string): HTMLButtonElement {
  const item = document.createElement('button');
  item.type = 'button';
  // Arrow keys navigate the menu; Tab returns to the surrounding tool.
  item.tabIndex = -1;
  item.className =
    'w-full px-3 py-2 text-left text-sm text-[var(--theme-text)] hover:bg-[var(--theme-card-hover)] flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent';
  item.setAttribute('role', 'menuitem');
  const text = document.createElement('span');
  text.className = 'truncate';
  text.textContent = label;
  item.appendChild(text);
  return item;
}

/** Open `url` in a new tab and dismiss. */
function openLink(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
  closeItemLinksMenu(true);
}

/**
 * Show the menu. Any menu already open is replaced, so a second click on a
 * different row never leaves two behind.
 */
export function showItemLinksMenu(options: ItemLinksMenuOptions): void {
  closeItemLinksMenu();
  const { target, anchorElement, title, onClose } = options;
  if (!anchorElement.isConnected) return;
  const token = ++openToken;

  const menu = document.createElement('div');
  menu.className =
    'item-links-menu fixed z-50 bg-[var(--theme-card-background)] rounded-lg shadow-xl border border-[var(--theme-border)] py-1 overflow-hidden';
  menu.style.width = `${MENU_WIDTH}px`;
  menu.dataset.role = 'item-links-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('openIn'));
  menu.tabIndex = -1;

  const header = document.createElement('div');
  header.className =
    'px-3 py-2 text-xs font-semibold text-[var(--theme-text-muted)] border-b border-[var(--theme-border)] truncate';
  header.textContent = title;
  header.title = title;
  menu.appendChild(header);

  const body = document.createElement('div');
  body.dataset.role = 'item-links-body';
  menu.appendChild(body);

  document.body.appendChild(menu);
  activeMenu = menu;
  activeAnchor = anchorElement;
  anchorElement.setAttribute('aria-expanded', 'true');
  place(menu, anchorElement.getBoundingClientRect(), MENU_WIDTH, 8 * 38 + 40);

  if (target.kind === 'gear') {
    fillEntries(body, buildItemLinkMenu(target));
  } else if (!isGlassesTint(target.glassesRowId)) {
    // An untinted facewear row already carries the base item's own names.
    fillEntries(body, buildItemLinkMenu({ kind: 'facewear', names: target.names }));
  } else {
    menu.setAttribute('aria-busy', 'true');
    fillPending(body);
    void resolveFacewearBase(target.glassesRowId)
      .then((names) => {
        if (token !== openToken || !activeMenu) return;
        body.replaceChildren();
        fillEntries(body, buildItemLinkMenu({ kind: 'facewear', names }));
        menu.setAttribute('aria-busy', 'false');
        if (document.activeElement === menu) focusFirst(menu);
      })
      .catch((error: unknown) => {
        logger.warn('[ItemLinks] facewear base name unavailable', error);
        if (token !== openToken || !activeMenu) return;
        body.replaceChildren();
        fillUnavailable(body);
        menu.setAttribute('aria-busy', 'false');
      });
  }

  const onOutside = (event: Event): void => {
    const path = event.composedPath();
    if (path.includes(menu) || (activeSubmenu && path.includes(activeSubmenu))) return;
    closeItemLinksMenu();
  };
  const onReflow = (): void => closeItemLinksMenu();

  // Capture has already passed by the time an opening click reaches its
  // trigger, so these can be installed immediately, before focus moves.
  document.addEventListener('click', onOutside, true);
  document.addEventListener('focusin', onOutside, true);
  document.addEventListener('keydown', onMenuKeyDown, true);
  window.addEventListener('resize', onReflow);
  window.addEventListener('scroll', onReflow, true);
  cleanupListeners = () => {
    document.removeEventListener('click', onOutside, true);
    document.removeEventListener('focusin', onOutside, true);
    document.removeEventListener('keydown', onMenuKeyDown, true);
    window.removeEventListener('resize', onReflow);
    window.removeEventListener('scroll', onReflow, true);
    onClose?.();
  };

  // A pending or unavailable menu has no buttons yet, but must own focus.
  focusFirst(menu);
}

function focusFirst(menu: HTMLElement): void {
  const first = menu.querySelector<HTMLButtonElement>('button:not([disabled])');
  (first ?? menu).focus({ preventScroll: true });
}

function onMenuKeyDown(event: KeyboardEvent): void {
  if (!activeMenu || event.altKey || event.ctrlKey || event.metaKey) return;
  const focused = document.activeElement;
  const inSubmenu = activeSubmenu?.contains(focused) ?? false;
  if (event.key === 'Tab') {
    // Let native Tab/Shift+Tab continue from the trigger, including when it
    // lives inside the layout shell's shadow root.
    closeItemLinksMenu(true);
    return;
  }
  if (event.key === 'Escape' || (event.key === 'ArrowLeft' && inSubmenu)) {
    event.preventDefault();
    event.stopPropagation();
    if (activeSubmenu) closeSubmenu(true);
    else closeItemLinksMenu(true);
    return;
  }
  if (!activeMenu.contains(focused) && !inSubmenu) return;
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    const scope = inSubmenu ? activeSubmenu! : activeMenu;
    if (!inSubmenu) closeSubmenu();
    const items = Array.from(scope.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if (items.length === 0) return;
    const current = items.findIndex((item) => item === focused);
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (current < 0) next = event.key === 'ArrowUp' ? items.length - 1 : 0;
    else next = (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus({ preventScroll: true });
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    event.stopPropagation();
    if (
      event.key === 'ArrowRight' &&
      focused instanceof HTMLButtonElement &&
      focused.dataset.link === 'lodestone'
    ) {
      if (activeSubmenu) focusFirst(activeSubmenu);
      else focused.click();
    }
  }
}

/** Resolve the untinted base row's names through api-worker. */
async function resolveFacewearBase(glassesRowId: number): Promise<CharaItemNames> {
  const result = await resolveCharaEquipment([], glassesBaseRowId(glassesRowId));
  if (!result.glasses) throw new Error('resolve returned no glasses row');
  return result.glasses.names;
}

/** Skeleton rows while the facewear base name is in flight. */
function fillPending(body: HTMLElement): void {
  body.dataset.state = 'resolving';
  for (let i = 0; i < 3; i += 1) {
    const row = document.createElement('div');
    row.className = 'px-3 py-2';
    const bar = document.createElement('span');
    bar.className = 'block h-3 rounded bg-[var(--theme-border)] animate-pulse';
    bar.style.width = `${70 - i * 12}%`;
    bar.setAttribute('aria-hidden', 'true');
    row.appendChild(bar);
    body.appendChild(row);
  }
  const note = document.createElement('div');
  note.className = 'px-3 pb-2 text-xs text-[var(--theme-text-muted)]';
  note.textContent = t('resolvingName');
  note.setAttribute('role', 'status');
  body.appendChild(note);
}

/**
 * The base name never arrived. Every facewear entry is name-addressed, so
 * there is nothing honest left to link — say so rather than offer a 404.
 */
function fillUnavailable(body: HTMLElement): void {
  body.dataset.state = 'unavailable';
  const note = document.createElement('div');
  note.className = 'px-3 py-3 text-xs text-[var(--theme-text-muted)]';
  note.textContent = t('nameUnavailable');
  note.setAttribute('role', 'status');
  note.dataset.role = 'item-links-unavailable';
  body.appendChild(note);
}

function fillEntries(body: HTMLElement, model: ItemLinkMenu): void {
  body.dataset.state = 'ready';
  for (const entry of model.entries) {
    const item = menuItemButton(t(LINK_LABEL_KEY[entry.id]));
    item.dataset.link = entry.id;
    item.addEventListener('click', () => openLink(entry.url));
    body.appendChild(item);
  }

  const separator = document.createElement('div');
  separator.className = 'border-t border-[var(--theme-border)] my-1';
  body.appendChild(separator);

  const lodestone = menuItemButton(t('lodestone'));
  lodestone.dataset.link = 'lodestone';
  lodestone.setAttribute('aria-haspopup', 'menu');
  lodestone.setAttribute('aria-expanded', 'false');
  const caret = document.createElement('span');
  caret.className = 'text-[var(--theme-text-muted)] flex-shrink-0';
  caret.setAttribute('aria-hidden', 'true');
  caret.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  lodestone.appendChild(caret);
  lodestone.addEventListener('click', () => toggleLodestone(lodestone, model));
  body.appendChild(lodestone);
}

function toggleLodestone(anchor: HTMLButtonElement, model: ItemLinkMenu): void {
  if (activeSubmenu) {
    closeSubmenu(true);
    return;
  }
  const submenu = document.createElement('div');
  submenu.className =
    'item-links-submenu fixed z-50 bg-[var(--theme-card-background)] rounded-lg shadow-xl border border-[var(--theme-border)] py-1 overflow-hidden';
  submenu.style.width = `${SUBMENU_WIDTH}px`;
  submenu.dataset.role = 'item-links-lodestone';
  submenu.setAttribute('role', 'menu');
  submenu.setAttribute('aria-label', t('lodestone'));

  for (const { region, url } of model.lodestone) {
    const item = menuItemButton(t(`lodestoneRegion.${region}`));
    item.dataset.region = region;
    item.addEventListener('click', () => openLink(url));
    submenu.appendChild(item);
  }

  document.body.appendChild(submenu);
  activeSubmenu = submenu;
  submenuAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  place(submenu, anchor.getBoundingClientRect(), SUBMENU_WIDTH, model.lodestone.length * 38 + 8);
  focusFirst(submenu);
}
