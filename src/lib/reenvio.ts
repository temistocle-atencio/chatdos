// Reenviar: lo que se va a reenviar espera aquí hasta que se abre el chat de destino,
// que lo envía con su propia llave (cada chat cifra con la suya).
import type { PendingMedia } from '../components/MediaComposer';
import type { MessagePayload } from '../types/chat';

export interface ItemReenvio {
  /** Texto, enlace, ubicación o contacto */
  especial?: Pick<MessagePayload, 'text' | 'enlace' | 'ubicacion' | 'contacto'>;
  /** Foto, video, audio o sticker (ya descifrado) */
  media?: PendingMedia;
  /** Comentario de la foto o el video */
  comentario?: string;
}

let pendiente: { chatId: string; items: ItemReenvio[] } | null = null;

export function dejarReenvio(chatId: string, items: ItemReenvio[]) {
  pendiente = { chatId, items };
}

/** Lo que hay que reenviar a este chat (y se quita de la espera). */
export function tomarReenvio(chatId: string): ItemReenvio[] | null {
  if (!pendiente || pendiente.chatId !== chatId) return null;
  const { items } = pendiente;
  pendiente = null;
  return items;
}
