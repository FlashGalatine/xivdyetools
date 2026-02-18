/**
 * Asynchronously load non-critical CSS to prevent render blocking
 * This script loads CSS stylesheets after the page has started rendering
 */
(function() {
  const stylesheets = [
    'assets/css/shared-styles.css',
    'src/styles/themes.css',
    'src/styles/globals.css'
  ];

  stylesheets.forEach(function(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'all';
    document.head.appendChild(link);
  });
})();

