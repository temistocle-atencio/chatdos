import React, { useEffect, useState } from 'react';
import { X, Send, Image as ImageIcon, Camera, Music, Eye, EyeOff, Video, Play } from 'lucide-react';
import { formatBytes, formatDuration } from '../lib/media';

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

// Menú para elegir qué adjuntar
export const AttachSheet: React.FC<{
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onVideoCamera: () => void;
  onAudioFile: () => void;
}> = ({ onClose, onGallery, onCamera, onVideoCamera, onAudioFile }) => {
  const item = (icon: React.ReactNode, label: string, hint: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-14 px-4 flex items-center gap-3 text-left hover:bg-[#F2F4F7] dark:hover:bg-white/5 transition-colors"
    >
      <span className="text-[#005198] dark:text-white">{icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-['Inter'] font-medium text-[#1F2933] dark:text-white">{label}</span>
        <span className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">{hint}</span>
      </span>
    </button>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[#253240] rounded-t-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] py-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pb-1 text-xs font-['Poppins'] font-medium uppercase tracking-[0.06em] text-[#5B6670] dark:text-[#E3E7EC]">
          Adjuntar
        </div>
        {item(<ImageIcon className="w-6 h-6" strokeWidth={2} />, 'Fotos y videos', 'De tu galería · puedes elegir hasta 10', onGallery)}
        {item(<Camera className="w-6 h-6" strokeWidth={2} />, 'Tomar foto', 'Abre la cámara', onCamera)}
        {item(<Video className="w-6 h-6" strokeWidth={2} />, 'Grabar video', 'Hasta 2 minutos', onVideoCamera)}
        {item(<Music className="w-6 h-6" strokeWidth={2} />, 'Música o audio', 'Un archivo de tu celular · hasta 25 MB', onAudioFile)}
      </div>
    </div>
  );
};

// Vista previa antes de enviar (una o varias fotos / videos)
export const MediaComposer: React.FC<{
  medias: PendingMedia[];
  onCancel: () => void;
  onRemove: (index: number) => void;
  onSend: (opts: { caption: string; viewOnce: boolean }) => void;
}> = ({ medias, onCancel, onRemove, onSend }) => {
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [actual, setActual] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const us = medias.map((m) => URL.createObjectURL(m.blob));
    setUrls(us);
    return () => us.forEach((u) => URL.revokeObjectURL(u));
  }, [medias]);

  useEffect(() => {
    if (actual > medias.length - 1) setActual(Math.max(0, medias.length - 1));
  }, [medias.length, actual]);

  const media = medias[Math.min(actual, medias.length - 1)];
  const url = urls[Math.min(actual, urls.length - 1)];
  if (!media) return null;
  const varios = medias.length > 1;
  const fotos = medias.filter((m) => m.kind === 'image').length;
  const title = varios
    ? `Enviar ${medias.length} ${fotos === medias.length ? 'fotos' : 'archivos'}`
    : media.kind === 'image' ? 'Enviar foto' : media.kind === 'video' ? 'Enviar video' : 'Enviar audio';

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#1F2933] flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-2 px-2 h-14 shrink-0 bg-[#003A73] text-white">
        <button type="button" onClick={onCancel} className="w-12 h-12 flex items-center justify-center" aria-label="Cancelar">
          <X className="w-6 h-6" strokeWidth={2} />
        </button>
        <span className="font-['Poppins'] font-semibold text-base">{title}</span>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-3">
        {url && media.kind === 'image' && <img src={url} alt="Vista previa" className="max-w-full max-h-full object-contain" />}
        {url && media.kind === 'video' && <video key={url} src={url} controls playsInline className="max-w-full max-h-full" />}
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
      </div>

      {varios && (
        <div className="shrink-0 flex gap-3 overflow-x-auto px-3 pt-2.5 pb-2" aria-label="Archivos elegidos">
          {medias.map((m, i) => (
            <div key={i} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setActual(i)}
                className={`block w-14 h-14 rounded-[5px] overflow-hidden transition-opacity ${
                  i === actual ? 'ring-2 ring-[#F28C1B] ring-offset-2 ring-offset-[#1F2933]' : 'opacity-60'
                }`}
                aria-label={`Ver archivo ${i + 1}`}
              >
                {m.kind === 'image' && urls[i] ? (
                  <img src={urls[i]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center bg-black text-white">
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

      <div className="shrink-0 p-2 flex items-end gap-2 bg-[#1F2933]">
        {!viewOnce && media.kind !== 'audio' ? (
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 1000))}
            placeholder={varios ? 'Mensaje para la primera foto...' : 'Añade un mensaje...'}
            className="flex-1 min-w-0 h-12 px-3 rounded-[5px] bg-white dark:bg-[#253240] text-[16px] font-['Inter'] text-[#1F2933] dark:text-white placeholder-[#5B6670] dark:placeholder-[#E3E7EC] border border-[#C9CFD6] dark:border-[#003A73] focus:outline-2 focus:outline-[#005198]"
          />
        ) : (
          <p className="flex-1 min-h-12 flex items-center px-1 text-xs font-['Inter'] text-[#E3E7EC]">
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
            className={`w-12 h-12 shrink-0 flex flex-col items-center justify-center rounded-[5px] border ${
              viewOnce ? 'bg-white text-[#005198] border-white' : 'text-white border-white/40'
            }`}
            aria-pressed={viewOnce}
            title="Ver una vez"
          >
            {viewOnce ? <Eye className="w-5 h-5" strokeWidth={2} /> : <EyeOff className="w-5 h-5" strokeWidth={2} />}
            <span className="text-[9px] font-['Inter'] font-semibold leading-none mt-0.5">1 vez</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onSend({ caption: caption.trim(), viewOnce })}
          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-[5px] bg-[#F28C1B] text-[#1F2933]"
          aria-label="Enviar"
        >
          <Send className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
