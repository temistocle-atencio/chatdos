import React, { useEffect, useRef, useState } from 'react';
import { useAtras } from '../lib/atras';
import { X, Send, Music, Play, Crop, Smile, Type, Pencil, Scissors, Loader2, Plus } from 'lucide-react';
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
  /** Foto original (sin reducir): se usa si se envía en HD */
  original?: Blob;
  hd?: boolean;
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
  onSend: (opts: { caption: string; viewOnce: boolean; hd: boolean }) => void;
  /** Reemplaza un archivo por su versión editada */
  onCambiar?: (index: number, m: PendingMedia) => void;
  /** Cambia el orden (arrastrando las miniaturas) */
  onReordenar?: (desde: number, hasta: number) => void;
  /** Agregar más fotos o videos con el "+" */
  onAgregar?: () => void;
  userId?: string;
  miLlavePublica?: unknown;
}> = ({ medias, onCancel, onRemove, onSend, onCambiar, onReordenar, onAgregar, userId, miLlavePublica }) => {
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [hd, setHd] = useState(false); // fotos en alta calidad
  const [actual, setActual] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);
  const [editarFoto, setEditarFoto] = useState<HerramientaFoto | null>(null);
  const [editarVideo, setEditarVideo] = useState(false);
  const [preparando, setPreparando] = useState(false);
  // Arrastrar una miniatura para cambiar el orden
  const arrastreRef = useRef<{ desde: number; id: number; x0: number; movio: boolean } | null>(null);
  const [arrastrando, setArrastrando] = useState<{ desde: number; sobre: number } | null>(null);
  const tiraRef = useRef<HTMLDivElement>(null);
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
      onCambiar?.(indice, { kind: 'image', blob: img.blob, mime: img.mime, width: img.width, height: img.height, thumb: img.thumb, original: b });
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
      className="fixed inset-0 z-[60] bg-black flex flex-col animate-[aparecer_0.2s_ease-out]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Arriba: cerrar y herramientas */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 shrink-0 text-white">
        {boton('Cancelar', onCancel, <X className="w-6 h-6" strokeWidth={2} />)}
        <div className="flex-1" />
        {/* HD: enviar las fotos con más calidad (pesan más) */}
        {medias.some((m) => m.kind === 'image' && !m.sticker && m.original) && (
          <button
            type="button"
            onClick={() => setHd((v) => !v)}
            className={`h-11 px-3 rounded-full flex items-center justify-center text-[13px] font-['Poppins'] font-bold tracking-wide ${
              hd ? 'bg-white text-[#1F2933]' : 'bg-black/45 text-white'
            }`}
            aria-pressed={hd}
            aria-label="Enviar en HD (más calidad)"
            title={hd ? 'HD: más calidad (pesa más)' : 'Calidad normal'}
          >
            HD
          </button>
        )}
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

      {(varios || onAgregar) && (
        <div
          ref={tiraRef}
          className="shrink-0 flex items-center gap-3 overflow-x-auto px-3 pt-2.5 pb-2 [scrollbar-width:none]"
          aria-label="Archivos elegidos"
          onPointerMove={(e) => {
            const a = arrastreRef.current;
            if (!a || a.id !== e.pointerId) return;
            if (Math.abs(e.clientX - a.x0) > 6) a.movio = true;
            if (!a.movio) return;
            // Sobre qué miniatura está el dedo
            const hijos = Array.from(tiraRef.current?.querySelectorAll<HTMLElement>('[data-i]') ?? []);
            let sobre = a.desde;
            for (const h of hijos) {
              const r = h.getBoundingClientRect();
              if (e.clientX >= r.left && e.clientX <= r.right) sobre = Number(h.dataset.i);
            }
            setArrastrando({ desde: a.desde, sobre });
          }}
          onPointerUp={(e) => {
            const a = arrastreRef.current;
            if (!a || a.id !== e.pointerId) return;
            arrastreRef.current = null;
            const d = arrastrando;
            setArrastrando(null);
            if (a.movio && d && d.sobre !== d.desde) {
              onReordenar?.(d.desde, d.sobre);
              setActual(d.sobre);
            } else if (!a.movio) setActual(a.desde);
          }}
          onPointerCancel={() => {
            arrastreRef.current = null;
            setArrastrando(null);
          }}
        >
          {medias.map((m, i) => (
            <div
              key={i}
              data-i={i}
              className={`relative shrink-0 transition-transform ${
                arrastrando && arrastrando.desde === i ? 'scale-110 z-10' : ''
              } ${arrastrando && arrastrando.sobre === i && arrastrando.desde !== i ? (arrastrando.desde < i ? '-translate-x-2' : 'translate-x-2') : ''}`}
            >
              <button
                type="button"
                onPointerDown={(e) => {
                  if (!varios) return;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  arrastreRef.current = { desde: i, id: e.pointerId, x0: e.clientX, movio: false };
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`block w-14 h-14 rounded-[5px] overflow-hidden transition-opacity touch-none ${
                  i === actual ? 'ring-2 ring-[#F28C1B] ring-offset-2 ring-offset-black' : 'opacity-60'
                }`}
                aria-label={`Ver archivo ${i + 1}${varios ? '. Mantén y arrastra para cambiar el orden' : ''}`}
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
          {onAgregar && medias.length < 10 && (
            <button
              type="button"
              onClick={onAgregar}
              className="shrink-0 w-14 h-14 rounded-[5px] border-2 border-dashed border-white/40 text-white/80 flex items-center justify-center hover:border-white"
              aria-label="Agregar más fotos o videos"
              title="Agregar más"
            >
              <Plus className="w-6 h-6" strokeWidth={2} />
            </button>
          )}
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
          onClick={() => onSend({ caption: caption.trim(), viewOnce, hd })}
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
