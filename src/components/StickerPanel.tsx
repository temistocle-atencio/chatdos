import React, { useEffect, useRef, useState } from 'react';
import { X, Image as IconoFotos, FolderOpen, ClipboardPaste, Sticker as IconoSticker, Trash2, Loader2 } from 'lucide-react';
import {
  agregarSticker,
  alCambiarColeccion,
  borrarSticker,
  cargarColeccion,
  coleccionEnMemoria,
  urlSticker,
  esAnimado,
  type Sticker,
} from '../lib/stickers';
import { avisarSelectorArchivo } from '../lib/bloqueo';
import { StickerEditor } from './StickerEditor';

const esIOS = /iPhone|iPad|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

// Un sticker de la cuadrícula (se descifra al aparecer)
const Celda: React.FC<{ s: Sticker; editando: boolean; onTocar: () => void; onBorrar: () => void }> = ({
  s,
  editando,
  onTocar,
  onBorrar,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    let vivo = true;
    urlSticker(s)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [s]);
  return (
    <div className="relative aspect-square">
      <button
        type="button"
        onClick={editando ? onBorrar : onTocar}
        className="w-full h-full rounded-[5px] flex items-center justify-center active:bg-[#F2F4F7] dark:active:bg-[#1F2933]"
        aria-label={editando ? 'Borrar sticker' : 'Enviar sticker'}
      >
        {url ? (
          <img src={url} alt="" className={`max-w-full max-h-full object-contain ${editando ? 'opacity-60' : ''}`} draggable={false} />
        ) : fallo ? (
          <IconoSticker className="w-6 h-6 text-[#C9CFD6]" strokeWidth={1.5} />
        ) : (
          <span className="w-10 h-10 rounded-[5px] bg-[#E3E7EC] dark:bg-[#1F2933] animate-pulse" />
        )}
      </button>
      {editando && (
        <span className="pointer-events-none absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-[#B03030] text-white flex items-center justify-center">
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
      )}
    </div>
  );
};

