import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cargarColeccion, coleccionEnMemoria, urlSticker, type Sticker } from '../lib/stickers';
import { IconoSticker } from './Iconos';

const Celda: React.FC<{ s: Sticker; onElegir: (url: string) => void }> = ({ s, onElegir }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    urlSticker(s)
      .then((u) => vivo && setUrl(u))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [s]);
  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => url && onElegir(url)}
      className="aspect-square rounded-[8px] flex items-center justify-center active:bg-white/10"
      aria-label="Poner este sticker"
    >
      {url ? <img src={url} alt="" className="max-w-full max-h-full object-contain" draggable={false} /> : <span className="w-10 h-10 rounded-[6px] bg-white/10 animate-pulse" />}
    </button>
  );
};

/** Hoja con mis stickers para ponerlos encima de una foto o un video */
export const SelectorStickers: React.FC<{
  userId: string;
  miLlavePublica: unknown;
  onElegir: (url: string) => void;
  onCerrar: () => void;
}> = ({ userId, miLlavePublica, onElegir, onCerrar }) => {
  const [lista, setLista] = useState<Sticker[] | null>(coleccionEnMemoria(userId));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cargarColeccion(userId, miLlavePublica)
      .then(setLista)
      .catch(() => setError('No se pudieron cargar tus stickers'));
  }, [userId, miLlavePublica]);

  return (
    <div className="absolute inset-0 z-10 flex items-end bg-black/50" onClick={onCerrar}>
      <div
        className="w-full bg-[#1F2933] text-white rounded-t-[16px] p-3 max-h-[55dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="mx-auto mb-3 w-10 h-1 rounded-full bg-white/30" />
        {error ? (
          <p className="text-sm text-center py-6 text-[#FCA5A5]">{error}</p>
        ) : lista === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} />
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-white/80">
            <IconoSticker className="w-10 h-10" />
            Todavía no tienes stickers. Agrégalos desde el panel de stickers del chat.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {lista.map((s) => (
              <Celda key={s.id} s={s} onElegir={onElegir} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
