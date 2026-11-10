import React, { useEffect, useState } from 'react';
import { Lock, Fingerprint, ScanFace, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PinPad } from './PinPad';
import {
  OPCIONES_TIEMPO,
  activarBiometria,
  activarBloqueo,
  biometriaDisponible,
  cambiarPin,
  cambiarTiempo,
  comprobarPin,
  desactivarBloqueo,
  esperaRestante,
  leerBloqueo,
  nombreBiometria,
  quitarBiometria,
  type ConfigBloqueo,
} from '../lib/bloqueo';

type Paso = null | 'nuevo' | 'repetir' | 'bio' | 'verificar-cambiar' | 'verificar-quitar';

const esApple = /iPhone|iPad|iPod|Macintosh/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

export const BloqueoAjustes: React.FC = () => {
  const { user, profile } = useAuth();
  const [config, setConfig] = useState<ConfigBloqueo | null>(null);
  const [bioOk, setBioOk] = useState(false);
  const [paso, setPaso] = useState<Paso>(null);
  const [primero, setPrimero] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const leer = () => setConfig(leerBloqueo(user.id));
    leer();
    biometriaDisponible().then(setBioOk);
    window.addEventListener('chatdos-bloqueo', leer);
    return () => window.removeEventListener('chatdos-bloqueo', leer);
  }, [user]);

  if (!user) return null;
  const Icono = esApple ? ScanFace : Fingerprint;
  const bio = nombreBiometria();
  const cerrar = () => {
    setPaso(null);
    setPrimero('');
    setError(null);
    setCambiando(false);
  };

  const encenderBio = async () => {
    setError(null);
    try {
      await activarBiometria(user.id, profile?.display_name || profile?.username || '');
      setAviso(`${bio} activado`);
      cerrar();
    } catch (e) {
      const n = (e as DOMException)?.name;
      setError(n === 'NotAllowedError' ? 'Se canceló. Puedes intentarlo otra vez.' : `No se pudo activar ${bio}.`);
    }
  };

  const verificar = async (pin: string) => {
    const r = await comprobarPin(user.id, pin);
    if (r !== 'ok') {
      const e = esperaRestante(user.id);
      setError(e > 0 ? `Demasiados intentos. Espera ${Math.ceil(e / 1000)} s` : 'PIN incorrecto');
      return false;
    }
    setError(null);
    if (paso === 'verificar-quitar') {
      desactivarBloqueo(user.id);
      setAviso('Bloqueo desactivado');
      cerrar();
    } else {
      setCambiando(true);
      setPaso('nuevo');
    }
    return true;
  };

  const onNuevo = (pin: string) => {
    setPrimero(pin);
    setError(null);
    setPaso('repetir');
    return true;
  };

  const onRepetir = async (pin: string) => {
    if (pin !== primero) {
      setError('Los PIN no coinciden. Empieza de nuevo.');
      setPrimero('');
      setPaso('nuevo');
      return false;
    }
    if (cambiando) {
      await cambiarPin(user.id, pin);
      setAviso('PIN cambiado');
      cerrar();
    } else {
      await activarBloqueo(user.id, pin, 1);
      setError(null);
      if (bioOk) setPaso('bio');
      else {
        setAviso('Bloqueo activado');
        cerrar();
      }
    }
    return true;
  };

  const tarjeta =
    'bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]';
  const fila =
    'w-full flex items-center justify-between p-3 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-left text-sm font-[\'Inter\'] text-[#1F2933] dark:text-white';

  return (
    <div className={tarjeta}>
      <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <span>Bloqueo de la app</span>
      </h3>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-4">
        Pide {bioOk ? `${bio} o un PIN` : 'un PIN'} para abrir ChatDos en este celular.
      </p>

      {!config ? (
        <button
          onClick={() => {
            setAviso(null);
            setPaso('nuevo');
          }}
          className="w-full h-11 rounded-[5px] bg-[#005198] hover:bg-[#003A73] text-white font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4" strokeWidth={2} />
          Activar bloqueo
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {bioOk && (
            <button
              onClick={() => (config.credId ? quitarBiometria(user.id) : setPaso('bio'))}
              className={fila}
            >
              <span className="flex items-center gap-2">
                <Icono className="w-4 h-4" strokeWidth={2} />
                Usar {bio}
              </span>
              <span className={`w-10 h-6 rounded-full relative transition-colors ${config.credId ? 'bg-[#F28C1B]' : 'bg-[#E3E7EC] dark:bg-[#1F2933]'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${config.credId ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
          )}

          <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mt-2 font-medium">
            Pedir desbloqueo
          </label>
          <div className="grid grid-cols-2 gap-2">
            {OPCIONES_TIEMPO.map((o) => (
              <button
                key={o.minutos}
                onClick={() => cambiarTiempo(user.id, o.minutos)}
                className={`p-2.5 rounded-[5px] border text-xs font-['Inter'] transition-colors ${
                  config.minutos === o.minutos
                    ? 'border-[#005198] bg-[#F2F4F7] dark:bg-[#003A73] text-[#005198] dark:text-white font-semibold'
                    : 'border-[#E3E7EC] dark:border-[#003A73] text-[#5B6670] dark:text-[#E3E7EC]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setPaso('verificar-cambiar')}
              className="flex-1 h-10 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#005198] dark:text-white font-['Poppins'] font-semibold text-xs"
            >
              Cambiar PIN
            </button>
            <button
              onClick={() => setPaso('verificar-quitar')}
              className="flex-1 h-10 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#B03030] font-['Poppins'] font-semibold text-xs"
            >
              Desactivar
            </button>
          </div>
        </div>
      )}

      {aviso && <p className="mt-3 text-xs text-[#1E7A44] font-['Inter']">✓ {aviso}</p>}

      {paso && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={cerrar}>
          <div
            className="relative w-full max-w-sm bg-white dark:bg-[#253240] rounded-t-[12px] sm:rounded-[5px] px-5 pt-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={cerrar} aria-label="Cerrar" className="absolute right-3 top-3 p-2 text-[#5B6670] dark:text-[#E3E7EC]">
              <X className="w-5 h-5" strokeWidth={2} />
            </button>

            {paso === 'bio' ? (
              <div className="flex flex-col items-center text-center pb-2">
                <Icono className="w-14 h-14 text-[#005198] dark:text-white mb-3" strokeWidth={1.5} />
                <h2 className="font-['Poppins'] font-semibold text-lg text-[#003A73] dark:text-white">¿Usar {bio}?</h2>
                <p className="mt-1 mb-5 text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
                  Desbloquea ChatDos con tu {esApple ? 'cara o huella' : 'huella'}. El PIN sigue sirviendo por si acaso.
                  {esApple && ' El iPhone te preguntará si quieres guardar una "llave de acceso": acepta.'}
                </p>
                {error && <p className="mb-3 text-xs text-[#B03030] font-['Inter']">{error}</p>}
                <button
                  onClick={encenderBio}
                  className="w-full h-11 rounded-[5px] bg-[#F28C1B] text-white font-['Poppins'] font-semibold text-sm"
                >
                  Activar {bio}
                </button>
                <button onClick={() => { setAviso('Bloqueo activado'); cerrar(); }} className="mt-2 h-10 text-sm font-['Poppins'] font-semibold text-[#005198] dark:text-white">
                  Ahora no
                </button>
              </div>
            ) : (
              <PinPad
                key={paso}
                titulo={
                  paso === 'nuevo'
                    ? cambiando ? 'Escribe el PIN nuevo' : 'Crea un PIN de 4 números'
                    : paso === 'repetir'
                      ? 'Repite el PIN'
                      : 'Escribe tu PIN actual'
                }
                subtitulo={paso === 'nuevo' ? 'Lo usarás para abrir ChatDos en este celular' : undefined}
                error={error}
                onCompleto={paso === 'nuevo' ? onNuevo : paso === 'repetir' ? onRepetir : verificar}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
