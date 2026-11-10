// Icono y nombre de la app de CADA persona (lo predeterminado es "ChatDos" con el cubo).
// Se guarda en el servidor (tabla "apariencia" + bucket privado "iconos") y una copia en el
// celular para que aparezca al instante y sin internet.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const NOMBRE_POR_DEFECTO = 'ChatDos';
const CLAVE = 'chatdos-mi-apariencia';
const BASE = '/chatdos/';

export interface Apariencia {
  nombre: string;
  icono: string | null; // imagen cuadrada (data URL PNG) o null = el cubo
}

const PREDETERMINADA: Apariencia = { nombre: NOMBRE_POR_DEFECTO, icono: null };

let dueño: string | null = null;
let actual: Apariencia = PREDETERMINADA;
const avisos = new Set<(a: Apariencia) => void>();

function leerGuardada(userId: string): Apariencia | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null') as (Apariencia & { userId: string }) | null;
    return g && g.userId === userId ? { nombre: g.nombre || NOMBRE_POR_DEFECTO, icono: g.icono ?? null } : null;
  } catch {
    return null;
  }
}

function guardarCopia(userId: string, a: Apariencia) {
  try {
    if (a.nombre === NOMBRE_POR_DEFECTO && !a.icono) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, JSON.stringify({ ...a, userId }));
  } catch {
    /* sin espacio: igual se ve mientras la app esté abierta */
  }
}

function fijar(a: Apariencia) {
  if (a.nombre === actual.nombre && a.icono === actual.icono) return;
  actual = a;
  aplicarAlNavegador(a);
  avisos.forEach((f) => f(a));
}

// ---------- Imágenes ----------
const cargarImagen = (src: string) =>
  new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('No se pudo abrir esa imagen.'));
    img.src = src;
  });

/** Recorta al centro en cuadrado de 512 px (PNG). Sirve para fotos y enlaces. */
export async function prepararIcono(origen: Blob | string): Promise<string> {
  const url = typeof origen === 'string' ? origen : URL.createObjectURL(origen);
  try {
    const img = await cargarImagen(url);
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    if (!lado) throw new Error('La imagen está vacía.');
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 512, 512);
    try {
      return c.toDataURL('image/png');
    } catch {
      throw new Error('Esa página no deja usar su imagen. Descárgala y súbela con «Subir foto».');
    }
  } finally {
    if (typeof origen !== 'string') URL.revokeObjectURL(url);
  }
}

/** Versión redonda (transparente afuera) o redonda sobre fondo (para la pantalla de inicio). */
async function variante(icono: string, lado: number, fondo?: string): Promise<string> {
  const img = await cargarImagen(icono);
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const ctx = c.getContext('2d')!;
  if (fondo) {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, lado, lado);
  }
  const r = fondo ? lado * 0.42 : lado / 2; // con fondo: círculo con margen (zona segura de Android/iPhone)
  ctx.save();
  ctx.beginPath();
  ctx.arc(lado / 2, lado / 2, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, lado / 2 - r, lado / 2 - r, r * 2, r * 2);
  ctx.restore();
  return c.toDataURL('image/png');
}

// ---------- Pestaña del navegador, pantalla de inicio y manifiesto ----------
let manifiestoUrl: string | null = null;
function ponerLink(rel: string, href: string, tipo?: string) {
  let l = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!l) {
    l = document.createElement('link');
    l.rel = rel;
    document.head.appendChild(l);
  }
  if (tipo) l.type = tipo;
  else l.removeAttribute('type');
  l.href = href;
}

