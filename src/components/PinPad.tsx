import React, { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { LARGO_PIN } from '../lib/bloqueo';

interface PinPadProps {
  titulo: string;
  subtitulo?: string;
  error?: string | null;
  deshabilitado?: boolean;
  /** Se llama al completar los 4 números. Devuelve false para borrar y sacudir los puntos. */
  onCompleto: (pin: string) => Promise<boolean | void> | boolean | void;
  extra?: React.ReactNode;
  oscuro?: boolean;
}

/** Teclado numérico propio (no abre el teclado del celular). */
export const PinPad: React.FC<PinPadProps> = ({ titulo, subtitulo, error, deshabilitado, onCompleto, extra, oscuro }) => {
  const [pin, setPin] = useState('');
  const [sacudir, setSacudir] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (pin.length !== LARGO_PIN) return;
    let vivo = true;
    setOcupado(true);
    Promise.resolve(onCompleto(pin)).then((r) => {
      if (!vivo) return;
      setOcupado(false);
      if (r === false) {
        setSacudir(true);
        try {
          navigator.vibrate?.(120);
        } catch {
          /* nada */
        }
        setTimeout(() => setSacudir(false), 400);
      }
      setPin('');
    });
    return () => {
      vivo = false;
    };
  }, [pin]);

  const tocar = (d: string) => {
    if (deshabilitado || ocupado) return;
    setPin((p) => (p.length < LARGO_PIN ? p + d : p));
  };
  const borrar = () => !ocupado && setPin((p) => p.slice(0, -1));

  // Teclado físico (computadora)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) tocar(e.key);
      else if (e.key === 'Backspace') borrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const texto = oscuro ? 'text-white' : 'text-[#003A73] dark:text-white';
  const suave = oscuro ? 'text-white/75' : 'text-[#5B6670] dark:text-[#E3E7EC]';
  const tecla = oscuro
    ? 'bg-white/10 active:bg-white/25 text-white'
    : 'bg-[#F2F4F7] dark:bg-[#1F2933] active:bg-[#E3E7EC] dark:active:bg-[#003A73] text-[#003A73] dark:text-white';

  return (
    <div className="flex flex-col items-center w-full select-none">
      <h2 className={`font-['Poppins'] font-semibold text-lg text-center ${texto}`}>{titulo}</h2>
      {subtitulo && <p className={`mt-1 text-sm font-['Inter'] text-center ${suave}`}>{subtitulo}</p>}

      <div className={`flex gap-4 my-6 ${sacudir ? 'animate-[sacudir_0.35s]' : ''}`} aria-label={`${pin.length} de ${LARGO_PIN} números`}>
        {Array.from({ length: LARGO_PIN }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
              i < pin.length ? 'bg-[#F28C1B] border-[#F28C1B]' : oscuro ? 'border-white/70' : 'border-[#005198] dark:border-[#E3E7EC]'
            }`}
          />
        ))}
      </div>

      <p className="h-5 text-xs font-['Inter'] text-[#F28C1B] text-center" role="alert">
        {error || ''}
      </p>

      <div className="grid grid-cols-3 gap-4 mt-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => tocar(d)}
            disabled={deshabilitado}
            className={`w-[72px] h-[72px] rounded-full font-['Poppins'] text-2xl font-medium transition-colors disabled:opacity-40 ${tecla}`}
          >
            {d}
          </button>
        ))}
        <div className="w-[72px] h-[72px] flex items-center justify-center">{extra}</div>
        <button
          type="button"
          onClick={() => tocar('0')}
          disabled={deshabilitado}
          className={`w-[72px] h-[72px] rounded-full font-['Poppins'] text-2xl font-medium transition-colors disabled:opacity-40 ${tecla}`}
        >
          0
        </button>
        <button
          type="button"
          onClick={borrar}
          aria-label="Borrar"
          className={`w-[72px] h-[72px] rounded-full flex items-center justify-center ${suave}`}
        >
          <Delete className="w-6 h-6" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
