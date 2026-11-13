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
const state={data:structuredClone(SEED),activeId:1,authenticated:false,online:false,currentDialog:null,theme:'light'};
// Coordenadas extraídas dos números desenhados na ficha vetorial, em 1920×1080.
const MAP_NUMBERS = [[1271.33,883],[1223,700],[1324,549],[1223,395],[1223,188],[1304,134],[1393,188],[1499,134],[1569,188],[1560,390]];
// Centros das posições numeradas, lidos do SVG de 390 x 844 da designer.
const MOBILE_MAP_NUMBERS = [[214.05,375.4],[194.7,296.4],[238.6,230.8],[194.8,163.8],[194.8,74.0],[229.9,50.6],[268.7,73.8],[314.1,50.6],[344.8,73.8],[341.3,161.6]];
const mobileQuery=window.matchMedia('(max-width:740px) and (orientation:portrait)');
const isMobile=()=>mobileQuery.matches;
const sourceSuffix=()=>isMobile()?'-mobile':'';
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
  const maxWidth=Number(target.dataset.fitMax||340); // respeita a coluna de texto do SVG escolhido
  try{
    target.style.removeProperty('font-size');
    const normalSize=parseFloat(getComputedStyle(target).fontSize)||40;
    const actual=target.getComputedTextLength();
    if(actual>maxWidth && actual>0){
      target.style.fontSize=`${Math.max(minimum,normalSize*maxWidth/actual)}px`;
    }
  }catch(error){console.warn('Falha ao ajustar o texto da obra:',error);}
}
function renderSvgText(svg,placeholder,value,min=18,max=340){
  const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
  const target=[...svg.querySelectorAll('text')].find(e=>normalize(e.textContent)===normalize(placeholder));
  if(!target)return;
  target.replaceChildren(document.createTextNode(String(value||'')));
  target.removeAttribute('textLength');
  target.removeAttribute('lengthAdjust');
  target.dataset.fitMin=String(min);
  target.dataset.fitMax=String(max);
  // Medição apenas quando o SVG está visível e a fonte foi carregada.
  requestAnimationFrame(()=>fitEditableSvgText(target));
  document.fonts.ready.then(()=>requestAnimationFrame(()=>fitEditableSvgText(target)));
}
function addImage(svg,work){
  const mobile=isMobile();
  const f=mobile?{x:167.64,y:473.69,w:193.9,h:242.37}:{x:455.67,y:82.33,w:504.33,h:630.42};
  const frame=[...svg.querySelectorAll('rect')].find(r=>Math.abs(Number(r.getAttribute('x'))-f.x)<.03 && Math.abs(Number(r.getAttribute('y'))-f.y)<.03);
  if(!frame || !work.imageUpdatedAt)return;
  const image=el('image',{x:f.x,y:f.y,width:f.w,height:f.h,preserveAspectRatio:'xMidYMid meet'});
  image.setAttribute('href',`/api/image/${work.id}?v=${encodeURIComponent(work.imageUpdatedAt)}`);
  frame.after(image);
}
/* Atualizações contidas dentro das áreas móveis que já existem no desenho original. */
function addMobileNumber(svg,work){
  if(work.id===1)return;
  const target=el('g',{'data-dynamic-number':'true'});
  target.append(el('rect',{x:25,y:470,width:111,height:50,fill:state.theme==='dark'?'#000':'#ebebeb'}));
  // Os algarismos foram convertidos em paths pelo Illustrator. Reutilizamos
  // exatamente os vetores da própria planta, ampliados para o campo do número.
  const [cx,cy]=MOBILE_MAP_NUMBERS[work.id-1];
  const candidates=[...svg.querySelectorAll('path')].filter(p=>{
    const b=p.getBBox();
    const cX=b.x+b.width/2,cY=b.y+b.height/2;
    return b.height>13&&b.height<20&&b.width>2&&b.width<20&&Math.abs(cY-cy)<14&&Math.abs(cX-cx)<19;
  });
  if(!candidates.length)return;
  const minX=Math.min(...candidates.map(e=>e.getBBox().x)), maxX=Math.max(...candidates.map(e=>{const b=e.getBBox();return b.x+b.width;}));
  const minY=Math.min(...candidates.map(e=>e.getBBox().y)), maxY=Math.max(...candidates.map(e=>{const b=e.getBBox();return b.y+b.height;}));
  const scale=42/(maxY-minY);
  const wrapper=el('g',{transform:`translate(${28.87-minX*scale} ${473.69-minY*scale}) scale(${scale})`});
  for(const source of candidates){const copy=source.cloneNode(true);copy.removeAttribute('id');copy.style.fill=state.theme==='dark'?'#ebebeb':'#000';copy.style.stroke='none';wrapper.append(copy);}
  target.append(wrapper);svg.append(target);
}
function updateMobileGallery(svg,work){
  renderSvgText(svg,'Nome artista',work.artist,8.5,126);
  renderSvgText(svg,'Nome obra',work.title,8.5,126);
  renderSvgText(svg,'Ano obra',work.year,8,126);
  renderSvgText(svg,'Tecnica obra',work.technique,7.5,127);
  renderSvgText(svg,'Dimensoes obra',work.dimensions,7.5,127);
  if(!['Disponível','Indisponível'].includes(work.status)){
    const bg=state.theme==='dark'?'#000':'#ebebeb';
    const txtfill=state.theme==='dark'?'#ebebeb':'#000';
    const g=el('g',{'data-dynamic-status':'true'});
    g.append(el('rect',{x:27,y:698,width:132,height:23,fill:bg}));
    const t=el('text',{x:30,y:714,style:`font-family:PPNeueMontreal-Thin,'PP Neue Montreal',Arial,sans-serif;font-size:13px;fill:${txtfill}`});
    t.textContent=work.status;
    g.append(t);
    const outline=el('rect',{x:28.5,y:700,width:59,height:16,fill:'none',stroke:'#ff0','stroke-width':1.8});
    g.append(outline);svg.append(g);
    requestAnimationFrame(()=>{try{outline.setAttribute('width',t.getComputedTextLength()+7);}catch{}});
  }
  addMobileNumber(svg,work);
  const [cx,cy]=MOBILE_MAP_NUMBERS[work.id-1];
  if(work.id!==1){
    let hi=[...svg.querySelectorAll('rect')].find(r=>Math.abs(Number(r.getAttribute('x'))-200.92)<.03&&Math.abs(Number(r.getAttribute('y'))-361.02)<.03);
    if(!hi)hi=[...svg.querySelectorAll('path')].find(p=>{const b=p.getBBox();return b.x>198&&b.x<201&&b.y>359&&b.y<361&&b.width>30&&b.width<34&&b.height>30&&b.height<34;});
    if(hi){
      const x0=215.68,y0=375.78;
      const wide=work.id===10?1.5:1;
      hi.setAttribute('transform',`translate(${cx-x0} ${cy-y0}) translate(${x0} ${y0}) scale(${wide} 1) translate(${-x0} ${-y0})`);
    }
  }
  addImage(svg,work);
}
function updateGallerySvg(svg,work){
  if(isMobile()){updateMobileGallery(svg,work);return;}
  renderSvgText(svg,'Nome artista',work.artist,20);
  renderSvgText(svg,'Nome obra',work.title,19);
  renderSvgText(svg,'Ano obra',work.year,17);
  renderSvgText(svg,'Técnica obra',work.technique,16);
  renderSvgText(svg,'Dimensões obra',work.dimensions,16);
  // Os dois arquivos originais conservam, inclusive, os dois estados ilustrados pela designer.
  // Para Reservada/Vendida, cobrimos SOMENTE o selo editável.
  if(!['Disponível','Indisponível'].includes(work.status)){
    const cover=el('rect',{x:85,y:663,width:255,height:56,fill:state.theme==='dark'?'#000':'#ebebeb'});
    const outline=el('rect',{x:92,y:669,width:190,height:45,fill:'none',stroke:'#ff0','stroke-width':5});
    const txt=el('text',{x:103,y:705,style:`font-family:PPNeueMontreal-Thin,'PP Neue Montreal',Arial,sans-serif;font-size:30px;font-weight:200;fill:${state.theme==='dark'?'#ebebeb':'#000'}`});
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
    g.append(el('rect',{x:75,y:68,width:190,height:154,fill:state.theme==='dark'?'#000':'#ebebeb'}));
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
  // Move o destaque vetorial original do número 1 para a posição selecionada.
  // No Illustrator, ele é retângulo (claro disponível) ou caminho composto
  // (claro indisponível e ambos escuros). Preservamos seu traço e suas cores.
  let highlight=[...svg.querySelectorAll('rect')].find(r=>r.getAttribute('x')==='1237.33' && r.getAttribute('y')==='849');
  if(!highlight) highlight=[...svg.querySelectorAll('path')].find(p=>{
    try{const b=p.getBBox();return b.x>1233&&b.x<1236&&b.y>845&&b.y<849&&b.width>70&&b.width<75&&b.height>70&&b.height<75;}
    catch{return false;}
  });
  if(highlight && work.id!==1){
    const [x,y]=MAP_NUMBERS[work.id-1];
    const scale=work.id===10?1.30:1;
    const srcX=1271.33,srcY=883;
    highlight.setAttribute('transform',`translate(${x-srcX} ${y-srcY}) translate(${srcX} ${srcY}) scale(${scale} 1) translate(${-srcX} ${-srcY})`);
  }
  addImage(svg,work);
}
async function renderWork(){
  if($('#gallery').hidden)return;
  const work=position(state.activeId);
  if(!work)return;
  const base=work.status==='Indisponível'?'indisponivel':'disponivel';
  const file=`expografia-ficha-${base}-${state.theme==='dark'?'escuro':'claro'}${sourceSuffix()}.svg`;
  const container=$('#gallery-svg-container');
  const ticket=`${state.theme}:${work.id}:${work.imageUpdatedAt}:${work.artist}:${work.title}:${work.status}:${work.year}:${work.technique}:${work.dimensions}`;
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
    group.append(el('rect',{x:67,y:403,width:535,height:168,fill:state.theme==='dark'?'#000':'#ebebeb'}));
    const t=el('text',{x:71,y:453,style:`font-family:PPNeueMontreal-Book,'PP Neue Montreal',Arial,sans-serif;fill:${state.theme==='dark'?'#ebebeb':'#000'};font-size:32.5px`});
    (cfg.artists||'').split('\n').slice(0,5).forEach((s,i)=>{const span=el('tspan',{x:71,dy:i?'41':'0'});span.textContent=s;t.append(span)});
    group.append(t);svg.append(group);
  }
}
function createHotspots(){
  const host=$('#plan-hotspots');
  for(let index=0;index<10;index++){
    for(const [layout,numbers,w,h] of [['desktop',MAP_NUMBERS,1920,1080],['mobile',MOBILE_MAP_NUMBERS,390,844]]){
      const [x,y]=numbers[index];
      const btn=document.createElement('button');
      btn.type='button';btn.className=`map-hit ${layout}`;btn.dataset.id=String(index+1);
      const width=layout==='mobile'?(index===9?37:29):(index===9?95:70);
      const height=layout==='mobile'?30:70;
      btn.style.left=`${x/w*100}%`;
      btn.style.top=`${y/h*100}%`;
      btn.style.width=`${width/w*100}%`;
      btn.style.height=`${height/h*100}%`;
      btn.setAttribute('aria-label',`Ver obra na posição ${index+1}`);
      btn.addEventListener('click',()=>go(index+1));host.append(btn);
    }
    const opt=document.createElement('option');opt.value=String(index+1);opt.textContent=`Obra ${index+1}`;$('#edit-position').append(opt);
  }
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
async function renderHomeSvg(){
  const container=$('#home-svg-container');
  const file=`expografia-capa-${state.theme==='dark'?'escuro':'claro'}${sourceSuffix()}.svg`;
  if(container.dataset.source===file && container.querySelector('svg'))return;
  container.dataset.source=file;
  try{
    await loadSvg(file,container);
    if(container.dataset.source===file)renderSettings();
  }catch(error){console.error(error);showToast('Erro ao carregar o SVG da capa.');}
}
function applyTheme(theme){
  state.theme=theme==='dark'?'dark':'light';
  document.documentElement.classList.toggle('dark',state.theme==='dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',state.theme==='dark'?'#000000':'#ebebeb');
  try{localStorage.setItem('mits-theme',state.theme);}catch{}
  renderHomeSvg();
  $('#gallery-svg-container').dataset.ticket='';
  renderWork();
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
  try{applyTheme(localStorage.getItem('mits-theme')||'light');}catch{applyTheme('light');}
  $$('.theme-switch').forEach(button=>button.addEventListener('click',()=>applyTheme(state.theme==='dark'?'light':'dark')));
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
  const onLayoutChange=()=>{
    $('#home-svg-container').dataset.source='';
    $('#gallery-svg-container').dataset.ticket='';
    renderHomeSvg();renderWork();
  };
  if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',onLayoutChange);
  else mobileQuery.addListener(onLayoutChange);
  openRoute();
  loadData();
}
document.addEventListener('DOMContentLoaded',init);
})();
