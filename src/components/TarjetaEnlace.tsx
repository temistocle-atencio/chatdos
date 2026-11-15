import React from 'react';
import { X, Link2, Loader2 } from 'lucide-react';
import type { VistaEnlace } from '../lib/enlaces';

/** Tarjeta del enlace dentro de la burbuja (foto, sitio, título y descripción) */
export const TarjetaEnlace: React.FC<{ e: VistaEnlace; isMine: boolean }> = ({ e, isMine }) => (
  <a
    href={e.url}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(ev) => ev.stopPropagation()}
    className={`block -mx-1 -mt-0.5 mb-1.5 rounded-[6px] overflow-hidden ${
      isMine ? 'bg-black/15 hover:bg-black/20' : 'bg-[#F2F4F7] dark:bg-white/10 hover:brightness-95'
    }`}
  >
    {e.imagen && <img src={e.imagen} alt="" className="block w-full max-h-[180px] object-cover" draggable={false} />}
    <span className="block px-2.5 py-2">
      {e.titulo && <span className="block text-[13px] font-['Inter'] font-semibold leading-snug line-clamp-2">{e.titulo}</span>}
      {e.descripcion && (
        <span className={`block mt-0.5 text-xs font-['Inter'] leading-snug line-clamp-2 ${isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'}`}>
          {e.descripcion}
        </span>
      )}
      {e.sitio && (
        <span className={`block mt-1 text-[11px] font-['Inter'] truncate ${isMine ? 'text-white/75' : 'text-[#5B6670] dark:text-[#C9CFD6]'}`}>
          {e.sitio}
        </span>
      )}
    </span>
  </a>
);

/** Tarjeta encima de la barra de escribir, antes de enviar */
export const VistaPreviaEscribiendo: React.FC<{ cargando: boolean; e: VistaEnlace | null; onQuitar: () => void }> = ({
  cargando,
  e,
  onQuitar,
}) => (
  <div className="flex items-center gap-2 mb-1.5 p-2 bg-white dark:bg-[#253240] rounded-[8px] border border-[#E3E7EC] dark:border-[#003A73] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
    {cargando ? (
      <span className="w-14 h-14 rounded-[6px] bg-[#F2F4F7] dark:bg-[#1F2933] flex items-center justify-center shrink-0">
        <Loader2 className="w-5 h-5 animate-spin text-[#5B6670]" strokeWidth={2} />
      </span>
    ) : e?.imagen ? (
      <img src={e.imagen} alt="" className="w-14 h-14 rounded-[6px] object-cover shrink-0" />
    ) : (
      <span className="w-14 h-14 rounded-[6px] bg-[#F2F4F7] dark:bg-[#1F2933] flex items-center justify-center shrink-0 text-[#005198] dark:text-white">
        <Link2 className="w-6 h-6" strokeWidth={2} />
      </span>
    )}
    <span className="flex-1 min-w-0">
      <span className="block text-[13px] font-['Inter'] font-semibold text-[#1F2933] dark:text-white truncate">
        {cargando ? 'Cargando vista previa…' : e?.titulo || e?.sitio || 'Enlace'}
      </span>
      {!cargando && e?.descripcion && (
        <span className="block text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] line-clamp-2">{e.descripcion}</span>
      )}
      {!cargando && e?.sitio && e.titulo && (
        <span className="block text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#C9CFD6] truncate">{e.sitio}</span>
      )}
    </span>
    <button
      type="button"
      onClick={onQuitar}
      className="w-8 h-8 flex items-center justify-center shrink-0 text-[#5B6670] dark:text-[#E3E7EC]"
      aria-label="Quitar la vista previa"
      title="Quitar la vista previa"
    >
      <X className="w-4 h-4" strokeWidth={2} />
    </button>
  </div>
);
