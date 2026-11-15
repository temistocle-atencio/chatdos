import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, MoreVertical, Download, Forward, ChevronLeft, ChevronRight, Loader2, Play, Reply } from 'lucide-react';
import { FotoConZoom } from './FotoConZoom';
import { useAtras } from '../lib/atras';
import { bajarOriginal } from '../lib/originales';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const original = m.kind === 'image' ? m.payload?.media?.original : undefined;
  const [verOriginal, setVerOriginal] = useState<{ pct: number; listo: boolean; error?: boolean } | null>(null);
  const abrirOriginal = async () => {
    if (!original) return;
    setVerOriginal({ pct: 0, listo: false });
    try {
      const u = await bajarOriginal(original, (pct) => setVerOriginal({ pct, listo: false }));
      setUrl(u);
      setVerOriginal({ pct: 100, listo: true });
    } catch {
      setVerOriginal({ pct: 0, listo: false, error: true });
    }
  };

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

  // El video que se deja de ver se pausa
  useEffect(() => {
    if (!activa) videoRef.current?.pause();
  }, [activa]);

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
          <video ref={videoRef} src={url} controls autoPlay playsInline className="max-w-full max-h-full" />
        ) : (
          <span className="relative flex items-center justify-center">
            {thumb && <img src={thumb} alt="" className="max-w-full max-h-[80vh] object-contain" />}
            <Play className="absolute w-14 h-14 text-white fill-white/90 drop-shadow" strokeWidth={1.5} />
          </span>
        )
      ) : (
        <FotoConZoom src={url} />
      )}
      {/* Foto enviada en calidad Original: se puede ver completa (con todo el detalle al hacer zoom) */}
      {original && url && activa && !verOriginal?.listo && (
        <button
          type="button"
          onClick={() => void abrirOriginal()}
          disabled={!!verOriginal && !verOriginal.error}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 h-10 px-4 rounded-full bg-black/65 border border-white/30 text-white text-sm font-['Inter'] flex items-center gap-2"
        >
          {verOriginal && !verOriginal.error ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> Bajando original… {verOriginal.pct}%
            </>
          ) : verOriginal?.error ? (
            'No se pudo. Tocar para reintentar'
          ) : (
            `Ver original · ${formatearPeso(original.size)}`
          )}
        </button>
      )}
      {verOriginal?.listo && activa && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 h-7 rounded-full bg-black/55 text-white text-xs font-['Inter'] flex items-center">
          Original · {formatearPeso(original?.size ?? 0)}
        </span>
      )}
    </div>
  );
};

const formatearPeso = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

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
      className="fixed inset-0 z-[60] bg-black flex flex-col"
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
