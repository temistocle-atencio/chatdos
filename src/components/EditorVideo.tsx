import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Volume2, VolumeX, Play, Loader2, Smile, Type, Pencil } from 'lucide-react';
import { EditorFoto, type HerramientaFoto } from './EditorFoto';
import { IconoSticker } from './Iconos';
import { formatBytes, formatDuration } from '../lib/media';

// Editor de video antes de enviar (como WhatsApp): recortar el inicio y el final, y quitar el sonido.
// El video se vuelve a grabar dentro del celular (tarda lo mismo que dura el pedazo elegido).

function tipoDeVideo(): string {
  const op = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return typeof MediaRecorder === 'undefined' ? '' : op.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

/** Vuelve a grabar el pedazo elegido (y sin sonido si se pide) */
async function regrabar(
  fuente: Blob,
  inicio: number,
  fin: number,
  sinSonido: boolean,
  alAvanzar: (p: number) => void,
  capa: HTMLImageElement | null = null
): Promise<{ blob: Blob; duracion: number }> {
  const url = URL.createObjectURL(fuente);
  const v = document.createElement('video');
  v.src = url;
  v.playsInline = true;
  v.preload = 'auto';
  await new Promise<void>((ok, mal) => {
    v.onloadedmetadata = () => ok();
    v.onerror = () => mal(new Error('No se pudo abrir el video'));
  });
  const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.round((v.videoWidth * k) / 2) * 2;
  c.height = Math.round((v.videoHeight * k) / 2) * 2;
  const ctx = c.getContext('2d')!;
  const pistaVideo = c.captureStream(30).getVideoTracks()[0];
  const pistas: MediaStreamTrack[] = [pistaVideo];
  let audio: AudioContext | null = null;
  if (!sinSonido) {
    try {
      audio = new AudioContext();
      const src = audio.createMediaElementSource(v);
      const dest = audio.createMediaStreamDestination();
      src.connect(dest); // no va a los parlantes: se graba en silencio
      const a = dest.stream.getAudioTracks()[0];
      if (a) pistas.push(a);
    } catch {
      /* sin sonido si el navegador no deja */
    }
  } else v.muted = true;

  const tipo = tipoDeVideo();
  const rec = new MediaRecorder(new MediaStream(pistas), {
    ...(tipo ? { mimeType: tipo } : {}),
    videoBitsPerSecond: 1_400_000,
    audioBitsPerSecond: 64_000,
  });
  const trozos: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && trozos.push(e.data);
  const listo = new Promise<void>((ok) => (rec.onstop = () => ok()));

  v.currentTime = inicio;
  await new Promise<void>((ok) => (v.onseeked = () => ok()));
  const cuadro = () => {
    ctx.drawImage(v, 0, 0, c.width, c.height);
    if (capa) ctx.drawImage(capa, 0, 0, c.width, c.height); // textos, emojis, stickers y dibujos encima
  };
  cuadro();
  await audio?.resume();
  rec.start(500);
  await v.play();
  await new Promise<void>((ok) => {
    const paso = () => {
      cuadro();
      alAvanzar(Math.min(1, (v.currentTime - inicio) / Math.max(0.1, fin - inicio)));
      if (v.currentTime >= fin || v.ended) {
        v.pause();
        ok();
        return;
      }
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
  rec.stop();
  await listo;
  pistas.forEach((t) => t.stop());
  await audio?.close().catch(() => {});
  URL.revokeObjectURL(url);
  const mime = (rec.mimeType || tipo || 'video/webm').split(';')[0];
  return { blob: new Blob(trozos, { type: mime }), duracion: fin - inicio };
}

const cargarImg = (b: Blob) =>
  new Promise<HTMLImageElement>((ok, mal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error('No se pudo preparar'));
    i.src = URL.createObjectURL(b);
  });

export const EditorVideo: React.FC<{
  video: Blob;
  duracion: number;
  onCancelar: () => void;
  onListo: (r: { blob: Blob; duracion: number }) => void;
  userId?: string;
  miLlavePublica?: unknown;
}> = ({ video, duracion, onCancelar, onListo, userId, miLlavePublica }) => {
  // Capa con textos, emojis, stickers y dibujos (PNG transparente del tamaño del video)
  const [capa, setCapa] = useState<{ blob: Blob; url: string } | null>(null);
  const [editarCapa, setEditarCapa] = useState<{ herramienta: HerramientaFoto; guia: Blob } | null>(null);
  const [url] = useState(() => URL.createObjectURL(video));
  const vRef = useRef<HTMLVideoElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState(duracion || 0);
  const [inicio, setInicio] = useState(0);
  const [fin, setFin] = useState(duracion || 0);
  const [sinSonido, setSinSonido] = useState(false);
  const [jugando, setJugando] = useState(false);
  const [cuadros, setCuadros] = useState<string[]>([]);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mov = useRef<'i' | 'f' | 'cursor' | null>(null);
  const [actual, setActual] = useState(0); // por dónde va el video (para el cursor de la tira)
  const [cuantas, setCuantas] = useState(8); // miniaturas que caben en la tira

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // Duración real y miniaturas de la tira
  useEffect(() => {
    let vivo = true;
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadedmetadata = async () => {
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duracion;
      if (!vivo) return;
      if (d && !duracion) {
        setTotal(d);
        setFin(d);
      }
      const c = document.createElement('canvas');
      c.height = 64;
      c.width = Math.round((64 * v.videoWidth) / Math.max(1, v.videoHeight));
      const lista: string[] = [];
      const n = cuantas;
      for (let i = 0; i < n && vivo; i++) {
        v.currentTime = Math.min(d - 0.05, (d * (i + 0.5)) / n);
        await new Promise<void>((ok) => {
          v.onseeked = () => ok();
          setTimeout(ok, 1500);
        });
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
        lista.push(c.toDataURL('image/jpeg', 0.6));
        if (vivo) setCuadros([...lista]);
      }
    };
    return () => {
      vivo = false;
      v.removeAttribute('src');
      v.load();
    };
  }, [url, duracion, cuantas]);

  // Cuántas miniaturas caben (una por cada ~44 px de tira)
  useEffect(() => {
    const b = barraRef.current;
    if (!b) return;
    const medir = () => setCuantas(Math.max(6, Math.min(20, Math.round(b.clientWidth / 44))));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(b);
    return () => ro.disconnect();
  }, []);

  // Cursor que avanza con el video
  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    let id = 0;
    const paso = () => {
      setActual(v.currentTime);
      id = requestAnimationFrame(paso);
    };
    const empezar = () => {
      cancelAnimationFrame(id);
      id = requestAnimationFrame(paso);
    };
    const parar = () => {
      cancelAnimationFrame(id);
      setActual(v.currentTime);
    };
    v.addEventListener('play', empezar);
    v.addEventListener('pause', parar);
    v.addEventListener('seeked', parar);
    return () => {
      cancelAnimationFrame(id);
      v.removeEventListener('play', empezar);
      v.removeEventListener('pause', parar);
      v.removeEventListener('seeked', parar);
    };
  }, []);

  // Reproducir solo el pedazo elegido
  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    const t = () => {
      if (v.currentTime >= fin) {
        v.pause();
        v.currentTime = inicio;
      }
    };
    v.addEventListener('timeupdate', t);
    return () => v.removeEventListener('timeupdate', t);
  }, [inicio, fin]);

  const alternar = () => {
    const v = vRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < inicio || v.currentTime >= fin - 0.05) v.currentTime = inicio;
      void v.play();
    } else v.pause();
  };

  const tiempoEn = (clientX: number) => {
    const r = barraRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
  };
  const mover = (e: React.PointerEvent) => {
    if (!mov.current || !total) return;
    const t = tiempoEn(e.clientX);
    const minimo = Math.min(1, total);
    if (mov.current === 'cursor') {
      // Tocar o arrastrar sobre la tira: ir a ese momento (dentro del pedazo elegido)
      const n = Math.max(inicio, Math.min(fin, t));
      if (vRef.current) vRef.current.currentTime = n;
      setActual(n);
      return;
    }
    if (mov.current === 'i') {
      const n = Math.min(t, fin - minimo);
      setInicio(Math.max(0, n));
      if (vRef.current) vRef.current.currentTime = Math.max(0, n);
    } else {
      const n = Math.max(t, inicio + minimo);
      setFin(Math.min(total, n));
      if (vRef.current) vRef.current.currentTime = Math.min(total, n);
    }
  };

  const cambio = inicio > 0.05 || fin < total - 0.05 || sinSonido || !!capa;

  // Abre el editor de fotos sobre el cuadro actual del video (solo de guía)
  const abrirCapa = async (herramienta: HerramientaFoto) => {
    const v = vRef.current;
    if (!v || !v.videoWidth) return;
    v.pause();
    const k = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k);
    c.height = Math.round(v.videoHeight * k);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    if (capa) ctx.drawImage(await cargarImg(capa.blob), 0, 0, c.width, c.height);
    c.toBlob((b) => b && setEditarCapa({ herramienta, guia: b }), 'image/jpeg', 0.85);
  };

  // Junta lo nuevo con lo que ya había
  const capaLista = async (nueva: Blob) => {
    setEditarCapa(null);
    const img = await cargarImg(nueva);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    if (capa) ctx.drawImage(await cargarImg(capa.blob), 0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      if (capa) URL.revokeObjectURL(capa.url);
      setCapa({ blob: b, url: URL.createObjectURL(b) });
    }, 'image/png');
  };
  // Peso al enviar: si no se cambia nada, el archivo va tal cual; si se recorta o se le agrega algo,
  // se vuelve a grabar a ~1,4 Mb/s de video (+ 64 kb/s de audio), que es lo que define el peso.
  const pesoAprox = !cambio
    ? video.size
    : ((1_400_000 + (sinSonido ? 0 : 64_000)) / 8) * (fin - inicio);

  const terminar = async () => {
    if (!cambio) return onCancelar();
    vRef.current?.pause();
    setError(null);
    setProgreso(0);
    try {
      const r = await regrabar(video, inicio, fin, sinSonido, setProgreso, capa ? await cargarImg(capa.blob) : null);
      onListo(r);
    } catch (e) {
      setProgreso(null);
      setError(e instanceof Error ? e.message : 'No se pudo preparar el video');
    }
  };

  const pi = total ? (inicio / total) * 100 : 0;
  const pf = total ? (fin / total) * 100 : 100;

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white flex flex-col select-none animate-[aparecer_0.2s_ease-out]" style={{ touchAction: 'none' }}>
      <div className="shrink-0 flex items-center gap-2 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <button type="button" onClick={onCancelar} className="w-11 h-11 rounded-full bg-black/45 flex items-center justify-center" aria-label="Cancelar">
          <X className="w-6 h-6" strokeWidth={2} />
        </button>
        <div className="flex-1" />
        {(
          [
            ...(userId ? [['sticker', 'Stickers', <IconoSticker key="s" className="w-5 h-5" />]] : []),
            ['emoji', 'Emojis', <Smile key="e" className="w-5 h-5" strokeWidth={2} />],
            ['texto', 'Texto', <Type key="t" className="w-5 h-5" strokeWidth={2} />],
            ['dibujar', 'Dibujar', <Pencil key="d" className="w-5 h-5" strokeWidth={2} />],
          ] as [HerramientaFoto, string, React.ReactNode][]
        ).map(([h, etiqueta, icono]) => (
          <button
            key={h}
            type="button"
            onClick={() => void abrirCapa(h)}
            className="w-11 h-11 rounded-full bg-black/45 flex items-center justify-center"
            aria-label={etiqueta}
            title={etiqueta}
          >
            {icono}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSinSonido((v) => !v)}
          className={`h-11 px-3 rounded-full flex items-center gap-1.5 text-xs ${sinSonido ? 'bg-white text-[#1F2933]' : 'bg-black/45'}`}
          aria-pressed={sinSonido}
        >
          {sinSonido ? <VolumeX className="w-5 h-5" strokeWidth={2} /> : <Volume2 className="w-5 h-5" strokeWidth={2} />}
          <span className="sr-only sm:not-sr-only">{sinSonido ? 'Sin sonido' : 'Con sonido'}</span>
        </button>
      </div>

      {/* Tira para recortar */}
      <div className="shrink-0 px-4 pt-3">
        <div
          ref={barraRef}
          className="relative h-14 mx-2"
          onPointerDown={(e) => {
            // Tocar la tira (fuera de los bordes) mueve el cursor
            e.currentTarget.setPointerCapture(e.pointerId);
            mov.current = 'cursor';
            mover(e);
          }}
          onPointerMove={mover}
          onPointerUp={() => (mov.current = null)}
          onPointerCancel={() => (mov.current = null)}
        >
          <div className="absolute inset-0 rounded-[6px] overflow-hidden bg-white/10 flex">
            {cuadros.map((c, i) => (
              <img key={i} src={c} alt="" className="h-full flex-1 min-w-0 object-cover" draggable={false} />
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${pi}%` }} />
          <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${100 - pf}%` }} />
          <div className="absolute inset-y-0 border-y-[3px] border-white" style={{ left: `${pi}%`, width: `${pf - pi}%` }} />
          {/* Cursor: por dónde va el video */}
          {total > 0 && (
            <span
              className="absolute -inset-y-1 w-[3px] -ml-[1.5px] rounded-full bg-[#F28C1B] shadow-[0_0_0_1px_rgba(0,0,0,0.4)] pointer-events-none z-[5]"
              style={{ left: `${(Math.max(inicio, Math.min(fin, actual)) / total) * 100}%` }}
              aria-hidden="true"
            />
          )}
          {(['i', 'f'] as const).map((h) => (
            <span
              key={h}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                mov.current = h;
              }}
              onPointerMove={mover}
              onPointerUp={() => (mov.current = null)}
              className="absolute inset-y-0 w-8 -ml-4 flex items-center justify-center cursor-ew-resize z-10"
              style={{ left: `${h === 'i' ? pi : pf}%` }}
              aria-label={h === 'i' ? 'Inicio del video' : 'Final del video'}
            >
              <span className="w-2.5 h-full bg-white rounded-[3px] flex items-center justify-center">
                <span className="w-0.5 h-5 bg-[#1F2933]/60 rounded" />
              </span>
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 px-3 h-7 rounded-full bg-black/55 text-xs font-['Inter'] flex items-center gap-1.5 tabular-nums whitespace-nowrap">
            {formatDuration(Math.max(0, actual - inicio))} / {formatDuration(fin - inicio)} <span aria-hidden>•</span> {cambio ? '≈ ' : ''}
            {formatBytes(pesoAprox)}
          </span>
          <span className="text-[11px] text-white/60 truncate">Arrastra los bordes para recortar</span>
        </div>
      </div>

      {/* Video */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-3" onClick={alternar}>
        <div className="relative inline-block max-w-full max-h-full">
          <video
            ref={vRef}
            src={url}
            playsInline
            muted={sinSonido}
            onPlay={() => setJugando(true)}
            onPause={() => setJugando(false)}
            className="block max-w-full max-h-[calc(100dvh-260px)]"
          />
          {capa && <img src={capa.url} alt="" className="absolute inset-0 w-full h-full pointer-events-none" />}
          {capa && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                URL.revokeObjectURL(capa.url);
                setCapa(null);
              }}
              className="absolute top-2 right-2 h-8 px-3 rounded-full bg-black/60 text-xs"
            >
              Quitar lo agregado
            </button>
          )}
        </div>
        {!jugando && (
          <span className="absolute w-16 h-16 rounded-full bg-black/50 flex items-center justify-center pointer-events-none">
            <Play className="w-8 h-8 ml-1" strokeWidth={2} fill="currentColor" />
          </span>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-xs text-[#FCA5A5]">{error}</p>}
      <div className="shrink-0 flex justify-end px-3 pt-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <button
          type="button"
          onClick={() => void terminar()}
          disabled={progreso !== null}
          className="h-12 px-5 rounded-full bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center gap-2 disabled:opacity-60"
        >
          <Check className="w-5 h-5" strokeWidth={2.5} /> Listo
        </button>
      </div>

      {editarCapa && (
        <EditorFoto
          imagen={editarCapa.guia}
          herramienta={editarCapa.herramienta}
          capa
          userId={userId}
          miLlavePublica={miLlavePublica}
          onCancelar={() => setEditarCapa(null)}
          onListo={(b) => void capaLista(b)}
        />
      )}

      {progreso !== null && (
        <div className="absolute inset-0 z-10 bg-black/75 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" strokeWidth={2} />
          <p className="text-sm font-['Inter']">Preparando el video… {Math.round(progreso * 100)}%</p>
          <p className="text-xs text-white/60 px-8 text-center">Deja la app abierta; tarda lo mismo que dura el video.</p>
        </div>
      )}
    </div>
  );
};
