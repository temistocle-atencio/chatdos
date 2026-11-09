import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Camera,
  Check,
  LogOut,
  AlertCircle,
  RefreshCw,
  AtSign,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AvatarImage } from '../components/AvatarImage';

export const PerfilPage: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [avatarBlobPreview, setAvatarBlobPreview] = useState<string | null>(null);
  const [selectedFileBlob, setSelectedFileBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redimensionar imagen a máx 512px en el lado largo y convertir a WebP con calidad 0.8
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Validación de formato inicial
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 512;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setErrorMsg('No se pudo procesar la imagen.');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              setSelectedFileBlob(blob);
              setAvatarBlobPreview(URL.createObjectURL(blob));
            } else {
              setErrorMsg('No fue posible convertir la imagen a WebP.');
            }
          },
          'image/webp',
          0.8
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = displayName.trim();
    if (!cleanName || cleanName.length > 40) {
      setErrorMsg('El nombre visible debe tener entre 1 y 40 caracteres.');
      return;
    }

    setSaving(true);
    try {
      let avatarPath = profile?.avatar_path || null;

      // 1. Si el usuario seleccionó una nueva foto, la subimos a bucket 'profile'
      if (selectedFileBlob) {
        const filePath = `${user.id}/avatar.webp`;
        const { error: uploadError } = await supabase.storage
          .from('profile')
          .upload(filePath, selectedFileBlob, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Error al subir imagen: ${uploadError.message}`);
        }
        avatarPath = filePath;
      }

      // 2. Actualizamos la tabla profiles (solo el propio perfil)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: cleanName,
          avatar_path: avatarPath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      await refreshProfile();
      setSuccessMsg('Perfil actualizado correctamente.');
      setSelectedFileBlob(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Error al guardar los cambios del perfil.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex-1 flex flex-col gap-4 pb-8">
      <div className="w-10 h-[3px] bg-[#F28C1B] mb-1"></div>
      <h1 className="font-['Poppins'] font-bold text-xl text-[#003A73] dark:text-white">
        Mi Perfil
      </h1>
      <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3">
        Administra tu nombre visible y tu foto de perfil.
      </p>

      {errorMsg && (
        <div className="p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter'] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#B03030] shrink-0 mt-0.5" strokeWidth={2} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-[5px] bg-white dark:bg-[#253240] text-[#1E7A44] border border-[#1E7A44]/30 text-xs font-['Inter'] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#1E7A44]" strokeWidth={2} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Tarjeta de foto de perfil y usuario */}
        <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] flex flex-col items-center">
          <div className="relative mb-3 group">
            {avatarBlobPreview ? (
              <img
                src={avatarBlobPreview}
                alt="Vista previa"
                className="w-24 h-24 rounded-[5px] object-cover border border-[#E3E7EC] dark:border-[#003A73] shadow-sm"
              />
            ) : (
              <AvatarImage
                avatarPath={profile?.avatar_path || null}
                name={displayName || profile?.username || 'Yo'}
                size={96}
              />
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 p-2 rounded-[5px] bg-[#005198] hover:bg-[#003A73] text-white shadow-md transition-colors"
              title="Cambiar foto de perfil"
            >
              <Camera className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <span className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
            Se ajusta a 512 px WebP automáticamente
          </span>

          {/* Usuario de solo lectura (según contrato estricto) */}
          <div className="mt-4 w-full p-2.5 bg-[#F2F4F7] dark:bg-[#1F2933] rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] flex items-center gap-2">
            <AtSign className="w-4 h-4 text-[#5B6670] dark:text-[#E3E7EC] shrink-0" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase font-['Poppins'] text-[#5B6670] dark:text-[#E3E7EC]">
                Usuario (no editable)
              </span>
              <span className="font-mono text-xs font-semibold text-[#003A73] dark:text-[#E3E7EC]">
                {profile?.username || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta de Nombre Visible */}
        <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
          <label className="block text-xs font-['Poppins'] uppercase tracking-wider text-[#5B6670] dark:text-[#E3E7EC] mb-1 font-medium">
            Nombre Visible (1-40 caracteres)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre aquí"
            maxLength={40}
            disabled={saving}
            className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-['Inter'] text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
          />

          {/* Único botón naranja de la pantalla */}
          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 mt-4 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:brightness-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#1F2933]" strokeWidth={2} />
                <span>Guardando...</span>
              </>
            ) : (
              <span>Guardar Cambios</span>
            )}
          </button>
        </div>
      </form>

      {/* Botón Cerrar Sesión */}
      <div className="pt-2">
        <button
          onClick={handleLogout}
          className="w-full h-11 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#B03030] hover:bg-[#FDEBD3]/40 font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4 text-[#B03030]" strokeWidth={2} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};
