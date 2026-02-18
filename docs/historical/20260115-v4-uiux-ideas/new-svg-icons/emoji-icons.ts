/**
 * XIV Dye Tools - Emoji Replacement SVG Icons
 *
 * This file contains SVG icon strings to replace emoji characters throughout
 * the xivdyetools-web-app codebase. All icons are 24x24 with stroke-width 1.5.
 *
 * Usage:
 *   import { EMOJI_ICONS } from '@/constants/emoji-icons';
 *   // Replace: { name: 'Jobs', icon: '⚔️' }
 *   // With:    { name: 'Jobs', icon: EMOJI_ICONS.jobs }
 *
 * Generated from deep-dive analysis of 90+ emoji occurrences across 20+ files.
 */

// ============================================================================
// PRESET CATEGORY ICONS
// Used in: preset-submission-form.ts, preset-edit-form.ts, hybrid-preset-service.ts
// ============================================================================

/** ⚔️ Jobs - Crossed swords representing FFXIV Jobs/Classes */
export const ICON_JOBS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M14.5 17.5L3 6V3h3l11.5 11.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13 19l6-6 2 2-6 6-2-2z" stroke-linejoin="round"/>
  <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 19l6-6 2 2-6 6-2-2z" stroke-linejoin="round"/>
</svg>`;

/** 🏰 Grand Companies - Castle/fortress */
export const ICON_GRAND_COMPANIES = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M4 21V11l4-4v14" stroke-linejoin="round"/>
  <path d="M8 21V7l4-4 4 4v14" stroke-linejoin="round"/>
  <path d="M16 21V11l4 4v6" stroke-linejoin="round"/>
  <path d="M10 21v-4h4v4"/>
  <rect x="11" y="10" width="2" height="2" fill="currentColor" fill-opacity="0.3"/>
  <rect x="5" y="13" width="2" height="2"/>
  <rect x="17" y="15" width="2" height="2"/>
</svg>`;

/** 🌸 Seasons - Cherry blossom flower */
export const ICON_SEASONS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <circle cx="12" cy="12" r="2" fill="currentColor" fill-opacity="0.3"/>
  <path d="M12 2c0 3-2 5-2 5s2 2 2 5c0-3 2-5 2-5s-2-2-2-5z" stroke-linejoin="round"/>
  <path d="M22 12c-3 0-5-2-5-2s-2 2-5 2c3 0 5 2 5 2s2-2 5-2z" stroke-linejoin="round"/>
  <path d="M19.07 4.93c-2.12 2.12-2.12 4.24-2.12 4.24s2.12 0 4.24-2.12c-2.12-2.12-4.24-2.12-4.24-2.12s0 2.12 2.12 4.24" stroke-linejoin="round"/>
  <path d="M4.93 19.07c2.12-2.12 2.12-4.24 2.12-4.24s-2.12 0-4.24 2.12c2.12 2.12 4.24 2.12 4.24 2.12s0-2.12-2.12-4.24" stroke-linejoin="round"/>
  <path d="M4.93 4.93c2.12 2.12 4.24 2.12 4.24 2.12s0-2.12-2.12-4.24c-2.12 2.12-2.12 4.24-2.12 4.24s2.12 0 4.24-2.12" stroke-linejoin="round"/>
  <path d="M19.07 19.07c-2.12-2.12-4.24-2.12-4.24-2.12s0 2.12 2.12 4.24c2.12-2.12 2.12-4.24 2.12-4.24s-2.12 0-4.24 2.12" stroke-linejoin="round"/>
</svg>`;

/** 🎉 Events - Party popper for celebrations */
export const ICON_EVENTS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M4 20l8-16 3 6 5-2-8 16-3-6-5 2z" stroke-linejoin="round"/>
  <path d="M6 10l-2-1" stroke-linecap="round"/>
  <path d="M4 6l-1-2" stroke-linecap="round"/>
  <path d="M10 5l1-3" stroke-linecap="round"/>
  <circle cx="3" cy="3" r="1" fill="currentColor"/>
  <circle cx="7" cy="4" r="0.5" fill="currentColor"/>
  <circle cx="20" cy="8" r="1" fill="currentColor"/>
  <circle cx="18" cy="4" r="0.5" fill="currentColor"/>
  <circle cx="21" cy="12" r="0.5" fill="currentColor"/>
  <path d="M17 3l1 2" stroke-linecap="round"/>
  <path d="M20 5l2 1" stroke-linecap="round"/>
</svg>`;

/** 🎨 Community - Artist palette */
export const ICON_COMMUNITY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.1 0 2-.9 2-2 0-.51-.2-.98-.52-1.34-.31-.35-.48-.82-.48-1.33 0-1.1.9-2 2-2h2.36c3.1 0 5.64-2.54 5.64-5.64C23 6.17 18.18 2 12 2z" stroke-linejoin="round"/>
  <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/>
  <circle cx="10.5" cy="6.5" r="1.5" fill="currentColor"/>
  <circle cx="15.5" cy="6.5" r="1.5" fill="currentColor"/>
  <circle cx="18" cy="10" r="1.5" fill="currentColor"/>
