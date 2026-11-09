// Copia corta del mensaje que se responde. Va cifrada dentro del mensaje,
// así la cita se ve aunque el original no esté cargado en pantalla.
export interface ReplyPreview {
  senderId: string;
  text: string;
  kind: 'text' | 'image' | 'video' | 'audio';
}

export interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface MessagePayload {
  v: number;
  text?: string;
  sentAt: number;
  replyPreview?: ReplyPreview;
  media?: {
    key: string; // AES-GCM raw base64
    mime: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
    thumb?: string;
  };
}

export interface DbMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: 'text' | 'image' | 'video' | 'audio';
  ciphertext: string;
  iv: string;
  media_path: string | null;
  reply_to: string | null;
  view_once: boolean;
  created_at: string;
  edited_at: string | null;
  deleted_for_all: boolean;
  delivered_at: string | null;
  read_at: string | null;
  viewed_at: string | null;
}

export interface DecryptedMessage extends DbMessage {
  payload?: MessagePayload;
  decryptionError?: boolean;
  isPending?: boolean; // Para mensajes optimistas antes de confirmación del servidor
}
