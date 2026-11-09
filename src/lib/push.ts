// Notificaciones push, número en el ícono de la app y sonido de mensaje nuevo.
// La notificación nunca lleva el texto (está cifrado): solo quién escribió y el tipo.
import { supabase } from './supabase';

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);

export const isStandalone = (): boolean =>
  (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** En iPhone las notificaciones solo funcionan con la app instalada en la pantalla de inicio. */
export const needsInstallForPush = (): boolean => isIOS() && !isStandalone();

export const pushPermission = (): NotificationPermission | 'unsupported' =>
  isPushSupported() ? Notification.permission : 'unsupported';

const fromB64url = (str: string): Uint8Array => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const toB64url = (buf: ArrayBuffer | null): string => {
  if (!buf) return '';
  let s = '';
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function saveSubscription(sub: PushSubscription) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sin sesión');
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      user_id: data.user.id,
      p256dh: toB64url(sub.getKey('p256dh')),
      auth: toB64url(sub.getKey('auth')),
      user_agent: ua.slice(0, 200),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

/** ¿Este dispositivo ya está recibiendo notificaciones? */
export async function isPushEnabled(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

/** Pide permiso y registra este dispositivo. Debe llamarse desde un toque del usuario. */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error('Este navegador no permite notificaciones.');
  if (needsInstallForPush()) throw new Error('Primero instala ChatDos en tu pantalla de inicio.');

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No diste permiso para las notificaciones.');

  const { data, error } = await supabase.functions.invoke('notificar', { body: { accion: 'clave' } });
  if (error || !data?.publicKey) throw new Error('No se pudo conectar con el servidor de avisos.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const clave = fromB64url(data.publicKey);
  if (sub) {
    // Si la suscripción es de otra llave, se cambia
    const actual = sub.options?.applicationServerKey;
    if (actual && toB64url(actual) !== data.publicKey) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave as BufferSource });
  }
  await saveSubscription(sub);
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** Al abrir la app: si ya había permiso, vuelve a guardar la suscripción (por si cambió). */
export async function refreshPushSubscription(): Promise<void> {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await saveSubscription(sub);
  } catch {
    /* sin importancia */
  }
}

/** Avisar a la otra persona que le llegó un mensaje (no bloquea el envío). */
export function notifyPartner(messageId: string): void {
  supabase.functions.invoke('notificar', { body: { accion: 'enviar', message_id: messageId } }).catch(() => {});
}

/** Número de mensajes sin leer en el ícono de la app. */
export async function updateBadge(): Promise<void> {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: chats } = await supabase.from('chat_members').select('chat_id').eq('user_id', data.user.id);
    const ids = (chats ?? []).map((c) => c.chat_id);
    if (!ids.length) return void (await nav.clearAppBadge?.());
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('chat_id', ids)
      .neq('sender_id', data.user.id)
      .is('read_at', null)
      .eq('deleted_for_all', false);
    if (count) await nav.setAppBadge(count);
    else await nav.clearAppBadge?.();
  } catch {
    /* sin importancia */
  }
}

// ---------- Sonido y vibración ----------
const SOUND_KEY = 'chatdos-sound';

export const isSoundOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};

export const setSoundOn = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* nada */
  }
};

let ctx: AudioContext | null = null;

/** iPhone solo deja sonar audio después de un toque: se "desbloquea" en el primer toque. */
export function unlockSound() {
  const desbloquear = () => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ctx && AC) ctx = new AC();
      if (ctx?.state === 'suspended') ctx.resume();
      // Un sonido mudo para terminar de habilitarlo en Safari
      if (ctx) {
        const b = ctx.createBuffer(1, 1, 22050);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      }
    } catch {
      /* nada */
    }
  };
  window.addEventListener('touchend', desbloquear, { once: true, passive: true });
  window.addEventListener('click', desbloquear, { once: true });
}

/** "Tin-tin" suave de mensaje nuevo + vibración corta (en Android). */
export function playIncoming(kind: 'chat' | 'list' = 'chat') {
  if (!isSoundOn()) return;
  try {
    navigator.vibrate?.(kind === 'chat' ? 40 : [60, 40, 60]);
  } catch {
    /* nada */
  }
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const tonos = kind === 'chat' ? [880] : [784, 1046];
  tonos.forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const ini = t + i * 0.12;
    g.gain.setValueAtTime(0.0001, ini);
    g.gain.exponentialRampToValueAtTime(0.18, ini + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ini + 0.22);
    o.connect(g).connect(ctx!.destination);
    o.start(ini);
    o.stop(ini + 0.25);
  });
}

/** Al abrir un chat: quitar sus avisos de la pantalla y actualizar el número del ícono. */
export async function clearChatNotifications(chatId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const avisos = (await reg?.getNotifications({ tag: chatId })) ?? [];
    avisos.forEach((n) => n.close());
  } catch {
    /* nada */
  }
  setTimeout(updateBadge, 1500);
}
