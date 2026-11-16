import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';

/**
 * Pantalla mientras abre la app. Si por algo tarda demasiado (señal muy mala, el celular no respondió),
 * aparece un botón para intentar de nuevo: nunca hay que salir de la app y volver a entrar.
 */
export const PantallaCarga: React.FC<{ texto?: string }> = ({ texto }) => {
  const [lento, setLento] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLento(true), 10000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F4F7] dark:bg-[#1F2933] px-6 text-center">
      <Logo variant="color" layout="vertical" cubeHeight={44} className="mb-4 animate-pulse" />
      {texto && <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">{texto}</p>}
      {lento && (
        <>
          <p className="mt-4 text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">Está tardando más de lo normal. Revisa tu conexión.</p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-3 h-10 px-5 rounded-[5px] bg-[#005198] text-white text-sm font-['Poppins'] font-semibold"
          >
            Intentar de nuevo
          </button>
        </>
      )}
    </div>
  );
};
