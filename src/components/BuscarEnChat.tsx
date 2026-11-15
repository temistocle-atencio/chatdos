import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, X, Search } from 'lucide-react';
import type { DecryptedMessage } from '../types/chat';

/** Quita tildes y mayúsculas para buscar como lo haría una persona. */
export const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Barra de búsqueda dentro del chat (encima de la cabecera). */
export const BuscarEnChat: React.FC<{
  mensajes: DecryptedMessage[];
  texto: string;
  onTexto: (t: string) => void;
  onIr: (id: string) => void;
  onCerrar: () => void;
  hayAnteriores: boolean;
  onCargarAnteriores: () => void;
}> = ({ mensajes, texto, onTexto, onIr, onCerrar, hayAnteriores, onCargarAnteriores }) => {
  const campo = useRef<HTMLInputElement>(null);
  const [actual, setActual] = useState(0);

  const encontrados = useMemo(() => {
    const q = normalizar(texto.trim());
    if (q.length < 2) return [];
    return mensajes
      .filter((m) => !m.deleted_for_all && !m.decryptionError && m.payload?.text && normalizar(m.payload.text).includes(q))
      .map((m) => m.id)
      .reverse(); // del más nuevo al más viejo
  }, [mensajes, texto]);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  useEffect(() => {
    setActual(0);
    if (encontrados[0]) onIr(encontrados[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encontrados.join()]);

  const mover = (paso: number) => {
    if (!encontrados.length) return;
    const n = (actual + paso + encontrados.length) % encontrados.length;
    setActual(n);
    onIr(encontrados[n]);
  };

  return (
    <div className="absolute inset-x-0 top-0 z-40 bg-[#003A73] text-white px-2 flex items-center gap-1 h-full">
      <button type="button" onClick={onCerrar} className="p-2 rounded-[5px] hover:bg-white/10" aria-label="Cerrar búsqueda">
        <X className="w-5 h-5" strokeWidth={2} />
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2 h-9 px-3 rounded-full bg-white/15">
        <Search className="w-4 h-4 text-white/80 shrink-0" strokeWidth={2} />
        <input
          ref={campo}
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') mover(e.shiftKey ? -1 : 1);
            if (e.key === 'Escape') onCerrar();
          }}
          placeholder="Buscar en el chat"
          className="flex-1 min-w-0 bg-transparent text-sm font-['Inter'] text-white placeholder:text-white/60 focus:outline-none"
          aria-label="Buscar en el chat"
        />
      </div>
      <span className="text-xs font-['Inter'] text-white/80 w-14 text-center shrink-0">
        {texto.trim().length < 2 ? '' : encontrados.length ? `${actual + 1} de ${encontrados.length}` : 'Nada'}
      </span>
      <button type="button" onClick={() => mover(1)} disabled={!encontrados.length} className="p-2 rounded-[5px] hover:bg-white/10 disabled:opacity-40" aria-label="Anterior (más viejo)">
        <ChevronUp className="w-5 h-5" strokeWidth={2} />
      </button>
      <button type="button" onClick={() => mover(-1)} disabled={!encontrados.length} className="p-2 rounded-[5px] hover:bg-white/10 disabled:opacity-40" aria-label="Siguiente (más nuevo)">
        <ChevronDown className="w-5 h-5" strokeWidth={2} />
      </button>
      {hayAnteriores && texto.trim().length >= 2 && (
        <button type="button" onClick={onCargarAnteriores} className="hidden sm:block text-[11px] font-['Inter'] underline px-1 shrink-0">
          Buscar más atrás
        </button>
      )}
    </div>
  );
};

/** Pinta en amarillo lo que coincide con la búsqueda. */
export function resaltarTexto(texto: string, busqueda: string): React.ReactNode {
  const q = normalizar(busqueda.trim());
  if (q.length < 2) return texto;
  const n = normalizar(texto);
  const partes: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (true) {
    const j = n.indexOf(q, i);
    if (j < 0) break;
    if (j > i) partes.push(texto.slice(i, j));
    partes.push(
      <mark key={k++} className="bg-[#F28C1B]/70 text-inherit rounded-[2px]">
        {texto.slice(j, j + q.length)}
      </mark>
    );
    i = j + q.length;
  }
  partes.push(texto.slice(i));
  return partes;
}
