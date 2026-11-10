import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RespaldoNuevo } from '../components/RespaldoNuevo';
import { restoreKeysFromBackup } from '../lib/crypto';
import { CampoClave } from '../components/CampoClave';

export const RecuperarLlavePage: React.FC = () => {
  const { user, isAdmin, getMySingleChatId, signOut } = useAuth();
  const navigate = useNavigate();
  const llaveCambiada = !!(useLocation().state as { llaveCambiada?: boolean } | null)?.llaveCambiada;

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [olvide, setOlvide] = useState<'no' | 'explicar' | 'nueva'>('no');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMsg(null);

    if (!password) {
      setErrorMsg('Por favor escribe tu contraseña de respaldo.');
      return;
    }

    setLoading(true);
    try {
      // 1. Descifra la llave PKCS8 desde key_backups usando PBKDF2 y la importa a IndexedDB
      await restoreKeysFromBackup(user.id, password);
      await irAlInicio();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Error al restaurar la llave de cifrado.');
      }
    } finally {
      setLoading(false);
    }
  };

  const irAlInicio = async () => {
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
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-6">
      <div className="w-full max-w-sm bg-white dark:bg-[#253240] p-6 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="w-10 h-[3px] bg-[#F28C1B] mb-3"></div>

        <div className="flex items-center gap-2 mb-2 text-[#003A73] dark:text-white">
          <KeyRound className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <h2 className="font-['Poppins'] font-bold text-lg">
            Dispositivo Nuevo Detectado
          </h2>
        </div>

        <p className="text-xs text-[#1F2933] dark:text-[#E3E7EC] font-['Inter'] leading-relaxed mb-4">
          Esta cuenta ya tiene una llave de cifrado activa en otro dispositivo. Para poder leer
          y descifrar tus conversaciones en este navegador, ingresa tu <strong>contraseña de respaldo</strong>.
        </p>

        {llaveCambiada && (
          <div className="mb-4 p-3 rounded-[5px] bg-[#F2F4F7] dark:bg-[#1F2933] text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed">
            Tu llave de cifrado se cambió en otro lugar (por ejemplo, abriendo ChatDos en el navegador). Escribe la{' '}
            <strong>contraseña de respaldo que creaste en ese momento</strong>. Tus mensajes de antes se siguen viendo en este celular.
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter'] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#B03030] shrink-0 mt-0.5" strokeWidth={2} />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {olvide !== 'no' ? (
          <div className="space-y-3">
            <div className="p-3 rounded-[5px] bg-[#FDEBD3] text-[#8A4B00] text-xs font-['Inter'] leading-relaxed space-y-2">
              <p className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
                <strong>Nadie puede recuperar la contraseña de respaldo, ni el administrador.</strong>
              </p>
              <p>
                Puedes <strong>empezar de nuevo</strong> en este celular con una contraseña de respaldo nueva: el chat sigue normal desde hoy, pero
                los mensajes de antes no se podrán abrir aquí. La otra persona sí los sigue viendo en su celular.
              </p>
            </div>
            {olvide === 'explicar' ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOlvide('no')}
                  className="flex-1 h-11 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] text-[#5B6670] dark:text-[#E3E7EC] font-['Poppins'] font-semibold text-xs"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={() => setOlvide('nueva')}
                  className="flex-[2] h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs"
                >
                  Empezar de nuevo aquí
                </button>
              </div>
            ) : (
              <RespaldoNuevo onListo={() => void irAlInicio()} onCancelar={() => setOlvide('no')} textoBoton="Empezar de nuevo" />
            )}
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
              Contraseña de Respaldo
            </label>
            <CampoClave
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
            />
          </div>

          {/* Único botón naranja de la pantalla */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#1F2933]" strokeWidth={2} />
                <span>Descifrando llaves en el navegador...</span>
              </>
            ) : (
              <span>Descifrar y Restaurar Llave</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setOlvide('explicar');
            }}
            className="w-full text-xs font-['Inter'] text-[#005198] dark:text-[#E3E7EC] underline underline-offset-2"
          >
            Olvidé mi contraseña de respaldo
          </button>
        </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#E3E7EC] dark:border-[#003A73] flex justify-between items-center text-xs">
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
