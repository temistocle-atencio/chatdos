// Notas (como en WhatsApp): una frase corta que dura 24 horas.
// Se guarda cifrada con la llave de cada chat: solo la otra persona del chat la puede leer.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { claveLlave, memoria } from './memoria';
import { decryptJSON, encryptJSON, getChatKey, getLocalPrivateKey } from './crypto';

export const MAX_NOTA = 60;
const DURACION_MS = 24 * 60 * 60 * 1000;

export interface Nota {
  texto: string;
  expira: string; // fecha ISO
}

// chatId -> nota de la otra persona (null = no tiene)
const notas = new Map<string, Nota | null>();
const avisos = new Set<() => void>();
const avisar = () => avisos.forEach((f) => f());

async function llaveDelChat(userId: string, chatId: string, publicaDelOtro: unknown): Promise<CryptoKey | null> {
  if (!publicaDelOtro) return null;
  const k = claveLlave(chatId, publicaDelOtro);
  const enMem = memoria.llaves.get(k);
  if (enMem) return enMem;
  const priv = await getLocalPrivateKey(userId);
  if (!priv) return null;
  const llave = await getChatKey(chatId, priv, publicaDelOtro as JsonWebKey);
  memoria.llaves.set(k, llave);
  return llave;
}

const vigente = (n: Nota | null | undefined) => (n && new Date(n.expira).getTime() > Date.now() ? n : null);

/** Lee la nota de la otra persona en cada uno de estos chats. */
export async function cargarNotas(userId: string, chats: { chatId: string; partnerId: string; publica: unknown }[]) {
  if (!chats.length) return;
  const { data, error } = await supabase
    .from('notas')
    .select('chat_id, user_id, ciphertext, iv, expira_at')
    .in('chat_id', chats.map((c) => c.chatId))
    .neq('user_id', userId)
    .gt('expira_at', new Date().toISOString());
  if (error) return;
  const filas = new Map((data ?? []).map((f) => [f.chat_id as string, f]));
  for (const c of chats) {
    const f = filas.get(c.chatId);
    if (!f) {
      notas.set(c.chatId, null);
      continue;
    }
    try {
      const llave = await llaveDelChat(userId, c.chatId, c.publica);
      if (!llave) continue;
      const { texto } = await decryptJSON<{ texto: string }>(llave, f.ciphertext, f.iv);
      notas.set(c.chatId, { texto, expira: f.expira_at });
    } catch {
      notas.set(c.chatId, null);
    }
  }
  avisar();
}

/** La nota que dejó la otra persona en este chat (se actualiza sola). */
export function useNotaDelChat(chatId?: string | null): Nota | null {
  const [n, setN] = useState(() => (chatId ? vigente(notas.get(chatId)) : null));
  useEffect(() => {
    const f = () => setN(chatId ? vigente(notas.get(chatId)) : null);
    f();
    avisos.add(f);
    const t = setInterval(f, 60_000); // se apaga sola al vencer
    return () => {
      avisos.delete(f);
      clearInterval(t);
    };
  }, [chatId]);
  return n;
}

/** Escucha cambios de notas en estos chats (cuando la otra persona pone o quita la suya). */
export function escucharNotas(userId: string, chats: { chatId: string; partnerId: string; publica: unknown }[]) {
  if (!chats.length) return () => {};
  const canal = supabase.channel(`notas-${userId}-${Math.random().toString(36).slice(2)}`);
  canal.on('postgres_changes', { event: '*', schema: 'public', table: 'notas' }, (cambio) => {
    const fila = (cambio.new && Object.keys(cambio.new).length ? cambio.new : cambio.old) as { chat_id?: string };
    const chat = chats.find((c) => c.chatId === fila?.chat_id);
    if (chat) cargarNotas(userId, [chat]);
  });
  canal.subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

// ---------- Mi nota ----------
async function misChats(userId: string) {
  const { data: mios } = await supabase.from('chat_members').select('chat_id').eq('user_id', userId);
  const ids = (mios ?? []).map((m: { chat_id: string }) => m.chat_id);
  if (!ids.length) return [];
  const { data: otros } = await supabase.from('chat_members').select('chat_id, user_id').in('chat_id', ids).neq('user_id', userId);
  const personas = [...new Set((otros ?? []).map((o: { user_id: string }) => o.user_id))];
  const { data: perfiles } = await supabase.from('profiles').select('id, public_key').in('id', personas);
  const llaves = new Map((perfiles ?? []).map((p: { id: string; public_key: unknown }) => [p.id, p.public_key]));
  return (otros ?? []).map((o: { chat_id: string; user_id: string }) => ({ chatId: o.chat_id, publica: llaves.get(o.user_id) }));
}

const CLAVE_MI_NOTA = 'chatdos-mi-nota';
export function leerMiNota(userId: string): Nota | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_MI_NOTA) || 'null') as (Nota & { userId: string }) | null;
    return g && g.userId === userId ? vigente(g) : null;
  } catch {
    return null;
  }
}

/** Publica mi nota en todos mis chats (cifrada con la llave de cada uno). */
export async function publicarMiNota(userId: string, texto: string): Promise<Nota> {
  const limpio = texto.trim().slice(0, MAX_NOTA);
  if (!limpio) throw new Error('Escribe algo para tu nota.');
  const expira = new Date(Date.now() + DURACION_MS).toISOString();
  const chats = await misChats(userId);
  if (!chats.length) throw new Error('Todavía no tienes conversaciones.');
  const filas = [];
  for (const c of chats) {
    const llave = await llaveDelChat(userId, c.chatId, c.publica);
    if (!llave) continue;
    const cif = await encryptJSON(llave, { texto: limpio });
    filas.push({ chat_id: c.chatId, user_id: userId, ciphertext: cif.ciphertext, iv: cif.iv, expira_at: expira, updated_at: new Date().toISOString() });
  }
  if (!filas.length) throw new Error('Falta tu llave de cifrado en este celular.');
  const { error } = await supabase.from('notas').upsert(filas, { onConflict: 'chat_id,user_id' });
  if (error) throw new Error('No se pudo publicar la nota.');
  const nota = { texto: limpio, expira };
  try {
    localStorage.setItem(CLAVE_MI_NOTA, JSON.stringify({ ...nota, userId }));
  } catch {
    /* nada */
  }
  return nota;
}

export async function quitarMiNota(userId: string): Promise<void> {
  const { error } = await supabase.from('notas').delete().eq('user_id', userId);
  if (error) throw new Error('No se pudo quitar la nota.');
  try {
    localStorage.removeItem(CLAVE_MI_NOTA);
  } catch {
    /* nada */
  }
}

/** Mi nota guardada en el servidor (por si la puse desde otro celular). */
export async function miNotaDelServidor(userId: string): Promise<Nota | null> {
  const { data } = await supabase
    .from('notas')
    .select('chat_id, ciphertext, iv, expira_at')
    .eq('user_id', userId)
    .gt('expira_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const chats = await misChats(userId);
  const c = chats.find((x) => x.chatId === data.chat_id);
  if (!c) return null;
  try {
    const llave = await llaveDelChat(userId, c.chatId, c.publica);
    if (!llave) return null;
    const { texto } = await decryptJSON<{ texto: string }>(llave, data.ciphertext, data.iv);
    return { texto, expira: data.expira_at };
  } catch {
    return null;
  }
}

export function tiempoRestante(expira: string): string {
  const min = Math.max(0, Math.round((new Date(expira).getTime() - Date.now()) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.round(min / 60)} h`;
}
