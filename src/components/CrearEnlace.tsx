import React, { useRef, useState } from 'react';
import { X, Link2, Copy, Check, Share2, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { crearEnlace, type FotoDelChat, type FotoNueva } from '../lib/compartidos';
import { avisarSelectorArchivo } from '../lib/bloqueo';
import { ACEPTA_FOTOS, esIOS } from '../lib/fotosOriginales';

const peso = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Crear un enlace para compartir fotos en calidad original con alguien que no tiene ChatDos.
 * Quien lo abre solo ve esas fotos (y las descarga); no necesita cuenta. Vence a los 7 días.
 */
export const CrearEnlace: React.FC<{ delChat?: FotoDelChat[]; onCerrar: () => void }> = ({ delChat = [], onCerrar }) => {
  const [nuevas, setNuevas] = useState<FotoNueva[]>([]);
  const [progreso, setProgreso] = useState<{ texto: string; pct: number } | null>(null);
  const [listo, setListo] = useState<{ url: string; vence: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const elegir = useRef<HTMLInputElement>(null);

  const total = nuevas.length + delChat.length;
  const pesoTotal = nuevas.reduce((t, f) => t + f.blob.size, 0) + delChat.reduce((t, f) => t + f.size, 0);

  const crear = async () => {
    setError(null);
    setProgreso({ texto: 'Preparando…', pct: 0 });
    try {
      const r = await crearEnlace(nuevas, delChat, (texto, pct) => setProgreso({ texto, pct }));
      setListo(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el enlace');
    } finally {
      setProgreso(null);
    }
  };

  const compartir = async () => {
    if (!listo) return;
    try {
      await navigator.share({ title: 'Fotos en calidad original', text: 'Te comparto estas fotos en calidad original:', url: listo.url });
    } catch {
      /* cerró el menú de compartir */
    }
  };

  const copiar = async () => {
    if (!listo) return;
    try {
      await navigator.clipboard.writeText(listo.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No se pudo copiar. Mantén presionado el enlace para copiarlo.');
    }
  };

  const boton =
    "w-full h-12 rounded-[5px] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50" onClick={progreso ? undefined : onCerrar}>
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-[#253240] rounded-t-[16px] sm:rounded-[12px] p-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Enlace para compartir fotos"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white flex items-center gap-2">
            <Link2 className="w-5 h-5" strokeWidth={2} /> Enlace para compartir
          </h3>
          {!progreso && (
            <button type="button" onClick={onCerrar} className="p-2 -mr-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>

        {listo ? (
          <>
            <p className="text-sm font-['Inter'] text-[#1F2933] dark:text-white mb-3">
              Listo. Envía este enlace por WhatsApp, correo o donde quieras. Quien lo abra podrá ver y descargar las fotos en calidad
              original, sin crear cuenta.
            </p>
            <div className="p-3 rounded-[8px] bg-[#F2F4F7] dark:bg-[#1F2933] text-xs font-mono break-all text-[#1F2933] dark:text-white select-all mb-3">
              {listo.url}
            </div>
            {'share' in navigator && (
              <button type="button" onClick={() => void compartir()} className={`${boton} bg-[#F28C1B] text-[#1F2933] mb-2`}>
                <Share2 className="w-5 h-5" strokeWidth={2} /> Compartir enlace
              </button>
            )}
            <button type="button" onClick={() => void copiar()} className={`${boton} border border-[#005198] text-[#005198] dark:text-white dark:border-white`}>
              {copiado ? <Check className="w-5 h-5" strokeWidth={2} /> : <Copy className="w-5 h-5" strokeWidth={2} />}
              {copiado ? 'Copiado' : 'Copiar enlace'}
            </button>
            <p className="mt-3 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#C9CFD6]">
              Funciona hasta el {listo.vence ? new Date(listo.vence).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : 'final de los 7 días'}.
              Las fotos van cifradas: solo se pueden abrir con el enlace completo.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-3">
              Para enviar fotos en calidad original a alguien que no tiene ChatDos. Quien abra el enlace solo verá estas fotos y no
              necesita cuenta. El enlace vence a los 7 días.
            </p>

            {total > 0 && (
              <ul className="mb-3 divide-y divide-[#E3E7EC] dark:divide-white/10 border border-[#E3E7EC] dark:border-white/10 rounded-[8px]">
                {delChat.map((f) => (
                  <li key={f.ruta} className="px-3 py-2 flex items-center gap-2 text-xs font-['Inter'] text-[#1F2933] dark:text-white">
                    <span className="flex-1 truncate">{f.nombre}</span>
                    <span className="text-[#5B6670] dark:text-[#C9CFD6]">{peso(f.size)}</span>
                  </li>
                ))}
                {nuevas.map((f, i) => (
                  <li key={i} className="px-3 py-1.5 flex items-center gap-2 text-xs font-['Inter'] text-[#1F2933] dark:text-white">
                    <span className="flex-1 truncate">{f.nombre}</span>
                    <span className="text-[#5B6670] dark:text-[#C9CFD6]">{peso(f.blob.size)}</span>
                    {!progreso && (
                      <button
                        type="button"
                        onClick={() => setNuevas((l) => l.filter((_, j) => j !== i))}
                        className="p-1.5 text-[#B03030]"
                        aria-label="Quitar"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!progreso && (
              <button
                type="button"
                onClick={() => {
                  avisarSelectorArchivo();
                  elegir.current?.click();
                }}
                className={`${boton} border border-dashed border-[#C9CFD6] dark:border-white/30 text-[#005198] dark:text-white mb-2`}
              >
                <ImagePlus className="w-5 h-5" strokeWidth={2} /> {total ? 'Agregar más fotos' : 'Elegir fotos'}
              </button>
            )}
            {esIOS && !progreso && (
              <p className="mb-3 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#C9CFD6]">
                En iPhone: en la pantalla para elegir fotos toca <b>Opciones</b> (arriba) y elige <b>Actual</b>. Así el iPhone no las
                convierte ni les baja la calidad.
              </p>
            )}

            {progreso && (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-xs font-['Inter'] text-[#1F2933] dark:text-white mb-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> {progreso.texto} {progreso.pct > 0 && `${progreso.pct}%`}
                </div>
                <div className="h-1.5 rounded-full bg-[#E3E7EC] dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-[#F28C1B] transition-all" style={{ width: `${progreso.pct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-[#5B6670] dark:text-[#C9CFD6]">Deja la app abierta hasta que termine.</p>
              </div>
            )}
            {error && <p className="mb-3 text-xs font-['Inter'] text-[#B03030]">{error}</p>}

            <button
              type="button"
              disabled={!total || !!progreso || total > 30}
              onClick={() => void crear()}
              className={`${boton} bg-[#F28C1B] text-[#1F2933]`}
            >
              <Link2 className="w-5 h-5" strokeWidth={2} />
              {total ? `Crear enlace · ${total} foto${total > 1 ? 's' : ''} · ${peso(pesoTotal)}` : 'Crear enlace'}
            </button>
            {total > 30 && <p className="mt-2 text-xs text-[#B03030]">Máximo 30 fotos por enlace.</p>}
          </>
        )}

        <input
          ref={elegir}
          type="file"
          accept={ACEPTA_FOTOS}
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|dng)$/i.test(f.name));
            e.target.value = '';
            setNuevas((l) => [...l, ...fs.map((f) => ({ blob: f, nombre: f.name || `foto-${Date.now()}.jpg` }))]);
          }}
        />
      </div>
    </div>
  );
};
