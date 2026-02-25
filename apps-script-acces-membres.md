# Apps Script — gestion des accès membres (gratuit)

Ce document décrit une implémentation gratuite pour piloter les accès par rôle depuis Google Sheet.

## 1) Structure de la feuille `membres`
Colonnes recommandées (ligne 1 = en-têtes) :

- `email`
- `role`
- `compte_personnel`
- `docs_administratifs`
- `docs_club`
- `cours`
- `meteo`
- `docs_avion`

Valeurs permissions : `OUI` / `NON`.

## 2) Script Apps Script (Web App)
Créer un projet Apps Script lié au fichier Google Sheet, puis coller :

```javascript
function doGet(e) {
  const email = (e.parameter.email || '').trim().toLowerCase();
  if (!email) return json({ ok: false, error: 'missing_email' });

  const sh = SpreadsheetApp.getActive().getSheetByName('membres');
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const emailIdx = headers.indexOf('email');

  if (emailIdx < 0) return json({ ok: false, error: 'missing_email_column' });

  const row = values.slice(1).find((r) => String(r[emailIdx]).trim().toLowerCase() === email);
  if (!row) return json({ ok: true, email, role: null, permissions: [] });

  const role = String(row[headers.indexOf('role')] || '').trim();
  const permissions = headers
    .filter((h) => h !== 'email' && h !== 'role')
    .filter((h) => String(row[headers.indexOf(h)]).trim().toUpperCase() === 'OUI');

  return json({ ok: true, email, role, permissions });
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Déployer en **Web App** :
- Exécuter en tant que : vous
- Accès : selon besoin (interne domaine ou public avec email en paramètre)

## 3) Branchement côté `mon-compte.html`
Dans `.wrap`, renseigner :

- `data-access-api="URL_WEB_APP"`
- `data-user-email="email@pilote.fr"` (optionnel, sinon prompt)

Le site masque/affiche les cartes selon la réponse `permissions`.

## 4) Sécurité
- Ne pas laisser les dossiers Drive sensibles en lien public.
- Les permissions front améliorent l’UX, mais la vraie sécurité reste côté Drive/back-end.
