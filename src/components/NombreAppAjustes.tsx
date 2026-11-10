import React, { useState } from 'react';
import { Type, Check } from 'lucide-react';
import { guardarNombreApp, NOMBRE_POR_DEFECTO, partirNombre, useNombreApp } from '../lib/nombreApp';

/** Solo se muestra al administrador: cambia el nombre de la aplicación para todos. */
export const NombreAppAjustes: React.FC = () => {
  const actual = useNombreApp();
  const [nombre, setNombre] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [p1, p2] = partirNombre(nombre.trim() || NOMBRE_POR_DEFECTO);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setListo(false);
    setGuardando(true);
    try {
      await guardarNombreApp(nombre);
      setListo(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el nombre.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
      <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-2">
        <Type className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <span>Nombre de la aplicación</span>
      </h3>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3 leading-relaxed">
        Solo tú, como administrador, puedes cambiarlo. Se actualiza para todos. Si escribes dos palabras o una palabra con dos
        mayúsculas (por ejemplo «ChatDos»), la primera parte sale en azul y la segunda en naranja.
      </p>
      <form onSubmit={guardar} className="space-y-3">
        <input
          type="text"
          value={nombre}
          maxLength={24}
          onChange={(e) => {
            setNombre(e.target.value);
            setListo(false);
          }}
          disabled={guardando}
          className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]"
          aria-label="Nombre de la aplicación"
        />
        <div className="p-3 rounded-[5px] bg-[#F2F4F7] dark:bg-[#1F2933] text-center font-['Poppins'] font-bold text-xl">
          <span className="text-[#005198] dark:text-white">{p1}</span>
          <span className="text-[#F28C1B]">{p2}</span>
        </div>
        {error && <p className="text-xs font-['Inter'] text-[#B03030]">{error}</p>}
        {listo && (
          <p className="text-xs font-['Inter'] text-[#1E7A44] flex items-start gap-1.5">
            <Check className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>
              Nombre cambiado. Dentro de la app ya se ve. El nombre debajo del ícono del celular solo cambia si se quita y se
              vuelve a instalar la app.
            </span>
          </p>
        )}
        <button
          type="submit"
          disabled={guardando || nombre.trim() === actual}
          className="w-full h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar nombre'}
        </button>
      </form>
    </div>
  );
};
