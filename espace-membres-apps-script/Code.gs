const CONFIG = {
  USERS_SHEET: 'users',
  SESSIONS_SHEET: 'sessions',
  AUDIT_SHEET: 'audit',
  BASE_URL_PROPERTY: 'APP_BASE_URL',
  SECRET_PROPERTY: 'APP_SECRET',
  MAGIC_LINK_TTL_MINUTES: 15,
  SESSION_TTL_MINUTES: 60 * 12,
  MEMBER_ID_DIGITS: 6,
};

const USER_COL = {
  EMAIL: 0,
  PASSWORD_HASH: 1,
  SALT: 2,
  ROLE: 3,
  PRENOM: 4,
  NOM: 5,
  TELEPHONE: 6,
  NOCOMPT: 7,
  PROFIL_SOCIAL: 8,
  CREATED_AT: 9,
  COMPTE_PERSONNEL: 10,
  DOC_CLUB: 11,
  DOC_ELEVE: 12,
  VOYAGE: 13,
  SORTIE_CLUB: 14,
  ACTIVE: 15,
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Espace Membres')
    .addItem('Vérifier structure users/sessions/audit', 'adminEnsureSheets')
    .addItem('Pré-créer membre (nocompt réservé)', 'adminPrecreateMemberPrompt')
    .addToUi();
}

function adminEnsureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = ensureSheet_(ss, CONFIG.USERS_SHEET);
  const sessions = ensureSheet_(ss, CONFIG.SESSIONS_SHEET);
  const audit = ensureSheet_(ss, CONFIG.AUDIT_SHEET);

  ensureUsersHeader_(users);
  ensureSessionsHeader_(sessions);
  ensureAuditHeader_(audit);

  SpreadsheetApp.getUi().alert('Structure users/sessions/audit OK.');
}

function adminPrecreateMemberPrompt() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Pré-création', 'Entrez un numéro membre (APAM-000120 ou 000120)', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const memberId = canonicalizeMemberId(response.getResponseText());
  if (!memberId) {
    ui.alert('Numéro invalide.');
    return;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (findRowByMemberId(memberId)) {
      ui.alert('Numéro déjà réservé.');
      return;
    }

    const users = getUsersSheet_();
    users.appendRow([
      '', '', '', 'member', '', '', '', memberId, '',
      nowISO(), 'NON', 'NON', 'NON', 'NON', 'NON', 'OUI',
    ]);

    writeAudit_('admin_precreate_member', '', 'memberId=' + memberId);
    ui.alert('Ligne pré-créée: ' + memberId);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const payload = parseJson_(e);
    const action = String(payload.action || '').trim().toLowerCase();

    if (action === 'register') return handleRegister_(payload);
    if (action === 'request_magic_link') return handleRequestMagicLink_(payload);
    if (action === 'consume_magic_link') return handleConsumeMagicLink_(payload);
    if (action === 'me') return handleMe_(payload);
    if (action === 'admin_set_access') return handleAdminSetAccess_(payload);

    return jsonResponse_({ ok: false, error: 'ACTION_INVALIDE' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'ERREUR_SERVEUR', message: String(err.message || err) });
  }
}

