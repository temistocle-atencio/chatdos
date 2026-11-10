import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MAX_NOTA, leerMiNota, miNotaDelServidor, publicarMiNota, quitarMiNota, tiempoRestante, type Nota } from '../lib/notas';

const IDEAS = ['😴 Durmiendo', '📚 En clase', '🚗 Manejando', '💼 Trabajando', '🎮 Jugando', '🔕 No molestar'];

/** Mi nota: una frase corta que la otra persona ve junto a mi foto durante 24 horas. */
export const MiNota: React.FC = () => {
  const { user } = useAuth();
  const [nota, setNota] = useState<Nota | null>(() => (user ? leerMiNota(user.id) : null));
  const [texto, setTexto] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    miNotaDelServidor(user.id).then(setNota).catch(() => {});
  }, [user]);

  if (!user) return null;

  const publicar = async (t: string) => {
    setError(null);
    setTrabajando(true);
    try {
      setNota(await publicarMiNota(user.id, t));
      setTexto('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar la nota.');
    } finally {
      setTrabajando(false);
    }
  };

  const quitar = async () => {
    setError(null);
    setTrabajando(true);
    try {
      await quitarMiNota(user.id);
      setNota(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar la nota.');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
      <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-1">
        <MessageCircle className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <span>Mi nota</span>
      </h3>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3 leading-relaxed">
        Una frase corta que aparece junto a tu foto durante 24 horas. Va cifrada: solo la otra persona del chat la puede leer.
      </p>

      {nota && (
        <div className="mb-3 flex items-center gap-2 p-2.5 rounded-[12px] bg-[#F2F4F7] dark:bg-[#1F2933]">
          <span className="flex-1 min-w-0 text-sm font-['Inter'] text-[#1F2933] dark:text-white truncate">{nota.texto}</span>
          <span className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] shrink-0">quedan {tiempoRestante(nota.expira)}</span>
          <button
            type="button"
            onClick={quitar}
            disabled={trabajando}
            className="w-8 h-8 flex items-center justify-center text-[#B03030] dark:text-[#FDEBD3] shrink-0"
            aria-label="Quitar mi nota"
            title="Quitar mi nota"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          publicar(texto);
        }}
        className="space-y-2"
      >
        <div className="relative">
          <input
            type="text"
            value={texto}
            maxLength={MAX_NOTA}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={nota ? 'Escribe una nota nueva…' : '¿Qué estás haciendo?'}
            disabled={trabajando}
            className="w-full h-11 pl-3 pr-14 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]"
            aria-label="Texto de la nota"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
            {texto.length}/{MAX_NOTA}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((i) => (
            <button
              key={i}
              type="button"
              disabled={trabajando}
              onClick={() => setTexto(i)}
              className="px-2.5 h-8 rounded-full border border-[#E3E7EC] dark:border-[#003A73] text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC]"
            >
              {i}
            </button>
          ))}
        </div>
        {error && <p className="text-xs font-['Inter'] text-[#B03030]">{error}</p>}
        <button
          type="submit"
          disabled={trabajando || !texto.trim()}
          className="w-full h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors disabled:opacity-50"
        >
          {trabajando ? 'Guardando…' : 'Publicar nota (24 h)'}
        </button>
      </form>
    </div>
  );
};
