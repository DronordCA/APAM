(function(){
  const lock = window.APAM_PRELAUNCH_LOCK || {};
  if (!lock.enabled) return;

  const CACHE_KEY = 'apam_prelaunch_grant_v1';
  const ttlHours = Number(lock.accessTtlHours || 48);
  const ttlMs = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;

  const apiUrl = String(window.APAM_ACCESS_API_URL || '').trim();
  const token = String(window.localStorage.getItem('apam_session_token') || '').trim();
  const allowedEmails = new Set((lock.allowedEmails || []).map((email) => String(email || '').trim().toLowerCase()).filter(Boolean));
  const allowedPermissions = new Set((lock.allowedPermissions || []).map((permission) => String(permission || '').trim().toLowerCase()).filter(Boolean));

  const now = () => Date.now();

  const blockMarkup = `
    <main style="min-height:100svh;display:grid;place-items:center;background:#10131d;color:#fff;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
      <section style="max-width:700px;width:100%;border:1px solid rgba(255,255,255,.18);background:rgba(14,18,30,.92);padding:28px;box-shadow:0 18px 40px rgba(0,0,0,.45)">
        <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9ebdff;margin:0 0 10px">Aperçu privé</p>
        <h1 style="margin:0 0 12px;font-size:34px;line-height:1.05;text-transform:uppercase">Site en préparation</h1>
        <p style="margin:0 0 14px;line-height:1.55;color:rgba(255,255,255,.82)">Le site n'est pas encore ouvert au public avant l'annonce officielle.</p>
        <p style="margin:0 0 18px;line-height:1.55;color:rgba(255,255,255,.82)">Les membres autorisés (équipe / propriétaires) peuvent continuer à le consulter via leur connexion membre.</p>
        <a href="connexion-membres-password.html?next=index.html" style="display:inline-block;padding:10px 14px;border:1px solid rgba(123,166,255,.75);color:#fff;text-decoration:none;background:linear-gradient(135deg,#2f6bff,#1b3f86);text-transform:uppercase;letter-spacing:.07em;font-size:12px;">Connexion membres</a>
      </section>
    </main>`;

  const renderBlocked = () => {
    const doRender = () => {
      if (!document.body) return;
      document.body.innerHTML = blockMarkup;
    };

    if (document.body) {
      doRender();
    } else {
      document.addEventListener('DOMContentLoaded', doRender, { once: true });
    }
  };

  const readCache = () => {
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const expiresAt = Number(parsed.expiresAt || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= now()) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCache = (profile) => {
    const email = String(profile?.email || '').trim().toLowerCase();
    const permissions = Array.from(new Set((profile?.permissions || []).map((permission) => String(permission || '').trim().toLowerCase()).filter(Boolean)));
    const payload = { email, permissions, expiresAt: now() + ttlMs };
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const hasAllowedPermission = (permissions) => {
    if (!allowedPermissions.size) return false;
    for (const permission of permissions) {
      if (allowedPermissions.has(permission)) return true;
    }
    return false;
  };

  const isAllowedProfile = (profile) => {
    const email = String(profile?.email || '').trim().toLowerCase();
    const permissions = new Set((profile?.permissions || []).map((permission) => String(permission || '').trim().toLowerCase()));
    return (email && allowedEmails.has(email)) || hasAllowedPermission(permissions);
  };

  const cached = readCache();
  if (cached) {
    const cachedEmail = String(cached.email || '').trim().toLowerCase();
    const cachedPermissions = new Set((cached.permissions || []).map((permission) => String(permission || '').trim().toLowerCase()));
    if ((cachedEmail && allowedEmails.has(cachedEmail)) || hasAllowedPermission(cachedPermissions)) {
      return;
    }
  }

  if (!token || !apiUrl) {
    renderBlocked();
    return;
  }

  fetch(apiUrl, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'me', sessionToken: token })
  })
    .then((res) => {
      if (!res.ok) throw new Error('API indisponible');
      return res.json();
    })
    .then((payload) => {
      const profile = payload.profile || payload;
      if (!payload?.ok || !isAllowedProfile(profile)) {
        renderBlocked();
        return;
      }
      writeCache(profile);
    })
    .catch(() => {
      renderBlocked();
    });
})();
