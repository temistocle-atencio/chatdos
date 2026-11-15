// Llamadas de voz y video (WebRTC). La llamada va directa de celular a celular y cifrada por el navegador.
// Las señales para conectarse viajan por el canal privado del chat, además CIFRADAS con la llave del chat,
// así nadie (ni el servidor) puede meterse en medio.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { memoria } from './memoria';
import { decryptJSON, encryptJSON, getChatKey, getLocalPrivateKey } from './crypto';
import { enviarSenal, escucharSenales } from './enLinea';
import type { MessagePayload } from '../types/chat';

export type TipoLlamada = 'voz' | 'video';
export type Calidad = 'auto' | '360' | '720' | '1080';
export type EstadoLlamada = 'llamando' | 'sonando' | 'conectando' | 'en_curso' | 'terminada';

export interface Llamada {
  id: string;
  chatId: string;
  otroId: string;
  otroNombre: string;
  otroFoto: string | null;
  tipo: TipoLlamada;
  entrante: boolean;
  estado: EstadoLlamada;
  timbrando: boolean; // la otra persona ya está viendo la llamada
  inicio: number | null;
  local: MediaStream | null;
  remota: MediaStream | null;
  mic: boolean;
  cam: boolean;
  camOtro: boolean;
  frontal: boolean;
  calidad: Calidad;
  recibiendo: number | null; // alto del video que llega (p. ej. 720)
  senal: 'buena' | 'regular' | 'debil' | null;
  mensaje: string | null; // texto al terminar
}

// Servidores para encontrar el camino entre los dos celulares.
// (Para redes muy cerradas hará falta un servidor de paso TURN; se agrega con Cloudflare.)
const ICE: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

const CALIDADES: Record<Exclude<Calidad, 'auto'>, { alto: number; ancho: number; bits: number }> = {
  '360': { alto: 360, ancho: 640, bits: 500_000 },
  '720': { alto: 720, ancho: 1280, bits: 1_500_000 },
  '1080': { alto: 1080, ancho: 1920, bits: 3_500_000 },
};

// ---------- Estado compartido ----------
let actual: Llamada | null = null;
let miId: string | null = null;
let pc: RTCPeerConnection | null = null;
let iceEnEspera: RTCIceCandidateInit[] = [];
let reintento: ReturnType<typeof setInterval> | null = null;
let limite: ReturnType<typeof setTimeout> | null = null;
let medidor: ReturnType<typeof setInterval> | null = null;
let caida: ReturnType<typeof setTimeout> | null = null;
let timbre: { parar: () => void } | null = null;
const avisos = new Set<(l: Llamada | null) => void>();
const llaves = new Map<string, CryptoKey>();

const cambiar = (c: Partial<Llamada>) => {
  if (!actual) return;
  actual = { ...actual, ...c };
  avisos.forEach((f) => f(actual));
};

export function useLlamada(): Llamada | null {
  const [l, setL] = useState(actual);
  useEffect(() => {
    avisos.add(setL);
    setL(actual);
    return () => {
      avisos.delete(setL);
    };
  }, []);
  return l;
}

const calidadGuardada = (): Calidad => {
  try {
    return (localStorage.getItem('chatdos-calidad') as Calidad) || 'auto';
  } catch {
    return 'auto';
  }
};

// ---------- Datos de la otra persona y llave del chat ----------
async function datosDelChat(chatId: string) {
  let otro = memoria.companeros.get(chatId);
  if (!otro?.public_key) {
    const { data: m } = await supabase.from('chat_members').select('user_id').eq('chat_id', chatId).neq('user_id', miId!).maybeSingle();
    if (m) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', m.user_id).maybeSingle();
      if (p) {
        otro = p as typeof otro;
        memoria.companeros.set(chatId, otro!);
      }
    }
  }
  if (!otro?.public_key) throw new Error('La otra persona todavía no tiene cifrado.');
  const k = `${chatId}|${JSON.stringify(otro.public_key)}`;
  let llave = llaves.get(k);
  if (!llave) {
    const priv = await getLocalPrivateKey(miId!);
    if (!priv) throw new Error('Falta tu llave de cifrado.');
    llave = await getChatKey(chatId, priv, otro.public_key as JsonWebKey);
    llaves.set(k, llave);
  }
  return { otro, llave };
}

