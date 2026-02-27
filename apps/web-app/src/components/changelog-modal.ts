/**
 * XIV Dye Tools - Changelog Modal Component
 *
 * Shows "What's New" modal after version updates
 * Displays recent changes to returning users
 *
 * Changelog data is automatically parsed from CHANGELOG-laymans.md at build time
 * by the vite-plugin-changelog-parser plugin, providing rich section data
 * (headers, titles, and bullet descriptions).
 *
 * @module components/changelog-modal
 */

import { ModalService } from '@services/modal-service';
import { StorageService } from '@services/storage-service';
import { LanguageService } from '@services/language-service';
import { STORAGE_KEYS, APP_VERSION } from '@shared/constants';
import { changelogEntries } from 'virtual:changelog';

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

// ============================================================================
// Changelog Modal Class
// ============================================================================

/**
 * Changelog modal for returning users after updates
 */
export class ChangelogModal {
  private modalId: string | null = null;

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
   * Get the entries to display (current version + recent history)
   * Uses dynamically parsed changelog data from CHANGELOG-laymans.md
   */
  private getRelevantEntries(): ChangelogEntry[] {
    // Find current version entry from parsed changelog
    const currentEntry = changelogEntries.find((e) => e.version === APP_VERSION);

    // Get up to 2 previous versions for context
    const currentIndex = changelogEntries.findIndex((e) => e.version === APP_VERSION);
    const previousEntries = changelogEntries.slice(currentIndex + 1, currentIndex + 3);

    const entries: ChangelogEntry[] = [];
    if (currentEntry) {
      entries.push(currentEntry);
    }
    entries.push(...previousEntries);

    return entries;
  }

  /**
   * Show the changelog modal
   */
  show(): void {
    if (this.modalId) return; // Already showing

    const content = this.createContent();

    this.modalId = ModalService.showChangelog({
      title: LanguageService.t('changelog.title'),
      content,
      size: 'lg',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
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
    if (this.modalId) {
      ModalService.dismiss(this.modalId);
      this.modalId = null;
    }
  }

  /**
   * Create modal content
   */
  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'changelog-modal-content';

    const entries = this.getRelevantEntries();

    if (entries.length === 0) {
      // Fallback if no changelog data for current version
      const fallback = document.createElement('p');
      fallback.className = 'text-gray-600 dark:text-gray-300';
      fallback.textContent = LanguageService.t('changelog.noChanges');
      container.appendChild(fallback);
    } else {
      // Current version — render full sections
      const currentEntry = entries[0];
      if (currentEntry) {
        const currentContent = this.createCurrentVersionContent(currentEntry);
        container.appendChild(currentContent);
      }

      // Previous versions (collapsed summary using highlights)
      if (entries.length > 1) {
        const previousSection = document.createElement('div');
        previousSection.className = 'mt-6 pt-4 border-t border-gray-200 dark:border-gray-700';

        const previousTitle = document.createElement('h4');
        previousTitle.className = 'text-sm font-medium text-gray-500 dark:text-gray-400 mb-3';
        previousTitle.textContent = LanguageService.t('changelog.previousUpdates');
        previousSection.appendChild(previousTitle);

        const previousList = document.createElement('div');
        previousList.className = 'space-y-2';

        entries.slice(1).forEach((entry) => {
          const item = document.createElement('div');
          item.className = 'text-sm text-gray-600 dark:text-gray-400';
          // SECURITY: Use DOM construction instead of innerHTML for text content
          const versionSpan = document.createElement('span');
          versionSpan.className = 'font-medium';
          versionSpan.textContent = `v${entry.version}`;
          item.appendChild(versionSpan);
          item.appendChild(document.createTextNode(` — ${entry.highlights[0]}`));
          previousList.appendChild(item);
        });

        previousSection.appendChild(previousList);
        container.appendChild(previousSection);
      }
    }

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className =
      'flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700';

    // View full changelog link
    const viewFullBtn = document.createElement('a');
    viewFullBtn.className = 'text-sm text-blue-600 dark:text-blue-400 hover:underline';
    viewFullBtn.href =
      'https://github.com/FlashGalatine/xivdyetools/blob/main/apps/web-app/CHANGELOG.md';
    viewFullBtn.target = '_blank';
    viewFullBtn.rel = 'noopener noreferrer';
    viewFullBtn.textContent = LanguageService.t('changelog.viewFull');

    // Got it button
    const gotItBtn = document.createElement('button');
    gotItBtn.className = `
      px-6 py-2 text-sm font-medium rounded-lg
      text-white bg-blue-600 hover:bg-blue-700 transition-colors
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
    `
      .replace(/\s+/g, ' ')
      .trim();
    gotItBtn.textContent = LanguageService.t('changelog.gotIt');
    gotItBtn.addEventListener('click', () => {
      this.close();
    });

    buttonContainer.appendChild(viewFullBtn);
    buttonContainer.appendChild(gotItBtn);
    container.appendChild(buttonContainer);

    return container;
  }

  /**
   * Create the rich content for the current version using full sections
   * Shows section headers, titles, and bullet descriptions
   */
  private createCurrentVersionContent(entry: ChangelogEntry): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-5';

    // Use sections if available, otherwise fall back to highlights
    if (entry.sections && entry.sections.length > 0) {
      entry.sections.forEach((section) => {
        const sectionEl = this.createSectionBlock(section);
        wrapper.appendChild(sectionEl);
      });
    } else {
      // Fallback: render highlights as simple list (backward compat)
      const list = this.createHighlightsList(entry.highlights);
      wrapper.appendChild(list);
    }

    return wrapper;
  }

  /**
   * Create a section block with header, title badge, and bullet descriptions
   */
  private createSectionBlock(section: ChangelogSection): HTMLElement {
    const block = document.createElement('div');

    // Section header (e.g., "🎨 No More Duplicate Results")
    const header = document.createElement('h4');
    header.className = 'text-base font-semibold text-gray-800 dark:text-gray-100 mb-1';
    header.textContent = section.header;
    block.appendChild(header);

    // Title badge (e.g., "Harmony Explorer & Palette Extractor")
    if (section.title) {
      const badge = document.createElement('span');
      badge.className =
        'inline-block text-xs font-medium px-2 py-0.5 mb-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      badge.textContent = section.title;
      block.appendChild(badge);
    }

    // Bullet descriptions
    if (section.bullets.length > 0) {
      const list = document.createElement('ul');
      list.className = 'space-y-1 ml-1';

      section.bullets.forEach((bullet) => {
        const item = document.createElement('li');
        item.className = 'flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300';
        // SECURITY: Use DOM construction instead of innerHTML for text content
        const dotSpan = document.createElement('span');
        dotSpan.className = 'text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5';
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

  /**
   * Create a simple highlights list (fallback when sections are not available)
   */
  private createHighlightsList(highlights: string[]): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'space-y-2';

    highlights.forEach((highlight) => {
      const item = document.createElement('li');
      item.className = 'flex items-start gap-2 text-gray-600 dark:text-gray-300';
      // SECURITY: Use DOM construction instead of innerHTML for text content
      const starSpan = document.createElement('span');
      starSpan.className = 'text-green-500 dark:text-green-400 flex-shrink-0';
      starSpan.textContent = '★';
      const textSpan = document.createElement('span');
      textSpan.textContent = highlight;
      item.appendChild(starSpan);
      item.appendChild(textSpan);
      list.appendChild(item);
    });

    return list;
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
      modal.show();
    }, 1000);
  }
}
