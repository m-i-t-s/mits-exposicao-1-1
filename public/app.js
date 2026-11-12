/* 1:1 — MITS Galeria. Interface pública + editor conectado às Netlify Functions. */
(() => {
  "use strict";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const SEED = {
    settings: {
      curator: 'Curadoria de Lara Maia',
      artists: 'Beatriz Lindenberg\nFyodor Pavlov-Andreevich\nAline Setton',
      contactEmail: ''
    },
    artworks: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, artist: 'Nome artista', title: 'Nome obra',
      year: 'Ano obra', technique: 'Técnica obra', dimensions: 'Dimensões obra',
      status: 'Disponível', imageUpdatedAt: null
    }))
  };
  const POSITIONS = [
    [22.6, 86.9], [12.8, 66.8], [34.0, 48.2], [12.8, 35.0],
    [12.7, 12.8], [30.1, 7.3], [49.3, 13.3], [71.1, 7.3],
    [86.6, 13.3], [85.4, 35.2]
  ];
  const statuses = new Set(['Disponível', 'Reservada', 'Vendida', 'Indisponível']);
  const state = { data: structuredClone(SEED), activeId: 1, authenticated: false,
    online: false, currentDialog: null };

  function position(id) { return state.data.artworks.find(w => w.id === Number(id)); }
  function openRoute() {
    const match = location.hash.match(/^#obra-(10|[1-9])$/);
    if (match) {
      state.activeId = Number(match[1]);
      $('#gallery').hidden = false;
      $('#home').hidden = true;
      renderWork();
    } else {
      $('#gallery').hidden = true;
      $('#home').hidden = false;
      document.title = '1:1 — MITS Galeria';
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function go(id) {
    const num = ((Number(id) - 1 + 10) % 10) + 1;
    if (location.hash === `#obra-${num}`) {
      state.activeId = num;
      renderWork();
    } else location.hash = `obra-${num}`;
  }
  function setContent(selector, str) { $(selector).textContent = str ?? ''; }

  function renderWork() {
    const work = position(state.activeId);
    if (!work) return;
    setContent('#work-number', String(work.id));
    setContent('#work-artist', work.artist);
    setContent('#work-title', work.title);
    setContent('#work-year', work.year);
    setContent('#work-technique', work.technique);
    setContent('#work-dimensions', work.dimensions);
    setContent('#work-status', statuses.has(work.status) ? work.status : 'Indisponível');
    const image = $('#work-image');
    if (work.imageUpdatedAt) {
      const url = `/api/image/${work.id}?v=${encodeURIComponent(work.imageUpdatedAt)}`;
      image.src = url;
      image.alt = `${work.title}, de ${work.artist}`;
      image.hidden = false;
      $('#work-image-empty').hidden = true;
      image.onerror = () => {image.hidden = true; $('#work-image-empty').hidden = false;};
    } else {
      image.hidden = true;
      image.removeAttribute('src');
      $('#work-image-empty').hidden = false;
    }
    syncMapArtworks();
    $$('.position').forEach(btn => {
      const active = Number(btn.dataset.id) === work.id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.title = `Posição ${btn.dataset.id}${active ? ' — selecionada' : ''}`;
    });
    document.title = `${work.id}. ${work.artist} — 1:1 | MITS`;
    $('#edit-position').value = String(work.id);
  }
  /**
   * O mapa é a representação gráfica FINAL da exposição, não uma planta técnica.
   * Os números são pontos de navegação; a fotografia selecionada aparece no
   * retângulo preto central da ficha, e nunca dentro do mapa.
   */
  function syncHotspotsFromSvg(svg) {
    const view = svg.viewBox?.baseVal;
    if (!view || !view.width || !view.height) return;
    const textNodes = [...svg.querySelectorAll('text')];
    for (let id = 1; id <= 10; id++) {
      const target = svg.getElementById?.(`numero-${id}`) ||
        svg.querySelector(`[data-hotspot="${id}"]`) ||
        textNodes.find(el => el.textContent.trim() === String(id));
      if (!target) continue;
      try {
        const box = target.getBBox();
        const ctm = target.getCTM();
        if (!ctm) continue;
        const point = svg.createSVGPoint();
        point.x = box.x + box.width/2;
        point.y = box.y + box.height/2;
        const rootCtm = svg.getCTM();
        if (!rootCtm) continue;
        const p = point.matrixTransform(rootCtm.inverse().multiply(ctm));
        const hotspot = $(`.position[data-id="${id}"]`);
        if (hotspot) {
          hotspot.style.left = `${(p.x - view.x) / view.width * 100}%`;
          hotspot.style.top = `${(p.y - view.y) / view.height * 100}%`;
        }
      } catch { /* Imagens SVG sem posições de texto mantêm os hotspots do mockup. */ }
    }
  }
  function syncMapArtworks() {
    const object = $('#plan-vector');
    const svg = object?.contentDocument?.querySelector('svg');
    if (svg) syncHotspotsFromSvg(svg);
  }
  function renderSettings() {
    const cfg = state.data.settings;
    setContent('#home-curator', cfg.curator || SEED.settings.curator);
    const artistsEl = $('#home-artists');
    artistsEl.replaceChildren();
    (cfg.artists || SEED.settings.artists).split('\n').forEach((name, index) => {
      if (index) artistsEl.append(document.createElement('br'));
      artistsEl.append(document.createTextNode(name));
    });
  }
  function createHotspots() {
    const host = $('#plan-hotspots');
    POSITIONS.forEach(([x, y], index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'position';
      btn.dataset.id = String(index + 1);
      btn.style.left = `${x}%`;
      btn.style.top = `${y}%`;
      btn.setAttribute('aria-label', `Ver obra na posição ${index + 1}`);
      btn.addEventListener('click', () => go(index + 1));
      host.append(btn);
      const opt = document.createElement('option');
      opt.value = String(index + 1);
      opt.textContent = `Obra ${index + 1}`;
      $('#edit-position').append(opt);
    });
  }
  function showToast(message) {
    const t = $('#toast');
    t.textContent = message;
    t.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => t.classList.remove('visible'), 3400);
  }
  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    $$('.theme-switch').forEach(b => b.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo noturno'));
    try { localStorage.setItem('mits-theme', theme); } catch {}
    syncMapArtworks();
  }
  async function request(path, opts = {}) {
    let response;
    try {
      response = await fetch(`/api/${path}`, { credentials: 'same-origin', cache: 'no-store', ...opts });
    } catch {
      throw new Error('Não foi possível acessar o servidor.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
    return data;
  }
  async function loadData() {
    try {
      const content = await request('data');
      if (!Array.isArray(content.artworks) || content.artworks.length !== 10) throw Error('Dados incompletos');
      state.data = content;
      state.online = true;
      renderSettings();
      renderWork();
    } catch (err) {
      state.online = false;
      console.warn('Prévia local: dados de demonstração. Para editar, publique no Netlify.', err.message);
    }
  }
  function closeDialog() {
    $('#modal-backdrop').hidden = true;
    ['login-dialog','editor-dialog','contact-dialog'].forEach(id => $(`#${id}`).hidden = true);
    state.currentDialog = null;
    document.body.style.overflow = '';
  }
  function openDialog(name) {
    closeDialog();
    $('#modal-backdrop').hidden = false;
    $(`#${name}-dialog`).hidden = false;
    state.currentDialog = name;
    document.body.style.overflow = 'hidden';
    const el = $(`#${name}-dialog`);
    const field = el.querySelector('input:not([type=file]),button:not([data-close-dialog])');
    if (field) field.focus();
  }
  async function adminAccess() {
    if (!state.online) {
      showToast('A edição precisa de uma publicação no Netlify.');
      return;
    }
    try {
      const { authenticated } = await request('session');
      state.authenticated = !!authenticated;
    } catch { state.authenticated = false; }
    if (state.authenticated) openEditor();
    else {$('#login-error').hidden = true; $('#login-form').reset(); openDialog('login');}
  }
  function setAdminTab(selected) {
    const work = selected === 'work';
    $('#tab-work').setAttribute('aria-selected', String(work));
    $('#tab-settings').setAttribute('aria-selected', String(!work));
    $('#edit-work-form').hidden = !work;
    $('#edit-settings-form').hidden = work;
    $('#editor-message').textContent = '';
  }
  function fillWorkForm() {
    const work = position($('#edit-position').value) || position(state.activeId);
    $('#edit-position').value = String(work.id);
    $('#edit-artist').value = work.artist;
    $('#edit-title').value = work.title;
    $('#edit-year').value = work.year;
    $('#edit-technique').value = work.technique;
    $('#edit-dimensions').value = work.dimensions;
    $('#edit-status').value = work.status;
    $('#edit-image').value = '';
    $('#edit-remove-image').checked = false;
    $('#image-admin-note').textContent = work.imageUpdatedAt ?
      'Esta obra tem uma imagem cadastrada. Se não escolher outro arquivo, ela será mantida.' :
      'Nenhuma imagem cadastrada para esta posição.';
  }
  function openEditor() {
    const cfg = state.data.settings;
    $('#edit-curator').value = cfg.curator || '';
    $('#edit-artists').value = cfg.artists || '';
    $('#edit-email').value = cfg.contactEmail || '';
    $('#edit-position').value = String(state.activeId);
    fillWorkForm();
    setAdminTab('work');
    openDialog('editor');
  }
  async function login(event) {
    event.preventDefault();
    const btn = $('#login-form button[type=submit]');
    btn.disabled = true;
    $('#login-error').hidden = true;
    try {
      await request('login', { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ password: $('#password').value }) });
      state.authenticated = true;
      $('#login-form').reset();
      openEditor();
    } catch (err) {
      $('#login-error').textContent = err.message;
      $('#login-error').hidden = false;
    } finally { btn.disabled = false; }
  }
  async function saveWork(event) {
    event.preventDefault();
    const btn = $('#save-work');
    btn.disabled = true;
    $('#editor-message').textContent = 'Salvando…';
    try {
      const fd = new FormData($('#edit-work-form'));
      const id = Number(fd.get('id'));
      let updatedAt = position(id)?.imageUpdatedAt || null;
      const image = fd.get('image');
      const removeImage = $('#edit-remove-image').checked;
      if (image instanceof File && image.size > 0 && !removeImage) {
        if (!['image/jpeg','image/png','image/webp'].includes(image.type)) throw new Error('Imagem inválida. Use JPG, PNG ou WebP.');
        if (image.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter até 5 MB.');
        const uploadData = new FormData();
        uploadData.append('image',image);
        uploadData.append('id',String(id));
        const upload = await request('upload', { method:'POST',body:uploadData });
        updatedAt = upload.imageUpdatedAt;
      }
      const work = {
        id, artist: String(fd.get('artist') || '').trim(),
        title: String(fd.get('title') || '').trim(),
        year: String(fd.get('year') || '').trim(),
        technique: String(fd.get('technique') || '').trim(),
        dimensions: String(fd.get('dimensions') || '').trim(),
        status: String(fd.get('status') || 'Indisponível'),
        imageUpdatedAt: removeImage ? null : updatedAt,
        removeImage
      };
      const result = await request('save', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'artwork',work}) });
      state.data.artworks = state.data.artworks.map(w => w.id === id ? result.work : w);
      if (state.activeId === id) renderWork();
      fillWorkForm();
      $('#editor-message').textContent = `Obra ${id} atualizada com sucesso.`;
      showToast(`Obra ${id} atualizada.`);
    } catch (err) {
      $('#editor-message').textContent = `Não foi possível salvar. ${err.message}`;
    } finally {btn.disabled = false;}
  }
  async function saveSettings(event) {
    event.preventDefault();
    const btn = $('#save-settings');
    btn.disabled = true;
    $('#editor-message').textContent = 'Salvando…';
    try {
      const cfg = {
        curator: $('#edit-curator').value.trim(),
        artists: $('#edit-artists').value.trim(),
        contactEmail: $('#edit-email').value.trim()
      };
      const result = await request('save', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'settings',settings:cfg})});
      state.data.settings = result.settings;
      renderSettings();
      $('#editor-message').textContent = 'Informações da exposição atualizadas.';
      showToast('Exposição atualizada.');
    } catch (err) {
      $('#editor-message').textContent = `Não foi possível salvar. ${err.message}`;
    } finally {btn.disabled = false;}
  }
  function contact() {
    const work = position(state.activeId);
    const cfg = state.data.settings;
    setContent('#contact-description', `Para consultar a obra ${work.id}, “${work.title}”, de ${work.artist}, entre em contato com a MITS Galeria.`);
    const email = cfg.contactEmail;
    if (email && /^\S+@\S+\.\S+$/.test(email)) {
      $('#contact-email-link').hidden = false;
      $('#contact-not-configured').hidden = true;
      const subject = `Consulta sobre a obra ${work.id} — ${work.title} | 1:1`;
      const body = `Olá, gostaria de informações sobre a obra ${work.id}, “${work.title}”, de ${work.artist}, na exposição 1:1.`;
      $('#contact-email-link').href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      $('#contact-email-link').hidden = true;
      $('#contact-not-configured').hidden = false;
    }
    openDialog('contact');
  }
  function init() {
    createHotspots();
    $('#plan-vector').addEventListener('load', syncMapArtworks);
    try {applyTheme(localStorage.getItem('mits-theme') || 'light');} catch {applyTheme('light');}
    $$('.theme-switch').forEach(btn => btn.addEventListener('click', () => applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')));
    $$('.admin-trigger').forEach(btn => btn.addEventListener('click', adminAccess));
    $$('[data-close-dialog]').forEach(btn => btn.addEventListener('click', closeDialog));
    $('#modal-backdrop').addEventListener('click', evt => {if (evt.target === $('#modal-backdrop')) closeDialog();});
    $('#enter-gallery').addEventListener('click', () => go(1));
    $('#back-home').addEventListener('click', () => location.hash = 'inicio');
    $('#gallery-back').addEventListener('click', () => location.hash = 'inicio');
    $('#previous-work').addEventListener('click', () => go(state.activeId - 1));
    $('#next-work').addEventListener('click', () => go(state.activeId + 1));
    $('#contact-button').addEventListener('click', contact);
    $('#login-form').addEventListener('submit',login);
    $('#edit-work-form').addEventListener('submit',saveWork);
    $('#edit-settings-form').addEventListener('submit',saveSettings);
    $('#edit-position').addEventListener('change',fillWorkForm);
    $('#tab-work').addEventListener('click',() => setAdminTab('work'));
    $('#tab-settings').addEventListener('click',() => setAdminTab('settings'));
    $('#logout').addEventListener('click', async () => {
      try {await request('logout',{method:'POST'});} catch {}
      state.authenticated = false;
      closeDialog();
      showToast('Acesso encerrado.');
    });
    document.addEventListener('keydown', evt => {
      if (evt.key === 'Escape' && state.currentDialog) closeDialog();
      if (!state.currentDialog && !$('#gallery').hidden) {
        if (evt.key === 'ArrowLeft') go(state.activeId-1);
        if (evt.key === 'ArrowRight') go(state.activeId+1);
      }
    });
    window.addEventListener('hashchange', openRoute);
    renderSettings();
    openRoute();
    loadData();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
