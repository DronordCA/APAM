/**
 * Apps Script — Boutique APAM
 *
 * Onglets attendus :
 * - products
 * - orders
 * - email_templates
 * - settings
 */


function doPost(e) {
  const payload = parseJson_(e);
  const action = String(payload.action || 'create_order').toLowerCase();

  if (action === 'create_order') {
    const result = createOrderFromPayload_(payload);
    return json_(result);
  }
  if (action === 'list_products') {
    return json_({ ok: true, products: listActiveProducts_() });
  }
  return json_({ ok: false, error: 'invalid_action' });
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'list_products').toLowerCase();
  if (action === 'list_products') {
    return json_({ ok: true, products: listActiveProducts_() });
  }
  return json_({ ok: false, error: 'invalid_action' });
}

function createOrderFromPayload_(payload) {
  const ordersSheet = getSheet_('orders');
  const rows = ordersSheet.getDataRange().getValues();
  const headers = rows[0].map(String);

  const base = {
    order_id: '',
    created_at: new Date().toISOString(),
    source: String(payload.source || 'WEB_INTERNAL_FORM'),
    product_key: String(payload.product_key || ''),
    product_name: '',
    quantity: Number(payload.quantity || 1),
    unit_price_eur: '',
    total_price_eur: '',
    payment_mode: String(payload.payment_mode || 'cb').toLowerCase(),
    first_name: String(payload.first_name || ''),
    last_name: String(payload.last_name || ''),
    email: String(payload.email || ''),
    phone: String(payload.phone || ''),
    address: String(payload.address || ''),
    notes: String(payload.notes || ''),
    status: 'new',
    client_email_sent: 'NON',
    internal_email_sent: 'NON',
    payment_status: '',
    assigned_to: ''
  };

  const row = headers.map((h) => base[h] ?? '');
  ordersSheet.appendRow(row);
  const rowIndex = ordersSheet.getLastRow();
  processOrderRow_(rowIndex);

  const idCol = headers.indexOf('order_id') + 1;
  const orderId = idCol > 0 ? String(ordersSheet.getRange(rowIndex, idCol).getValue() || '') : '';
  return { ok: true, order_id: orderId };
}

function bootstrapSetup() {
  ensureHeaders_();
  Logger.log('Bootstrap OK');
}

function processLatestOrder() {
  const ordersSheet = getSheet_('orders');
  const rowIndex = ordersSheet.getLastRow();
  if (rowIndex < 2) return;
  processOrderRow_(rowIndex);
}

function processOrderRow_(rowIndex) {
  const ordersSheet = getSheet_('orders');
  const data = ordersSheet.getDataRange().getValues();
  if (data.length < 2 || rowIndex > data.length) return;

  const headers = data[0].map(String);
  const row = data[rowIndex - 1];

  const order = rowToObject_(headers, row);
  const normalized = enrichOrder_(order);

  writeOrderBack_(ordersSheet, headers, rowIndex, normalized);
  sendOrderEmails_(normalized);
}

function sendReminderDrafts() {
  const sh = getSheet_('orders');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return;

  const headers = rows[0].map(String);
  const idx = indexer_(headers);
  const now = new Date();

  for (let i = 1; i < rows.length; i += 1) {
    const status = String(rows[i][idx('status')] || '').toLowerCase();
    const paymentStatus = String(rows[i][idx('payment_status')] || '').toLowerCase();
    if (status !== 'processing' || paymentStatus !== 'awaiting_transfer') continue;

    const createdAt = new Date(String(rows[i][idx('created_at')] || ''));
    if (!createdAt.getTime()) continue;

    const ageMs = now.getTime() - createdAt.getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    if (ageMs < 2 * oneDay) continue;

    const order = rowToObject_(headers, rows[i]);
    const subject = `Rappel commande ${order.order_id}`;
    const body = `Bonjour ${order.first_name || ''},\n\nNous n'avons pas encore reçu le virement pour la commande ${order.order_id}.\nSi le paiement a déjà été fait, ignorez ce message.\n\nMerci,\nAPAM`;

    MailApp.sendEmail(String(order.email || ''), subject, body);
  }
}

function enrichOrder_(order) {
  const nowIso = new Date().toISOString();
  const settings = getSettings_();
  const product = getProductByKey_(order.product_key);

  const quantity = Number(order.quantity || 1);
  const unitPrice = Number(product.price_eur || 0);
  const total = quantity * unitPrice;
  const orderId = order.order_id || buildOrderId_(settings.order_prefix || 'APAM');

  return {
    order_id: orderId,
    created_at: order.created_at || nowIso,
    source: order.source || 'FORM',
    product_key: order.product_key,
    product_name: product.product_name || order.product_name || order.product_key,
    quantity,
    unit_price_eur: unitPrice,
    total_price_eur: total,
    payment_mode: String(order.payment_mode || '').toLowerCase(),
    first_name: order.first_name || '',
    last_name: order.last_name || '',
    email: order.email || '',
    phone: order.phone || '',
    address: order.address || '',
    notes: order.notes || '',
    status: order.status || 'processing',
    client_email_sent: 'NON',
    internal_email_sent: 'NON',
    payment_status: order.payment_status || (String(order.payment_mode || '').toLowerCase() === 'virement' ? 'awaiting_transfer' : 'to_collect_on_site'),
    assigned_to: order.assigned_to || ''
  };
}

