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
  Copy,
  Pencil,
  AtSign,
} from 'lucide-react';
import { asignarClaveInvitado, cambiarUsuarioInvitado } from '../lib/cuenta';
import { CampoClave } from '../components/CampoClave';
import { supabase } from '../lib/supabase';
import { AvatarImage } from '../components/AvatarImage';
import type { Profile } from '../types/database';
import { leerApariencia, partirNombre, type Apariencia } from '../lib/nombreApp';
import { Logo } from '../components/Logo';

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

  // Asignarle una contraseña (a ella le sale un aviso y la puede cambiar cuando quiera)
  const [claveNueva, setClaveNueva] = useState('');
  const [asignando, setAsignando] = useState(false);

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

  // Icono y nombre que esta persona le puso a su app
  const [suApariencia, setSuApariencia] = useState<Apariencia | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    leerApariencia(id).then(setSuApariencia).catch(() => setSuApariencia(null));
  }, [id]);

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
      setSuccessMsg(`Usuario cambiado a «${nuevo}». Avísale para que entre con ese usuario.`);
      setEditUsuario(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el usuario.');
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const handleAsignar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    if (claveNueva.length < 8) return setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
    setAsignando(true);
    try {
      await asignarClaveInvitado(id, claveNueva);
      setSuccessMsg('Contraseña cambiada. Dásela a ella: con esa entra de una vez.');
      setClaveNueva('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setAsignando(false);
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

      {/* Usuario (las contraseñas son solo de ella: aquí no se ven) */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-1">
          <AtSign className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Usuario para entrar</span>
        </h3>
        <p className="text-[11px] text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3">
          Con este usuario y su contraseña entra a ChatDos.
        </p>

        {/* Usuario */}
        <div className="py-1">
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

        {!profile.public_key && (
          <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mt-2">Esta persona todavía no ha entrado por primera vez.</p>
        )}
      </div>

      {/* Su app: icono y nombre que eligió */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider mb-3">Su app</h3>
        {suApariencia === undefined ? (
          <div className="h-14 rounded bg-[#E3E7EC] dark:bg-[#1F2933] animate-pulse" />
        ) : suApariencia === null ? (
          <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">No se pudo cargar.</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-[#F2F4F7] dark:bg-[#1F2933] border border-[#E3E7EC] dark:border-[#003A73] flex items-center justify-center shrink-0">
              {suApariencia.icono ? (
                <img src={suApariencia.icono} alt="Su icono" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <Logo predeterminado layout="cube" cubeHeight={30} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-['Poppins'] font-bold text-lg truncate">
                <span className="text-[#005198] dark:text-white">{partirNombre(suApariencia.nombre)[0]}</span>
                <span className="text-[#F28C1B]">{partirNombre(suApariencia.nombre)[1]}</span>
              </p>
              <p className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">
                {suApariencia.icono || suApariencia.nombre !== 'ChatDos' ? 'Lo eligió ella en su perfil' : 'Usa lo predeterminado (ChatDos)'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Asignarle una contraseña */}
      <div className="bg-white dark:bg-[#253240] p-5 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
        <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white uppercase tracking-wider flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <span>Ponerle una contraseña</span>
        </h3>
        <p className="text-xs text-[#5B6670] dark:text-[#E3E7EC] font-['Inter'] mb-3 leading-relaxed">
          Escribe la contraseña que va a usar y dásela. Entra directo con ella, y le sale un aviso de que tú se la pusiste.
          Ella la puede cambiar cuando quiera. Mejor no cambiarla seguido: en un celular nuevo dejaría de ver sus mensajes de antes.
        </p>
        <form onSubmit={handleAsignar} className="space-y-3">
          <CampoClave
            visibleInicial
            value={claveNueva}
            onChange={(e) => setClaveNueva(e.target.value)}
            placeholder="Contraseña nueva (mínimo 8)"
            autoComplete="off"
            disabled={asignando}
            className="w-full h-11 px-3 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] bg-white dark:bg-[#1F2933] text-sm font-mono text-[#1F2933] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#005198]"
          />
          <button
            type="submit"
            disabled={asignando}
            className="w-full h-11 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors disabled:opacity-60"
          >
            {asignando ? 'Guardando…' : 'Guardar contraseña'}
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
