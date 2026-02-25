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

## 7) Paiements (Apple Pay / cartes cadeaux / boutique)

### Apple Pay "directement sur le site" : ce que ça change vraiment
- Apple Pay améliore l'expérience de paiement et la tokenisation côté wallet, **mais ne remplace pas** la sécurité e-commerce globale.
- En pratique, votre site ne doit jamais traiter ni stocker des numéros de carte : il doit déléguer le paiement à un prestataire (Stripe Checkout/Payment Links, etc.).
- Donc oui, une partie critique est gérée par Apple + le prestataire de paiement, mais vous restez responsable de la sécurité de votre site (liens, webhooks, accès admin, anti-fraude de base).

### Recommandation pour APAM (sans backend lourd)
- Conserver le site statique.
- Créer des pages produits (vol découverte, baptême, carte cadeau, casquette).
- Rediriger les boutons "Payer" vers des pages de paiement hébergées (Apple Pay activé côté prestataire).
- Ne construire un backend personnalisé que si vous avez des besoins avancés (panier complexe, stock en temps réel, remboursements automatisés, etc.).


## 8) Coûts : peut-on vendre sans frais ?

Réponse courte :
- Pour un paiement carte en ligne "propre" (checkout), il y a **presque toujours** des frais de transaction.
- Si l'objectif est **zéro frais paiement**, il faut sortir du paiement carte en ligne classique (virement, chèque, espèces, terminal sur place).

### Option la plus propre sans backend lourd
- Garder un bouton "Acheter" sur le site.
- Collecter la demande (formulaire ou email) puis envoyer un lien/référence de paiement (virement, paiement sur place, etc.).
- Cette approche évite la complexité technique tout en restant claire pour l'utilisateur.

### Arbitrage recommandé pour APAM
- Si priorité = simplicité client : checkout hébergé (frais par transaction acceptés).
- Si priorité = minimiser les frais : précommande + virement/confirmation manuelle.
- Si priorité = zéro frais en ligne : pas de carte en ligne, uniquement moyens hors passerelle carte.

## 9) Workflow recommandé : formulaire + email automatique selon le mode de paiement

Oui, c'est possible avec votre architecture actuelle, sans backend e-commerce lourd.

### Parcours proposé
1. L'utilisateur remplit un formulaire (produit, identité, email, mode de paiement, créneau souhaité).
2. Un envoi automatique d'email est déclenché selon le mode choisi :
   - **Carte bancaire** : email client = paiement sur place (adresse, horaires, délai de remise).
   - **Virement** : email client = RIB du club + référence de commande + délai estimé (ex: 3 à 5 jours après réception).
3. En parallèle, un email interne APAM est envoyé avec le détail de la demande.
4. Après vérification du virement reçu, APAM envoie manuellement la carte cadeau / confirmation du vol.

### Mise en oeuvre simple (sans backend)
- Utiliser Google Forms + Google Sheets + Apps Script (déjà dans votre pile).
- Définir des templates d'email différents selon `mode_paiement`.
- Ajouter un identifiant de commande dans la Sheet pour faciliter le suivi.
- Conserver une validation manuelle finale avant envoi du produit (recommandé).

### Points importants
- Cette approche est propre, compréhensible pour le client, et limite les coûts.
- Elle ne supprime pas le travail de suivi interne (vérifier les virements, déclencher l'envoi).
- Pour les produits 100% numériques (carte cadeau PDF), prévoir un modèle d'email de livraison après validation du paiement.


### Envoi automatique des emails : faut-il une boîte dédiée ?
- Avec Apps Script, les emails automatiques sont envoyés par le compte Google qui exécute le script (`GmailApp`/`MailApp`).
- Donc une boîte dédiée n'est pas obligatoire techniquement, mais elle est recommandée pour la lisibilité (ex: `boutique@apam.fr` ou alias).
- Il faut configurer clairement : adresse expéditrice, destinataire interne APAM, et templates selon `mode_paiement`.
- En cas de volume plus élevé, prévoir des quotas Google Workspace et un suivi des réponses automatiques.

### Envoi réel d'emails automatiques (client + club)
Pour que l'email parte **sans action manuelle**, il faut brancher le formulaire à Apps Script (trigger `onFormSubmit`) :
- Email client : message différent selon `mode_paiement` (`cb` ou `virement`).
- Email club : copie de la commande pour traitement interne.

Exemple minimal :
```javascript
function onFormSubmit(e) {
  const data = e.namedValues;
  const email = String(data.Email?.[0] || '').trim();
  const mode = String(data.mode_paiement?.[0] || '').toLowerCase();

  const messageClient = mode === 'virement'
    ? 'Merci pour votre commande. Voici le RIB APAM... Livraison 2 à 3 jours ouvrés après réception du virement.'
    : 'Merci pour votre commande. Paiement carte au club, remise du produit sur place.';

  MailApp.sendEmail(email, 'Confirmation commande APAM', messageClient);
  MailApp.sendEmail('contact@apam.fr', 'Nouvelle commande boutique', JSON.stringify(data, null, 2));
}
```