</svg>`;

/** 📁 Folder - Default category icon */
export const ICON_FOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H12L10 5H5C3.89543 5 3 5.89543 3 7Z" stroke-linejoin="round"/>
</svg>`;

// ============================================================================
// ACTION ICONS
// Used in: my-submissions-panel.ts, preset-detail.ts, preset-detail-view.ts
// ============================================================================

/** ✏️ Edit - Pencil icon */
export const ICON_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M16.862 4.487l2.651 2.651M19.513 7.138L8.3 18.35l-3.8 1 1-3.8L16.712 4.338a1.875 1.875 0 012.651 0l.15.15a1.875 1.875 0 010 2.65z" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** 🗑️ Delete - Trash can icon */
export const ICON_DELETE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M4 6h16M6 6v12a2 2 0 002 2h8a2 2 0 002-2V6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M10 11v5M14 11v5" stroke-linecap="round"/>
</svg>`;

/** 🔗 Link - Chain link for sharing */
export const ICON_LINK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M10 13a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14 11a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1.5-1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** 📝 Write - Document with lines */
export const ICON_WRITE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M14 3v4a1 1 0 001 1h4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" stroke-linejoin="round"/>
  <path d="M9 9h1M9 13h6M9 17h6" stroke-linecap="round"/>
</svg>`;

// ============================================================================
// STATUS ICONS
// Used in: preset-tool.ts, image-upload-display.ts, empty states
// ============================================================================

/** ⚠️ Warning - Triangle with exclamation */
export const ICON_WARNING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke-linejoin="round"/>
  <path d="M12 9v4" stroke-linecap="round"/>
  <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
</svg>`;

/** 🔐 Locked - Padlock for auth required */
export const ICON_LOCKED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <rect x="5" y="11" width="14" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 018 0v4" stroke-linecap="round"/>
  <circle cx="12" cy="16" r="1" fill="currentColor"/>
</svg>`;

/** 🔒 Lock - Security indicator */
export const ICON_LOCK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <rect x="5" y="11" width="14" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 018 0v4"/>
  <circle cx="12" cy="16" r="1" fill="currentColor"/>
</svg>`;

/** 📭 Empty - Empty mailbox for no content */
export const ICON_EMPTY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M3 9l9-6 9 6v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke-linejoin="round"/>
  <path d="M3 9l9 6 9-6"/>
  <path d="M12 15v-3" stroke-linecap="round" stroke-dasharray="2 2"/>
</svg>`;

/** ✅ Success - Checkmark in circle */
export const ICON_SUCCESS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <circle cx="12" cy="12" r="9"/>
  <path d="M8 12l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ============================================================================
// UI ELEMENT ICONS
// Used in: camera-preview-modal.ts, offline-banner.ts, tutorial-service.ts
// ============================================================================

/** 📷 Camera - Camera device */
export const ICON_CAMERA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M3 7a2 2 0 012-2h3l1.5-2h5L16 5h3a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke-linejoin="round"/>
  <circle cx="12" cy="11" r="4"/>
</svg>`;

/** 📡 Network - Antenna for connection status */
export const ICON_NETWORK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M12 20v-4" stroke-linecap="round"/>
  <path d="M12 12V8" stroke-linecap="round"/>
  <path d="M12 4l6 4-6 4-6-4 6-4z" stroke-linejoin="round"/>
  <path d="M6 8v4l6 4 6-4V8" stroke-linejoin="round"/>
  <circle cx="12" cy="20" r="2"/>
</svg>`;

/** 🌐 Globe - Remote/online indicator */
export const ICON_GLOBE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <circle cx="12" cy="12" r="9"/>
  <path d="M3.6 9h16.8M3.6 15h16.8"/>
  <path d="M12 3c2.5 3 3.5 6 3.5 9s-1 6-3.5 9c-2.5-3-3.5-6-3.5-9s1-6 3.5-9z"/>
</svg>`;

/** 📚 Tutorial - Open book */
export const ICON_TUTORIAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke-linecap="round"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke-linejoin="round"/>
  <path d="M8 7h8M8 11h8M8 15h5" stroke-linecap="round"/>
</svg>`;

/** 🔍 Search - Magnifying glass */
export const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <circle cx="10" cy="10" r="6"/>
  <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
</svg>`;

// ============================================================================
// SYSTEM / DEBUG ICONS (Optional - primarily for console logging)
// Used in: main.ts, services/index.ts, various service files
// ============================================================================

/** 🚀 Rocket - Startup/launch indicator */
export const ICON_ROCKET = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M4.5 16.5L8 13l-1.5-1.5 6-6C15 3 18 2 21 2c0 3-1 6-3.5 8.5l-6 6L10 15l-3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14.5 9.5l-5 5" stroke-linecap="round"/>
  <path d="M5 21l3-3M3 19l3-3" stroke-linecap="round"/>
</svg>`;

/** ❌ Error - X in circle */
export const ICON_ERROR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <circle cx="12" cy="12" r="9"/>
  <path d="M15 9l-6 6M9 9l6 6" stroke-linecap="round"/>
