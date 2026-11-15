// Edge Function "notificar"
//   { accion: "clave" }                 -> devuelve la llave pública para suscribirse
//   { accion: "enviar", message_id }    -> avisa a la otra persona que llegó un mensaje
//   { accion: "llamada", chat_id, tipo } -> avisa a la otra persona que la están llamando
//   { accion: "turn" }                  -> credenciales del servidor de paso para las llamadas
//   { accion: "enlace", url }           -> vista previa de un enlace (título, descripción e imagen)
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

// ---------- Vista previa de enlaces ----------
// Solo páginas públicas: nada de direcciones internas (evita que se use para entrar a redes privadas).
function direccionPrivada(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

const entidades = (t: string) =>
  t
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, nombres: string[]): string | undefined {
  for (const n of nombres) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${n}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return entidades(m[1]);
  }
  return undefined;
}

async function leerLimitado(r: Response, max: number): Promise<Uint8Array> {
  const lector = r.body?.getReader();
  if (!lector) return new Uint8Array();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await lector.read();
    if (done || !value) break;
    partes.push(value);
    total += value.length;
  }
  lector.cancel().catch(() => {});
  const todo = new Uint8Array(Math.min(total, max));
  let pos = 0;
  for (const p of partes) {
    const trozo = p.subarray(0, Math.min(p.length, todo.length - pos));
    todo.set(trozo, pos);
    pos += trozo.length;
    if (pos >= todo.length) break;
  }
  return todo;
}

async function traer(url: URL, acepta: string): Promise<Response | null> {
  let actual = url;
  for (let i = 0; i < 4; i++) {
    if (!/^https?:$/.test(actual.protocol) || direccionPrivada(actual.hostname)) return null;
    const r = await fetch(actual, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: {
        // Muchas páginas solo dan la vista previa a los "lectores de enlaces" de las redes sociales
        'User-Agent': 'Mozilla/5.0 (compatible; ChatDosBot/1.0; +https://temistocle-atencio.github.io/chatdos/) facebookexternalhit/1.1',
        Accept: acepta,
        'Accept-Language': 'es,en;q=0.8',
      },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      actual = new URL(r.headers.get('location')!, actual);
      continue;
    }
    return r.ok ? r : null;
  }
  return null;
}

function aBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function vistaPrevia(texto: string) {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { error: 'Enlace no válido' };
  }
  const r = await traer(url, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5').catch(() => null);
  if (!r) return { url: url.href, sitio: url.hostname.replace(/^www\./, '') };
  const tipo = r.headers.get('content-type') ?? '';
  let titulo: string | undefined;
  let descripcion: string | undefined;
  let sitio: string | undefined;
  let imagenUrl: string | undefined;

  if (tipo.startsWith('image/')) {
    imagenUrl = r.url || url.href;
  } else {
    const bytes = await leerLimitado(r, 600_000);
    const juego = (tipo.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8').toLowerCase();
    let html: string;
    try {
      html = new TextDecoder(juego).decode(bytes);
    } catch {
      html = new TextDecoder().decode(bytes);
    }
    titulo = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? entidades(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : undefined);
    descripcion = meta(html, ['og:description', 'twitter:description', 'description']);
    sitio = meta(html, ['og:site_name', 'application-name']);
    const img = meta(html, ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src', 'image']);
    if (img) {
      try {
        imagenUrl = new URL(img, r.url || url.href).href;
      } catch {
        /* imagen con dirección rara */
      }
    }
  }

  // La imagen se trae aquí y se devuelve como datos: así quien recibe no visita la página
  let imagen: string | undefined;
  if (imagenUrl) {
    try {
      const ri = await traer(new URL(imagenUrl), 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8');
      const ti = ri?.headers.get('content-type') ?? '';
      if (ri && ti.startsWith('image/') && !ti.includes('svg')) {
        const b = await leerLimitado(ri, 3_000_000);
        if (b.length < 3_000_000) imagen = `data:${ti.split(';')[0]};base64,${aBase64(b)}`;
      }
    } catch {
      /* sin imagen */
    }
  }

  const corto = (t: string | undefined, n: number) => (t && t.length > n ? t.slice(0, n - 1) + '…' : t);
  return {
    url: url.href,
    titulo: corto(titulo, 200),
    descripcion: corto(descripcion, 300),
    sitio: corto(sitio, 60) ?? url.hostname.replace(/^www\./, ''),
    imagen,
  };
}

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

    // ---------- Vista previa de un enlace ----------
    // Lee la página una vez (sin guardar nada) y devuelve título, descripción, sitio y una imagen pequeña.
    if (cuerpo.accion === 'enlace') {
      return responder(await vistaPrevia(String(cuerpo.url ?? '')));
    }

    // ---------- Servidor de paso para llamadas (TURN de Cloudflare) ----------
    // Entrega credenciales que duran 24 horas. La llave de Cloudflare vive solo aquí (secretos de Supabase).
    if (cuerpo.accion === 'turn') {
      const llaveTurn = Deno.env.get('CF_TURN_KEY_ID');
      const tokenTurn = Deno.env.get('CF_TURN_TOKEN');
      if (!llaveTurn || !tokenTurn) return responder({ iceServers: null });
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${llaveTurn}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenTurn}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 }),
      });
      if (!r.ok) {
        console.error('turn error', r.status, await r.text());
        return responder({ iceServers: null });
      }
      const j = await r.json();
      const lista = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : null;
      return responder({ iceServers: lista });
    }

    // ---------- Llamada entrante ----------
    if (cuerpo.accion === 'llamada') {
      const chatId = String(cuerpo.chat_id ?? '');
      const { data: miembros } = await servicio.from('chat_members').select('user_id').eq('chat_id', chatId);
      if (!(miembros ?? []).some((m) => m.user_id === yo)) return responder({ error: 'Chat no válido' }, 400);
      const destino = (miembros ?? []).map((m) => m.user_id).find((id) => id !== yo);
      if (!destino) return responder({ ok: true, omitido: 'sin destino' });
      const { data: perfil } = await servicio.from('profiles').select('display_name').eq('id', yo).maybeSingle();
      const { data: subs } = await servicio.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', destino);
      const payload = {
        title: perfil?.display_name || 'ChatDos',
        body: cuerpo.tipo === 'video' ? '🎥 Te está haciendo una videollamada' : '📞 Te está llamando',
        url: `/chatdos/#/chat/${chatId}`,
        tag: `llamada-${chatId}`,
        llamada: true,
      };
      let enviadas = 0;
      for (const s of subs ?? []) {
        try {
          const estado = await sendPush(s, payload, { publicKey: llaves.public_key, privateJwk: llaves.private_jwk, subject: SUBJECT });
          if (estado === 404 || estado === 410) await servicio.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          else if (estado < 300) enviadas++;
        } catch (e) {
          console.error('push error', e);
        }
      }
      return responder({ ok: true, enviadas });
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

    // ¿La otra persona silenció este chat? Entonces no se le avisa.
    const { data: silencio } = await servicio
      .from('chat_mutes')
      .select('muted_until')
      .eq('user_id', destino)
      .eq('chat_id', msg.chat_id)
      .maybeSingle();
    if (silencio && new Date(silencio.muted_until).getTime() > Date.now()) {
      return responder({ ok: true, omitido: 'silenciado' });
    }

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
