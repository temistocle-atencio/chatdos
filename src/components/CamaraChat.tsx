import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, ZapOff, Image as ImageIcon, SwitchCamera, Check } from 'lucide-react';
import { MAX_VIDEO_SECONDS } from '../lib/media';
import { useAtras } from '../lib/atras';

// Cámara dentro de ChatDos (como WhatsApp):
//   Foto:  un toque = foto · mantener presionado = video (al soltar se detiene)
//   Video: un toque empieza y otro toque termina · o mantener presionado y soltar
// Las fotos tomadas quedan en una fila para elegir varias y enviarlas juntas.

/** Duración real de los videos grabados aquí (algunos navegadores no la guardan en el archivo). */
export const duracionGrabada = new WeakMap<File, number>();

type Modo = 'foto' | 'video';

interface Reciente {
  file: File;
  url: string;
}
// Fotos tomadas en esta sesión de la app (se borran al cerrarla)
const recientes: Reciente[] = [];

const MANTENER_MS = 280;

function tipoDeVideo(): string {
  const opciones = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  return opciones.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

const reloj = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const CamaraChat: React.FC<{
  modoInicial?: Modo;
  onListo: (archivos: File[]) => void;
  onGaleria: () => void;
  onCerrar: () => void;
  /** Si el navegador no deja usar la cámara aquí, se usa la cámara del sistema */
  onSinCamara: () => void;
}> = ({ modoInicial = 'foto', onListo, onGaleria, onCerrar, onSinCamara }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const grabadorRef = useRef<MediaRecorder | null>(null);
  const trozosRef = useRef<Blob[]>([]);
  const inicioRef = useRef(0);
  const presionRef = useRef<{ t: ReturnType<typeof setTimeout> | null; manteniendo: boolean; activo: boolean }>({
    t: null,
    manteniendo: false,
    activo: false,
  });
  const terminadoRef = useRef(false);

  const [modo, setModo] = useState<Modo>(modoInicial);
  const [frontal, setFrontal] = useState(false);
  const [listo, setListo] = useState(false);
  const [tomando, setTomando] = useState(false); // la foto completa tarda un poco: se muestra que está trabajando
  const tomandoRef = useRef(false);
  const [hayFlash, setHayFlash] = useState(false);
  const [flash, setFlash] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [destello, setDestello] = useState(false);
  const [elegidas, setElegidas] = useState<Set<File>>(new Set());
  const [, setVersion] = useState(0);

  // ---------- Encender la cámara ----------
  const encender = useCallback(
    async (delante: boolean) => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setListo(false);
      const video: MediaTrackConstraints = {
        facingMode: delante ? 'user' : 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        try {
          // Sin micrófono: igual se pueden tomar fotos
          s = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch {
          if (!terminadoRef.current) onSinCamara();
          return;
        }
      }
      if (terminadoRef.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = s;
      const v = videoRef.current;
      if (v) {
        v.srcObject = s;
        await v.play().catch(() => {});
      }
      const pista = s.getVideoTracks()[0];
      const caps = (pista?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setHayFlash(!!caps.torch);
      setFlash(false);
      setListo(true);
    },
    [onSinCamara]
  );

  useEffect(() => {
    terminadoRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      onSinCamara();
      return;
    }
    void encender(false);
    return () => {
      terminadoRef.current = true;
      if (grabadorRef.current?.state === 'recording') grabadorRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Botón atrás del celular cierra la cámara
  useAtras(true, onCerrar);

  // Reloj mientras graba
  useEffect(() => {
    if (!grabando) return;
    const i = setInterval(() => {
      const s = (Date.now() - inicioRef.current) / 1000;
      setSegundos(s);
      if (s >= MAX_VIDEO_SECONDS) pararGrabacion();
    }, 200);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grabando]);

  const voltear = () => {
    if (grabando) return;
    const nuevo = !frontal;
    setFrontal(nuevo);
    void encender(nuevo);
  };

  const cambiarFlash = async () => {
    const pista = streamRef.current?.getVideoTracks()[0];
    if (!pista) return;
    try {
      await pista.applyConstraints({ advanced: [{ torch: !flash } as MediaTrackConstraintSet] });
      setFlash(!flash);
    } catch {
      setHayFlash(false);
    }
  };

  // ---------- Foto ----------
  // Foto con TODA la resolución del sensor (Chrome en Android). En otros navegadores se usa la imagen de la pantalla.
  const fotoCompleta = async (): Promise<Blob | null> => {
    const pista = streamRef.current?.getVideoTracks()[0];
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => {
      getPhotoCapabilities: () => Promise<{ imageWidth?: { max: number }; imageHeight?: { max: number } }>;
      takePhoto: (o?: Record<string, unknown>) => Promise<Blob>;
    } }).ImageCapture;
    if (!IC || !pista || frontal) return null;
    try {
      const cap = new IC(pista);
      const c = await cap.getPhotoCapabilities().catch(() => null);
      const opciones = c?.imageWidth?.max && c.imageHeight?.max ? { imageWidth: c.imageWidth.max, imageHeight: c.imageHeight.max } : {};
      const b = await Promise.race([cap.takePhoto(opciones), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
      return b && b.size > 0 ? b : null;
    } catch {
      return null;
    }
  };

  const tomarFoto = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || tomandoRef.current) return;
    tomandoRef.current = true;
    setTomando(true);
    setDestello(true);
    setTimeout(() => setDestello(false), 150);
    const completa = await fotoCompleta();
    tomandoRef.current = false;
    setTomando(false);
    if (completa) {
      const file = new File([completa], `foto-${Date.now()}.jpg`, { type: completa.type || 'image/jpeg' });
      recientes.unshift({ file, url: URL.createObjectURL(completa) });
      while (recientes.length > 24) URL.revokeObjectURL(recientes.pop()!.url);
      onListo([...Array.from(elegidas), file]);
      return;
    }
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (frontal) {
      // Igual a como se ve en la pantalla (como un espejo)
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
    recientes.unshift({ file, url: URL.createObjectURL(blob) });
    while (recientes.length > 24) URL.revokeObjectURL(recientes.pop()!.url);
    // Se envía esta foto junto con las que ya estaban elegidas en la fila
    onListo([...Array.from(elegidas), file]);
  };

  // ---------- Video ----------
  const empezarGrabacion = () => {
    const s = streamRef.current;
    if (!s || grabando || typeof MediaRecorder === 'undefined') return;
    const tipo = tipoDeVideo();
    let g: MediaRecorder;
    try {
      g = new MediaRecorder(s, {
        ...(tipo ? { mimeType: tipo } : {}),
        // Así 2 minutos caben en el límite de 25 MB
        videoBitsPerSecond: 1_400_000,
        audioBitsPerSecond: 64_000,
      });
    } catch {
      return;
    }
    trozosRef.current = [];
    g.ondataavailable = (e) => {
      if (e.data.size) trozosRef.current.push(e.data);
    };
    g.onstop = () => {
      const dur = (Date.now() - inicioRef.current) / 1000;
      const mime = (g.mimeType || tipo || 'video/webm').split(';')[0];
      const blob = new Blob(trozosRef.current, { type: mime });
      setGrabando(false);
      setSegundos(0);
      if (terminadoRef.current || dur < 0.5 || !blob.size) return;
      const file = new File([blob], `video-${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`, { type: mime });
      duracionGrabada.set(file, Math.round(dur * 10) / 10);
      onListo([file]);
    };
    grabadorRef.current = g;
    inicioRef.current = Date.now();
    g.start(500);
    setSegundos(0);
    setGrabando(true);
    navigator.vibrate?.(30);
  };

  const pararGrabacion = () => {
    const g = grabadorRef.current;
    if (g && g.state === 'recording') g.stop();
  };

  // ---------- Botón grande ----------
  const alPresionar = (e: React.PointerEvent) => {
    if (!listo) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = presionRef.current;
    p.activo = true;
    p.manteniendo = false;
    if (grabando) return; // en Video, el siguiente toque la detiene (al soltar)
    p.t = setTimeout(() => {
      p.manteniendo = true;
      empezarGrabacion();
    }, MANTENER_MS);
  };

  const alSoltar = () => {
    const p = presionRef.current;
    if (!p.activo) return;
    p.activo = false;
    if (p.t) clearTimeout(p.t);
    p.t = null;
    if (p.manteniendo) {
      p.manteniendo = false;
      pararGrabacion(); // soltar = terminar
      return;
    }
    if (grabando) {
      pararGrabacion();
      return;
    }
    if (modo === 'foto') void tomarFoto();
    else empezarGrabacion(); // Video: un toque empieza
  };

  const cancelarToque = () => {
    const p = presionRef.current;
    if (p.t) clearTimeout(p.t);
    p.t = null;
    if (p.manteniendo) pararGrabacion();
    p.manteniendo = false;
    p.activo = false;
  };

  const alternar = (f: File) => {
    setElegidas((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else if (n.size < 10) n.add(f);
      return n;
    });
    setVersion((v) => v + 1);
  };

  const progreso = Math.min(1, segundos / MAX_VIDEO_SECONDS);
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-[70] bg-black text-white flex flex-col select-none" style={{ touchAction: 'none' }}>
      {/* Imagen de la cámara */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={frontal ? { transform: 'scaleX(-1)' } : undefined}
        />
        {!listo && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-['Inter'] text-white/70">Abriendo la cámara…</div>
        )}
        {destello && <div className="absolute inset-0 bg-white/70" />}

        {/* Arriba: cerrar, tiempo y flash */}
        <div
          className="absolute top-0 inset-x-0 flex items-center justify-between px-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}
        >
          <button
            type="button"
            onClick={onCerrar}
            className={`w-12 h-12 rounded-full bg-black/35 flex items-center justify-center ${grabando ? 'invisible' : ''}`}
            aria-label="Cerrar la cámara"
          >
            <X className="w-7 h-7" strokeWidth={2} />
          </button>
          {(grabando || modo === 'video') && (
            <span
              className={`px-4 h-10 rounded-full flex items-center font-['Inter'] font-semibold text-lg tabular-nums ${
                grabando ? 'bg-[#E5484D]' : 'bg-black/35'
              }`}
            >
              {reloj(segundos)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void cambiarFlash()}
            className={`w-12 h-12 rounded-full bg-black/35 flex items-center justify-center ${!hayFlash || grabando ? 'invisible' : ''}`}
            aria-label={flash ? 'Apagar el flash' : 'Encender el flash'}
          >
            {flash ? <Zap className="w-6 h-6 text-[#F28C1B]" strokeWidth={2} fill="currentColor" /> : <ZapOff className="w-6 h-6" strokeWidth={2} />}
          </button>
        </div>

        {/* Abajo, encima de la imagen: fila de fotos, galería, botón y voltear */}
        <div className="absolute bottom-0 inset-x-0 pb-3">
          {modo === 'foto' && !grabando && recientes.length > 0 && (
            <div className="relative">
              {elegidas.size > 0 && (
                <button
                  type="button"
                  onClick={() => onListo(Array.from(elegidas))}
                  className="absolute -top-16 right-4 w-14 h-14 rounded-full bg-[#1E9E5A] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                  aria-label={`Enviar ${elegidas.size} fotos elegidas`}
                >
                  <Check className="w-7 h-7" strokeWidth={2.5} />
                  <span className="absolute bottom-1.5 right-2 text-[11px] font-['Inter'] font-semibold">{elegidas.size}</span>
                </button>
              )}
              <div className="flex gap-1 overflow-x-auto px-1 pb-3" style={{ touchAction: 'pan-x' }}>
                {recientes.map((r) => {
                  const si = elegidas.has(r.file);
                  return (
                    <button
                      key={r.url}
                      type="button"
                      onClick={() => alternar(r.file)}
                      className="relative shrink-0 w-[76px] h-[76px] overflow-hidden"
                      aria-pressed={si}
                      aria-label={si ? 'Quitar de las elegidas' : 'Elegir esta foto'}
                    >
                      <img decoding="async" src={r.url} alt="" className="w-full h-full object-cover" />
                      {si && (
                        <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Check className="w-8 h-8" strokeWidth={2.5} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-8">
            <button
              type="button"
              onClick={onGaleria}
              className={`w-12 h-12 rounded-full bg-black/35 flex items-center justify-center ${grabando ? 'invisible' : ''}`}
              aria-label="Abrir la galería"
            >
              <ImageIcon className="w-6 h-6" strokeWidth={2} />
            </button>

            <button
              type="button"
              onPointerDown={alPresionar}
              onPointerUp={alSoltar}
              onPointerCancel={cancelarToque}
              onContextMenu={(e) => e.preventDefault()}
              disabled={!listo}
              className={`relative flex items-center justify-center transition-transform ${grabando ? 'w-28 h-28' : 'w-20 h-20'}`}
              aria-label={modo === 'foto' ? 'Tomar foto (mantén presionado para grabar video)' : grabando ? 'Terminar el video' : 'Grabar video'}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50" cy="50" r={R} fill="none" stroke="white" strokeWidth="4" />
                {grabando && (
                  <circle
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke="#E5484D"
                    strokeWidth="4"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progreso)}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <span
                className={`rounded-full transition-all ${
                  grabando ? 'w-10 h-10 bg-[#E5484D]' : modo === 'video' ? 'w-[60px] h-[60px] bg-[#E5484D]' : 'w-[62px] h-[62px] bg-white'
                } ${tomando ? 'scale-90 opacity-80' : ''} flex items-center justify-center`}
              >
                {tomando && <span className="w-7 h-7 rounded-full border-[3px] border-[#005198] border-t-transparent animate-spin" />}
              </span>
            </button>

            <button
              type="button"
              onClick={voltear}
              className={`w-12 h-12 rounded-full bg-black/35 flex items-center justify-center ${grabando ? 'invisible' : ''}`}
              aria-label="Voltear la cámara"
            >
              <SwitchCamera className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="shrink-0 h-16 flex items-center justify-center gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {!grabando &&
          (['video', 'foto'] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`h-10 px-5 rounded-full font-['Inter'] text-[15px] ${modo === m ? 'bg-white/15 text-white' : 'text-white/85'}`}
              aria-pressed={modo === m}
            >
              {m === 'video' ? 'Video' : 'Foto'}
            </button>
          ))}
      </div>
    </div>
  );
};
