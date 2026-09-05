/**
 * XIV Dye Tools 5.0 - Changelog Modal Component (C2)
 *
 * One layout for both entry points, per the confirmed Modal Directions C2:
 * the auto-popup ("what changed since I was last here") and the header
 * button ("what has this thing been doing") render the same component and
 * differ only in the eyebrow, the title, and the footer verb. One release is
 * expanded — the current one for the popup, the newest for the history —
 * and every other release is a collapsed row you can open in place.
 *
 * Changelog data is parsed from CHANGELOG-laymans.md at build time by
 * vite-plugin-changelog-parser (virtual:changelog). It is `import()`ed the
 * first time a modal opens rather than at module load: this file is pinned
 * to the eagerly-loaded core-runtime chunk (`manualChunks` → "modals"), and
 * a static import would ship every release's prose to every visitor — the
 * 5.0 notes alone were ~10 KB of that budget. Emoji stay — they come
 * out of the markdown and are the fastest thing on the screen to scan.
 * Bullets take the accent (green already means two different things in this
 * app); the shell owns all chrome colors via theme tokens.
 *
 * @module components/changelog-modal
 */

import { ModalService } from '@services/modal-service';
import { StorageService } from '@services/storage-service';
import { LanguageService } from '@services/language-service';
import { ToastService } from '@services/toast-service';
import { logger } from '@shared/logger';
import { STORAGE_KEYS, APP_VERSION } from '@shared/constants';

// ============================================================================
// Changelog Data Structures
// ============================================================================

interface ChangelogSection {
  header: string;
  title: string;
  bullets: string[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
  sections: ChangelogSection[];
}

/** Which entry point opened the modal — same layout, different framing */
export type ChangelogMode = 'popup' | 'history';

// ============================================================================
// Changelog Modal Class
// ============================================================================

/**
 * Changelog modal for returning users after updates
 */
export class ChangelogModal {
  private modalId: string | null = null;
  /**
   * Bumped by every `show()` and `close()`. A `show()` that resolves its
   * `import()` after a newer call has run (a second click, or a `close()`
   * during the load) sees a stale generation and does not open.
   */
  private generation = 0;

  /**
   * Check if changelog modal should be shown
   * Shows when stored version differs from current version
   */
  static shouldShow(): boolean {
    const lastVersion = StorageService.getItem<string>(STORAGE_KEYS.LAST_VERSION_VIEWED, '');

    // Don't show if no last version (first visit - welcome modal handles that)
    if (!lastVersion) {
      return false;
    }

    // Show if version has changed
    return lastVersion !== APP_VERSION;
  }

  /**
   * Mark current version as viewed
   */
  static markAsViewed(): void {
    StorageService.setItem(STORAGE_KEYS.LAST_VERSION_VIEWED, APP_VERSION);
  }

  /**
   * Reset changelog modal (for testing or settings)
   */
  static reset(): void {
    StorageService.removeItem(STORAGE_KEYS.LAST_VERSION_VIEWED);
  }

  /**
   * Show the changelog modal
   *
   * Resolves once the modal is open (or once the call was found to be a
   * no-op). The release data is loaded on demand — see the module comment.
   *
   * @param opts.mode - `popup` (auto after an update; expands the running
   *   version) or `history` (header button; expands the newest release).
   */
  async show(opts: { mode?: ChangelogMode } = {}): Promise<void> {
    if (this.modalId) return; // Already showing

    const generation = ++this.generation;

    // BUG-090: every call site is `void showChangelogModal()`, and the app
    // registers no global unhandledrejection handler — so when this dynamic
    // import rejected (a chunk 404 against a stale deploy, which is exactly
    // when a user reaches for "What's New") the button did nothing at all, with
    // no toast and no console error. Tell the user to reload instead.
    let changelogEntries: ChangelogEntry[];
    try {
      ({ changelogEntries } = await import('virtual:changelog'));
    } catch (error) {
      logger.error('[ChangelogModal] Failed to load changelog chunk:', error);
      ToastService.error(LanguageService.t('errors.tryAgainOrRefresh'));
      return;
    }

    // Superseded while loading: a second show() is in flight, or close() ran.
    if (generation !== this.generation || this.modalId) return;

    const mode = opts.mode ?? 'popup';
    const content = this.createContent(mode, changelogEntries);

    this.modalId = ModalService.showChangelog({
      title:
        mode === 'popup'
          ? LanguageService.t('changelog.title')
          : LanguageService.t('changelog.historyTitle'),
      eyebrow:
        mode === 'popup'
          ? LanguageService.t('changelog.updatedEyebrow')
          : LanguageService.t('changelog.allReleases'),
      content,
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      confirmText:
        mode === 'popup' ? LanguageService.t('changelog.gotIt') : LanguageService.t('common.close'),
      onClose: () => {
        ChangelogModal.markAsViewed();
        this.modalId = null;
      },
    });
  }

