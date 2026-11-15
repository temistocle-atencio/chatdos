import React, { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../lib/media';

// Barras de sonido mientras se graba una nota de voz (como WhatsApp):
// cada ~90 ms entra una barra nueva por la derecha con el volumen del micrófono
// y las viejas se corren a la izquierda. Si no entra sonido, quedan como puntos.

type Props = {
  /** Volumen actual de 0 a 1 */
  nivel: () => number;
  className?: string;
  style?: React.CSSProperties;
  /** En pausa: las barras se quedan quietas */
  detenida?: boolean;
};

const ANCHO_BARRA = 3;
const ESPACIO = 2;
const CADA_MS = 90;

const OndaEnVivo: React.FC<Props> = ({ nivel, className = '', style, detenida = false }) => {
  const cajaRef = useRef<HTMLDivElement>(null);
  const nivelRef = useRef(nivel);
  nivelRef.current = nivel;
  const [cuantas, setCuantas] = useState(30);
  const [barras, setBarras] = useState<number[]>([]);

  // Cuántas barras caben en el ancho disponible
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const medir = () => setCuantas(Math.max(8, Math.floor(caja.clientWidth / (ANCHO_BARRA + ESPACIO))));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (detenida) return;
    let anterior = 0;
    const t = setInterval(() => {
      // Un poco de suavizado para que no salte de golpe
      const v = Math.max(nivelRef.current(), anterior * 0.55);
      anterior = v;
      setBarras((b) => {
        const n = b.length >= cuantas ? b.slice(b.length - cuantas + 1) : b.slice();
        n.push(v);
        return n;
      });
    }, CADA_MS);
    return () => clearInterval(t);
  }, [cuantas, detenida]);

  return (
    <div ref={cajaRef} className={`flex items-center justify-end overflow-hidden h-8 ${className}`} style={style} aria-hidden="true">
      {barras.map((v, i) => (
        <span
          key={barras.length - i}
          className="shrink-0 rounded-full bg-current"
          style={{
            width: ANCHO_BARRA,
            marginLeft: ESPACIO,
            height: `${Math.max(ANCHO_BARRA, Math.round(v * 30))}px`,
            transition: 'height 80ms linear',
          }}
        />
      ))}
    </div>
  );
};

export default OndaEnVivo;

/** Reloj de la grabación (se actualiza solo, sin volver a dibujar el chat) */
export const TiempoGrabacion: React.FC<{ segundos: () => number }> = ({ segundos }) => {
  const leer = useRef(segundos);
  leer.current = segundos;
  const [s, setS] = useState(() => Math.floor(segundos()));
  useEffect(() => {
    const t = setInterval(() => setS(Math.floor(leer.current())), 250);
    return () => clearInterval(t);
  }, []);
  return <>{formatDuration(s)}</>;
};
