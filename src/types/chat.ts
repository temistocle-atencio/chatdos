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
    name?: string; // nombre del archivo (canciones)
    music?: boolean; // true = archivo de audio elegido del celular, false = nota de voz
    sticker?: boolean; // se muestra sin burbuja, como sticker
    hd?: boolean; // foto enviada en alta calidad (lleva la marca "HD")
    // Foto en calidad ORIGINAL guardada aparte (cifrada) en Cloudflare R2
    original?: {
      ruta: string;
      key: string; // llave AES del archivo original (base64)
      size: number; // bytes de la foto original
      mime: string;
    };
  };
  // Registro de una llamada (se muestra como burbuja especial)
  llamada?: {
    tipo: 'voz' | 'video';
    estado: 'completada' | 'perdida' | 'rechazada' | 'cancelada';
    duracion: number; // segundos
  };
  // Ubicación enviada (se muestra con un mapa pequeño)
  ubicacion?: {
    lat: number;
    lng: number;
    precision?: number; // metros
    vivo?: { hasta: number }; // en tiempo real hasta esta hora (ms)
  };
  // Vista previa de un enlace (la arma quien envía; quien recibe no visita la página)
  enlace?: {
    url: string;
    titulo?: string;
    descripcion?: string;
    sitio?: string;
    imagen?: string; // miniatura en data:image/jpeg;base64
  };
  // Fotos o videos enviados juntos: se muestran como un álbum (id común, cuántos son y cuál es este)
  album?: { id: string; n: number; i: number };
  // Mensaje reenviado (se marca "Reenviado" en la burbuja)
  reenviado?: boolean;
  // Contacto enviado (tarjeta con nombre y números)
  contacto?: {
    nombre: string;
    telefonos: string[];
    correo?: string;
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
  expires_at?: string | null; // mensajes temporales: cuándo se borra
}

export interface DecryptedMessage extends DbMessage {
  payload?: MessagePayload;
  decryptionError?: boolean;
  isPending?: boolean; // Para mensajes optimistas antes de confirmación del servidor
}
