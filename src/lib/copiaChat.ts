// Copia de seguridad: descarga la conversación (textos, fotos, videos y audios) en un archivo .zip
// que se puede abrir en cualquier computador o celular. Todo se descifra en este celular.
import { supabase } from './supabase';
import { decryptFile, decryptJSONConRespaldo, getChatKey, getLocalPrivateKey, llavesAnterioresDelChat } from './crypto';
import type { DbMessage, MessagePayload } from '../types/chat';
import type { Profile } from '../types/database';

// ---------- ZIP sencillo (sin comprimir: las fotos y videos ya vienen comprimidos) ----------
const TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (d: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLA[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function armarZip(archivos: { nombre: string; datos: Uint8Array }[]): Blob {
  const partes: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  const enc = new TextEncoder();
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const crc = crc32(a.datos);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true);
    loc.setUint16(4, 20, true);
    loc.setUint16(6, 0x0800, true); // nombres en UTF-8
    loc.setUint32(14, crc, true);
    loc.setUint32(18, a.datos.length, true);
    loc.setUint32(22, a.datos.length, true);
    loc.setUint16(26, nombre.length, true);
    partes.push(loc.buffer, nombre as BlobPart, a.datos as BlobPart);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, a.datos.length, true);
    cen.setUint32(24, a.datos.length, true);
    cen.setUint16(28, nombre.length, true);
    cen.setUint32(42, pos, true);
    const c = new Uint8Array(46 + nombre.length);
    c.set(new Uint8Array(cen.buffer), 0);
    c.set(nombre, 46);
    central.push(c);
    pos += 30 + nombre.length + a.datos.length;
  }
  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, pos, true);
  return new Blob([...partes, ...(central as BlobPart[]), fin.buffer], { type: "application/zip" });
}

const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const extension = (mime: string) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/aac': 'aac' })[
    mime.split(';')[0]
  ] || 'bin';

export interface ProgresoCopia {
  paso: string;
  hecho: number;
  total: number;
}

