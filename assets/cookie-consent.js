(function () {
  const CONSENT_KEY = 'apam_cookie_consent_v1';
  const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 183;
  const config = window.COOKIE_CONSENT_CONFIG || {};
  const gaId = config.gaMeasurementId || '{{GA_MEASUREMENT_ID}}';

  const defaultConsent = {
    necessary: true,
    analytics: false,
    updatedAt: new Date().toISOString()
  };

  function now() {
    return Date.now();
  }

  function readConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.updatedAt) return null;
      const age = now() - new Date(parsed.updatedAt).getTime();
      if (Number.isNaN(age) || age > SIX_MONTHS_MS) {
        localStorage.removeItem(CONSENT_KEY);
        return null;
      }
      return {
        necessary: true,
        analytics: !!parsed.analytics,
        updatedAt: parsed.updatedAt
      };
    } catch (error) {
      return null;
    }
  }

  function writeConsent(consent) {
    const next = {
      necessary: true,
      analytics: !!consent.analytics,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
    return next;
  }

  function shouldLoadAnalytics(consent) {
    return consent && consent.analytics === true;
  }

  function loadGoogleAnalytics() {
    if (!gaId || gaId.includes('{{')) return;
    if (window.__apamGaLoaded) return;
    window.__apamGaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', gaId, { anonymize_ip: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(script);
  }

  function createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .cc-banner,.cc-panel,.cc-manage{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;z-index:9999}
      .cc-banner,.cc-panel{position:fixed;left:16px;right:16px;bottom:16px;background:#0f1118;color:#f3f5ff;border:1px solid #2c3142;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.35);max-width:760px}
      .cc-banner{padding:16px 16px 14px}
      .cc-banner h3,.cc-panel h3{margin:0 0 8px;font-size:1rem}
      .cc-banner p,.cc-panel p{margin:0 0 10px;color:#c8d0e6;font-size:.92rem;line-height:1.45}
      .cc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .cc-btn{border:1px solid #3a4157;background:#1a1f2d;color:#fff;padding:9px 12px;border-radius:9px;cursor:pointer}
      .cc-btn:hover{background:#252c3e}
      .cc-btn.primary{background:#2f6bff;border-color:#2f6bff}
      .cc-btn.primary:hover{background:#2458d4}
      .cc-panel{padding:16px;display:none}
      .cc-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #2a3042}
      .cc-row:first-of-type{border-top:none}
      .cc-toggle{accent-color:#2f6bff;width:18px;height:18px}
      .cc-manage{position:fixed;right:16px;bottom:16px;background:#11182a;color:#d8e2ff;border:1px solid #33415f;padding:8px 10px;border-radius:20px;cursor:pointer;display:none}
      @media (max-width:640px){.cc-banner,.cc-panel{left:10px;right:10px;bottom:10px}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    createStyles();

    const banner = document.createElement('section');
    banner.className = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Gestion des cookies');
    banner.innerHTML = `
      <h3>Gestion des cookies</h3>
      <p>Nous utilisons des cookies nécessaires au fonctionnement du site et, avec votre accord, des cookies de mesure d'audience (Google Analytics).</p>
      <div class="cc-actions">
        <button class="cc-btn primary" data-action="accept-all">Tout accepter</button>
        <button class="cc-btn" data-action="reject-all">Tout refuser</button>
        <button class="cc-btn" data-action="customize">Personnaliser</button>
      </div>
    `;

    const panel = document.createElement('section');
    panel.className = 'cc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Personnalisation des cookies');
    panel.innerHTML = `
      <h3>Personnaliser les cookies</h3>
      <p>Vous pouvez choisir les catégories de cookies que vous autorisez.</p>
      <div class="cc-row">
        <div>
          <strong>Nécessaires</strong>
          <p>Indispensables au fonctionnement du site.</p>
        </div>
        <input type="checkbox" class="cc-toggle" checked disabled />
      </div>
      <div class="cc-row">
        <div>
          <strong>Mesure d'audience (Google Analytics)</strong>
          <p>Permet de mesurer la fréquentation du site.</p>
        </div>
        <input type="checkbox" class="cc-toggle" id="cc-analytics-toggle" />
      </div>
      <div class="cc-actions">
        <button class="cc-btn primary" data-action="save-custom">Enregistrer mes choix</button>
        <button class="cc-btn" data-action="close-custom">Annuler</button>
      </div>
    `;

    const manageBtn = document.createElement('button');
    manageBtn.className = 'cc-manage';
    manageBtn.type = 'button';
    manageBtn.textContent = 'Gérer mes cookies';

    document.body.appendChild(banner);
    document.body.appendChild(panel);
    document.body.appendChild(manageBtn);

    const analyticsToggle = panel.querySelector('#cc-analytics-toggle');

    function closeBanner() {
      banner.style.display = 'none';
      panel.style.display = 'none';
      manageBtn.style.display = 'block';
    }

    function openCustomization() {
      banner.style.display = 'none';
      panel.style.display = 'block';
    }

    function openBanner() {
      banner.style.display = 'block';
      panel.style.display = 'none';
      manageBtn.style.display = 'none';
    }

    banner.addEventListener('click', function (event) {
      const action = event.target && event.target.getAttribute('data-action');
      if (!action) return;
      if (action === 'accept-all') {
        const consent = writeConsent({ analytics: true });
        if (shouldLoadAnalytics(consent)) loadGoogleAnalytics();
        closeBanner();
      } else if (action === 'reject-all') {
        writeConsent({ analytics: false });
        closeBanner();
      } else if (action === 'customize') {
        openCustomization();
      }
    });

    panel.addEventListener('click', function (event) {
      const action = event.target && event.target.getAttribute('data-action');
      if (!action) return;
      if (action === 'save-custom') {
        const consent = writeConsent({ analytics: !!analyticsToggle.checked });
        if (shouldLoadAnalytics(consent)) loadGoogleAnalytics();
        closeBanner();
      } else if (action === 'close-custom') {
        openBanner();
      }
    });

    manageBtn.addEventListener('click', function () {
      const existing = readConsent() || defaultConsent;
      analyticsToggle.checked = !!existing.analytics;
      openCustomization();
    });

    return { analyticsToggle, openBanner, closeBanner };
  }

  function init() {
    const existingConsent = readConsent();
    if (existingConsent && shouldLoadAnalytics(existingConsent)) {
      loadGoogleAnalytics();
    }

    const ui = buildUi();
    if (existingConsent) {
      ui.closeBanner();
      ui.analyticsToggle.checked = !!existingConsent.analytics;
    } else {
      ui.openBanner();
      ui.analyticsToggle.checked = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
