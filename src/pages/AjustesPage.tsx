import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Moon, Sun, Monitor, LogOut, Info, Wallpaper, ChevronRight } from 'lucide-react';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { NotificacionesAjustes } from '../components/NotificacionesAjustes';
import { BloqueoAjustes } from '../components/BloqueoAjustes';
import { FondoChat } from '../components/FondoChat';
import { useNombreApp } from '../lib/nombreApp';

export const AjustesPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const nombreApp = useNombreApp();
  const [fondoOpen, setFondoOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex flex-col gap-4 pb-8">
      {/* Ajustes de Tema y Apariencia */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="w-10 h-[3px] bg-[#F28C1B] mb-3"></div>
        <h2 className="font-['Poppins'] font-semibold text-lg text-[#003A73] dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Ajustes</span>
        </h2>
        <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mt-1">
          Personaliza la apariencia y revisa los parámetros de privacidad de {nombreApp}.
        </p>

        <div className="mt-5">
          <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-2 font-medium">
            Tema de la Aplicación
          </label>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'light', label: 'Claro', icon: Sun },
                { id: 'dark', label: 'Oscuro', icon: Moon },
                { id: 'system', label: 'Sistema', icon: Monitor },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id as ThemePreference)}
                  className={`flex flex-col items-center justify-center p-3 rounded-[5px] border transition-colors ${
                    isSelected
                      ? 'border-[#005198] bg-[#F2F4F7] dark:bg-[#003A73] text-[#005198] dark:text-white font-semibold'
                      : 'border-[#E3E7EC] dark:border-[#003A73] text-[#5B6670] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933]'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" strokeWidth={2} />
                  <span className="text-xs font-['Poppins']">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFondoOpen(true)}
        className="w-full bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] flex items-center gap-3 text-left"
      >
        <Wallpaper className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC] shrink-0" strokeWidth={2} />
        <span className="flex-1">
          <span className="block font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider">Fondo del chat</span>
          <span className="block text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">Temas incluidos o una foto tuya</span>
        </span>
        <ChevronRight className="w-4 h-4 text-[#5B6670] dark:text-[#E3E7EC]" strokeWidth={2} />
      </button>
      {fondoOpen && <FondoChat onCerrar={() => setFondoOpen(false)} />}

      <NotificacionesAjustes />

      <BloqueoAjustes />


      {/* Sección Privacidad: qué se cifra y qué queda sin cifrar según contrato */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Privacidad y Cifrado</span>
        </h3>

        <div className="space-y-3 text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed">
          <p>
            En {nombreApp} tu conversación estará blindada con cifrado de extremo a extremo (E2EE)
            mediante Web Crypto estándar (ECDH P-256 + AES-GCM 256).
          </p>

          <div className="p-3 bg-[#F2F4F7] dark:bg-[#1F2933] rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[#1E7A44] font-bold">✓ Cifrado completo:</span>
              <span>
                Texto de los mensajes, fotos, audios, videos y llaves de archivos. Solo tú y la otra persona pueden descifrarlos.
              </span>
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-[#E3E7EC] dark:border-[#003A73]">
              <span className="text-[#8A4B00] font-bold">! Sin cifrar:</span>
              <span>
                Nombres visibles, fotos de perfil, fechas, tipo de mensaje y emojis de reacciones.
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => navigate('/prueba-cifrado')}
              className="text-xs text-[#005198] dark:text-[#E3E7EC] font-['Poppins'] font-semibold hover:underline flex items-center gap-1"
            >
              <span>Diagnóstico de cifrado Web Crypto</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Botón Cerrar Sesión */}
      <div className="pt-2">
        <button
          onClick={handleLogout}
          className="w-full h-11 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#B03030] hover:bg-[#FDEBD3]/40 font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4 text-[#B03030]" strokeWidth={2} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};
