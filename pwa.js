'use strict';

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => {
        console.warn('Offline support or update check unavailable:', error);
      });
  });
}
