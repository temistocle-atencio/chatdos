import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw, Loader2 } from 'lucide-react';
import { formatDuration } from '../lib/media';

// Reproductor de video propio (para el carrusel): tocar para pausar, doble toque a los lados
// para saltar 10 segundos, barra para adelantar, velocidad y silencio. Los controles se
// esconden solos mientras se reproduce.

const VELOCIDADES = [1, 1.5, 2, 0.5];

export const ReproductorVideo: React.FC<{ src: string; autoPlay?: boolean; poster?: string }> = ({ src, autoPlay = true, poster }) => {
  const vRef = useRef<HTMLVideoElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [sonando, setSonando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [silencio, setSilencio] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [controles, setControles] = useState(true);
  const [salto, setSalto] = useState<{ lado: 'izq' | 'der'; n: number } | null>(null);
  const ocultarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toqueRef = useRef<{ t: number; x: number } | null>(null);
  const arrastrando = useRef(false);

  // Esconder los controles a los 2,5 s mientras suena
  const mostrar = () => {
    setControles(true);
    if (ocultarRef.current) clearTimeout(ocultarRef.current);
    ocultarRef.current = setTimeout(() => {
      if (vRef.current && !vRef.current.paused) setControles(false);
    }, 2500);
  };
  useEffect(() => {
    mostrar();
    return () => {
      if (ocultarRef.current) clearTimeout(ocultarRef.current);
    };
  }, []);
  useEffect(() => {
    if (!sonando) setControles(true);
    else mostrar();
  }, [sonando]);

  const alternar = () => {
    const v = vRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  const saltar = (seg: number) => {
    const v = vRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seg));
    setTiempo(v.currentTime);
    setSalto({ lado: seg < 0 ? 'izq' : 'der', n: Date.now() });
    mostrar();
  };
  useEffect(() => {
    if (!salto) return;
    const t = setTimeout(() => setSalto(null), 600);
    return () => clearTimeout(t);
  }, [salto]);

  // Un toque: mostrar/ocultar controles o pausar · doble toque a un lado: saltar 10 s
  const alTocar = (e: React.PointerEvent<HTMLDivElement>) => {
    const ahora = Date.now();
    const caja = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - caja.left) / caja.width;
    const antes = toqueRef.current;
    if (antes && ahora - antes.t < 300 && Math.abs(antes.x - x) < 0.2) {
      toqueRef.current = null;
      if (x < 0.35) saltar(-10);
      else if (x > 0.65) saltar(10);
      else alternar();
      return;
    }
    toqueRef.current = { t: ahora, x };
    setTimeout(() => {
      if (toqueRef.current?.t !== ahora) return;
      toqueRef.current = null;
      if (controles && sonando) setControles(false);
      else mostrar();
    }, 300);
  };

  const irA = (clientX: number) => {
    const b = barraRef.current;
    const v = vRef.current;
    if (!b || !v || !duracion) return;
    const r = b.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duracion;
    v.currentTime = t;
    setTiempo(t);
  };

  const cambiarVelocidad = () => {
    const i = (VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length;
    setVelocidad(VELOCIDADES[i]);
    if (vRef.current) vRef.current.playbackRate = VELOCIDADES[i];
    mostrar();
  };

  const avance = duracion ? (tiempo / duracion) * 100 : 0;
  const boton = 'w-11 h-11 rounded-full flex items-center justify-center text-white';

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black select-none" onPointerUp={alTocar}>
      <video
        ref={vRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        muted={silencio}
        className="max-w-full max-h-full"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => setSonando(false)}
        onWaiting={() => setCargando(true)}
        onCanPlay={() => setCargando(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          v.playbackRate = velocidad;
          if (Number.isFinite(v.duration)) setDuracion(v.duration);
          else {
            // Videos grabados en el navegador no traen la duración: se pide saltando al final
            const alSaber = () => {
              if (!Number.isFinite(v.duration)) return;
              v.removeEventListener('durationchange', alSaber);
              setDuracion(v.duration);
              v.currentTime = 0;
            };
            v.addEventListener('durationchange', alSaber);
            v.currentTime = 1e7;
          }
        }}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuracion(e.currentTarget.duration)}
        onTimeUpdate={(e) => !arrastrando.current && setTiempo(e.currentTarget.currentTime)}
      />

      {cargando && (
        <span className="absolute pointer-events-none">
          <Loader2 className="w-10 h-10 text-white animate-spin" strokeWidth={2} />
        </span>
      )}

      {/* Aviso del salto de 10 s */}
      {salto && (
        <span
          key={salto.n}
          className={`absolute top-1/2 -translate-y-1/2 ${salto.lado === 'izq' ? 'left-8' : 'right-8'} flex flex-col items-center text-white animate-[aparecer_0.2s_ease-out] pointer-events-none`}
        >
          {salto.lado === 'izq' ? <RotateCcw className="w-9 h-9" strokeWidth={2} /> : <RotateCw className="w-9 h-9" strokeWidth={2} />}
          <span className="text-xs font-['Inter'] mt-1">10 s</span>
        </span>
      )}

      {/* Botón grande de play/pausa */}
      {controles && !cargando && (
        <button
          type="button"
          onPointerUp={(e) => e.stopPropagation()}
          onClick={alternar}
          className="absolute w-[72px] h-[72px] rounded-full bg-black/50 text-white flex items-center justify-center animate-[aparecer_0.15s_ease-out]"
          aria-label={sonando ? 'Pausar' : 'Reproducir'}
        >
          {sonando ? <Pause className="w-9 h-9" fill="currentColor" strokeWidth={0} /> : <Play className="w-9 h-9 ml-1" fill="currentColor" strokeWidth={0} />}
        </button>
      )}

      {/* Barra de abajo */}
      <div
        className={`absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 bg-gradient-to-t from-black/70 to-transparent transition-opacity ${
          controles ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div
          ref={barraRef}
          role="slider"
          aria-label="Avance del video"
          aria-valuemin={0}
          aria-valuemax={Math.round(duracion)}
          aria-valuenow={Math.round(tiempo)}
          tabIndex={0}
          className="relative h-7 flex items-center cursor-pointer touch-none"
          onPointerDown={(e) => {
            arrastrando.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            irA(e.clientX);
          }}
          onPointerMove={(e) => arrastrando.current && irA(e.clientX)}
          onPointerUp={() => {
            arrastrando.current = false;
            mostrar();
          }}
          onPointerCancel={() => (arrastrando.current = false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') saltar(5);
            if (e.key === 'ArrowLeft') saltar(-5);
            if (e.key === ' ') {
              e.preventDefault();
              alternar();
            }
          }}
        >
          <div className="w-full h-1 rounded-full bg-white/35">
            <div className="h-full rounded-full bg-[#F28C1B]" style={{ width: `${avance}%` }} />
          </div>
          <span
            className="absolute w-3.5 h-3.5 -ml-[7px] rounded-full bg-[#F28C1B] shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
            style={{ left: `${avance}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex items-center gap-1 text-white">
          <button type="button" onClick={alternar} className={boton} aria-label={sonando ? 'Pausar' : 'Reproducir'}>
            {sonando ? <Pause className="w-5 h-5" fill="currentColor" strokeWidth={0} /> : <Play className="w-5 h-5" fill="currentColor" strokeWidth={0} />}
          </button>
          <span className="text-xs font-['Inter'] tabular-nums">
            {formatDuration(tiempo)} / {formatDuration(duracion)}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={cambiarVelocidad}
            className="h-8 min-w-[44px] px-2 rounded-full bg-white/15 text-[13px] font-['Poppins'] font-semibold"
            aria-label={`Velocidad ${velocidad}×. Toca para cambiarla`}
          >
            {velocidad}×
          </button>
          <button
            type="button"
            onClick={() => {
              setSilencio((s) => !s);
              mostrar();
            }}
            className={boton}
            aria-label={silencio ? 'Activar el sonido' : 'Silenciar'}
            aria-pressed={silencio}
          >
            {silencio ? <VolumeX className="w-5 h-5" strokeWidth={2} /> : <Volume2 className="w-5 h-5" strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
};
