import React from 'react';
import { DIBUJO, TEMAS, type Fondo } from '../lib/fondo';

/** Dibuja el fondo del chat (tema o foto propia) ocupando todo su contenedor. */
export const CapaFondo: React.FC<{ fondo: Fondo; extraOscuro?: number; className?: string }> = ({ fondo, extraOscuro = 0, className = '' }) => {
  const tema = TEMAS.find((t) => t.id === fondo.tema);
  const propio = fondo.tema === 'propio' ? fondo.propio : undefined;
  if (!propio && !tema?.fondo) return null;
  const oscuro = Math.min(0.85, fondo.oscuro / 100 + extraOscuro);
  const mascara = { WebkitMaskImage: `url(${DIBUJO})`, maskImage: `url(${DIBUJO})`, WebkitMaskSize: 'cover', maskSize: 'cover', WebkitMaskPosition: 'center', maskPosition: 'center', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' } as React.CSSProperties;
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      {propio ? (
        <img src={propio} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: tema!.fondo }}>
          <div className="absolute inset-0" style={{ backgroundColor: tema!.lineas, ...mascara }} />
        </div>
      )}
      {oscuro > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: oscuro }} />}
    </div>
  );
};