function sendOrderEmails_(order) {
  const settings = getSettings_();
  const templates = getTemplates_();

  const templateKey = order.payment_mode === 'virement' ? 'client_virement' : 'client_cb';
  const clientTpl = templates[templateKey];
  const internalTpl = templates.internal_new_order;

  const context = Object.assign({}, settings, order);

  if (clientTpl && String(order.email || '').trim()) {
    MailApp.sendEmail(
      String(order.email),
      renderTemplate_(clientTpl.subject_template, context),
      renderTemplate_(clientTpl.body_template, context)
    );
    order.client_email_sent = 'OUI';
  }

  if (internalTpl && settings.internal_notification_email) {
    MailApp.sendEmail(
      settings.internal_notification_email,
      renderTemplate_(internalTpl.subject_template, context),
      renderTemplate_(internalTpl.body_template, context)
    );
    order.internal_email_sent = 'OUI';
  }
}

function writeOrderBack_(sheet, headers, rowIndex, order) {
  const idx = indexer_(headers);

  Object.keys(order).forEach((k) => {
    const col = idx(k);
    if (col < 0) return;
    sheet.getRange(rowIndex, col + 1).setValue(order[k]);
  });
}

function getProductByKey_(productKey) {
  const sh = getSheet_('products');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return {};

  const headers = rows[0].map(String);
  const idx = indexer_(headers);

  for (let i = 1; i < rows.length; i += 1) {
    const key = String(rows[i][idx('product_key')] || '');
    const active = String(rows[i][idx('active')] || '').toUpperCase();
    if (key === productKey && active === 'OUI') {
      return rowToObject_(headers, rows[i]);
    }
  }
  return {};
}

function listActiveProducts_() {
  const sh = getSheet_('products');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0].map(String);
  const idx = indexer_(headers);
  const out = [];

  for (let i = 1; i < rows.length; i += 1) {
    const active = String(rows[i][idx('active')] || '').toUpperCase();
    if (active !== 'OUI') continue;
    out.push(rowToObject_(headers, rows[i]));
  }

  return out;
}

function getTemplates_() {
  const sh = getSheet_('email_templates');
  const rows = sh.getDataRange().getValues();
  if (rows.length < 2) return {};

  const headers = rows[0].map(String);
  const idx = indexer_(headers);
  const out = {};

  for (let i = 1; i < rows.length; i += 1) {
    const key = String(rows[i][idx('template_key')] || '');
    const active = String(rows[i][idx('active')] || '').toUpperCase();
    if (!key || active !== 'OUI') continue;
    out[key] = rowToObject_(headers, rows[i]);
  }
  return out;
}

function getSettings_() {
  const sh = getSheet_('settings');
  const rows = sh.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rows.length; i += 1) {
    const key = String(rows[i][0] || '').trim();
    const val = String(rows[i][1] || '');
    if (key) map[key] = val;
  }
  return map;
}

function buildOrderId_(prefix) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${yyyy}${mm}${dd}-${rand}`;
}

function renderTemplate_(tpl, context) {
  return String(tpl || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function ensureHeaders_() {
  const expected = {
    products: ['product_key', 'product_name', 'category', 'price_eur', 'active', 'description', 'image_url', 'sheet_slot'],
    orders: ['order_id', 'created_at', 'source', 'product_key', 'product_name', 'quantity', 'unit_price_eur', 'total_price_eur', 'payment_mode', 'first_name', 'last_name', 'email', 'phone', 'address', 'notes', 'status', 'client_email_sent', 'internal_email_sent', 'payment_status', 'assigned_to'],
    email_templates: ['template_key', 'subject_template', 'body_template', 'active'],
    settings: ['key', 'value']
  };

  Object.keys(expected).forEach((name) => {
    const sh = getSheet_(name);
    const firstRow = sh.getRange(1, 1, 1, expected[name].length).getValues()[0].map(String);
    const missing = expected[name].some((h, i) => firstRow[i] !== h);
    if (missing) {
      sh.getRange(1, 1, 1, expected[name].length).setValues([expected[name]]);
    }
  });
}

function rowToObject_(headers, row) {
  const out = {};
  headers.forEach((h, i) => {
    out[h] = row[i];
  });
  return out;
}

function indexer_(headers) {
  return function(key) {
    return headers.indexOf(key);
  };
}

function parseJson_(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return {};
    return JSON.parse(e.postData.contents);
  } catch (_) {
    return {};
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);
  return sh;
}
