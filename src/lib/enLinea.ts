// "En línea": cada persona avisa que tiene la app abierta en un canal por chat ("enlinea:<chat_id>").
// Solo los dos miembros del chat pueden entrar a ese canal (regla en la base de datos).
import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

const canales = new Map<string, RealtimeChannel>();
const enLinea = new Set<string>(); // ids de personas con la app abierta
const avisos = new Set<() => void>();
let miId: string | null = null;
let escuchandoVisibilidad = false;

const avisar = () => avisos.forEach((f) => f());

function recalcular() {
  const antes = [...enLinea].sort().join();
  enLinea.clear();
  canales.forEach((c) => {
    Object.keys(c.presenceState()).forEach((k) => k !== miId && enLinea.add(k));
  });
  if ([...enLinea].sort().join() !== antes) avisar();
}

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

function marcar(c: RealtimeChannel) {
  if (visible()) c.track({ t: Date.now() }).catch(() => {});
  else c.untrack().catch(() => {});
}

function alCambiarVisibilidad() {
  canales.forEach(marcar);
}

/** Entra a los canales de "en línea" de estos chats (los que ya estén abiertos se reutilizan). */
export async function conectarEnLinea(userId: string, chatIds: string[]) {
  if (miId && miId !== userId) desconectarEnLinea();
  miId = userId;
  if (!escuchandoVisibilidad) {
    escuchandoVisibilidad = true;
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('pagehide', () => canales.forEach((c) => c.untrack().catch(() => {})));
  }
  const nuevos = chatIds.filter((id) => !canales.has(id));
  if (!nuevos.length) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
  } catch {
    /* sin internet */
  }
  for (const chatId of nuevos) {
    if (canales.has(chatId)) continue;
    const c = supabase.channel(`enlinea:${chatId}`, {
      config: { private: true, presence: { key: userId } },
    });
    canales.set(chatId, c);
    c.on('presence', { event: 'sync' }, recalcular)
      .on('presence', { event: 'join' }, recalcular)
      .on('presence', { event: 'leave' }, recalcular)
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') marcar(c);
      });
  }
}

/** Busca mis chats y se conecta (para cuando la lista todavía no se ha abierto). */
export async function iniciarEnLinea(userId: string) {
  try {
    const { data } = await supabase.from('chat_members').select('chat_id').eq('user_id', userId);
    if (data) await conectarEnLinea(userId, data.map((d: { chat_id: string }) => d.chat_id));
  } catch {
    /* sin internet: se intenta otra vez al volver */
  }
}

export function desconectarEnLinea() {
  canales.forEach((c) => {
    c.untrack().catch(() => {});
    supabase.removeChannel(c);
  });
  canales.clear();
  enLinea.clear();
  miId = null;
  avisar();
}

export const estaEnLinea = (userId?: string | null) => !!userId && enLinea.has(userId);

/** true mientras esa persona tenga la app abierta. */
export function useEnLinea(userId?: string | null): boolean {
  const [v, setV] = useState(() => estaEnLinea(userId));
  useEffect(() => {
    const f = () => setV(estaEnLinea(userId));
    f();
    avisos.add(f);
    return () => {
      avisos.delete(f);
    };
  }, [userId]);
  return v;
}
