import React, { useState } from 'react';
import { Download, X, MoreVertical } from 'lucide-react';
import { mostrarGuiaIOS } from './InstalarIOS';
import { usePWAInstall } from '../hooks/usePWAInstall';

/**
 * Botón "Instalar App". Se ve siempre hasta que la app quede instalada.
 * - Chrome / Edge / Samsung: abre la ventana de instalar del navegador.
 * - iPhone: guía paso a paso de Safari.
 * - Otros navegadores (sin instalación automática): explica cómo hacerlo desde el menú.
 */
export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guia, setGuia] = useState(false);

  if (isInstalled) return null;

  const alTocar = () => {
    if (isInstallable) void install();
    else if (isIOS) mostrarGuiaIOS();
    else setGuia(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={alTocar}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-[5px] text-xs font-semibold font-['Poppins'] transition-colors ${
          isIOS && !isInstallable ? 'bg-[#F28C1B] text-[#1F2933]' : 'bg-[#005198] hover:bg-[#003A73] text-white'
        }`}
        title="Instalar ChatDos en tu dispositivo"
      >
        <Download className="w-4 h-4" strokeWidth={2} />
        <span>Instalar App</span>
      </button>

      {guia && (
        <div className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setGuia(false)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[12px] p-5 text-left"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Cómo instalar ChatDos"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white">Instalar ChatDos</h3>
              <button type="button" onClick={() => setGuia(false)} className="p-1.5 -mr-1.5 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <ol className="space-y-3 text-sm font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC]">
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#005198] text-white text-xs font-bold flex items-center justify-center">1</span>
                Abre el menú del navegador
                <MoreVertical className="w-4 h-4 shrink-0" strokeWidth={2} />
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#005198] text-white text-xs font-bold flex items-center justify-center">2</span>
                Elige <b>Instalar app</b> o <b>Agregar a pantalla principal</b>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#005198] text-white text-xs font-bold flex items-center justify-center">3</span>
                Confirma y abre ChatDos desde su ícono
              </li>
            </ol>
            <p className="mt-4 text-xs font-['Inter'] text-[#5B6670] dark:text-[#C9CFD6]">
              Si tu navegador no tiene esa opción, abre esta página en <b>Chrome</b>: ahí se instala con un solo toque.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