function handleRegister_(payload) {
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const email = normalizeEmail(payload.email);
  const phone = String(payload.phone || '').trim();
  const memberIdInput = String(payload.memberId || '').trim();

  if (!firstName || !lastName || !email) return jsonResponse_({ ok: false, error: 'CHAMPS_MANQUANTS' });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const users = getUsersSheet_();
    let target = null;

    if (memberIdInput) {
      const memberId = canonicalizeMemberId(memberIdInput);
      target = findRowByMemberId(memberId);
      if (!target) return jsonResponse_({ ok: false, error: 'NUMERO_INTROUVABLE' });

      const existingEmail = normalizeEmail(target.row.email);
      if (existingEmail && existingEmail !== email) {
        return jsonResponse_({ ok: false, error: 'NUMERO_DEJA_ASSOCIE' });
      }

      const values = target.values;
      values[USER_COL.EMAIL] = email;
      values[USER_COL.PRENOM] = firstName;
      values[USER_COL.NOM] = lastName;
      values[USER_COL.TELEPHONE] = phone;
      if (!values[USER_COL.ROLE]) values[USER_COL.ROLE] = 'member';
      if (!values[USER_COL.CREATED_AT]) values[USER_COL.CREATED_AT] = nowISO();

      const activeCell = String(values[USER_COL.ACTIVE] || '').toUpperCase();
      if (!activeCell) values[USER_COL.ACTIVE] = 'NON';

      users.getRange(target.rowNumber, 1, 1, values.length).setValues([values]);
      target.values = values;
      target.row = mapUserRow_(values);

      writeAudit_('register_claim_memberid', email, 'memberId=' + memberId);
    } else {
      if (findRowByEmail(email)) return jsonResponse_({ ok: false, error: 'EMAIL_DEJA_EXISTANT' });

      const newMemberId = generateMemberId();
      const rowValues = [
        email, '', '', 'member', firstName, lastName, phone, newMemberId, '',
        nowISO(), 'NON', 'NON', 'NON', 'NON', 'NON', 'NON',
      ];
      users.appendRow(rowValues);
      target = findRowByEmail(email);
      writeAudit_('register_new_member', email, 'memberId=' + newMemberId);
    }

    sendMagicLink_(target.rowNumber, target.values);
    return jsonResponse_({ ok: true, message: 'REGISTERED_MAGIC_LINK_SENT' });
  } finally {
    lock.releaseLock();
  }
}

function handleRequestMagicLink_(payload) {
  const email = normalizeEmail(payload.email);
  if (!email) return jsonResponse_({ ok: true });

  const user = findRowByEmail(email);
  if (user && String(user.values[USER_COL.ACTIVE] || '').toUpperCase() !== 'SUSPENDED') {
    sendMagicLink_(user.rowNumber, user.values);
  }

  return jsonResponse_({ ok: true });
}

function handleConsumeMagicLink_(payload) {
  const token = String(payload.token || '').trim();
  if (!token) return jsonResponse_({ ok: false, error: 'TOKEN_MANQUANT' });

  const verified = verifyToken(token, 'magic');
  if (!verified.ok) return jsonResponse_({ ok: false, error: 'TOKEN_INVALIDE' });

  const email = normalizeEmail(verified.payload.eml);
  const memberId = canonicalizeMemberId(verified.payload.mid);
  const hash = hashToken(token);
  const magicSession = findSessionByHash_(hash, 'MAGIC');
  if (!magicSession || isSessionExpired_(magicSession) || magicSession.revoked) {
    return jsonResponse_({ ok: false, error: 'TOKEN_EXPIRE' });
  }

  revokeSessionRow_(magicSession.rowNumber);

  const user = findRowByEmail(email) || findRowByMemberId(memberId);
  if (!user) return jsonResponse_({ ok: false, error: 'TOKEN_INVALIDE' });

  const sessionToken = signJWTLikeToken({
    typ: 'session',
    eml: email,
    mid: memberId,
    role: String(user.values[USER_COL.ROLE] || 'member'),
    exp: Math.floor(Date.now() / 1000) + CONFIG.SESSION_TTL_MINUTES * 60,
  });

  createSession_(hashToken(sessionToken), email, CONFIG.SESSION_TTL_MINUTES, 'SESSION');
  writeAudit_('magic_link_consumed', email, 'memberId=' + memberId);

  return jsonResponse_({ ok: true, sessionToken: sessionToken, profile: buildProfile_(user.values) });
}

function handleMe_(payload) {
  const sessionToken = String(payload.sessionToken || payload.token || '').trim();
  const auth = requireSession_(sessionToken);
  if (!auth.ok) return jsonResponse_({ ok: false, error: auth.error });
  return jsonResponse_({ ok: true, profile: buildProfile_(auth.user.values) });
}

