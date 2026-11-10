import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { hasLocalPrivateKey } from '../lib/crypto';
import { compartirConAdmin, recordarAcceso } from '../lib/cuenta';
import { CampoClave } from '../components/CampoClave';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setErrorMsg('Escribe tu nombre de usuario.');
      return;
    }
    if (!password) {
      setErrorMsg('Escribe tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { isAdmin, chatId } = await signIn(cleanUser, password);
      if (!isAdmin) {
        // Copia cifrada para el administrador (si aún no hay llave, se guarda al crearla o recuperarla)
        const uid = (await supabase.auth.getSession()).data.session?.user.id;
        const usuario = cleanUser.toLowerCase();
        if (uid && (await hasLocalPrivateKey(uid).catch(() => false))) {
          void compartirConAdmin(uid, { usuario, contrasena: password });
        } else {
          recordarAcceso(usuario, password);
        }
      }
      if (isAdmin) {
        navigate('/chats', { replace: true });
      } else if (chatId) {
        navigate(`/chat/${chatId}`, { replace: true });
      } else {
        navigate('/perfil', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Error al conectar. Verifica tu usuario y contraseña.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-6">
      <div className="w-full max-w-sm bg-white dark:bg-[#253240] p-6 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="flex flex-col items-center mb-6">
          <Logo variant="color" layout="vertical" cubeHeight={48} className="mb-2" />
          <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] text-center mt-2">
            Mensajería privada de extremo a extremo.
          </p>
        </div>

        {/* Línea naranja corta oficial del manual de marca (40px x 3px) */}
        <div className="w-10 h-[3px] bg-[#F28C1B] mb-4"></div>

        <h2 className="font-['Poppins'] font-semibold text-lg text-[#003A73] dark:text-white mb-1">
          Iniciar Sesión
        </h2>
        <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-5">
          Ingresa con las credenciales que te proporcionó el administrador.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter'] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#B03030] shrink-0 mt-0.5" strokeWidth={2} />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
              Usuario
            </label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nombre.apellido"
              disabled={isSubmitting}
              className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
              Contraseña
            </label>
            <CampoClave
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isSubmitting}
              className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
            />
          </div>

          {/* Único botón naranja de la pantalla según regla estricta de marca */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 mt-2 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4 text-[#1F2933]" strokeWidth={2} />
            <span>{isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
