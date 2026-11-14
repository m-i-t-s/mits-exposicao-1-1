/* Netlify Functions para o catálogo MITS 1:1. Requer @netlify/blobs. */
import {getStore} from '@netlify/blobs';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const config={path:'/api/*'};
const WORKS=10,MAX_IMAGE=5*1024*1024,SESSION_LIFETIME=8*60*60;
const STATUSES=new Set(['Disponível','Reservada','Vendida','Indisponível']);
const DEFAULTS={curator:'Curadoria de Lara Maia',artists:'Beatriz Lindenberg\nFyodor Pavlov-Andreevich\nAline Setton'};
const CONTENT='mits-1-1-content',IMAGES='mits-1-1-images';
const workDefault=id=>({id,artist:'Nome artista',title:'Nome obra',year:'Ano obra',price:'',technique:'Técnica obra',dimensions:'Dimensões obra',status:'Disponível',imageUpdatedAt:null});
const reply=(data,status=200,head={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...head}});
const fail=(error,status=400)=>reply({error},status);
const content=()=>getStore(CONTENT),images=()=>getStore(IMAGES);
const validID=x=>Number.isInteger(Number(x))&&Number(x)>=1&&Number(x)<=WORKS;
function eq(a,b){const x=createHash('sha256').update(String(a)).digest(),y=createHash('sha256').update(String(b)).digest();return timingSafeEqual(x,y);}
function sign(v){if(!process.env.SESSION_SECRET)throw Error('SESSION_SECRET ausente');return createHmac('sha256',process.env.SESSION_SECRET).update(v).digest('base64url');}
function sessionCookie(request,value,maxAge){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';return `mits_session=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${secure}`;}
function hasSession(request){
  try{const pair=(request.headers.get('cookie')||'').split(';').find(x=>x.trim().startsWith('mits_session='));
    if(!pair)return false;const token=pair.trim().slice('mits_session='.length);const [encoded,sig,extra]=token.split('.');if(!encoded||!sig||extra)return false;
    const expected=sign(encoded),a=Buffer.from(sig),b=Buffer.from(expected);
    if(a.length!==b.length||!timingSafeEqual(a,b))return false;
    const data=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
    return data.scope==='mits-admin'&&data.v===1&&data.exp>Date.now();
  }catch{return false;}
}
function sameOrigin(request){const o=request.headers.get('origin');return !o||o===new URL(request.url).origin;}
function requireEditor(request){if(request.method!=='POST')return fail('Método não permitido.',405);if(!sameOrigin(request))return fail('Origem não permitida.',403);if(!hasSession(request))return fail('Acesso restrito.',401);return null;}
function asText(x,label,max){if(typeof x!=='string'||x.length>max)throw new RangeError(`${label} muito longo ou inválido.`);return x.trim();}
async function bodyJSON(request){const length=Number(request.headers.get('content-length')||0);if(length>16000)throw new RangeError('Dados muito extensos.');const txt=await request.text();if(txt.length>16000)throw new RangeError('Dados muito extensos.');return JSON.parse(txt);}
async function getData(){const store=content();const records=await Promise.all([
  store.get('settings',{type:'json',consistency:'strong'}),
  ...Array.from({length:WORKS},(_,i)=>store.get(`artwork-${i+1}`,{type:'json',consistency:'strong'}))
]);return reply({settings:{...DEFAULTS,...(records[0]||{})},artworks:records.slice(1).map((v,i)=>({...workDefault(i+1),...(v||{}),id:i+1}))});}
async function login(request){
 if(request.method!=='POST')return fail('Método não permitido.',405);
 if(!sameOrigin(request))return fail('Origem não permitida.',403);
 if(!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET||process.env.ADMIN_PASSWORD.length<12||process.env.SESSION_SECRET.length<32)return fail('As variáveis ADMIN_PASSWORD e SESSION_SECRET precisam ser configuradas no Netlify.',503);
 let input;try{input=await bodyJSON(request);}catch{return fail('Requisição inválida.');}
 if(typeof input.password!=='string'||!eq(input.password,process.env.ADMIN_PASSWORD))return fail('Senha incorreta.',401);
 const payload=Buffer.from(JSON.stringify({scope:'mits-admin',v:1,exp:Date.now()+SESSION_LIFETIME*1000,nonce:randomBytes(12).toString('hex')})).toString('base64url');
 return reply({authenticated:true},200,{'Set-Cookie':sessionCookie(request,`${payload}.${sign(payload)}`,SESSION_LIFETIME)});
}
async function save(request){
 const denied=requireEditor(request);if(denied)return denied;
 let input;try{input=await bodyJSON(request);}catch{return fail('JSON inválido.');}
 try{
  const store=content();
  if(input.type==='settings'){
   const cfg=input.settings||{};
   const updated={curator:asText(cfg.curator,'Curadoria',240),artists:asText(cfg.artists,'Artistas',1500)};
   await store.setJSON('settings',updated);return reply({settings:updated});
  }
  if(input.type!=='artwork')return fail('Tipo de edição inválido.');
  const w=input.work||{};
  if(!validID(w.id))return fail('Número da obra inválido.');
  if(!STATUSES.has(w.status))return fail('Status inválido.');
  const id=Number(w.id);
  const existing=await store.get(`artwork-${id}`,{type:'json',consistency:'strong'})||workDefault(id);
  // Não sobrescrever imagem com ID de outra posição e evitar perder dados em edições antigas.
  let imageUpdatedAt=null;
  if(!w.removeImage && w.imageUpdatedAt!=null){
   if(typeof w.imageUpdatedAt!=='string'|| !/^[a-z0-9-]{10,80}$/.test(w.imageUpdatedAt))return fail('Identificador de imagem inválido.');
   const meta=await images().getMetadata(`artwork-${id}/${w.imageUpdatedAt}`);
   if(!meta)return fail('Imagem não encontrada. Reenvie a fotografia.');
   imageUpdatedAt=w.imageUpdatedAt;
  }
  const updated={id,
   artist:asText(w.artist,'Artista',180),title:asText(w.title,'Título',240),
   year:asText(w.year,'Ano',80),price:asText(w.price??existing.price??'','Valor',120),
   technique:asText(w.technique,'Técnica',400),dimensions:asText(w.dimensions,'Dimensões',200),
   status:w.status,imageUpdatedAt};
  if(!updated.artist||!updated.title)return fail('Artista e título são obrigatórios.');
  await store.setJSON(`artwork-${id}`,updated);return reply({work:updated});
 }catch(e){if(e instanceof RangeError)return fail(e.message);throw e;}
}
function imageMime(b){
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b.length>=12&&b.subarray(0,4).toString('ascii')==='RIFF'&&b.subarray(8,12).toString('ascii')==='WEBP')return 'image/webp';
 return null;
}
async function upload(request){const denied=requireEditor(request);if(denied)return denied;
 const declared=Number(request.headers.get('content-length')||0);if(declared>MAX_IMAGE+60000)return fail('Imagem maior que 5 MB.',413);
 let form;try{form=await request.formData();}catch{return fail('Arquivo inválido.');}
 const id=form.get('id'),photo=form.get('image');if(!validID(id))return fail('Posição inválida.');
 if(!(photo instanceof File)||photo.size<1||photo.size>MAX_IMAGE)return fail('Escolha uma fotografia de até 5 MB.');
 const bytes=Buffer.from(await photo.arrayBuffer()),mime=imageMime(bytes);
 if(mime!==photo.type||!mime)return fail('Use uma imagem JPG, PNG ou WebP válida.');
 const imageUpdatedAt=`${Date.now().toString(36)}-${randomBytes(8).toString('hex')}`;
 await images().set(`artwork-${Number(id)}/${imageUpdatedAt}`,bytes,{metadata:{contentType:mime}});
 return reply({imageUpdatedAt});
}
async function getImage(request,id){
 if(!['GET','HEAD'].includes(request.method))return fail('Método não permitido.',405);
 if(!validID(id))return fail('Posição inválida.',404);
 const w=await content().get(`artwork-${Number(id)}`,{type:'json',consistency:'strong'});
 if(!w?.imageUpdatedAt)return fail('Fotografia não cadastrada.',404);
 const v=new URL(request.url).searchParams.get('v');if(v && v!==w.imageUpdatedAt)return fail('Fotografia não encontrada.',404);
 const blob=await images().getWithMetadata(`artwork-${Number(id)}/${w.imageUpdatedAt}`,{type:'arrayBuffer',consistency:'strong'});
 if(!blob)return fail('Fotografia não encontrada.',404);
 return new Response(request.method==='HEAD'?null:blob.data,{status:200,headers:{'Content-Type':blob.metadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':v?'public,max-age=31536000,immutable':'public,max-age=60'}});
}
export default async function handler(request){
 try{
  const parts=new URL(request.url).pathname.split('/').filter(Boolean),route=parts[1];
  if(route==='data'&&request.method==='GET')return await getData();
  if(route==='session'&&request.method==='GET')return reply({authenticated:hasSession(request)});
  if(route==='login')return await login(request);
  if(route==='logout'){
   if(request.method!=='POST')return fail('Método não permitido.',405);
   if(!sameOrigin(request))return fail('Origem não permitida.',403);
   return reply({authenticated:false},200,{'Set-Cookie':sessionCookie(request,'',0)});
  }
  if(route==='save')return await save(request);
  if(route==='upload')return await upload(request);
  if(route==='image'&&parts.length===3)return await getImage(request,parts[2]);
  return fail('Endereço não encontrado.',404);
 }catch(error){console.error('[MITS 1:1 API]',error);return fail('Erro no servidor. Confira os logs da Function API no Netlify.',500);}
}
