import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { altoBarra, formatDuration, nivelesDeAudio } from '../lib/media';

// Escuchar lo grabado antes de enviarlo, con la grabación en pausa (como WhatsApp):
// play/pausa, barras de lo grabado con un punto que marca por dónde va, y el tiempo.

type Props = {
  /** Lo grabado hasta ahora */
  blob: Blob;
  /** Segundos grabados (el navegador no siempre sabe la duración de un audio a medio grabar) */
  duracion: number;
};

const BARRAS = 40;

const VistaPreviaGrabacion: React.FC<Props> = ({ blob, duracion }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url] = useState(() => URL.createObjectURL(blob));
  const [onda, setOnda] = useState<number[] | null>(null);
  const [sonando, setSonando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [error, setError] = useState(false);
  const arrastrando = useRef(false);

  // Al continuar, enviar o borrar se quita la vista previa: que deje de sonar
  useEffect(() => {
    const a = audioRef.current;
    return () => {
      a?.pause();
      URL.revokeObjectURL(url);
    };
  }, [url]);

  useEffect(() => {
    let vivo = true;
    blob
      .arrayBuffer()
      .then((d) => nivelesDeAudio(d, BARRAS))
      .then((o) => vivo && setOnda(o))
      .catch(() => vivo && setOnda(Array.from({ length: BARRAS }, () => 0)));
    return () => {
      vivo = false;
    };
  }, [blob]);

  const alternar = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (sonando) {
      a.pause();
      return;
    }
    try {
      if (a.ended || tiempo >= duracion - 0.05) a.currentTime = 0;
      await a.play();
      setError(false);
    } catch {
      setError(true);
    }
  };

  const saltarA = (e: React.PointerEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - caja.left) / caja.width)) * duracion;
    if (audioRef.current) audioRef.current.currentTime = t;
    setTiempo(t);
  };

  const avance = duracion > 0 ? Math.min(1, tiempo / duracion) : 0;

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        className="w-9 h-11 shrink-0 flex items-center justify-center text-[#1F2933] dark:text-white"
        aria-label={sonando ? 'Pausar lo grabado' : 'Escuchar lo grabado'}
        title={error ? 'No se pudo reproducir' : sonando ? 'Pausar' : 'Escuchar'}
      >
        {sonando ? (
          <Pause className="w-6 h-6" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="w-6 h-6" fill="currentColor" strokeWidth={0} />
        )}
      </button>
      <div
        role="slider"
        aria-label="Avance de lo grabado"
        aria-valuemin={0}
        aria-valuemax={Math.round(duracion)}
        aria-valuenow={Math.round(tiempo)}
        tabIndex={0}
        onPointerDown={(e) => {
          arrastrando.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          saltarA(e);
        }}
        onPointerMove={(e) => arrastrando.current && saltarA(e)}
        onPointerUp={() => (arrastrando.current = false)}
        onPointerCancel={() => (arrastrando.current = false)}
        className="relative flex-1 min-w-0 h-8 flex items-center justify-between cursor-pointer touch-none"
      >
        {(onda ?? Array.from({ length: BARRAS }, () => 0)).map((v, i, l) => (
          <span
            key={i}
            className={`w-[3px] shrink-0 rounded-full ${
              (i + 0.5) / l.length <= avance ? 'bg-[#005198] dark:bg-white' : 'bg-[#5B6670]/45 dark:bg-white/40'
            }`}
            style={{ height: altoBarra(v) }}
          />
        ))}
        <span
          className="absolute top-1/2 w-3.5 h-3.5 -mt-[7px] -ml-[7px] rounded-full bg-[#005198] dark:bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
          style={{ left: `${avance * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="shrink-0 text-[15px] font-['Inter'] tabular-nums text-[#1F2933] dark:text-white">
        {formatDuration(sonando || tiempo ? tiempo : duracion)}
      </span>
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        playsInline
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => {
          setSonando(false);
          setTiempo(0);
        }}
        onError={() => setError(true)}
        onTimeUpdate={(e) => !arrastrando.current && setTiempo(Math.min(duracion, e.currentTarget.currentTime))}
      />
    </>
  );
};

export default VistaPreviaGrabacion;
