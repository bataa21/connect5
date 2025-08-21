// pwa.js
// 1) Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}

// 2) Install button
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = '';
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  // If your app.js defines showToast, this will use it; otherwise it silently no-ops.
  if (window.showToast) window.showToast('Installed!', 'success', 2200);
  if (installBtn) installBtn.style.display = 'none';
});

// 3) iOS “Add to Home Screen” hint (there is no native install prompt on iOS)
(function iosInstallHint(){
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone; // legacy iOS

  if (isiOS && !isStandalone) {
    const msg = (window.translations?.en?.iosHint) ||
      'On iPhone: Share → Add to Home Screen';
    if (window.showToast) window.showToast(msg, 'info', 6000);
    if (window.showBanner) {
      window.showBanner(msg, 'info');
      setTimeout(() => window.showBanner('', null), 6500);
    }
  }
})();
