// Fotos, videos y audios: comprimir, grabar, subir cifrado y descargar descifrado.
// Hay varios cuidados para iPhone (Safari), porque la otra persona usa iPhone.
import { supabase } from './supabase';
import { encryptFile, decryptFile } from './crypto';

// ----- Límites -----
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB (el bucket acepta 26 MB ya cifrado)
export const MAX_VIDEO_SECONDS = 120; // 2 minutos
export const MAX_AUDIO_SECONDS = 300; // 5 minutos grabando
const IMAGE_MAX_SIDE = 1600;

export const formatBytes = (n: number): string =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export const formatDuration = (sec: number): string => {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ----- Fotos -----

// Pasar un canvas a archivo. Safari no sabe crear WebP (devuelve PNG, que pesa mucho),
// así que si no salió WebP usamos JPEG.
const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === 'image/webp') return resolve(webp);
        canvas.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new Error('No se pudo comprimir la foto'))), 'image/jpeg', quality);
      },
      'image/webp',
      quality
    );
  });

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo abrir la foto. Si es HEIC, compártela como JPG.'));
    };
    img.src = url;
  });

// Miniatura borrosa muy pequeña (va cifrada dentro del mensaje)
const makeThumb = (source: CanvasImageSource, w: number, h: number): string => {
  const side = 32;
  const scale = side / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext('2d')?.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.5);
};

export interface PreparedImage {
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  thumb: string;
}

export async function compressImage(file: File): Promise<PreparedImage> {
  const img = await loadImage(file); // el navegador ya respeta la orientación de la foto
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(w0, h0));
  const width = Math.round(w0 * scale);
  const height = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo comprimir la foto');
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, 0.8);
  const thumb = makeThumb(img, width, height);
  URL.revokeObjectURL(img.src);
  canvas.width = canvas.height = 0; // liberar memoria (importante en iPhone)
  return { blob, mime: blob.type, width, height, thumb };
}

// ----- Videos -----

export interface PreparedVideo {
  duration: number;
  width?: number;
  height?: number;
  thumb?: string;
}

// Leer duración, tamaño y una miniatura del primer cuadro del video
export function inspectVideo(file: Blob): Promise<PreparedVideo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true; // iPhone: sin esto abre el reproductor a pantalla completa
    v.preload = 'auto';
    let done = false;
    const finish = (info: PreparedVideo) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      v.load();
      resolve(info);
    };
    const timer = setTimeout(() => finish({ duration: v.duration || 0 }), 6000);
    v.onloadedmetadata = () => {
      // Ir un poco adelante para que el primer cuadro no salga negro
      v.currentTime = Math.min(0.2, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      clearTimeout(timer);
      let thumb: string | undefined;
      try {
        thumb = makeThumb(v, v.videoWidth, v.videoHeight);
      } catch {
        thumb = undefined;
      }
      finish({ duration: v.duration || 0, width: v.videoWidth, height: v.videoHeight, thumb });
    };
    v.onerror = () => {
      clearTimeout(timer);
      finish({ duration: 0 });
    };
    v.src = url;
  });
}

// ----- Audio -----

export function audioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    const end = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.onloadedmetadata = () => end(a.duration);
    a.onerror = () => end(0);
    setTimeout(() => end(a.duration || 0), 4000);
    a.src = url;
  });
}

