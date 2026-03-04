# Espace Membres APAM (version compatible avec le classeur existant)

Cette version **réutilise le Google Sheet déjà en place** avec les 3 onglets :

- `users`
- `sessions`
- `audit`

Aucun nouvel onglet `Membres` n'est requis.

## 1) Structure attendue

### Onglet `users` (colonnes A → P)

A `email`  
B `password_hash`  
C `salt`  
D `role`  
E `prenom`  
F `nom`  
G `telephone`  
H `nocompt` (**numéro membre**)  
I `profil_social` (ou profil social)  
J `created_at`  
K `compte_personnel`  
L `doc_club`  
M `doc_eleve`  
N `voyage`  
O `sortie_club`  
P `active`

### Onglet `sessions`

- `token`
- `email`
- `expires_at`
- `created_at`
- `revoked`

### Onglet `audit`

- `created_at`
- `event`
- `email`
- `details`

## 2) Mapping métier avec votre sheet existant

- **MemberID** est stocké dans `users.nocompt` (colonne H).
- Le format canonique est `000001` (6 digits), avec support d'entrée `APAM-000120`.
- **AccessEnabled** est mappé sur `users.active` :
  - `OUI` => accès actif
  - `NON` => en attente
  - `SUSPENDED` => suspendu
- Le rôle reste `users.role`.

## 3) Règles d'inscription implémentées

### `action=register`

Entrée : `firstName`, `lastName`, `email`, `phone?`, `memberId?`

- Si `memberId` est fourni :
  - recherche la ligne `users` par `nocompt`
  - si introuvable => `NUMERO_INTROUVABLE`
  - si `email` déjà présent et différent => `NUMERO_DEJA_ASSOCIE`
  - sinon associe l'email + identité à cette ligne
- Si `memberId` absent :
  - si email existant => `EMAIL_DEJA_EXISTANT`
  - crée une nouvelle ligne avec `nocompt` auto-incrémenté
- Concurrence protégée par `LockService`.

## 4) Authentification

- Mot de passe en clair : **jamais stocké**.
- Connexion par **magic link**.
- Token signé HMAC SHA-256, expiration 15 min.
- Le hash SHA-256 du token est stocké en `sessions`.
- `consume_magic_link` crée un token de session signé (également vérifié/revalidé sur `sessions`).

## 5) Actions API (`doPost`)

- `register`
- `request_magic_link`
- `consume_magic_link`
- `me`
- `admin_set_access`

## 6) Déploiement rapide

1. Ouvrir le Google Sheet existant.
2. Extensions → Apps Script.
3. Coller `Code.gs`.
4. Ajouter Script Property :
   - `APP_BASE_URL=https://aeroclubapam.fr/connexion-membres.html`
5. Déployer en Web App (Execute as: Me, Access: Anyone).
6. Dans le sheet, menu **Espace Membres** > **Vérifier structure users/sessions/audit**.


## 7) Compatibilité front existant

- `action=me` fonctionne en **GET** (`?action=me&token=...`) et en POST JSON.
- La réponse `me` expose aussi `permissions` (ex: `docs_club`, `docs_eleves`) pour piloter l'affichage des blocs dans `mon-compte.html`.