async function senal(chatId: string, datos: Record<string, unknown>) {
  const { llave } = await datosDelChat(chatId);
  const cifrado = await encryptJSON(llave, { ...datos, en: Date.now() });
  return enviarSenal(chatId, { de: miId, ...cifrado });
}

// ---------- Timbre (sonido hecho con el navegador) ----------
function sonar(entrante: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    let vivo = true;
    const tono = () => {
      if (!vivo) return;
      const t = ctx.currentTime;
      const notas = entrante ? [659, 784, 988, 784] : [440, 480];
      notas.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        o.type = 'sine';
        const ini = entrante ? t + i * 0.18 : t;
        const dur = entrante ? 0.16 : 1.2;
        g.gain.setValueAtTime(0, ini);
        g.gain.linearRampToValueAtTime(entrante ? 0.18 : 0.08, ini + 0.02);
        g.gain.setValueAtTime(entrante ? 0.18 : 0.08, ini + dur - 0.03);
        g.gain.linearRampToValueAtTime(0, ini + dur);
        o.connect(g).connect(ctx.destination);
        o.start(ini);
        o.stop(ini + dur);
      });
      if (entrante) navigator.vibrate?.([400, 200, 400]);
    };
    tono();
    const cada = setInterval(tono, entrante ? 2000 : 3000);
    return {
      parar: () => {
        vivo = false;
        clearInterval(cada);
        navigator.vibrate?.(0);
        ctx.close().catch(() => {});
      },
    };
  } catch {
    return { parar: () => {} };
  }
}

const pararTimbre = () => {
  timbre?.parar();
  timbre = null;
};

// ---------- Cámara y micrófono ----------
async function pedirMedios(tipo: TipoLlamada, frontal = true) {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio,
      video:
        tipo === 'video'
          ? { facingMode: frontal ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
          : false,
    });
  } catch (e) {
    const n = (e as DOMException)?.name;
    throw new Error(
      n === 'NotAllowedError'
        ? tipo === 'video'
          ? 'Permite el uso de la cámara y el micrófono para llamar.'
          : 'Permite el uso del micrófono para llamar.'
        : 'No se pudo usar el micrófono o la cámara.'
    );
  }
}

// ---------- Conexión ----------
function crearConexion(chatId: string) {
  const c = new RTCPeerConnection({ iceServers: ICE });
  pc = c;
  iceEnEspera = [];
  actual?.local?.getTracks().forEach((t) => c.addTrack(t, actual!.local!));
  c.onicecandidate = (e) => {
    if (e.candidate) void senal(chatId, { t: 'ice', id: actual?.id, c: e.candidate.toJSON() });
  };
  c.ontrack = (e) => {
    const s = e.streams[0] ?? new MediaStream([e.track]);
    cambiar({ remota: s });
  };
  c.onconnectionstatechange = () => {
    const e = c.connectionState;
    if (e === 'connected') {
      if (caida) clearTimeout(caida);
      caida = null;
      if (actual && actual.estado !== 'en_curso') {
        cambiar({ estado: 'en_curso', inicio: Date.now() });
        medir();
        if (actual.tipo === 'video') aplicarCalidadQuePido(actual.calidad);
      }
    } else if (e === 'disconnected') {
      if (!caida) caida = setTimeout(() => terminar('Se perdió la conexión', true), 10000);
    } else if (e === 'failed') {
      terminar('No se pudo conectar. Puede que la red no lo permita.', true);
    }
  };
  return c;
}

async function agregarIce(c: RTCIceCandidateInit) {
  if (!pc || !pc.remoteDescription) {
    iceEnEspera.push(c);
    return;
  }
  await pc.addIceCandidate(c).catch(() => {});
}

