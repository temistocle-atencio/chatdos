// Fotos en calidad ORIGINAL (tal cual salen del teléfono, sin achicar ni comprimir).
// Se guardan CIFRADAS en Cloudflare R2 (mucho espacio, sin límite de 50 MB por archivo).
// El servidor nunca ve la foto: solo entrega un permiso temporal para subir o bajar el archivo cifrado.
import { supabase } from './supabase';
import { decryptFile, encryptFile } from './crypto';
import type { MessagePayload } from '../types/chat';

export type DatosOriginal = NonNullable<NonNullable<MessagePayload['media']>['original']>;

export const MAX_ORIGINAL = 250 * 1024 * 1024; // 250 MB

async function permiso(cuerpo: Record<string, unknown>): Promise<{ url: string; ruta?: string }> {
  const { data, error } = await supabase.functions.invoke('notificar', { body: cuerpo });
  const d = data as { url?: string; ruta?: string; error?: string } | null;
  if (error || !d?.url) throw new Error(d?.error || 'El servicio de fotos originales no está listo todavía.');
  return { url: d.url, ruta: d.ruta };
}

/** Cifra y sube la foto original. Devuelve lo que va (cifrado) dentro del mensaje. */
export async function subirOriginal(chatId: string, foto: Blob, alAvanzar?: (pct: number) => void): Promise<DatosOriginal> {
  if (foto.size > MAX_ORIGINAL) throw new Error('La foto pesa más de 250 MB.');
  const { encryptedBlob, fileKeyBase64 } = await encryptFile(foto);
  const { url, ruta } = await permiso({ accion: 'original_subir', chat_id: chatId, tam: encryptedBlob.size });
  if (!ruta) throw new Error('No se pudo preparar la subida');
  await new Promise<void>((ok, mal) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = (e) => e.lengthComputable && alAvanzar?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : mal(new Error(`No se pudo subir la foto original (${x.status})`)));
    x.onerror = () => mal(new Error('Sin conexión: no se pudo subir la foto original'));
    x.send(encryptedBlob);
  });
  return { ruta, key: fileKeyBase64, size: foto.size, mime: foto.type || 'image/jpeg' };
}

const bajadas = new Map<string, Promise<string>>();

/** Baja y descifra la foto original. Devuelve una dirección local para verla o guardarla. */
export function bajarOriginal(o: DatosOriginal, alAvanzar?: (pct: number) => void): Promise<string> {
  const ya = bajadas.get(o.ruta);
  if (ya) return ya;
  const p = (async () => {
    const { url } = await permiso({ accion: 'original_bajar', ruta: o.ruta });
    const r = await fetch(url);
    if (!r.ok || !r.body) throw new Error('No se pudo bajar la foto original');
    const total = Number(r.headers.get('content-length')) || 0;
    const lector = r.body.getReader();
    const partes: Uint8Array[] = [];
    let llevamos = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done || !value) break;
      partes.push(value);
      llevamos += value.length;
      if (total) alAvanzar?.(Math.round((llevamos / total) * 100));
    }
    const plano = await decryptFile(new Blob(partes as BlobPart[]), o.key, o.mime);
    return URL.createObjectURL(plano);
  })();
  bajadas.set(o.ruta, p);
  p.catch(() => bajadas.delete(o.ruta));
  return p;
}

/** Al eliminar el mensaje para los dos */
export async function borrarOriginal(ruta: string): Promise<void> {
  await supabase.functions.invoke('notificar', { body: { accion: 'original_borrar', ruta } }).catch(() => {});
}
