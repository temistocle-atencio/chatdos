import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Volume2, VolumeX, Share, PlusSquare } from 'lucide-react';
import {
  disablePush,
  enablePush,
  isPushEnabled,
  isPushSupported,
  isSoundOn,
  needsInstallForPush,
  playIncoming,
  pushPermission,
  setSoundOn,
} from '../lib/push';

export const NotificacionesAjustes: React.FC = () => {
  const [activas, setActivas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sonido, setSonido] = useState(isSoundOn());
  const instalar = needsInstallForPush();
  const soportado = isPushSupported();
  const bloqueado = pushPermission() === 'denied';

  useEffect(() => {
    isPushEnabled().then(setActivas).catch(() => {});
  }, []);

  const alternar = async () => {
    setError(null);
    setCargando(true);
    try {
      if (activas) {
        await disablePush();
        setActivas(false);
      } else {
        await enablePush();
        setActivas(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar.');
    } finally {
      setCargando(false);
    }
  };

  const alternarSonido = () => {
    const nuevo = !sonido;
    setSoundOn(nuevo);
    setSonido(nuevo);
    if (nuevo) playIncoming('chat');
  };

  return (
    <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
      <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <span>Notificaciones</span>
      </h3>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-4">
        Te avisamos cuando llegue un mensaje, aunque la app esté cerrada. El aviso solo dice quién escribió, nunca el texto.
      </p>

      {instalar ? (
        <div className="p-3 rounded-[5px] bg-[#FDEBD3] text-[#8A4B00] text-xs font-['Inter'] space-y-2">
          <p className="font-semibold">En iPhone primero instala ChatDos:</p>
          <p className="flex items-center gap-1 flex-wrap">
            1. Abre esta página en Safari y toca <Share className="w-4 h-4 inline" strokeWidth={2} /> Compartir.
          </p>
          <p className="flex items-center gap-1 flex-wrap">
            2. Elige <PlusSquare className="w-4 h-4 inline" strokeWidth={2} /> «Agregar a inicio».
          </p>
          <p>3. Abre ChatDos desde el ícono y vuelve aquí para activar los avisos.</p>
        </div>
      ) : !soportado ? (
        <p className="text-xs text-[#8A4B00] bg-[#FDEBD3] p-3 rounded-[5px] font-['Inter']">
          Este navegador no permite notificaciones.
        </p>
      ) : (
        <>
          <button
            onClick={alternar}
            disabled={cargando || (bloqueado && !activas)}
            className={`w-full h-11 rounded-[5px] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
              activas
                ? 'border border-[#E3E7EC] dark:border-[#003A73] text-[#1F2933] dark:text-white'
                : 'bg-[#005198] hover:bg-[#003A73] text-white'
            }`}
          >
            {activas ? <BellOff className="w-4 h-4" strokeWidth={2} /> : <Bell className="w-4 h-4" strokeWidth={2} />}
            <span>{cargando ? 'Un momento…' : activas ? 'Desactivar en este celular' : 'Activar notificaciones'}</span>
          </button>
          {activas && (
            <p className="mt-2 text-xs text-[#1E7A44] font-['Inter']">✓ Este celular recibe avisos de mensajes nuevos.</p>
          )}
          {bloqueado && !activas && (
            <p className="mt-2 text-xs text-[#8A4B00] font-['Inter']">
              Las bloqueaste antes. Actívalas en Ajustes del celular → Notificaciones → ChatDos.
            </p>
          )}
        </>
      )}
      {error && <p className="mt-2 text-xs text-[#B03030] font-['Inter']">{error}</p>}

      <button
        onClick={alternarSonido}
        className="mt-4 w-full flex items-center justify-between p-3 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-left"
      >
        <span className="flex items-center gap-2 text-sm font-['Inter'] text-[#1F2933] dark:text-white">
          {sonido ? <Volume2 className="w-4 h-4" strokeWidth={2} /> : <VolumeX className="w-4 h-4" strokeWidth={2} />}
          Sonido y vibración con la app abierta
        </span>
        <span
          className={`w-10 h-6 rounded-full relative transition-colors ${sonido ? 'bg-[#F28C1B]' : 'bg-[#E3E7EC] dark:bg-[#1F2933]'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${sonido ? 'left-[18px]' : 'left-0.5'}`}
          />
        </span>
      </button>
    </div>
  );
};
