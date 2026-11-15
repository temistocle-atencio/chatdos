// Ajustes compartidos de un chat: mensaje fijado y mensajes temporales.
import { supabase } from './supabase';

export interface AjustesChat {
  fijado: string | null; // id del mensaje fijado
  temporales: number; // segundos (0 = apagados)
}

export const DURACIONES = [
  { segundos: 0, nombre: 'Desactivados' },
  { segundos: 86400, nombre: '24 horas' },
  { segundos: 604800, nombre: '7 días' },
];
export const nombreDuracion = (s: number) => DURACIONES.find((d) => d.segundos === s)?.nombre ?? 'Desactivados';

export async function leerAjustesChat(chatId: string): Promise<AjustesChat | null> {
  const { data, error } = await supabase
    .from('chats')
    .select('pinned_message_id, temporales_segundos')
    .eq('id', chatId)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as { pinned_message_id: string | null; temporales_segundos: number | null };
  return { fijado: d.pinned_message_id ?? null, temporales: d.temporales_segundos ?? 0 };
}

export async function fijarMensaje(chatId: string, mensajeId: string | null) {
  const { error } = await supabase.rpc('fijar_mensaje', { p_chat: chatId, p_msg: mensajeId });
  if (error) throw new Error('No se pudo fijar el mensaje.');
}

export async function ponerTemporales(chatId: string, segundos: number) {
  const { error } = await supabase.rpc('poner_temporales', { p_chat: chatId, p_segundos: segundos });
  if (error) throw new Error('No se pudo cambiar.');
}

/** Borra los mensajes temporales vencidos (y sus archivos, si se puede). */
export async function borrarVencidos(chatId: string) {
  try {
    const { data } = await supabase
      .from('messages')
      .select('media_path')
      .eq('chat_id', chatId)
      .lt('expires_at', new Date().toISOString())
      .not('media_path', 'is', null);
    const rutas = (data ?? []).map((m: { media_path: string | null }) => m.media_path).filter(Boolean) as string[];
    if (rutas.length) await supabase.storage.from('media').remove(rutas).catch(() => {});
    await supabase.rpc('borrar_vencidos', { p_chat: chatId });
  } catch {
    /* sin internet o sin el cambio en la base de datos: se intenta la próxima vez */
  }
}

export const estaVencido = (m: { expires_at?: string | null }) =>
  !!m.expires_at && new Date(m.expires_at).getTime() <= Date.now();