  /**
   * Close the changelog modal
   */
  close(): void {
    this.generation++; // cancel any show() still loading its data
    if (this.modalId) {
      ModalService.dismiss(this.modalId);
      this.modalId = null;
    }
  }

  /**
   * Create modal content: one release expanded, the rest collapsed rows.
   */
  private createContent(mode: ChangelogMode, changelogEntries: ChangelogEntry[]): HTMLElement {
    const container = document.createElement('div');
    container.className = 'changelog-modal-content';

    if (changelogEntries.length === 0) {
      const fallback = document.createElement('p');
      fallback.className = 'text-sm';
      fallback.style.color = 'var(--theme-text-muted)';
      fallback.textContent = LanguageService.t('changelog.noChanges');
      container.appendChild(fallback);
      return container;
    }

    // The popup opens at the running version. BUG-043 rework: if APP_VERSION
    // is missing from the parsed changelog (entry forgotten, header typo),
    // expand the newest release instead of falling back to an empty modal —
    // the history is the popup now, so there is always something to show.
    let expandedIndex = 0;
    if (mode === 'popup') {
      const currentIndex = changelogEntries.findIndex((e) => e.version === APP_VERSION);
      expandedIndex = currentIndex === -1 ? 0 : currentIndex;
    }

    const expandedEntry = changelogEntries[expandedIndex];
    container.appendChild(this.createExpandedEntry(expandedEntry));

    const rest = changelogEntries.filter((_, i) => i !== expandedIndex);
    if (rest.length > 0) {
      const pastLabel = document.createElement('div');
      pastLabel.className = 'm16-label mt-6 mb-2 pt-4 border-t';
      pastLabel.style.borderColor = 'var(--theme-border)';
      pastLabel.textContent = LanguageService.t('changelog.pastLabel');
      container.appendChild(pastLabel);

      const list = document.createElement('div');
      list.className = 'flex flex-col gap-1.5';
      rest.forEach((entry) => {
        list.appendChild(this.createCollapsedRow(entry));
      });
      container.appendChild(list);
    }

    return container;
  }

  /**
   * A fully expanded release: version header (+ CURRENT tag when it is the
   * running version) and every section with accent bullets.
   */
  private createExpandedEntry(entry: ChangelogEntry): HTMLElement {
    const wrapper = document.createElement('div');

    wrapper.appendChild(this.createVersionHeader(entry));

    const sections = document.createElement('div');
    sections.className = 'space-y-4 mt-3';
    entry.sections.forEach((section) => {
      sections.appendChild(this.createSectionBlock(section));
    });
    wrapper.appendChild(sections);

    return wrapper;
  }

  /**
   * Version header row: mono version, date, CURRENT chip.
   */
  private createVersionHeader(entry: ChangelogEntry): HTMLElement {
    const header = document.createElement('div');
    header.className = 'flex items-baseline gap-2 flex-wrap';

    const version = document.createElement('span');
    version.className = 'text-sm font-bold';
    version.style.fontFamily = 'var(--font-mono)';
    version.style.color = 'var(--theme-text)';
    version.textContent = `v${entry.version}`;
    header.appendChild(version);

    if (entry.date) {
      const date = document.createElement('span');
      date.className = 'text-xs';
      date.style.color = 'var(--theme-text-muted)';
      date.textContent = entry.date;
      header.appendChild(date);
    }

    if (entry.version === APP_VERSION) {
      const tag = document.createElement('span');
      tag.className = 'm16-label px-1.5 py-0.5 rounded border';
      tag.style.color = 'var(--theme-primary)';
      tag.style.borderColor = 'var(--theme-primary)';
      tag.textContent = LanguageService.t('changelog.currentTag');
      header.appendChild(tag);
    }

    return header;
  }

  /**
   * A collapsed release row — version, date, one-line summary — that expands
   * in place when tapped.
   */
  private createCollapsedRow(entry: ChangelogEntry): HTMLElement {
    const row = document.createElement('div');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'w-full text-left px-3 py-2.5 rounded-lg transition-colors';
    button.style.backgroundColor = 'var(--theme-card-background)';
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = 'var(--theme-card-hover, var(--theme-background-secondary))';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'var(--theme-card-background)';
    });

    const line = document.createElement('div');
    line.className = 'flex items-baseline gap-2 flex-wrap';

    const version = document.createElement('span');
    version.className = 'text-xs font-bold';
    version.style.fontFamily = 'var(--font-mono)';
    version.style.color = 'var(--theme-text)';
    version.textContent = `v${entry.version}`;
    line.appendChild(version);

