/* Exposição MITS 1:1: SVGs originais são a única fonte do layout visual. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const SEED = {
  settings: {curator:'Curadoria de Lara Maia',artists:'Beatriz Lindenberg\nFyodor Pavlov-Andreevich\nAline Setton',contactEmail:''},
  artworks: Array.from({length:10},(_,i)=>({id:i+1,artist:'Nome artista',title:'Nome obra',year:'Ano obra',technique:'Técnica obra',dimensions:'Dimensões obra',status:'Disponível',imageUpdatedAt:null}))
};
const state={data:structuredClone(SEED),activeId:1,authenticated:false,online:false,currentDialog:null};
// Coordenadas extraídas dos números desenhados na ficha vetorial, em 1920×1080.
const MAP_NUMBERS = [[1301,883],[1250,705],[1353,555],[1252,388],[1253,184],[1334,137],[1422,185],[1526,138],[1601,185],[1590,388]];
const statuses=new Set(['Disponível','Reservada','Vendida','Indisponível']);
function position(id){return state.data.artworks.find(w=>w.id===Number(id));}
function setContent(selector,str){const x=$(selector);if(x)x.textContent=str??'';}
function el(tag,props={}){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(props))n.setAttribute(k,String(v));return n;}
async function loadSvg(file,container){
  const res=await fetch(`/assets/${file}`,{cache:'force-cache'});
  if(!res.ok)throw Error(`Não foi possível carregar ${file}`);
  const xml=new DOMParser().parseFromString(await res.text(),'image/svg+xml');
  if(xml.querySelector('parsererror'))throw Error(`SVG inválido: ${file}`);
  const original=document.importNode(xml.documentElement,true);
  // Cada SVG usa classes Illustrator .cls-1, .cls-2 etc.
  // Isolamos as classes para que as regras da capa não modifiquem a ficha.
  const prefix=file.includes('capa')?'capa':'ficha';
  original.querySelectorAll('[class]').forEach(node=>{
    node.setAttribute('class',node.getAttribute('class').split(/\s+/).map(x=>`${prefix}-${x}`).join(' '));
  });
  original.querySelectorAll('style').forEach(style=>{
    style.textContent=style.textContent
      .replace(/\.cls-(\d+)/g,`.${prefix}-cls-$1`)
      .replace(/font-family:\s*([^;]+);/g,(_,family)=>`font-family:${family},Arial,sans-serif;`);
  });
  original.removeAttribute('id');
  original.setAttribute('role','img');
  original.setAttribute('aria-label',file.includes('capa')?'Identidade visual da exposição 1:1':'Ficha e mapa gráfico da exposição');
  original.setAttribute('preserveAspectRatio','xMidYMid meet');
  container.replaceChildren(original);
  return original;
}
function fitEditableSvgText(target){
  if(!target.isConnected || $('#gallery').hidden)return;
  const minimum=Number(target.dataset.fitMin||18);
  const maxWidth=340; // mantém uma margem antes do retângulo da fotografia (x = 455.67)
  try{
    target.style.removeProperty('font-size');
    const normalSize=parseFloat(getComputedStyle(target).fontSize)||40;
    const actual=target.getComputedTextLength();
    if(actual>maxWidth && actual>0){
      target.style.fontSize=`${Math.max(minimum,normalSize*maxWidth/actual)}px`;
    }
  }catch(error){console.warn('Falha ao ajustar o texto da obra:',error);}
}
function renderSvgText(svg,placeholder,value,min=18){
  const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
  const target=[...svg.querySelectorAll('text')].find(e=>normalize(e.textContent)===normalize(placeholder));
  if(!target)return;
  target.replaceChildren(document.createTextNode(String(value||'')));
  target.removeAttribute('textLength');
  target.removeAttribute('lengthAdjust');
  target.dataset.fitMin=String(min);
  // Medição apenas quando o SVG está visível e a fonte foi carregada.
  requestAnimationFrame(()=>fitEditableSvgText(target));
  document.fonts.ready.then(()=>requestAnimationFrame(()=>fitEditableSvgText(target)));
}
function addImage(svg,work){
  const frame=[...svg.querySelectorAll('rect')].find(r=>r.getAttribute('x')==='455.67' && r.getAttribute('y')==='82.33');
  if(!frame || !work.imageUpdatedAt)return;
  const image=el('image',{x:455.67,y:82.33,width:504.33,height:630.42,preserveAspectRatio:'xMidYMid meet','data-original-colors':'true'});
  image.setAttribute('href',`/api/image/${work.id}?v=${encodeURIComponent(work.imageUpdatedAt)}`);
  frame.after(image);
}
function updateGallerySvg(svg,work){
  renderSvgText(svg,'Nome artista',work.artist,20);
  renderSvgText(svg,'Nome obra',work.title,19);
  renderSvgText(svg,'Ano obra',work.year,17);
  renderSvgText(svg,'Técnica obra',work.technique,16);
  renderSvgText(svg,'Dimensões obra',work.dimensions,16);
  // Os dois arquivos originais conservam, inclusive, os dois estados ilustrados pela designer.
  // Para Reservada/Vendida, cobrimos SOMENTE o selo editável.
  if(!['Disponível','Indisponível'].includes(work.status)){
    const cover=el('rect',{x:85,y:663,width:255,height:56,fill:'#ebebeb'});
    const outline=el('rect',{x:92,y:669,width:190,height:45,fill:'none',stroke:'#ff0','stroke-width':5});
    const txt=el('text',{x:103,y:705,style:"font-family:PPNeueMontreal-Thin,'PP Neue Montreal',Arial,sans-serif;font-size:30px;font-weight:200;fill:#000"});
    txt.textContent=work.status;
    const g=el('g',{'data-dynamic-status':'true'});g.append(cover,outline,txt);svg.append(g);
    requestAnimationFrame(()=>{
      try{const w=txt.getComputedTextLength()+18;outline.setAttribute('width',Math.max(175,w+14));}catch{}
    });
  }
  // O número grande 1 é mantido como a designer desenhou. Para 2–10,
  // ampliamos os próprios VETORES dos números do mapa (mesma tipografia de origem).
  if(work.id!==1){
    const g=el('g');
    g.append(el('rect',{x:75,y:68,width:190,height:154,fill:'#ebebeb'}));
    const numberedGroup=[...svg.children].find(e=>e.localName==='g'&&e.children.length===75);
    const source=numberedGroup?.children[37+work.id];
    if(source){
      const bbox=source.getBBox();
      const scale=110/bbox.height;
      const copied=source.cloneNode(true);
      copied.removeAttribute('id');
      const wrapper=el('g',{transform:`translate(${95-bbox.x*scale} ${82.33-bbox.y*scale}) scale(${scale})`});
      wrapper.append(copied);g.append(wrapper);
    }
    svg.append(g);
  }
  // O destaque amarelo é reposicionado SEM alterar o mapa original.
  const highlight=[...svg.querySelectorAll('rect')].find(r=>r.getAttribute('x')==='1267.33' && r.getAttribute('y')==='849');
  if(highlight){
    const [x,y]=MAP_NUMBERS[work.id-1];
    const width=work.id===10?92:68;
    highlight.setAttribute('x',String(x-width/2));
    highlight.setAttribute('y',String(y-34));
    highlight.setAttribute('width',String(width));
    highlight.setAttribute('height','68');
  }
  addImage(svg,work);
}
async function renderWork(){
  if($('#gallery').hidden)return;
  const work=position(state.activeId);
  if(!work)return;
  const file=work.status==='Indisponível'?'expografia-ficha-indisponivel-original.svg':'expografia-ficha-disponivel-original.svg';
  const container=$('#gallery-svg-container');
  const ticket=`${work.id}:${work.imageUpdatedAt}:${work.artist}:${work.title}:${work.status}:${work.year}:${work.technique}:${work.dimensions}`;
  if(container.dataset.ticket!==ticket){
    container.dataset.ticket=ticket;
    try{const svg=await loadSvg(file,container);if(container.dataset.ticket!==ticket)return;updateGallerySvg(svg,work);}
    catch(e){console.error(e);showToast('Erro ao carregar o SVG da ficha.');}
  }
  document.title=`${work.id}. ${work.artist} — 1:1 | MITS`;
  $('#edit-position').value=String(work.id);
  $$('.map-hit').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.id)===work.id)));
}
async function renderSettings(){
  const cfg=state.data.settings;
  const container=$('#home-svg-container');
  if(!container.querySelector('svg'))return;
  const svg=container.querySelector('svg');
  const curator=svg.querySelector('text');
  if(curator)curator.textContent=cfg.curator||SEED.settings.curator;
  const prior=svg.querySelector('[data-dynamic-artists]');if(prior)prior.remove();
  if((cfg.artists||'').trim()!==SEED.settings.artists.trim()){
    const group=el('g',{'data-dynamic-artists':'true'});
    group.append(el('rect',{x:67,y:403,width:535,height:168,fill:'#ebebeb'}));
    const t=el('text',{x:71,y:453,style:"font-family:PPNeueMontreal-Book,'PP Neue Montreal',Arial,sans-serif;fill:#000;font-size:32.5px"});
    (cfg.artists||'').split('\n').slice(0,5).forEach((s,i)=>{const span=el('tspan',{x:71,dy:i?'41':'0'});span.textContent=s;t.append(span)});
    group.append(t);svg.append(group);
  }
}
function createHotspots(){
  const host=$('#plan-hotspots');
  MAP_NUMBERS.forEach(([x,y],index)=>{
    const btn=document.createElement('button');
    btn.type='button';btn.className='map-hit';btn.dataset.id=String(index+1);
    const w=index===9?95:70;
    btn.style.left=`${x/1920*100}%`;
    btn.style.top=`${y/1080*100}%`;
    btn.style.width=`${w/1920*100}%`;
    btn.style.height=`${70/1080*100}%`;
    btn.setAttribute('aria-label',`Ver obra na posição ${index+1}`);
    btn.addEventListener('click',()=>go(index+1));host.append(btn);
    const opt=document.createElement('option');opt.value=String(index+1);opt.textContent=`Obra ${index+1}`;$('#edit-position').append(opt);
  });
}
function go(id){
  const num=((Number(id)-1+10)%10)+1;
  if(location.hash===`#obra-${num}`){state.activeId=num;renderWork();}
  else location.hash=`obra-${num}`;
}
function openRoute(){
  const match=location.hash.match(/^#obra-(10|[1-9])$/);
  if(match){state.activeId=Number(match[1]);$('#home').hidden=true;$('#gallery').hidden=false;renderWork();}
  else{$('#home').hidden=false;$('#gallery').hidden=true;document.title='1:1 — MITS Galeria';}
  window.scrollTo({left:0,top:0,behavior:'instant'});
}
function showToast(message){
  const t=$('#toast');t.textContent=message;t.classList.add('visible');
  clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('visible'),3400);
}
function applyTheme(theme){
  document.documentElement.classList.toggle('dark',theme==='dark');
  try{localStorage.setItem('mits-theme',theme);}catch{}
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

function init(){
  createHotspots();
  loadSvg('expografia-capa-original.svg',$('#home-svg-container')).then(renderSettings).catch(e=>console.error(e));
  try{applyTheme(localStorage.getItem('mits-theme')||'light');}catch{applyTheme('light');}
  $('.theme-switch').addEventListener('click',()=>applyTheme(document.documentElement.classList.contains('dark')?'light':'dark'));
  $('.admin-trigger').addEventListener('click',adminAccess);
  $$('[data-close-dialog]').forEach(btn=>btn.addEventListener('click',closeDialog));
  $('#modal-backdrop').addEventListener('click',evt=>{if(evt.target===$('#modal-backdrop'))closeDialog();});
  $('#enter-gallery').addEventListener('click',()=>go(1));
  $('#back-home').addEventListener('click',()=>location.hash='inicio');
  $('#previous-work').addEventListener('click',()=>go(state.activeId-1));
  $('#next-work').addEventListener('click',()=>go(state.activeId+1));
  $('#contact-button').addEventListener('click',contact);
  $('#login-form').addEventListener('submit',login);
  $('#edit-work-form').addEventListener('submit',saveWork);
  $('#edit-settings-form').addEventListener('submit',saveSettings);
  $('#edit-position').addEventListener('change',fillWorkForm);
  $('#tab-work').addEventListener('click',()=>setAdminTab('work'));
  $('#tab-settings').addEventListener('click',()=>setAdminTab('settings'));
  $('#logout').addEventListener('click',async()=>{
    try{await request('logout',{method:'POST'});}catch{}
    state.authenticated=false;closeDialog();showToast('Acesso encerrado.');
  });
  document.addEventListener('keydown',evt=>{
    if(evt.key==='Escape'&&state.currentDialog)closeDialog();
    if(!state.currentDialog&&!$('#gallery').hidden){
      if(evt.key==='ArrowLeft')go(state.activeId-1);
      if(evt.key==='ArrowRight')go(state.activeId+1);
    }
  });
  window.addEventListener('hashchange',openRoute);
  openRoute();
  loadData();
}
document.addEventListener('DOMContentLoaded',init);
})();