// Grabadora de notas de voz.
// Usa AAC en MP4 si el navegador lo sabe grabar (iPhone y Chrome reciente), porque se
// escucha en todos lados. Si no, graba WAV, que también se escucha en iPhone.
// (El formato WebM/Opus de Android no siempre suena en iPhone, por eso no se usa.)
export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime = '';
  private ctx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private pcm: Float32Array[] = [];
  private sampleRate = 44100;
  private startedAt = 0;

  static pickMime(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) return 'audio/mp4;codecs=mp4a.40.2';
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent) || /iPhone|iPad/i.test(navigator.userAgent);
    if (isSafari && MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return ''; // usar WAV
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    this.startedAt = Date.now();
    this.mime = VoiceRecorder.pickMime();
    if (this.mime) {
      this.recorder = new MediaRecorder(this.stream, { mimeType: this.mime, audioBitsPerSecond: 64000 });
      this.chunks = [];
      this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.recorder.start(250);
      return;
    }
    // Plan B: WAV con Web Audio
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.sampleRate = this.ctx.sampleRate;
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.pcm = [];
    this.processor.onaudioprocess = (e) => this.pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(this.processor);
    this.processor.connect(this.ctx.destination);
  }

  elapsed(): number {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.processor?.disconnect();
    this.processor = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  cancel(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      /* nada */
    }
    this.recorder = null;
    this.chunks = [];
    this.pcm = [];
    this.release();
  }

  async stop(): Promise<{ blob: Blob; mime: string; duration: number }> {
    const duration = this.elapsed();
    if (this.recorder) {
      const rec = this.recorder;
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
      const type = this.mime.split(';')[0];
      const blob = new Blob(this.chunks, { type });
      this.recorder = null;
      this.chunks = [];
      this.release();
      return { blob, mime: type, duration };
    }
    const blob = encodeWav(this.pcm, this.sampleRate, 16000);
    this.pcm = [];
    this.release();
    return { blob, mime: 'audio/wav', duration };
  }
}

// WAV mono de 16 kHz (voz clara y archivo pequeño)
function encodeWav(chunks: Float32Array[], inRate: number, outRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const input = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    input.set(c, off);
    off += c.length;
  }
  const ratio = inRate / outRate;
  const outLen = Math.floor(total / ratio);
  const buffer = new ArrayBuffer(44 + outLen * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + outLen * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, outLen * 2, true);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// ----- Subir y bajar archivos cifrados -----

export function mediaPath(chatId: string, userId: string, messageId: string): string {
  return `${chatId}/${userId}/${messageId}.bin`;
}

// Cifra y sube mostrando el avance (supabase-js no da avance, por eso se usa XMLHttpRequest)
export async function uploadEncrypted(
  path: string,
  file: Blob,
  onProgress: (pct: number) => void
): Promise<{ fileKey: string; size: number }> {
  const { encryptedBlob, fileKeyBase64 } = await encryptFile(file);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión venció. Vuelve a iniciar sesión.');
  const base = import.meta.env.VITE_SUPABASE_URL || 'https://snebetxlyehjggjcvkac.supabase.co';
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/storage/v1/object/media/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', anon);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`No se pudo subir el archivo (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Sin conexión al subir el archivo'));
    xhr.send(encryptedBlob);
  });
  return { fileKey: fileKeyBase64, size: file.size };
}

// Tipo de archivo que el navegador sí sabe reproducir.
// Los videos de iPhone llegan como .mov (video/quicktime); casi siempre son H.264
// y Chrome los reproduce si se le dice que son MP4.
export function playableMime(mime: string): string {
  if (mime === 'video/quicktime') return 'video/mp4';
  return mime;
}

// Copias descifradas en memoria, para no bajar dos veces el mismo archivo
const urlCache = new Map<string, string>();

export function cacheLocalUrl(messageId: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  urlCache.set(messageId, url);
  return url;
}

export function getCachedUrl(messageId: string): string | undefined {
  return urlCache.get(messageId);
}

export function forgetUrl(messageId: string): void {
  const url = urlCache.get(messageId);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(messageId);
}

export async function downloadDecrypted(
  messageId: string,
  path: string,
  fileKey: string,
  mime: string,
  useCache = true
): Promise<string> {
  const cached = useCache ? urlCache.get(messageId) : undefined;
  if (cached) return cached;
  const { data, error } = await supabase.storage.from('media').download(path);
  if (error || !data) throw new Error('No se pudo descargar el archivo');
  const plain = await decryptFile(data, fileKey, playableMime(mime));
  const url = URL.createObjectURL(plain);
  if (useCache) urlCache.set(messageId, url);
  return url;
}