async function aplicarAlNavegador(a: Apariencia) {
  document.title = a.nombre;
  ponerMeta('apple-mobile-web-app-title', a.nombre);
  if (!a.icono) {
    ponerLink('icon', `${BASE}favicon.svg`, 'image/svg+xml');
    ponerLink('apple-touch-icon', `${BASE}apple-touch-icon.png`);
  } else {
    try {
      const [redondo, inicio192, inicio512] = await Promise.all([
        variante(a.icono, 128),
        variante(a.icono, 192, '#FFFFFF'),
        variante(a.icono, 512, '#FFFFFF'),
      ]);
      if (actual !== a) return;
      ponerLink('icon', redondo, 'image/png');
      ponerLink('apple-touch-icon', inicio512);
      actualizarManifiesto(a.nombre, [
        { src: inicio192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: inicio512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: inicio512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]);
      return;
    } catch {
      /* si algo falla se queda el icono normal */
    }
  }
  actualizarManifiesto(a.nombre, null);
}

function ponerMeta(nombre: string, valor: string) {
  let m = document.querySelector<HTMLMetaElement>(`meta[name="${nombre}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.name = nombre;
    document.head.appendChild(m);
  }
  m.content = valor;
}

let manifiestoOriginal: string | null = null;
async function actualizarManifiesto(nombre: string, iconos: Record<string, string>[] | null) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;
  if (!manifiestoOriginal) manifiestoOriginal = link.href;
  if (nombre === NOMBRE_POR_DEFECTO && !iconos) {
    link.href = manifiestoOriginal;
    return;
  }
  try {
    const m = await (await fetch(manifiestoOriginal)).json();
    const abs = (p: string) => new URL(p, manifiestoOriginal!).href;
    const nuevo = {
      ...m,
      name: nombre,
      short_name: nombre,
      start_url: abs(m.start_url || BASE),
      scope: abs(m.scope || BASE),
      id: abs(m.id || BASE),
      icons: iconos ?? (m.icons || []).map((i: { src: string }) => ({ ...i, src: abs(i.src) })),
    };
    if (manifiestoUrl) URL.revokeObjectURL(manifiestoUrl);
    manifiestoUrl = URL.createObjectURL(new Blob([JSON.stringify(nuevo)], { type: 'application/manifest+json' }));
    link.href = manifiestoUrl;
  } catch {
    /* sin internet: se queda el manifiesto normal */
  }
}

// ---------- Servidor ----------
async function descargarIcono(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('iconos').download(path);
  if (!data) return null;
  return await new Promise((ok) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => ok(null);
    r.readAsDataURL(data);
  });
}

/** Lee la apariencia de una persona (la mía, o la de un invitado si soy administrador). */
export async function leerApariencia(userId: string): Promise<Apariencia | null> {
  const { data, error } = await supabase.from('apariencia').select('nombre, icono_path').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return PREDETERMINADA;
  const icono = data.icono_path ? await descargarIcono(data.icono_path) : null;
  return { nombre: data.nombre || NOMBRE_POR_DEFECTO, icono };
}

/** Empieza a usar la apariencia de esta persona (al iniciar sesión) o la predeterminada (sin sesión). */
export function usarAparienciaDe(userId: string | null) {
  if (userId === dueño) return;
  dueño = userId;
  if (!userId) {
    fijar(PREDETERMINADA);
    return;
  }
  const guardada = leerGuardada(userId);
  fijar(guardada ?? PREDETERMINADA);
  leerApariencia(userId)
    .then((a) => {
      if (!a || dueño !== userId) return;
      guardarCopia(userId, a);
      fijar(a);
    })
    .catch(() => {
      /* sin internet: se queda la copia del celular */
    });
}

export async function guardarMiApariencia(userId: string, nombre: string, icono: string | null): Promise<void> {
  const limpio = nombre.trim().replace(/\s+/g, ' ') || NOMBRE_POR_DEFECTO;
  if (limpio.length > 24) throw new Error('El nombre puede tener hasta 24 letras.');
  let icono_path: string | null = null;
  if (icono) {
    const blob = await (await fetch(icono)).blob();
    icono_path = `${userId}/icono.png`;
    const { error } = await supabase.storage.from('iconos').upload(icono_path, blob, { contentType: 'image/png', upsert: true });
    if (error) throw new Error('No se pudo subir el icono.');
  } else {
    await supabase.storage.from('iconos').remove([`${userId}/icono.png`]);
  }
  const { error } = await supabase
    .from('apariencia')
    .upsert({ user_id: userId, nombre: limpio === NOMBRE_POR_DEFECTO ? null : limpio, icono_path, updated_at: new Date().toISOString() });
  if (error) throw new Error('No se pudo guardar.');
  const a = { nombre: limpio, icono };
  guardarCopia(userId, a);
  if (dueño === userId) fijar(a);
}

export async function volverAChatDos(userId: string): Promise<void> {
  await supabase.storage.from('iconos').remove([`${userId}/icono.png`]);
  const { error } = await supabase.from('apariencia').delete().eq('user_id', userId);
  if (error) throw new Error('No se pudo restablecer.');
  guardarCopia(userId, PREDETERMINADA);
  if (dueño === userId) fijar(PREDETERMINADA);
}

// ---------- Para las pantallas ----------
export function useApariencia(): Apariencia {
  const [a, setA] = useState(actual);
  useEffect(() => {
    avisos.add(setA);
    setA(actual);
    return () => {
      avisos.delete(setA);
    };
  }, []);
  return a;
}

export const useNombreApp = () => useApariencia().nombre;

/**
 * Parte el nombre en dos para los colores de la marca (primera parte azul, segunda naranja),
 * como "Chat" + "Dos". Se parte en el espacio o en la última mayúscula ("MiChat" -> "Mi" + "Chat").
 */
export function partirNombre(n: string): [string, string] {
  const espacio = n.indexOf(' ');
  if (espacio > 0) return [n.slice(0, espacio), n.slice(espacio)];
  for (let i = n.length - 1; i > 0; i--) {
    const c = n[i];
    if (c >= 'A' && c <= 'Z' && n[i - 1] !== n[i - 1].toUpperCase()) return [n.slice(0, i), n.slice(i)];
  }
  return [n, ''];
}
