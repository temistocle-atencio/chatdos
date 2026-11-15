import React, { useState } from 'react';
import { Timer, Check } from 'lucide-react';
import { DURACIONES } from '../lib/ajustesChat';

/** Elegir si los mensajes nuevos se borran solos. */
export const TemporalesModal: React.FC<{ actual: number; onElegir: (s: number) => Promise<void>; onCerrar: () => void }> = ({
  actual,
  onElegir,
  onCerrar,
}) => {
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[8px] p-5"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white flex items-center gap-2 mb-1">
          <Timer className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Mensajes temporales</span>
        </h3>
        <p className="text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-4 leading-relaxed">
          Los mensajes <strong>nuevos</strong> se borran solos para los dos después del tiempo elegido. Los que ya están no cambian.
        </p>
        <div className="flex flex-col gap-2">
          {DURACIONES.map((d) => (
            <button
              key={d.segundos}
              type="button"
              disabled={guardando !== null}
              onClick={async () => {
                setError(null);
                setGuardando(d.segundos);
                try {
                  await onElegir(d.segundos);
                  onCerrar();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'No se pudo cambiar.');
                } finally {
                  setGuardando(null);
                }
              }}
              className={`h-11 px-4 rounded-[5px] border text-sm font-['Inter'] flex items-center justify-between ${
                actual === d.segundos
                  ? 'border-[#005198] dark:border-white text-[#005198] dark:text-white font-semibold'
                  : 'border-[#C9CFD6] dark:border-[#003A73] text-[#1F2933] dark:text-[#E3E7EC]'
              } disabled:opacity-60`}
            >
              <span>{guardando === d.segundos ? 'Guardando…' : d.nombre}</span>
              {actual === d.segundos && <Check className="w-4 h-4" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-xs font-['Inter'] text-[#B03030]">{error}</p>}
      </div>
    </div>
  );
};
