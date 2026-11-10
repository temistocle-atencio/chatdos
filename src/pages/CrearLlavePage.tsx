import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, KeyRound, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateAndBackupKeys } from '../lib/crypto';
import { CampoClave } from '../components/CampoClave';

export const CrearLlavePage: React.FC = () => {
  const { user, refreshProfile, isAdmin, getMySingleChatId } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [anotada, setAnotada] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('La contraseña de respaldo debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas de respaldo no coinciden. Escríbelas con cuidado.');
      return;
    }

    if (!anotada) {
      setErrorMsg('Marca la casilla cuando ya la tengas anotada en un lugar seguro.');
      return;
    }

    setLoading(true);
    try {
      // 1. Genera el par ECDH P-256, sube la pública a profiles y el respaldo a key_backups
      await generateAndBackupKeys(user.id, password);

      // 2. Refresca el perfil para registrar que ya tiene public_key
      await refreshProfile();

      // 3. Redirige a la pantalla principal según su rol
      if (isAdmin) {
        navigate('/chats', { replace: true });
      } else {
        const chatId = await getMySingleChatId();
        if (chatId) {
          navigate(`/chat/${chatId}`, { replace: true });
        } else {
          navigate('/perfil', { replace: true });
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Error al generar las llaves de cifrado.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-6">
      <div className="w-full max-w-sm bg-white dark:bg-[#253240] p-6 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="w-10 h-[3px] bg-[#F28C1B] mb-3"></div>

        <div className="flex items-center gap-2 mb-2 text-[#003A73] dark:text-white">
          <KeyRound className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <h2 className="font-['Poppins'] font-bold text-lg">
            Activar Cifrado E2EE
          </h2>
        </div>

        {/* Explicación en lenguaje sencillo de la contraseña de respaldo */}
        <p className="text-xs text-[#1F2933] dark:text-[#E3E7EC] font-['Inter'] leading-relaxed mb-4">
          ChatDos protegerá tus mensajes con cifrado de extremo a extremo. Para asegurarte de que
          no pierdas el acceso a tus chats si cambias de celular, crearemos una <strong>contraseña de respaldo</strong>.
        </p>

        <div className="p-3 mb-4 rounded-[5px] bg-[#FDEBD3] text-[#8A4B00] text-xs font-['Inter'] flex items-start gap-2 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-[#8A4B00] shrink-0 mt-0.5" strokeWidth={2} />
          <span>
            <strong>Advertencia fundamental:</strong> Esta contraseña es distinta a la de iniciar sesión y solo la conoces tú.
            Si la olvidas, <strong>nadie podrá recuperar tus mensajes</strong> en un dispositivo nuevo, ni siquiera el administrador.
            Anótala en un lugar seguro.
          </span>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter'] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#B03030] shrink-0 mt-0.5" strokeWidth={2} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
              Contraseña de Respaldo (mínimo 8)
            </label>
            <CampoClave
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
              Confirma tu Contraseña de Respaldo
            </label>
            <CampoClave
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
            />
          </div>

          <label className="flex items-start gap-2 text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed cursor-pointer">
            <input
              type="checkbox"
              checked={anotada}
              onChange={(e) => setAnotada(e.target.checked)}
              disabled={loading}
              className="mt-0.5 w-4 h-4 accent-[#005198] shrink-0"
            />
            <span>Ya la anoté en un lugar seguro y sé que nadie me la puede recuperar.</span>
          </label>

          {/* Único botón naranja de la pantalla según regla estricta de marca */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#1F2933]" strokeWidth={2} />
                <span>Generando llaves Web Crypto...</span>
              </>
            ) : (
              <span>Generar y Proteger mi Llave</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
