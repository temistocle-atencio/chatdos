import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, MessageSquare, Settings2, RefreshCw, BellOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playIncoming, updateBadge } from '../lib/push';
import { leerSilencios } from '../lib/mute';
import { guardarDato, leerDato } from '../lib/offline';
import { claveLlave, memoria } from '../lib/memoria';
import { useAuth } from '../context/AuthContext';
import { AvatarImage } from '../components/AvatarImage';
import { FotoPerfilVisor } from '../components/FotoPerfilVisor';
import { conectarEnLinea, useEnLinea } from '../lib/enLinea';
import { cargarNotas, escucharNotas, useNotaDelChat } from '../lib/notas';
import { getLocalPrivateKey, getChatKey, decryptJSON } from '../lib/crypto';
import { formatChatListTime } from '../lib/formatters';
import type { ChatItem, Profile } from '../types/database';
import type { DbMessage, MessagePayload } from '../types/chat';

interface ChatItemWithPreview extends ChatItem {
  lastMessageText?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  muted?: boolean;
  lastAt?: string;
}

// Foto con el puntico verde cuando la otra persona tiene la app abierta (tocar = ver la foto)
const AvatarLista: React.FC<{ partner: Profile; chatId: string; onVer: () => void }> = ({ partner, chatId, onVer }) => {
  const enLinea = useEnLinea(partner.id);
  const nota = useNotaDelChat(chatId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onVer();
      }}
      className="relative shrink-0"
      aria-label={`Ver foto de ${partner.display_name || partner.username}`}
    >
      <AvatarImage avatarPath={partner.avatar_path} name={partner.display_name || partner.username} size={46} />
      {nota && (
        <span className="absolute -top-3 -left-1 max-w-[76px] px-1.5 py-0.5 rounded-[10px] bg-white dark:bg-[#1F2933] border border-[#E3E7EC] dark:border-[#003A73] shadow-[0_1px_4px_rgba(0,0,0,0.15)] text-[10px] leading-tight font-['Inter'] text-[#1F2933] dark:text-white truncate z-10">
          {nota.texto}
        </span>
      )}
      {enLinea && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-white dark:border-[#253240]"
          aria-label="En línea"
          title="En línea"
        />
      )}
    </button>
  );
};

// Texto corto del último mensaje (se descifra en el celular)
async function vistaPrevia(
  chatId: string,
  partner: Profile,
  msg: Pick<DbMessage, 'kind' | 'ciphertext' | 'iv' | 'view_once' | 'deleted_for_all'>,
  myKey: CryptoKey | null
): Promise<string> {
  if (msg.deleted_for_all) return 'Se eliminó este mensaje';
  if (!myKey || !partner.public_key) return 'Mensaje cifrado';
  try {
    const k = claveLlave(chatId, partner.public_key);
    let cKey = memoria.llaves.get(k);
    if (!cKey) {
      cKey = await getChatKey(chatId, myKey, partner.public_key as JsonWebKey);
      memoria.llaves.set(k, cKey);
    }
    const payload = await decryptJSON<MessagePayload>(cKey, msg.ciphertext, msg.iv);
    const kindName = { image: 'Foto', video: 'Video', audio: 'Audio', text: '' }[msg.kind];
    if (payload.media?.sticker) return 'Sticker';
    return msg.view_once ? `${kindName} · ver una vez` : payload.text || (payload.media?.music ? 'Música' : kindName) || '';
  } catch {
    return 'Mensaje cifrado';
  }
}

const ordenar = (lista: ChatItemWithPreview[]) =>
  [...lista].sort((a, b) =>
    a.lastAt && b.lastAt
      ? b.lastAt.localeCompare(a.lastAt)
      : a.lastAt
        ? -1
        : b.lastAt
          ? 1
          : (a.partner.display_name || '').localeCompare(b.partner.display_name || '')
  );

interface FilaMisChats {
  chat_id: string;
  partner: Profile;
  last_msg: (DbMessage & { created_at: string }) | null;
  unread: number;
}

