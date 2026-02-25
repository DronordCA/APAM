# Architecture Google Sheet + Apps Script — Boutique APAM

Ce dossier fournit une base **prête à importer** pour automatiser les demandes boutique :
- stockage des produits,
- journal des commandes,
- templates d'emails,
- paramètres globaux,
- script Apps Script prêt à coller.

## 1) Créer le Google Sheet
1. Crée un Google Sheet vide nommé par exemple `APAM_Boutique`.
2. Crée 4 onglets avec ces noms exacts :
   - `products`
   - `orders`
   - `email_templates`
   - `settings`

## 2) Importer les CSV
Pour chaque onglet :
1. Ouvre l'onglet cible.
2. Menu **Fichier > Importer > Importer**.
3. Choisis le CSV correspondant dans ce dossier.
4. Option d'import : **Remplacer les données de l'onglet actif**.

Fichiers à importer :
- `products.csv` dans `products`
- `orders.csv` dans `orders`
- `email_templates.csv` dans `email_templates`
- `settings.csv` dans `settings`

## 3) Utiliser un formulaire interne au site (sans Google Form)
Oui, c'est possible et même recommandé si tu veux garder toute l'expérience sur la page boutique.

### Option A (déjà prête dans `boutique.html`)
- Clic sur un produit (`Carte cadeau`, `Baptême`, etc.)
- Le formulaire interne s'ouvre automatiquement
- Le produit est pré-sélectionné

### Option B (page dédiée par produit)
- Tu peux aussi créer une page par produit (ex: `bapteme.html`) avec le même formulaire.

Dans les 2 cas, le formulaire peut envoyer les données vers Apps Script (Web App) **sans passer par Google Form**.

### Payload JSON attendu par `doPost` (action `create_order`)
```json
{
  "action": "create_order",
  "product_key": "bapteme-air",
  "quantity": 1,
  "payment_mode": "virement",
  "first_name": "Jean",
  "last_name": "Dupont",
  "email": "jean@example.com",
  "phone": "+33600000000",
  "address": "1 rue Exemple, Paris",
  "notes": "Disponible samedi",
  "source": "WEB_INTERNAL_FORM"
}
```

## 4) Installer le script Apps Script
1. Ouvre le Sheet > **Extensions > Apps Script**.
2. Copie-colle le contenu de `apps-script-boutique.gs`.
3. Sauvegarde.
4. Exécute la fonction `bootstrapSetup` une fois (autoriser les permissions).

## 5) Définir les triggers
Dans Apps Script > **Déclencheurs** :
- Si tu utilises un Google Form : `processLatestOrder` sur **À la soumission d'un formulaire**.
- Si tu utilises un formulaire interne site : pas de trigger obligatoire pour la création, utilise l'endpoint Web App (`doPost`) du script.
- (optionnel) `sendReminderDrafts` en déclencheur horaire.

## 6) Ce que fait l'automatisation
- Génère un `order_id` unique.
- Récupère le produit depuis `products`.
- Calcule le total estimé.
- Envoie un email client selon `payment_mode` via template.
- Envoie une notification interne APAM.
- Met à jour le statut de la commande dans `orders`.

## 7) Paramètres à personnaliser en priorité
Dans l'onglet `settings` :
- `club_name`
- `support_email`
- `internal_notification_email`
- `bank_details`
- `pickup_location`
- `pickup_hours`
- `delivery_delay_cb`
- `delivery_delay_virement`

## 8) Notes
- Le script envoie les emails via le compte Google qui exécute Apps Script.
- Utiliser de préférence une boîte dédiée (`boutique@...`) pour la lisibilité.
- Tu peux ajouter des colonnes dans `orders` tant que tu gardes les en-têtes existants.
