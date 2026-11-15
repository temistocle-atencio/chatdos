import React from 'react';
import { DIBUJITOS, DIBUJO, TAM_DIBUJITOS, TEMAS, type Fondo } from '../lib/fondo';

/** Dibuja el fondo del chat (tema o foto propia) ocupando todo su contenedor. */
export const CapaFondo: React.FC<{
  fondo: Fondo;
  extraOscuro?: number;
  /** La app está en modo oscuro: los temas con colores de noche los usan */
  modoOscuro?: boolean;
  /** Tamaño del mosaico de dibujitos (más chico en las miniaturas) */
  tamDibujo?: number;
  className?: string;
}> = ({ fondo, extraOscuro = 0, modoOscuro = false, tamDibujo = TAM_DIBUJITOS, className = '' }) => {
  const tema = TEMAS.find((t) => t.id === fondo.tema);
  const propio = fondo.tema === 'propio' ? fondo.propio : undefined;
  if (!propio && !tema?.fondo) return null;
  const deNoche = !propio && modoOscuro && !!tema?.noche;
  // Con colores de noche no hace falta la capa negra del modo oscuro
  const oscuro = Math.min(0.85, fondo.oscuro / 100 + (deNoche ? 0 : extraOscuro));
  const colores = deNoche ? tema!.noche! : { fondo: tema?.fondo, lineas: tema?.lineas };
  const mascara = (
    tema?.dibujo === 'dibujitos'
      ? {
          WebkitMaskImage: `url(${DIBUJITOS})`,
          maskImage: `url(${DIBUJITOS})`,
          WebkitMaskSize: `${tamDibujo}px`,
          maskSize: `${tamDibujo}px`,
          WebkitMaskRepeat: 'repeat',
          maskRepeat: 'repeat',
        }
      : {
          WebkitMaskImage: `url(${DIBUJO})`,
          maskImage: `url(${DIBUJO})`,
          WebkitMaskSize: 'cover',
          maskSize: 'cover',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }
  ) as React.CSSProperties;
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      {propio ? (
        <img src={propio} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: colores.fondo }}>
          <div className="absolute inset-0" style={{ backgroundColor: colores.lineas, ...mascara }} />
        </div>
      )}
      {oscuro > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: oscuro }} />}
    </div>
  );
};
