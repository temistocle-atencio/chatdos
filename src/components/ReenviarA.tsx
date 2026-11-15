import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Forward } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { memoria } from '../lib/memoria';
import { useAtras } from '../lib/atras';
import { AvatarImage } from './AvatarImage';
import type { Profile } from '../types/database';

// Elegir a qué chat reenviar (como el "Reenviar a…" de WhatsApp)

interface Fila {
  chat_id: string;
  partner: Profile;
}

export const ReenviarA: React.FC<{
  userId: string;
  chatActual: string;
  cuantos: number;
  onElegir: (chatId: string) => void;
  onCerrar: () => void;
}> = ({ userId, chatActual, cuantos, onElegir, onCerrar }) => {
  useAtras(true, onCerrar);
  const [filas, setFilas] = useState<Fila[]>(() => (memoria.listas.get(userId) as Fila[] | undefined) ?? []);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(!filas.length);

  // La lista que ya está en memoria sale al instante; igual se pide al servidor por si cambió
  useEffect(() => {
    let vivo = true;
    supabase
      .rpc('mis_chats')
      .then(({ data }) => {
        if (vivo && data) setFilas((data as Fila[]).map((f) => ({ chat_id: f.chat_id, partner: f.partner })));
      })
      .then(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return filas.filter((f) => {
      const n = `${f.partner.display_name ?? ''} ${f.partner.username ?? ''}`.toLowerCase();
      return !q || n.includes(q);
    });
  }, [filas, buscar]);

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-end sm:items-center justify-center" onClick={onCerrar}>
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-[#253240] rounded-t-[12px] sm:rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div>
            <h2 className="text-base font-['Poppins'] font-semibold text-[#005198] dark:text-white">Reenviar a…</h2>
            <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
              {cuantos === 1 ? '1 mensaje' : `${cuantos} fotos y videos`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="w-9 h-9 flex items-center justify-center text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Cerrar">
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 pb-2">
          <label className="flex items-center gap-2 h-10 px-3 rounded-full bg-[#F2F4F7] dark:bg-[#1F2933] text-[#5B6670] dark:text-[#E3E7EC]">
            <Search className="w-4 h-4 shrink-0" strokeWidth={2} />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar"
              className="flex-1 min-w-0 bg-transparent text-[16px] md:text-sm font-['Inter'] text-[#1F2933] dark:text-white placeholder-[#5B6670] dark:placeholder-[#C9CFD6] focus:outline-none"
              aria-label="Buscar chat"
            />
          </label>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pb-2">
          {lista.map((f) => {
            const nombre = f.partner.display_name || f.partner.username || 'Sin nombre';
            const sinLlave = !f.partner.public_key;
            return (
              <button
                key={f.chat_id}
                type="button"
                disabled={sinLlave}
                onClick={() => onElegir(f.chat_id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F2F4F7] dark:hover:bg-white/5 disabled:opacity-50"
              >
                <AvatarImage avatarPath={f.partner.avatar_path} name={nombre} size={42} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-['Inter'] font-medium text-[#1F2933] dark:text-white truncate">{nombre}</span>
                  <span className="block text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
                    {sinLlave ? 'Aún no puede recibir mensajes' : f.chat_id === chatActual ? 'Este chat' : ''}
                  </span>
                </span>
                {!sinLlave && <Forward className="w-5 h-5 shrink-0 text-[#005198] dark:text-white" strokeWidth={2} />}
              </button>
            );
          })}
          {!lista.length && (
            <p className="px-4 py-6 text-center text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
              {cargando ? 'Cargando chats…' : 'No hay chats con ese nombre.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
