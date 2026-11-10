import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { memoria } from '../lib/memoria';
import {
  KeyRound,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  MessageSquare,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cambiarUsuarioInvitado, guardarEnBoveda, leerBoveda, type DatosAcceso } from '../lib/cuenta';
import { supabase } from '../lib/supabase';
import { AvatarImage } from '../components/AvatarImage';
import type { Profile } from '../types/database';
import { CampoClave } from '../components/CampoClave';

export const InvitadoDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Si viene de la lista de chats, sus datos ya están en memoria: se muestran al instante
  const enMem = [...memoria.companeros.entries()].find(([, p]) => p.id === id);
  const [profile, setProfile] = useState<Profile | null>(enMem?.[1] ?? null);
  const [chatId, setChatId] = useState<string | null>(enMem?.[0] ?? null);
  const [loading, setLoading] = useState(!enMem);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de cambio de contraseña
  const [newPassword, setNewPassword] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);

  // Datos de acceso guardados cifrados (solo el administrador y el invitado pueden abrirlos)
  const { user } = useAuth();
  const [boveda, setBoveda] = useState<DatosAcceso | null | undefined>(undefined);
  const [ver, setVer] = useState<{ contrasena: boolean; respaldo: boolean }>({ contrasena: false, respaldo: false });
  const [copiado, setCopiado] = useState<string | null>(null);
  const [editUsuario, setEditUsuario] = useState<string | null>(null);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  // Estados de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      if (!enMem) setLoading(true);
      setErrorMsg(null);
      try {
        // Cargar perfil del invitado
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();

        if (profError) throw profError;
        setProfile(profData as Profile);

        // Obtener chat_id compartido con este invitado
        const { data: memData } = await supabase
          .from('chat_members')
          .select('chat_id')
          .eq('user_id', id)
          .limit(1);

        if (memData && memData.length > 0) {
          setChatId(memData[0].chat_id);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg('No se pudo cargar la información del invitado.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    if (!user || !chatId || !profile?.public_key) return;
    let vivo = true;
    leerBoveda(user.id, chatId, profile.public_key)
      .then((d) => vivo && setBoveda(d))
      .catch(() => vivo && setBoveda(null));
    return () => {
      vivo = false;
    };
  }, [user, chatId, profile?.public_key]);

  const guardarCopia = async (cambios: DatosAcceso) => {
    if (!user || !chatId || !profile?.public_key) return;
    try {
      await guardarEnBoveda(user.id, chatId, profile.public_key, cambios);
      setBoveda((b) => ({ ...(b ?? {}), ...cambios }));
    } catch (e) {
      console.warn('[cuenta] no se pudo actualizar la copia cifrada', e);
    }
  };

  const copiar = async (texto: string, cual: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado((c) => (c === cual ? null : c)), 1500);
    } catch {
      /* nada */
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || editUsuario === null || !profile) return;
    const limpio = editUsuario.trim().toLowerCase();
    if (limpio === profile.username) return setEditUsuario(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setGuardandoUsuario(true);
    try {
      const nuevo = await cambiarUsuarioInvitado(id, limpio);
      setProfile({ ...profile, username: nuevo });
      await guardarCopia({ usuario: nuevo });
      setSuccessMsg(`Usuario cambiado a «${nuevo}». Avísale para que entre con ese usuario.`);
      setEditUsuario(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el usuario.');
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setUpdatingPass(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-invitados', {
        body: {
          accion: 'cambiar_clave',
          invitado_id: id,
          clave: newPassword,
        },
      });

      if (error) {
        setErrorMsg(error.message || 'Error al actualizar la contraseña.');
        return;
      }

      if (data?.error) {
        setErrorMsg(data.error);
        return;
      }

      if (data?.ok) {
        await guardarCopia({ contrasena: newPassword });
        setSuccessMsg('Contraseña actualizada con éxito.');
        setNewPassword('');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Error al conectar con el servidor.');
      }
    } finally {
      setUpdatingPass(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!id) return;
    setDeleting(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke('admin-invitados', {
        body: {
          accion: 'eliminar',
          invitado_id: id,
        },
      });

      if (error) {
        setErrorMsg(error.message || 'Error al eliminar el invitado.');
        setDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      if (data?.error) {
        setErrorMsg(data.error);
        setDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      if (data?.ok) {
        // Redirigir a la lista de chats tras borrar
        navigate('/chats', { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Error al eliminar la cuenta.');
      }
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-12 text-[#5B6670] dark:text-[#E3E7EC]">
        <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <p className="text-xs font-['Inter']">Cargando datos del invitado...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4 bg-white dark:bg-[#253240] rounded-[5px] text-center border border-[#E3E7EC] dark:border-[#003A73]">
        <p className="text-sm font-['Inter'] text-[#B03030]">No se encontró al invitado.</p>
        <button
          onClick={() => navigate('/chats')}
          className="mt-3 px-4 py-2 rounded-[5px] bg-[#005198] text-white text-xs font-['Poppins'] font-semibold"
        >
          Volver a Chats
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 pb-8">
      {/* Tarjeta de información del invitado */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <div className="flex items-center gap-4">
          <AvatarImage
            avatarPath={profile.avatar_path}
            name={profile.display_name || profile.username}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-['Poppins'] font-bold text-lg text-[#003A73] dark:text-white truncate">
              {profile.display_name || profile.username}
            </h2>
            <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
              @{profile.username}
            </p>
          </div>
        </div>

        {chatId && (
          <div className="mt-4 pt-3 border-t border-[#E3E7EC] dark:border-[#003A73]">
            {/* Único botón naranja en esta pantalla inicial */}
            <button
              onClick={() => navigate(`/chat/${chatId}`)}
              className="w-full h-11 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2 hover:brightness-105 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
            >
              <MessageSquare className="w-4 h-4 text-[#1F2933]" strokeWidth={2} />
              <span>Abrir Conversación</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter']">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-[5px] bg-white dark:bg-[#253240] text-[#1E7A44] border border-[#1E7A44]/40 text-xs font-['Inter'] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#1E7A44]" strokeWidth={2} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Datos de acceso: usuario y contraseñas (copia cifrada que solo ustedes dos pueden abrir) */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Datos de acceso</span>
        </h3>
        <p className="text-[11px] text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3">
          Guardados cifrados: solo tú y esta persona pueden verlos.
        </p>

        {/* Usuario */}
        <div className="py-2.5 border-b border-[#E3E7EC] dark:border-[#003A73]">
          <span className="block text-[10px] uppercase font-['Poppins'] text-[#5B6670] dark:text-[#E3E7EC]">Usuario</span>
          {editUsuario === null ? (
            <div className="flex items-center gap-1">
              <span className="flex-1 min-w-0 truncate font-mono text-sm font-semibold text-[#003A73] dark:text-white">{profile.username}</span>
              <button type="button" onClick={() => copiar(profile.username, 'usuario')} className="p-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Copiar usuario">
                {copiado === 'usuario' ? <Check className="w-4 h-4 text-[#1E7A44]" strokeWidth={2} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
              </button>
              <button type="button" onClick={() => setEditUsuario(profile.username)} className="p-2 text-[#005198] dark:text-[#E3E7EC]" aria-label="Cambiar usuario">
                <Pencil className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangeUsername} className="mt-1 space-y-2">
              <input
                type="text"
                value={editUsuario}
                onChange={(e) => setEditUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={guardandoUsuario}
                className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-mono text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]"
                aria-label="Nuevo usuario"
              />
              <p className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">3 a 20: minúsculas, números, punto o guion bajo.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditUsuario(null)} disabled={guardandoUsuario} className="flex-1 h-10 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] text-[#5B6670] dark:text-[#E3E7EC] font-['Poppins'] font-semibold text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoUsuario} className="flex-1 h-10 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs disabled:opacity-60">
                  {guardandoUsuario ? 'Guardando…' : 'Guardar usuario'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Contraseñas */}
        {(['contrasena', 'respaldo'] as const).map((k) => {
          const valor = boveda?.[k];
          const titulo = k === 'contrasena' ? 'Contraseña para entrar' : 'Contraseña de respaldo';
          return (
            <div key={k} className="py-2.5 border-b last:border-b-0 border-[#E3E7EC] dark:border-[#003A73]">
              <span className="block text-[10px] uppercase font-['Poppins'] text-[#5B6670] dark:text-[#E3E7EC]">{titulo}</span>
              {boveda === undefined ? (
                <span className="block h-5 w-32 mt-1 rounded bg-[#E3E7EC] dark:bg-[#1F2933] animate-pulse" />
              ) : valor ? (
                <div className="flex items-center gap-1">
                  <span className="flex-1 min-w-0 break-all font-mono text-sm font-semibold text-[#003A73] dark:text-white">
                    {ver[k] ? valor : '••••••••'}
                  </span>
                  <button type="button" onClick={() => setVer((v) => ({ ...v, [k]: !v[k] }))} className="p-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label={ver[k] ? 'Ocultar' : 'Mostrar'}>
                    {ver[k] ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
                  </button>
                  <button type="button" onClick={() => copiar(valor, k)} className="p-2 text-[#5B6670] dark:text-[#E3E7EC]" aria-label="Copiar">
                    {copiado === k ? <Check className="w-4 h-4 text-[#1E7A44]" strokeWidth={2} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
                  </button>
                </div>
              ) : (
                <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mt-0.5 leading-relaxed">
                  {k === 'contrasena'
                    ? 'Todavía no está guardada. Aparecerá cuando ella inicie sesión o la cambie, o cuando tú le pongas una nueva aquí abajo.'
                    : 'Todavía no está guardada. Aparecerá cuando ella la escriba al entrar en un celular nuevo o la cambie en su perfil.'}
                </p>
              )}
            </div>
          );
        })}
        {!profile.public_key && (
          <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mt-2">Esta persona todavía no ha entrado por primera vez.</p>
        )}
      </div>

      {/* Tarjeta para cambiar contraseña */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Cambiar Contraseña</span>
        </h3>
        <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3">
          Establece una nueva contraseña para este usuario si la olvidó o requiere acceso nuevo.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <CampoClave
            visibleInicial
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña (mínimo 8 caracteres)"
            disabled={updatingPass}
            className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-mono text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198] transition-all"
          />

          {/* Botón secundario azul según el manual de marca */}
          <button
            type="submit"
            disabled={updatingPass}
            className="w-full h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#003A73] transition-colors disabled:opacity-60"
          >
            {updatingPass ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
          </button>
        </form>
      </div>

      {/* Zona de peligro: Eliminar Invitado */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <h3 className="font-['Poppins'] font-semibold text-sm text-[#B03030] uppercase tracking-wider flex items-center gap-2 mb-2">
          <Trash2 className="w-4 h-4 text-[#B03030]" strokeWidth={2} />
          <span>Eliminar Cuenta</span>
        </h3>
        <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3 leading-relaxed">
          Esta acción borra permanentemente la cuenta del invitado, el chat, todos los mensajes y sus archivos. No se puede deshacer.
        </p>

        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="w-full h-11 rounded-[5px] border border-[#B03030] text-[#B03030] font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-2 hover:bg-[#B03030]/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
          <span>Eliminar Invitado</span>
        </button>
      </div>

      {/* Modal de confirmación para eliminar */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[5px] bg-white dark:bg-[#253240] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-[#E3E7EC] dark:border-[#003A73] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-['Poppins'] font-bold text-base text-[#B03030] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#B03030]" strokeWidth={2} />
                <span>¿Eliminar a {profile.display_name || profile.username}?</span>
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-[#5B6670] hover:text-[#1F2933] dark:hover:text-white"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <p className="text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed">
              Al confirmar, se eliminará por completo la cuenta, la conversación, los mensajes y todos los archivos subidos.
              <strong> Esta operación es irreversible.</strong>
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 h-11 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] text-[#5B6670] dark:text-[#E3E7EC] font-['Poppins'] font-semibold text-xs hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 h-11 rounded-[5px] bg-[#B03030] text-white font-['Poppins'] font-semibold text-xs flex items-center justify-center gap-1 hover:brightness-110 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
