import React, { useEffect, useState } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

const cache = new Map<string, string>();

/** Foto de perfil en grande (al tocar la foto, como en WhatsApp). */
export const FotoPerfilVisor: React.FC<{ avatarPath: string | null; nombre: string; onCerrar: () => void }> = ({
  avatarPath,
  nombre,
  onCerrar,
}) => {
  const [url, setUrl] = useState<string | null>(avatarPath ? cache.get(avatarPath) ?? null : null);
  const [cargando, setCargando] = useState(!!avatarPath && !url);

  useEffect(() => {
    if (!avatarPath || cache.has(avatarPath)) return;
    let vivo = true;
    supabase.storage
      .from('profile')
      .download(avatarPath)
      .then(({ data }) => {
        if (!vivo || !data) return;
        const u = URL.createObjectURL(data);
        cache.set(avatarPath, u);
        setUrl(u);
      })
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [avatarPath]);

  // El botón "atrás" del celular cierra la foto
  useEffect(() => {
    history.pushState({ fotoPerfil: true }, '');
    const alVolver = () => onCerrar();
    window.addEventListener('popstate', alVolver);
    return () => {
      window.removeEventListener('popstate', alVolver);
      if (history.state?.fotoPerfil) history.back();
    };
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={onCerrar}
    >
      <div className="h-14 shrink-0 flex items-center gap-2 px-2 text-white">
        <button type="button" onClick={onCerrar} className="w-11 h-11 flex items-center justify-center" aria-label="Cerrar">
          <ArrowLeft className="w-6 h-6" strokeWidth={2} />
        </button>
        <span className="font-['Poppins'] font-semibold text-base truncate">{nombre}</span>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {url ? (
          <img src={url} alt={`Foto de ${nombre}`} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        ) : cargando ? (
          <span className="w-64 h-64 rounded-[5px] bg-white/10 animate-pulse" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <User className="w-24 h-24" strokeWidth={1.5} />
            <span className="text-sm font-['Inter']">Sin foto de perfil</span>
          </div>
        )}
      </div>
    </div>
  );
};
