import React from 'react';
import { Pin, X } from 'lucide-react';
import type { DecryptedMessage } from '../types/chat';

const resumen = (m?: DecryptedMessage) => {
  if (!m) return 'Mensaje fijado';
  if (m.deleted_for_all) return 'Se eliminó este mensaje';
  if (m.decryptionError) return 'Mensaje cifrado';
  const p = m.payload;
  if (p?.text) return p.text;
  if (p?.media?.sticker) return 'Sticker';
  return { image: '📷 Foto', video: '🎥 Video', audio: p?.media?.music ? '🎵 Música' : '🎤 Nota de voz', text: 'Mensaje' }[m.kind];
};

/** Franja debajo de la cabecera con el mensaje fijado. */
export const MensajeFijado: React.FC<{ mensaje?: DecryptedMessage; onIr: () => void; onQuitar: () => void }> = ({
  mensaje,
  onIr,
  onQuitar,
}) => (
  <div className="shrink-0 flex items-center gap-2 pl-3 pr-1 py-1.5 bg-white dark:bg-[#253240] border-b border-[#E3E7EC] dark:border-[#003A73] relative z-20">
    <Pin className="w-4 h-4 text-[#F28C1B] shrink-0 rotate-45" strokeWidth={2} />
    <button type="button" onClick={onIr} className="flex-1 min-w-0 text-left">
      <span className="block text-[11px] font-['Poppins'] font-semibold text-[#005198] dark:text-white leading-tight">Mensaje fijado</span>
      <span className="block text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] truncate">{resumen(mensaje)}</span>
    </button>
    <button type="button" onClick={onQuitar} className="p-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Quitar mensaje fijado">
      <X className="w-4 h-4" strokeWidth={2} />
    </button>
  </div>
);
