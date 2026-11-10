export interface Profile {
  id: string;
  display_name: string;
  username: string;
  avatar_path: string | null;
  public_key: Record<string, unknown> | null;
  llaves_anteriores?: Record<string, unknown>[] | null; // llaves públicas viejas (para leer mensajes de antes)
  clave_restablecida_at?: string | null; // el administrador le restableció la contraseña
  last_seen: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ChatItem {
  chat_id: string;
  partner: Profile;
}
