import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leerAvisoClave, quitarAvisoClave } from '../lib/cuenta';

/**
 * Si el administrador le cambió la contraseña a esta persona, se le avisa una vez
 * (así nunca se cambia a escondidas). No tiene que hacer nada: puede seguir o cambiarla.
 */
export const AvisoClave: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cuando, setCuando] = useState<string | null>(null);

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
  const cerrar = (irACambiar: boolean) => {
    setCuando(null);
    void quitarAvisoClave(user.id);
    if (irACambiar) navigate('/perfil');
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[8px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="w-10 h-[3px] bg-[#F28C1B] mb-3" />
        <h3 className="font-['Poppins'] font-bold text-base text-[#003A73] dark:text-white flex items-center gap-2 mb-2">
          <KeyRound className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Tienes contraseña nueva</span>
        </h3>
        <p className="text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed mb-4">
          El administrador te puso una contraseña nueva el {fecha}. Puedes seguir usándola o cambiarla cuando quieras en{' '}
          <strong>Perfil → Mi cuenta</strong>.
        </p>
        <button
          type="button"
          onClick={() => cerrar(false)}
          className="w-full h-11 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm"
        >
          Entendido
        </button>
        <button
          type="button"
          onClick={() => cerrar(true)}
          className="mt-2 w-full h-10 text-xs font-['Inter'] text-[#005198] dark:text-[#E3E7EC] underline underline-offset-2"
        >
          Cambiarla ahora
        </button>
      </div>
    </div>
  );
};