</svg>`;

/** 🔧 Settings - Gear cog */
export const ICON_SETTINGS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
</svg>`;

/** 📦 Package - 3D box for storage */
export const ICON_PACKAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M12.89 1.45l8 4A2 2 0 0122 7.24v9.53a2 2 0 01-1.11 1.79l-8 4a2 2 0 01-1.78 0l-8-4A2 2 0 012 16.76V7.24a2 2 0 011.11-1.79l8-4a2 2 0 011.78 0z" stroke-linejoin="round"/>
  <path d="M2.32 6.16L12 11l9.68-4.84"/>
  <path d="M12 22V11"/>
</svg>`;

/** 📢 Announcer - Megaphone */
export const ICON_ANNOUNCER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M19 5L5 12l14 7V5z" stroke-linejoin="round"/>
  <path d="M5 12H2" stroke-linecap="round"/>
  <path d="M5 12v6a2 2 0 002 2h1" stroke-linecap="round"/>
</svg>`;

/** 🍞 Toast - Notification card */
export const ICON_TOAST = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <rect x="3" y="6" width="18" height="12" rx="2"/>
  <path d="M3 10h18"/>
  <path d="M8 14h8" stroke-linecap="round"/>
  <path d="M10 6V4a2 2 0 014 0v2"/>
</svg>`;

/** 🏗️ Build - Construction building */
export const ICON_BUILD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M2 20h20" stroke-linecap="round"/>
  <path d="M5 20V10l7-7 7 7v10" stroke-linejoin="round"/>
  <path d="M9 20v-6h6v6"/>
  <path d="M5 10h14" stroke-dasharray="2 2" opacity="0.5"/>
</svg>`;

/** 📥 Import - Download arrow */
export const ICON_IMPORT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke-width="1.5" stroke="currentColor" fill="none">
  <path d="M12 3v12" stroke-linecap="round"/>
  <path d="M8 11l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke-linecap="round"/>
</svg>`;

// ============================================================================
// GROUPED EXPORT OBJECT
// For convenient access to all icons
// ============================================================================

export const EMOJI_ICONS = {
  // Preset Categories
  jobs: ICON_JOBS,
  grandCompanies: ICON_GRAND_COMPANIES,
  seasons: ICON_SEASONS,
  events: ICON_EVENTS,
  community: ICON_COMMUNITY,
  folder: ICON_FOLDER,

  // Actions
  edit: ICON_EDIT,
  delete: ICON_DELETE,
  link: ICON_LINK,
  write: ICON_WRITE,

  // Status
  warning: ICON_WARNING,
  locked: ICON_LOCKED,
  lock: ICON_LOCK,
  empty: ICON_EMPTY,
  success: ICON_SUCCESS,

  // UI Elements
  camera: ICON_CAMERA,
  network: ICON_NETWORK,
  globe: ICON_GLOBE,
  tutorial: ICON_TUTORIAL,
  search: ICON_SEARCH,

  // System/Debug (optional use)
  rocket: ICON_ROCKET,
  error: ICON_ERROR,
  settings: ICON_SETTINGS,
  package: ICON_PACKAGE,
  announcer: ICON_ANNOUNCER,
  toast: ICON_TOAST,
  build: ICON_BUILD,
  import: ICON_IMPORT,
} as const;

// ============================================================================
// EMOJI TO ICON MAPPING
// For programmatic replacement
// ============================================================================

export const EMOJI_TO_ICON_MAP: Record<string, string> = {
  // Preset Categories
  '⚔️': ICON_JOBS,
  '🏰': ICON_GRAND_COMPANIES,
  '🌸': ICON_SEASONS,
  '🎉': ICON_EVENTS,
  '🎨': ICON_COMMUNITY,
  '📁': ICON_FOLDER,

  // Actions
  '✏️': ICON_EDIT,
  '🗑️': ICON_DELETE,
  '🔗': ICON_LINK,
  '📝': ICON_WRITE,

  // Status
  '⚠️': ICON_WARNING,
  '🔐': ICON_LOCKED,
  '🔒': ICON_LOCK,
  '📭': ICON_EMPTY,
  '✅': ICON_SUCCESS,

  // UI Elements
  '📷': ICON_CAMERA,
  '📡': ICON_NETWORK,
  '🌐': ICON_GLOBE,
  '📚': ICON_TUTORIAL,
  '🔍': ICON_SEARCH,

  // System/Debug
  '🚀': ICON_ROCKET,
  '❌': ICON_ERROR,
  '🔧': ICON_SETTINGS,
  '📦': ICON_PACKAGE,
  '📢': ICON_ANNOUNCER,
  '🍞': ICON_TOAST,
  '🏗️': ICON_BUILD,
  '📥': ICON_IMPORT,
};

/**
 * Utility function to replace emoji with SVG icon
 * @param emoji - The emoji character to replace
 * @returns SVG string or the original emoji if not found
 */
export function getIconForEmoji(emoji: string): string {
  return EMOJI_TO_ICON_MAP[emoji] ?? emoji;
}

export type EmojiIconKey = keyof typeof EMOJI_ICONS;
