import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** true: se ve la contraseña al abrir (por ejemplo cuando el administrador la está creando) */
  visibleInicial?: boolean;
};

/** Campo de contraseña con el ojito para mostrarla u ocultarla. */
export const CampoClave: React.FC<Props> = ({ visibleInicial = false, className = '', ...resto }) => {
  const [ver, setVer] = useState(visibleInicial);
  return (
    <div className="relative flex-1 min-w-0">
      <input
        {...resto}
        type={ver ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`${className} w-full pr-11`}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        onMouseDown={(e) => e.preventDefault()} // no le quita el foco al campo (el teclado no se cierra)
        className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-[#5B6670] dark:text-[#E3E7EC] hover:text-[#005198] dark:hover:text-white"
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        {ver ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
      </button>
    </div>
  );
};
