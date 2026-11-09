// Edge Function "notificar"
//   { accion: "clave" }                 -> devuelve la llave pública para suscribirse
//   { accion: "enviar", message_id }    -> avisa a la otra persona que llegó un mensaje
// La notificación NUNCA lleva el texto del mensaje (está cifrado de extremo a extremo):
// solo dice quién escribió y qué tipo de mensaje es.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createVapidKeys, sendPush } from './webpush.ts';

const SUBJECT = 'https://temistocle-atencio.github.io/chatdos/';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...cors, 'Content-Type': 'application/json' } });

const TIPO: Record<string, string> = {
  text: 'Te envió un mensaje',
  image: 'Te envió una foto',
  video: 'Te envió un video',
  audio: 'Te envió un audio',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  try {
    const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: quien } = await servicio.auth.getUser(token);
    if (!quien?.user) return responder({ error: 'Debes iniciar sesión' }, 401);
    const yo = quien.user.id;

    // Llaves VAPID: se crean la primera vez y quedan guardadas (nadie más las puede leer)
    let { data: llaves } = await servicio.from('push_keys').select('public_key, private_jwk').eq('id', 1).maybeSingle();
    if (!llaves) {
      const nuevas = await createVapidKeys();
      await servicio.from('push_keys').insert({ id: 1, public_key: nuevas.publicKey, private_jwk: nuevas.privateJwk });
      const r = await servicio.from('push_keys').select('public_key, private_jwk').eq('id', 1).single();
      llaves = r.data;
    }
    if (!llaves) return responder({ error: 'No se pudieron preparar las notificaciones' }, 500);

    const cuerpo = await req.json().catch(() => ({}));

    if (cuerpo.accion === 'clave') {
      return responder({ publicKey: llaves.public_key });
    }

    if (cuerpo.accion !== 'enviar') return responder({ error: 'Acción no válida' }, 400);

    // El mensaje debe ser mío y reciente (evita avisos repetidos o falsos)
    const { data: msg } = await servicio
      .from('messages')
      .select('id, chat_id, sender_id, kind, view_once, created_at')
      .eq('id', String(cuerpo.message_id ?? ''))
      .maybeSingle();
    if (!msg || msg.sender_id !== yo) return responder({ error: 'Mensaje no válido' }, 400);
    if (Date.now() - new Date(msg.created_at).getTime() > 10 * 60 * 1000) return responder({ ok: true, omitido: 'viejo' });

    const { data: miembros } = await servicio.from('chat_members').select('user_id').eq('chat_id', msg.chat_id);
    const destino = (miembros ?? []).map((m) => m.user_id).find((id) => id !== yo);
    if (!destino) return responder({ ok: true, omitido: 'sin destino' });

    const { data: perfil } = await servicio.from('profiles').select('display_name').eq('id', yo).maybeSingle();

    // Mensajes sin leer de la otra persona (para el número en el ícono de la app)
    const { data: susChats } = await servicio.from('chat_members').select('chat_id').eq('user_id', destino);
    const { count } = await servicio
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('chat_id', (susChats ?? []).map((c) => c.chat_id))
      .neq('sender_id', destino)
      .is('read_at', null)
      .eq('deleted_for_all', false);

    const { data: subs } = await servicio.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', destino);

    const payload = {
      title: perfil?.display_name || 'ChatDos',
      body: msg.view_once ? 'Te envió algo para ver una vez' : TIPO[msg.kind] || 'Te envió un mensaje',
      url: `/chatdos/#/chat/${msg.chat_id}`,
      tag: msg.chat_id,
      badge: count ?? 1,
    };

    let enviadas = 0;
    for (const s of subs ?? []) {
      try {
        const estado = await sendPush(s, payload, {
          publicKey: llaves.public_key,
          privateJwk: llaves.private_jwk,
          subject: SUBJECT,
        });
        if (estado === 404 || estado === 410) {
          // El celular ya no acepta avisos (se desinstaló o se quitó el permiso)
          await servicio.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        } else if (estado < 300) {
          enviadas++;
        } else {
          console.error('push rechazado', estado, new URL(s.endpoint).host);
        }
      } catch (e) {
        console.error('push error', e);
      }
    }
    return responder({ ok: true, enviadas });
  } catch (e) {
    console.error(e);
    return responder({ error: 'Ocurrió un error inesperado' }, 500);
  }
});