/** Arma la copia de todos mis chats y la descarga. */
export async function descargarCopia(userId: string, alAvanzar: (p: ProgresoCopia) => void): Promise<void> {
  const priv = await getLocalPrivateKey(userId);
  if (!priv) throw new Error('Falta tu llave de cifrado en este celular.');
  const { data: mios, error } = await supabase.from('chat_members').select('chat_id').eq('user_id', userId);
  if (error) throw new Error('Sin conexión. Intenta de nuevo.');

  const archivos: { nombre: string; datos: Uint8Array }[] = [];
  const enc = new TextEncoder();
  const fecha = new Date().toISOString().slice(0, 10);

  for (const { chat_id: chatId } of mios ?? []) {
    alAvanzar({ paso: 'Buscando mensajes…', hecho: 0, total: 0 });
    const { data: m } = await supabase.from('chat_members').select('user_id').eq('chat_id', chatId).neq('user_id', userId).maybeSingle();
    if (!m) continue;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', m.user_id).maybeSingle();
    const otro = p as Profile | null;
    if (!otro?.public_key) continue;
    const nombre = otro.display_name || otro.username;
    const llave = await getChatKey(chatId, priv, otro.public_key as JsonWebKey);
    const viejas = await llavesAnterioresDelChat(chatId, priv, otro.llaves_anteriores, userId, otro.public_key);

    // Todos los mensajes, de 1000 en 1000
    const filas: DbMessage[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error: e } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .range(desde, desde + 999);
      if (e) throw new Error('Sin conexión. Intenta de nuevo.');
      filas.push(...((data ?? []) as DbMessage[]));
      if (!data || data.length < 1000) break;
    }

    const carpeta = `ChatDos ${nombre} ${fecha}`.replace(/[\\/:*?"<>|]/g, '');
    const html: string[] = [];
    let n = 0;
    for (const f of filas) {
      n++;
      alAvanzar({ paso: `Preparando la conversación con ${nombre}`, hecho: n, total: filas.length });
      const yo = f.sender_id === userId;
      const hora = new Date(f.created_at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
      let cuerpo = '';
      if (f.deleted_for_all) cuerpo = '<i>Se eliminó este mensaje</i>';
      else {
        let p2: MessagePayload | null = null;
        try {
          p2 = await decryptJSONConRespaldo<MessagePayload>(llave, viejas, f.ciphertext, f.iv);
        } catch {
          cuerpo = '<i>Mensaje que no se pudo abrir</i>';
        }
        if (p2) {
          if (p2.llamada) {
            const d = p2.llamada.duracion;
            cuerpo = `${p2.llamada.tipo === 'video' ? '🎥 Videollamada' : '📞 Llamada'} ${p2.llamada.estado === 'completada' ? `(${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')})` : '(sin respuesta)'}`;
          } else if (p2.ubicacion) {
            const u = p2.ubicacion;
            cuerpo = `📍 <a href="https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}">Ubicación</a>`;
          } else if (p2.contacto) {
            const c = p2.contacto;
            cuerpo = `👤 <b>${escapar(c.nombre)}</b><br>${c.telefonos.map(escapar).join('<br>')}${c.correo ? '<br>' + escapar(c.correo) : ''}`;
          } else if (f.view_once) {
            cuerpo = '<i>Foto o video para ver una vez (no se guarda en la copia)</i>';
          } else {
            if (p2.media?.key && f.media_path) {
              try {
                const { data: cif } = await supabase.storage.from('media').download(f.media_path);
                if (cif) {
                  const plano = await decryptFile(cif, p2.media.key, p2.media.mime);
                  const archivo = `archivos/${f.created_at.slice(0, 10)}_${f.id.slice(0, 8)}.${extension(p2.media.mime)}`;
                  archivos.push({ nombre: `${carpeta}/${archivo}`, datos: new Uint8Array(await plano.arrayBuffer()) });
                  cuerpo +=
                    f.kind === 'image'
                      ? `<a href="${archivo}"><img src="${archivo}" loading="lazy"></a>`
                      : f.kind === 'video'
                        ? `<video src="${archivo}" controls preload="none"></video>`
                        : `<audio src="${archivo}" controls preload="none"></audio>`;
                }
              } catch {
                cuerpo += '<i>Archivo que ya no está disponible</i>';
              }
            }
            if (p2.text) cuerpo += `<p>${escapar(p2.text).replace(/\n/g, '<br>')}</p>`;
          }
        }
      }
      html.push(`<div class="m ${yo ? 'yo' : ''}"><div class="b">${cuerpo}<span class="h">${hora}</span></div></div>`);
    }

    const pagina = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ChatDos · ${escapar(nombre)}</title><style>
body{margin:0;background:#F2F4F7;font-family:Inter,system-ui,sans-serif;color:#1F2933}
header{position:sticky;top:0;background:#003A73;color:#fff;padding:14px 16px;font:600 16px Poppins,system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:12px}
.m{display:flex;margin:4px 0}.m.yo{justify-content:flex-end}
.b{max-width:80%;background:#fff;border-radius:8px;padding:6px 10px 4px;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.yo .b{background:#005198;color:#fff}
.b p{margin:0 0 2px;white-space:pre-wrap;word-break:break-word}
.b img,.b video{max-width:100%;border-radius:4px;display:block;margin-bottom:4px}
.h{display:block;text-align:right;font-size:11px;opacity:.75}
</style></head><body><header>ChatDos · Conversación con ${escapar(nombre)} · copia del ${fecha}</header><main>${html.join('\n')}</main></body></html>`;
    archivos.push({ nombre: `${carpeta}/Conversación.html`, datos: enc.encode(pagina) });
  }

  if (!archivos.length) throw new Error('No hay conversaciones para guardar.');
  alAvanzar({ paso: 'Armando el archivo…', hecho: 1, total: 1 });
  const zip = armarZip(archivos);
  const url = URL.createObjectURL(zip);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ChatDos copia ${fecha}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
