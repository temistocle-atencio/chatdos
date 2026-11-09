import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Si ya está instalada o abierta en modo standalone, no mostramos el botón
  if (isInstalled) {
    return null;
  }

  // Flujo para Android, Chromium y Escritorio
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-[#005198] hover:bg-[#003A73] text-white text-xs font-semibold font-['Poppins'] transition-colors"
        title="Instalar ChatDos en tu dispositivo"
      >
        <Download className="w-4 h-4" strokeWidth={2} />
        <span>Instalar App</span>
      </button>
    );
  }

  // Flujo para iPhone / iPad (Safari)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[5px] border border-[#005198] text-[#005198] dark:text-[#F2F4F7] text-xs font-semibold font-['Poppins'] transition-colors hover:bg-[#F2F4F7] dark:hover:bg-[#003A73]"
        >
          <Download className="w-4 h-4" strokeWidth={2} />
          <span>Instalar en iOS</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-[5px] bg-white dark:bg-[#1F2933] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.12)] border border-[#E3E7EC] dark:border-[#003A73]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E7EC] dark:border-[#003A73]">
                <h3 className="font-['Poppins'] font-bold text-sm text-[#003A73] dark:text-white">
                  Instalar ChatDos en iOS
                </h3>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="text-[#5B6670] hover:text-[#1F2933] dark:hover:text-white"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              <div className="py-4 text-xs text-[#1F2933] dark:text-[#E3E7EC] space-y-3 font-['Inter'] leading-relaxed">
                <p>
                  1. En la barra inferior de Safari, pulsa el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).
                </p>
                <p>
                  2. Desliza hacia abajo y selecciona <strong>«Agregar a pantalla de inicio»</strong>.
                </p>
                <p>
                  3. Pulsa <strong>Agregar</strong> arriba a la derecha. ¡Listo! ChatDos se abrirá como app independiente.
                </p>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full h-10 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
