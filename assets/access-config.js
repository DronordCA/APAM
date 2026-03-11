// Point unique de configuration de la Web App Apps Script (membres).
// Remplacez la valeur ci-dessous par l'URL /exec du déploiement ACTIF.
window.APAM_ACCESS_API_URL = 'https://script.google.com/macros/s/AKfycbxmzpzMhv5wEaSajCkNYu6bpQbqwkb7klq029Yjo_3KNKMmyTtNdSEF_R0vgAUK9_-9/exec';

// Mode pré-lancement (bâche) pour masquer les pages publiques tant que l'annonce officielle n'est pas faite.
// - enabled: active (true) / désactive (false) la bâche.
// - allowedEmails: emails autorisés à voir la page même en mode bâche.
// - allowedPermissions: permissions membres autorisées à contourner la bâche (issues de la feuille membres).
window.APAM_PRELAUNCH_LOCK = {
  enabled: true,
  allowedEmails: [
    // 'votre.email@exemple.com',
    // 'proprietaire1@exemple.com',
  ],
  allowedPermissions: [
    // 'compte_personnel',
  ],
  // Durée de mémorisation locale de l'accès (en heures) pour éviter de redemander l'email trop souvent.
  accessTtlHours: 48,
};
