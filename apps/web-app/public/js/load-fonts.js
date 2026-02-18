/**
 * Asynchronously load Google Fonts to prevent render blocking
 * This script loads the font stylesheet after the page has started rendering
 */
(function() {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Onest:wght@100..900&family=Fira+Code:wght@400;500;600;700&family=Varela+Round&display=swap';
  link.rel = 'stylesheet';
  link.media = 'all';
  document.head.appendChild(link);
})();

