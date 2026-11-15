import React from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import type { DecryptedMessage } from '../types/chat';
import { useAtras } from '../lib/atras';

// Fotos y videos enviados juntos, en una sola burbuja (como WhatsApp):
//   2 → una al lado de la otra · 3 → una grande y dos chicas · 4 → cuadrícula
//   5 o más → cuadrícula de 4 y la última con "+N"; al tocarla se ven todas.

type Casilla = (m: DecryptedMessage) => React.ReactNode;

export const AlbumMosaico: React.FC<{
  mensajes: DecryptedMessage[];
  casilla: Casilla;
  onVerTodo: () => void;
}> = ({ mensajes, casilla, onVerTodo }) => {
  const n = mensajes.length;
  const lado = 'w-[min(260px,62vw)]';
  const caja = 'relative overflow-hidden rounded-[3px] min-w-0 min-h-0';

  if (n === 2) {
    return (
      <div className={`${lado} grid grid-cols-2 gap-[3px] aspect-[2/1]`}>
        {mensajes.map((m) => (
          <div key={m.id} className={caja}>
            {casilla(m)}
          </div>
        ))}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className={`${lado} grid grid-cols-2 grid-rows-2 gap-[3px] aspect-square`}>
        <div className={`${caja} row-span-2`}>{casilla(mensajes[0])}</div>
        <div className={caja}>{casilla(mensajes[1])}</div>
        <div className={caja}>{casilla(mensajes[2])}</div>
      </div>
    );
  }

  const cuatro = mensajes.slice(0, 4);
  const resto = n - 4;
  return (
    <div className={`${lado} grid grid-cols-2 grid-rows-2 gap-[3px] aspect-square`}>
      {cuatro.map((m, i) => (
        <div key={m.id} className={caja}>
          {casilla(m)}
          {i === 3 && resto > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVerTodo();
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-[30px] font-['Poppins'] font-medium"
              aria-label={`Ver las ${n} fotos y videos`}
            >
              +{resto}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

/** Todas las fotos y videos del álbum, en pantalla completa (se abre desde el "+N") */
export const AlbumCompleto: React.FC<{
  mensajes: DecryptedMessage[];
  titulo: string;
  casilla: Casilla;
  onOpciones: (m: DecryptedMessage) => void;
  onCerrar: () => void;
}> = ({ mensajes, titulo, casilla, onOpciones, onCerrar }) => {
  useAtras(true, onCerrar);
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-[#F2F4F7] dark:bg-[#1F2933]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="h-14 shrink-0 flex items-center gap-2 px-2 bg-white dark:bg-[#253240] border-b border-[#E3E7EC] dark:border-[#003A73]">
        <button
          type="button"
          onClick={onCerrar}
          className="w-10 h-10 flex items-center justify-center text-[#1F2933] dark:text-white"
          aria-label="Volver al chat"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <p className="text-[15px] font-['Poppins'] font-semibold text-[#1F2933] dark:text-white truncate">{titulo}</p>
          <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
            {mensajes.length} {mensajes.every((m) => m.kind === 'image') ? 'fotos' : 'fotos y videos'}
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {mensajes.map((m) => (
            <div key={m.id} className="relative aspect-square overflow-hidden rounded-[3px] bg-[#E3E7EC] dark:bg-[#253240]">
              {casilla(m)}
              <button
                type="button"
                onClick={() => onOpciones(m)}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center"
                aria-label="Opciones de esta foto"
              >
                <MoreVertical className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
