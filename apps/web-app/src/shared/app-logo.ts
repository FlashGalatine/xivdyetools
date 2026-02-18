/**
 * XIV Dye Tools - App Logo SVG
 *
 * Inline SVG logo using rainbow gradient for case and currentColor for brush
 * Features "The Crossed Artisan" design - a supply case with crossed brush
 *
 * @module shared/app-logo
 */

/**
 * XIV Dye Tools logo - The Crossed Artisan (Supply case with crossed brush)
 * Rainbow gradient on case body, currentColor on brush for theme adaptation
 */
export const LOGO_SPARKLES = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rainbowGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff0000"/>
      <stop offset="17%" stop-color="#ff8000"/>
      <stop offset="33%" stop-color="#ffff00"/>
      <stop offset="50%" stop-color="#00ff00"/>
      <stop offset="67%" stop-color="#0080ff"/>
      <stop offset="83%" stop-color="#4000ff"/>
      <stop offset="100%" stop-color="#8000ff"/>
    </linearGradient>
    <linearGradient id="rainbowHighlight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6666" stop-opacity="0.6"/>
      <stop offset="33%" stop-color="#ffff99" stop-opacity="0.6"/>
      <stop offset="67%" stop-color="#66ffcc" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#cc99ff" stop-opacity="0.6"/>
    </linearGradient>
  </defs>

  <!-- Case Body with Rainbow Fill -->
  <rect x="28" y="38" width="72" height="64" rx="4" fill="url(#rainbowGradient)" fill-opacity="0.25" stroke="url(#rainbowGradient)" stroke-width="3"/>

  <!-- Case Divider Lines -->
  <path d="M28 60 H100" stroke="url(#rainbowHighlight)" stroke-width="2"/>
  <path d="M28 80 H100" stroke="url(#rainbowHighlight)" stroke-width="2"/>

  <!-- Case Handle/Latch -->
  <rect x="58" y="32" width="12" height="8" rx="1" stroke="url(#rainbowGradient)" stroke-width="2" fill="none"/>

  <!-- Crossed Brush (currentColor for theme adaptation) -->
  <g transform="rotate(-45 64 64)">
    <!-- Brush Handle -->
    <path d="M60 10 L60 80" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
    <!-- Ferrule -->
    <path d="M60 80 L54 90 H66 L60 80" fill="currentColor"/>
    <!-- Bristles -->
    <path d="M54 90 C 54 90, 54 110, 60 118 C 66 110, 66 90, 66 90 Z" fill="currentColor" fill-opacity="0.6"/>
  </g>

  <!-- Sparkle (currentColor for theme adaptation) -->
  <path d="M96 28 L99 36 L106 38 L99 40 L96 48 L93 40 L86 38 L93 36 Z" fill="currentColor"/>
</svg>`;
