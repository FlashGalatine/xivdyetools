/**
 * XIV Dye Tools 5.0 - Advanced Options Slide-over
 *
 * The Advanced Options surface leaves the inline config-sidebar section and
 * becomes a 392px right slide-over (the 16B panel geometry borrowed by the
 * confirmed 16A system for settings-like surfaces), opened from the header
 * gear. Body structure follows AdvancedOptions.dc.html: collapsible section
 * cards — title, mono badge, one-line mono summary — with 44px rows inside.
 *
 * Three sections: Data (destructive resets, confirmed through the 16A
 * destructive convention), Backup (JSON export/import), Behaviour (the two
 * persisted toggles).
 *
 * @module components/advanced-options-panel
 */

import { ModalService } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { TutorialService } from '@services/tutorial-service';
import { CollectionService } from '@services/collection-service';
import { ConfigController } from '@services/config-controller';
import { RouterService } from '@services/router-service';
import { logger } from '@shared/logger';

// The panel hosts the per-tool config surface (Q7: config lives behind the
// header gear, not in a persistent column) — register the element.
import './v4/config-sidebar';
import type { ConfigSidebar } from './v4/config-sidebar';

// ============================================================================
// Section/row builders (AdvancedOptions.dc.html geometry)
// ============================================================================

function sectionCard(
  title: string,
  badge: string,
  summary: string,
  open: boolean
): { card: HTMLElement; body: HTMLElement } {
  const card = document.createElement('div');
  card.className = 'rounded-xl border overflow-hidden';
  card.style.borderColor = 'var(--theme-border)';
  card.style.backgroundColor = 'var(--theme-card-background)';

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'w-full flex items-center gap-2.5 px-3 text-left';
  header.style.minHeight = '52px';
  header.setAttribute('aria-expanded', String(open));

  const text = document.createElement('span');
  text.className = 'flex-1 min-w-0 flex flex-col gap-0.5';

  const titleRow = document.createElement('span');
  titleRow.className = 'flex items-center gap-1.5 flex-wrap';
  const titleEl = document.createElement('span');
  titleEl.className = 'text-sm font-semibold';
  titleEl.style.color = 'var(--theme-text)';
  titleEl.textContent = title;
  titleRow.appendChild(titleEl);
  const badgeEl = document.createElement('span');
  badgeEl.className = 'm16-label px-1.5 py-0.5 rounded';
  badgeEl.style.backgroundColor = 'var(--theme-background-secondary)';
  badgeEl.textContent = badge;
  titleRow.appendChild(badgeEl);
  text.appendChild(titleRow);

  const summaryEl = document.createElement('span');
  summaryEl.className = 'text-xs truncate';
  summaryEl.style.fontFamily = 'var(--font-mono)';
  summaryEl.style.color = 'var(--theme-text-muted)';
  summaryEl.textContent = summary;
  text.appendChild(summaryEl);

  header.appendChild(text);

  const caret = document.createElement('span');
  caret.style.color = 'var(--theme-text-muted)';
  caret.style.fontSize = '10px';
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = open ? '▾' : '▸';
  header.appendChild(caret);

  const body = document.createElement('div');
  body.className = 'px-3 pb-3 pt-2.5 flex-col gap-1.5 border-t';
  body.style.borderColor = 'var(--theme-border)';
  // Explicit display toggling — combining Tailwind's `flex` and `hidden`
  // classes leaves display:flex winning and the section always open
  body.style.display = open ? 'flex' : 'none';

  header.addEventListener('click', () => {
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'flex';
    caret.textContent = isOpen ? '▸' : '▾';
    header.setAttribute('aria-expanded', String(!isOpen));
  });

  card.appendChild(header);
  card.appendChild(body);
  return { card, body };
}

function actionRow(label: string, desc: string, onClick: () => void): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'w-full flex items-center justify-between gap-3 text-left py-1.5';
  row.style.minHeight = '44px';

  const text = document.createElement('span');
  text.className = 'min-w-0 flex flex-col gap-0.5';
  const labelEl = document.createElement('span');
  labelEl.className = 'text-xs font-semibold';
  labelEl.style.color = 'var(--theme-text)';
  labelEl.textContent = label;
  text.appendChild(labelEl);
  if (desc) {
    const descEl = document.createElement('span');
    descEl.className = 'text-xs leading-snug';
    descEl.style.color = 'var(--theme-text-muted)';
    descEl.textContent = desc;
    text.appendChild(descEl);
  }
  row.appendChild(text);

  const chevron = document.createElement('span');
  chevron.style.color = 'var(--theme-text-muted)';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';
  row.appendChild(chevron);

  row.addEventListener('click', onClick);
  return row;
}

