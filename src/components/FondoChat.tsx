import React, { useRef, useState } from 'react';
import { Check, ImagePlus, X, Ban } from 'lucide-react';
import { avisarSelectorArchivo } from '../lib/bloqueo';
import { TEMAS, guardarFondo, hayFondo, prepararFondoPropio, useFondo, type Fondo } from '../lib/fondo';
import { CapaFondo } from './CapaFondo';

/** Elegir el fondo del chat: temas incluidos o una foto propia, con vista previa. */
export const FondoChat: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const guardado = useFondo();
  const [fondo, setFondo] = useState<Fondo>(guardado);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const imagen = hayFondo(fondo);

  const elegirFoto = async (f: File) => {
    setError(null);
    setCargando(true);
    try {
      setFondo({ tema: 'propio', propio: await prepararFondoPropio(f), oscuro: fondo.oscuro || 15 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo usar esa imagen.');
    } finally {
      setCargando(false);
    }
  };

  const celda = (activo: boolean) =>
    `relative aspect-[3/4] rounded-[8px] overflow-hidden border-2 ${activo ? 'border-[#F28C1B]' : 'border-transparent'}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center" onClick={onCerrar}>
      <div
        className="w-full max-w-md max-h-[92dvh] flex flex-col bg-white dark:bg-[#253240] rounded-t-[16px] sm:rounded-[8px] overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-12 shrink-0">
          <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white">Fondo del chat</h3>
          <button type="button" onClick={onCerrar} className="p-2 -mr-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
          {/* Vista previa */}
          <div className="relative h-44 rounded-[8px] overflow-hidden bg-[#F2F4F7] dark:bg-[#1F2933] mb-3 border border-[#E3E7EC] dark:border-[#003A73]">
            <CapaFondo fondo={fondo} />
            <div className="relative p-3 flex flex-col gap-1.5">
              <span className="self-start max-w-[70%] px-2.5 py-1.5 rounded-[5px] bg-white text-[#1F2933] text-[13px] font-['Inter'] shadow">Hola 👋 ¿cómo vas?</span>
              <span className="self-end max-w-[70%] px-2.5 py-1.5 rounded-[5px] bg-[#005198] text-white text-[13px] font-['Inter'] shadow">¡Muy bien! Mira el fondo nuevo</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFondo({ tema: t.id, oscuro: fondo.tema === 'propio' ? 0 : fondo.oscuro })}
                className={celda(fondo.tema === t.id)}
                aria-label={t.nombre}
                aria-pressed={fondo.tema === t.id}
              >
                {t.fondo ? (
                  <CapaFondo fondo={{ tema: t.id, oscuro: 0 }} />
                ) : (
                  <span className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#F2F4F7] dark:bg-[#1F2933] text-[#5B6670] dark:text-[#E3E7EC]">
                    <Ban className="w-5 h-5" strokeWidth={2} />
                  </span>
                )}
                <span className="absolute bottom-0 inset-x-0 py-0.5 bg-black/40 text-white text-[10px] font-['Inter'] text-center">{t.nombre}</span>
                {fondo.tema === t.id && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#F28C1B] text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
            {/* Foto propia */}
            <button
              type="button"
              onClick={() => {
                avisarSelectorArchivo();
                archivoRef.current?.click();
              }}
              className={celda(fondo.tema === 'propio')}
              aria-label="Usar una foto mía"
            >
              {fondo.tema === 'propio' && fondo.propio ? (
                <img src={fondo.propio} alt="" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <span className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#F2F4F7] dark:bg-[#1F2933] text-[#005198] dark:text-white">
                  <ImagePlus className="w-6 h-6" strokeWidth={2} />
                </span>
              )}
              <span className="absolute bottom-0 inset-x-0 py-0.5 bg-black/40 text-white text-[10px] font-['Inter'] text-center">
                {cargando ? 'Cargando…' : 'Mi foto'}
              </span>
            </button>
          </div>

          {imagen && (
            <div className="mt-4">
              <label className="flex items-center justify-between text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-1">
                <span>Oscurecer (para leer mejor)</span>
                <span>{fondo.oscuro} %</span>
              </label>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={fondo.oscuro}
                onChange={(e) => setFondo({ ...fondo, oscuro: Number(e.target.value) })}
                className="w-full accent-[#005198]"
                aria-label="Oscurecer el fondo"
              />
            </div>
          )}
          {error && <p className="mt-2 text-xs font-['Inter'] text-[#B03030]">{error}</p>}
          <p className="mt-3 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
            El fondo se guarda solo en este celular. La otra persona no lo ve.
          </p>
        </div>

        <div className="p-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              await guardarFondo(fondo);
              onCerrar();
            }}
            disabled={cargando}
            className="w-full h-11 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm disabled:opacity-60"
          >
            Poner fondo
          </button>
        </div>

        <input
          ref={archivoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) elegirFoto(f);
          }}
        />
      </div>
    </div>
  );
};