function handleAdminSetAccess_(payload) {
  const sessionToken = String(payload.sessionToken || '').trim();
  const auth = requireSession_(sessionToken);
  if (!auth.ok) return jsonResponse_({ ok: false, error: auth.error });

  const role = String(auth.user.values[USER_COL.ROLE] || '').toLowerCase();
  if (role !== 'admin') return jsonResponse_({ ok: false, error: 'FORBIDDEN' });

  const memberId = canonicalizeMemberId(payload.memberId);
  if (!memberId) return jsonResponse_({ ok: false, error: 'MEMBERID_INVALIDE' });

  const target = findRowByMemberId(memberId);
  if (!target) return jsonResponse_({ ok: false, error: 'NUMERO_INTROUVABLE' });

  const values = target.values;
  if (payload.AccessEnabled !== undefined) values[USER_COL.ACTIVE] = toOuiNon_(payload.AccessEnabled);
  if (payload.Status !== undefined) {
    const status = String(payload.Status || '').toUpperCase();
    if (status === 'SUSPENDED') values[USER_COL.ACTIVE] = 'SUSPENDED';
    if (status === 'ACTIVE') values[USER_COL.ACTIVE] = 'OUI';
    if (status === 'PENDING') values[USER_COL.ACTIVE] = 'NON';
  }
  if (payload.Role !== undefined) values[USER_COL.ROLE] = String(payload.Role || 'member').toLowerCase();

  getUsersSheet_().getRange(target.rowNumber, 1, 1, values.length).setValues([values]);
  revokeAllSessionsByEmail_(normalizeEmail(values[USER_COL.EMAIL]));

  writeAudit_('admin_set_access', normalizeEmail(values[USER_COL.EMAIL]), 'memberId=' + memberId);
  return jsonResponse_({ ok: true });
}

function requireSession_(sessionToken) {
  if (!sessionToken) return { ok: false, error: 'TOKEN_MANQUANT' };

  const verified = verifyToken(sessionToken, 'session');
  if (!verified.ok) return { ok: false, error: 'TOKEN_INVALIDE' };

  const session = findSessionByHash_(hashToken(sessionToken), 'SESSION');
  if (!session || session.revoked || isSessionExpired_(session)) {
    return { ok: false, error: 'SESSION_INVALIDE' };
  }

  const email = normalizeEmail(verified.payload.eml);
  const user = findRowByEmail(email);
  if (!user) return { ok: false, error: 'TOKEN_INVALIDE' };

  return { ok: true, user: user };
}

