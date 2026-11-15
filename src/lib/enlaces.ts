// Vista previa de enlaces: la arma quien envía (con ayuda del servidor, que lee la página una vez)
// y viaja cifrada dentro del mensaje. Quien recibe no visita la página por su cuenta.
import { supabase } from './supabase';
import type { MessagePayload } from '../types/chat';

export type VistaEnlace = NonNullable<MessagePayload['enlace']>;

const RE = /((?:https?:\/\/|www\.)[^\s<>"'`]+)/i;

/** Primer enlace del texto (con https:// si no lo tenía) */
export function primerEnlace(texto: string): string | null {
  const m = texto.match(RE);
  if (!m) return null;
  let u = m[1].replace(/[.,;:!?)\]}»”]+$/, '');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const x = new URL(u);
    return x.hostname.includes('.') ? x.href : null;
  } catch {
    return null;
  }
}

// Achica la imagen para que el mensaje no pese mucho
function miniatura(dataUrl: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 480;
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      if (w < 40 || h < 40) return resolve(undefined); // íconos diminutos: no valen la pena
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(undefined);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

const cache = new Map<string, Promise<VistaEnlace | null>>();

export function pedirVistaPrevia(url: string): Promise<VistaEnlace | null> {
  const ya = cache.get(url);
  if (ya) return ya;
  const p = (async () => {
    const { data, error } = await supabase.functions.invoke('notificar', { body: { accion: 'enlace', url } });
    const d = data as (VistaEnlace & { error?: string }) | null;
    if (error || !d || d.error) return null;
    const imagen = d.imagen ? await miniatura(d.imagen) : undefined;
    if (!d.titulo && !d.descripcion && !imagen) return null; // sin nada que mostrar
    return {
      url: d.url || url,
      ...(d.titulo ? { titulo: d.titulo } : {}),
      ...(d.descripcion ? { descripcion: d.descripcion } : {}),
      ...(d.sitio ? { sitio: d.sitio } : {}),
      ...(imagen ? { imagen } : {}),
    };
  })().catch(() => null);
  cache.set(url, p);
  p.then((r) => {
    if (!r) cache.delete(url); // si falló, se puede volver a intentar
  });
  return p;
}
