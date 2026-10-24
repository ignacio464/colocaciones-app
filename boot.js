/* Arranque: service worker (opcional) y pantalla de acceso. */
(function () {
'use strict';
const App = window.App, V = window.Vault;
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona igual sin él */ }); });
}
if (!V.supported()) App.showUnsupported();
else if (V.exists()) App.showLock();
else App.showCreate();
})();
