// Colección de stickers de cada persona.
// - El archivo se guarda CIFRADO en el bucket privado "stickers" (carpeta = id de la persona).
// - Sus datos (llave del archivo, tipo, tamaño) también van cifrados, con una llave que solo
//   se puede calcular en este celular (a partir de la llave privada de la persona).
// - El servidor no puede ver los stickers.
import { supabase } from './supabase';
import { decryptFile, decryptJSONConRespaldo, encryptFile, encryptJSON, getChatKey, getLocalPrivateKey, llavesAnterioresPropias } from './crypto';

export interface MetaSticker {
  key: string; // llave AES del archivo (base64)
  mime: string;
  w: number;
  h: number;
  anim: boolean; // animado (GIF / WebP animado)
  hash: string; // para no guardar el mismo sticker dos veces
  huella?: string; // "huella visual": detecta el mismo sticker aunque el archivo sea distinto
}

export interface Sticker {
  id: string;
  path: string;
  meta: MetaSticker;
}

const TAM = 512; // tamaño de los stickers de WhatsApp
const MAX_ANIMADO = 1.5 * 1024 * 1024;

// ---------- Llave de la colección ----------
async function llaveColeccion(userId: string, miLlavePublica: unknown): Promise<CryptoKey> {
  const priv = await getLocalPrivateKey(userId);
  if (!priv || !miLlavePublica) throw new Error('Falta tu llave de cifrado en este celular.');
  // ECDH de mi llave privada con mi propia llave pública: solo yo la puedo calcular
  return getChatKey(`stickers:${userId}`, priv, miLlavePublica as JsonWebKey);
}

// ---------- Memoria ----------
let coleccion: { userId: string; lista: Sticker[] } | null = null;
const urls = new Map<string, string>();
const blobs = new Map<string, Blob>();
const avisos = new Set<() => void>();
const avisar = () => avisos.forEach((f) => f());

export function alCambiarColeccion(f: () => void) {
  avisos.add(f);
  return () => avisos.delete(f);
}

export const coleccionEnMemoria = (userId: string) => (coleccion?.userId === userId ? coleccion.lista : null);

/** Lee la colección (la primera vez del servidor; después de la memoria). */
export async function cargarColeccion(userId: string, miLlavePublica: unknown, forzar = false): Promise<Sticker[]> {
  if (!forzar && coleccion?.userId === userId) return coleccion.lista;
  const llave = await llaveColeccion(userId, miLlavePublica);
  const { data, error } = await supabase
    .from('stickers')
    .select('id, path, meta, iv')
    .order('used_at', { ascending: false });
  if (error) throw error;
  const lista: Sticker[] = [];
  const viejas = await llavesAnterioresPropias(`stickers:${userId}`, userId).catch(() => []);
  for (const r of data ?? []) {
    try {
      lista.push({ id: r.id, path: r.path, meta: await decryptJSONConRespaldo<MetaSticker>(llave, viejas, r.meta, r.iv) });
    } catch {
      /* uno dañado no impide ver los demás */
    }
  }
  coleccion = { userId, lista };
  avisar();
  return lista;
}

/** El archivo del sticker ya descifrado (con copia en memoria). */
export async function blobSticker(s: Sticker): Promise<Blob> {
  const b = blobs.get(s.id);
  if (b) return b;
  const { data, error } = await supabase.storage.from('stickers').download(s.path);
  if (error || !data) throw new Error('No se pudo abrir el sticker');
  const plano = await decryptFile(data, s.meta.key, s.meta.mime);
  blobs.set(s.id, plano);
  return plano;
}

export async function urlSticker(s: Sticker): Promise<string> {
  const u = urls.get(s.id);
  if (u) return u;
  const nueva = URL.createObjectURL(await blobSticker(s));
  urls.set(s.id, nueva);
  return nueva;
}

// ---------- Preparar una imagen como sticker ----------
const leerTipo = (b: Uint8Array): string | null => {
  const txt = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (txt(0, 4) === 'GIF8') return 'image/gif';
  if (txt(0, 4) === 'RIFF' && txt(8, 4) === 'WEBP') return 'image/webp';
  if (b[0] === 0x89 && txt(1, 3) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  return null;
};

// WebP animado: bandera de animación en el encabezado VP8X
const webpAnimado = (b: Uint8Array) =>
  String.fromCharCode(...b.slice(12, 16)) === 'VP8X' && (b[20] & 0x02) !== 0;

async function medir(blob: Blob): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { w: img.naturalWidth || TAM, h: img.naturalHeight || TAM };
  } finally {
    URL.revokeObjectURL(url);
  }
}

