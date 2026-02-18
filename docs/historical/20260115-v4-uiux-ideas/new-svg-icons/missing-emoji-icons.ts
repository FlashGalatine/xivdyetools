/**
 * XIV Dye Tools - Missing Emoji Replacement Icons
 *
 * These icons are NOT currently in the existing icon files and need to be added
 * to replace emoji characters still used in the codebase.
 *
 * INTEGRATION: Add these to src/shared/ui-icons.ts or src/shared/empty-state-icons.ts
 *
 * @module docs/missing-emoji-icons
 */

// ============================================================================
// ICONS TO ADD TO ui-icons.ts
// ============================================================================

/**
 * 🔗 Link/Copy URL icon - Chain link for sharing
 * NOTE: ICON_SHARE exists but uses a different design. This matches the "copy link" use case.
 *
 * Used in:
 *   - preset-detail-view.ts:329 (🔗 Share/copy link button)
 *   - preset-detail.ts:642 (🔗 Copy Link button)
 */
export const ICON_LINK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5"/>
  <path d="M14 11a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1.5-1.5"/>
</svg>`;

/**
 * 📝 Write/Document icon - For submissions
 *
 * Used in:
 *   - my-submissions-panel.ts:180 (📝 Edit submission action)
 *   - preset-tool.ts:695 (📝 User submissions section)
 */
export const ICON_DOCUMENT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 3v4a1 1 0 001 1h4"/>
  <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
  <path d="M9 9h1M9 13h6M9 17h6"/>
</svg>`;

/**
 * 🔐 Locked/Padlock icon - Auth required
 *
 * Used in:
 *   - preset-tool.ts:683 (🔐 Locked presets section)
 *   - auth-service.ts (multiple debug logs)
 */
export const ICON_LOCKED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="11" width="14" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 018 0v4"/>
  <circle cx="12" cy="16" r="1" fill="currentColor"/>
</svg>`;

/**
 * 🔒 Lock icon - Security indicator (similar to locked but for general security)
 *
 * Used in:
 *   - image-upload-display.ts:161 (🔒 Lock symbol for restricted content)
 */
export const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="11" width="14" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 018 0v4"/>
  <circle cx="12" cy="16" r="1" fill="currentColor"/>
</svg>`;

/**
 * 📡 Network/Antenna icon - Connection status
 *
 * Used in:
 *   - offline-banner.ts:99 (📡 Connection status indicator)
 *   - main.ts:86 (📡 Offline banner initialized)
 */
export const ICON_NETWORK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 20v-4"/>
  <path d="M12 12V8"/>
  <path d="M12 4l6 4-6 4-6-4 6-4z"/>
  <path d="M6 8v4l6 4 6-4V8"/>
  <circle cx="12" cy="20" r="2"/>
</svg>`;

/**
 * 📚 Tutorial/Book icon - Guide and documentation
 *
 * Used in:
 *   - tutorial-service.ts:565 (📚 Tutorial prompt title)
 *   - collection-service.ts:118 (📚 CollectionService initialized)
 */
export const ICON_BOOK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
  <path d="M8 7h8M8 11h8M8 15h5"/>
</svg>`;

/**
 * ✅ Success/Checkmark icon - For success states
 *
 * Used in:
 *   - main.ts (multiple success logs)
 *   - services/index.ts (13 success confirmations)
 *
 * NOTE: Primarily used in console logging, but useful for UI success states too
 */
export const ICON_SUCCESS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M8 12l3 3 5-6"/>
</svg>`;

/**
 * ❌ Error/X icon - For error states
 *
 * Used in:
 *   - main.ts:95 (❌ Failed to initialize application)
 *
 * NOTE: Primarily used in console logging, but useful for UI error states too
 */
export const ICON_ERROR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M15 9l-6 6M9 9l6 6"/>
</svg>`;

// ============================================================================
// ICON TO ADD TO empty-state-icons.ts
// ============================================================================

/**
 * 📭 Empty Mailbox icon - No submissions/content
 *
 * Used in:
 *   - preset-tool.ts:705 (📭 No mailbox/empty state)
 */
export const ICON_EMPTY_INBOX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 9l9-6 9 6v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
  <path d="M3 9l9 6 9-6"/>
  <path d="M12 15v-3" stroke-dasharray="2 2"/>
</svg>`;

// ============================================================================
// INTEGRATION INSTRUCTIONS
// ============================================================================

/**
 * HOW TO INTEGRATE:
 *
 * 1. Add these constants to the appropriate files:
 *    - ICON_LINK, ICON_DOCUMENT, ICON_LOCKED, ICON_LOCK, ICON_NETWORK, ICON_BOOK,
 *      ICON_SUCCESS, ICON_ERROR → ui-icons.ts
 *    - ICON_EMPTY_INBOX → empty-state-icons.ts
 *
 * 2. Add to the UI_ICONS map in ui-icons.ts:
 *    ```typescript
 *    link: ICON_LINK,
 *    document: ICON_DOCUMENT,
 *    locked: ICON_LOCKED,
 *    lock: ICON_LOCK,
 *    network: ICON_NETWORK,
 *    book: ICON_BOOK,
 *    success: ICON_SUCCESS,
 *    error: ICON_ERROR,
 *    ```
 *
 * 3. Add to EMPTY_STATE_ICONS map in empty-state-icons.ts:
 *    ```typescript
 *    'empty-inbox': ICON_EMPTY_INBOX,
 *    ```
 *
 * 4. Replace emoji usage in components:
 *    - preset-detail-view.ts: Replace '🔗' with getUIIcon('link')
 *    - preset-tool.ts: Replace '🔐' with getUIIcon('locked')
 *    - offline-banner.ts: Replace '📡' with getUIIcon('network')
 *    - etc.
 */

// ============================================================================
// EMOJI TO EXISTING ICON MAPPING
// (For reference - these already exist in the codebase!)
// ============================================================================

/**
 * Emojis that ALREADY have SVG replacements in the codebase:
 *
 * | Emoji | Use Instead | From File |
 * |-------|-------------|-----------|
 * | ⚔️   | getCategoryIcon('jobs') | category-icons.ts |
 * | 🏰   | getCategoryIcon('grand-companies') | category-icons.ts |
 * | 🌸   | getCategoryIcon('seasons') | category-icons.ts |
 * | 🎉   | getCategoryIcon('events') | category-icons.ts |
 * | 🎨   | getCategoryIcon('community') | category-icons.ts |
 * | ⚠️   | getUIIcon('warning') | ui-icons.ts |
 * | 🔧   | getUIIcon('settings') | ui-icons.ts |
 * | 📷   | getUIIcon('camera') | ui-icons.ts |
 * | 🌐   | getUIIcon('globe') | ui-icons.ts |
 * | 🔍   | getUIIcon('search') | ui-icons.ts |
 * | ✏️   | getUIIcon('edit') | ui-icons.ts |
 * | 🗑️   | getUIIcon('trash') | ui-icons.ts |
 * | 📁   | getEmptyStateIcon('folder') | empty-state-icons.ts |
 */
