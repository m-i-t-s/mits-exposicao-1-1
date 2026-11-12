/**
 * MITS 1:1 — API Netlify Functions
 * Armazena fichas e imagens no Netlify Blobs (persistentes entre deploys).
 * A senha e o segredo de sessão só existem nas variáveis de ambiente do Netlify.
 */
import { getStore } from '@netlify/blobs';
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';

export const config = { path: '/api/*' };

const ARTWORK_COUNT = 10;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SESSION_SECONDS = 8 * 60 * 60;
const ALLOWED_STATUSES = new Set(['Disponível', 'Reservada', 'Vendida', 'Indisponível']);
const DEFAULT_SETTINGS = {
  curator: 'Curadoria de Lara Maia',
  artists: 'Beatriz Lindenberg\nFyodor Pavlov-Andreevich\nAline Setton',
  contactEmail: ''
};
const CONTENT_STORE = 'mits-1-1-content';
const IMAGE_STORE = 'mits-1-1-images';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, { status, headers: { ...headers, ...extraHeaders } });
}
function bad(message, status = 400) { return json({ error: message }, status); }
function getContent() { return getStore(CONTENT_STORE); }
function getImages() { return getStore(IMAGE_STORE); }
function baseWork(id) {
  return { id, artist: 'Nome artista', title: 'Nome obra', year: 'Ano obra',
    technique: 'Técnica obra', dimensions: 'Dimensões obra', status: 'Disponível', imageUpdatedAt: null };
}
function isValidId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= ARTWORK_COUNT;
}
function strongCompare(a, b) {
  const digestA = createHash('sha256').update(String(a)).digest();
  const digestB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(digestA, digestB);
}
function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET não configurado');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
function cookie(request) {
  const pairs = (request.headers.get('cookie') || '').split(';');
  const pair = pairs.find(s => s.trim().startsWith('mits_session='));
  return pair ? pair.trim().slice('mits_session='.length) : '';
}
function authenticated(request) {
  try {
    const token = cookie(request);
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded.scope === 'mits-admin' && Number(decoded.exp) > Date.now() && decoded.v === 1;
  } catch { return false; }
}
function sessionCookie(request, token, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `mits_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${maxAge}${secure}`;
}
function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
function checkPost(request) {
  if (request.method !== 'POST') return bad('Método não permitido.', 405);
  if (!requireSameOrigin(request)) return bad('Origem não permitida.', 403);
  if (!authenticated(request)) return bad('Acesso restrito. Entre com a senha.', 401);
  return null;
}
function smallString(value, field, max) {
  if (typeof value !== 'string' || value.length > max) throw new RangeError(`${field} inválido ou longo demais.`);
  return value.trim();
}
async function parseJSON(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 16000) throw new RangeError('Dados excedem o tamanho permitido.');
  const body = await request.text();
  if (body.length > 16000) throw new RangeError('Dados excedem o tamanho permitido.');
  return JSON.parse(body);
}
async function data() {
  const store = getContent();
  const records = await Promise.all([
    store.get('settings', { type: 'json', consistency: 'strong' }),
    ...Array.from({ length: ARTWORK_COUNT }, (_, i) => store.get(`artwork-${i+1}`, { type: 'json', consistency: 'strong' }))
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...(records[0] || {}) };
  const artworks = records.slice(1).map((record, i) => ({ ...baseWork(i+1), ...(record || {}), id: i + 1 }));
  return json({ settings, artworks });
}
async function login(request) {
  if (request.method !== 'POST') return bad('Método não permitido.', 405);
  if (!requireSameOrigin(request)) return bad('Origem não permitida.', 403);
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD.length < 12 || process.env.SESSION_SECRET.length < 32) {
    return bad('Acesso administrativo ainda não configurado pelo responsável.', 503);
  }
  let input;
  try { input = await parseJSON(request); } catch { return bad('Requisição inválida.'); }
  if (typeof input.password !== 'string' || !strongCompare(input.password, process.env.ADMIN_PASSWORD)) {
    return bad('Senha incorreta.', 401);
  }
  const payload = Buffer.from(JSON.stringify({scope:'mits-admin', exp: Date.now()+ SESSION_SECONDS*1000, v:1, n:randomBytes(10).toString('hex')})).toString('base64url');
  return json({ authenticated:true }, 200, { 'Set-Cookie':sessionCookie(request, `${payload}.${sign(payload)}`, SESSION_SECONDS) });
}
async function save(request) {
  const failed = checkPost(request);
  if (failed) return failed;
  let input;
  try { input = await parseJSON(request); }
  catch { return bad('JSON inválido.'); }
  try {
    const store = getContent();
    if (input.type === 'settings') {
      const settings = input.settings || {};
      const output = {
        curator: smallString(settings.curator, 'Curadoria', 240),
        artists: smallString(settings.artists, 'Artistas', 1500),
        contactEmail: smallString(settings.contactEmail, 'E-mail', 240)
      };
      if (output.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(output.contactEmail)) return bad('E-mail inválido.');
      await store.setJSON('settings', output);
      return json({settings:output});
    }
    if (input.type !== 'artwork') return bad('Tipo de edição inválido.');
    const work = input.work || {};
    if (!isValidId(work.id)) return bad('Número de obra inválido.');
    if (!ALLOWED_STATUSES.has(work.status)) return bad('Status inválido.');
    const id = Number(work.id);
    let imageUpdatedAt = null;
    if (!work.removeImage && work.imageUpdatedAt !== null && work.imageUpdatedAt !== undefined) {
      if (typeof work.imageUpdatedAt !== 'string' || !/^[a-z0-9-]{10,80}$/.test(work.imageUpdatedAt)) return bad('Identificador de imagem inválido.');
      imageUpdatedAt = work.imageUpdatedAt;
      const meta = await getImages().getMetadata(`artwork-${id}/${imageUpdatedAt}`, {consistency:'strong'});
      if (!meta) return bad('Imagem ainda não encontrada no armazenamento. Tente reenviar.');
    }
    const output = {
      id, artist:smallString(work.artist, 'Artista',180),title:smallString(work.title,'Título',240),
      year:smallString(work.year,'Ano',80),technique:smallString(work.technique,'Técnica',400),
      dimensions:smallString(work.dimensions,'Dimensões',200),status:work.status,
      imageUpdatedAt
    };
    if (!output.artist || !output.title) return bad('Artista e título são obrigatórios.');
    await store.setJSON(`artwork-${id}`, output);
    return json({work:output});
  } catch (error) {
    if (error instanceof RangeError) return bad(error.message);
    throw error;
  }
}
function magicMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0,4).toString('ascii') === 'RIFF' && buffer.subarray(8,12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
async function upload(request) {
  const failed = checkPost(request);
  if (failed) return failed;
  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > MAX_UPLOAD_BYTES + 60000) return bad('Imagem excede 5 MB.', 413);
  let form;
  try { form = await request.formData(); } catch { return bad('Envio de arquivo inválido.'); }
  const id = form.get('id');
  const file = form.get('image');
  if (!isValidId(id)) return bad('Número da obra inválido.');
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_UPLOAD_BYTES) return bad('Selecione uma imagem de até 5 MB.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = magicMime(buffer);
  if (!mime || mime !== file.type) return bad('Use uma imagem JPG, PNG ou WebP válida.');
  const imageUpdatedAt = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}`;
  await getImages().set(`artwork-${Number(id)}/${imageUpdatedAt}`,buffer,{metadata:{contentType:mime}});
  return json({imageUpdatedAt});
}
async function image(request, id) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return bad('Método não permitido.',405);
  if (!isValidId(id)) return bad('Número de obra inválido.',404);
  const work = await getContent().get(`artwork-${Number(id)}`, {type:'json',consistency:'strong'});
  if (!work?.imageUpdatedAt) return bad('Imagem não cadastrada.',404);
  const v = new URL(request.url).searchParams.get('v');
  if (v && v !== work.imageUpdatedAt) return bad('Imagem não encontrada.',404);
  const blob = await getImages().getWithMetadata(`artwork-${Number(id)}/${work.imageUpdatedAt}`, {type:'arrayBuffer',consistency:'strong'});
  if (!blob) return bad('Imagem não encontrada.',404);
  const contentType = blob.metadata?.contentType || 'application/octet-stream';
  return new Response(request.method === 'HEAD' ? null : blob.data, {
    status:200,
    headers:{'Content-Type':contentType,'X-Content-Type-Options':'nosniff', 'Cache-Control':v?'public,max-age=31536000,immutable':'public,max-age=60'}
  });
}

export default async function handler(request) {
  try {
    const pieces = new URL(request.url).pathname.split('/').filter(Boolean);
    const route = pieces[1];
    if (route === 'data' && request.method === 'GET') return await data();
    if (route === 'session' && request.method === 'GET') return json({authenticated:authenticated(request)});
    if (route === 'login') return await login(request);
    if (route === 'logout') {
      if (request.method !== 'POST') return bad('Método não permitido.',405);
      if (!requireSameOrigin(request)) return bad('Origem não permitida.',403);
      return json({authenticated:false},200,{'Set-Cookie':sessionCookie(request,'',0)});
    }
    if (route === 'save') return await save(request);
    if (route === 'upload') return await upload(request);
    if (route === 'image' && pieces.length === 3) return await image(request, pieces[2]);
    return bad('Endereço não encontrado.',404);
  } catch (error) {
    console.error('[MITS API]',error);
    return bad('Erro temporário no servidor. Tente novamente.',500);
  }
}
