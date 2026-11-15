import React, { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { descargarCopia, type ProgresoCopia } from '../lib/copiaChat';

/** Tarjeta de Ajustes: descargar la conversación en un archivo. */
export const CopiaSeguridad: React.FC = () => {
  const { user } = useAuth();
  const [progreso, setProgreso] = useState<ProgresoCopia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const empezar = async () => {
    if (!user) return;
    setError(null);
    setListo(false);
    setProgreso({ paso: 'Empezando…', hecho: 0, total: 0 });
    try {
      await descargarCopia(user.id, setProgreso);
      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo hacer la copia.');
    } finally {
      setProgreso(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
      <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-1">
        <Download className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <span>Copia de seguridad</span>
      </h3>
      <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] leading-relaxed mb-3">
        Descarga tu conversación con fotos, videos y audios en un archivo .zip. Se abre en cualquier computador o celular,
        sin la app. Guárdalo en un lugar seguro: ahí los mensajes ya no van cifrados.
      </p>
      {progreso ? (
        <div className="space-y-2">
          <p className="text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
            <span>
              {progreso.paso}
              {progreso.total ? ` (${progreso.hecho} de ${progreso.total})` : ''}
            </span>
          </p>
          {progreso.total > 0 && (
            <div className="h-1.5 rounded-full bg-[#E3E7EC] dark:bg-[#1F2933] overflow-hidden">
              <div className="h-full bg-[#005198] dark:bg-white transition-all" style={{ width: `${Math.round((progreso.hecho / progreso.total) * 100)}%` }} />
            </div>
          )}
          <p className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">No cierres la app mientras termina.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void empezar()}
          className="w-full h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors"
        >
          Descargar copia
        </button>
      )}
      {listo && <p className="mt-2 text-xs font-['Inter'] text-[#1E7A44]">Listo. Revisa tus descargas.</p>}
      {error && <p className="mt-2 text-xs font-['Inter'] text-[#B03030]">{error}</p>}
    </div>
  );
};
