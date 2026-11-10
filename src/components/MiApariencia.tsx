import React, { useEffect, useRef, useState } from 'react';
import { Image as IconoFoto, Link2, RotateCcw, Check, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { avisarSelectorArchivo } from '../lib/bloqueo';
import {
  NOMBRE_POR_DEFECTO,
  guardarMiApariencia,
  partirNombre,
  prepararIcono,
  useApariencia,
  volverAChatDos,
} from '../lib/nombreApp';
import { Logo } from './Logo';

/** Cada persona elige el icono (en círculo) y el nombre de SU app. */
export const MiApariencia: React.FC = () => {
  const { user } = useAuth();
  const actual = useApariencia();
  const [nombre, setNombre] = useState(actual.nombre);
  const [icono, setIcono] = useState<string | null>(actual.icono);
  const [enlace, setEnlace] = useState('');
  const [verEnlace, setVerEnlace] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  // Cuando llega lo guardado en el servidor, se muestra (si no se ha empezado a editar)
  const [tocado, setTocado] = useState(false);
  useEffect(() => {
    if (tocado) return;
    setNombre(actual.nombre);
    setIcono(actual.icono);
  }, [actual.nombre, actual.icono, tocado]);

  if (!user) return null;
  const cambiado = nombre.trim() !== actual.nombre || icono !== actual.icono;
  const [p1, p2] = partirNombre(nombre.trim() || NOMBRE_POR_DEFECTO);

  const cargar = async (origen: Blob | string) => {
    setError(null);
    setListo(false);
    setTrabajando(true);
    try {
      setIcono(await prepararIcono(origen));
      setTocado(true);
      setVerEnlace(false);
      setEnlace('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo usar esa imagen.');
    } finally {
      setTrabajando(false);
    }
  };

  const guardar = async () => {
    setError(null);
    setTrabajando(true);
    try {
      await guardarMiApariencia(user.id, nombre, icono);
      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setTrabajando(false);
    }
  };

  const restablecer = async () => {
    setError(null);
    setTrabajando(true);
    try {
      await volverAChatDos(user.id);
      setNombre(NOMBRE_POR_DEFECTO);
      setIcono(null);
      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restablecer.');
    } finally {
      setTrabajando(false);
    }
  };

  const boton =
    "flex-1 h-10 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#005198] dark:text-white text-xs font-['Poppins'] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50";

  return (
    <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
      <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-1">
        <Smartphone className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <span>Icono y nombre de mi app</span>
      </h3>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-4 leading-relaxed">
        Solo cambia en tu app. Lo normal es ChatDos con el cubo.
      </p>

      {/* Vista previa */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-[#F2F4F7] dark:bg-[#1F2933] border border-[#E3E7EC] dark:border-[#003A73] flex items-center justify-center shrink-0">
          {icono ? (
            <img src={icono} alt="Tu icono" className="w-full h-full object-cover" draggable={false} />
          ) : (
            <Logo predeterminado layout="cube" cubeHeight={44} />
          )}
        </div>
        <div className="min-w-0 font-['Poppins'] font-bold text-xl truncate">
          <span className="text-[#005198] dark:text-white">{p1}</span>
          <span className="text-[#F28C1B]">{p2}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <button
          type="button"
          className={boton}
          disabled={trabajando}
          onClick={() => {
            avisarSelectorArchivo();
            archivoRef.current?.click();
          }}
        >
          <IconoFoto className="w-4 h-4" strokeWidth={2} /> Subir foto
        </button>
        <button type="button" className={boton} disabled={trabajando} onClick={() => setVerEnlace((v) => !v)}>
          <Link2 className="w-4 h-4" strokeWidth={2} /> Pegar enlace
        </button>
      </div>
      {verEnlace && (
        <form
          className="flex gap-2 mb-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (enlace.trim()) cargar(enlace.trim());
          }}
        >
          <input
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://… (enlace de una imagen)"
            className="flex-1 min-w-0 h-10 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]"
            aria-label="Enlace de la imagen"
          />
          <button type="submit" disabled={trabajando || !enlace.trim()} className="h-10 px-3 rounded-[5px] bg-[#005198] text-white text-xs font-['Poppins'] font-semibold disabled:opacity-50">
            Usar
          </button>
        </form>
      )}

      <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mt-3 mb-1 font-medium">
        Nombre (hasta 24 letras)
      </label>
      <input
        type="text"
        value={nombre}
        maxLength={24}
        onChange={(e) => {
          setNombre(e.target.value);
          setTocado(true);
          setListo(false);
        }}
        disabled={trabajando}
        className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]"
        aria-label="Nombre de mi app"
      />

      {error && <p className="mt-2 text-xs font-['Inter'] text-[#B03030]">{error}</p>}
      {listo && !cambiado && (
        <p className="mt-2 text-xs font-['Inter'] text-[#1E7A44] flex items-start gap-1.5 leading-relaxed">
          <Check className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>
            Listo. Dentro de la app ya se ve. Para que el ícono de la pantalla de inicio también cambie, quita la app y vuelve a
            instalarla.
          </span>
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={trabajando || !cambiado}
        className="w-full h-11 mt-3 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors disabled:opacity-50"
      >
        {trabajando ? 'Guardando…' : 'Guardar'}
      </button>
      {(actual.icono || actual.nombre !== NOMBRE_POR_DEFECTO) && (
        <button
          type="button"
          onClick={restablecer}
          disabled={trabajando}
          className="w-full h-10 mt-2 rounded-[5px] text-[#5B6670] dark:text-[#E3E7EC] font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={2} /> Volver a ChatDos
        </button>
      )}

      <input
        ref={archivoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) cargar(f);
        }}
      />
    </div>
  );
};