    if (entry.date) {
      const date = document.createElement('span');
      date.className = 'text-xs';
      date.style.color = 'var(--theme-text-muted)';
      date.textContent = entry.date;
      line.appendChild(date);
    }
    button.appendChild(line);

    // BUG-043: highlights can be empty (parser skips short headers) — never
    // render a literal "undefined"
    // A headerless section carries `header: ''`, which is neither null nor
    // undefined — a `??` chain short-circuits on it and leaves the row with no
    // summary at all. `||` falls through empty strings, and the first bullet is
    // the only honest summary such a release has.
    const summaryText =
      entry.highlights[0] || entry.sections[0]?.header || entry.sections[0]?.bullets[0] || '';
    if (summaryText) {
      const summary = document.createElement('div');
      summary.className = 'text-xs mt-0.5';
      summary.style.color = 'var(--theme-text-muted)';
      summary.textContent = summaryText;
      button.appendChild(summary);
    }

    // Expanded body (hidden until opened). Built on FIRST expand rather than
    // up front: every release except one is a collapsed row, the body starts
    // `display: none`, and showChangelogIfUpdated opens this on a timer after
    // load with the whole release history in it. Constructing every section of
    // every release to immediately hide it is work no reader asked for.
    const body = document.createElement('div');
    body.className = 'hidden px-3 pt-1 pb-2 space-y-4';

    let bodyBuilt = false;
    button.addEventListener('click', () => {
      if (!bodyBuilt) {
        entry.sections.forEach((section) => {
          body.appendChild(this.createSectionBlock(section));
        });
        bodyBuilt = true;
      }
      const isOpen = !body.classList.contains('hidden');
      body.classList.toggle('hidden', isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
    });

    row.appendChild(button);
    row.appendChild(body);
    return row;
  }

  /**
   * Create a section block with header and accent-bullet descriptions.
   * The emoji lives in the header text straight from CHANGELOG-laymans.md.
   */
  private createSectionBlock(section: ChangelogSection): HTMLElement {
    const block = document.createElement('div');

    // A headerless section comes from the region above a release's first
    // "### " heading — a release written as plain bullets, or a headline bullet
    // ahead of its first heading (see the parser's extractSections). Render the
    // bullets without an empty heading rather than an h4 with no text in it.
    if (section.header) {
      const header = document.createElement('h4');
      header.className = 'text-sm font-semibold mb-1';
      header.style.color = 'var(--theme-text)';
      header.textContent = section.header;
      block.appendChild(header);
    }

    // Title badge (chip grey — never a meaning-bearing color)
    if (section.title) {
      const badge = document.createElement('span');
      badge.className = 'inline-block text-xs font-medium px-2 py-0.5 mb-2 rounded-full';
      badge.style.backgroundColor = 'var(--theme-card-background)';
      badge.style.color = 'var(--theme-text-muted)';
      badge.textContent = section.title;
      block.appendChild(badge);
    }

    if (section.bullets.length > 0) {
      const list = document.createElement('ul');
      list.className = 'space-y-1 ml-1';

      section.bullets.forEach((bullet) => {
        const item = document.createElement('li');
        item.className = 'flex items-start gap-2 text-sm';
        item.style.color = 'var(--theme-text-muted)';
        // Bullets take the accent: green means "safe" in the Accessibility
        // Checker and "close" in Dye Comparison, and a changelog bullet
        // means neither
        const dotSpan = document.createElement('span');
        dotSpan.className = 'flex-shrink-0 mt-0.5';
        dotSpan.style.color = 'var(--theme-primary)';
        dotSpan.textContent = '•';
        const textSpan = document.createElement('span');
        textSpan.textContent = bullet;
        item.appendChild(dotSpan);
        item.appendChild(textSpan);
        list.appendChild(item);
      });

      block.appendChild(list);
    }

    return block;
  }
}

/**
 * Show changelog modal if version has changed
 */
export function showChangelogIfUpdated(): void {
  if (ChangelogModal.shouldShow()) {
    // Small delay to ensure app is fully loaded and welcome modal has had a chance
    setTimeout(() => {
      const modal = new ChangelogModal();
      void modal.show({ mode: 'popup' });
    }, 1000);
  }
}

// Singleton instance for the manually-triggered "What's New" modal (header button).
// Kept separate from the auto-popup path (showChangelogIfUpdated) which uses its
// own short-lived instance.
let changelogModalInstance: ChangelogModal | null = null;

/**
 * Show the release-history changelog modal (newest expanded, rest collapsed).
 * Triggered by the "What's New" button in the header.
 * Uses a singleton to prevent multiple instances, matching the About/Theme/Language modals.
 */
export function showChangelogModal(): Promise<void> {
  if (!changelogModalInstance) {
    changelogModalInstance = new ChangelogModal();
  }
  return changelogModalInstance.show({ mode: 'history' });
}
