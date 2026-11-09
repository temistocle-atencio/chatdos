import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, MessageSquare, Settings2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AvatarImage } from '../components/AvatarImage';
import { getLocalPrivateKey, getChatKey, decryptJSON } from '../lib/crypto';
import { formatChatListTime } from '../lib/formatters';
import type { ChatItem, Profile } from '../types/database';
import type { DbMessage, MessagePayload } from '../types/chat';

interface ChatItemWithPreview extends ChatItem {
  lastMessageText?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export const ChatsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState<ChatItemWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Obtener mis membresías de chat
      const { data: myMembers, error: memError } = await supabase
        .from('chat_members')
        .select('chat_id');

      if (memError) throw memError;

      if (!myMembers || myMembers.length === 0) {
        setChats([]);
        return;
      }

      const chatIds = myMembers.map((m) => m.chat_id);

      // 2. Obtener los otros miembros
      const { data: otherMembers, error: otherError } = await supabase
        .from('chat_members')
        .select('chat_id, user_id')
        .in('chat_id', chatIds)
        .neq('user_id', user.id);

      if (otherError) throw otherError;

      if (!otherMembers || otherMembers.length === 0) {
        setChats([]);
        return;
      }

      const partnerUserIds = Array.from(new Set(otherMembers.map((m) => m.user_id)));

      // 3. Consultar perfiles de compañeros
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', partnerUserIds);

      if (profError) throw profError;

      const profileMap = new Map<string, Profile>();
      (profiles || []).forEach((p: Profile) => profileMap.set(p.id, p));

      // 4. Obtener mi llave privada para descifrar últimos mensajes
      const myPrivateKey = await getLocalPrivateKey(user.id);

      // 5. Para cada chat, obtener último mensaje y contador de no leídos
      const chatItems: ChatItemWithPreview[] = [];

      for (const m of otherMembers) {
        const partnerProfile = profileMap.get(m.user_id);
        if (!partnerProfile) continue;

        let lastMessageText = '';
        let lastMessageTime = '';
        let unreadCount = 0;

        try {
          // Último mensaje del chat
          const { data: lastMsgs } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', m.chat_id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (lastMsgs && lastMsgs.length > 0) {
            const lastMsg = lastMsgs[0] as DbMessage;
            lastMessageTime = formatChatListTime(lastMsg.created_at);

            // Descifrar si hay llaves disponibles
            if (lastMsg.deleted_for_all) {
              lastMessageText = 'Se eliminó este mensaje';
            } else if (myPrivateKey && partnerProfile.public_key) {
              try {
                const cKey = await getChatKey(
                  m.chat_id,
                  myPrivateKey,
                  partnerProfile.public_key as JsonWebKey
                );
                const payload = await decryptJSON<MessagePayload>(
                  cKey,
                  lastMsg.ciphertext,
                  lastMsg.iv
                );
                const kindName = { image: 'Foto', video: 'Video', audio: 'Audio', text: '' }[lastMsg.kind];
                lastMessageText = payload.text || kindName || '';
              } catch {
                lastMessageText = 'Mensaje cifrado';
              }
            } else {
              lastMessageText = 'Mensaje cifrado';
            }
          }

          // Contador de no leídos (mensajes de la otra persona sin read_at)
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', m.chat_id)
            .neq('sender_id', user.id)
            .eq('deleted_for_all', false)
            .is('read_at', null);

          unreadCount = count || 0;
        } catch (err) {
          console.warn('[ChatsPage] Error al procesar previsualización de chat:', m.chat_id, err);
        }

        chatItems.push({
          chat_id: m.chat_id,
          partner: partnerProfile,
          lastMessageText,
          lastMessageTime,
          unreadCount,
        });
      }

      // Ordenar por el mensaje más reciente o por nombre
      chatItems.sort((a, b) => {
        if (a.lastMessageTime && b.lastMessageTime) {
          return b.lastMessageTime.localeCompare(a.lastMessageTime);
        }
        return (a.partner.display_name || '').localeCompare(b.partner.display_name || '');
      });

      setChats(chatItems);
    } catch (err: unknown) {
      console.error('[ChatsPage] Error al cargar lista de chats:', err);
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('No se pudieron cargar los chats.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChats();

    // Suscripción en tiempo real a mensajes para actualizar la vista previa de la lista
    const channel = supabase
      .channel('admin-chats-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchChats]);

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
          onClick={fetchChats}
          disabled={loading}
          className="p-2 rounded-[5px] hover:bg-[#E3E7EC] dark:hover:bg-[#003A73] text-[#5B6670] dark:text-[#E3E7EC] transition-colors"
          title="Actualizar lista"
          aria-label="Actualizar lista"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-[5px] bg-[#FDEBD3] text-[#B03030] text-xs font-['Inter']">
          {errorMsg}
        </div>
      )}

      {/* Lista estilo WhatsApp de conversaciones con último mensaje descifrado */}
      {loading ? (
        <div className="flex-1 flex flex-col justify-center items-center py-12 text-[#5B6670] dark:text-[#E3E7EC]">
          <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
          <p className="text-xs font-['Inter']">Cargando conversaciones...</p>
        </div>
      ) : chats.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 text-center bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73]">
          <MessageSquare className="w-10 h-10 text-[#005198] dark:text-[#E3E7EC] mb-3" strokeWidth={2} />
          <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white mb-1">
            No tienes invitados todavía
          </h3>
          <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] max-w-xs">
            Pulsa "Invitar" para crear la primera cuenta y empezar una conversación privada.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] divide-y divide-[#E3E7EC] dark:divide-[#003A73] overflow-hidden">
            {chats.map((item) => (
              <div
                key={item.chat_id}
                className="flex items-center justify-between p-3.5 hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] transition-colors cursor-pointer group"
                onClick={() => navigate(`/chat/${item.chat_id}`)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AvatarImage
                    avatarPath={item.partner.avatar_path}
                    name={item.partner.display_name || item.partner.username}
                    size={46}
                  />
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

                      {/* Contador de no leídos (como texto destacado según regla estricta de marca "sin píldoras rellenas") */}
                      {item.unreadCount !== undefined && item.unreadCount > 0 && (
                        <span className="text-xs font-['Poppins'] font-bold text-[#005198] dark:text-[#E3E7EC] shrink-0">
                          {item.unreadCount} nuevo{item.unreadCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón de configuración del invitado */}
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
              </div>
            ))}
          </div>

          {/* Botón flotante naranja "Invitar" (ÚNICO botón naranja de la pantalla cuando hay chats) */}
          <div className="fixed bottom-6 right-6 sm:right-[max(1.5rem,calc((100vw-28rem)/2+1.5rem))] z-50">
            <button
              onClick={() => navigate('/invitar')}
              className="h-12 px-5 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center gap-2 shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:brightness-105 active:scale-95 transition-all"
            >
              <UserPlus className="w-5 h-5 text-[#1F2933]" strokeWidth={2} />
              <span>Invitar</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