/**
 * BUG-079: `checked` used to be a plain boolean captured when the panel was
 * BUILT, and the row kept its own `state` from it. A reset or an import
 * performed from this same open panel changes the config underneath the row, so
 * the next tap wrote the negation of a value the user was no longer looking at
 * -- often re-writing the value it already had. Take a reader instead, and
 * consult it at paint and click time.
 */
function toggleRow(
  label: string,
  desc: string,
  read: () => boolean,
  onChange: (checked: boolean) => void
): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'w-full flex items-center justify-between gap-3 text-left py-1.5';
  row.style.minHeight = '44px';
  row.setAttribute('role', 'switch');
  row.setAttribute('aria-checked', String(read()));

  const text = document.createElement('span');
  text.className = 'min-w-0 flex flex-col gap-0.5';
  const labelEl = document.createElement('span');
  labelEl.className = 'text-xs font-semibold';
  labelEl.style.color = 'var(--theme-text)';
  labelEl.textContent = label;
  text.appendChild(labelEl);
  const descEl = document.createElement('span');
  descEl.className = 'text-xs leading-snug';
  descEl.style.color = 'var(--theme-text-muted)';
  descEl.textContent = desc;
  text.appendChild(descEl);
  row.appendChild(text);

  // 40×23 track, 18px knob (drawn spec)
  const track = document.createElement('span');
  track.className = 'relative block rounded-full flex-shrink-0 transition-colors';
  track.style.width = '40px';
  track.style.height = '23px';
  const knob = document.createElement('span');
  knob.className = 'absolute rounded-full transition-all';
  knob.style.top = '2.5px';
  knob.style.width = '18px';
  knob.style.height = '18px';
  knob.style.background = '#fff';
  knob.style.boxShadow = '0 1px 3px rgba(0,0,0,0.32)';
  track.appendChild(knob);
  row.appendChild(track);

  const paint = (): void => {
    const state = read();
    track.style.backgroundColor = state ? 'var(--theme-primary)' : 'var(--theme-border)';
    knob.style.left = state ? '19.5px' : '2.5px';
    row.setAttribute('aria-checked', String(state));
  };
  paint();

  row.addEventListener('click', () => {
    onChange(!read());
    paint();
  });

  return row;
}

// ============================================================================
// Panel content
// ============================================================================

function destructiveConfirm(message: string, onConfirm: () => void): void {
  const content = document.createElement('p');
  content.className = 'text-sm';
  content.style.color = 'var(--theme-text-muted)';
  content.textContent = message;
  ModalService.showConfirm({
    title: LanguageService.t('config.advancedSettings'),
    content,
    destructive: true,
    confirmText: LanguageService.t('common.reset'),
    cancelText: LanguageService.t('common.cancel'),
    onConfirm,
  });
}