function medir() {
  if (medidor) clearInterval(medidor);
  medidor = setInterval(async () => {
    if (!pc) return;
    const stats = await pc.getStats().catch(() => null);
    if (!stats) return;
    let alto: number | null = null;
    let rtt: number | null = null;
    let perdidos = 0;
    let recibidos = 0;
    stats.forEach((r) => {
      if (r.type === 'inbound-rtp' && r.kind === 'video' && r.frameHeight) alto = r.frameHeight;
      if (r.type === 'inbound-rtp') {
        perdidos += r.packetsLost || 0;
        recibidos += r.packetsReceived || 0;
      }
      if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime != null) rtt = r.currentRoundTripTime;
    });
    const perdida = recibidos ? perdidos / (perdidos + recibidos) : 0;
    const senal = rtt == null ? null : rtt > 0.5 || perdida > 0.08 ? 'debil' : rtt > 0.25 || perdida > 0.03 ? 'regular' : 'buena';
    cambiar({ recibiendo: alto, senal });
  }, 2000);
}

// La otra persona me pidió una calidad: ajusto MI cámara a eso
async function enviarConCalidad(q: Calidad) {
  const emisor = pc?.getSenders().find((s) => s.track?.kind === 'video');
  const pista = emisor?.track;
  if (!emisor || !pista) return;
  const meta = q === 'auto' ? null : CALIDADES[q];
  try {
    await pista.applyConstraints(
      meta ? { width: { ideal: meta.ancho }, height: { ideal: meta.alto }, frameRate: { ideal: 30 } } : { width: { ideal: 1280 }, height: { ideal: 720 } }
    );
  } catch {
    /* la cámara no da más: se usa lo que tenga */
  }
  const p = emisor.getParameters();
  if (!p.encodings || !p.encodings.length) p.encodings = [{}];
  const altoReal = pista.getSettings().height || meta?.alto || 720;
  if (meta) {
    p.encodings[0].maxBitrate = meta.bits;
    p.encodings[0].scaleResolutionDownBy = Math.max(1, altoReal / meta.alto);
  } else {
    delete p.encodings[0].maxBitrate;
    p.encodings[0].scaleResolutionDownBy = 1;
  }
  await emisor.setParameters(p).catch(() => {});
}

function aplicarCalidadQuePido(q: Calidad) {
  if (actual) void senal(actual.chatId, { t: 'calidad', id: actual.id, q });
}

// ---------- Registro en el chat (lo escribe quien llamó) ----------
async function registrar(l: Llamada, estado: NonNullable<MessagePayload['llamada']>['estado']) {
  try {
    const { llave } = await datosDelChat(l.chatId);
    const payload: MessagePayload = {
      v: 1,
      sentAt: Date.now(),
      llamada: { tipo: l.tipo, estado, duracion: l.inicio ? Math.round((Date.now() - l.inicio) / 1000) : 0 },
    };
    const cif = await encryptJSON(llave, payload);
    await supabase.from('messages').insert({
      id: crypto.randomUUID(),
      chat_id: l.chatId,
      sender_id: miId,
      kind: 'text',
      ciphertext: cif.ciphertext,
      iv: cif.iv,
      view_once: false,
    });
  } catch (e) {
    console.warn('[llamada] no se pudo registrar', e);
  }
}

function limpiar() {
  pararTimbre();
  [reintento, medidor].forEach((x) => x && clearInterval(x));
  [limite, caida].forEach((x) => x && clearTimeout(x));
  reintento = medidor = null;
  limite = caida = null;
  actual?.local?.getTracks().forEach((t) => t.stop());
  pc?.close();
  pc = null;
  iceEnEspera = [];
}

function terminar(mensaje: string | null, avisarAlOtro: boolean) {
  const l = actual;
  if (!l || l.estado === 'terminada') return;
  if (avisarAlOtro) void senal(l.chatId, { t: 'colgar', id: l.id });
  if (!l.entrante) {
    const estado = l.estado === 'en_curso' ? 'completada' : mensaje === 'rechazada' ? 'rechazada' : 'perdida';
    void registrar(l, estado);
  }
  limpiar();
  cambiar({
    estado: 'terminada',
    mensaje:
      mensaje === 'rechazada'
        ? `${l.otroNombre} no puede contestar ahora`
        : mensaje === 'ocupado'
          ? `${l.otroNombre} está en otra llamada`
          : mensaje,
  });
  setTimeout(() => {
    if (actual?.id === l.id) {
      actual = null;
      avisos.forEach((f) => f(null));
    }
  }, 1800);
}

