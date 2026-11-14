/* MITS 1:1 — os SVGs da designer são o layout. Camadas JS: conteúdo e ações. */
(() => {
  'use strict';
  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];
  const S = 'http://www.w3.org/2000/svg';
  const mobileQuery = matchMedia('(max-width:740px) and (orientation:portrait)');
  const isMobile = () => mobileQuery.matches;
  const svgName = (part, status) => {
    const mode = state.theme === 'dark' ? 'escuro' : 'claro';
    const suffix = isMobile() ? '-mobile' : '';
    return part === 'capa' ? `expografia-capa-${mode}${suffix}.svg`
      : `expografia-ficha-${status === 'Indisponível' ? 'indisponivel' : 'disponivel'}-${mode}${suffix}.svg`;
  };
  const positions = {
    desktop: [[1271.33,883],[1223,700],[1324,549],[1223,395],[1223,188],[1304,134],[1393,188],[1499,134],[1569,188],[1560,390]],
    mobile: [[214.05,375.4],[194.7,296.4],[238.6,230.8],[194.8,163.8],[194.8,74],[229.9,50.6],[268.7,73.8],[314.1,50.6],[344.8,73.8],[341.3,161.6]]
  };
  const defaultSettings = {curator:'Curadoria de Lara Maia', artists:'Beatriz Lindenberg\nFyodor Pavlov-Andreevich\nAline Setton'};
  const defaultWork = i => ({id:i,artist:'Nome artista',title:'Nome obra',year:'Ano obra',price:'',technique:'Técnica obra',dimensions:'Dimensões obra',status:'Disponível',imageUpdatedAt:null});
  const state = {data:{settings:{...defaultSettings},artworks:Array.from({length:10},(_,i)=>defaultWork(i+1))},
    active:1,theme:'light',online:false,lastError:null,dialog:null};
  const allowedStatus = new Set(['Disponível','Reservada','Vendida','Indisponível']);
  const work = () => state.data.artworks.find(w => w.id === state.active) || defaultWork(state.active);
  const svgEl = (tag,attrs={}) => {const el=document.createElementNS(S,tag); for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
  const normalize = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  function msg(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(msg.timer);msg.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
  async function api(path,opts={}){
    let response;
    try {response=await fetch(`/api/${path}`,{cache:'no-store',credentials:'same-origin',...opts});}
    catch{throw Error('Não foi possível conectar ao Netlify.');}
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.error||`Erro ${response.status}`);
    return body;
  }
  async function refreshData(){
    try{
      const data=await api('data');
      if(!Array.isArray(data.artworks)||data.artworks.length!==10)throw Error('Catálogo incompleto.');
      state.data={settings:{...defaultSettings,...data.settings},artworks:data.artworks.map((x,i)=>({...defaultWork(i+1),...x,id:i+1}))};
      state.online=true;state.lastError=null;
      renderCapaContent();renderWork();return true;
    }catch(error){state.online=false;state.lastError=error.message;console.warn('API não disponível:',error.message);return false;}
  }
  async function loadSvg(name,target){
    const response=await fetch(`/assets/${name}`,{cache:'force-cache'});
    if(!response.ok)throw Error(`SVG não encontrado: ${name}`);
    const documentSvg=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
    if(documentSvg.querySelector('parsererror'))throw Error(`SVG inválido: ${name}`);
    const svg=document.importNode(documentSvg.documentElement,true);
    // Isolar classes do Illustrator para que as duas telas SVG não disputem .cls-N.
    const prefix=name.includes('capa')?'cap':'ficha';
    svg.querySelectorAll('[class]').forEach(node=>node.setAttribute('class',node.getAttribute('class').split(/\s+/).map(c=>`${prefix}-${c}`).join(' ')));
    svg.querySelectorAll('style').forEach(style=>style.textContent=style.textContent.replace(/\.cls-(\d+)/g,`.${prefix}-cls-$1`));
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    target.replaceChildren(svg);
    return svg;
  }
  function fitText(text,maxWidth,minSize){
    text.dataset.maxWidth=String(maxWidth);text.dataset.minSize=String(minSize);
    const update=()=>{
      if(!text.isConnected || $('#gallery').hidden)return;
      text.style.removeProperty('font-size');
      try{
        const actual=text.getComputedTextLength(), size=parseFloat(getComputedStyle(text).fontSize)||20;
        if(actual>maxWidth&&actual>0)text.style.fontSize=`${Math.max(minSize,size*maxWidth/actual)}px`;
      }catch{}
    };
    requestAnimationFrame(update);
    document.fonts?.ready?.then(()=>requestAnimationFrame(update));
  }
  function changeText(svg,placeholder,value,limit,minSize){
    const target=[...svg.querySelectorAll('text')].find(t=>normalize(t.textContent)===normalize(placeholder));
    if(!target)return;
    target.textContent=String(value||placeholder);
    fitText(target,limit,minSize);
  }
  function addPhoto(svg,entry,mobile){
    if(!entry.imageUpdatedAt)return;
    const frame=mobile?{x:167.38,y:479.61,w:194.33,h:242.91}:{x:455.67,y:82.33,w:504.33,h:630.42};
    const rect=[...svg.querySelectorAll('rect')].find(r=>Math.abs(Number(r.getAttribute('x'))-frame.x)<.08 && Math.abs(Number(r.getAttribute('y'))-frame.y)<.08);
    if(!rect)return;
    const image=svgEl('image',{x:frame.x,y:frame.y,width:frame.w,height:frame.h,preserveAspectRatio:'xMidYMid meet'});
    image.setAttribute('href',`/api/image/${entry.id}?v=${encodeURIComponent(entry.imageUpdatedAt)}`);
    rect.after(image);
  }
  function addStatus(svg,entry,mobile){
    if(entry.status==='Disponível'||entry.status==='Indisponível')return;
    const bg=state.theme==='dark'?'#000':'#ebebeb';
    const ink=state.theme==='dark'?'#ebebeb':'#000';
    const dims=mobile?{x:26,y:699,w:132,h:22,tx:30,ty:714,size:13}:{x:85,y:663,w:270,h:56,tx:103,ty:706,size:30};
    const group=svgEl('g',{'data-status':'true'});
    group.append(svgEl('rect',{x:dims.x,y:dims.y,width:dims.w,height:dims.h,fill:bg}));
    const t=svgEl('text',{x:dims.tx,y:dims.ty,style:`font-family:PPNeueMontreal-Thin,Arial,sans-serif;font-size:${dims.size}px;fill:${ink}`});t.textContent=entry.status;
    group.append(t);
    const box=svgEl('rect',{x:dims.tx-2,y:mobile?700:669,width:mobile?90:190,height:mobile?17:45,fill:'none',stroke:'#ffff00','stroke-width':mobile?1.8:5});
    group.append(box);svg.append(group);
    requestAnimationFrame(()=>{try{box.setAttribute('width',t.getComputedTextLength()+(mobile?8:18));}catch{}});
  }
  function findMapNumberPaths(svg,num,coords,mobile){
    const [cx,cy]=coords[num-1];
    if(!mobile){
      const group=[...svg.children].find(e=>e.localName==='g' && e.children.length===75);
      // Original desktop Illustrator group, number 2...10 after 38 leading paths.
      if(group && num>=2 && num<=10){
        const source=group.children[37+num];
        if(source && source.localName==='path')return [source];
      }
    }
    return [...svg.querySelectorAll('path')].filter(p=>{
      const b=p.getBBox();const px=b.x+b.width/2,py=b.y+b.height/2;
      return b.width>2&&b.width<(mobile?21:55)&&b.height>(mobile?12:22)&&b.height<(mobile?22:60)
        &&Math.abs(px-cx)<(mobile?20:50)&&Math.abs(py-cy)<(mobile?15:40);
    });
  }
  function addLargeNumber(svg,num,mobile){
    if(num===1)return;
    const bg=state.theme==='dark'?'#000':'#ebebeb';
    const ink=state.theme==='dark'?'#ebebeb':'#000';
    const group=svgEl('g',{'data-big-number':'true'});
    group.append(svgEl('rect',mobile?{x:25,y:474,width:113,height:50,fill:bg}:{x:75,y:68,width:190,height:154,fill:bg}));
    const sources=findMapNumberPaths(svg,num,positions[mobile?'mobile':'desktop'],mobile);
    if(sources.length){
      const x0=Math.min(...sources.map(s=>s.getBBox().x));
      const x1=Math.max(...sources.map(s=>s.getBBox().x+s.getBBox().width));
      const y0=Math.min(...sources.map(s=>s.getBBox().y));
      const y1=Math.max(...sources.map(s=>s.getBBox().y+s.getBBox().height));
      const scale=(mobile?42:112)/(y1-y0);
      const destX=mobile?28.5:95;
      const destY=mobile?477:82.33;
      const wrapping=svgEl('g',{transform:`translate(${destX-x0*scale} ${destY-y0*scale}) scale(${scale})`});
      for(const source of sources){
        const clone=source.cloneNode(true);clone.removeAttribute('id');
        [clone,...clone.querySelectorAll('*')].forEach(e=>{
          if(e.matches('path,polygon,rect,text,use')){
            e.style.setProperty('fill',ink,'important');e.style.setProperty('stroke','none','important');
          }
        });wrapping.append(clone);
      }
      group.append(wrapping);
    }else{
      const text=svgEl('text',{x:mobile?28:95,y:mobile?517:192,style:`font-family:PPNeueMontreal-Thin,Arial,sans-serif;font-size:${mobile?49:146}px;fill:${ink}`});text.textContent=String(num);group.append(text);
    }
    svg.append(group);
  }
  function highlightNumber(svg,num,mobile){
    if(num===1)return;
    const candidates=[...svg.querySelectorAll('rect')].filter(e=>Math.abs(Number(e.getAttribute('x'))-(mobile?200.92:1237.33))<.09 && Math.abs(Number(e.getAttribute('y'))-(mobile?361.02:849))<.09);
    let highlight=candidates[0];
    if(!highlight){
      highlight=[...svg.querySelectorAll('path')].find(p=>{const b=p.getBBox();return mobile
        ?b.x>198&&b.x<201&&b.y>359&&b.y<361&&b.width>29&&b.width<34&&b.height>29&&b.height<34
        :b.x>1233&&b.x<1236&&b.y>845&&b.y<849&&b.width>70&&b.width<75&&b.height>70&&b.height<75;});
    }
    if(!highlight)return;
    const [cx,cy]=positions[mobile?'mobile':'desktop'][num-1];
    const baseX=mobile?215.68:1271.33,baseY=mobile?375.78:883;
    const scaleX=num===10?(mobile?1.5:1.30):1;
    highlight.setAttribute('transform',`translate(${cx-baseX} ${cy-baseY}) translate(${baseX} ${baseY}) scale(${scaleX} 1) translate(${-baseX} ${-baseY})`);
  }
  function updateSvgWork(svg,entry){
    const mobile=isMobile(), limit=mobile?126:340;
    changeText(svg,'Nome artista',entry.artist,limit,mobile?8.5:20);
    changeText(svg,'Nome obra',entry.title,limit,mobile?8.5:19);
    changeText(svg,'Ano obra',entry.year,limit,mobile?8:17);
    changeText(svg,'Valor',entry.price||'Valor',limit,mobile?8:17);
    changeText(svg,'Tecnica obra',entry.technique,limit,mobile?7.5:16);
    changeText(svg,'Dimensoes obra',entry.dimensions,limit,mobile?7.5:16);
    addStatus(svg,entry,mobile);
    addLargeNumber(svg,entry.id,mobile);
    highlightNumber(svg,entry.id,mobile);
    addPhoto(svg,entry,mobile);
  }
  async function renderWork(){
    if($('#gallery').hidden)return;
    const entry=work();
    const file=svgName('ficha',entry.status);
    const target=$('#work-art');
    const token=JSON.stringify([file,entry]);
    if(target.dataset.token===token)return;
    target.dataset.token=token;
    try{
      const svg=await loadSvg(file,target);
      if(target.dataset.token!==token)return;
      updateSvgWork(svg,entry);
    }catch(error){console.error(error);msg(error.message);}
    document.title=`${entry.id}. ${entry.artist} — 1:1 | MITS`;
    $('#position').value=String(entry.id);
    $$('.map-hit').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.id)===entry.id)));
  }
  async function renderCapa(){
    const file=svgName('capa');
    const target=$('#home-art');
    if(target.dataset.source===file && target.querySelector('svg'))return;
    target.dataset.source=file;
    try{await loadSvg(file,target);if(target.dataset.source===file)renderCapaContent();}
    catch(error){console.error(error);msg(error.message);}
  }
  function renderCapaContent(){
    const svg=$('#home-art svg');if(!svg)return;
    const cfg=state.data.settings;
    const mobile=isMobile();
    const bg=state.theme==='dark'?'#000':'#ebebeb',ink=state.theme==='dark'?'#ebebeb':'#000';
    svg.querySelectorAll('[data-dynamic-home]').forEach(node=>node.remove());
    const group=svgEl('g',{'data-dynamic-home':'true'});
    if(!mobile){
      const curator=[...svg.querySelectorAll('text')].find(t=>t.textContent.includes('Curadoria')||t.dataset.curator==='true');
      if(curator){curator.dataset.curator='true';curator.textContent=cfg.curator||defaultSettings.curator;}
    } else if((cfg.curator||'')!==defaultSettings.curator){
      // Na versão mobile os créditos viraram contornos; esta camada aparece
      // somente se a equipe alterar a informação via administrador.
      group.append(svgEl('rect',{x:184,y:168,width:198,height:28,fill:bg}));
      const text=svgEl('text',{x:187,y:186,style:`font-family:PPNeueMontreal-Book,Arial,sans-serif;font-size:12px;fill:${ink}`});
      text.textContent=cfg.curator;group.append(text);fitText(text,195,8);
    }
    if((cfg.artists||'').trim()!==(defaultSettings.artists||'').trim()){
      const rect=mobile?{x:184,y:74,width:204,height:70,fill:bg}:{x:67,y:402,width:535,height:170,fill:bg};
      group.append(svgEl('rect',rect));
      const text=svgEl('text',{x:mobile?187:71,y:mobile?91:453,
        style:`font-family:PPNeueMontreal-Book,Arial,sans-serif;font-size:${mobile?12.5:32.5}px;fill:${ink}`});
      (cfg.artists||'').split('\n').slice(0,mobile?4:5).forEach((name,i)=>{
        const span=svgEl('tspan',{x:mobile?187:71,dy:i?(mobile?14:41):0});span.textContent=name;text.append(span);
      });
      group.append(text);
    }
    if(group.children.length)svg.append(group);
  }
  function createHotspots(){
    const host=$('#map-hotspots');
    for(let i=1;i<=10;i++){
      for(const device of ['desktop','mobile']){
        const mobile=device==='mobile',dims=mobile?[390,844]:[1920,1080];
        const [x,y]=positions[device][i-1];
        const btn=document.createElement('button');btn.className=`map-hit ${device}`;btn.type='button';btn.dataset.id=String(i);
        btn.style.left=`${x/dims[0]*100}%`;btn.style.top=`${y/dims[1]*100}%`;
        btn.style.width=`${(mobile?(i===10?37:29):(i===10?95:70))/dims[0]*100}%`;
        btn.style.height=`${(mobile?30:70)/dims[1]*100}%`;
        btn.setAttribute('aria-label',`Ver obra na posição ${i}`);
        btn.addEventListener('click',()=>go(i));host.append(btn);
      }
      const option=document.createElement('option');option.value=String(i);option.textContent=`Obra ${i}`;$('#position').append(option);
    }
  }
  function go(num){const id=((Number(num)-1+10)%10)+1;if(location.hash===`#obra-${id}`){state.active=id;renderWork();}else location.hash=`obra-${id}`;}
  function route(){const m=location.hash.match(/^#obra-(10|[1-9])$/);$('#home').hidden=!!m;$('#gallery').hidden=!m;if(m){state.active=Number(m[1]);renderWork();}else document.title='1:1 — MITS Galeria';window.scrollTo(0,0);}
  function applyTheme(mode){
    state.theme=mode==='dark'?'dark':'light';
    document.documentElement.classList.toggle('dark',state.theme==='dark');
    document.querySelector('meta[name="theme-color"]').content=state.theme==='dark'?'#000000':'#ebebeb';
    $$('.theme-toggle').forEach(btn=>{btn.title=btn.ariaLabel=state.theme==='dark'?'Ativar modo claro':'Ativar modo escuro';});
    try{localStorage.setItem('mits-theme',state.theme);}catch{}
    renderCapa();$('#work-art').dataset.token='';renderWork();
  }
  function closeDialog(){$('#overlay').hidden=true;$('#login-dialog').hidden=true;$('#editor-dialog').hidden=true;state.dialog=null;document.body.style.overflow='';}
  function showDialog(which){closeDialog();$('#overlay').hidden=false;$(`#${which}-dialog`).hidden=false;state.dialog=which;document.body.style.overflow='hidden';}
  async function openAdmin(){
    if(!state.online && !await refreshData()){msg(`A administração está indisponível: ${state.lastError||'API offline'}. Confira /api/data no Netlify.`);return;}
    try{const {authenticated}=await api('session');if(authenticated){openEditor();return;}}catch{}
    $('#login-form').reset();$('#login-error').hidden=true;showDialog('login');$('#admin-pass').focus();
  }
  function fillWork(){const entry=state.data.artworks[Number($('#position').value)-1]||work();
    for(const k of ['artist','title','year','price','technique','dimensions','status'])$(`#${k}`).value=entry[k]??'';
    $('#photo').value='';$('#remove-photo').checked=false;
    $('#image-note').textContent=entry.imageUpdatedAt?'Esta obra tem uma imagem cadastrada. Se não escolher outra, ela será mantida.':'Nenhuma fotografia cadastrada.';
  }
  function toggleTab(tab){const isWork=tab==='work';$('#edit-work').hidden=!isWork;$('#edit-exhibition').hidden=isWork;
    $('#tab-work').setAttribute('aria-selected',String(isWork));$('#tab-exhibition').setAttribute('aria-selected',String(!isWork));$('#save-message').textContent='';}
  function openEditor(){showDialog('editor');$('#position').value=String(state.active);fillWork();
    $('#curator').value=state.data.settings.curator||'';$('#artists-list').value=state.data.settings.artists||'';toggleTab('work');}
  async function login(event){event.preventDefault();const button=$('#login-form button[type=submit]');button.disabled=true;$('#login-error').hidden=true;
    try{await api('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#admin-pass').value})});$('#login-form').reset();openEditor();}
    catch(error){$('#login-error').textContent=error.message;$('#login-error').hidden=false;}finally{button.disabled=false;}}
  async function saveWork(event){event.preventDefault();const button=$('#save-work');button.disabled=true;$('#save-message').textContent='Salvando…';
    try{
      const f=new FormData($('#edit-work'));const id=Number(f.get('id'));
      const old=state.data.artworks[id-1];
      let imageUpdatedAt=old.imageUpdatedAt;
      const file=f.get('image');const remove=$('#remove-photo').checked;
      if(file instanceof File && file.size && !remove){
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use JPG, PNG ou WebP.');
        if(file.size>5*1024*1024)throw Error('A imagem deve ter no máximo 5 MB.');
        const upload=new FormData();upload.append('id',String(id));upload.append('image',file);
        const result=await api('upload',{method:'POST',body:upload});imageUpdatedAt=result.imageUpdatedAt;
      }
      const updated={id,artist:String(f.get('artist')||'').trim(),title:String(f.get('title')||'').trim(),
        year:String(f.get('year')||'').trim(),price:String(f.get('price')||'').trim(),
        technique:String(f.get('technique')||'').trim(),dimensions:String(f.get('dimensions')||'').trim(),
        status:String(f.get('status')),imageUpdatedAt:remove?null:imageUpdatedAt,removeImage:remove};
      if(!allowedStatus.has(updated.status))throw Error('Status inválido.');
      const {work:saved}=await api('save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'artwork',work:updated})});
      state.data.artworks[id-1]={...defaultWork(id),...saved};
      $('#save-message').textContent=`Obra ${id} atualizada. Valor: ${saved.price||'(não cadastrado)'}.`;
      fillWork();if(state.active===id){$('#work-art').dataset.token='';renderWork();}
    }catch(error){$('#save-message').textContent=`Não foi possível salvar: ${error.message}`;}
    finally{button.disabled=false;}
  }
  async function saveExhibition(event){event.preventDefault();const button=$('#save-exhibition');button.disabled=true;$('#save-message').textContent='Salvando…';
    try{const settings={curator:$('#curator').value.trim(),artists:$('#artists-list').value.trim()};
      const result=await api('save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'settings',settings})});
      state.data.settings=result.settings;renderCapaContent();$('#save-message').textContent='Exposição atualizada.';
    }catch(error){$('#save-message').textContent=`Não foi possível salvar: ${error.message}`;}finally{button.disabled=false;}
  }
  function init(){
    createHotspots();
    try{applyTheme(localStorage.getItem('mits-theme')||'light');}catch{applyTheme('light');}
    $$('.theme-toggle').forEach(b=>b.addEventListener('click',()=>applyTheme(state.theme==='dark'?'light':'dark')));
    $$('.admin-trigger').forEach(b=>b.addEventListener('click',openAdmin));
    $('#enter').addEventListener('click',()=>go(1));$('#previous').addEventListener('click',()=>go(state.active-1));$('#next').addEventListener('click',()=>go(state.active+1));
    $('#back-home').addEventListener('click',()=>location.hash='inicio');
    $('#overlay').addEventListener('click',e=>{if(e.target===$('#overlay'))closeDialog();});
    $$('[data-close]').forEach(b=>b.addEventListener('click',closeDialog));
    $('#login-form').addEventListener('submit',login);$('#edit-work').addEventListener('submit',saveWork);$('#edit-exhibition').addEventListener('submit',saveExhibition);
    $('#tab-work').addEventListener('click',()=>toggleTab('work'));
    $('#tab-exhibition').addEventListener('click',()=>toggleTab('exhibition'));
    $('#position').addEventListener('change',fillWork);
    $('#logout').addEventListener('click',async()=>{try{await api('logout',{method:'POST'});}catch{}closeDialog();msg('Acesso encerrado.');});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.dialog)closeDialog();if(!state.dialog&&!$('#gallery').hidden){if(e.key==='ArrowLeft')go(state.active-1);if(e.key==='ArrowRight')go(state.active+1);}});
    window.addEventListener('hashchange',route);
    const onViewChange=()=>{$('#home-art').dataset.source='';$('#work-art').dataset.token='';renderCapa();renderWork();};
    if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',onViewChange);else mobileQuery.addListener(onViewChange);
    route();refreshData();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
