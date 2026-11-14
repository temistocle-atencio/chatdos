import React from 'react';
import { Download } from 'lucide-react';
import { mostrarGuiaIOS } from './InstalarIOS';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

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

  // iPhone / iPad: abre la guía paso a paso
  if (isIOS) {
    return (
      <button
        onClick={mostrarGuiaIOS}
        className="flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-[#F28C1B] text-[#1F2933] text-xs font-semibold font-['Poppins']"
      >
        <Download className="w-4 h-4" strokeWidth={2} />
        <span>Instalar</span>
      </button>
    );
  }

  return null;
};
