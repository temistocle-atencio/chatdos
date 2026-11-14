import React, { useState } from 'react';
import { AtSign, KeyRound, ChevronRight, Eye, EyeOff, Info, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cambiarMiContrasena, cambiarMiUsuario, recordarClave } from '../lib/cuenta';
import { pasarRespaldoAContrasena } from '../lib/crypto';

type Panel = 'usuario' | 'contrasena' | null;

const campo =
  "w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]";

const Clave: React.FC<{ valor: string; onCambio: (v: string) => void; placeholder: string; auto: string }> = ({
  valor,
  onCambio,
  placeholder,
  auto,
}) => {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input
        type={ver ? 'text' : 'password'}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        autoComplete={auto}
        autoCapitalize="none"
        autoCorrect="off"
        className={`${campo} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[#5B6670] dark:text-[#E3E7EC]"
        aria-label={ver ? 'Ocultar' : 'Mostrar'}
      >
        {ver ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
      </button>
    </div>
  );
};

/** Cambiar usuario, contraseña para entrar y contraseña de respaldo (cada persona la suya). */
export const MiCuenta: React.FC = () => {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const [abierto, setAbierto] = useState<Panel>(null);
  const [usuario, setUsuario] = useState('');
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  if (!user || !profile) return null;

  const abrir = (p: Panel) => {
    setAbierto((a) => (a === p ? null : p));
    setUsuario(p === 'usuario' ? profile.username : '');
    setActual('');
    setNueva('');
    setRepetir('');
    setError(null);
    setExito(null);
  };

  const correr = async (fn: () => Promise<string>) => {
    setError(null);
    setExito(null);
    setTrabajando(true);
    try {
      setExito(await fn());
      setAbierto(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setTrabajando(false);
    }
  };

  const guardarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = usuario.trim().toLowerCase();
    if (limpio === profile.username) return setAbierto(null);
    correr(async () => {
      const nuevo = await cambiarMiUsuario(limpio);
      await refreshProfile();
      return `Listo. Tu nuevo usuario es «${nuevo}». Úsalo la próxima vez que inicies sesión.`;
    });
  };

  const guardarContrasena = (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetir) return setError('Las dos contraseñas nuevas no son iguales.');
    correr(async () => {
      await cambiarMiContrasena(profile.username, actual, nueva);
      recordarClave(nueva);
      // La misma contraseña protege tus mensajes: el respaldo de la llave pasa a la nueva
      const r = await pasarRespaldoAContrasena(user.id, actual, nueva);
      if (r === 'renovada') setTimeout(() => window.location.reload(), 1200);
      return 'Listo. Tu contraseña cambió.';
    });
  };

  const fila = (p: Exclude<Panel, null>, Icono: typeof AtSign, titulo: string, detalle: string) => (
    <button
      type="button"
      onClick={() => abrir(p)}
      className="w-full flex items-center gap-3 py-3 text-left"
      aria-expanded={abierto === p}
    >
      <Icono className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC] shrink-0" strokeWidth={2} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-['Inter'] font-medium text-[#1F2933] dark:text-white">{titulo}</span>
        <span className="block text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] truncate">{detalle}</span>
      </span>
      <ChevronRight
        className={`w-4 h-4 text-[#5B6670] dark:text-[#E3E7EC] transition-transform ${abierto === p ? 'rotate-90' : ''}`}
        strokeWidth={2}
      />
    </button>
  );

  const botonGuardar = (
    <button
      type="submit"
      disabled={trabajando}
      className="w-full h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors disabled:opacity-60"
    >
      {trabajando ? 'Guardando…' : 'Guardar'}
    </button>
  );

  return (
    <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
      <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider mb-1">Mi cuenta</h3>

      {!isAdmin && (
        <p className="mt-2 mb-1 p-3 rounded-[5px] bg-[#F2F4F7] dark:bg-[#1F2933] text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>
            Tienes una sola contraseña: con ella entras y también protege tus mensajes cifrados. Si la cambias aquí, solo tú la conoces. Si la olvidas, el administrador te puede poner una nueva (y la app te avisa cuando lo hace).
          </span>
        </p>
      )}

      {exito && (
        <p className="mt-2 text-xs font-['Inter'] text-[#1E7A44] flex items-start gap-1.5">
          <Check className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>{exito}</span>
        </p>
      )}

      <div className="divide-y divide-[#E3E7EC] dark:divide-[#003A73]">
        <div>
          {fila('usuario', AtSign, 'Usuario', profile.username)}
          {abierto === 'usuario' && (
            <form onSubmit={guardarUsuario} className="space-y-2 pb-4">
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={`${campo} font-mono`}
                aria-label="Nuevo usuario"
              />
              <p className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
                De 3 a 20 letras minúsculas, números, punto o guion bajo. Sin espacios.
              </p>
              {error && <p className="text-xs font-['Inter'] text-[#B03030]">{error}</p>}
              {botonGuardar}
            </form>
          )}
        </div>

        <div>
          {fila('contrasena', KeyRound, 'Contraseña', 'Con ella entras y protege tus mensajes')}
          {abierto === 'contrasena' && (
            <form onSubmit={guardarContrasena} className="space-y-2 pb-4">
              <Clave valor={actual} onCambio={setActual} placeholder="Contraseña actual" auto="current-password" />
              <Clave valor={nueva} onCambio={setNueva} placeholder="Nueva (mínimo 8 caracteres)" auto="new-password" />
              <Clave valor={repetir} onCambio={setRepetir} placeholder="Repite la nueva" auto="new-password" />
              {error && <p className="text-xs font-['Inter'] text-[#B03030]">{error}</p>}
              {botonGuardar}
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
