import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { empezarDeNuevo } from '../lib/crypto';
import { CampoClave } from './CampoClave';

const campo =
  "w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]";

/**
 * Crear una contraseña de respaldo nueva SIN la anterior (porque se olvidó).
 * Se crea una llave nueva; la de antes se guarda para que la otra persona siga leyendo todo
 * (y, si este celular la tenía, también aquí).
 */
export const RespaldoNuevo: React.FC<{ onListo: () => void; onCancelar: () => void; textoBoton?: string }> = ({
  onListo,
  onCancelar,
  textoBoton = 'Crear contraseña de respaldo nueva',
}) => {
  const { user, refreshProfile } = useAuth();
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [anotada, setAnotada] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (nueva.length < 8) return setError('Debe tener al menos 8 caracteres.');
    if (nueva !== repetir) return setError('Las dos contraseñas no son iguales.');
    if (!anotada) return setError('Marca la casilla cuando ya la tengas anotada.');
    setTrabajando(true);
    try {
      await empezarDeNuevo(user.id, nueva);
      await refreshProfile();
      onListo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la contraseña nueva.');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-2">
      <CampoClave value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva contraseña de respaldo (mínimo 8)" disabled={trabajando} className={campo} autoComplete="off" />
      <CampoClave value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder="Repítela" disabled={trabajando} className={campo} autoComplete="off" />
      <label className="flex items-start gap-2 text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={anotada}
          onChange={(e) => setAnotada(e.target.checked)}
          disabled={trabajando}
          className="mt-0.5 w-4 h-4 accent-[#005198] shrink-0"
        />
        <span>Ya la anoté en un lugar seguro. Esta vez no la voy a olvidar.</span>
      </label>
      {error && <p className="text-xs font-['Inter'] text-[#B03030]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          disabled={trabajando}
          className="flex-1 h-11 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] text-[#5B6670] dark:text-[#E3E7EC] font-['Poppins'] font-semibold text-xs"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={trabajando}
          className="flex-[2] h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {trabajando ? <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2} /> : null}
          <span>{trabajando ? 'Creando…' : textoBoton}</span>
        </button>
      </div>
    </form>
  );
};
