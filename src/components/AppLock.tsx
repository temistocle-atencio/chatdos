import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, ScanFace } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { useNombreApp } from '../lib/nombreApp';
import { PinPad } from './PinPad';
import {
  comprobarPin,
  debeBloquearAlVolver,
  desbloquearConBiometria,
  esperaRestante,
  leerBloqueo,
  marcarSalida,
  nombreBiometria,
  veniaDeElegirArchivo,
  type ConfigBloqueo,
} from '../lib/bloqueo';

const esApple = /iPhone|iPad|iPod|Macintosh/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

/** Pantalla de bloqueo: tapa toda la app hasta poner el PIN o usar Face ID / huella. */
export const AppLock: React.FC = () => {
  const { user, signOut } = useAuth();
  const nombreApp = useNombreApp();
  const [config, setConfig] = useState<ConfigBloqueo | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const leidoRef = useRef<string | null>(null); // usuario para el que ya se decidió al abrir
  const [cubrir, setCubrir] = useState(false); // tapa el contenido al salir (vista de apps abiertas)
  const [error, setError] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const [confirmarSalir, setConfirmarSalir] = useState(false);
  const probandoRef = useRef(false);

  // Leer la configuración (y releerla si cambia en Ajustes)
  useEffect(() => {
    const leer = () => setConfig(user ? leerBloqueo(user.id) : null);
    leer();
    // Al abrir la app (primera vez que se conoce el usuario) se bloquea si tiene bloqueo.
    // Activarlo después desde Ajustes no bloquea en ese momento.
    if (user && leidoRef.current !== user.id) {
      leidoRef.current = user.id;
      setBloqueado(!!leerBloqueo(user.id));
    }
    window.addEventListener('chatdos-bloqueo', leer);
    return () => window.removeEventListener('chatdos-bloqueo', leer);
  }, [user]);

  const probarBiometria = useCallback(async () => {
    if (!user || !config?.credId || probandoRef.current) return;
    probandoRef.current = true;
    try {
      if (await desbloquearConBiometria(user.id)) {
        setBloqueado(false);
        setError(null);
      }
    } finally {
      probandoRef.current = false;
    }
  }, [user, config]);

  // Al salir y volver a la app
  useEffect(() => {
    if (!config) return;
    const cambio = () => {
      if (document.hidden) {
        marcarSalida();
        setCubrir(true);
        return;
      }
      setCubrir(false);
      if (veniaDeElegirArchivo()) return; // volvió de la cámara o la galería
      if (debeBloquearAlVolver(config)) setBloqueado(true);
    };
    document.addEventListener('visibilitychange', cambio);
    return () => document.removeEventListener('visibilitychange', cambio);
  }, [config]);

  const mostrando = !!user && !!config && bloqueado;

  // Al aparecer la pantalla de bloqueo se ofrece Face ID / huella de una vez
  useEffect(() => {
    if (mostrando && config?.credId && !document.hidden) {
      const t = setTimeout(probarBiometria, 350);
      return () => clearTimeout(t);
    }
  }, [mostrando, config?.credId, probarBiometria]);

  // Cuenta regresiva si se equivocó muchas veces
  useEffect(() => {
    if (!mostrando || !user) return;
    const tic = () => setEspera(esperaRestante(user.id));
    tic();
    const i = setInterval(tic, 1000);
    return () => clearInterval(i);
  }, [mostrando, user]);

  // No dejar que la página de atrás se desplace mientras está bloqueado
  useEffect(() => {
    if (!mostrando) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mostrando]);

  if (!user || !config) return null;

  if (!bloqueado) {
    return cubrir ? <div className="fixed inset-0 z-[200] bg-[#003A73]" aria-hidden="true" /> : null;
  }

  const onPin = async (pin: string) => {
    const r = await comprobarPin(user.id, pin);
    if (r === 'ok') {
      setBloqueado(false);
      setError(null);
      return true;
    }
    const resta = esperaRestante(user.id);
    setEspera(resta);
    setError(resta > 0 ? null : r === 'espera' ? null : 'PIN incorrecto');
    return false;
  };

  const IconoBio = esApple ? ScanFace : Fingerprint;

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#003A73] flex flex-col items-center justify-between overflow-y-auto"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${nombreApp} está bloqueado`}
    >
      <Logo variant="white" layout="cube" cubeHeight={44} />

      <div className="w-full max-w-xs px-4 my-6">
        <PinPad
          oscuro
          titulo={`${nombreApp} está bloqueado`}
          subtitulo={config.credId ? `Usa ${nombreBiometria()} o tu PIN` : 'Escribe tu PIN'}
          error={espera > 0 ? `Demasiados intentos. Espera ${Math.ceil(espera / 1000)} s` : error}
          deshabilitado={espera > 0}
          onCompleto={onPin}
          extra={
            config.credId ? (
              <button
                type="button"
                onClick={probarBiometria}
                aria-label={`Desbloquear con ${nombreBiometria()}`}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[#F28C1B] active:bg-white/10"
              >
                <IconoBio className="w-8 h-8" strokeWidth={1.75} />
              </button>
            ) : null
          }
        />
      </div>

      <button
        type="button"
        onClick={() => setConfirmarSalir(true)}
        className="text-xs font-['Inter'] text-white/75 underline underline-offset-4 py-2"
      >
        ¿Olvidaste tu PIN?
      </button>

      {confirmarSalir && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmarSalir(false)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white mb-2">¿Olvidaste tu PIN?</h3>
            <p className="text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-5">
              Para entrar de nuevo hay que cerrar sesión en este celular y volver a iniciarla con tu usuario y contraseña.
              El bloqueo se quita y lo puedes activar otra vez en Ajustes.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarSalir(false)}
                className="h-10 px-4 rounded-[5px] font-['Poppins'] font-semibold text-sm text-[#005198] dark:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmarSalir(false);
                  await signOut();
                  location.hash = '#/login';
                }}
                className="h-10 px-4 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-sm"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