function sendMagicLink_(rowNumber, userValues) {
  const email = normalizeEmail(userValues[USER_COL.EMAIL]);
  if (!email) return;

  const memberId = canonicalizeMemberId(userValues[USER_COL.NOCOMPT]);
  const token = signJWTLikeToken({
    typ: 'magic',
    eml: email,
    mid: memberId,
    exp: Math.floor(Date.now() / 1000) + CONFIG.MAGIC_LINK_TTL_MINUTES * 60,
  });

  createSession_(hashToken(token), email, CONFIG.MAGIC_LINK_TTL_MINUTES, 'MAGIC');

  const baseUrl = PropertiesService.getScriptProperties().getProperty(CONFIG.BASE_URL_PROPERTY);
  if (!baseUrl) throw new Error('APP_BASE_URL manquant dans Script Properties.');

  const link = baseUrl + (baseUrl.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(token);
  const body = [
    'Bonjour,',
    '',
    'Cliquez ici pour vous connecter à l\'Espace Membres :',
    link,
    '',
    'Ce lien expire dans ' + CONFIG.MAGIC_LINK_TTL_MINUTES + ' minutes.',
  ].join('\n');

  MailApp.sendEmail(email, 'Connexion Espace Membres APAM', body);
  writeAudit_('magic_link_sent', email, 'row=' + rowNumber);
}

function createSession_(tokenHash, email, ttlMinutes, type) {
  const sessions = getSessionsSheet_();
  const expires = new Date(Date.now() + ttlMinutes * 60000).toISOString();
  const storedToken = (type || 'SESSION') + ':' + tokenHash;
  sessions.appendRow([storedToken, email, expires, nowISO(), 'NON']);
}

function findSessionByHash_(tokenHash, wantedType) {
  const sessions = getSessionsSheet_();
  const rows = sessions.getDataRange().getValues();
  if (rows.length < 2) return null;

  for (let i = 1; i < rows.length; i += 1) {
    const storedToken = String(rows[i][0] || '');
    const email = normalizeEmail(rows[i][1]);
    const expiresAt = String(rows[i][2] || '');
    const createdAt = String(rows[i][3] || '');
    const revoked = String(rows[i][4] || '').toUpperCase() === 'OUI';

    const sep = storedToken.indexOf(':');
    const type = sep > 0 ? storedToken.substring(0, sep).toUpperCase() : 'SESSION';
    const token = sep > 0 ? storedToken.substring(sep + 1) : storedToken;

    if (token === tokenHash && (!wantedType || type === wantedType)) {
      return {
        rowNumber: i + 1,
        token: token,
        email: email,
        expiresAt: expiresAt,
        createdAt: createdAt,
        revoked: revoked,
        type: type,
      };
    }
  }
  return null;
}

function revokeSessionRow_(rowNumber) {
  getSessionsSheet_().getRange(rowNumber, 5).setValue('OUI');
}

function revokeAllSessionsByEmail_(email) {
  if (!email) return;
  const sessions = getSessionsSheet_();
  const rows = sessions.getDataRange().getValues();
  for (let i = 1; i < rows.length; i += 1) {
    if (normalizeEmail(rows[i][1]) === email) {
      sessions.getRange(i + 1, 5).setValue('OUI');
    }
  }
}

function isSessionExpired_(session) {
  const dt = new Date(session.expiresAt);
  return Number.isNaN(dt.getTime()) || dt.getTime() < Date.now();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function nowISO() {
  return new Date().toISOString();
}

function hashToken(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  return bytesToHex_(bytes);
}

function signJWTLikeToken(payloadObj) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode_(JSON.stringify(header));
  const encodedPayload = base64UrlEncode_(JSON.stringify(payloadObj));
  const signingInput = encodedHeader + '.' + encodedPayload;
  const signature = Utilities.computeHmacSha256Signature(signingInput, getSecret_(), Utilities.Charset.UTF_8);
  return signingInput + '.' + base64UrlEncodeBytes_(signature);
}

function verifyToken(token, expectedType) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return { ok: false };

    const signingInput = parts[0] + '.' + parts[1];
    const expectedSig = base64UrlEncodeBytes_(Utilities.computeHmacSha256Signature(signingInput, getSecret_(), Utilities.Charset.UTF_8));
    if (!constantTimeEquals_(expectedSig, parts[2])) return { ok: false };

    const payload = JSON.parse(base64UrlDecodeToString_(parts[1]));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || Number(payload.exp) < nowSec) return { ok: false };
    if (expectedType && payload.typ !== expectedType) return { ok: false };

    return { ok: true, payload: payload };
  } catch (err) {
    return { ok: false };
  }
}

function generateMemberId() {
  const users = getUsersSheet_();
  const rows = users.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const n = parseMemberIdInt_(rows[i][USER_COL.NOCOMPT]);
    if (n > max) max = n;
  }
  return leftPad_(max + 1, CONFIG.MEMBER_ID_DIGITS);
}

function findRowByMemberId(memberId) {
  const target = canonicalizeMemberId(memberId);
  if (!target) return null;

  const users = getUsersSheet_();
  const rows = users.getDataRange().getValues();
  for (let i = 1; i < rows.length; i += 1) {
    const current = canonicalizeMemberId(rows[i][USER_COL.NOCOMPT]);
    if (current === target) {
      return { rowNumber: i + 1, values: rows[i], row: mapUserRow_(rows[i]) };
    }
  }
  return null;
}

function findRowByEmail(email) {
  const target = normalizeEmail(email);
  if (!target) return null;

  const users = getUsersSheet_();
  const rows = users.getDataRange().getValues();
  for (let i = 1; i < rows.length; i += 1) {
    const current = normalizeEmail(rows[i][USER_COL.EMAIL]);
    if (current === target) {
      return { rowNumber: i + 1, values: rows[i], row: mapUserRow_(rows[i]) };
    }
  }
  return null;
}

function mapUserRow_(values) {
  return {
    email: values[USER_COL.EMAIL],
    role: values[USER_COL.ROLE],
    prenom: values[USER_COL.PRENOM],
    nom: values[USER_COL.NOM],
    telephone: values[USER_COL.TELEPHONE],
    nocompt: values[USER_COL.NOCOMPT],
    active: values[USER_COL.ACTIVE],
  };
}

