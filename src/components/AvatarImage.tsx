import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AvatarImageProps {
  avatarPath: string | null;
  name: string;
  size?: number;
  className?: string;
}

// Caché en memoria para no volver a descargar el blob si la ruta no cambia
const avatarBlobCache = new Map<string, string>();

export const AvatarImage: React.FC<AvatarImageProps> = ({
  avatarPath,
  name,
  size = 40,
  className = '',
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(() => {
    if (avatarPath && avatarBlobCache.has(avatarPath)) {
      return avatarBlobCache.get(avatarPath)!;
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!avatarPath) {
      setBlobUrl(null);
      return;
    }

    if (avatarBlobCache.has(avatarPath)) {
      setBlobUrl(avatarBlobCache.get(avatarPath)!);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const downloadAvatar = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('profile')
          .download(avatarPath);

        if (error) {
          console.warn('[AvatarImage] No se pudo descargar la imagen de perfil:', error.message);
          return;
        }

        if (data && isMounted) {
          const url = URL.createObjectURL(data);
          avatarBlobCache.set(avatarPath, url);
          setBlobUrl(url);
        }
      } catch (err) {
        console.warn('[AvatarImage] Error al obtener el avatar:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    downloadAvatar();

    return () => {
      isMounted = false;
    };
  }, [avatarPath]);

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative shrink-0 rounded-[5px] overflow-hidden bg-[#003A73] text-white flex items-center justify-center font-['Poppins'] font-semibold select-none border border-[#E3E7EC] dark:border-[#003A73] ${className}`}
    >
      {blobUrl ? (
        <img
          src={blobUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : loading ? (
        <div className="w-full h-full bg-[#005198] animate-pulse" />
      ) : initial !== '?' ? (
        <span style={{ fontSize: `${Math.round(size * 0.45)}px` }}>{initial}</span>
      ) : (
        <User style={{ width: `${Math.round(size * 0.55)}px`, height: `${Math.round(size * 0.55)}px` }} strokeWidth={2} />
      )}
    </div>
  );
};
