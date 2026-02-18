/**
 * Service Worker Registration Script
 * Handles PWA offline support for XIV Dye Tools
 *
 * Extracted from inline script in index.html to comply with strict CSP
 */

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('XIV Dye Tools: Service Worker registered successfully', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch((error) => {
        console.log('XIV Dye Tools: Service Worker registration failed', error);
      });
  });

  // Listen for controller change (new SW installed)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('XIV Dye Tools: Service Worker controller changed - update available');
  });
}
