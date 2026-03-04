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
- `prenom`
- `nom`
- `telephone`
- `nocompt`
- `profil_club`
- `created_at`
- `compte_personnel`
- `docs_club`
- `docs_eleves`
- `voyage`
- `sortie_club`
- `active`
- `compte_secret` (colonne Q, `OUI` pour un compte pré-configuré sur place)

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
const PERMISSION_FIELDS = ['compte_personnel', 'docs_club', 'docs_eleves', 'voyage', 'sortie_club'];

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = String((params.action || 'health')).toLowerCase();
  if (action === 'me') return handleMe({ parameter: params });
  if (action === 'health') return json({ ok: true, status: 'up' });
  return json({ ok: false, error: 'invalid_action' });
}

function doPost(e) {
  const payload = parseJsonBody(e || {});
  const action = String(payload.action || '').toLowerCase();
  if (action === 'signup') return handleSignup(payload);
  if (action === 'login') return handleLogin(payload);
  if (action === 'logout') return handleLogout(payload);
  return json({ ok: false, error: 'invalid_action' });
}


function handleSignup(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const prenom = String(payload.prenom || '').trim();
  const nom = String(payload.nom || '').trim();
  const telephone = String(payload.telephone || '').trim();
  const askedNocompt = String(payload.nocompt || '').trim();
  const profilClub = String(payload.profil_club || '').trim();

  if (!email || !password || !prenom || !nom || !telephone || !profilClub) {
    return json({ ok: false, error: 'missing_signup_fields' });
  }
  if (password.length < 10) {
    return json({ ok: false, error: 'weak_password' });
  }
  if (getUserByEmail(email)) {
    return json({ ok: false, error: 'email_exists' });
  }

  const existingByNocompt = askedNocompt ? getUserByNocompt(askedNocompt) : null;

  if (existingByNocompt) {
    if (String(existingByNocompt.compte_secret || '').toUpperCase() === 'OUI') {
      const salt = Utilities.getUuid();
      const passwordHash = hashPassword(password, salt);
      upgradeSecretAccount(existingByNocompt._row, {
        email,
        passwordHash,
        salt,
      });
      writeAudit('signup_claimed_secret_account', email, `nocompt:${askedNocompt}`);
      return json({ ok: true, message: 'signup_recorded', nocompt: askedNocompt });
    }
    return json({ ok: false, error: 'nocompt_unavailable' });
  }

  const generatedNocompt = nextNocompt();
  const nocompt = askedNocompt || generatedNocompt;
  const salt = Utilities.getUuid();
  const passwordHash = hashPassword(password, salt);

  createUser({
    email,
    passwordHash,
    salt,
    prenom,
    nom,
    telephone,
    nocompt,
    profilClub,
  });

  writeAudit('signup_created', email, `pending_activation|nocompt:${nocompt}`);
  return json({ ok: true, message: 'signup_recorded', nocompt });
}

function createUser(input) {
  const sh = getSheet('users');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const rowByHeader = {
    email: input.email,
    password_hash: input.passwordHash,
    salt: input.salt,
    role: 'member',
    prenom: input.prenom,
    nom: input.nom,
    telephone: input.telephone,
    nocompt: input.nocompt,
    profil_club: input.profilClub,
    created_at: new Date().toISOString(),
    compte_personnel: 'NON',
    docs_club: 'NON',
    docs_eleves: 'NON',
    voyage: 'NON',
    sortie_club: 'NON',
    active: 'NON',
    compte_secret: 'NON',
  };

  const row = headers.map((h) => rowByHeader[h] ?? '');
  sh.appendRow(row);
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

  const permissions = PERMISSION_FIELDS
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


function getUserByNocompt(nocompt) {
  const sh = getSheet('users');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return null;

  const headers = rows[0].map(String);
  const idxNocompt = headers.indexOf('nocompt');
  if (idxNocompt === -1) return null;

  for (let i = 1; i < rows.length; i += 1) {
    const candidate = String(rows[i][idxNocompt] || '').trim();
    if (candidate === nocompt) {
      const user = { _row: i + 1 };
      headers.forEach((h, j) => user[h] = rows[i][j]);
      return user;
    }
  }
  return null;
}

function upgradeSecretAccount(rowNumber, input) {
  const sh = getSheet('users');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const index = (key) => headers.indexOf(key) + 1;

  sh.getRange(rowNumber, index('email')).setValue(input.email);
  sh.getRange(rowNumber, index('password_hash')).setValue(input.passwordHash);
  sh.getRange(rowNumber, index('salt')).setValue(input.salt);
  sh.getRange(rowNumber, index('compte_secret')).setValue('NON');
}

function nextNocompt() {
  const sh = getSheet('users');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return '001';

  const headers = rows[0].map(String);
  const idxNocompt = headers.indexOf('nocompt');
  if (idxNocompt === -1) throw new Error('Missing nocompt column in users sheet');

  let maxValue = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const raw = String(rows[i][idxNocompt] || '').trim();
    if (!raw) continue;

    const digits = raw.match(/\d+/g);
    if (!digits) continue;

    const numeric = Number(digits.join(''));
    if (Number.isFinite(numeric) && numeric > maxValue) {
      maxValue = numeric;
    }
  }

  return String(maxValue + 1).padStart(3, '0');
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

## 3) Inscription interne (formulaire site → Sheet)
Le formulaire du site envoie `action: "signup"` vers la Web App Apps Script.

Champs minimum recommandés côté formulaire :
- `prenom`
- `nom`
- `email`
- `telephone`
- `password`
- `nocompt` (optionnel)
- `profil_club` (obligatoire, ex: `eleve_pilote`, `pilote_brevete`)

À l'inscription, le script :
1. Vérifie les champs requis et l'unicité email.
2. Si l'utilisateur saisit un `nocompt` qui existe et que la ligne a `compte_secret = OUI`, il récupère cette ligne (même nocompt, même droits déjà préparés).
3. Si le `nocompt` saisi existe déjà mais n'est pas un compte secret, l'inscription est refusée (`nocompt_unavailable`).
4. Si aucun `nocompt` n'est saisi, le script génère automatiquement le prochain numéro (`001`, `002`, `003`, ...).
5. En création classique, génère `salt` + `password_hash` (SHA-256), crée la ligne `users`, puis journalise l'événement dans `audit`.

Activation ensuite :
- L'admin passe `active` à `OUI` et active les espaces (`OUI`) dans les colonnes permission.
- L'utilisateur peut alors se connecter et voir uniquement ses modules autorisés.

## 4) Déploiement
- Déployer en **Web App**.
- Exécuter en tant que : vous.
- Accès : **toute personne ayant le lien** (l'auth est gérée par le script).
- Ajouter une propriété de script `APP_SECRET` (long secret aléatoire).


### Important : pourquoi l'erreur `Cannot read properties of undefined (reading 'parameter')` ?
- Si vous cliquez sur **Run** dans l'éditeur Apps Script pour lancer `doGet`, l'objet événement `e` n'est **pas** fourni automatiquement.
- Résultat : `e.parameter` peut être `undefined`.
- Le script ci-dessus est maintenant tolérant à ce cas, mais le **vrai test** doit se faire via l'URL Web App, par exemple :
  - `.../exec?action=health`
  - `.../exec?action=me&token=...`
- Pour les actions POST (`signup`, `login`, `logout`), testez via le site ou via `curl`/Postman, pas avec le bouton **Run**.

## 5) Branchement front
- `inscription-membres.html` : renseigner `data-access-api="URL_WEB_APP"` pour créer les comptes en attente.
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
