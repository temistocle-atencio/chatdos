import { supabase } from './supabase';

/**
 * Llama a mark_delivered() sin parámetros (marca entregados todos mis chats).
 * Registra siempre cualquier error en consola con [ChatDos].
 */
export async function safeMarkDelivered(): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_delivered');
    if (error) {
      console.error('[ChatDos] mark_delivered', error);
    } else {
      console.log('[ChatDos] mark_delivered ejecutado con éxito');
    }
  } catch (err) {
    console.error('[ChatDos] mark_delivered excepción', err);
  }
}

/**
 * Llama a mark_read({ p_chat: chatId }) para marcar como leídos los mensajes del chat abierto.
 * Parámetro exacto del contrato: p_chat.
 */
export async function safeMarkRead(chatId: string): Promise<void> {
  if (!chatId) return;
  try {
    const { error } = await supabase.rpc('mark_read', { p_chat: chatId });
    if (error) {
      console.error('[ChatDos] mark_read', error);
    } else {
      console.log('[ChatDos] mark_read ejecutado con éxito para chat:', chatId);
    }
  } catch (err) {
    console.error('[ChatDos] mark_read excepción', err);
  }
}

/**
 * Llama a touch_last_seen() para actualizar profiles.last_seen.
 */
export async function safeTouchLastSeen(): Promise<void> {
  try {
    const { error } = await supabase.rpc('touch_last_seen');
    if (error) {
      console.error('[ChatDos] touch_last_seen', error);
    } else {
      console.log('[ChatDos] touch_last_seen ejecutado con éxito');
    }
  } catch (err) {
    console.error('[ChatDos] touch_last_seen excepción', err);
  }
}