let webpOk: boolean | null = null;
const puedeWebp = () => {
  if (webpOk === null) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpOk = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpOk; // Safari (iPhone) no sabe crear WebP: se usa PNG, que también guarda la transparencia
};

const sha256 = async (b: ArrayBuffer) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), (x) => x.toString(16).padStart(2, '0')).join('');

export async function prepararSticker(entrada: Blob): Promise<{ blob: Blob; meta: Omit<MetaSticker, 'key'> }> {
  const bytes = new Uint8Array(await entrada.slice(0, 64).arrayBuffer());
  const tipo = leerTipo(bytes) || entrada.type;
  if (!tipo.startsWith('image/')) throw new Error('Eso no es una imagen.');
  const animado = tipo === 'image/gif' || (tipo === 'image/webp' && webpAnimado(bytes));

  if (animado) {
    // Los animados se guardan tal cual (si se cambian de tamaño pierden la animación)
    if (entrada.size > MAX_ANIMADO) throw new Error('Ese sticker animado pesa más de 1,5 MB.');
    const blob = new Blob([await entrada.arrayBuffer()], { type: tipo });
    const { w, h } = await medir(blob).catch(() => ({ w: TAM, h: TAM }));
    return { blob, meta: { mime: tipo, w, h, anim: true, hash: await sha256(await blob.arrayBuffer()) } };
  }

  // Fijos: máximo 512 px, conservando el fondo transparente
  const url = URL.createObjectURL(entrada);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, TAM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const mime = puedeWebp() ? 'image/webp' : 'image/png';
    const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo preparar'))), mime, 0.9));
    return { blob, meta: { mime, w, h, anim: false, hash: await sha256(await blob.arrayBuffer()) } };
  } catch {
    throw new Error('No se pudo leer esa imagen.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Huella visual (para encontrar repetidos) ----------
// Se achica la imagen a 32×32 en grises (lo transparente cuenta como gris) y se guarda.
// Dos stickers son el mismo si casi ningún punto cambia mucho, aunque vengan de archivos distintos.
const LADO_HUELLA = 32;

export async function huellaVisual(b: Blob): Promise<string> {
  const url = URL.createObjectURL(b);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = LADO_HUELLA;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, LADO_HUELLA, LADO_HUELLA);
    const d = ctx.getImageData(0, 0, LADO_HUELLA, LADO_HUELLA).data;
    const v = new Uint8Array(LADO_HUELLA * LADO_HUELLA);
    for (let i = 0; i < v.length; i++) {
      const a = d[i * 4 + 3] / 255;
      const luz = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
      v[i] = Math.round(luz * a + 127 * (1 - a));
    }
    // La forma (ancho/alto) va adelante para no confundir un sticker cuadrado con uno alargado
    const forma = Math.round((img.naturalWidth / Math.max(1, img.naturalHeight)) * 10);
    let bin = '';
    v.forEach((x) => (bin += String.fromCharCode(x)));
    return `${forma}:${btoa(bin)}`;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const vectores = new Map<string, Uint8Array>();
function vector(h: string): Uint8Array {
  let v = vectores.get(h);
  if (!v) {
    const bin = atob(h.slice(h.indexOf(':') + 1));
    v = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    vectores.set(h, v);
  }
  return v;
}

/** Cuántos puntos cambian mucho entre dos huellas (0 = idénticas) */
function diferencia(a: string, b: string): number {
  if (a.slice(0, a.indexOf(':')) !== b.slice(0, b.indexOf(':'))) return Infinity;
  const va = vector(a);
  const vb = vector(b);
  if (va.length !== vb.length) return Infinity;
  let n = 0;
  for (let i = 0; i < va.length; i++) if (Math.abs(va[i] - vb[i]) > 48) n++;
  return n;
}

const PARECIDOS = 3; // hasta 3 puntos de 1024 = el mismo sticker (un cambio pequeño, como un texto, da 10 o más)

const esRepetido = (a: MetaSticker, b: Omit<MetaSticker, 'key'>) =>
  a.hash === b.hash || (!!a.huella && !!b.huella && a.anim === b.anim && diferencia(a.huella, b.huella) <= PARECIDOS);

// ---------- Agregar / quitar / usar ----------
/** Agrega un sticker a la colección. Si ya estaba, devuelve el que existe. */
export async function agregarSticker(userId: string, miLlavePublica: unknown, entrada: Blob): Promise<{ sticker: Sticker; nuevo: boolean }> {
  const lista = await cargarColeccion(userId, miLlavePublica);
  const { blob, meta: base } = await prepararSticker(entrada);
  const meta = { ...base, huella: await huellaVisual(blob).catch(() => undefined) };
  const repetido = lista.find((s) => esRepetido(s.meta, meta));
  if (repetido) return { sticker: repetido, nuevo: false };

  const id = crypto.randomUUID();
  const path = `${userId}/${id}.bin`;
  const { encryptedBlob, fileKeyBase64 } = await encryptFile(blob);
  const { error: errSubida } = await supabase.storage
    .from('stickers')
    .upload(path, encryptedBlob, { contentType: 'application/octet-stream', upsert: false });
  if (errSubida) throw new Error('No se pudo guardar el sticker (sin conexión o lleno).');

  const metaCompleta: MetaSticker = { ...meta, key: fileKeyBase64 };
  const llave = await llaveColeccion(userId, miLlavePublica);
  const cifrado = await encryptJSON(llave, metaCompleta);
  const { error } = await supabase.from('stickers').insert({ id, path, meta: cifrado.ciphertext, iv: cifrado.iv });
  if (error) {
    await supabase.storage.from('stickers').remove([path]);
    throw new Error(error.message.includes('300') ? error.message : 'No se pudo guardar el sticker.');
  }

  const sticker: Sticker = { id, path, meta: metaCompleta };
  blobs.set(id, blob);
  coleccion = { userId, lista: [sticker, ...lista] };
  avisar();
  return { sticker, nuevo: true };
}

export async function borrarSticker(userId: string, s: Sticker): Promise<void> {
  const { error } = await supabase.from('stickers').delete().eq('id', s.id);
  if (error) throw new Error('No se pudo borrar el sticker.');
  await supabase.storage.from('stickers').remove([s.path]);
  const u = urls.get(s.id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(s.id);
  blobs.delete(s.id);
  if (coleccion?.userId === userId) {
    coleccion = { userId, lista: coleccion.lista.filter((x) => x.id !== s.id) };
    avisar();
  }
}

/**
 * Busca stickers repetidos en la colección y los borra (se queda el que se usó más reciente).
 * A los que no tienen huella se les calcula una vez y se guarda (cifrada).
 */
let limpiando: Promise<number> | null = null;
export function limpiarRepetidos(userId: string, miLlavePublica: unknown): Promise<number> {
  if (limpiando) return limpiando;
  limpiando = (async () => {
    const lista = await cargarColeccion(userId, miLlavePublica);
    const llave = await llaveColeccion(userId, miLlavePublica);
    for (const s of lista) {
      if (s.meta.huella) continue;
      try {
        const huella = await huellaVisual(await blobSticker(s));
        s.meta = { ...s.meta, huella };
        const cif = await encryptJSON(llave, s.meta);
        await supabase.from('stickers').update({ meta: cif.ciphertext, iv: cif.iv }).eq('id', s.id);
      } catch {
        /* uno que no se puede abrir se deja como está */
      }
    }
    // La lista viene del más usado al menos usado: se conserva el primero de cada grupo
    const quedan: Sticker[] = [];
    const sobran: Sticker[] = [];
    for (const s of lista) (quedan.some((q) => esRepetido(q.meta, s.meta)) ? sobran : quedan).push(s);
    for (const s of sobran) await borrarSticker(userId, s).catch(() => {});
    return sobran.length;
  })().finally(() => {
    // Se puede volver a revisar más tarde (por ejemplo, después de importar muchos)
    setTimeout(() => (limpiando = null), 60_000);
  });
  return limpiando;
}

/** Al enviar uno, pasa de primero (como los "recientes" de WhatsApp). */
export function marcarUsado(userId: string, s: Sticker) {
  if (coleccion?.userId === userId) {
    coleccion = { userId, lista: [s, ...coleccion.lista.filter((x) => x.id !== s.id)] };
    avisar();
  }
  supabase.from('stickers').update({ used_at: new Date().toISOString() }).eq('id', s.id).then(() => {});
}

/** Al cerrar sesión. */
export function vaciarStickers() {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
  blobs.clear();
  coleccion = null;
}

/** ¿Es un sticker animado (GIF o WebP animado)? Esos no se editan para no perder la animación. */
export async function esAnimado(b: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await b.slice(0, 64).arrayBuffer());
  const tipo = leerTipo(bytes);
  return tipo === 'image/gif' || (tipo === 'image/webp' && webpAnimado(bytes));
}
