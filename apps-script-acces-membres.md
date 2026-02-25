# Apps Script — accès membres sécurisés (email + mot de passe)

Ce guide remplace le filtrage simple par email et met en place une authentification avec session signée.

## 1) Structure Google Sheet
Créer un fichier avec 3 onglets.

### `users`
En-têtes (ligne 1) :
- `email`
- `password_hash`
- `salt`
- `role`
- `compte_personnel`
- `docs_administratifs`
- `docs_club`
- `cours`
- `meteo`
- `docs_avion`
- `active`

Permissions : `OUI` / `NON`.

### `sessions`
En-têtes :
- `token`
- `email`
- `expires_at`
- `created_at`
- `revoked`

### `audit`
En-têtes :
- `created_at`
- `event`
- `email`
- `details`

## 2) Script Apps Script (Web App)
Créer un projet lié au Sheet et coller ce script.

```javascript
const SESSION_DURATION_MIN = 60;

function doGet(e) {
  const action = String((e.parameter.action || 'me')).toLowerCase();
  if (action === 'me') return handleMe(e);
  if (action === 'health') return json({ ok: true, status: 'up' });
  return json({ ok: false, error: 'invalid_action' });
}

function doPost(e) {
  const payload = parseJsonBody(e);
  const action = String(payload.action || '').toLowerCase();
  if (action === 'login') return handleLogin(payload);
  if (action === 'logout') return handleLogout(payload);
  return json({ ok: false, error: 'invalid_action' });
}

function handleLogin(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!email || !password) return json({ ok: false, error: 'missing_credentials' });

  const user = getUserByEmail(email);
  if (!user || String(user.active || '').toUpperCase() !== 'OUI') {
    writeAudit('login_failed', email, 'unknown_or_inactive');
    return json({ ok: false, error: 'invalid_credentials' });
  }

  const expected = String(user.password_hash || '');
  const computed = hashPassword(password, String(user.salt || ''));
  if (computed !== expected) {
    writeAudit('login_failed', email, 'password_mismatch');
    return json({ ok: false, error: 'invalid_credentials' });
  }

  const token = signToken(email);
  createSession(token, email);
  writeAudit('login_success', email, 'session_created');
  return json({ ok: true, token, email, role: user.role || '' });
}

function handleMe(e) {
  const token = String(e.parameter.token || '').trim();
  if (!token) return json({ ok: false, error: 'missing_token' });

  const session = getActiveSession(token);
  if (!session) return json({ ok: false, error: 'invalid_or_expired_session' });

  const user = getUserByEmail(session.email);
  if (!user || String(user.active || '').toUpperCase() !== 'OUI') {
    return json({ ok: false, error: 'user_inactive' });
  }

  const permissions = Object.keys(user)
    .filter((k) => !['email', 'password_hash', 'salt', 'role', 'active'].includes(k))
    .filter((k) => String(user[k] || '').toUpperCase() === 'OUI');

  return json({ ok: true, email: user.email, role: user.role || '', permissions });
}

function handleLogout(payload) {
  const token = String(payload.token || '').trim();
  if (!token) return json({ ok: false, error: 'missing_token' });

  const sh = getSheet('sessions');
  const rows = sh.getDataRange().getValues();
  const headers = rows[0].map(String);
  const idxToken = headers.indexOf('token');
  const idxRevoked = headers.indexOf('revoked');

  for (let i = 1; i < rows.length; i += 1) {
    if (String(rows[i][idxToken]) === token) {
      sh.getRange(i + 1, idxRevoked + 1).setValue('OUI');
      return json({ ok: true });
    }
  }
  return json({ ok: true });
}

function getUserByEmail(email) {
  const sh = getSheet('users');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return null;

  const headers = rows[0].map(String);
  const idxEmail = headers.indexOf('email');
  for (let i = 1; i < rows.length; i += 1) {
    const candidate = String(rows[i][idxEmail] || '').trim().toLowerCase();
    if (candidate === email) {
      const user = {};
      headers.forEach((h, j) => user[h] = rows[i][j]);
      return user;
    }
  }
  return null;
}

function createSession(token, email) {
  const sh = getSheet('sessions');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DURATION_MIN * 60 * 1000);
  sh.appendRow([token, email, expires.toISOString(), now.toISOString(), 'NON']);
}

function getActiveSession(token) {
  const sh = getSheet('sessions');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return null;

  const headers = rows[0].map(String);
  const idx = key => headers.indexOf(key);
  const now = Date.now();

  for (let i = 1; i < rows.length; i += 1) {
    if (String(rows[i][idx('token')]) !== token) continue;

    const revoked = String(rows[i][idx('revoked')] || '').toUpperCase() === 'OUI';
    const expiresAt = Date.parse(String(rows[i][idx('expires_at')] || ''));
    if (revoked || !expiresAt || expiresAt < now) return null;

    return { email: String(rows[i][idx('email')] || '').trim().toLowerCase() };
  }
  return null;
}

function writeAudit(event, email, details) {
  const sh = getSheet('audit');
  sh.appendRow([new Date().toISOString(), event, email, details]);
}

function getSheet(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);
  return sh;
}

function hashPassword(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${salt}:${password}`,
    Utilities.Charset.UTF_8
  );
  return bytesToHex(bytes);
}

function signToken(email) {
  const secret = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
  if (!secret) throw new Error('Missing APP_SECRET in Script Properties');

  const nonce = Utilities.getUuid();
  const issuedAt = new Date().toISOString();
  const raw = `${email}|${issuedAt}|${nonce}`;
  const sigBytes = Utilities.computeHmacSha256Signature(raw, secret);
  return `${Utilities.base64EncodeWebSafe(raw)}.${Utilities.base64EncodeWebSafe(sigBytes)}`;
}

function parseJsonBody(e) {
  try {
    if (!e.postData || !e.postData.contents) return {};
    return JSON.parse(e.postData.contents);
  } catch (_) {
    return {};
  }
}

function bytesToHex(bytes) {
  return bytes.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3) Initialiser un mot de passe utilisateur
Pour chaque utilisateur :
1. Générer un `salt` (UUID).
2. Calculer `password_hash = SHA256(salt:motdepasse)`.
3. Remplir les colonnes `salt` et `password_hash` dans `users`.

Exemple utilitaire (à lancer une fois dans Apps Script) :

```javascript
function generateHashForUser(email, password) {
  const salt = Utilities.getUuid();
  const hash = hashPassword(password, salt);
  Logger.log({ email, salt, hash });
}
```

## 4) Déploiement
- Déployer en **Web App**.
- Exécuter en tant que : vous.
- Accès : **toute personne ayant le lien** (l'auth est gérée par le script).
- Ajouter une propriété de script `APP_SECRET` (long secret aléatoire).

## 5) Branchement front
- `connexion-membres.html` : renseigner `data-access-api="URL_WEB_APP"`.
- `mon-compte.html` : renseigner `data-access-api="URL_WEB_APP"`.
- Le login stocke `apam_session_token` en localStorage puis redirige vers `mon-compte.html`.
- `mon-compte` appelle `?action=me&token=...` pour charger les permissions.

## 6) Bonnes pratiques sécurité
- Ne jamais stocker de mot de passe en clair dans la Sheet.
- Mettre une durée de session courte (ex: 60 min).
- Révoquer les sessions lors de suspicion (onglet `sessions`, colonne `revoked`).
- Garder les dossiers Drive privés et donner les droits uniquement aux membres.
