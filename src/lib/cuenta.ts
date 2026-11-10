// Cambiar usuario y contraseñas, y la "bóveda" de datos de acceso del invitado.
// La bóveda se guarda CIFRADA con la llave del chat entre el invitado y su administrador:
// solo ellos dos la pueden abrir. El servidor nunca ve las contraseñas.
import { supabase } from './supabase';
import { changeBackupPassword, decryptJSON, encryptJSON, getChatKey, getLocalPrivateKey } from './crypto';

export interface DatosAcceso {
  usuario?: string;
  contrasena?: string;
  respaldo?: string; // contraseña de respaldo (protege la llave de cifrado)
  actualizado?: number;
}

const DOMINIO = 'chatdos.invalid';

// ---------- Usuario ----------
export async function cambiarMiUsuario(nuevo: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('admin-invitados', { body: { accion: 'mi_usuario', usuario: nuevo } });
  if (error || data?.error) throw new Error(data?.error || (await mensajeDeError(error)) || 'No se pudo cambiar el usuario');
  return data.usuario as string;
}

export async function cambiarUsuarioInvitado(invitadoId: string, nuevo: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('admin-invitados', {
    body: { accion: 'cambiar_usuario', invitado_id: invitadoId, usuario: nuevo },
  });
  if (error || data?.error) throw new Error(data?.error || (await mensajeDeError(error)) || 'No se pudo cambiar el usuario');
  return data.usuario as string;
}

async function mensajeDeError(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') return (await ctx.json())?.error ?? null;
  } catch {
    /* nada */
  }
  return null;
}

// ---------- Contraseña para entrar ----------
export async function cambiarMiContrasena(usuario: string, actual: string, nueva: string): Promise<void> {
  if (nueva.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
  // Primero se confirma la contraseña actual
  const { error: errActual } = await supabase.auth.signInWithPassword({ email: `${usuario}@${DOMINIO}`, password: actual });
  if (errActual) throw new Error('La contraseña actual no es correcta.');
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw new Error(error.message.includes('different') ? 'La nueva contraseña debe ser distinta a la actual.' : 'No se pudo cambiar la contraseña.');
}

// ---------- Contraseña de respaldo ----------
export const cambiarMiRespaldo = (userId: string, actual: string, nueva: string) => changeBackupPassword(userId, actual, nueva);

// ---------- Bóveda (cifrada con la llave del chat) ----------
async function llaveChat(userId: string, chatId: string, publicaDelOtro: unknown): Promise<CryptoKey> {
  const priv = await getLocalPrivateKey(userId);
  if (!priv || !publicaDelOtro) throw new Error('Falta la llave de cifrado.');
  return getChatKey(chatId, priv, publicaDelOtro as JsonWebKey);
}

/** Para el invitado: su único chat y la llave pública del administrador. */
async function miChatConAdmin(userId: string): Promise<{ chatId: string; publica: unknown } | null> {
  const { data: mio } = await supabase.from('chat_members').select('chat_id').eq('user_id', userId).limit(1).maybeSingle();
  if (!mio) return null;
  const { data: otro } = await supabase.from('chat_members').select('user_id').eq('chat_id', mio.chat_id).neq('user_id', userId).maybeSingle();
  if (!otro) return null;
  const { data: perfil } = await supabase.from('profiles').select('public_key').eq('id', otro.user_id).maybeSingle();
  if (!perfil?.public_key) return null;
  return { chatId: mio.chat_id, publica: perfil.public_key };
}

export async function leerBoveda(userId: string, chatId: string, publicaDelOtro: unknown): Promise<DatosAcceso | null> {
  const { data } = await supabase.from('credenciales').select('ciphertext, iv').eq('chat_id', chatId).maybeSingle();
  if (!data) return null;
  try {
    return await decryptJSON<DatosAcceso>(await llaveChat(userId, chatId, publicaDelOtro), data.ciphertext, data.iv);
  } catch {
    return null;
  }
}

export async function guardarEnBoveda(
  userId: string,
  chatId: string,
  publicaDelOtro: unknown,
  cambios: DatosAcceso
): Promise<void> {
  const llave = await llaveChat(userId, chatId, publicaDelOtro);
  const actual = (await leerBoveda(userId, chatId, publicaDelOtro)) ?? {};
  const nuevo: DatosAcceso = { ...actual, ...cambios, actualizado: Date.now() };
  const cif = await encryptJSON(llave, nuevo);
  const { error } = await supabase
    .from('credenciales')
    .upsert({ chat_id: chatId, ciphertext: cif.ciphertext, iv: cif.iv, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' });
  if (error) throw error;
}

/** El invitado guarda sus datos para que su administrador los pueda ver (no falla si no se puede). */
export async function compartirConAdmin(userId: string, cambios: DatosAcceso): Promise<void> {
  try {
    const chat = await miChatConAdmin(userId);
    if (chat) await guardarEnBoveda(userId, chat.chatId, chat.publica, cambios);
  } catch (e) {
    console.warn('[cuenta] no se pudo guardar en la bóveda', e);
  }
}

// La contraseña escrita al iniciar sesión se guarda SOLO en memoria (nunca en el celular)
// hasta que el invitado tenga su llave y se pueda guardar cifrada en la bóveda.
let accesoPendiente: { usuario: string; contrasena: string } | null = null;
export const recordarAcceso = (usuario: string, contrasena: string) => {
  accesoPendiente = { usuario, contrasena };
};
export const tomarAccesoPendiente = () => {
  const a = accesoPendiente;
  accesoPendiente = null;
  return a;
};
