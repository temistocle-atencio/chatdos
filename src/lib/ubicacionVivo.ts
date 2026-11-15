// Ubicación en tiempo real (como WhatsApp, pero solo mientras ChatDos está abierto en pantalla:
// una app web no puede seguir usando el GPS con el celular bloqueado o la app cerrada).
// La posición se guarda CIFRADA con la llave del chat en la tabla "ubicacion_vivo".
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { decryptJSON, encryptJSON } from './crypto';

export interface Posicion {
  lat: number;
  lng: number;
  precision?: number;
}

export interface EstadoVivo extends Posicion {
  terminaAt: number; // ms
  actualizado: number; // ms
}

export const DURACIONES_VIVO = [
  { seg: 15 * 60, nombre: '15 minutos' },
  { seg: 60 * 60, nombre: '1 hora' },
  { seg: 8 * 3600, nombre: '8 horas' },
];

// ---------- Lo que se ve en las burbujas (por mensaje) ----------
const estados = new Map<string, EstadoVivo>();
const avisos = new Set<() => void>();
const avisar = () => avisos.forEach((f) => f());

function poner(messageId: string, e: EstadoVivo) {
  estados.set(messageId, e);
  avisar();
}

export function useUbicacionVivo(messageId: string): EstadoVivo | null {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((v) => v + 1);
    avisos.add(f);
    // Para que "hace X min" y "terminó" se actualicen solos
    const t = setInterval(f, 30000);
    return () => {
      avisos.delete(f);
      clearInterval(t);
    };
  }, []);
  return estados.get(messageId) ?? null;
}

interface Fila {
  message_id: string;
  ciphertext: string;
  iv: string;
  termina_at: string;
  updated_at: string;
}

/** Lee y descifra las ubicaciones en tiempo real de un chat (lo llama la pantalla del chat). */
export async function cargarUbicacionesVivo(chatId: string, llave: CryptoKey): Promise<void> {
  const { data, error } = await supabase
    .from('ubicacion_vivo')
    .select('message_id, ciphertext, iv, termina_at, updated_at')
    .eq('chat_id', chatId);
  if (error || !data) return;
  for (const f of data as Fila[]) {
    try {
      const p = await decryptJSON<Posicion>(llave, f.ciphertext, f.iv);
      poner(f.message_id, {
        ...p,
        terminaAt: new Date(f.termina_at).getTime(),
        actualizado: new Date(f.updated_at).getTime(),
      });
    } catch {
      /* de antes de un cambio de llave: se queda con la posición del mensaje */
    }
  }
}

// ---------- Compartir (en este celular) ----------
interface Compartiendo {
  chatId: string;
  messageId: string;
  hasta: number;
}
const CLAVE = 'chatdos:ubicacionVivo';

function leerGuardadas(): Compartiendo[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLAVE) || '[]') as Compartiendo[];
    return l.filter((c) => c.hasta > Date.now());
  } catch {
    return [];
  }
}
function guardar(l: Compartiendo[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(l));
  } catch {
    /* sin almacenamiento */
  }
}

const activas = new Map<string, { vigia: number; fin: ReturnType<typeof setTimeout>; ultima: { p: Posicion; t: number } | null }>();
const avisosPropios = new Set<() => void>();
const avisarPropios = () => avisosPropios.forEach((f) => f());

/** ¿Estoy compartiendo en este chat? (para el aviso de arriba) */
export function useCompartiendoEn(chatId: string | undefined): Compartiendo | null {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((v) => v + 1);
    avisosPropios.add(f);
    return () => {
      avisosPropios.delete(f);
    };
  }, []);
  if (!chatId) return null;
  return leerGuardadas().find((c) => c.chatId === chatId) ?? null;
}

const lejos = (a: Posicion, b: Posicion) => {
  const dy = (a.lat - b.lat) * 111_000;
  const dx = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

/** Empieza (o retoma) a enviar la posición de un mensaje de ubicación en tiempo real. */
export function compartir(c: Compartiendo, llave: CryptoKey, alAvisar: () => void, inicial?: Posicion) {
  if (activas.has(c.messageId) || c.hasta <= Date.now() || !navigator.geolocation) return;
  guardar([...leerGuardadas().filter((x) => x.messageId !== c.messageId), c]);

  const subir = async (p: Posicion, primera: boolean) => {
    const cif = await encryptJSON(llave, p);
    const fila = { ...cif, termina_at: new Date(c.hasta).toISOString() };
    const { error } = primera
      ? await supabase.from('ubicacion_vivo').upsert({ message_id: c.messageId, chat_id: c.chatId, ...fila }, { onConflict: 'message_id' })
      : await supabase.from('ubicacion_vivo').update(cif).eq('message_id', c.messageId);
    if (!error) {
      poner(c.messageId, { ...p, terminaAt: c.hasta, actualizado: Date.now() });
      alAvisar();
    }
  };

  const estado = { vigia: 0, fin: setTimeout(() => dejarDeCompartir(c.messageId), c.hasta - Date.now()), ultima: null as { p: Posicion; t: number } | null };
  activas.set(c.messageId, estado);
  if (inicial) {
    estado.ultima = { p: inicial, t: Date.now() };
    void subir(inicial, true);
  }
  estado.vigia = navigator.geolocation.watchPosition(
    (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy };
      const u = estado.ultima;
      // Se envía si se movió más de 15 m o pasaron 30 segundos
      if (u && lejos(u.p, p) < 15 && Date.now() - u.t < 30000) return;
      const primera = !u;
      estado.ultima = { p, t: Date.now() };
      void subir(p, primera);
    },
    () => {
      /* sin señal de GPS por un momento: se sigue intentando */
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
  );
  avisarPropios();
}

/** Deja de compartir (antes de tiempo o al terminar). */
export async function dejarDeCompartir(messageId: string, alAvisar?: () => void) {
  const a = activas.get(messageId);
  if (a) {
    navigator.geolocation.clearWatch(a.vigia);
    clearTimeout(a.fin);
    activas.delete(messageId);
  }
  const quedaban = leerGuardadas();
  const c = quedaban.find((x) => x.messageId === messageId);
  guardar(quedaban.filter((x) => x.messageId !== messageId));
  avisarPropios();
  // Si se empezó en otro celular igual se puede detener (el servidor solo deja a quien la comparte)
  if (!c || c.hasta > Date.now()) {
    const ahora = new Date().toISOString();
    await supabase.from('ubicacion_vivo').update({ termina_at: ahora }).eq('message_id', messageId);
    const e = estados.get(messageId);
    if (e) poner(messageId, { ...e, terminaAt: Date.now() });
    alAvisar?.();
  }
}

/** Al abrir un chat: retoma lo que se estaba compartiendo desde este celular. */
export function retomarEnChat(chatId: string, llave: CryptoKey, alAvisar: () => void) {
  for (const c of leerGuardadas()) if (c.chatId === chatId) compartir(c, llave, alAvisar);
}

export const esCompartidaAqui = (messageId: string) => leerGuardadas().some((c) => c.messageId === messageId);
