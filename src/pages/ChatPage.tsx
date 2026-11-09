import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Send,
  Smile,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  KeyRound,
  X,
  MoreVertical,
  User,
  Settings,
  LogOut,
  MessageSquare,
  Reply,
  Pencil,
  Paperclip,
  Mic,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AvatarImage } from '../components/AvatarImage';
import { MessageItem } from '../components/MessageItem';
import { EmojiPickerPopover } from '../components/EmojiPickerPopover';
import { MessageActionsSheet } from '../components/MessageActionsSheet';
import { MessageMedia, MediaViewer, type UploadState } from '../components/MessageMedia';
import { AttachSheet, MediaComposer, type PendingMedia } from '../components/MediaComposer';
import {
  MAX_FILE_BYTES,
  MAX_VIDEO_SECONDS,
  MAX_AUDIO_SECONDS,
  compressImage,
  inspectVideo,
  audioDuration,
  VoiceRecorder,
  mediaPath,
  uploadEncrypted,
  cacheLocalUrl,
  forgetUrl,
  downloadDecrypted,
  formatDuration,
} from '../lib/media';
import {
  getLocalPrivateKey,
  getChatKey,
  encryptJSON,
  decryptJSON,
  computeSecurityNumber,
  checkPartnerKeyChange,
} from '../lib/crypto';
import {
  formatLastSeen,
  formatMessageDateSeparator,
} from '../lib/formatters';
import {
  safeMarkDelivered,
  safeMarkRead,
  safeTouchLastSeen,
} from '../lib/rpc';
import type { Profile } from '../types/database';
import type { DbMessage, DecryptedMessage, MessagePayload, Reaction, ReplyPreview } from '../types/chat';

// Texto corto para mostrar un mensaje dentro de una cita o un aviso
const shortText = (m: DecryptedMessage): string => {
  if (m.deleted_for_all) return 'Mensaje eliminado';
  const t = (m.payload?.text || '').replace(/\s+/g, ' ').trim();
  if (t) return t.length > 120 ? t.slice(0, 120) + '…' : t;
  if (m.kind === 'image') return 'Foto';
  if (m.kind === 'video') return 'Video';
  if (m.kind === 'audio') return 'Audio';
  return 'Mensaje';
};

