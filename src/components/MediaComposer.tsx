import React, { useEffect, useState } from 'react';
import { useAtras } from '../lib/atras';
import { X, Send, Music, Play, Crop, Smile, Type, Pencil, Scissors, Loader2 } from 'lucide-react';
import { compressImage, formatBytes, formatDuration, inspectVideo } from '../lib/media';
import { EditorFoto, type HerramientaFoto } from './EditorFoto';
import { EditorVideo } from './EditorVideo';
import { IconoCamaraColor, IconoContactoColor, IconoGaleriaColor, IconoSticker, IconoUbicacionColor, IconoVerUnaVez, IconoVerUnaVezActivo } from './Iconos';

// Archivo listo para enviar (ya comprimido o revisado)
export interface PendingMedia {
  kind: 'image' | 'video' | 'audio';
  blob: Blob;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  thumb?: string;
  name?: string;
  music?: boolean;
  sticker?: boolean;
}

// Menú para elegir qué adjuntar (cuadrícula como en WhatsApp)
export const AttachSheet: React.FC<{
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onVideoCamera?: () => void;
  onUbicacion: () => void;
  onContacto: () => void;
  onAudioFile: () => void;
}> = ({ onClose, onGallery, onCamera, onUbicacion, onContacto, onAudioFile }) => {
  const item = (icon: React.ReactNode, color: string, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={() => {
        onClose();
        onClick();
      }}
      className="flex flex-col items-center gap-1.5 py-1 active:scale-95 transition-transform"
    >
      <span className="w-[68px] h-[52px] rounded-full border border-[#E3E7EC] dark:border-[#003A73] flex items-center justify-center" style={{ color }} data-icono>
        {icon}
      </span>
      <span className="text-[13px] font-['Inter'] text-[#1F2933] dark:text-white">{label}</span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[#253240] rounded-t-[20px] shadow-[0_-2px_12px_rgba(0,0,0,0.12)] pt-2 px-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 w-10 h-1 rounded-full bg-[#C9CFD6] dark:bg-[#5B6670]" aria-hidden="true" />
        <div className="grid grid-cols-4 gap-y-4">
          {item(<IconoGaleriaColor className="w-7 h-7" />, '#0066FF', 'Galería', onGallery)}
          {item(<IconoCamaraColor className="w-7 h-7" />, '#F52E71', 'Cámara', onCamera)}
          {item(<IconoUbicacionColor className="w-8 h-8" />, '#1E8E3E', 'Ubicación', onUbicacion)}
          {item(<IconoContactoColor className="w-7 h-7" />, '#0c52bb', 'Contacto', onContacto)}
          {item(<Music className="w-6 h-6" strokeWidth={2} />, '#D46A00', 'Audio', onAudioFile)}
        </div>
      </div>
    </div>
  );
};

// Vista previa antes de enviar (una o varias fotos / videos), con editor como en WhatsApp
export const MediaComposer: React.FC<{
  medias: PendingMedia[];
  onCancel: () => void;
  onRemove: (index: number) => void;
  onSend: (opts: { caption: string; viewOnce: boolean }) => void;
  /** Reemplaza un archivo por su versión editada */
  onCambiar?: (index: number, m: PendingMedia) => void;
  userId?: string;
  miLlavePublica?: unknown;
}> = ({ medias, onCancel, onRemove, onSend, onCambiar, userId, miLlavePublica }) => {
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [actual, setActual] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);
  const [editarFoto, setEditarFoto] = useState<HerramientaFoto | null>(null);
  const [editarVideo, setEditarVideo] = useState(false);
  const [preparando, setPreparando] = useState(false);
  // Botón atrás: primero cierra el editor y vuelve a la vista previa
  useAtras(!!editarFoto, () => setEditarFoto(null));
  useAtras(editarVideo, () => setEditarVideo(false));

  useEffect(() => {
    const us = medias.map((m) => URL.createObjectURL(m.blob));
    setUrls(us);
    return () => us.forEach((u) => URL.revokeObjectURL(u));
  }, [medias]);

  useEffect(() => {
    if (actual > medias.length - 1) setActual(Math.max(0, medias.length - 1));
  }, [medias.length, actual]);

  const indice = Math.min(actual, medias.length - 1);
  const media = medias[indice];
  const url = urls[indice];
  if (!media) return null;
  const varios = medias.length > 1;
  const sePuedeEditar = !!onCambiar && !media.sticker;

  const fotoEditada = async (b: Blob) => {
    setEditarFoto(null);
    setPreparando(true);
    try {
      const img = await compressImage(new File([b], 'foto.jpg', { type: b.type || 'image/jpeg' }));
      onCambiar?.(indice, { kind: 'image', blob: img.blob, mime: img.mime, width: img.width, height: img.height, thumb: img.thumb });
    } finally {
      setPreparando(false);
    }
  };

  const videoEditado = async (r: { blob: Blob; duracion: number }) => {
    setEditarVideo(false);
    setPreparando(true);
    try {
      const info = await inspectVideo(r.blob);
      const duration = Number.isFinite(info.duration) && info.duration > 0 ? info.duration : r.duracion;
      onCambiar?.(indice, { kind: 'video', blob: r.blob, mime: r.blob.type || 'video/webm', ...info, duration });
    } finally {
      setPreparando(false);
    }
  };

  const boton = (etiqueta: string, alTocar: () => void, hijo: React.ReactNode) => (
    <button
      type="button"
      onClick={alTocar}
      className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
      aria-label={etiqueta}
      title={etiqueta}
    >
      {hijo}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Arriba: cerrar y herramientas */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 shrink-0 text-white">
        {boton('Cancelar', onCancel, <X className="w-6 h-6" strokeWidth={2} />)}
        <div className="flex-1" />
        {sePuedeEditar && media.kind === 'image' && (
          <>
            {boton('Recortar y girar', () => setEditarFoto('recortar'), <Crop className="w-5 h-5" strokeWidth={2} />)}
            {userId && boton('Stickers', () => setEditarFoto('sticker'), <IconoSticker className="w-5 h-5" />)}
            {boton('Emojis', () => setEditarFoto('emoji'), <Smile className="w-5 h-5" strokeWidth={2} />)}
            {boton('Texto', () => setEditarFoto('texto'), <Type className="w-5 h-5" strokeWidth={2} />)}
            {boton('Dibujar', () => setEditarFoto('dibujar'), <Pencil className="w-5 h-5" strokeWidth={2} />)}
          </>
        )}
        {sePuedeEditar && media.kind === 'video' && (
          <>
            {boton('Recortar o quitar el sonido', () => setEditarVideo(true), <Scissors className="w-5 h-5" strokeWidth={2} />)}
            {boton('Stickers, emojis, texto y dibujo', () => setEditarVideo(true), <Pencil className="w-5 h-5" strokeWidth={2} />)}
          </>
        )}
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center p-1">
        {url && media.kind === 'image' && (
          <img
            src={url}
            alt="Vista previa"
            className="max-w-full max-h-full object-contain"
            onClick={() => sePuedeEditar && setEditarFoto('dibujar')}
          />
        )}
        {url && media.kind === 'video' && (
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <video key={url} src={url} controls playsInline className="max-w-full max-h-[calc(100dvh-220px)]" />
            <span className="absolute top-2 left-2 px-3 h-7 rounded-full bg-black/55 text-white text-xs font-['Inter'] flex items-center gap-1.5">
              {formatDuration(media.duration || 0)} <span aria-hidden>•</span> {formatBytes(media.blob.size)}
            </span>
          </div>
        )}
        {url && media.kind === 'audio' && (
          <div className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[5px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2 mb-3 text-[#1F2933] dark:text-white">
              <Music className="w-5 h-5 shrink-0" strokeWidth={2} />
              <span className="text-sm font-['Inter'] truncate">{media.name || 'Audio'}</span>
            </div>
            <audio src={url} controls playsInline className="w-full" />
            <p className="mt-2 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
              {formatDuration(media.duration || 0)} · {formatBytes(media.blob.size)}
            </p>
          </div>
        )}
        {preparando && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-['Inter'] gap-2">
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} /> Guardando los cambios…
          </div>
        )}
      </div>

      {varios && (
        <div className="shrink-0 flex gap-3 overflow-x-auto px-3 pt-2.5 pb-2" aria-label="Archivos elegidos">
          {medias.map((m, i) => (
            <div key={i} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setActual(i)}
                className={`block w-14 h-14 rounded-[5px] overflow-hidden transition-opacity ${
                  i === actual ? 'ring-2 ring-[#F28C1B] ring-offset-2 ring-offset-black' : 'opacity-60'
                }`}
                aria-label={`Ver archivo ${i + 1}`}
              >
                {m.kind === 'image' && urls[i] ? (
                  <img src={urls[i]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center bg-[#1F2933] text-white">
                    <Play className="w-5 h-5" strokeWidth={2} />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1F2933] border border-white/60 text-white flex items-center justify-center"
                aria-label={`Quitar archivo ${i + 1}`}
              >
                <X className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Abajo: comentario, ver una vez y enviar */}
      <div className="shrink-0 px-2 pt-1 pb-2 flex items-end gap-2">
        {!viewOnce && media.kind !== 'audio' ? (
          <div className="flex-1 min-w-0 h-12 flex items-center rounded-full bg-[#1F2933] px-1">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 1000))}
              placeholder={varios ? 'Comentario para la primera foto…' : 'Añade un comentario…'}
              className="flex-1 min-w-0 h-full px-3 bg-transparent text-[16px] font-['Inter'] text-white placeholder-white/60 focus:outline-none"
            />
          </div>
        ) : (
          <p className="flex-1 min-h-12 flex items-center px-2 text-xs font-['Inter'] text-[#E3E7EC]">
            {viewOnce
              ? varios
                ? 'Cada una se podrá abrir una sola vez. Después se borra para los dos.'
                : 'Se podrá abrir una sola vez. Después se borra para los dos.'
              : formatBytes(media.blob.size)}
          </p>
        )}
        {media.kind !== 'audio' && (
          <button
            type="button"
            onClick={() => setViewOnce((v) => !v)}
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full text-white"
            aria-pressed={viewOnce}
            title="Ver una vez"
          >
            {viewOnce ? <IconoVerUnaVezActivo className="w-7 h-7" /> : <IconoVerUnaVez className="w-7 h-7" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSend({ caption: caption.trim(), viewOnce })}
          disabled={preparando}
          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-[#F28C1B] text-[#1F2933] disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      {editarFoto && (
        <EditorFoto
          imagen={media.blob}
          herramienta={editarFoto}
          userId={userId}
          miLlavePublica={miLlavePublica}
          onCancelar={() => setEditarFoto(null)}
          onListo={(b) => void fotoEditada(b)}
        />
      )}
      {editarVideo && (
        <EditorVideo
          video={media.blob}
          duracion={media.duration || 0}
          userId={userId}
          miLlavePublica={miLlavePublica}
          onCancelar={() => setEditarVideo(false)}
          onListo={(r) => void videoEditado(r)}
        />
      )}
    </div>
  );
};