export const StickerPanel: React.FC<{
  userId: string;
  miLlavePublica: unknown;
  onEnviar: (s: Sticker) => void;
  onCerrar: () => void;
  onAviso: (t: string) => void;
  /** true: va dentro del panel de expresiones (debajo de la barra de escribir), sin ventana propia */
  incrustado?: boolean;
}> = ({ userId, miLlavePublica, onEnviar, onCerrar, onAviso, incrustado = false }) => {
  const [lista, setLista] = useState<Sticker[] | null>(coleccionEnMemoria(userId));
  const [editando, setEditando] = useState(false);
  const [agregando, setAgregando] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editar, setEditar] = useState<Blob | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null); // Fotos (galería)
  const carpetaRef = useRef<HTMLInputElement>(null); // Archivos (almacenamiento interno)

  useEffect(() => {
    const quitar = alCambiarColeccion(() => setLista(coleccionEnMemoria(userId)));
    cargarColeccion(userId, miLlavePublica)
      .then(setLista)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar tus stickers'));
    return () => {
      quitar();
    };
  }, [userId, miLlavePublica]);

  // Una sola imagen (no animada): se abre el editor (borde, forma y textos)
  const elegir = async (blobs: Blob[]) => {
    if (blobs.length === 1 && !(await esAnimado(blobs[0]).catch(() => false))) {
      setEditar(blobs[0]);
      return;
    }
    await agregarVarios(blobs);
  };

  const agregarVarios = async (blobs: Blob[]) => {
    if (!blobs.length) return;
    setError(null);
    setAgregando({ hechos: 0, total: blobs.length });
    let nuevos = 0;
    let repetidos = 0;
    let problema: string | null = null;
    for (let i = 0; i < blobs.length; i++) {
      try {
        const r = await agregarSticker(userId, miLlavePublica, blobs[i]);
        if (r.nuevo) nuevos++;
        else repetidos++;
      } catch (e) {
        problema = e instanceof Error ? e.message : 'No se pudo agregar uno';
      }
      setAgregando({ hechos: i + 1, total: blobs.length });
    }
    setAgregando(null);
    const partes = [];
    if (nuevos) partes.push(`${nuevos} agregado${nuevos > 1 ? 's' : ''}`);
    if (repetidos) partes.push(`${repetidos} ya lo tenías`);
    if (partes.length) onAviso(partes.join(' · '));
    if (problema) setError(problema);
  };

  const pegar = async () => {
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      const imgs: Blob[] = [];
      for (const it of items) {
        const tipo = it.types.find((t) => t.startsWith('image/'));
        if (tipo) imgs.push(await it.getType(tipo));
      }
      if (!imgs.length) setError('No hay ninguna imagen copiada.');
      else await elegir(imgs);
    } catch {
      setError('No se pudo pegar. Mantén presionado el campo de mensaje y elige «Pegar».');
    }
  };

  const borrar = async (s: Sticker) => {
    try {
      await borrarSticker(userId, s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar');
    }
  };

  const boton =
    "h-9 px-3 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#005198] dark:text-white text-xs font-['Poppins'] font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-50";

  const cuerpo = (
      <div
        className={
          incrustado
            ? 'w-full h-full flex flex-col pt-2'
            : 'w-full max-w-md h-[min(70dvh,480px)] flex flex-col bg-white dark:bg-[#253240] rounded-t-[12px] shadow-[0_-2px_12px_rgba(0,0,0,0.15)]'
        }
        style={incrustado ? undefined : { paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!incrustado && (
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white">Mis stickers</h3>
          <button type="button" onClick={onCerrar} className="p-2 -mr-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        )}

        <div className="flex gap-2 px-4 pb-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            className={boton}
            disabled={!!agregando}
            onClick={() => {
              avisarSelectorArchivo();
              archivoRef.current?.click();
            }}
          >
            <IconoFotos className="w-4 h-4" strokeWidth={2} /> Fotos
          </button>
          <button
            type="button"
            className={boton}
            disabled={!!agregando}
            onClick={() => {
              avisarSelectorArchivo();
              carpetaRef.current?.click();
            }}
          >
            <FolderOpen className="w-4 h-4" strokeWidth={2} /> Archivos
          </button>
          {'clipboard' in navigator && 'read' in navigator.clipboard && (
            <button type="button" className={boton} disabled={!!agregando} onClick={pegar}>
              <ClipboardPaste className="w-4 h-4" strokeWidth={2} /> Pegar
            </button>
          )}
          {!!lista?.length && (
            <button
              type="button"
              className={`${boton} ${editando ? 'bg-[#005198] text-white dark:bg-white dark:text-[#003A73]' : ''}`}
              onClick={() => setEditando((v) => !v)}
            >
              {editando ? 'Listo' : 'Editar'}
            </button>
          )}
        </div>

        {agregando && (
          <p className="px-4 pb-2 text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
            Guardando {agregando.hechos} de {agregando.total}…
          </p>
        )}
        {editando && (
          <p className="px-4 pb-2 text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">Toca un sticker para borrarlo.</p>
        )}
        {error && <p className="px-4 pb-2 text-xs font-['Inter'] text-[#B03030]">{error}</p>}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
          {lista === null ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-[5px] bg-[#E3E7EC] dark:bg-[#1F2933] animate-pulse" />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2 text-[#5B6670] dark:text-[#E3E7EC]">
              <IconoSticker className="w-10 h-10 text-[#005198] dark:text-white" strokeWidth={1.5} />
              <p className="text-sm font-['Inter'] font-medium text-[#1F2933] dark:text-white">Todavía no tienes stickers</p>
              {esIOS ? (
                <p className="text-xs font-['Inter'] leading-relaxed">
                  En <b>Fotos</b>, mantén presionada una imagen (o la persona dentro de la foto) y toca <b>Copiar</b>. Luego vuelve aquí y
                  toca <b>Pegar</b>. También puedes guardar los que te envíen: mantén presionado el sticker en el chat.
                </p>
              ) : (
                <p className="text-xs font-['Inter'] leading-relaxed text-left">
                  Toca <b>Archivos</b>, abre el menú <b>☰</b> y elige el <b>almacenamiento interno</b> (el nombre de tu celular). Luego
                  entra a <b>Android → media → com.whatsapp → WhatsApp → Media → WhatsApp Stickers</b> y elige los que quieras (puedes
                  marcar varios dejando presionado). Si no ves el almacenamiento interno, toca <b>⋮</b> y luego{' '}
                  <b>«Mostrar almacenamiento interno»</b>.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {lista.map((s) => (
                <Celda key={s.id} s={s} editando={editando} onTocar={() => onEnviar(s)} onBorrar={() => borrar(s)} />
              ))}
            </div>
          )}
        </div>

        {/* Al pedir "archivos" (no solo imágenes), Android abre el administrador de archivos con carpetas */}
        <input
          ref={carpetaRef}
          type="file"
          accept="image/*,application/octet-stream,.webp,.gif,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []).slice(0, 50);
            e.target.value = '';
            elegir(fs);
          }}
        />
        <input
          ref={archivoRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []).slice(0, 50);
            e.target.value = '';
            elegir(fs);
          }}
        />
      </div>
  );
  const editor = editar && (
    <div onClick={(e) => e.stopPropagation()}>
      <StickerEditor
        imagen={editar}
        onCancelar={() => setEditar(null)}
        onListo={(png) => {
          setEditar(null);
          agregarVarios([png]);
        }}
      />
    </div>
  );
  if (incrustado)
    return (
      <>
        {cuerpo}
        {editor}
      </>
    );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCerrar}>
      {cuerpo}
      {editor}
    </div>
  );
};
