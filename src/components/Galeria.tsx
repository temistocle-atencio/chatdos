import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, MoreVertical, Download, Forward, ChevronLeft, ChevronRight, Loader2, Play, Reply } from 'lucide-react';
import { FotoConZoom } from './FotoConZoom';
import { ReproductorVideo } from './ReproductorVideo';
import { useAtras } from '../lib/atras';
import { formatMessageDateSeparator, formatMessageTime } from '../lib/formatters';
import type { DecryptedMessage } from '../types/chat';

// Visor de fotos y videos en carrusel (como WhatsApp): se desliza a los lados para pasar
// por todas las fotos y videos del chat. Los tres puntos tienen Descargar y Reenviar.

type Props = {
  /** Fotos y videos del chat, en orden */
  items: DecryptedMessage[];
  /** Por cuál empieza */
  inicio: number;
  /** Nombre de quien envió cada uno */
  autor: (m: DecryptedMessage) => string;
  /** Archivo ya descifrado (lo baja si hace falta) */
  obtenerUrl: (m: DecryptedMessage) => Promise<string | undefined>;
  onDescargar: (m: DecryptedMessage) => void;
  onReenviar?: (m: DecryptedMessage) => void;
  /** Responder a esta foto o video en el chat */
  onResponder?: (m: DecryptedMessage) => void;
  onCerrar: () => void;
};

/** Una foto o un video del carrusel. Solo se baja cuando está cerca de verse. */
const Diapositiva: React.FC<{
  m: DecryptedMessage;
  cerca: boolean;
  activa: boolean;
  obtenerUrl: Props['obtenerUrl'];
}> = ({ m, cerca, activa, obtenerUrl }) => {
  const [url, setUrl] = useState<string | undefined>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!cerca || url) return;
    let vivo = true;
    obtenerUrl(m)
      .then((u) => vivo && (u ? setUrl(u) : setError(true)))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [cerca, url, m, obtenerUrl]);

  const thumb = m.payload?.media?.thumb;
  return (
    <div className="relative w-full h-full shrink-0 snap-center snap-always flex items-center justify-center p-2 select-none" style={{ WebkitTouchCallout: 'none' }}>
      {!url ? (
        <>
          {thumb && <img src={thumb} alt="" className="absolute inset-0 m-auto max-w-full max-h-full object-contain blur-md opacity-60" />}
          {error ? (
            <span className="relative text-white text-sm font-['Inter']">No se pudo cargar</span>
          ) : (
            <Loader2 className="relative w-10 h-10 text-white animate-spin" strokeWidth={2} />
          )}
        </>
      ) : m.kind === 'video' ? (
        activa ? (
          <ReproductorVideo src={url} poster={thumb} />
        ) : (
          <span className="relative flex items-center justify-center">
            {thumb && <img src={thumb} alt="" className="max-w-full max-h-[80vh] object-contain" />}
            <Play className="absolute w-14 h-14 text-white fill-white/90 drop-shadow" strokeWidth={1.5} />
          </span>
        )
      ) : (
        <FotoConZoom src={url} />
      )}
    </div>
  );
};

export const Galeria: React.FC<Props> = ({ items, inicio, autor, obtenerUrl, onDescargar, onReenviar, onResponder, onCerrar }) => {
  useAtras(true, onCerrar);
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(inicio);
  const [menu, setMenu] = useState(false);
  const m = items[actual];

  // Empieza en la foto que se tocó
  useLayoutEffect(() => {
    const p = pista.current;
    if (p) p.scrollLeft = inicio * p.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alDeslizar = () => {
    const p = pista.current;
    if (!p || !p.clientWidth) return;
    const i = Math.round(p.scrollLeft / p.clientWidth);
    if (i !== actual && i >= 0 && i < items.length) {
      setActual(i);
      setMenu(false);
    }
  };

  const ir = useCallback(
    (i: number) => {
      const p = pista.current;
      if (!p || i < 0 || i >= items.length) return;
      p.scrollTo({ left: i * p.clientWidth, behavior: 'smooth' });
    },
    [items.length]
  );

  // Teclado (computador): flechas para pasar, Escape para cerrar
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') ir(actual + 1);
      else if (e.key === 'ArrowLeft') ir(actual - 1);
      else if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [actual, ir, onCerrar]);

  // Si se gira el celular, se queda en la misma foto
  useEffect(() => {
    const alCambiar = () => {
      const p = pista.current;
      if (p) p.scrollLeft = actual * p.clientWidth;
    };
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, [actual]);

  if (!m) return null;
  const fecha = m.payload?.sentAt || m.created_at;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col animate-[aparecer_0.2s_ease-out]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Arriba: volver, quién y cuándo, cuántas, opciones */}
      <div className="relative h-14 shrink-0 flex items-center gap-1 px-1 text-white">
        <button type="button" onClick={onCerrar} className="w-11 h-11 flex items-center justify-center" aria-label="Volver al chat">
          <ArrowLeft className="w-6 h-6" strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-['Poppins'] font-semibold truncate">{autor(m)}</p>
          <p className="text-xs font-['Inter'] text-white/75 truncate">
            {formatMessageDateSeparator(fecha)}, {formatMessageTime(fecha)}
            {items.length > 1 && ` · ${actual + 1} de ${items.length}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          className="w-11 h-11 flex items-center justify-center"
          aria-label="Más opciones"
          aria-expanded={menu}
        >
          <MoreVertical className="w-6 h-6" strokeWidth={2} />
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-[1]" onClick={() => setMenu(false)} aria-hidden="true" />
            <div className="absolute right-2 top-12 z-[2] min-w-[190px] py-1 rounded-[8px] bg-white dark:bg-[#253240] shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onDescargar(m);
                }}
                className="w-full h-12 px-4 flex items-center gap-3 text-sm font-['Inter'] text-[#1F2933] dark:text-white hover:bg-[#F2F4F7] dark:hover:bg-white/5"
              >
                <Download className="w-5 h-5" strokeWidth={2} />
                {m.kind === 'video' ? 'Descargar video' : 'Descargar foto'}
              </button>
              {onResponder && (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onResponder(m);
                  }}
                  className="w-full h-12 px-4 flex items-center gap-3 text-sm font-['Inter'] text-[#1F2933] dark:text-white hover:bg-[#F2F4F7] dark:hover:bg-white/5"
                >
                  <Reply className="w-5 h-5" strokeWidth={2} />
                  Responder
                </button>
              )}
              {onReenviar && (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onReenviar(m);
                  }}
                  className="w-full h-12 px-4 flex items-center gap-3 text-sm font-['Inter'] text-[#1F2933] dark:text-white hover:bg-[#F2F4F7] dark:hover:bg-white/5"
                >
                  <Forward className="w-5 h-5" strokeWidth={2} />
                  Reenviar
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Carrusel: se desliza a los lados */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={pista}
          onScroll={alDeslizar}
          className="absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overscrollBehaviorX: 'contain' }}
        >
          {items.map((x, i) => (
            <Diapositiva key={x.id} m={x} cerca={Math.abs(i - actual) <= 1} activa={i === actual} obtenerUrl={obtenerUrl} />
          ))}
        </div>
        {/* Flechas (computador) */}
        {actual > 0 && (
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2} />
          </button>
        )}
        {actual < items.length - 1 && (
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-6 h-6" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Comentario de la foto, si tiene */}
      {m.payload?.text && (
        <p className="shrink-0 max-h-28 overflow-y-auto px-4 py-3 text-center text-sm font-['Inter'] text-white/90 whitespace-pre-wrap break-words">
          {m.payload.text}
        </p>
      )}
    </div>
  );
};
