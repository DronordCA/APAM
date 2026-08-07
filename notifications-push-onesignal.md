# Notifications push — « Prévenir les membres » à la publication

L'app appelle déjà le backend avec `action=notify` quand le bureau publie une
actu/événement en cochant **🔔 Prévenir les membres**. Il reste à ajouter le
code côté **Apps Script** qui envoie réellement le push via OneSignal.

La **clé REST OneSignal est secrète** : elle ne doit **jamais** être dans l'app
(HTML public). Elle vit dans les **Propriétés du script** Apps Script.

---

## 1. Récupérer la clé REST OneSignal

OneSignal → **Settings → Keys & IDs** → copier la **REST API Key**
(l'App ID `5a4aa5e3-8135-480d-bd0e-d1547b3ad053` est déjà dans l'app, c'est public).

## 2. Stocker la clé dans Apps Script

Apps Script → ⚙️ **Paramètres du projet → Propriétés du script → Ajouter** :

| Propriété | Valeur |
|---|---|
| `ONESIGNAL_REST_KEY` | *(coller la REST API Key)* |

## 3. Ajouter ce code au script

```javascript
var ONESIGNAL_APP_ID = '5a4aa5e3-8135-480d-bd0e-d1547b3ad053';

function sendPush(titre, texte) {
  var restKey = PropertiesService.getScriptProperties().getProperty('ONESIGNAL_REST_KEY');
  if (!restKey) return { error: 'ONESIGNAL_REST_KEY manquante' };
  var payload = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ['Subscribed Users'], // tous les abonnés — voir note segment ci-dessous
    headings: { en: 'APAM · ' + (titre || 'Nouvelle actualité') },
    contents: { en: (texte || 'Une nouvelle publication est disponible.') },
    url: 'https://aeroclubapam.fr/mon-compte.html'
  };
  var res = UrlFetchApp.fetch('https://onesignal.com/api/v1/notifications', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Basic ' + restKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText());
}
```

## 4. Câbler l'action `notify` dans le routeur

Dans le `doGet(e)` (là où tu gères déjà `addNews`, `addNewsMembre`, etc.), ajoute :

```javascript
if (action === 'notify') {
  var r = sendPush(e.parameter.titre, e.parameter.texte);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, onesignal: r }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

*(Sécurité optionnelle mais recommandée : vérifier que `e.parameter.pin`
correspond à un membre ayant le droit de publier avant d'envoyer.)*

## 5. Redéployer le web app

Apps Script → **Déployer → Gérer les déploiements → Modifier → Nouvelle version**.

---

## ⚠️ Nom du segment

`included_segments: ['Subscribed Users']` = tous les abonnés. Selon l'âge de ton
compte OneSignal, le segment « tout le monde » s'appelle **Subscribed Users**
(ancien) ou **Total Subscriptions** (récent). Vérifie dans
**OneSignal → Audience → Segments** et ajuste la chaîne si besoin.

## Tester

Publie une actu depuis l'app avec la case cochée → tu dois recevoir le push
sur un appareil qui a activé les notifications. En cas d'échec, regarde la
réponse `onesignal` (champ `errors`) dans les logs Apps Script.

## Suite (phase 2)

- **Préférences par catégorie** (Actus / Événements / Météo / Maintenance) via
  tags OneSignal + `filters` dans le payload au lieu de `included_segments`.
- **Alertes météo/NOTAM automatiques** : job cron sur la VM Oracle qui vérifie
  le METAR/NOTAM de LFOL et appelle `sendPush(...)`.
