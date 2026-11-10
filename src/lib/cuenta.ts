// Cambiar usuario y contraseñas. Cada persona conoce solo sus propias contraseñas:
// el administrador puede restablecer la de un invitado, pero nunca verla.
import { supabase } from './supabase';
import { changeBackupPassword } from './crypto';

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

// ---------- Restablecer (administrador) ----------
/** Le pone una contraseña temporal al invitado. Se muestra una sola vez; a ella le llega un aviso. */
export async function restablecerClaveInvitado(invitadoId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('admin-invitados', {
    body: { accion: 'restablecer_clave', invitado_id: invitadoId },
  });
  if (error || data?.error || !data?.temporal) {
    throw new Error(data?.error || (await mensajeDeError(error)) || 'No se pudo restablecer la contraseña');
  }
  return data.temporal as string;
}

// ---------- Aviso de contraseña restablecida (invitado) ----------
export async function leerAvisoClave(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('clave_restablecida_at').eq('id', userId).maybeSingle();
  return (data as { clave_restablecida_at?: string | null } | null)?.clave_restablecida_at ?? null;
}

/** Pone la contraseña nueva (que solo ella conoce) y quita el aviso. */
export async function ponerClaveTrasRestablecer(userId: string, nueva: string): Promise<void> {
  if (nueva.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('different')) throw new Error('Pon una contraseña distinta a la temporal.');
    if (m.includes('reauth') || m.includes('nonce') || m.includes('recent')) {
      throw new Error('Por seguridad, cierra sesión y vuelve a entrar con la contraseña temporal que te dio el administrador.');
    }
    throw new Error('No se pudo guardar la contraseña. Revisa tu conexión.');
  }
  await supabase.from('profiles').update({ clave_restablecida_at: null }).eq('id', userId);
}
