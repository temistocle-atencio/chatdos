import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { esperarPreparacionLlave, hasLocalPrivateKey, prepararLlaveConContrasena } from '../lib/crypto';
import { recordarClave } from '../lib/cuenta';
import { memoria } from '../lib/memoria';
import { CampoClave } from '../components/CampoClave';

/**
 * Una sola contraseña: si en este celular falta la llave de cifrado, se pide la MISMA contraseña
 * con la que se entra, y con ella se prepara la llave sola.
 */
export const RecuperarLlavePage: React.FC = () => {
  const { user, isAdmin, getMySingleChatId, signOut } = useAuth();
  const navigate = useNavigate();
  const llaveCambiada = !!(useLocation().state as { llaveCambiada?: boolean } | null)?.llaveCambiada;

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [esperando, setEsperando] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const irAlInicio = async () => {
    if (user) memoria.llaveLista.add(user.id);
    if (isAdmin) {
      navigate('/chats', { replace: true });
    } else {
      const chatId = await getMySingleChatId();
      navigate(chatId ? `/chat/${chatId}` : '/chats', { replace: true });
    }
  };

  // Recién iniciada la sesión la llave se prepara sola: se espera y, si quedó lista, se sigue
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    esperarPreparacionLlave()
      .then(() => hasLocalPrivateKey(user.id))
      .then((lista) => {
        if (!vivo) return;
        if (lista && !llaveCambiada) void irAlInicio();
        else setEsperando(false);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    if (!password) return setErrorMsg('Escribe tu contraseña.');

    setLoading(true);
    try {
      // Se confirma que es su contraseña para entrar
      const { error } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password });
      if (error) throw new Error(error.status === 400 ? 'Esa no es tu contraseña.' : 'Sin conexión. Intenta de nuevo.');
      recordarClave(password);
      await prepararLlaveConContrasena(user.id, password);
      memoria.llaves.clear();
      await irAlInicio();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo abrir tus mensajes.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (esperando) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-12 text-[#5B6670] dark:text-[#E3E7EC]">
        <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <p className="text-xs font-['Inter']">Abriendo tus chats…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-6">
      <div className="w-full max-w-sm bg-white dark:bg-[#253240] p-6 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="w-10 h-[3px] bg-[#F28C1B] mb-3"></div>

        <div className="flex items-center gap-2 mb-2 text-[#003A73] dark:text-white">
          <KeyRound className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <h2 className="font-['Poppins'] font-bold text-lg">Confirma tu contraseña</h2>
        </div>

        <p className="text-xs text-[#1F2933] dark:text-[#E3E7EC] font-['Inter'] leading-relaxed mb-4">
          {llaveCambiada
            ? 'Tu cifrado se actualizó en otro lugar. Escribe tu contraseña (la misma con la que entras) para seguir.'
            : 'Para abrir tus mensajes cifrados en este celular, escribe tu contraseña. Es la misma con la que entras.'}
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter'] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#B03030] shrink-0 mt-0.5" strokeWidth={2} />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <CampoClave
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            disabled={loading}
            className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 transition-all disabled:opacity-70"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#1F2933]" strokeWidth={2} />
                <span>Abriendo tus chats…</span>
              </>
            ) : (
              <span>Continuar</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E3E7EC] dark:border-[#003A73] text-xs">
          <button
            onClick={handleLogout}
            className="text-[#5B6670] hover:text-[#B03030] dark:text-[#E3E7EC] flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};