// ---------- Acciones ----------
export async function iniciarLlamada(chatId: string, tipo: TipoLlamada) {
  if (actual && actual.estado !== 'terminada') throw new Error('Ya estás en una llamada.');
  if (!miId) throw new Error('Debes iniciar sesión.');
  const { otro } = await datosDelChat(chatId);
  const local = await pedirMedios(tipo);
  const id = crypto.randomUUID();
  actual = {
    id,
    chatId,
    otroId: otro.id,
    otroNombre: otro.display_name || otro.username,
    otroFoto: otro.avatar_path ?? null,
    tipo,
    entrante: false,
    estado: 'llamando',
    timbrando: false,
    inicio: null,
    local,
    remota: null,
    mic: true,
    cam: tipo === 'video',
    camOtro: tipo === 'video',
    frontal: true,
    calidad: calidadGuardada(),
    recibiendo: null,
    senal: null,
    mensaje: null,
  };
  avisos.forEach((f) => f(actual));
  timbre = sonar(false);
  const llamar = () => senal(chatId, { t: 'llamar', id, tipo });
  void llamar();
  // Se repite por si la otra persona abre la app con la notificación
  reintento = setInterval(() => {
    if (actual?.id === id && actual.estado === 'llamando') void llamar();
  }, 3000);
  limite = setTimeout(() => {
    if (actual?.id === id && actual.estado === 'llamando') terminar('No contestó', true);
  }, 45000);
  // Notificación al celular de la otra persona
  supabase.functions.invoke('notificar', { body: { accion: 'llamada', chat_id: chatId, tipo } }).catch(() => {});
}

export async function contestar() {
  const l = actual;
  if (!l || l.estado !== 'sonando') return;
  pararTimbre();
  try {
    const local = await pedirMedios(l.tipo);
    cambiar({ local, estado: 'conectando' });
    crearConexion(l.chatId);
    await senal(l.chatId, { t: 'aceptar', id: l.id });
  } catch (e) {
    void senal(l.chatId, { t: 'rechazar', id: l.id });
    terminar(e instanceof Error ? e.message : 'No se pudo contestar', false);
  }
}

export function rechazar() {
  const l = actual;
  if (!l) return;
  void senal(l.chatId, { t: 'rechazar', id: l.id });
  terminar(null, false);
}

export const colgar = () => terminar(null, true);

export function silenciar() {
  if (!actual?.local) return;
  const mic = !actual.mic;
  actual.local.getAudioTracks().forEach((t) => (t.enabled = mic));
  cambiar({ mic });
}

export function camara() {
  if (!actual?.local) return;
  const cam = !actual.cam;
  actual.local.getVideoTracks().forEach((t) => (t.enabled = cam));
  cambiar({ cam });
  void senal(actual.chatId, { t: 'cam', id: actual.id, on: cam });
}

export async function voltearCamara() {
  const l = actual;
  if (!l?.local || l.tipo !== 'video') return;
  const frontal = !l.frontal;
  try {
    const nuevo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: frontal ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const pista = nuevo.getVideoTracks()[0];
    pista.enabled = l.cam;
    const vieja = l.local.getVideoTracks()[0];
    await pc?.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(pista);
    l.local.removeTrack(vieja);
    vieja.stop();
    l.local.addTrack(pista);
    cambiar({ frontal, local: new MediaStream(l.local.getTracks()) });
  } catch {
    /* sin otra cámara */
  }
}

export function elegirCalidad(q: Calidad) {
  try {
    localStorage.setItem('chatdos-calidad', q);
  } catch {
    /* nada */
  }
  cambiar({ calidad: q });
  if (actual?.estado === 'en_curso') aplicarCalidadQuePido(q);
}