export const ChatsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [fotoDe, setFotoDe] = useState<Profile | null>(null);
  const navigate = useNavigate();

  // Lo que ya se cargó antes se muestra al instante (sin "Cargando...")
  const enMemoria = user ? (memoria.listas.get(user.id) as ChatItemWithPreview[] | undefined) : undefined;
  const [chats, setChats] = useState<ChatItemWithPreview[]>(enMemoria ?? []);
  const idsChats = chats.map((c) => c.chat_id).join(',');
  useEffect(() => {
    if (user && idsChats) conectarEnLinea(user.id, idsChats.split(','));
  }, [user, idsChats]);
  // Notas de las otras personas (cifradas: se leen aquí con la llave de cada chat)
  const llavesChats = chats.map((c) => `${c.chat_id}:${c.partner.id}:${c.partner.public_key ? 1 : 0}`).join(',');
  useEffect(() => {
    if (!user || !llavesChats) return;
    const lista = chats
      .filter((c) => c.partner.public_key)
      .map((c) => ({ chatId: c.chat_id, partnerId: c.partner.id, publica: c.partner.public_key }));
    cargarNotas(user.id, lista);
    return escucharNotas(user.id, lista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, llavesChats]);
  const [loading, setLoading] = useState(!enMemoria); // solo la primera vez, si no hay nada guardado
  const [actualizando, setActualizando] = useState(false); // solo cuando la persona toca "actualizar"
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const silenciosRef = useRef<Record<string, string>>({});
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  const mostrar = useCallback(
    (lista: ChatItemWithPreview[]) => {
      const ordenada = ordenar(lista);
      chatsRef.current = ordenada;
      setChats(ordenada);
      if (user) {
        memoria.listas.set(user.id, ordenada);
        guardarDato(`lista-chats-${user.id}`, ordenada);
      }
    },
    [user]
  );

  // Pide la lista al servidor (en silencio: lo que ya se ve se queda mientras tanto)
  const fetchChats = useCallback(
    async (manual = false) => {
      if (!user) return;
      setErrorMsg(null);
      if (manual) setActualizando(true);

      // Sin nada en pantalla: primero la copia guardada en el celular
      if (!chatsRef.current.length) {
        const guardada = await leerDato<ChatItemWithPreview[]>(`lista-chats-${user.id}`);
        if (guardada?.length && !chatsRef.current.length) {
          chatsRef.current = guardada;
          setChats(guardada);
          memoria.listas.set(user.id, guardada);
          setLoading(false);
        }
      }

      try {
        // Todo en una sola consulta: chats, la otra persona, último mensaje y no leídos
        const [{ data, error }, silencios, myKey] = await Promise.all([
          supabase.rpc('mis_chats'),
          leerSilencios().catch(() => ({}) as Record<string, string>),
          getLocalPrivateKey(user.id),
        ]);
        if (error) throw error;
        silenciosRef.current = silencios;

        const filas = (data ?? []) as FilaMisChats[];
        const items = await Promise.all(
          filas.map(async (f): Promise<ChatItemWithPreview> => {
            memoria.companeros.set(f.chat_id, f.partner);
            const m = f.last_msg;
            return {
              chat_id: f.chat_id,
              partner: f.partner,
              lastMessageText: m ? await vistaPrevia(f.chat_id, f.partner, m, myKey) : '',
              lastMessageTime: m ? formatChatListTime(m.created_at) : '',
              lastAt: m?.created_at ?? '',
              unreadCount: f.unread || 0,
              muted: !!silencios[f.chat_id],
            };
          })
        );
        mostrar(items);
      } catch (err: unknown) {
        console.error('[ChatsPage] Error al cargar lista de chats:', err);
        if (!chatsRef.current.length) {
          // Sin nada que mostrar: aquí sí se avisa
          setErrorMsg(err instanceof Error ? err.message : 'No se pudieron cargar los chats.');
        }
      } finally {
        setLoading(false);
        setActualizando(false);
      }
    },
    [user, mostrar]
  );

  // Llegó un mensaje: se actualiza SOLO esa fila, al instante y sin recargar todo
  const aplicarMensajeNuevo = useCallback(
    async (msg: DbMessage) => {
      if (!user) return;
      const fila = chatsRef.current.find((c) => c.chat_id === msg.chat_id);
      if (!fila) return false;
      const myKey = await getLocalPrivateKey(user.id);
      const texto = await vistaPrevia(msg.chat_id, fila.partner, msg, myKey);
      const actual = chatsRef.current.find((c) => c.chat_id === msg.chat_id);
      if (!actual) return false;
      mostrar(
        chatsRef.current.map((c) =>
          c.chat_id === msg.chat_id
            ? {
                ...c,
                lastMessageText: texto,
                lastMessageTime: formatChatListTime(msg.created_at),
                lastAt: msg.created_at,
                unreadCount: msg.sender_id !== user.id ? (c.unreadCount || 0) + 1 : c.unreadCount,
              }
            : c
        )
      );
      return true;
    },
    [user, mostrar]
  );

  useEffect(() => {
    fetchChats();

    // Cambios menores (checks, borrados...): una sola actualización silenciosa
    let espera: ReturnType<typeof setTimeout> | null = null;
    const actualizarPronto = (ms = 1200) => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => {
        fetchChats();
        updateBadge();
      }, ms);
    };

    const channel = supabase
      .channel('admin-chats-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (cambio) => {
        const nuevo = cambio.new as DbMessage | null;
        if (cambio.eventType === 'INSERT' && nuevo?.chat_id) {
          const silenciado = !!(
            silenciosRef.current[nuevo.chat_id] && new Date(silenciosRef.current[nuevo.chat_id]).getTime() > Date.now()
          );
          if (nuevo.sender_id !== user?.id && !document.hidden && !silenciado) playIncoming('list');
          const ok = await aplicarMensajeNuevo(nuevo);
          updateBadge();
          if (!ok) actualizarPronto(300); // chat nuevo que aún no está en la lista
          return;
        }
        actualizarPronto();
      })
      .subscribe();

    // Al volver a la app se actualiza en silencio
    const alVolver = () => {
      if (!document.hidden) actualizarPronto(300);
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);

    return () => {
      if (espera) clearTimeout(espera);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
      supabase.removeChannel(channel);
    };
  }, [fetchChats, aplicarMensajeNuevo, user?.id]);

  return (
    <div className="flex-1 flex flex-col relative pb-20">
      {/* Cabecera de sección */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="w-10 h-[3px] bg-[#F28C1B] mb-2"></div>
          <h1 className="font-['Poppins'] font-bold text-xl text-[#003A73] dark:text-white">
            Conversaciones
          </h1>
        </div>

        <button
          onClick={() => fetchChats(true)}
          disabled={loading || actualizando}
          className="p-2 rounded-[5px] hover:bg-[#E3E7EC] dark:hover:bg-[#003A73] text-[#5B6670] dark:text-[#E3E7EC] transition-colors"
          title="Actualizar lista"
          aria-label="Actualizar lista"
        >
          <RefreshCw className={`w-4 h-4 ${actualizando ? 'animate-spin' : ''}`} strokeWidth={2} />
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter']">
          {errorMsg}
        </div>
      )}

      {/* Lista estilo WhatsApp de conversaciones con último mensaje descifrado */}
      {loading ? (
        // Solo la primera vez en un celular nuevo: filas grises de relleno (sin ruedita)
        <div
          className="bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] divide-y divide-[#E3E7EC] dark:divide-[#003A73] overflow-hidden"
          aria-label="Preparando tus conversaciones"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3.5">
              <div className="w-[46px] h-[46px] rounded-full bg-[#E3E7EC] dark:bg-[#1F2933] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-[#E3E7EC] dark:bg-[#1F2933] animate-pulse" />
                <div className="h-2.5 w-2/3 rounded bg-[#E3E7EC] dark:bg-[#1F2933] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : chats.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 text-center bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
          <MessageSquare className="w-10 h-10 text-[#005198] dark:text-[#E3E7EC] mb-3" strokeWidth={2} />
          <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white mb-1">
            {isAdmin ? 'No tienes invitados todavía' : 'Todavía no tienes conversaciones'}
          </h3>
          <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] max-w-xs">
            {isAdmin ? 'Pulsa "Invitar" para crear la primera cuenta y empezar una conversación privada.' : 'Cuando tu administrador te escriba, la conversación aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] divide-y divide-[#E3E7EC] dark:divide-[#003A73] overflow-hidden">
            {chats.map((item) => (
              <div
                key={item.chat_id}
                className="flex items-center justify-between p-3.5 hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] transition-colors cursor-pointer group"
                onClick={() => {
                  if (item.unreadCount) {
                    mostrar(chatsRef.current.map((c) => (c.chat_id === item.chat_id ? { ...c, unreadCount: 0 } : c)));
                  }
                  navigate(`/chat/${item.chat_id}`);
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AvatarLista partner={item.partner} chatId={item.chat_id} onVer={() => setFotoDe(item.partner)} />
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white truncate">
                        {item.partner.display_name || item.partner.username}
                      </h4>
                      {item.lastMessageTime && (
                        <span className="text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] shrink-0">
                          {item.lastMessageTime}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] truncate">
                        {item.lastMessageText || `@${item.partner.username}`}
                      </p>

                      {item.muted && (
                        <BellOff className="w-3.5 h-3.5 text-[#5B6670] dark:text-[#E3E7EC] shrink-0" strokeWidth={2} aria-label="Silenciado" />
                      )}

                      {/* Contador de no leídos (como texto destacado según regla estricta de marca "sin píldoras rellenas") */}
                      {item.unreadCount !== undefined && item.unreadCount > 0 && (
                        <span className="text-xs font-['Poppins'] font-bold text-[#005198] dark:text-[#E3E7EC] shrink-0">
                          {item.unreadCount} nuevo{item.unreadCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón de configuración del invitado (solo el administrador) */}
                {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/invitado/${item.partner.id}`);
                  }}
                  className="p-2 rounded-[5px] text-[#5B6670] hover:text-[#005198] dark:text-[#E3E7EC] dark:hover:text-white hover:bg-white dark:hover:bg-[#253240] transition-colors shrink-0"
                  title="Gestionar cuenta de invitado"
                  aria-label="Gestionar cuenta"
                >
                  <Settings2 className="w-4 h-4" strokeWidth={2} />
                </button>
                )}
              </div>
            ))}
          </div>

          {/* Botón flotante naranja "Invitar" (solo el administrador) */}
          {isAdmin && (
          <div className="fixed bottom-6 right-6 sm:right-[max(1.5rem,calc((100vw-28rem)/2+1.5rem))] z-50">
            <button
              onClick={() => navigate('/invitar')}
              className="h-12 px-5 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center gap-2 shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:brightness-105 active:scale-95 transition-all"
            >
              <UserPlus className="w-5 h-5 text-[#1F2933]" strokeWidth={2} />
              <span>Invitar</span>
            </button>
          </div>
          )}
        </>
      )}
      {fotoDe && (
        <FotoPerfilVisor
          avatarPath={fotoDe.avatar_path}
          nombre={fotoDe.display_name || fotoDe.username}
          onCerrar={() => setFotoDe(null)}
        />
      )}
    </div>
  );
};
