import React from 'react';
import { X, Check, CheckCheck, Clock, Eye, Timer } from 'lucide-react';
import type { DecryptedMessage } from '../types/chat';

const fecha = (t?: string | null) =>
  t
    ? new Date(t).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '—';

/** Cuándo se envió, se entregó y se leyó un mensaje. */
export const InfoMensaje: React.FC<{ mensaje: DecryptedMessage; nombre: string; onCerrar: () => void }> = ({ mensaje, nombre, onCerrar }) => {
  const filas: [React.ReactNode, string, string][] = [
    [<Clock key="e" className="w-5 h-5" strokeWidth={2} />, 'Enviado', fecha(mensaje.created_at)],
    [<Check key="g" className="w-5 h-5" strokeWidth={2} />, `Entregado a ${nombre}`, fecha(mensaje.delivered_at)],
    [<CheckCheck key="l" className="w-5 h-5" strokeWidth={2.5} />, `Leído por ${nombre}`, fecha(mensaje.read_at)],
  ];
  if (mensaje.view_once) filas.push([<Eye key="v" className="w-5 h-5" strokeWidth={2} />, 'Abierto (ver una vez)', fecha(mensaje.viewed_at)]);
  if (mensaje.expires_at) filas.push([<Timer key="t" className="w-5 h-5" strokeWidth={2} />, 'Se borra', fecha(mensaje.expires_at)]);
  if (mensaje.edited_at) filas.push([<Clock key="ed" className="w-5 h-5" strokeWidth={2} />, 'Editado', fecha(mensaje.edited_at)]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[8px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white">Info del mensaje</h3>
          <button type="button" onClick={onCerrar} className="p-2 -mr-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        <ul className="space-y-3">
          {filas.map(([icono, titulo, valor]) => (
            <li key={titulo} className="flex items-center gap-3">
              <span className="text-[#005198] dark:text-[#E3E7EC]">{icono}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-['Inter'] text-[#1F2933] dark:text-white">{titulo}</span>
                <span className="block text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] first-letter:uppercase">{valor}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
