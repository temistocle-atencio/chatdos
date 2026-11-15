import React, { useState } from 'react';
import { X, Compass } from 'lucide-react';
import { esIOS, mostrarGuiaIOS } from './InstalarIOS';

// Navegadores que vienen dentro de otras apps (Telegram, WhatsApp, Instagram…): ahí la sesión
// se borra al cerrar y no se puede instalar la app.
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const esAndroid = /Android/i.test(ua);
const dentroDeOtraApp =
  (esIOS && !/CriOS|FxiOS|EdgiOS/i.test(ua) && !/Safari\//i.test(ua)) ||
  (esAndroid && (/; wv\)/i.test(ua) || /Telegram|FBAN|FBAV|Instagram|Line\//i.test(ua)));

const ENLACE = 'temistocle-atencio.github.io/chatdos/';

/** Franja arriba que pide abrir ChatDos en el navegador de verdad. */
export const AvisoNavegadorInterno: React.FC = () => {
  const [cerrado, setCerrado] = useState(() => {
    try {
      return sessionStorage.getItem('chatdos-aviso-interno') === '1';
    } catch {
      return false;
    }
  });
  if (!dentroDeOtraApp || cerrado) return null;

  const abrir = () => {
    if (esAndroid) window.location.href = `intent://${ENLACE}#Intent;scheme=https;package=com.android.chrome;end`;
    else mostrarGuiaIOS();
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[60] px-3" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
      <div className="max-w-md mx-auto flex items-center gap-3 p-3 rounded-[12px] bg-[#F28C1B] text-[#1F2933] shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
        <Compass className="w-6 h-6 shrink-0" strokeWidth={2} />
        <p className="flex-1 min-w-0 text-xs font-['Inter'] leading-snug">
          <strong>Estás dentro de otra app.</strong> Aquí se cierra tu sesión cada vez. Ábrelo en {esAndroid ? 'Chrome' : 'Safari'}.
        </p>
        <button type="button" onClick={abrir} className="h-9 px-3 rounded-[5px] bg-[#003A73] text-white font-['Poppins'] font-semibold text-xs shrink-0">
          Abrir
        </button>
        <button
          type="button"
          onClick={() => {
            setCerrado(true);
            try {
              sessionStorage.setItem('chatdos-aviso-interno', '1');
            } catch {
              /* nada */
            }
          }}
          className="p-1 -mr-1"
          aria-label="Cerrar aviso"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