// ---------- Recibir señales ----------
async function alRecibir(chatId: string, crudo: unknown) {
  const sobre = crudo as { de?: string; ciphertext?: string; iv?: string };
  if (!miId || !sobre?.ciphertext || !sobre.iv || sobre.de === miId) return;
  let d: { t: string; id: string; en: number; tipo?: TipoLlamada; c?: RTCIceCandidateInit; sdp?: RTCSessionDescriptionInit; q?: Calidad; on?: boolean };
  try {
    const { llave } = await datosDelChat(chatId);
    d = await decryptJSON(llave, sobre.ciphertext, sobre.iv);
  } catch {
    return; // no viene de la otra persona del chat
  }
  if (Date.now() - d.en > 60000) return; // señal vieja

  if (d.t === 'llamar') {
    if (actual && actual.id === d.id) return; // repetida
    if (actual && actual.estado !== 'terminada') {
      void senal(chatId, { t: 'ocupado', id: d.id });
      return;
    }
    const { otro } = await datosDelChat(chatId);
    const tipo: TipoLlamada = d.tipo === 'video' ? 'video' : 'voz';
    actual = {
      id: d.id,
      chatId,
      otroId: otro.id,
      otroNombre: otro.display_name || otro.username,
      otroFoto: otro.avatar_path ?? null,
      tipo,
      entrante: true,
      estado: 'sonando',
      timbrando: true,
      inicio: null,
      local: null,
      remota: null,
      mic: true,
      cam: tipo === 'video',
      camOtro: tipo === 'video',
      frontal: true,
      calidad: calidadGuardada(),
      recibiendo: null,
      senal: null,
      mensaje: null,
    };
    avisos.forEach((f) => f(actual));
    timbre = sonar(true);
    void senal(chatId, { t: 'sonando', id: d.id });
    limite = setTimeout(() => {
      if (actual?.id === d.id && actual.estado === 'sonando') terminar(null, false);
    }, 50000);
    return;
  }

  const l = actual;
  if (!l || l.id !== d.id || l.chatId !== chatId) return;

  switch (d.t) {
    case 'sonando':
      cambiar({ timbrando: true });
      break;
    case 'aceptar': {
      if (l.entrante || l.estado !== 'llamando') return;
      pararTimbre();
      if (reintento) clearInterval(reintento);
      if (limite) clearTimeout(limite);
      cambiar({ estado: 'conectando' });
      const c = crearConexion(l.chatId);
      const oferta = await c.createOffer();
      await c.setLocalDescription(oferta);
      await senal(l.chatId, { t: 'sdp', id: l.id, sdp: c.localDescription?.toJSON() });
      break;
    }
    case 'sdp': {
      if (!pc || !d.sdp) return;
      await pc.setRemoteDescription(d.sdp);
      for (const c of iceEnEspera.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      if (d.sdp.type === 'offer') {
        const resp = await pc.createAnswer();
        await pc.setLocalDescription(resp);
        await senal(l.chatId, { t: 'sdp', id: l.id, sdp: pc.localDescription?.toJSON() });
      }
      break;
    }
    case 'ice':
      if (d.c) await agregarIce(d.c);
      break;
    case 'calidad':
      if (d.q) await enviarConCalidad(d.q);
      break;
    case 'cam':
      cambiar({ camOtro: !!d.on });
      break;
    case 'rechazar':
      terminar('rechazada', false);
      break;
    case 'ocupado':
      terminar('ocupado', false);
      break;
    case 'colgar':
      terminar(l.estado === 'sonando' ? null : 'Llamada terminada', false);
      break;
  }
}

let desuscribir: (() => void) | null = null;
/** Empieza a escuchar llamadas (al iniciar sesión). */
export function escucharLlamadas(userId: string) {
  miId = userId;
  if (!desuscribir) desuscribir = escucharSenales((chatId, p) => void alRecibir(chatId, p));
}
export function dejarDeEscucharLlamadas() {
  if (actual) terminar(null, true);
  desuscribir?.();
  desuscribir = null;
  miId = null;
}
