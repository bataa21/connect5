/* pwa.js
   - Registers the Service Worker
   - Handles the install button (beforeinstallprompt)
   - Counts page views
   - Shows iOS Add-to-Home-Screen hint AFTER a win, from the 2nd view onward
*/

(() => {
  // 1) Service Worker registration (keep this at the top)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./service-worker.js')
        .catch(err => console.log('SW register failed:', err));
    });
  }

  // 2) Install prompt + install button
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    // We take control so we can show our own button
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
    if (installBtn) installBtn.style.display = 'none';
  });

  // 3) Count page views (used to gate the iOS hint)
  try {
    const k = 'connect5-views';
    const n = (parseInt(localStorage.getItem(k) || '0', 10) + 1);
    localStorage.setItem(k, String(n));
  } catch {}

  // 4) iOS A2HS hint — show after a WIN, from 2nd+ page view, only once
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone; // legacy iOS
  const views = parseInt(localStorage.getItem('connect5-views') || '0', 10);
  const seen  = localStorage.getItem('connect5-iosA2HSSeen') === '1';

  if (isIOS && !isStandalone && !seen && views >= 2) {
    const lang = (localStorage.getItem('xoLanguage') || 'en');
    const tr   = (window.translations && window.translations[lang]) || {};

    const title  = tr.hintTitle  || 'Connect 5 — Add to Home Screen';
    const step1  = tr.hintStep1  || '1) Tap Share';
    const step2  = tr.hintStep2  || '2) Choose “Add to Home Screen”';
    const footer = tr.hintFooter || 'On iPhone: tap Share, then “Add to Home Screen”.';
    const okText = tr.gotIt      || 'Got it';

    function showIOSHintModal(){
      const backdrop = document.createElement('div');
      backdrop.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:99999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px';
      const card = document.createElement('div');
      card.style.cssText =
        'max-width:420px;background:#fff;border-radius:14px;padding:16px 18px;' +
        'box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#111';
      card.innerHTML = `
        <div style="font-weight:800;font-size:1.05rem;margin-bottom:8px">${title}</div>
        <div style="line-height:1.45;margin-bottom:8px">${step1} • ${step2}</div>
        <div style="opacity:.8;font-size:.95rem;margin-bottom:12px">${footer}</div>
        <div style="display:flex;justify-content:flex-end">
          <button id="a2hs-ok" style="background:#111827;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:700">${okText}</button>
        </div>`;
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);
      document.getElementById('a2hs-ok').addEventListener('click', () => {
        backdrop.remove();
        try { localStorage.setItem('connect5-iosA2HSSeen','1'); } catch {}
      });
    }

    // Show the modal only after a real game win in this session
    window.addEventListener('connect5:win', () => {
      if (localStorage.getItem('connect5-iosA2HSSeen') === '1') return;
      if (!localStorage.getItem('connect5.lastWinTs')) return; // belt & suspenders
      showIOSHintModal();
    }, { once: true });
  }
})();
