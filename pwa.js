/* pwa.js — PWA glue: SW, install prompt, and iOS Add-to-Home-Screen hint */
(() => {
  // --- Service Worker registration (scope works on GitHub Pages subpath) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .catch(console.error);
    });
  }

  // --- Install prompt (Android/Desktop) ---
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    // We’ll show our own Install button
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
    try { window.showToast?.('Installed!', 'success', 2200); } catch {}
  });

  // --- iOS A2HS detection helpers ---
  const UA = navigator.userAgent || navigator.vendor || '';
  const isiOS = /iphone|ipod/i.test(UA) || ((/ipad|macintosh/i.test(UA)) && 'ontouchend' in document);
  const isSafari = /safari/i.test(UA) && !/crios|fxios|edgios/i.test(UA); // exclude Chrome/Firefox/Edge on iOS
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  // --- Minimal CSS + modal HTML (injected dynamically) ---
  function ensureIOSModal() {
    if (document.getElementById('iosA2HSModal')) return;

    const css = `
      .iosa2hs{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.45);
        z-index:99999;transition:opacity .2s ease}
      .iosa2hs.hide{opacity:0;pointer-events:none}
      .iosa2hs-card{width:min(92vw,420px);background:#fff;border-radius:14px;padding:16px 16px 12px;
        box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
      .iosa2hs-title{font-weight:800;font-size:1.1rem;margin-bottom:6px;color:#111827}
      .iosa2hs-steps{display:flex;align-items:center;gap:12px;margin:12px 0;color:#111827}
      .iosa2hs-svg{width:28px;height:28px;flex:0 0 auto}
      .iosa2hs-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
      .iosa2hs-btn{background:#111827;color:#fff;border:none;border-radius:10px;padding:8px 12px;
        font-weight:700;cursor:pointer}
      .iosa2hs-btn.secondary{background:#e5e7eb;color:#111827}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const shareSVG = `
      <svg class="iosa2hs-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#111827" d="M12 3l3 3h-2v6h-2V6H9l3-3z"></path>
        <rect x="4" y="12" width="16" height="8" rx="2" ry="2" fill="none" stroke="#111827" stroke-width="2"/>
      </svg>
    `;

    const title = (window.translations?.[window.lang]?.title) || 'Connect 5';
    const line = (window.translations?.[window.lang]?.iosHint)
      || 'On iPhone: tap Share, then “Add to Home Screen”.';

    const html = `
      <div id="iosA2HSModal" class="iosa2hs hide" role="dialog" aria-modal="true" aria-label="Add to Home Screen help">
        <div class="iosa2hs-card" role="document">
          <div class="iosa2hs-title">${title} — Add to Home Screen</div>
          <div class="iosa2hs-steps">
            ${shareSVG}
            <div style="font-weight:600;line-height:1.45">
              1) Tap <strong>Share</strong> • 2) Choose <strong>“Add to Home Screen”</strong><br/>
              <span style="opacity:.8">${line}</span>
            </div>
          </div>
          <div class="iosa2hs-actions">
            <button id="iosA2HSClose" class="iosa2hs-btn">Got it</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('iosA2HSClose')?.addEventListener('click', hideIOSModal);
  }

  function showIOSModal() {
    ensureIOSModal();
    document.getElementById('iosA2HSModal')?.classList.remove('hide');
  }
  function hideIOSModal() {
    document.getElementById('iosA2HSModal')?.classList.add('hide');
  }
  // expose a helper so you can open it from anywhere (e.g., a “?” button)
  window.showIOSInstallHelp = showIOSModal;

  // --- Show iOS hint (toast + modal) once every 5 days ---
  function maybeShowIOSHint() {
    if (!isiOS || !isSafari || isStandalone()) return;

    const KEY = 'iosA2HS_last';
    const last = +localStorage.getItem(KEY) || 0;
    const now = Date.now();
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
    if (now - last < FIVE_DAYS) return;
    localStorage.setItem(KEY, String(now));

    const msg = (window.translations?.[window.lang]?.iosHint)
      || 'On iPhone: tap Share → “Add to Home Screen”.';

    // Use your existing helpers if present
    try { window.showToast?.(msg, 'info', 6500); } catch {}
    try { window.showBanner?.(msg, 'info'); } catch {}
    setTimeout(() => { try { window.showBanner?.('', null); } catch {} }, 7000);

    // Plus a small modal (dismissable)
    setTimeout(showIOSModal, 1200);
  }

  window.addEventListener('load', () => {
    setTimeout(maybeShowIOSHint, 800);
  });
})();
