// Страница для сотрудников: отправка заявки и «Мои заявки».
(function () {
  const CATS = ['Компьютер', 'Принтер', 'Интернет и сеть', 'Почта', 'Программы и 1С', 'Пароль и доступ', 'Телефония', 'Другое'];
  const MINE_KEY = 'it-helpdesk-mine';
  const NAME_KEY = 'it-helpdesk-contact';
  const $ = id => document.getElementById(id);

  $('cats').innerHTML = CATS.map((c, i) =>
    `<label class="chip"><input type="radio" name="category" value="${c}" ${i === 0 ? 'checked' : ''}><span>${c}</span></label>`).join('');

  // Имя, кабинет и телефон запоминаются, чтобы не вводить их каждый раз.
  const contact = IT.store(NAME_KEY) || {};
  ['name', 'place', 'phone'].forEach(k => { if (contact[k]) $(k).value = contact[k]; });

  // [{id, code, subject, status, reply, updated}]; заявки без кода (от старой версии) не проверить.
  let mine = (IT.store(MINE_KEY) || []).filter(t => t.code);

  function renderMine() {
    $('mineActions').hidden = mine.length === 0;
    $('mineNote').textContent = mine.length ? 'Заявки, отправленные с этого компьютера.' : 'Здесь появятся ваши заявки после отправки.';
    $('mine').innerHTML = mine.map(t => `
      <li>
        <div class="head"><span class="mono">${IT.esc(t.id)}</span><span class="pill s-${IT.STATUS_CLASS[t.status] || 'new'}">${IT.esc(t.status || 'Новая')}</span></div>
        <div class="subj">${IT.esc(t.subject)}</div>
        ${t.reply ? `<div class="reply"><b>Ответ IT</b>${IT.esc(t.reply)}</div>` : ''}
        <span class="muted">код <span class="mono">${IT.esc(t.code)}</span>${t.updated ? ' · обновлено ' + IT.ago(t.updated) : ''}</span>
      </li>`).join('');
  }

  function upsertMine(item) {
    const i = mine.findIndex(t => t.id === item.id);
    const merged = Object.assign({}, mine[i] || {}, item);
    if (i >= 0) mine[i] = merged; else mine.unshift(merged);
    mine = mine.slice(0, 20);
    IT.store(MINE_KEY, mine);
    renderMine();
  }

  async function refreshMine() {
    const btn = $('refreshMine');
    btn.disabled = true; btn.textContent = 'Обновляю…';
    for (const t of mine.slice(0, 10)) {
      try { upsertMine((await IT.api({ action: 'status', id: t.id, code: t.code })).item); } catch (e) { /* заявку могли удалить из таблицы */ }
    }
    btn.disabled = false; btn.textContent = 'Обновить статусы';
  }

  $('refreshMine').addEventListener('click', refreshMine);

  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('formError');
    err.hidden = true;
    const data = {
      action: 'create',
      category: document.querySelector('input[name=category]:checked').value,
      priority: document.querySelector('input[name=priority]:checked').value,
      subject: $('subject').value.trim(),
      description: $('description').value.trim(),
      name: $('name').value.trim(),
      place: $('place').value.trim(),
      phone: $('phone').value.trim(),
      website: $('website').value,
    };
    const missing = [!data.subject && 'тему', !data.description && 'подробности', !data.name && 'имя'].filter(Boolean);
    if (missing.length) {
      err.textContent = 'Заполните ' + missing.join(', ') + '.';
      err.hidden = false;
      return;
    }
    const btn = $('submitBtn');
    btn.disabled = true; btn.textContent = 'Отправляю…';
    try {
      const res = await IT.api(data);
      IT.store(NAME_KEY, { name: data.name, place: data.place, phone: data.phone });
      upsertMine({ id: res.id, code: res.code, subject: data.subject, status: 'Новая', reply: '', updated: new Date().toISOString() });
      $('newNo').textContent = res.id;
      $('newCode').textContent = res.code;
      $('form').hidden = true;
      $('success').hidden = false;
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Отправить заявку';
    }
  });

  $('againBtn').addEventListener('click', () => {
    $('subject').value = ''; $('description').value = '';
    $('success').hidden = true; $('form').hidden = false;
    $('subject').focus();
  });

  $('checkForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('checkError');
    err.hidden = true;
    let id = $('checkId').value.trim().toUpperCase();
    const code = $('checkCode').value.trim().toUpperCase();
    if (/^\d+$/.test(id)) id = 'IT-' + id.padStart(4, '0');
    if (!id || !code) {
      err.textContent = 'Введите номер и код заявки.';
      err.hidden = false;
      return;
    }
    try {
      upsertMine(Object.assign({ code }, (await IT.api({ action: 'status', id, code })).item));
      $('checkId').value = '';
      $('checkCode').value = '';
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  renderMine();
  if (mine.length) refreshMine();
})();