function buildProfile_(values) {
  const permissions = [];
  if (String(values[USER_COL.COMPTE_PERSONNEL] || '').toUpperCase() === 'OUI') permissions.push('compte_personnel');
  if (String(values[USER_COL.DOC_CLUB] || '').toUpperCase() === 'OUI') permissions.push('docs_club', 'doc_club');
  if (String(values[USER_COL.DOC_ELEVE] || '').toUpperCase() === 'OUI') permissions.push('docs_eleves', 'doc_eleve');
  if (String(values[USER_COL.VOYAGE] || '').toUpperCase() === 'OUI') permissions.push('voyage');
  if (String(values[USER_COL.SORTIE_CLUB] || '').toUpperCase() === 'OUI') permissions.push('sortie_club');

  return {
    MemberID: canonicalizeMemberId(values[USER_COL.NOCOMPT]),
    Status: mapStatus_(values[USER_COL.ACTIVE]),
    Role: String(values[USER_COL.ROLE] || 'member'),
    AccessEnabled: String(values[USER_COL.ACTIVE] || '').toUpperCase() === 'OUI',
    firstName: String(values[USER_COL.PRENOM] || ''),
    lastName: String(values[USER_COL.NOM] || ''),
    email: normalizeEmail(values[USER_COL.EMAIL]),
    permissions: permissions,
  };
}

function mapStatus_(activeCell) {
  const v = String(activeCell || '').toUpperCase();
  if (v === 'SUSPENDED') return 'SUSPENDED';
  if (v === 'OUI') return 'ACTIVE';
  return 'PENDING';
}

function canonicalizeMemberId(value) {
  const num = parseMemberIdInt_(value);
  if (!num) return '';
  return leftPad_(num, CONFIG.MEMBER_ID_DIGITS);
}

function parseMemberIdInt_(value) {
  const digits = String(value || '').toUpperCase().replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits.slice(-CONFIG.MEMBER_ID_DIGITS), 10);
}

function toOuiNon_(value) {
  if (value === true) return 'OUI';
  if (value === false) return 'NON';
  const str = String(value || '').toUpperCase();
  if (str === 'TRUE' || str === '1' || str === 'OUI') return 'OUI';
  return 'NON';
}

function parseJson_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getUsersSheet_() {
  return ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), CONFIG.USERS_SHEET);
}

function getSessionsSheet_() {
  return ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), CONFIG.SESSIONS_SHEET);
}

function getAuditSheet_() {
  return ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), CONFIG.AUDIT_SHEET);
}

function ensureSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureUsersHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.getRange(1, 1, 1, 16).setValues([[
    'email', 'password_hash', 'salt', 'role', 'prenom', 'nom', 'telephone', 'nocompt',
    'profil_social', 'created_at', 'compte_personnel', 'doc_club', 'doc_eleve', 'voyage',
    'sortie_club', 'active',
  ]]);
}

function ensureSessionsHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.getRange(1, 1, 1, 5).setValues([['token', 'email', 'expires_at', 'created_at', 'revoked']]);
}

function ensureAuditHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.getRange(1, 1, 1, 4).setValues([['created_at', 'event', 'email', 'details']]);
}

function writeAudit_(event, email, details) {
  const audit = getAuditSheet_();
  if (audit.getLastRow() === 0) ensureAuditHeader_(audit);
  audit.appendRow([nowISO(), event, normalizeEmail(email), String(details || '')]);
}

function getSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(CONFIG.SECRET_PROPERTY);
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty(CONFIG.SECRET_PROPERTY, secret);
  }
  return secret;
}

function leftPad_(num, size) {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

function bytesToHex_(bytes) {
  return bytes.map(function (b) {
    const n = b < 0 ? b + 256 : b;
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function base64UrlEncode_(str) {
  return Utilities.base64EncodeWebSafe(str, Utilities.Charset.UTF_8).replace(/=+$/g, '');
}

function base64UrlEncodeBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function base64UrlDecodeToString_(b64url) {
  const padded = b64url + '==='.slice((b64url.length + 3) % 4);
  const bytes = Utilities.base64DecodeWebSafe(padded);
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}

function constantTimeEquals_(a, b) {
  const aa = String(a || '');
  const bb = String(b || '');
  let diff = aa.length ^ bb.length;
  const max = Math.max(aa.length, bb.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (aa.charCodeAt(i) || 0) ^ (bb.charCodeAt(i) || 0);
  }
  return diff === 0;
}