function createContent(host: HTMLElement): HTMLElement {
  const t = (key: string): string => LanguageService.t(key);
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-2';

  const configController = ConfigController.getInstance();

  // --- Per-tool configuration (mobile only) ---
  // Desktop carries the Simple-Settings column in the shell; on mobile the
  // gear slide-over is the one route to the same controls.
  if (window.matchMedia('(max-width: 768px)').matches) {
    const configHost = document.createElement('v4-config-sidebar') as ConfigSidebar;
    configHost.embedded = true;
    configHost.activeTool = RouterService.getCurrentToolId();
    // Forward the sidebar's emits onto the layout host so v4-layout's
    // listeners keep working unchanged.
    for (const eventName of ['config-change', 'clear-all-dyes'] as const) {
      configHost.addEventListener(eventName, ((e: CustomEvent) => {
        host.dispatchEvent(
          new CustomEvent(eventName, { detail: e.detail, bubbles: true, composed: true })
        );
      }) as EventListener);
    }
    container.appendChild(configHost);
  }

  // --- Data (destructive resets) ---
  const data = sectionCard(
    t('advanced.dataTitle'),
    t('advanced.dataBadge'),
    t('advanced.dataSummary'),
    true
  );
  data.body.appendChild(
    actionRow(t('config.resetSettings'), '', () =>
      destructiveConfirm(t('config.resetSettingsConfirm'), () => {
        configController.resetAllConfigs();
        host.dispatchEvent(new CustomEvent('settings-reset', { bubbles: true, composed: true }));
        logger.info('[AdvancedOptions] All settings reset to defaults');
      })
    )
  );
  data.body.appendChild(
    actionRow(t('config.clearDyes'), '', () =>
      destructiveConfirm(t('config.clearDyesConfirm'), () => {
        host.dispatchEvent(new CustomEvent('clear-all-dyes', { bubbles: true, composed: true }));
        logger.info('[AdvancedOptions] Clear dyes event emitted');
      })
    )
  );
  data.body.appendChild(
    actionRow(t('config.clearFavorites'), '', () =>
      destructiveConfirm(t('config.clearFavoritesConfirm'), () => {
        CollectionService.clearFavorites();
        host.dispatchEvent(new CustomEvent('favorites-cleared', { bubbles: true, composed: true }));
        logger.info('[AdvancedOptions] Favorites cleared');
      })
    )
  );
  data.body.appendChild(
    actionRow(t('config.clearPalettes'), '', () =>
      destructiveConfirm(t('config.clearPalettesConfirm'), () => {
        // 5.0: saved palettes are palette-kind CollectionService records
        // (the legacy PaletteService key migrates there on init)
        const deleted = CollectionService.deleteCollectionsByKind('palette');
        host.dispatchEvent(new CustomEvent('palettes-cleared', { bubbles: true, composed: true }));
        logger.info(`[AdvancedOptions] Cleared ${deleted} saved palettes`);
      })
    )
  );
  data.body.appendChild(
    actionRow(t('config.resetTutorial'), '', () => {
      TutorialService.resetAllCompletions();
      host.dispatchEvent(new CustomEvent('tutorial-reset', { bubbles: true, composed: true }));
      logger.info('[AdvancedOptions] Tutorial reset');
    })
  );
  container.appendChild(data.card);

  // --- Backup (export / import) ---
  const backup = sectionCard(t('advanced.backupTitle'), 'JSON', t('advanced.backupSummary'), false);

  backup.body.appendChild(
    actionRow(t('config.exportSettings'), '', () => {
      const configs = configController.exportAllConfigs();
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-settings',
        configs,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xivdyetools-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      logger.info('[AdvancedOptions] Settings exported');
    })
  );

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json';
  importInput.hidden = true;
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) return;
    void (async () => {
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        const dataObj = parsed as { type?: string; configs?: unknown };
        if (dataObj.type !== 'xivdyetools-settings' || !dataObj.configs) {
          throw new Error('Invalid settings file format');
        }
        configController.importConfigs(
          dataObj.configs as Parameters<typeof configController.importConfigs>[0]
        );
        host.dispatchEvent(new CustomEvent('settings-imported', { bubbles: true, composed: true }));
        logger.info('[AdvancedOptions] Settings imported successfully');
      } catch (error) {
        logger.error('[AdvancedOptions] Import failed:', error);
        alert(LanguageService.t('config.importError'));
      }
      importInput.value = '';
    })();
  });
  backup.body.appendChild(actionRow(t('config.importSettings'), '', () => importInput.click()));
  backup.body.appendChild(importInput);
  container.appendChild(backup.card);

  // --- Behaviour (persisted toggles) ---
  const behaviour = sectionCard(
    t('advanced.behaviorTitle'),
    t('advanced.behaviorBadge'),
    t('advanced.behaviorSummary'),
    false
  );
  behaviour.body.appendChild(
    toggleRow(
      t('config.performanceMode'),
      t('config.performanceModeDesc'),
      () => configController.getConfig('advanced').performanceMode,
      (checked) => configController.setConfig('advanced', { performanceMode: checked })
    )
  );
  behaviour.body.appendChild(
    toggleRow(
      t('config.enableAnalytics'),
      t('config.analyticsDesc'),
      () => configController.getConfig('advanced').analyticsEnabled,
      (checked) => configController.setConfig('advanced', { analyticsEnabled: checked })
    )
  );
  container.appendChild(behaviour.card);

  return container;
}

// ============================================================================
// Public API
// ============================================================================

let panelModalId: string | null = null;

/**
 * Show the Advanced Options slide-over (392px right panel).
 * Events (settings-reset, clear-all-dyes, ...) bubble from the given host so
 * the layout can keep reacting the way it did to the config-sidebar's emits.
 */
export function showAdvancedOptionsPanel(host: HTMLElement = document.body): void {
  if (panelModalId) return; // Already showing

  const content = createContent(host);

  // Keep the embedded config surface on the active tool while the panel is
  // open (the user can navigate via the title menu without closing it).
  const configHost = content.querySelector('v4-config-sidebar') as ConfigSidebar | null;
  const routeUnsubscribe = RouterService.subscribe((state) => {
    if (configHost) configHost.activeTool = state.toolId;
  });

  panelModalId = ModalService.show({
    type: 'custom',
    variant: 'panel',
    panelWidth: 392,
    title: LanguageService.t('config.advancedSettings'),
    eyebrow: LanguageService.t('advanced.eyebrow'),
    content,
    closable: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
    onClose: () => {
      routeUnsubscribe();
      panelModalId = null;
    },
  });
}
