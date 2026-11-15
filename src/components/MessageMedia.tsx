import React, { useEffect, useRef, useState } from 'react';
import { FotoConZoom } from './FotoConZoom';
import { Play, Pause, Music, Mic, Image as ImageIcon, Video, RotateCw, Loader2, X } from 'lucide-react';
import { IconoVerUnaVez } from './Iconos';
import { AvatarImage } from './AvatarImage';
import type { DecryptedMessage } from '../types/chat';
import { downloadDecrypted, getCachedUrl, formatDuration, formatBytes } from '../lib/media';

export interface UploadState {
  pct: number;
  failed?: boolean;
}

interface MessageMediaProps {
  message: DecryptedMessage;
  isMine: boolean;
  upload?: UploadState;
  onRetry: (messageId: string) => void;
  onOpenMedia: (url: string, kind: 'image' | 'video') => void;
  onOpenViewOnce: (message: DecryptedMessage) => void;
  /** Foto y nombre de quien envió (se muestran en las notas de voz) */
  autorAvatar?: string | null;
  autorNombre?: string;
}

const KIND_LABEL = { image: 'Foto', video: 'Video', audio: 'Audio', text: '' } as const;

// Ancho y alto de la vista previa, respetando la forma de la foto o el video
const boxSize = (w?: number, h?: number) => {
  const maxW = 240;
  const maxH = 300;
  if (!w || !h) return { width: maxW, height: 180 };
  const ratio = w / h;
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return { width: Math.max(120, Math.round(width)), height: Math.max(90, Math.round(height)) };
};