export const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user, profile: myProfile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  // Información del compañero de chat
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Llave criptográfica del chat
  const [chatKey, setChatKey] = useState<CryptoKey | null>(null);

  // Mensajes y paginación
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Presencia y estado en tiempo real
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastTime = useRef<number>(0);

  // Menú de tres puntos de la cabecera
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Entrada de texto y emojis
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Seguridad
  const [keyChangedAlert, setKeyChangedAlert] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityNumber, setSecurityNumber] = useState<string | null>(null);
  const [calculatingSecurity, setCalculatingSecurity] = useState(false);

  // ETAPA 5: reacciones, responder, editar y eliminar
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [actionMsg, setActionMsg] = useState<DecryptedMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<DecryptedMessage | null>(null);
  const [replyTo, setReplyTo] = useState<DecryptedMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<DecryptedMessage | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState<DecryptedMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());

  // ETAPA 6: fotos, videos y audios
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [viewer, setViewer] = useState<{
    url?: string;
    kind: 'image' | 'video' | 'audio';
    viewOnceMsg?: DecryptedMessage;
    loading?: boolean;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordViewOnce, setRecordViewOnce] = useState(false);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const retryRef = useRef<Map<string, { media: PendingMedia; payload: MessagePayload; viewOnce: boolean; replyId: string | null; fileKey?: string }>>(new Map());
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<DecryptedMessage[]>([]);

  // Referencia al canal activo de realtime para enviar broadcast 'typing'
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cerrar menú de cabecera al hacer clic fuera
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    if (headerMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [headerMenuOpen]);

  // 1. Cargar compañero de chat y derivar la llave de chat
  useEffect(() => {
    if (!chatId || !user) return;

    let isMounted = true;

    const initChat = async () => {
      setLoadingPartner(true);
      setErrorMsg(null);
      try {
        // Buscar el otro participante
        const { data: memberData, error: memError } = await supabase
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', chatId)
          .neq('user_id', user.id)
          .single();

        if (memError || !memberData?.user_id) {
          throw new Error('No se encontró a la otra persona en esta conversación.');
        }

        // Consultar el perfil del compañero
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', memberData.user_id)
          .single();

        if (profError || !profData) {
          throw new Error('No se pudo cargar el perfil de tu pareja de chat.');
        }

        const partnerProf = profData as Profile;
        if (!isMounted) return;
        setPartner(partnerProf);

        // Verificar si la llave pública de la otra persona cambió
        if (partnerProf.public_key) {
          const hasChanged = await checkPartnerKeyChange(
            partnerProf.id,
            partnerProf.public_key as JsonWebKey
          );
          if (isMounted) setKeyChangedAlert(hasChanged);

          // Derivar la llave simétrica del chat
          const myPrivateKey = await getLocalPrivateKey(user.id);
          if (myPrivateKey) {
            const derived = await getChatKey(
              chatId,
              myPrivateKey,
              partnerProf.public_key as JsonWebKey
            );
            if (isMounted) setChatKey(derived);
          }
        }
      } catch (err: unknown) {
        console.error('[ChatDos] Error al iniciar chat:', err);
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Error al conectar con el chat.');
        }
      } finally {
        if (isMounted) setLoadingPartner(false);
      }
    };

    initChat();

    return () => {
      isMounted = false;
    };
  }, [chatId, user]);

  // Función para descifrar un mensaje seguro
  const decryptSingleMessage = useCallback(
    async (msg: DbMessage, key: CryptoKey | null): Promise<DecryptedMessage> => {
      if (msg.deleted_for_all) {
        return { ...msg, payload: undefined, decryptionError: false };
      }
      if (!key) {
        return { ...msg, decryptionError: true };
      }
      try {
        const payload = await decryptJSON<MessagePayload>(key, msg.ciphertext, msg.iv);
        return { ...msg, payload };
      } catch (err) {
        console.warn('[ChatDos] No se pudo descifrar el mensaje:', msg.id, err);
        return { ...msg, decryptionError: true };
      }
    },
    []
  );

  // 2. Cargar los últimos 50 mensajes y marcar como leídos al abrir el chat
  useEffect(() => {
    if (!chatId || !chatKey) return;

    let isMounted = true;

    const loadInitialMessages = async () => {
      setLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('[ChatDos] loadInitialMessages', error);
          throw error;
        }

        const rawList = (data || []) as DbMessage[];
        if (rawList.length === 50) {
          if (isMounted) setHasMoreOlder(true);
        }

        const decryptedList = await Promise.all(
          rawList.map((m) => decryptSingleMessage(m, chatKey))
        );
        decryptedList.reverse();

        if (isMounted) {
          setMessages(decryptedList);
          loadReactions(decryptedList.map((m) => m.id));
          // Al abrir el chat se marca como leído
          safeMarkRead(chatId);
        }
      } catch (err) {
        console.error('[ChatDos] Error al cargar mensajes iniciales:', err);
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
          scrollToBottom();
        }
      }
    };

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [chatId, chatKey, decryptSingleMessage]);

  // Guardar los ids de los mensajes en pantalla (para filtrar reacciones en tiempo real)
  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
    messagesRef.current = messages;
  }, [messages]);

  // Ocultar el aviso corto después de 2,5 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Cargar las reacciones de un grupo de mensajes
  const loadReactions = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data, error } = await supabase
      .from('reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', ids);
    if (error) {
      console.error('[ChatDos] reacciones', error);
      return;
    }
    setReactions((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      (data as Reaction[]).forEach((r) => {
        next[r.message_id] = [...(next[r.message_id] || []), r];
      });
      return next;
    });
  };

  // Poner o quitar una reacción en la lista local
  const applyReaction = (r: Reaction | null, messageId: string, userId: string) => {
    setReactions((prev) => {
      const list = (prev[messageId] || []).filter((x) => x.user_id !== userId);
      return { ...prev, [messageId]: r ? [...list, r] : list };
    });
  };

  // ¿El usuario está viendo el final de la conversación?
  const isNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow, body.style.overscrollBehavior];
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    // Cuando el teclado cambia el alto visible, seguir mostrando el último mensaje
    const vv = window.visualViewport;
    let wasNearBottom = true;
    const before = () => {
      wasNearBottom = isNearBottom();
    };
    const after = () => {
      window.scrollTo(0, 0);
      if (wasNearBottom) {
        const el = scrollContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }
    };
    vv?.addEventListener('resize', after);
    scrollContainerRef.current?.addEventListener('scroll', before, { passive: true });
    const container = scrollContainerRef.current;

    return () => {
      [html.style.overflow, body.style.overflow, body.style.overscrollBehavior] = prev;
      vv?.removeEventListener('resize', after);
      container?.removeEventListener('scroll', before);
    };
  }, [loadingPartner]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  // 3. Paginación hacia arriba (50 mensajes más antiguos)
  const loadOlderMessages = async () => {
    if (!chatId || !chatKey || loadingOlder || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (!oldestMessage.created_at) return;

    setLoadingOlder(true);
    const prevScrollHeight = scrollContainerRef.current?.scrollHeight || 0;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[ChatDos] loadOlderMessages', error);
        throw error;
      }

      const rawList = (data || []) as DbMessage[];
      if (rawList.length < 50) {
        setHasMoreOlder(false);
      }

      const decryptedOlder = await Promise.all(
        rawList.map((m) => decryptSingleMessage(m, chatKey))
      );
      decryptedOlder.reverse();

      setMessages((prev) => [...decryptedOlder, ...prev]);
      loadReactions(decryptedOlder.map((m) => m.id));

      setTimeout(() => {
        if (scrollContainerRef.current) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
        }
      }, 50);
    } catch (err) {
      console.error('[ChatDos] Error al cargar mensajes anteriores:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // 4. Conexión en tiempo real: suscripción a canal privado chat:<chatId>
  useEffect(() => {
    if (!chatId || !user) return;

    let isMounted = true;

    const connectRealtime = async () => {
      // Orden exacto requerido por el contrato:
      // 1. Obtener access_token de la sesión
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }

      // 2. Crear canal privado con broadcast y presence (key = user.id)
      const channel = supabase.channel(`chat:${chatId}`, {
        config: {
          private: true,
          broadcast: { self: false },
          presence: { key: user.id },
        },
      });

      activeChannelRef.current = channel;

      // Escuchar eventos de Presence
      channel
        .on('presence', { event: 'sync' }, () => {
          if (!isMounted) return;
          const state = channel.presenceState();
          console.log('[ChatDos] presenceState sync', state);

          // Verificar si el compañero está presente
          const partnerOnline = partner?.id
            ? !!state[partner.id]
            : Object.keys(state).some((k) => k !== user.id);
          setIsPartnerOnline(partnerOnline);
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          console.log('[ChatDos] presence join', key);
          if (!isMounted) return;
          if (key !== user.id) {
            setIsPartnerOnline(true);
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log('[ChatDos] presence leave', key);
          if (!isMounted) return;
          if (key !== user.id) {
            setIsPartnerOnline(false);
          }
        });

      // Escuchar broadcast 'typing'
      channel.on('broadcast', { event: 'typing' }, (eventPayload) => {
        if (!isMounted) return;
        if (eventPayload?.payload?.userId !== user.id) {
          setIsPartnerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            if (isMounted) setIsPartnerTyping(false);
          }, 4000);
        }
      });

      // Escuchar postgres_changes: INSERT
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          if (!isMounted) return;
          const newDbMsg = payload.new as DbMessage;
          console.log('[ChatDos] Nuevo INSERT en messages:', newDbMsg.id);

          // Si es de la otra persona: marcar como entregado y como leído
          if (newDbMsg.sender_id !== user.id) {
            safeMarkDelivered();
            if (!document.hidden) {
              safeMarkRead(chatId);
            }
          }

          const decrypted = await decryptSingleMessage(newDbMsg, chatKey);

          setMessages((prev) => {
            const exists = prev.findIndex((m) => m.id === newDbMsg.id);
            if (exists >= 0) {
              const updated = [...prev];
              updated[exists] = decrypted;
              return updated;
            }
            return [...prev, decrypted];
          });

          scrollToBottom();
        }
      );

      // Escuchar postgres_changes: UPDATE (actualización de checks en vivo sin volver a descifrar)
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const updatedDbMsg = payload.new as DbMessage;
          console.log('[ChatDos] UPDATE en message checks:', updatedDbMsg.id, {
            delivered_at: updatedDbMsg.delivered_at,
            read_at: updatedDbMsg.read_at,
          });

          // Si se editó o se eliminó, hay que volver a descifrar el contenido
          const current = messagesRef.current.find((m) => m.id === updatedDbMsg.id);
          if (
            current &&
            (current.edited_at !== updatedDbMsg.edited_at ||
              current.deleted_for_all !== updatedDbMsg.deleted_for_all)
          ) {
            decryptSingleMessage(updatedDbMsg, chatKey).then((fresh) => {
              if (!isMounted) return;
              setMessages((prev) => prev.map((m) => (m.id === fresh.id ? fresh : m)));
            });
            return;
          }

          // Actualiza delivered_at / read_at directamente en memoria sin volver a descifrar
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === updatedDbMsg.id) {
                return {
                  ...m,
                  delivered_at: updatedDbMsg.delivered_at,
                  read_at: updatedDbMsg.read_at,
                  viewed_at: updatedDbMsg.viewed_at,
                  edited_at: updatedDbMsg.edited_at,
                  deleted_for_all: updatedDbMsg.deleted_for_all,
                };
              }
              return m;
            })
          );
        }
      );

      // Reacciones en tiempo real (RLS solo deja ver las de mis chats; filtramos las de este chat)
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<Reaction>;
            if (old.message_id && old.user_id && messageIdsRef.current.has(old.message_id)) {
              applyReaction(null, old.message_id, old.user_id);
            }
            return;
          }
          const r = payload.new as Reaction;
          if (messageIdsRef.current.has(r.message_id)) {
            applyReaction(r, r.message_id, r.user_id);
          }
        }
      );

      // Suscribirse y registrar status en consola
      channel.subscribe(async (status, err) => {
        console.log('[ChatDos] canal', status, err);
        if (status === 'SUBSCRIBED') {
          const trackRes = await channel.track({ online: true });
          console.log('[ChatDos] trackStatus', trackRes);
        }
      });
    };

    connectRealtime();

    return () => {
      isMounted = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (activeChannelRef.current) {
        activeChannelRef.current.untrack();
        supabase.removeChannel(activeChannelRef.current);
        activeChannelRef.current = null;
      }
    };
  }, [chatId, user, partner?.id, chatKey, decryptSingleMessage]);

  // 5. Manejo de visibilidad y RPCs según contrato estricto
  useEffect(() => {
    if (!chatId) return;

    // Al abrir el chat
    safeMarkDelivered();
    safeMarkRead(chatId);
    safeTouchLastSeen();

    // touch_last_seen cada 60 s con la app visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        safeTouchLastSeen();
      }
    }, 60000);

    const handleVisibility = () => {
      if (!document.hidden) {
        // En visibilitychange a 'visible': mark_read y touch_last_seen
        safeTouchLastSeen();
        safeMarkDelivered();
        safeMarkRead(chatId);
      } else {
        // En visibilitychange a 'hidden': touch_last_seen
        safeTouchLastSeen();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [chatId]);

  // Manejo de escritura (Broadcast 'typing' cada 2s)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 4000) {
      setInputText(text);

      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

      const now = Date.now();
      if (now - lastTypingBroadcastTime.current > 2000 && user && activeChannelRef.current) {
        lastTypingBroadcastTime.current = now;
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id },
        });
      }
    }
  };

  // Manejo de teclado (Enter envía en computador, salto de línea en celular)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && (replyTo || editingMsg)) {
      e.preventDefault();
      cancelEditOrReply();
      return;
    }
    const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobileDevice && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 6. Enviar mensaje cifrado (o guardar la edición)
  const handleSendMessage = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || !user || !chatId || !chatKey) return;

    if (editingMsg) {
      await saveEdit(editingMsg, textToSend);
      return;
    }

    const messageId = crypto.randomUUID();
    const sentAt = Date.now();
    const replying = replyTo;
    const replyPreview: ReplyPreview | undefined = replying
      ? { senderId: replying.sender_id, text: shortText(replying), kind: replying.kind }
      : undefined;

    const payload: MessagePayload = { v: 1, text: textToSend, sentAt, ...(replyPreview ? { replyPreview } : {}) };

    // Mensaje optimista
    const optimisticMessage: DecryptedMessage = {
      id: messageId,
      chat_id: chatId,
      sender_id: user.id,
      kind: 'text',
      ciphertext: '',
      iv: '',
      media_path: null,
      reply_to: replying ? replying.id : null,
      view_once: false,
      created_at: new Date(sentAt).toISOString(),
      edited_at: null,
      deleted_for_all: false,
      delivered_at: null,
      read_at: null,
      viewed_at: null,
      payload,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    scrollToBottom();

    try {
      const encrypted = await encryptJSON(chatKey, payload);

      const { error } = await supabase.from('messages').upsert(
        {
          id: messageId,
          chat_id: chatId,
          sender_id: user.id,
          kind: 'text',
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          view_once: false,
          reply_to: replying ? replying.id : null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

      if (error) {
        console.error('[ChatDos] error al enviar mensaje:', error);
        throw error;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPending: false } : m))
      );
    } catch (err) {
      console.error('[ChatDos] Error en handleSendMessage:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPending: true } : m))
      );
    }
  };

  // Limpiar el campo de texto
  const resetInput = () => {
    setInputText('');
    setShowEmojiPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  // Guardar un mensaje editado: se vuelve a cifrar con el texto nuevo
  const saveEdit = async (msg: DecryptedMessage, newText: string) => {
    if (!chatKey) return;
    if (newText === msg.payload?.text) {
      setEditingMsg(null);
      resetInput();
      return;
    }
    const payload: MessagePayload = { ...(msg.payload as MessagePayload), text: newText };
    try {
      const encrypted = await encryptJSON(chatKey, payload);
      const { data, error } = await supabase
        .from('messages')
        .update({ ciphertext: encrypted.ciphertext, iv: encrypted.iv })
        .eq('id', msg.id)
        .select('*')
        .single();
      if (error) throw error;
      const saved = data as DbMessage;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, ciphertext: saved.ciphertext, iv: saved.iv, edited_at: saved.edited_at, payload }
            : m
        )
      );
      setEditingMsg(null);
      resetInput();
    } catch (err) {
      console.error('[ChatDos] editar', err);
      const text = (err as { message?: string })?.message || '';
      setToast(text.includes('15 minutos') ? 'Ya pasaron los 15 minutos para editar' : 'No se pudo editar el mensaje');
    }
  };

  // ----- Acciones del menú de un mensaje -----
  const myReactionFor = (msgId: string): string | null =>
    (reactions[msgId] || []).find((r) => r.user_id === user?.id)?.emoji || null;

  // Poner, cambiar o quitar mi reacción
  const toggleReaction = async (msg: DecryptedMessage, emoji: string) => {
    if (!user || msg.deleted_for_all) return;
    const current = myReactionFor(msg.id);
    setActionMsg(null);
    setReactionPickerFor(null);
    if (current === emoji) {
      applyReaction(null, msg.id, user.id);
      const { error } = await supabase.from('reactions').delete().eq('message_id', msg.id).eq('user_id', user.id);
      if (error) {
        console.error('[ChatDos] quitar reacción', error);
        loadReactions([msg.id]);
      }
      return;
    }
    const r: Reaction = { message_id: msg.id, user_id: user.id, emoji };
    applyReaction(r, msg.id, user.id);
    const { error } = await supabase.from('reactions').upsert(r, { onConflict: 'message_id,user_id' });
    if (error) {
      console.error('[ChatDos] reaccionar', error);
      setToast('No se pudo guardar la reacción');
      loadReactions([msg.id]);
    }
  };

  const startReply = (msg: DecryptedMessage) => {
    setActionMsg(null);
    setEditingMsg(null);
    setReplyTo(msg);
    textareaRef.current?.focus();
  };

  const startEdit = (msg: DecryptedMessage) => {
    setActionMsg(null);
    setReplyTo(null);
    setEditingMsg(msg);
    setInputText(msg.payload?.text || '');
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      }
    }, 0);
  };

  const cancelEditOrReply = () => {
    if (editingMsg) resetInput();
    setEditingMsg(null);
    setReplyTo(null);
  };

  const copyText = async (msg: DecryptedMessage) => {
    setActionMsg(null);
    try {
      await navigator.clipboard.writeText(msg.payload?.text || '');
      setToast('Texto copiado');
    } catch {
      setToast('No se pudo copiar');
    }
  };

  // Eliminar para mí: se esconde solo en mi cuenta
  const deleteForMe = async (msg: DecryptedMessage) => {
    if (!user) return;
    setActionMsg(null);
    const backup = messages;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    const { error } = await supabase.from('message_hidden').insert({ user_id: user.id, message_id: msg.id });
    if (error && error.code !== '23505') {
      console.error('[ChatDos] eliminar para mí', error);
      setMessages(backup);
      setToast('No se pudo eliminar el mensaje');
    }
  };

  // Eliminar para todos: primero el archivo (si tiene) y luego el contenido
  const deleteForAll = async (msg: DecryptedMessage) => {
    setConfirmDeleteAll(null);
    forgetUrl(msg.id);
    if (msg.media_path) {
      const { error: stErr } = await supabase.storage.from('media').remove([msg.media_path]);
      if (stErr) console.error('[ChatDos] borrar archivo', stErr);
    }
    const { error } = await supabase.from('messages').update({ deleted_for_all: true }).eq('id', msg.id);
    if (error) {
      console.error('[ChatDos] eliminar para todos', error);
      setToast('No se pudo eliminar el mensaje');
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, deleted_for_all: true, payload: undefined, ciphertext: '', iv: '', media_path: null }
          : m
      )
    );
    if (replyTo?.id === msg.id) setReplyTo(null);
  };

  // ===================== ETAPA 6: archivos =====================

  // Revisar y preparar el archivo elegido (comprimir fotos, revisar tamaño y duración)
  const handleFilePicked = async (file: File | undefined, forceAudio = false) => {
    setAttachOpen(false);
    if (!file) return;
    setPreparing(true);
    try {
      if (!forceAudio && file.type.startsWith('image/')) {
        const img = await compressImage(file);
        setPendingMedia({ kind: 'image', blob: img.blob, mime: img.mime, width: img.width, height: img.height, thumb: img.thumb });
      } else if (!forceAudio && file.type.startsWith('video/')) {
        if (file.size > MAX_FILE_BYTES) throw new Error('El video pesa más de 25 MB. Recórtalo o grábalo más corto.');
        const info = await inspectVideo(file);
        if (info.duration > MAX_VIDEO_SECONDS + 0.5) throw new Error('El video dura más de 2 minutos. Recórtalo antes de enviarlo.');
        setPendingMedia({ kind: 'video', blob: file, mime: file.type || 'video/mp4', ...info });
      } else if (file.type.startsWith('audio/') || forceAudio) {
        if (file.size > MAX_FILE_BYTES) throw new Error('El audio pesa más de 25 MB.');
        const duration = await audioDuration(file);
        setPendingMedia({ kind: 'audio', blob: file, mime: file.type || 'audio/mpeg', duration, name: file.name, music: true });
      } else {
        throw new Error('Ese tipo de archivo no se puede enviar.');
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No se pudo preparar el archivo');
    } finally {
      setPreparing(false);
    }
  };

  // Subir (cifrado) y guardar el mensaje. Sirve también para reintentar.
  const uploadAndSave = async (
    messageId: string,
    media: PendingMedia,
    payload: MessagePayload,
    viewOnce: boolean,
    replyId: string | null
  ) => {
    if (!user || !chatId || !chatKey) return;
    const path = mediaPath(chatId, user.id, messageId);
    const saved = retryRef.current.get(messageId) || { media, payload, viewOnce, replyId };
    retryRef.current.set(messageId, saved);
    setUploads((u) => ({ ...u, [messageId]: { pct: saved.fileKey ? 100 : 0 } }));
    try {
      if (!saved.fileKey) {
        const { fileKey } = await uploadEncrypted(path, media.blob, (pct) =>
          setUploads((u) => ({ ...u, [messageId]: { pct: Math.min(pct, 99) } }))
        );
        saved.fileKey = fileKey; // si falla al guardar, el reintento no vuelve a subir
      }
      const finalPayload: MessagePayload = {
        ...payload,
        media: { ...(payload.media as NonNullable<MessagePayload['media']>), key: saved.fileKey as string },
      };
      const encrypted = await encryptJSON(chatKey, finalPayload);
      const { error } = await supabase.from('messages').upsert(
        {
          id: messageId,
          chat_id: chatId,
          sender_id: user.id,
          kind: media.kind,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          media_path: path,
          view_once: viewOnce,
          reply_to: replyId,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (error) throw error;
      retryRef.current.delete(messageId);
      setUploads((u) => {
        const n = { ...u };
        delete n[messageId];
        return n;
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPending: false, payload: finalPayload } : m))
      );
    } catch (err) {
      console.error('[ChatDos] enviar archivo', err);
      setUploads((u) => ({ ...u, [messageId]: { pct: 0, failed: true } }));
    }
  };

  const sendMedia = (media: PendingMedia, caption: string, viewOnce: boolean) => {
    if (!user || !chatId || !chatKey) return;
    const messageId = crypto.randomUUID();
    const sentAt = Date.now();
    const replying = replyTo;
    const payload: MessagePayload = {
      v: 1,
      sentAt,
      ...(caption && !viewOnce ? { text: caption } : {}),
      ...(replying
        ? { replyPreview: { senderId: replying.sender_id, text: shortText(replying), kind: replying.kind } }
        : {}),
      media: {
        key: '',
        mime: media.mime,
        size: media.blob.size,
        width: media.width,
        height: media.height,
        duration: media.duration,
        // En "ver una vez" no va miniatura (se vería la foto sin abrirla)
        thumb: viewOnce ? undefined : media.thumb,
        name: media.name,
        music: media.music,
      },
    };
    // Quien envía ve su propio archivo sin bajarlo (excepto "ver una vez")
    if (!viewOnce) cacheLocalUrl(messageId, media.blob);
    const optimistic: DecryptedMessage = {
      id: messageId,
      chat_id: chatId,
      sender_id: user.id,
      kind: media.kind,
      ciphertext: '',
      iv: '',
      media_path: mediaPath(chatId, user.id, messageId),
      reply_to: replying ? replying.id : null,
      view_once: viewOnce,
      created_at: new Date(sentAt).toISOString(),
      edited_at: null,
      deleted_for_all: false,
      delivered_at: null,
      read_at: null,
      viewed_at: null,
      payload,
      isPending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyTo(null);
    setPendingMedia(null);
    scrollToBottom();
    uploadAndSave(messageId, media, payload, viewOnce, replying ? replying.id : null);
  };

  const retryUpload = (messageId: string) => {
    const saved = retryRef.current.get(messageId);
    if (saved) uploadAndSave(messageId, saved.media, saved.payload, saved.viewOnce, saved.replyId);
  };

  // ----- Notas de voz -----
  const startRecording = async () => {
    if (recording) return;
    const rec = new VoiceRecorder();
    try {
      await rec.start();
    } catch (err) {
      console.error('[ChatDos] micrófono', err);
      setToast('No se pudo usar el micrófono. Revisa el permiso en los ajustes del navegador.');
      return;
    }
    recorderRef.current = rec;
    setRecordViewOnce(false);
    setRecordSeconds(0);
    setRecording(true);
  };

  const cancelRecording = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
  };

  const finishRecording = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    setRecording(false);
    const { blob, mime, duration } = await rec.stop();
    if (duration < 1 || blob.size < 1000) {
      setToast('El audio es muy corto');
      return;
    }
    sendMedia({ kind: 'audio', blob, mime, duration, music: false }, '', recordViewOnce);
  };

  // Reloj de la grabación y corte automático a los 5 minutos
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const s = recorderRef.current?.elapsed() || 0;
      setRecordSeconds(s);
      if (s >= MAX_AUDIO_SECONDS) finishRecording();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // Si se sale del chat grabando, se apaga el micrófono
  useEffect(() => () => recorderRef.current?.cancel(), []);

  // ----- Ver una vez -----
  const openViewOnce = async (msg: DecryptedMessage) => {
    const media = msg.payload?.media;
    if (!media?.key || !msg.media_path) return;
    setViewer({ kind: msg.kind as 'image' | 'video' | 'audio', viewOnceMsg: msg, loading: true });
    try {
      const url = await downloadDecrypted(msg.id, msg.media_path, media.key, media.mime, false);
      setViewer({ url, kind: msg.kind as 'image' | 'video' | 'audio', viewOnceMsg: msg });
    } catch {
      setViewer(null);
      setToast('Este archivo ya no está disponible');
    }
  };

  const closeViewer = async () => {
    const v = viewer;
    setViewer(null);
    if (!v?.viewOnceMsg) return;
    if (v.url) URL.revokeObjectURL(v.url);
    const msg = v.viewOnceMsg;
    // Marcar como visto y borrar el archivo para siempre
    const { data: path, error } = await supabase.rpc('mark_viewed_once', { p_message: msg.id });
    if (error) {
      console.error('[ChatDos] mark_viewed_once', error);
    }
    const toRemove = (path as string | null) || msg.media_path;
    if (toRemove) {
      const { error: rmErr } = await supabase.storage.from('media').remove([toRemove]);
      if (rmErr) console.error('[ChatDos] borrar ver una vez', rmErr);
    }
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, viewed_at: new Date().toISOString() } : m)));
  };

  // Ir al mensaje original de una cita
  const goToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) {
      setToast('El mensaje original no está cargado. Sube y toca "Cargar mensajes anteriores".');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1600);
  };

  // Abrir modal de Número de Seguridad
  const handleOpenSecurityModal = async () => {
    if (!partner?.public_key || !myProfile?.public_key) {
      setShowSecurityModal(true);
      return;
    }

    setCalculatingSecurity(true);
    setShowSecurityModal(true);
    try {
      const num = await computeSecurityNumber(
        myProfile.public_key as JsonWebKey,
        partner.public_key as JsonWebKey
      );
      setSecurityNumber(num);
    } catch (err) {
      console.error('[ChatDos] Error calculando número de seguridad:', err);
    } finally {
      setCalculatingSecurity(false);
    }
  };

  const renderHeaderStatus = () => {
    if (isPartnerTyping) {
      return (
        <span className="text-white text-xs font-['Inter'] font-semibold animate-pulse">
          escribiendo...
        </span>
      );
    }
    if (isPartnerOnline) {
      return (
        <span className="text-white/95 text-xs font-['Inter'] font-medium">
          en línea
        </span>
      );
    }
    if (partner?.last_seen) {
      return (
        <span className="text-white/75 text-[11px] font-['Inter'] truncate">
          {formatLastSeen(partner.last_seen)}
        </span>
      );
    }
    return null;
  };

  if (loadingPartner) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-12 text-[#5B6670] dark:text-[#E3E7EC]">
        <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
        <p className="text-xs font-['Inter']">Cargando conversación...</p>
      </div>
    );
  }

  if (errorMsg || !partner) {
    return (
      <div className="p-4 bg-white dark:bg-[#253240] rounded-[5px] text-center border border-[#E3E7EC] dark:border-[#003A73] m-4">
        <p className="text-sm font-['Inter'] text-[#B03030]">
          {errorMsg || 'No se pudo cargar esta conversación.'}
        </p>
        {isAdmin && (
          <button
            onClick={() => navigate('/chats')}
            className="mt-3 px-4 py-2 rounded-[5px] bg-[#005198] text-white text-xs font-['Poppins'] font-semibold"
          >
            Volver a Chats
          </button>
        )}
      </div>
    );
  }

  const partnerName = partner.display_name || partner.username;
  const hasPartnerKey = !!partner.public_key;
  const hasInputText = inputText.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full relative overflow-hidden bg-[#F2F4F7] dark:bg-[#1F2933]">
      {/* 4. UNA SOLA CABECERA EN EL CHAT (fondo #003A73 con foto, nombre, estado, llave y menú) */}
      <header
        className="bg-[#003A73] text-white px-3 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.12)] shrink-0 z-30"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Flecha para volver (SOLO si soy administrador) */}
          {isAdmin && (
            <button
              onClick={() => navigate('/chats')}
              className="p-1.5 -ml-1 text-white hover:bg-white/10 rounded-[5px] transition-colors shrink-0"
              title="Volver a la lista de chats"
              aria-label="Volver"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={2} />
            </button>
          )}

          <div
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none"
            onClick={handleOpenSecurityModal}
            title="Toca para ver el Número de Seguridad"
          >
            <AvatarImage
              avatarPath={partner.avatar_path}
              name={partnerName}
              size={38}
            />

            <div className="min-w-0 flex-1">
              <h1 className="font-['Poppins'] font-semibold text-sm text-white truncate leading-tight flex items-center gap-1.5">
                <span>{partnerName}</span>
                {hasPartnerKey && (
                  <ShieldCheck className="w-3.5 h-3.5 text-white/90 shrink-0" strokeWidth={2} />
                )}
              </h1>
              <div className="h-4 flex items-center">
                {renderHeaderStatus()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Botón de Llave para ver el Número de Seguridad */}
          <button
            onClick={handleOpenSecurityModal}
            className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-[5px] transition-colors"
            title="Ver Número de Seguridad E2EE"
            aria-label="Número de Seguridad"
          >
            <KeyRound className="w-5 h-5" strokeWidth={2} />
          </button>

          {/* Menú de tres puntos */}
          <div className="relative" ref={headerMenuRef}>
            <button
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-[5px] transition-colors"
              title="Opciones"
              aria-label="Menú de opciones"
            >
              <MoreVertical className="w-5 h-5" strokeWidth={2} />
            </button>

            {headerMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.18)] border border-[#E3E7EC] dark:border-[#003A73] py-1 z-50 animate-in fade-in duration-100">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        navigate('/chats');
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                      <span>Mis Chats</span>
                    </button>
                    <div className="my-1 border-t border-[#E3E7EC] dark:border-[#003A73]" />
                  </>
                )}

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    navigate('/perfil');
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  <User className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  <span>Mi Perfil</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    navigate('/ajustes');
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  <span>Ajustes</span>
                </button>

                <div className="my-1 border-t border-[#E3E7EC] dark:border-[#003A73]" />

                <button
                  onClick={async () => {
                    setHeaderMenuOpen(false);
                    await signOut();
                    navigate('/login');
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#B03030] hover:bg-[#FDEBD3]/40 flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-[#B03030]" strokeWidth={2} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Alerta si la llave de la otra persona cambió */}
      {keyChangedAlert && (
        <div className="p-2.5 bg-[#FDEBD3] text-[#8A4B00] text-xs font-['Inter'] flex items-start gap-2 leading-relaxed shrink-0">
          <ShieldAlert className="w-4 h-4 text-[#8A4B00] shrink-0 mt-0.5" strokeWidth={2} />
          <div className="flex-1">
            <strong>Aviso de seguridad:</strong> La llave pública de {partnerName} ha cambiado.
            Puedes verificar el número de seguridad en persona.
          </div>
        </div>
      )}

      {/* Si la otra persona no tiene llave todavía */}
      {!hasPartnerKey ? (
        <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 text-center">
          <div className="max-w-xs p-5 rounded-[5px] bg-white dark:bg-[#253240] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E3E7EC] dark:border-[#003A73] space-y-3">
            <div className="w-12 h-12 rounded-[5px] bg-[#FDEBD3] flex items-center justify-center mx-auto text-[#8A4B00]">
              <Clock className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="font-['Poppins'] font-semibold text-sm text-[#003A73] dark:text-white">
              Esperando a {partnerName}
            </h3>
            <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] leading-relaxed">
              Esperando a que <strong>{partnerName}</strong> entre por primera vez para activar el cifrado.
            </p>
          </div>
        </div>
      ) : (
        /* Contenedor de mensajes con scroll */
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-1 pb-3 flex flex-col"
        >
          {hasMoreOlder && (
            <div className="text-center py-2">
              <button
                onClick={loadOlderMessages}
                disabled={loadingOlder}
                className="px-3 py-1 bg-white dark:bg-[#253240] text-xs font-['Poppins'] font-medium text-[#005198] dark:text-[#E3E7EC] rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] shadow-xs hover:bg-[#F2F4F7] transition-colors"
              >
                {loadingOlder ? 'Cargando anteriores...' : 'Cargar mensajes anteriores'}
              </button>
            </div>
          )}

          {loadingMessages ? (
            <div className="flex-1 flex flex-col justify-center items-center text-[#5B6670] dark:text-[#E3E7EC]">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
              <p className="text-xs font-['Inter']">Descifrando mensajes...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-[#5B6670] dark:text-[#E3E7EC]">
              <p className="text-xs font-['Inter'] bg-white dark:bg-[#253240] px-4 py-2 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] shadow-xs">
                No hay mensajes aún. ¡Envía el primer mensaje cifrado a {partnerName}!
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMine = msg.sender_id === user?.id;

              const currentMsgDate = formatMessageDateSeparator(
                msg.payload?.sentAt || msg.created_at
              );
              const prevMsgDate =
                index > 0
                  ? formatMessageDateSeparator(
                      messages[index - 1].payload?.sentAt || messages[index - 1].created_at
                    )
                  : null;

              const showDateSeparator = currentMsgDate !== prevMsgDate;
              // Mensajes seguidos de la misma persona van juntos (sin colita y con poco espacio)
              const isFirstInGroup =
                index === 0 || showDateSeparator || messages[index - 1].sender_id !== msg.sender_id;

              return (
                <React.Fragment key={msg.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-2 select-none">
                      <span className="px-3 py-1 rounded-[5px] bg-[#E3E7EC] dark:bg-[#253240] text-[11px] font-['Poppins'] font-medium text-[#5B6670] dark:text-[#E3E7EC] shadow-xs">
                        {currentMsgDate}
                      </span>
                    </div>
                  )}

                  <MessageItem
                    message={msg}
                    isMine={isMine}
                    myId={user?.id || ''}
                    partnerName={partnerName}
                    reactions={reactions[msg.id] || []}
                    highlighted={highlightId === msg.id}
                    isFirstInGroup={isFirstInGroup}
                    onOpenActions={setActionMsg}
                    onSwipeReply={startReply}
                    media={
                      msg.kind !== 'text' && !msg.deleted_for_all && !msg.decryptionError ? (
                        <MessageMedia
                          message={msg}
                          isMine={isMine}
                          upload={uploads[msg.id]}
                          onRetry={retryUpload}
                          onOpenMedia={(url, kind) => setViewer({ url, kind })}
                          onOpenViewOnce={openViewOnce}
                        />
                      ) : undefined
                    }
                    onQuoteClick={goToMessage}
                    onReactionClick={toggleReaction}
                  />
                </React.Fragment>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Selector de emojis popover */}
      {showEmojiPicker && (
        <EmojiPickerPopover
          onSelectEmoji={(emoji) => {
            setInputText((prev) => {
              if (prev.length + emoji.length <= 4000) {
                return prev + emoji;
              }
              return prev;
            });
            textareaRef.current?.focus();
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* 5. Barra inferior de entrada de texto */}
      <div
        className="px-2 pt-2 bg-[#F2F4F7] dark:bg-[#1F2933] border-t border-[#E3E7EC] dark:border-[#003A73] shrink-0"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {(replyTo || editingMsg) && (
          <div className="flex items-center gap-2 mb-1.5 px-3 py-2 bg-white dark:bg-[#253240] rounded-[5px] border-l-[3px] border-[#005198] dark:border-[#E3E7EC] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            {editingMsg ? (
              <Pencil className="w-4 h-4 shrink-0 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
            ) : (
              <Reply className="w-4 h-4 shrink-0 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
            )}
            <div className="flex-1 min-w-0">
              <span className="block text-[11px] font-['Poppins'] font-semibold text-[#005198] dark:text-white">
                {editingMsg
                  ? 'Editando mensaje'
                  : `Respondiendo a ${replyTo?.sender_id === user?.id ? 'ti' : partnerName}`}
              </span>
              <span className="block text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] truncate">
                {shortText((editingMsg || replyTo) as DecryptedMessage)}
              </span>
            </div>
            <button
              type="button"
              onClick={cancelEditOrReply}
              className="w-8 h-8 flex items-center justify-center shrink-0 text-[#5B6670] dark:text-[#E3E7EC]"
              aria-label="Cancelar"
              title="Cancelar"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white dark:bg-[#253240] p-1.5 rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          {recording ? (
            <>
              {/* Grabando nota de voz */}
              <button
                type="button"
                onClick={cancelRecording}
                className="w-11 h-11 shrink-0 flex items-center justify-center text-[#B03030] dark:text-[#FDEBD3] rounded-[5px]"
                title="Descartar audio"
                aria-label="Descartar audio"
              >
                <Trash2 className="w-5 h-5" strokeWidth={2} />
              </button>
              <div className="flex-1 flex items-center gap-2 px-1 min-h-11 text-sm font-['Inter'] text-[#1F2933] dark:text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D64545] animate-pulse shrink-0" aria-hidden="true" />
                <span className="tabular-nums">{formatDuration(recordSeconds)}</span>
                <span className="text-xs text-[#5B6670] dark:text-[#E3E7EC] truncate">Grabando · máx. 5 min</span>
              </div>
              <button
                type="button"
                onClick={() => setRecordViewOnce((v) => !v)}
                className={`w-11 h-11 shrink-0 flex flex-col items-center justify-center rounded-[5px] border ${
                  recordViewOnce
                    ? 'border-[#005198] text-[#005198] dark:border-white dark:text-white'
                    : 'border-transparent text-[#5B6670] dark:text-[#E3E7EC]'
                }`}
                aria-pressed={recordViewOnce}
                title="Escuchar una sola vez"
              >
                {recordViewOnce ? <Eye className="w-4 h-4" strokeWidth={2} /> : <EyeOff className="w-4 h-4" strokeWidth={2} />}
                <span className="text-[9px] font-['Inter'] font-semibold leading-none mt-0.5">1 vez</span>
              </button>
            </>
          ) : (
            <>
              {/* Botón de emojis */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-[#5B6670] hover:text-[#005198] dark:text-[#E3E7EC] dark:hover:text-white rounded-[5px] transition-colors shrink-0"
                title="Insertar emoji"
                aria-label="Selector de emojis"
              >
                <Smile className="w-5 h-5" strokeWidth={2} />
              </button>

              {/* Campo de texto que crece hasta 5 líneas */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (isNearBottom()) setTimeout(scrollToBottom, 300);
                }}
                placeholder={
                  hasPartnerKey
                    ? 'Escribe un mensaje...'
                    : 'Esperando a que la otra persona active su llave...'
                }
                disabled={!hasPartnerKey}
                className="flex-1 max-h-28 py-1.5 px-2 bg-transparent text-[16px] md:text-sm font-['Inter'] text-[#1F2933] dark:text-white placeholder-[#5B6670] dark:placeholder-[#E3E7EC] resize-none focus:outline-none"
              />

              {/* Adjuntar foto, video o audio */}
              {!editingMsg && (
                <button
                  type="button"
                  onClick={() => setAttachOpen(true)}
                  disabled={!hasPartnerKey || preparing}
                  className="p-2 text-[#5B6670] hover:text-[#005198] dark:text-[#E3E7EC] dark:hover:text-white rounded-[5px] transition-colors shrink-0 disabled:opacity-50"
                  title="Adjuntar"
                  aria-label="Adjuntar foto, video o audio"
                >
                  {preparing ? <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={2} /> : <Paperclip className="w-5 h-5" strokeWidth={2} />}
                </button>
              )}
            </>
          )}

          {/* Botón principal (el único naranja):
              con texto = enviar; sin texto = grabar nota de voz; grabando = enviar el audio */}
          {(() => {
            const canUse = hasPartnerKey;
            const mode = recording ? 'sendAudio' : hasInputText || editingMsg ? 'send' : 'mic';
            const label =
              mode === 'sendAudio' ? 'Enviar audio' : mode === 'mic' ? 'Grabar nota de voz' : editingMsg ? 'Guardar cambios' : 'Enviar mensaje';
            return (
              <button
                type="button"
                onClick={mode === 'sendAudio' ? finishRecording : mode === 'mic' ? startRecording : handleSendMessage}
                disabled={!canUse || (mode === 'send' && !hasInputText)}
                className={`w-11 h-11 rounded-[5px] flex items-center justify-center shrink-0 transition-all ${
                  canUse && (mode !== 'send' || hasInputText)
                    ? 'bg-[#F28C1B] text-[#1F2933] shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:brightness-105 active:scale-95 cursor-pointer'
                    : 'bg-[#E3E7EC] dark:bg-[#1F2933] text-[#5B6670] cursor-not-allowed'
                }`}
                title={label}
                aria-label={label}
              >
                {mode === 'mic' ? <Mic className="w-5 h-5" strokeWidth={2} /> : <Send className="w-5 h-5" strokeWidth={2} />}
              </button>
            );
          })()}
        </div>

        {/* Selectores de archivos (escondidos) */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files?.[0], true);
            e.target.value = '';
          }}
        />
      </div>

      {attachOpen && (
        <AttachSheet
          onClose={() => setAttachOpen(false)}
          onGallery={() => galleryInputRef.current?.click()}
          onCamera={() => cameraInputRef.current?.click()}
          onAudioFile={() => audioInputRef.current?.click()}
        />
      )}

      {pendingMedia && (
        <MediaComposer
          media={pendingMedia}
          onCancel={() => setPendingMedia(null)}
          onSend={({ caption, viewOnce }) => sendMedia(pendingMedia, caption, viewOnce)}
        />
      )}

      {viewer && (
        <MediaViewer
          url={viewer.url}
          kind={viewer.kind}
          viewOnce={!!viewer.viewOnceMsg}
          loading={viewer.loading}
          onClose={closeViewer}
        />
      )}

      {/* Menú de acciones de un mensaje */}
      {actionMsg && (
        <MessageActionsSheet
          message={actionMsg}
          isMine={actionMsg.sender_id === user?.id}
          myReaction={myReactionFor(actionMsg.id)}
          onClose={() => setActionMsg(null)}
          onReact={(emoji) => toggleReaction(actionMsg, emoji)}
          onMoreReactions={() => {
            setReactionPickerFor(actionMsg);
            setActionMsg(null);
          }}
          onReply={() => startReply(actionMsg)}
          onCopy={() => copyText(actionMsg)}
          onEdit={() => startEdit(actionMsg)}
          onDeleteForMe={() => deleteForMe(actionMsg)}
          onDeleteForAll={() => {
            setConfirmDeleteAll(actionMsg);
            setActionMsg(null);
          }}
        />
      )}

      {/* Todos los emojis para reaccionar */}
      {reactionPickerFor && (
        <EmojiPickerPopover
          onSelectEmoji={(emoji) => toggleReaction(reactionPickerFor, emoji)}
          onClose={() => setReactionPickerFor(null)}
        />
      )}

      {/* Confirmar "Eliminar para todos" */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDeleteAll(null)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white mb-2">
              ¿Eliminar para todos?
            </h3>
            <p className="text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-5">
              El mensaje se borrará también para {partnerName}. En el chat quedará el aviso "Se eliminó este mensaje".
              No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(null)}
                className="h-10 px-4 rounded-[5px] font-['Poppins'] font-semibold text-sm text-[#005198] dark:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteForAll(confirmDeleteAll)}
                className="h-10 px-4 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso corto */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[90%] px-4 py-2 rounded-[5px] bg-[#1F2933] text-white text-xs font-['Inter'] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          {toast}
        </div>
      )}

      {/* Modal para verificar el Número de Seguridad */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[5px] bg-white dark:bg-[#253240] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-[#E3E7EC] dark:border-[#003A73] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E7EC] dark:border-[#003A73]">
              <div className="flex items-center gap-2 text-[#003A73] dark:text-white">
                <KeyRound className="w-5 h-5 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                <h3 className="font-['Poppins'] font-bold text-sm">
                  Número de Seguridad
                </h3>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-[#5B6670] hover:text-[#1F2933] dark:hover:text-white"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {!hasPartnerKey ? (
              <p className="text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] leading-relaxed">
                {partnerName} aún no ha iniciado sesión por primera vez para generar su llave de cifrado.
              </p>
            ) : calculatingSecurity ? (
              <div className="py-6 flex flex-col items-center justify-center text-[#5B6670] dark:text-[#E3E7EC]">
                <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                <span className="text-xs font-['Inter']">Calculando huella SHA-256 simétrica...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] leading-relaxed">
                  Compara este número de 60 dígitos en persona con <strong>{partnerName}</strong>.
                  Si ambos ven los mismos dígitos, la conversación está blindada:
                </p>

                <div className="p-3 bg-[#F2F4F7] dark:bg-[#1F2933] rounded-[5px] border border-[#C9CFD6] dark:border-[#003A73] select-all">
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs font-bold text-[#003A73] dark:text-[#E3E7EC] tracking-wider">
                    {securityNumber?.split(' ').map((grp, idx) => (
                      <span key={idx} className="py-0.5 bg-white dark:bg-[#253240] rounded-[2px] shadow-xs">
                        {grp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSecurityModal(false)}
              className="w-full h-10 rounded-[5px] bg-[#005198] text-white font-['Poppins'] font-semibold text-xs hover:bg-[#003A73] transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
