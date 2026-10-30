/**
 * Серверная часть сайта заявок: Google Apps Script + Google Таблица.
 *
 * Пароль для панели IT НЕ пишется в этот файл. Его задают в редакторе
 * Apps Script: Настройки проекта → Свойства скрипта → ADMIN_KEY.
 */

const SHEET_NAME = 'Заявки';
const HEADERS = ['Номер', 'Создана', 'Статус', 'Срочность', 'Категория', 'Тема',
  'Описание', 'Имя', 'Кабинет', 'Телефон', 'Ответ IT', 'Обновлена'];
const FIELDS = ['id', 'created', 'status', 'priority', 'category', 'subject',
  'description', 'name', 'place', 'phone', 'reply', 'updated'];

const STATUSES = ['Новая', 'В работе', 'Ждёт', 'Решена'];
const PRIORITIES = ['Низкая', 'Обычная', 'Срочная'];
const CATEGORIES = ['Компьютер', 'Принтер', 'Интернет и сеть', 'Почта',
  'Программы и 1С', 'Пароль и доступ', 'Телефония', 'Другое'];

function doGet(e) {
  return json_({ ok: true, service: 'it-helpdesk' });
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (_) {}
  try {
    switch (p.action) {
      case 'create': return json_(create_(p));
      case 'status': return json_(status_(p.id));
      case 'list':   auth_(p.key); return json_({ ok: true, items: list_() });
      case 'update': auth_(p.key); return json_(update_(p));
      default:       return json_({ ok: false, error: 'Неизвестное действие' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function create_(p) {
  const subject = clean_(p.subject, 120);
  const description = clean_(p.description, 3000);
  const name = clean_(p.name, 80);
  if (!subject) throw new Error('Укажите тему заявки');
  if (!description) throw new Error('Опишите проблему');
  if (!name) throw new Error('Укажите ваше имя');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const id = 'IT-' + String(sh.getLastRow()).padStart(4, '0');
    const now = new Date();
    sh.appendRow([
      id, now, 'Новая',
      oneOf_(p.priority, PRIORITIES, 'Обычная'),
      oneOf_(p.category, CATEGORIES, 'Другое'),
      subject, description, name,
      clean_(p.place, 60), clean_(p.phone, 40),
      '', now,
    ]);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

// Для сотрудника: только статус и ответ, без чужих контактов.
function status_(id) {
  const row = find_(id);
  if (!row) throw new Error('Заявка не найдена');
  const t = row.item;
  return { ok: true, item: {
    id: t.id, status: t.status, subject: t.subject, reply: t.reply,
    created: t.created, updated: t.updated,
  } };
}

function list_() {
  const values = sheet_().getDataRange().getValues().slice(1);
  return values.filter(r => r[0]).map(toItem_).reverse();
}

function update_(p) {
  const row = find_(p.id);
  if (!row) throw new Error('Заявка не найдена');
  const sh = sheet_();
  const col = name => FIELDS.indexOf(name) + 1;
  if (p.status !== undefined) {
    sh.getRange(row.index, col('status')).setValue(oneOf_(p.status, STATUSES, row.item.status));
  }
  if (p.reply !== undefined) {
    sh.getRange(row.index, col('reply')).setValue(clean_(p.reply, 2000));
  }
  sh.getRange(row.index, col('updated')).setValue(new Date());
  return { ok: true, item: toItem_(sh.getRange(row.index, 1, 1, FIELDS.length).getValues()[0]) };
}

// ── helpers ──

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function find_(id) {
  id = String(id || '').trim().toUpperCase();
  if (!/^IT-\d+$/.test(id)) return null;
  const values = sheet_().getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === id) return { index: i + 1, item: toItem_(values[i]) };
  }
  return null;
}

function toItem_(r) {
  const o = {};
  FIELDS.forEach((f, i) => { o[f] = r[i] instanceof Date ? r[i].toISOString() : String(r[i] ?? ''); });
  return o;
}

function auth_(key) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!real) throw new Error('Пароль не задан: добавьте свойство ADMIN_KEY в настройках скрипта');
  if (String(key || '') !== real) throw new Error('Неверный пароль');
}

function clean_(v, max) {
  let s = String(v ?? '').trim().slice(0, max);
  // Чтобы текст вроде "=СУММ(...)" не стал формулой в таблице.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function oneOf_(v, list, fallback) {
  return list.indexOf(v) >= 0 ? v : fallback;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
