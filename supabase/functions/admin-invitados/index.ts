// Edge Function "admin-invitados"
// Solo el administrador la puede usar. Acciones:
//   { accion: "crear", nombre, usuario, clave }      -> crea la cuenta y su chat con el administrador
//   { accion: "asignar_clave", invitado_id, clave }  -> le pone una contraseña (a la persona le sale un aviso)
//   { accion: "eliminar", invitado_id }              -> borra al invitado, su chat y sus archivos
//   { accion: "cambiar_usuario", invitado_id, usuario } -> cambia el usuario de un invitado
//   { accion: "vaciar_chat", invitado_id }           -> borra todos los mensajes y archivos del chat (para los dos)
// Cualquier persona con sesión (no hace falta ser administrador):
//   { accion: "mi_usuario", usuario }                -> cambia su propio usuario
// La clave service_role solo vive aquí, en el servidor de Supabase. Nunca en la app.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const DOMINIO = 'chatdos.invalid'; // dominio reservado: nunca recibe correos

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FORMATO_USUARIO = /^[a-z0-9_.]{3,20}$/;
const ERROR_FORMATO = 'El usuario debe tener de 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo';

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  try {
    const servicio = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // 1. ¿Quién llama? Debe tener sesión y ser administrador
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: quien, error: errQuien } = await servicio.auth.getUser(token);
    if (errQuien || !quien.user) return responder({ error: 'Debes iniciar sesión' }, 401);
    const adminId = quien.user.id;
    const cuerpo = await req.json().catch(() => ({}));
    const accion = String(cuerpo.accion ?? '');

    // Cambia el usuario de una cuenta (el inicio de sesión usa usuario@chatdos.invalid)
    const cambiarUsuario = async (id: string, nuevoCrudo: unknown) => {
      const nuevo = String(nuevoCrudo ?? '').trim().toLowerCase();
      if (!FORMATO_USUARIO.test(nuevo)) return responder({ error: ERROR_FORMATO }, 400);
      const { data: ocupado } = await servicio.from('profiles').select('id').eq('username', nuevo).neq('id', id).maybeSingle();
      if (ocupado) return responder({ error: 'Ese usuario ya lo tiene otra persona' }, 400);
      const { error: errAuth } = await servicio.auth.admin.updateUserById(id, { email: `${nuevo}@${DOMINIO}`, email_confirm: true });
      if (errAuth) {
        const yaExiste = (errAuth.message ?? '').toLowerCase().includes('already');
        return responder({ error: yaExiste ? 'Ese usuario ya lo tiene otra persona' : 'No se pudo cambiar el usuario' }, 400);
      }
      const { error: errPerfil } = await servicio.from('profiles').update({ username: nuevo }).eq('id', id);
      if (errPerfil) return responder({ error: 'No se pudo guardar el usuario' }, 500);
      return responder({ ok: true, usuario: nuevo });
    };

    // ---------- MI USUARIO (cualquier persona, sobre su propia cuenta) ----------
    if (accion === 'mi_usuario') return await cambiarUsuario(adminId, cuerpo.usuario);

    const { data: esAdmin } = await servicio
      .from('app_admins').select('user_id').eq('user_id', adminId).maybeSingle();
    if (!esAdmin) return responder({ error: 'Solo el administrador puede hacer esto' }, 403);

    // ---------- CREAR ----------
    if (accion === 'crear') {
      const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase();
      const clave = String(cuerpo.clave ?? '');
      const nombre = String(cuerpo.nombre ?? '').trim().slice(0, 40) || usuario;

      if (!/^[a-z0-9_.]{3,20}$/.test(usuario)) {
        return responder({ error: 'El usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo' }, 400);
      }
      if (clave.length < 8) {
        return responder({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
      }

      const { data: creado, error: errCrear } = await servicio.auth.admin.createUser({
        email: `${usuario}@${DOMINIO}`,
        password: clave,
        email_confirm: true,
        user_metadata: { display_name: nombre },
      });
      if (errCrear || !creado.user) {
        const yaExiste = (errCrear?.message ?? '').toLowerCase().includes('already');
        return responder({ error: yaExiste ? 'Ese usuario ya existe' : 'No se pudo crear el usuario' }, 400);
      }
      const invitadoId = creado.user.id;

      const { data: chat, error: errChat } = await servicio
        .from('chats').insert({ created_by: adminId }).select('id').single();
      if (errChat || !chat) {
        await servicio.auth.admin.deleteUser(invitadoId);
        return responder({ error: 'No se pudo crear el chat' }, 500);
      }

      const { error: errMiembros } = await servicio.from('chat_members').insert([
        { chat_id: chat.id, user_id: adminId },
        { chat_id: chat.id, user_id: invitadoId },
      ]);
      if (errMiembros) {
        await servicio.from('chats').delete().eq('id', chat.id);
        await servicio.auth.admin.deleteUser(invitadoId);
        return responder({ error: 'No se pudo crear el chat' }, 500);
      }

      return responder({ ok: true, chat_id: chat.id, invitado_id: invitadoId, usuario });
    }

    // Para cambiar clave o eliminar: el invitado debe tener chat con este administrador
    const invitadoId = String(cuerpo.invitado_id ?? '');
    if (!invitadoId || invitadoId === adminId) {
      return responder({ error: 'Invitado no válido' }, 400);
    }
    const { data: filas } = await servicio
      .from('chat_members').select('chat_id, user_id').in('user_id', [adminId, invitadoId]);
    const chatsDelAdmin = new Set((filas ?? []).filter((f) => f.user_id === adminId).map((f) => f.chat_id));
    const chatId = (filas ?? []).find((f) => f.user_id === invitadoId && chatsDelAdmin.has(f.chat_id))?.chat_id;
    if (!chatId) return responder({ error: 'Esa persona no tiene chat contigo' }, 404);

    // ---------- CAMBIAR USUARIO DE UN INVITADO ----------
    if (accion === 'cambiar_usuario') return await cambiarUsuario(invitadoId, cuerpo.usuario);

    // ---------- ASIGNAR CLAVE ----------
    // El administrador le pone una contraseña al invitado. A la persona le aparece un aviso
    // (así nunca se cambia a escondidas) y la puede cambiar cuando quiera.
    if (accion === 'asignar_clave') {
      const clave = String(cuerpo.clave ?? '');
      if (clave.length < 8) return responder({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
      const { error } = await servicio.auth.admin.updateUserById(invitadoId, { password: clave });
      if (error) return responder({ error: 'No se pudo cambiar la contraseña' }, 500);
      await servicio.from('profiles').update({ clave_restablecida_at: new Date().toISOString() }).eq('id', invitadoId);
      return responder({ ok: true });
    }

    // Archivos del chat: media/<chat_id>/<user_id>/...
    const borrarArchivosDelChat = async () => {
      const { data: carpetas } = await servicio.storage.from('media').list(chatId, { limit: 100 });
      for (const carpeta of carpetas ?? []) {
        const ruta = `${chatId}/${carpeta.name}`;
        let archivos = await servicio.storage.from('media').list(ruta, { limit: 1000 });
        while ((archivos.data ?? []).length > 0) {
          await servicio.storage.from('media').remove(archivos.data!.map((a) => `${ruta}/${a.name}`));
          archivos = await servicio.storage.from('media').list(ruta, { limit: 1000 });
        }
      }
    };

    // ---------- VACIAR CHAT PARA LOS DOS ----------
    if (accion === 'vaciar_chat') {
      await borrarArchivosDelChat();
      const { error } = await servicio.from('messages').delete().eq('chat_id', chatId); // reacciones en cascada
      if (error) return responder({ error: 'No se pudo vaciar el chat' }, 500);
      return responder({ ok: true });
    }

    // ---------- ELIMINAR ----------
    if (accion === 'eliminar') {
      await borrarArchivosDelChat();
      // Foto de perfil y fondo del invitado
      const { data: fotos } = await servicio.storage.from('profile').list(invitadoId);
      if ((fotos ?? []).length > 0) {
        await servicio.storage.from('profile').remove(fotos!.map((f) => `${invitadoId}/${f.name}`));
      }

      // Stickers del invitado
      const { data: stickers } = await servicio.storage.from('stickers').list(invitadoId, { limit: 1000 });
      if ((stickers ?? []).length > 0) {
        await servicio.storage.from('stickers').remove(stickers!.map((f) => `${invitadoId}/${f.name}`));
      }

      await servicio.from('chats').delete().eq('id', chatId); // borra mensajes y reacciones en cascada
      const { error } = await servicio.auth.admin.deleteUser(invitadoId);
      if (error) return responder({ error: 'No se pudo eliminar la cuenta' }, 500);
      return responder({ ok: true });
    }

    return responder({ error: 'Acción no válida' }, 400);
  } catch (_e) {
    return responder({ error: 'Ocurrió un error inesperado' }, 500);
  }
});
