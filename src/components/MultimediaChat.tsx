import React, { useMemo, useState } from 'react';
import { ArrowLeft, Link2, ExternalLink } from 'lucide-react';
import { useAtras } from '../lib/atras';
import { formatMessageDateSeparator } from '../lib/formatters';
import type { DecryptedMessage } from '../types/chat';

// "Multimedia del chat" (como en WhatsApp): todas las fotos y videos, los audios y los
// enlaces de la conversación, en pestañas. Tocar una foto abre el carrusel.

type Pestana = 'fotos' | 'audios' | 'enlaces';

const RE_ENLACE = /https?:\/\/[^\s<>"']+/gi;

export const MultimediaChat: React.FC<{
  mensajes: DecryptedMessage[];
  nombre: string;
  /** Casilla de una foto o un video (abre el carrusel al tocarla) */
  casilla: (m: DecryptedMessage) => React.ReactNode;
  /** Reproductor de un audio */
  audio: (m: DecryptedMessage) => React.ReactNode;
  autor: (m: DecryptedMessage) => string;
  hayAnteriores: boolean;
  onCargarAnteriores: () => void;
  onCerrar: () => void;
}> = ({ mensajes, nombre, casilla, audio, autor, hayAnteriores, onCargarAnteriores, onCerrar }) => {
  useAtras(true, onCerrar);
  const [pestana, setPestana] = useState<Pestana>('fotos');

  const util = (m: DecryptedMessage) => !m.deleted_for_all && !m.decryptionError && !m.view_once && !!m.payload;
  const fotos = useMemo(
    () => mensajes.filter((m) => util(m) && (m.kind === 'image' || m.kind === 'video') && !m.payload?.media?.sticker).reverse(),
    [mensajes]
  );
  const audios = useMemo(() => mensajes.filter((m) => util(m) && m.kind === 'audio').reverse(), [mensajes]);
  const enlaces = useMemo(() => {
    const lista: { m: DecryptedMessage; url: string; titulo?: string; sitio?: string; imagen?: string }[] = [];
    for (const m of mensajes) {
      if (!util(m)) continue;
      const e = m.payload?.enlace;
      const urls = new Set<string>([...(m.payload?.text?.match(RE_ENLACE) ?? []), ...(e ? [e.url] : [])]);
      urls.forEach((url) =>
        lista.push({ m, url, ...(e && e.url === url ? { titulo: e.titulo, sitio: e.sitio, imagen: e.imagen } : {}) })
      );
    }
    return lista.reverse();
  }, [mensajes]);

  const pestanas: { id: Pestana; texto: string; n: number }[] = [
    { id: 'fotos', texto: 'Fotos y videos', n: fotos.length },
    { id: 'audios', texto: 'Audios', n: audios.length },
    { id: 'enlaces', texto: 'Enlaces', n: enlaces.length },
  ];

  const vacio = (texto: string) => (
    <p className="py-16 px-6 text-center text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">{texto}</p>
  );

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-[#F2F4F7] dark:bg-[#1F2933] animate-[subir_0.22s_ease-out]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="shrink-0 bg-[#003A73] text-white">
        <div className="h-14 flex items-center gap-2 px-2">
          <button type="button" onClick={onCerrar} className="w-10 h-10 flex items-center justify-center" aria-label="Volver al chat">
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <p className="text-[16px] font-['Poppins'] font-semibold truncate">{nombre}</p>
        </div>
        <div className="flex" role="tablist">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`flex-1 h-11 text-[13px] font-['Inter'] font-medium border-b-[3px] ${
                pestana === p.id ? 'border-[#F28C1B] text-white' : 'border-transparent text-white/70'
              }`}
            >
              {p.texto}
              {p.n > 0 && <span className="ml-1 text-white/60">{p.n}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {pestana === 'fotos' &&
          (fotos.length ? (
            <div className="grid grid-cols-3 gap-[2px] p-[2px]">
              {fotos.map((m) => (
                <div key={m.id} className="relative aspect-square overflow-hidden bg-[#E3E7EC] dark:bg-[#253240]">
                  {casilla(m)}
                </div>
              ))}
            </div>
          ) : (
            vacio('Aquí salen las fotos y videos que se envíen en este chat.')
          ))}

        {pestana === 'audios' &&
          (audios.length ? (
            <ul className="p-2 flex flex-col gap-2">
              {audios.map((m) => (
                <li key={m.id} className="rounded-[8px] bg-white dark:bg-[#253240] px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                  <p className="mb-1 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
                    {autor(m)} · {formatMessageDateSeparator(m.payload?.sentAt || m.created_at)}
                  </p>
                  <div className="text-[#1F2933] dark:text-white">{audio(m)}</div>
                </li>
              ))}
            </ul>
          ) : (
            vacio('Aquí salen las notas de voz y los audios de este chat.')
          ))}

        {pestana === 'enlaces' &&
          (enlaces.length ? (
            <ul className="p-2 flex flex-col gap-2">
              {enlaces.map(({ m, url, titulo, sitio, imagen }, i) => (
                <li key={`${m.id}-${i}`}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-[8px] bg-white dark:bg-[#253240] p-2 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  >
                    {imagen ? (
                      <img src={imagen} alt="" className="w-14 h-14 shrink-0 rounded-[5px] object-cover" />
                    ) : (
                      <span className="w-14 h-14 shrink-0 rounded-[5px] bg-[#F2F4F7] dark:bg-[#1F2933] flex items-center justify-center text-[#005198] dark:text-white">
                        <Link2 className="w-6 h-6" strokeWidth={2} />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      {titulo && <span className="block text-sm font-['Inter'] font-medium text-[#1F2933] dark:text-white truncate">{titulo}</span>}
                      <span className="block text-xs font-['Inter'] text-[#005198] dark:text-[#C9CFD6] truncate">{sitio || url}</span>
                      <span className="block text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
                        {autor(m)} · {formatMessageDateSeparator(m.payload?.sentAt || m.created_at)}
                      </span>
                    </span>
                    <ExternalLink className="w-4 h-4 shrink-0 text-[#5B6670] dark:text-[#E3E7EC]" strokeWidth={2} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            vacio('Aquí salen los enlaces que se compartan en este chat.')
          ))}

        {hayAnteriores && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={onCargarAnteriores}
              className="px-4 py-2 rounded-full bg-white dark:bg-[#253240] text-xs font-['Poppins'] font-medium text-[#005198] dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
            >
              Buscar en mensajes más antiguos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
