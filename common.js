// Общий код для обеих страниц: связь с таблицей и мелкие помощники.

// Не даём открыть сайт внутри чужой страницы (защита от «кликджекинга»).
if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try { window.top.location = window.self.location.href; } catch (e) {}
}

(function () {
  const cfg = window.IT_CONFIG || {};
  const configured = /^https:\/\/script\.google\.com\/.+\/exec$/.test((cfg.API_URL || '').trim());

  const STATUSES = ['Новая', 'В работе', 'Ждёт', 'Решена'];
  const STATUS_CLASS = { 'Новая': 'new', 'В работе': 'work', 'Ждёт': 'wait', 'Решена': 'done' };
  const PRIORITY_CLASS = { 'Низкая': 'low', 'Обычная': 'mid', 'Срочная': 'high' };

  async function remote(payload) {
    // Без заголовков: так браузер не делает предварительный запрос, который Apps Script не понимает.
    let res;
    try {
      res = await fetch(cfg.API_URL.trim(), { method: 'POST', body: JSON.stringify(payload) });
    } catch (e) {
      throw new Error('Нет связи с сервером заявок. Проверьте интернет.');
    }
    if (!res.ok) throw new Error('Сервер заявок ответил ошибкой ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Ошибка сервера');
    return data;
  }

  // ── Демо-режим: тот же интерфейс, данные в localStorage ──
  const DEMO_STORE = 'it-helpdesk-demo';
  const DEMO_PASS = 'demo';
  function dload() { try { return JSON.parse(localStorage.getItem(DEMO_STORE)) || []; } catch (e) { return []; } }
  function dsave(a) { try { localStorage.setItem(DEMO_STORE, JSON.stringify(a)); } catch (e) {} }

  async function demo(p) {
    await new Promise(r => setTimeout(r, 200));
    const items = dload();
    const now = new Date().toISOString();
    if (p.action === 'create') {
      if (p.website) return { ok: true, id: 'IT-0000', code: 'XXXXXXXX' };
      if (!p.subject || !p.description || !p.name) throw new Error('Заполните обязательные поля');
      const id = 'IT-' + String(items.length + 1).padStart(4, '0');
      const code = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
      items.push({ id, created: now, status: 'Новая', priority: p.priority, category: p.category,
        subject: p.subject, description: p.description, name: p.name, place: p.place || '',
        phone: p.phone || '', reply: '', updated: now, code });
      dsave(items);
      return { ok: true, id, code };
    }
    if (p.action === 'status') {
      const t = items.find(x => x.id === String(p.id).trim().toUpperCase());
      if (!t || !t.code || t.code !== String(p.code || '').trim().toUpperCase()) {
        throw new Error('Заявка не найдена. Проверьте номер и код.');
      }
      return { ok: true, item: { id: t.id, status: t.status, subject: t.subject, reply: t.reply, created: t.created, updated: t.updated } };
    }
    if (p.key !== DEMO_PASS) throw new Error('Неверный пароль');
    if (p.action === 'list') return { ok: true, items: items.slice().reverse() };
    if (p.action === 'update') {
      const t = items.find(x => x.id === p.id);
      if (!t) throw new Error('Заявка не найдена');
      if (p.status !== undefined) t.status = p.status;
      if (p.reply !== undefined) t.reply = p.reply;
      t.updated = now;
      dsave(items);
      return { ok: true, item: t };
    }
    throw new Error('Неизвестное действие');
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function ago(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const m = Math.round((Date.now() - d) / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return m + ' мин назад';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' ч назад';
    const days = Math.round(h / 24);
    return days + ' дн назад';
  }

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }

  window.IT = {
    cfg, configured, STATUSES, STATUS_CLASS, PRIORITY_CLASS, DEMO_PASS,
    api: p => (configured ? remote(p) : demo(p)),
    esc, fmtDate, ago, store,
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-org]').forEach(el => { el.textContent = cfg.ORG_NAME || 'IT-отдел'; });    if (!configured) document.querySelectorAll('.demo-banner').forEach(el => { el.hidden = false; });
  });
})();