export const MessageMedia: React.FC<MessageMediaProps> = ({
  message,
  isMine,
  upload,
  onRetry,
  onOpenMedia,
  onOpenViewOnce,
  autorAvatar = null,
  autorNombre = '',
}) => {
  const media = message.payload?.media;
  const [url, setUrl] = useState<string | undefined>(() => getCachedUrl(message.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const kind = message.kind as 'image' | 'video' | 'audio';
  const muted = isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]';

  // Bajar y descifrar (solo cuando hace falta)
  const fetchUrl = async (): Promise<string | undefined> => {
    if (url) return url;
    if (!media?.key || !message.media_path) return undefined;
    setLoading(true);
    setError(false);
    try {
      const u = await downloadDecrypted(message.id, message.media_path, media.key, media.mime);
      setUrl(u);
      return u;
    } catch (err) {
      console.error('[ChatDos] descargar archivo', err);
      setError(true);
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  // Las fotos y las notas de voz se bajan solas; videos y canciones, al tocarlos
  useEffect(() => {
    if (message.view_once || message.isPending || url) return;
    if (kind === 'image' || (kind === 'audio' && !media?.music)) fetchUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.isPending, media?.key]);

  // ----- Estado de subida (mientras se envía) -----
  const uploadOverlay = upload && (upload.failed || upload.pct < 100) && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (upload.failed) onRetry(message.id);
      }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 text-white text-xs font-['Inter'] rounded-[2px]"
    >
      {upload.failed ? (
        <>
          <RotateCw className="w-6 h-6" strokeWidth={2} />
          <span>No se envió. Toca para reintentar</span>
        </>
      ) : (
        <>
          <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} />
          <span>{upload.pct} %</span>
        </>
      )}
    </button>
  );

  // ----- Ver una vez -----
  if (message.view_once) {
    const opened = !!message.viewed_at;
    const label = `${KIND_LABEL[kind]} · Ver una vez`;
    const clickable = !isMine && !opened;
    return (
      <div className="relative">
        <button
          type="button"
          disabled={!clickable}
          onClick={() => clickable && onOpenViewOnce(message)}
          className={`flex items-center gap-2.5 min-w-[190px] py-1.5 pr-2 text-left ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <IconoVerUnaVez className={`w-6 h-6 shrink-0 ${opened ? muted : ''}`} />
          <span className="flex flex-col">
            <span className={`text-[14px] font-['Inter'] font-medium ${opened ? `italic ${muted}` : ''}`}>
              {opened ? 'Abierto' : label}
            </span>
            <span className={`text-[11px] font-['Inter'] ${muted}`}>
              {isMine
                ? opened
                  ? `${KIND_LABEL[kind]} ya visto`
                  : 'Enviado para ver una vez'
                : opened
                  ? `${KIND_LABEL[kind]} ya visto`
                  : 'Toca para abrir'}
            </span>
          </span>
        </button>
        {upload && (upload.failed || upload.pct < 100) && (
          <button
            type="button"
            onClick={() => upload.failed && onRetry(message.id)}
            className={`flex items-center gap-1 text-[11px] font-['Inter'] ${muted}`}
          >
            {upload.failed ? <RotateCw className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {upload.failed ? 'No se envió. Toca para reintentar' : `Enviando ${upload.pct} %`}
          </button>
        )}
      </div>
    );
  }

  // ----- Sticker (sin burbuja ni fondo) -----
  if (kind === 'image' && media?.sticker) {
    const lado = 128; // tamaño como en WhatsApp
    const r = media.width && media.height ? media.width / media.height : 1;
    const style = r >= 1 ? { width: lado, height: lado / r } : { width: lado * r, height: lado };
    return (
      <div className="relative" style={style}>
        {url ? (
          <img src={url} alt="Sticker" className="w-full h-full object-contain rounded-[12px]" draggable={false} />
        ) : error ? (
          <button
            type="button"
            onClick={() => fetchUrl()}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#5B6670] dark:text-[#E3E7EC] text-[11px] font-['Inter']"
          >
            <ImageIcon className="w-6 h-6" strokeWidth={2} />
            Toca para reintentar
          </button>
        ) : (
          <span className="block w-full h-full rounded-[8px] bg-[#E3E7EC]/60 dark:bg-[#253240]/60 animate-pulse" />
        )}
        {uploadOverlay}
      </div>
    );
  }

  // ----- Foto -----
  if (kind === 'image') {
    const size = boxSize(media?.width, media?.height);
    return (
      <button
        type="button"
        onClick={() => url && onOpenMedia(url, 'image')}
        className="relative block overflow-hidden rounded-[2px] bg-[#E3E7EC] dark:bg-[#1F2933] max-w-full"
        style={size}
        aria-label="Ver foto"
      >
        {media?.thumb && !url && (
          <img src={media.thumb} alt="" className="absolute inset-0 w-full h-full object-cover blur-md scale-110" />
        )}
        {url && <img src={url} alt="Foto" className="absolute inset-0 w-full h-full object-cover" draggable={false} />}
        {!url && (loading || (!error && !upload)) && (
          <span className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="w-6 h-6 animate-spin drop-shadow" strokeWidth={2} />
          </span>
        )}
        {error && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              fetchUrl();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#1F2933] dark:text-white text-xs font-['Inter']"
          >
            <ImageIcon className="w-6 h-6" strokeWidth={2} />
            No se pudo cargar. Toca para reintentar
          </span>
        )}
        {uploadOverlay}
      </button>
    );
  }

  // ----- Video -----
  if (kind === 'video') {
    const size = boxSize(media?.width, media?.height);
    return (
      <button
        type="button"
        onClick={async () => {
          const u = url || (await fetchUrl());
          if (u) onOpenMedia(u, 'video');
        }}
        className="relative block overflow-hidden rounded-[2px] bg-[#1F2933] max-w-full"
        style={size}
        aria-label="Ver video"
      >
        {media?.thumb && <img src={media.thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {!upload && (
          <span className="absolute inset-0 flex items-center justify-center text-white">
            {loading ? (
              <Loader2 className="w-8 h-8 animate-spin drop-shadow" strokeWidth={2} />
            ) : (
              <Play className="w-10 h-10 drop-shadow fill-white/90" strokeWidth={1.5} />
            )}
          </span>
        )}
        <span className="absolute left-1.5 bottom-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-black/45 text-white text-[11px] font-['Inter']">
          <Video className="w-3.5 h-3.5" strokeWidth={2} />
          {formatDuration(media?.duration || 0)}
        </span>
        {error && (
          <span className="absolute inset-x-0 top-2 text-center text-white text-xs font-['Inter']">
            No se pudo cargar. Toca para reintentar
          </span>
        )}
        {uploadOverlay}
      </button>
    );
  }

  // ----- Audio (nota de voz o canción) -----
  return (
    <AudioPlayer
      message={message}
      isMine={isMine}
      url={url}
      loading={loading}
      error={error}
      fetchUrl={fetchUrl}
      upload={upload}
      onRetry={onRetry}
      autorAvatar={autorAvatar}
      autorNombre={autorNombre}
    />
  );
};

// Ondas de las notas de voz (se calculan una vez por mensaje y se guardan en memoria).
// Cada barra es el volumen promedio de su tramo (no el pico), de 0 a 1 respecto al tramo
// más fuerte. Así se ve la forma real de lo que se dijo y el silencio queda como puntos.
const ondas = new Map<string, number[]>();
const BARRAS = 32;
async function calcularOnda(id: string, url: string): Promise<number[] | null> {
  if (ondas.has(id)) return ondas.get(id)!;
  try {
    const datos = await (await fetch(url)).arrayBuffer();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audio = await new Promise<AudioBuffer>((ok, mal) => ctx.decodeAudioData(datos, ok, mal));
    ctx.close().catch(() => {});
    const canal = audio.getChannelData(0);
    const paso = Math.max(1, Math.floor(canal.length / BARRAS));
    const niveles: number[] = [];
    for (let b = 0; b < BARRAS; b++) {
      let suma = 0;
      let n = 0;
      for (let i = b * paso; i < Math.min(canal.length, (b + 1) * paso); i += 8) {
        suma += canal[i] * canal[i];
        n++;
      }
      niveles.push(n ? Math.sqrt(suma / n) : 0);
    }
    const tope = Math.max(...niveles, 0.005);
    const onda = niveles.map((v) => Math.min(1, v / tope));
    ondas.set(id, onda);
    return onda;
  } catch {
    return null;
  }
}

// Alto de cada barra en px: el silencio es un punto y la voz normal queda a media altura
const altoBarra = (v: number) => (v < 0.12 ? 3 : Math.round(4 + Math.pow(v, 1.3) * 16));

// Velocidad de las notas de voz (se recuerda para la siguiente, como en WhatsApp)
let velocidadNotas = 1;

// Reproductor de audio dentro de la burbuja
const AudioPlayer: React.FC<{
  message: DecryptedMessage;
  isMine: boolean;
  url?: string;
  loading: boolean;
  error: boolean;
  fetchUrl: () => Promise<string | undefined>;
  upload?: UploadState;
  onRetry: (id: string) => void;
  autorAvatar: string | null;
  autorNombre: string;
}> = ({ message, isMine, url, loading, error, fetchUrl, upload, onRetry, autorAvatar, autorNombre }) => {
  const media = message.payload?.media;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(media?.duration || 0);
  const muted = isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]';
  const track = isMine ? 'accent-white' : 'accent-[#005198] dark:accent-white';
  const esNota = !media?.music;
  const [onda, setOnda] = useState<number[] | null>(() => ondas.get(message.id) ?? null);
  const [velocidad, setVelocidad] = useState(velocidadNotas);
  const arrastrando = useRef(false);

  useEffect(() => {
    if (!esNota || !url || onda) return;
    let vivo = true;
    calcularOnda(message.id, url).then((o) => vivo && o && setOnda(o));
    return () => {
      vivo = false;
    };
  }, [esNota, url, onda, message.id]);

  const cambiarVelocidad = () => {
    const v = velocidad === 1 ? 1.5 : velocidad === 1.5 ? 2 : 1;
    velocidadNotas = v;
    setVelocidad(v);
    if (audioRef.current) audioRef.current.playbackRate = v;
  };

  // Tocar o arrastrar sobre las barras para adelantar o retroceder
  const saltarA = (e: React.PointerEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - caja.left) / caja.width)) * (duration || 0);
    if (audioRef.current && audioRef.current.src) audioRef.current.currentTime = t;
    setTime(t);
  };

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    if (!url && !a.src) {
      const u = await fetchUrl();
      if (!u) return;
      a.src = u;
    }
    try {
      if (esNota) a.playbackRate = velocidad;
      if (time > 0 && Math.abs(a.currentTime - time) > 0.3) a.currentTime = time;
      await a.play();
    } catch {
      // iPhone a veces pide un segundo toque después de descargar; el botón queda listo
    }
  };

  useEffect(() => {
    if (url && audioRef.current && !audioRef.current.src) audioRef.current.src = url;
  }, [url]);

  const pending = upload && (upload.failed || upload.pct < 100);
  const textoTiempo = pending
    ? upload?.failed
      ? 'No se envió. Toca para reintentar'
      : `Enviando ${upload?.pct} %`
    : error
      ? 'No se pudo cargar'
      : formatDuration(playing || time ? time : duration);

  const iconoBoton = pending ? (
    upload?.failed ? <RotateCw className="w-6 h-6" strokeWidth={2} /> : <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} />
  ) : loading ? (
    <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} />
  ) : playing ? (
    <Pause className="w-7 h-7" fill="currentColor" strokeWidth={0} />
  ) : (
    <Play className="w-7 h-7" fill="currentColor" strokeWidth={0} />
  );

  const audio = (
    <audio
      ref={audioRef}
      preload="metadata"
      playsInline
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => {
        setPlaying(false);
        setTime(0);
      }}
      onTimeUpdate={(e) => !arrastrando.current && setTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) setDuration(d);
      }}
    />
  );

  // ----- Nota de voz (como WhatsApp): foto o velocidad · play · barras -----
  if (esNota) {
    const avance = duration > 0 ? Math.min(1, time / duration) : 0;
    // La velocidad solo aparece cuando ya se está escuchando; antes, la foto de quien grabó
    const mostrarVelocidad = !pending && (playing || time > 0);
    const fondoBurbuja = isMine ? 'bg-[#005198]' : 'bg-white dark:bg-[#003A73]';
    const colorHecho = isMine ? 'bg-white' : 'bg-[#005198] dark:bg-white';
    const colorFalta = isMine ? 'bg-white/40' : 'bg-[#5B6670]/35 dark:bg-white/35';
    return (
      <div className="w-[260px] max-w-full pt-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-12 shrink-0 flex items-center justify-center">
            {mostrarVelocidad ? (
              <button
                type="button"
                onClick={cambiarVelocidad}
                className={`h-7 min-w-[46px] px-2 rounded-full text-[13px] font-['Poppins'] font-semibold ${
                  isMine ? 'bg-white/20 text-white' : 'bg-[#F2F4F7] dark:bg-white/15 text-[#1F2933] dark:text-white'
                }`}
                aria-label={`Velocidad: ${velocidad}x. Toca para cambiarla`}
              >
                {velocidad === 1 ? '1×' : velocidad === 1.5 ? '1.5×' : '2×'}
              </button>
            ) : (
              <div className="relative">
                <AvatarImage avatarPath={autorAvatar} name={autorNombre} size={46} className={`!border-0 ${isMine ? '' : 'dark:!bg-[#005198]'}`} />
                <span
                  className={`absolute -bottom-1 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${fondoBurbuja} ${muted}`}
                  aria-hidden="true"
                >
                  <Mic className="w-3.5 h-3.5" strokeWidth={2.25} />
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={pending ? () => upload?.failed && onRetry(message.id) : toggle}
            className="w-9 h-10 shrink-0 flex items-center justify-center"
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            {iconoBoton}
          </button>
          <div className="flex-1 min-w-0 pr-1">
            <div
              role="slider"
              aria-label="Avance de la nota de voz"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration || 0)}
              aria-valuenow={Math.round(time)}
              tabIndex={0}
              onPointerDown={(e) => {
                arrastrando.current = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                saltarA(e);
              }}
              onPointerMove={(e) => arrastrando.current && saltarA(e)}
              onPointerUp={() => (arrastrando.current = false)}
              onPointerCancel={() => (arrastrando.current = false)}
              onKeyDown={(e) => {
                const d = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
                if (!d) return;
                const t = Math.max(0, Math.min(duration, time + d));
                if (audioRef.current?.src) audioRef.current.currentTime = t;
                setTime(t);
              }}
              className="relative h-7 flex items-center justify-between cursor-pointer touch-none"
            >
              {(onda ?? Array.from({ length: BARRAS }, () => 0)).map((v, i, l) => (
                <span
                  key={i}
                  className={`w-[3px] shrink-0 rounded-full ${(i + 0.5) / l.length <= avance ? colorHecho : colorFalta}`}
                  style={{ height: altoBarra(v) }}
                />
              ))}
              {/* Punto que marca por dónde va */}
              <span
                className={`absolute top-1/2 w-3.5 h-3.5 -mt-[7px] -ml-[7px] rounded-full ${colorHecho} shadow-[0_1px_2px_rgba(0,0,0,0.2)]`}
                style={{ left: `${avance * 100}%` }}
                aria-hidden="true"
              />
            </div>
            {/* El tiempo a la izquierda; la hora y los chulitos van en la misma línea, a la derecha */}
            <div className={`h-4 mt-0.5 text-[11px] leading-4 font-['Inter'] tabular-nums truncate ${muted}`}>{textoTiempo}</div>
          </div>
        </div>
        {audio}
      </div>
    );
  }

  // ----- Canción o archivo de audio -----
  return (
    <div className="min-w-[220px] max-w-[260px] py-0.5">
      <div className={`flex items-center gap-1.5 mb-1 text-xs font-['Inter'] ${muted}`}>
        <Music className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate">{media?.name || 'Canción'}</span>
        <span className="shrink-0">· {formatBytes(media?.size || 0)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={pending ? () => upload?.failed && onRetry(message.id) : toggle}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-[5px]"
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {iconoBoton}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={time}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = t;
              setTime(t);
            }}
            className={`w-full h-1 ${track}`}
            aria-label="Avance del audio"
          />
          <div className={`text-[11px] font-['Inter'] mt-0.5 ${muted}`}>{textoTiempo}</div>
        </div>
      </div>
      {audio}
    </div>
  );
};

// Visor a pantalla completa (fotos, videos y "ver una vez")
export const MediaViewer: React.FC<{
  url?: string;
  kind: 'image' | 'video' | 'audio';
  viewOnce?: boolean;
  loading?: boolean;
  onClose: () => void;
}> = ({ url, kind, viewOnce, loading, onClose }) => {
  // Cerrar con la tecla Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      onContextMenu={(e) => viewOnce && e.preventDefault()}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-between px-3 h-14 shrink-0 text-white">
        <span className="text-sm font-['Poppins'] font-medium">{viewOnce ? 'Ver una vez' : ''}</span>
        <button
          type="button"
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center"
          aria-label="Cerrar"
        >
          <X className="w-6 h-6" strokeWidth={2} />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-2 select-none" style={{ WebkitTouchCallout: 'none' }}>
        {loading || !url ? (
          <Loader2 className="w-10 h-10 text-white animate-spin" strokeWidth={2} />
        ) : kind === 'image' ? (
          <FotoConZoom src={url} />
        ) : kind === 'video' ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            controlsList={viewOnce ? 'nodownload' : undefined}
            className="max-w-full max-h-full"
          />
        ) : (
          <audio src={url} controls autoPlay playsInline controlsList="nodownload" className="w-full max-w-sm" />
        )}
      </div>
      {viewOnce && (
        <p className="shrink-0 px-6 pb-4 text-center text-[11px] font-['Inter'] text-white/70">
          Al cerrar, se borra para siempre. La app no puede impedir capturas de pantalla.
        </p>
      )}
    </div>
  );
};
