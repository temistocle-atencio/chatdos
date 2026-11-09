// Silenciar un chat: mientras está silenciado no llegan avisos ni suena el "tin".
// Se guarda en la cuenta (tabla chat_mutes), así funciona en cualquier celular.
import { supabase } from './supabase';

export const SIEMPRE = '9999-12-31T00:00:00Z';

export const OPCIONES_SILENCIO = [
  { id: '8h', label: '8 horas', ms: 8 * 3600 * 1000 },
  { id: '1s', label: '1 semana', ms: 7 * 24 * 3600 * 1000 },
  { id: 'siempre', label: 'Siempre', ms: 0 },
] as const;

export const estaSilenciado = (hasta: string | null | undefined): boolean =>
  !!hasta && new Date(hasta).getTime() > Date.now();

/** Devuelve hasta cuándo está silenciado el chat (o null). */
export async function leerSilencio(chatId: string): Promise<string | null> {
  const { data } = await supabase.from('chat_mutes').select('muted_until').eq('chat_id', chatId).maybeSingle();
  return estaSilenciado(data?.muted_until) ? (data!.muted_until as string) : null;
}

/** Chats silenciados ahora mismo: { chatId: hasta } */
export async function leerSilencios(): Promise<Record<string, string>> {
  const { data } = await supabase.from('chat_mutes').select('chat_id, muted_until');
  const out: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    if (estaSilenciado(r.muted_until)) out[r.chat_id] = r.muted_until;
  });
  return out;
}

/** Silenciar (opcion = '8h' | '1s' | 'siempre') o quitar el silencio (null). */
export async function guardarSilencio(chatId: string, opcion: (typeof OPCIONES_SILENCIO)[number]['id'] | null): Promise<string | null> {
  if (!opcion) {
    const { error } = await supabase.from('chat_mutes').delete().eq('chat_id', chatId);
    if (error) throw error;
    return null;
  }
  const o = OPCIONES_SILENCIO.find((x) => x.id === opcion)!;
  const hasta = o.ms ? new Date(Date.now() + o.ms).toISOString() : SIEMPRE;
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('chat_mutes')
    .upsert({ user_id: u.user!.id, chat_id: chatId, muted_until: hasta }, { onConflict: 'user_id,chat_id' });
  if (error) throw error;
  return hasta;
}

/** Texto corto: "Silenciado hasta las 10:30 p. m." / "hasta el 16 nov." / "Silenciado" */
export function textoSilencio(hasta: string): string {
  if (hasta.startsWith('9999')) return 'Silenciado';
  const d = new Date(hasta);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? `Silenciado hasta las ${d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}`
    : `Silenciado hasta el ${d.toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;
}
