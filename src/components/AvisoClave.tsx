import React, { useEffect, useState } from 'react';
import { KeyRound, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leerAvisoClave, ponerClaveTrasRestablecer, recordarClave, ultimaClaveUsada } from '../lib/cuenta';
import { getLocalPrivateKey, pasarRespaldoAContrasena } from '../lib/crypto';
import { CampoClave } from './CampoClave';

const campo =
  "w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]";

/**
 * Si el administrador restableció la contraseña de esta persona, se le avisa y se le pide
 * poner una nueva que solo ella conozca (así él nunca puede entrar sin que ella lo sepa).
 */
export const AvisoClave: React.FC = () => {
  const { user, signOut } = useAuth();
  const [cuando, setCuando] = useState<string | null>(null);
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCuando(null);
      return;
    }
    let vivo = true;
    const revisar = () => {
      if (document.hidden || !navigator.onLine) return;
      leerAvisoClave(user.id)
        .then((c) => vivo && setCuando(c))
        .catch(() => {});
    };
    revisar();
    const cada = setInterval(revisar, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      vivo = false;
      clearInterval(cada);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [user]);

  if (!user || !cuando) return null;

  const fecha = new Date(cuando).toLocaleString('es', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) return setError('Debe tener al menos 8 caracteres.');
    if (nueva !== repetir) return setError('Las dos contraseñas no son iguales.');
    setTrabajando(true);
    try {
      await ponerClaveTrasRestablecer(user.id, nueva);
      // La misma contraseña protege los mensajes: el respaldo de la llave pasa a la nueva
      if (await getLocalPrivateKey(user.id)) {
        const r = await pasarRespaldoAContrasena(user.id, ultimaClaveUsada(), nueva).catch(() => 'igual');
        if (r === 'renovada') setTimeout(() => window.location.reload(), 800);
      }
      recordarClave(nueva);
      setCuando(null);
      setNueva('');
      setRepetir('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[8px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="w-10 h-[3px] bg-[#F28C1B] mb-3" />
        <h3 className="font-['Poppins'] font-bold text-base text-[#003A73] dark:text-white flex items-center gap-2 mb-2">
          <KeyRound className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Tu contraseña fue restablecida</span>
        </h3>
        <p className="text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed mb-3">
          El administrador restableció tu contraseña para entrar el {fecha}. Pon ahora una nueva que <strong>solo tú</strong> conozcas.
          Tus mensajes no cambian.
        </p>
        <form onSubmit={guardar} className="space-y-2">
          <CampoClave value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva contraseña (mínimo 8)" disabled={trabajando} className={campo} autoComplete="new-password" />
          <CampoClave value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder="Repítela" disabled={trabajando} className={campo} autoComplete="new-password" />
          {error && <p className="text-xs font-['Inter'] text-[#B03030]">{error}</p>}
          <button
            type="submit"
            disabled={trabajando}
            className="w-full h-11 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {trabajando && <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2} />}
            <span>{trabajando ? 'Guardando…' : 'Guardar mi contraseña'}</span>
          </button>
        </form>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 w-full text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
};
