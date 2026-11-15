import React, { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react';
import { claveLlave, memoria } from '../lib/memoria';
import { useParams, useNavigate } from 'react-router-dom';
import { useAtras } from '../lib/atras';
import {
  ChevronLeft,
  Send,
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
  Mic,
  Pause,
  Trash2,
  Copy,
  Forward,
  Images,
  Bell,
  BellOff,
  Keyboard,
  Lock,
  ChevronUp,
  ChevronLeft as FlechaIzq,
  Eraser,
  Wallpaper,
  ChevronDown,
  Search,
  Timer,
  Phone,
  Video,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  guardarChat,
  guardarMensajes,
  borrarMensajesLocalesExcepto,
  borrarMensajeLocal,
  leerBandeja,
  leerChat,
  leerMensajes,
  ponerEnBandeja,
  quitarDeBandeja,
  type Pendiente,
} from '../lib/offline';
import { avisarSelectorArchivo } from '../lib/bloqueo';
import { CamaraChat, duracionGrabada } from '../components/CamaraChat';
import { EnviarContacto, EnviarUbicacion } from '../components/UbicacionYContacto';
import { pedirVistaPrevia, primerEnlace, type VistaEnlace } from '../lib/enlaces';
import { VistaPreviaEscribiendo } from '../components/TarjetaEnlace';
import { cargarUbicacionesVivo, compartir, dejarDeCompartir, retomarEnChat, useCompartiendoEn } from '../lib/ubicacionVivo';
import { IconoCamara, IconoClip, IconoStickerCara, IconoVerUnaVez, IconoVerUnaVezActivo } from '../components/Iconos';
import OndaEnVivo, { TiempoGrabacion } from '../components/OndaEnVivo';
import VistaPreviaGrabacion from '../components/VistaPreviaGrabacion';
import { AlbumMosaico, AlbumCompleto } from '../components/Album';
import { Galeria } from '../components/Galeria';
import { MultimediaChat } from '../components/MultimediaChat';
import { ReenviarA, type DestinoReenvio } from '../components/ReenviarA';
import { enviarAChat } from '../lib/envioDirecto';
import { dejarReenvio, tomarReenvio, type ItemReenvio } from '../lib/reenvio';
import { PanelExpresiones, type PestanaExpresiones } from '../components/PanelExpresiones';
import { FotoPerfilVisor } from '../components/FotoPerfilVisor';
import { FondoChat } from '../components/FondoChat';
import { BuscarEnChat } from '../components/BuscarEnChat';
import { MensajeFijado } from '../components/MensajeFijado';
import { InfoMensaje } from '../components/InfoMensaje';
import { TemporalesModal } from '../components/TemporalesModal';
import { borrarVencidos, estaVencido, fijarMensaje, leerAjustesChat, nombreDuracion, ponerTemporales, type AjustesChat } from '../lib/ajustesChat';
import { iniciarLlamada, type TipoLlamada } from '../lib/llamadas';
import { hayFondo, useFondo } from '../lib/fondo';
import { CapaFondo } from '../components/CapaFondo';
import { useTheme } from '../context/ThemeContext';
import { conectarEnLinea, useEnLinea } from '../lib/enLinea';
import { cargarNotas, escucharNotas, useNotaDelChat } from '../lib/notas';
import { StickerEditor } from '../components/StickerEditor';
import { agregarSticker, blobSticker, marcarUsado, type Sticker } from '../lib/stickers';
import { OPCIONES_SILENCIO, estaSilenciado, guardarSilencio, leerSilencio, textoSilencio } from '../lib/mute';
import { clearChatNotifications, notifyPartner, playIncoming, updateBadge } from '../lib/push';
import { useAuth } from '../context/AuthContext';
import { AvatarImage } from '../components/AvatarImage';
import { MessageItemMemo } from '../components/MessageItem';

// Lista vacía fija (una nueva en cada dibujo haría redibujar todas las burbujas)
const SIN_REACCIONES: Reaction[] = [];

// Cada objeto de mensaje recibe un número; cambia cuando el mensaje se reemplaza (se actualizó).
// Sirve para saber si una foto de un álbum cambió sin comparar todo el mensaje.
const versiones = new WeakMap<DecryptedMessage, number>();
let ultimaVersion = 0;
const numeroDe = (m: DecryptedMessage) => {
  let n = versiones.get(m);
  if (n === undefined) {
    n = ++ultimaVersion;
    versiones.set(m, n);
  }
  return n;
};
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
  getCachedUrl,
  formatDuration,
  olvidarArchivoGuardado,
  descargarArchivo,
  nombreDescarga,
} from '../lib/media';
import {
  getLocalPrivateKey,
  getChatKey,
  encryptJSON,
  decryptJSONConRespaldo,
  llavesAnterioresDelChat,
  computeSecurityNumber,
  checkPartnerKeyChange,
  aceptarLlaveNueva,
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
  if (m.payload?.ubicacion) return '📍 Ubicación';
  if (m.payload?.contacto) return `👤 ${m.payload.contacto.nombre}`;
  if (m.kind === 'image') return m.payload?.media?.sticker ? 'Sticker' : 'Foto';
  if (m.kind === 'video') return 'Video';
  if (m.kind === 'audio') return 'Audio';
  return 'Mensaje';
};

// Burbujas grises mientras llegan los mensajes la primera vez (en lugar de "Cargando...")
const BurbujasDeRelleno: React.FC = () => (
  <div className="flex-1 flex flex-col justify-end gap-2 p-4" aria-hidden="true">
    {['w-2/5 self-start', 'w-1/2 self-end', 'w-1/3 self-end', 'w-3/5 self-start', 'w-2/5 self-end'].map((c, i) => (
      <div key={i} className={`h-9 rounded-[8px] bg-[#E3E7EC] dark:bg-[#253240] animate-pulse ${c}`} />
    ))}
  </div>
);

export const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user, profile: myProfile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  // Información del compañero de chat
  // Lo que ya se cargó antes se muestra al instante (como una app instalada)
  const companeroMem = chatId ? memoria.companeros.get(chatId) ?? null : null;
  const mensajesMem = chatId ? memoria.mensajes.get(chatId) ?? null : null;
  const [partner, setPartner] = useState<Profile | null>(companeroMem);
  const [loadingPartner, setLoadingPartner] = useState(!companeroMem);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Llave criptográfica del chat
  const llavesViejasRef = useRef<CryptoKey[]>([]);
  const [chatKey, setChatKey] = useState<CryptoKey | null>(() =>
    chatId && companeroMem?.public_key ? memoria.llaves.get(claveLlave(chatId, companeroMem.public_key)) ?? null : null
  );

  // Mensajes y paginación
  const [messages, setMessages] = useState<DecryptedMessage[]>(mensajesMem ?? []);
  const [loadingMessages, setLoadingMessages] = useState(!mensajesMem);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Presencia y estado en tiempo real
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  // En línea = tiene la app abierta (o está dentro de este chat)
  const enLineaGlobal = useEnLinea(partner?.id);
  const partnerEnLinea = isPartnerOnline || enLineaGlobal;
  const [verFotoPerfil, setVerFotoPerfil] = useState(false);
  const [vaciarOpen, setVaciarOpen] = useState(false);
  const limpiarPantallaRef = useRef<() => void>(() => {});
  const [vaciando, setVaciando] = useState(false);
  const fondoChat = useFondo();
  const imagenFondo = hayFondo(fondoChat);
  const { resolvedTheme } = useTheme();
  const [fondoOpen, setFondoOpen] = useState(false);
  // Nota de la otra persona (burbujita junto a su foto; se esconde al subir a leer)
  const notaPartner = useNotaDelChat(chatId);
  const [alFinal, setAlFinal] = useState(true);
  const alFinalRef = useRef(true);
  alFinalRef.current = alFinal;
  // Mensajes nuevos que llegaron mientras se leía más arriba (botón para bajar)
  const [nuevosAbajo, setNuevosAbajo] = useState(0);
  // Primer mensaje sin leer al abrir el chat (línea "mensajes nuevos")
  const [primerNoLeido, setPrimerNoLeido] = useState<{ id: string; n: number } | null>(null);
  const noLeidoCalculado = useRef<string | null>(null);
  // Buscar, fijar, temporales, info
  const [busqueda, setBusqueda] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<AjustesChat>({ fijado: null, temporales: 0 });
  const [temporalesOpen, setTemporalesOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<DecryptedMessage | null>(null);
  const [, setReloj] = useState(0); // para esconder los temporales cuando vencen
  const recargarAjustesRef = useRef<() => void>(() => {});
  const recargarAjustes = useCallback(() => {
    if (!chatId) return;
    leerAjustesChat(chatId).then((a) => a && setAjustes(a));
  }, [chatId]);
  useEffect(() => {
    if (!chatId) return;
    setAjustes({ fijado: null, temporales: 0 });
    setPrimerNoLeido(null);
    noLeidoCalculado.current = null;
    setNuevosAbajo(0);
    recargarAjustes();
    void borrarVencidos(chatId);
    const cada = setInterval(() => setReloj((x) => x + 1), 30000);
    return () => clearInterval(cada);
  }, [chatId, recargarAjustes]);
  recargarAjustesRef.current = recargarAjustes;

  // ----- Ubicación en tiempo real -----
  const compartiendo = useCompartiendoEn(chatId);
  const avisarUbicacion = useCallback(() => {
    activeChannelRef.current?.send({ type: 'broadcast', event: 'ubicacion', payload: {} }).catch(() => {});
  }, []);
  const recargarVivoRef = useRef<() => void>(() => {});
  recargarVivoRef.current = () => {
    if (chatId && chatKey) void cargarUbicacionesVivo(chatId, chatKey);
  };
  useEffect(() => {
    if (!chatId || !chatKey) return;
    void cargarUbicacionesVivo(chatId, chatKey);
    retomarEnChat(chatId, chatKey, avisarUbicacion);
  }, [chatId, chatKey, avisarUbicacion]);
  const hayVivoActivo = messages.some((m) => (m.payload?.ubicacion?.vivo?.hasta ?? 0) > Date.now());
  useEffect(() => {
    if (!hayVivoActivo) return;
    // Por si la otra persona comparte sin tener este chat abierto (no llega el aviso al instante)
    const t = setInterval(() => recargarVivoRef.current(), 20000);
    return () => clearInterval(t);
  }, [hayVivoActivo]);
  useEffect(() => {
    if (alFinal) setNuevosAbajo(0);
  }, [alFinal]);
  const partnerId = partner?.id;
  const partnerLlave = partner?.public_key ? JSON.stringify(partner.public_key) : '';
  useEffect(() => {
    if (!user || !chatId || !partnerId || !partnerLlave) return;
    const c = [{ chatId, partnerId, publica: JSON.parse(partnerLlave) }];
    cargarNotas(user.id, c);
    return escucharNotas(user.id, c);
  }, [user, chatId, partnerId, partnerLlave]);
  const cerrarFoto = useCallback(() => setVerFotoPerfil(false), []);
  useEffect(() => {
    if (user && chatId) conectarEnLinea(user.id, [chatId]);
  }, [user, chatId]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastTime = useRef<number>(0);

  // Menú de tres puntos de la cabecera
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Entrada de texto y emojis
  const [inputText, setInputText] = useState('');
  const [panel, setPanel] = useState<PestanaExpresiones | null>(null); // emojis / stickers (en lugar del teclado)
  const ultimaPestana = useRef<PestanaExpresiones>(
    (() => {
      try {
        return localStorage.getItem('chatdos:pestanaExpresiones') === 'emojis' ? 'emojis' : 'stickers';
      } catch {
        return 'stickers';
      }
    })()
  );
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
  // Stickers
  const [pegada, setPegada] = useState<Blob | null>(null); // imagen pegada en el campo de texto
  const [editorSticker, setEditorSticker] = useState<{ imagen: Blob; enviar: boolean } | null>(null);
  // Silenciar chat
  const [silencio, setSilencio] = useState<string | null>(null);
  const [silencioOpen, setSilencioOpen] = useState(false);
  const silencioRef = useRef<string | null>(null);
  silencioRef.current = silencio;
  const messageIdsRef = useRef<Set<string>>(new Set());

  // ETAPA 6: fotos, videos y audios
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[] | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [viewer, setViewer] = useState<{
    url?: string;
    kind: 'image' | 'video' | 'audio';
    viewOnceMsg?: DecryptedMessage;
    loading?: boolean;
  } | null>(null);
  // Carrusel de fotos y videos del chat (se fija la lista al abrirlo)
  const [galeria, setGaleria] = useState<{ items: DecryptedMessage[]; inicio: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordViewOnce, setRecordViewOnce] = useState(false);
  const [pausado, setPausado] = useState(false); // grabación con candado en pausa
  const [previa, setPrevia] = useState<{ blob: Blob; duracion: number } | null>(null); // escuchar lo grabado en pausa
  const recorderRef = useRef<VoiceRecorder | null>(null);
  // Mantener presionado para grabar (como WhatsApp): soltar = enviar, izquierda = cancelar, arriba = candado
  const [gesto, setGesto] = useState<'no' | 'mantener' | 'bloqueado'>('no');
  // Arrastre del dedo mientras se graba: va directo a variables CSS de la barra de abajo
  // (sin estado de React), para no volver a dibujar todo el chat en cada movimiento.
  const barraAbajoRef = useRef<HTMLDivElement>(null);
  const moverArrastre = (dx: number, dy: number) => {
    const b = barraAbajoRef.current;
    if (!b) return;
    b.style.setProperty('--dx', String(dx));
    b.style.setProperty('--dy', String(dy));
  };
  const pulsacion = useRef<{ id: number; x: number; y: number; t: number; soltado: boolean; cancelado?: boolean } | null>(null);
  const ignorarClick = useRef(false);
  const fotoVideoInputRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<Map<string, { media: PendingMedia; payload: MessagePayload; viewOnce: boolean; replyId: string | null; fileKey?: string }>>(new Map());
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const [camara, setCamara] = useState<null | 'foto' | 'video'>(null);
  const [albumAbierto, setAlbumAbierto] = useState<string | null>(null); // id del primer mensaje del álbum
  const [multimediaOpen, setMultimediaOpen] = useState(false); // fotos, audios y enlaces del chat
  const [enviarExtra, setEnviarExtra] = useState<null | 'ubicacion' | 'contacto'>(null);
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

  // Al cambiar de chat se limpia la pantalla (no se mezclan mensajes de otro chat)
  const chatAnteriorRef = useRef(chatId);
  useEffect(() => {
    if (chatAnteriorRef.current !== chatId) {
      chatAnteriorRef.current = chatId;
      const p = chatId ? memoria.companeros.get(chatId) ?? null : null;
      const m = chatId ? memoria.mensajes.get(chatId) ?? [] : [];
      setPartner(p);
      setLoadingPartner(!p);
      setMessages(m);
      setLoadingMessages(!m.length);
      setChatKey(chatId && p?.public_key ? memoria.llaves.get(claveLlave(chatId, p.public_key)) ?? null : null);
      primerScrollRef.current = false;
    }
  }, [chatId]);

  // Al abrir el chat se aparece directo en el último mensaje (sin verlo bajar)
  const primerScrollRef = useRef(false);
  useLayoutEffect(() => {
    if (primerScrollRef.current || !messages.length) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    primerScrollRef.current = true;
  }, [messages.length, loadingPartner]);

  // Recordar los mensajes de este chat para la próxima vez que se abra
  useEffect(() => {
    if (!chatId) return;
    const propios = messages.filter((m) => m.chat_id === chatId);
    if (propios.length) memoria.mensajes.set(chatId, propios.slice(-150));
  }, [messages, chatId]);

  // 1. Cargar compañero de chat y derivar la llave de chat
  useEffect(() => {
    if (!chatId || !user) return;

    let isMounted = true;

    let llaveDe: string | null = null;
    // Mostrar a la otra persona y preparar la llave del chat (sirve sin internet)
    const aplicarPartner = async (partnerProf: Profile) => {
      if (!isMounted) return;
      setPartner(partnerProf);
      memoria.companeros.set(chatId, partnerProf);
      if (!partnerProf.public_key) return;
      const pub = JSON.stringify(partnerProf.public_key);
      if (llaveDe === pub) return; // ya está la llave para esta misma llave pública
      llaveDe = pub;
      const hasChanged = await checkPartnerKeyChange(partnerProf.id, partnerProf.public_key as JsonWebKey);
      if (isMounted) setKeyChangedAlert(hasChanged);
      const myPrivateKey = await getLocalPrivateKey(user.id);
      if (myPrivateKey) {
        // Llaves viejas de la otra persona (si empezó de nuevo): para leer los mensajes de antes
        llavesViejasRef.current = await llavesAnterioresDelChat(chatId, myPrivateKey, partnerProf.llaves_anteriores, user.id, partnerProf.public_key).catch(() => []);
        const k = claveLlave(chatId, partnerProf.public_key);
        const derived = memoria.llaves.get(k) ?? (await getChatKey(chatId, myPrivateKey, partnerProf.public_key as JsonWebKey));
        memoria.llaves.set(k, derived);
        if (isMounted) setChatKey(derived);
      }
    };

    const initChat = async () => {
      setErrorMsg(null);
      const enMem = memoria.companeros.get(chatId);
      if (enMem) {
        await aplicarPartner(enMem); // al instante; luego se revisa con el servidor
      } else {
        setLoadingPartner(true);
      }
      const guardado = await leerChat(chatId);
      if (guardado) {
        await aplicarPartner(guardado.partner);
        if (isMounted) setLoadingPartner(false);
      }
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
        guardarChat(chatId, partnerProf);
        await aplicarPartner(partnerProf);
      } catch (err: unknown) {
        console.error('[ChatDos] Error al iniciar chat:', err);
        // Sin internet pero con copia local: se sigue usando el chat normal
        if (isMounted && !guardado) {
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

  // Bandeja de salida -> mensajes con relojito (los que aún no llegan al servidor)
  const pendientesComoMensajes = async (bandeja: Pendiente[], yaEstan: DecryptedMessage[]) => {
    const ids = new Set(yaEstan.map((m) => m.id));
    const out: DecryptedMessage[] = [];
    for (const p of bandeja) {
      if (ids.has(p.id)) {
        quitarDeBandeja(p.id); // el servidor ya lo tiene
        continue;
      }
      const base = {
        id: p.id,
        chat_id: p.chatId,
        sender_id: user?.id ?? '',
        created_at: new Date(p.creado).toISOString(),
        edited_at: null,
        deleted_for_all: false,
        delivered_at: null,
        read_at: null,
        viewed_at: null,
        isPending: true,
      };
      if (p.fila) {
        const d = await decryptSingleMessage({ ...(p.fila as unknown as DbMessage), ...base, media_path: null }, chatKey);
        out.push({ ...d, isPending: true });
      } else if (p.media) {
        const info = p.media.info as Omit<PendingMedia, 'blob'>;
        const media: PendingMedia = { ...info, blob: p.media.blob };
        const payload = p.media.payload as MessagePayload;
        if (!p.media.viewOnce) cacheLocalUrl(p.id, p.media.blob);
        // Sin internet se muestra con el botón de reintentar
        setUploads((u) => (u[p.id] ? u : { ...u, [p.id]: { pct: 0, failed: true } }));
        if (!retryRef.current.has(p.id)) {
          retryRef.current.set(p.id, { media, payload, viewOnce: p.media.viewOnce, replyId: p.media.replyId });
        }
        out.push({
          ...base,
          kind: info.kind,
          ciphertext: '',
          iv: '',
          media_path: user ? mediaPath(p.chatId, user.id, p.id) : null,
          reply_to: p.media.replyId,
          view_once: p.media.viewOnce,
          payload,
        });
      }
    }
    return out;
  };

  // Enviar lo que quedó en la bandeja (al abrir el chat y al volver el internet)
  const enviandoBandejaRef = useRef(false);
  const subiendoRef = useRef<Set<string>>(new Set()); // archivos que se están subiendo ahora
  const enviarBandeja = async () => {
    if (!chatId || enviandoBandejaRef.current || !navigator.onLine) return;
    enviandoBandejaRef.current = true;
    try {
      for (const p of await leerBandeja(chatId)) {
        // Lo recién enviado lo está mandando el envío normal: no se duplica
        if (Date.now() - p.creado < 10000 || subiendoRef.current.has(p.id)) continue;
        if (p.fila) {
          const { error } = await supabase.from('messages').upsert(p.fila, { onConflict: 'id', ignoreDuplicates: true });
          if (error) break; // sigue sin conexión: se intenta después
          await quitarDeBandeja(p.id);
          setMessages((prev) => prev.map((m) => (m.id === p.id ? { ...m, isPending: false } : m)));
          notifyPartner(p.id);
        } else if (p.media) {
          const saved = retryRef.current.get(p.id);
          if (saved) await uploadAndSave(p.id, saved.media, saved.payload, saved.viewOnce, saved.replyId);
        }
      }
    } finally {
      enviandoBandejaRef.current = false;
    }
  };
  const enviarBandejaRef = useRef(enviarBandeja);
  enviarBandejaRef.current = enviarBandeja;

  // Al volver el internet (o al volver a la app) se envía lo pendiente
  // y se vuelven a pedir los mensajes que pudieron llegar mientras tanto
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let ocultoDesde = 0;
    const alVolver = () => {
      enviarBandejaRef.current();
      setRecarga((n) => n + 1);
    };
    const alMostrar = () => {
      if (document.hidden) {
        ocultoDesde = Date.now();
        return;
      }
      if (ocultoDesde && Date.now() - ocultoDesde > 60000) alVolver();
      else enviarBandejaRef.current();
    };
    window.addEventListener('online', alVolver);
    document.addEventListener('visibilitychange', alMostrar);
    return () => {
      window.removeEventListener('online', alVolver);
      document.removeEventListener('visibilitychange', alMostrar);
    };
  }, []);

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
        const payload = await decryptJSONConRespaldo<MessagePayload>(key, llavesViejasRef.current, msg.ciphertext, msg.iv);
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
      // La ruedita solo si no hay nada que mostrar todavía
      if (!messagesRef.current.some((m) => m.chat_id === chatId)) setLoadingMessages(true);

      // 1) Primero lo guardado en el celular (aparece al instante, incluso sin internet)
      const [guardados, bandeja] = await Promise.all([leerMensajes(chatId), leerBandeja(chatId)]);
      if ((guardados.length || bandeja.length) && !messagesRef.current.some((m) => m.chat_id === chatId)) {
        const locales = await Promise.all(guardados.map((m) => decryptSingleMessage(m, chatKey)));
        const pendientes = await pendientesComoMensajes(bandeja, locales);
        if (isMounted) {
          setMessages([...locales, ...pendientes]);
          setLoadingMessages(false);
          scrollToBottom();
        }
      }

      // 2) Luego lo del servidor
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
        // Línea de "mensajes nuevos": el más viejo de la otra persona que todavía no había leído
        if (noLeidoCalculado.current !== chatId) {
          noLeidoCalculado.current = chatId;
          const sinLeer = rawList.filter((m) => m.sender_id !== user?.id && !m.read_at && !m.deleted_for_all);
          if (isMounted) setPrimerNoLeido(sinLeer.length ? { id: sinLeer[sinLeer.length - 1].id, n: sinLeer.length } : null);
        }
        if (rawList.length === 50) {
          if (isMounted) setHasMoreOlder(true);
        }
        // Lo que ya no está en el servidor (chat vaciado, borrado) se quita del celular
        borrarMensajesLocalesExcepto(
          chatId,
          new Set(rawList.map((m) => m.id)),
          rawList.length === 50 ? rawList[rawList.length - 1]?.created_at : undefined
        );
        guardarMensajes(rawList);

        const decryptedList = await Promise.all(
          rawList.map((m) => decryptSingleMessage(m, chatKey))
        );
        decryptedList.reverse();
        // Los que siguen en la bandeja de salida se muestran al final con el relojito
        const pendientes = await pendientesComoMensajes(await leerBandeja(chatId), decryptedList);

        if (isMounted) {
          // Se conservan los más viejos que ya estaban en pantalla (p. ej. al reconectar)
          const desde = decryptedList[0]?.created_at;
          const ids = new Set([...decryptedList, ...pendientes].map((m) => m.id));
          setMessages((prev) => [
            ...prev.filter(
              (m) => m.chat_id === chatId && !ids.has(m.id) && !m.isPending && !!desde && m.created_at < desde
            ),
            ...decryptedList,
            ...pendientes,
          ]);
          enviarBandeja();
          loadReactions(decryptedList.map((m) => m.id));
          // Al abrir el chat se marca como leído
          safeMarkRead(chatId);
        }
      } catch (err) {
        console.error('[ChatDos] Error al cargar mensajes iniciales:', err);
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
          // Si hay mensajes nuevos, se abre en la línea de "mensajes nuevos"; si no, al final
          setTimeout(() => {
            const linea = document.getElementById('linea-nuevos');
            if (linea) linea.scrollIntoView({ block: 'start' });
            else scrollToBottom();
          }, 120);
        }
      }
    };

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [chatId, chatKey, decryptSingleMessage, recarga]);

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
      guardarMensajes(rawList);

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

      // La otra persona vació el chat para los dos
      channel.on('broadcast', { event: 'chat_vaciado' }, () => {
        if (isMounted) limpiarPantallaRef.current();
      });

      // La otra persona fijó un mensaje o cambió los mensajes temporales
      channel.on('broadcast', { event: 'ajustes' }, () => {
        if (isMounted) recargarAjustesRef.current();
      });
      channel.on('broadcast', { event: 'ubicacion' }, () => {
        if (isMounted) recargarVivoRef.current();
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
          guardarMensajes([newDbMsg]);

          // Si es de la otra persona: marcar como entregado y como leído
          if (newDbMsg.sender_id !== user.id) {
            safeMarkDelivered();
            if (!document.hidden) {
              safeMarkRead(chatId);
              if (!estaSilenciado(silencioRef.current)) playIncoming('chat');
              setTimeout(updateBadge, 1500);
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

          // Si estoy leyendo más arriba, no me bajo: se cuenta en el botón de bajar
          if (newDbMsg.sender_id !== user.id && !alFinalRef.current) setNuevosAbajo((n) => n + 1);
          else scrollToBottom();
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
          guardarMensajes([updatedDbMsg]);
          console.log('[ChatDos] UPDATE en message checks:', updatedDbMsg.id, {
            delivered_at: updatedDbMsg.delivered_at,
            read_at: updatedDbMsg.read_at,
          });

          // Si se editó o se eliminó, hay que volver a descifrar el contenido
          const current = messagesRef.current.find((m) => m.id === updatedDbMsg.id);
          // Si lo eliminaron para todos, también se borra la copia del archivo en este celular
          if (updatedDbMsg.deleted_for_all && current?.media_path) olvidarArchivoGuardado(current.media_path);
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

  // Leer si este chat está silenciado
  useEffect(() => {
    if (!chatId) return;
    leerSilencio(chatId).then(setSilencio).catch(() => {});
  }, [chatId]);

  const cambiarSilencio = async (opcion: (typeof OPCIONES_SILENCIO)[number]['id'] | null) => {
    if (!chatId) return;
    setSilencioOpen(false);
    try {
      const hasta = await guardarSilencio(chatId, opcion);
      setSilencio(hasta);
      setToast(hasta ? textoSilencio(hasta) : 'Notificaciones activadas');
    } catch {
      setToast('No se pudo cambiar el silencio');
    }
  };

  // 5. Manejo de visibilidad y RPCs según contrato estricto
  useEffect(() => {
    if (!chatId) return;

    // Al abrir el chat
    safeMarkDelivered();
    safeMarkRead(chatId);
    safeTouchLastSeen();
    clearChatNotifications(chatId);

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
        clearChatNotifications(chatId);
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

  const colaEnvio = useRef<Promise<void>>(Promise.resolve());
  // ----- Vista previa del enlace que se está escribiendo -----
  const [vistaEnlace, setVistaEnlace] = useState<{ url: string; datos: VistaEnlace | null; cargando: boolean } | null>(null);
  const enlacesQuitados = useRef(new Set<string>());
  const enlaceEscrito = !editingMsg ? primerEnlace(inputText) : null;
  useEffect(() => {
    if (!enlaceEscrito || enlacesQuitados.current.has(enlaceEscrito)) {
      setVistaEnlace(null);
      return;
    }
    let vivo = true;
    setVistaEnlace((v) => (v?.url === enlaceEscrito ? v : { url: enlaceEscrito, datos: null, cargando: true }));
    const t = setTimeout(() => {
      pedirVistaPrevia(enlaceEscrito).then((datos) => {
        if (vivo) setVistaEnlace(datos ? { url: enlaceEscrito, datos, cargando: false } : null);
      });
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [enlaceEscrito]);

  // 6. Enviar mensaje cifrado (o guardar la edición)
  const handleSendMessage = async (
    especial?: Pick<MessagePayload, 'ubicacion' | 'contacto' | 'text' | 'enlace' | 'reenviado'>
  ) => {
    const textToSend = especial ? especial.text ?? '' : inputText.trim();
    if ((!textToSend && !especial) || !user || !chatId || !chatKey) return;

    if (editingMsg && !especial) {
      await saveEdit(editingMsg, textToSend);
      return;
    }

    const messageId = crypto.randomUUID();
    const sentAt = Date.now();
    const replying = especial?.reenviado ? null : replyTo; // lo reenviado no va como respuesta
    const replyPreview: ReplyPreview | undefined = replying
      ? { senderId: replying.sender_id, text: shortText(replying), kind: replying.kind }
      : undefined;

    const urlEnlace = !especial ? primerEnlace(textToSend) : null;
    const enlace = urlEnlace && vistaEnlace?.datos && vistaEnlace.url === urlEnlace ? vistaEnlace.datos : undefined;
    // Si la vista previa todavía no estaba lista, se espera un momento antes de subir el mensaje
    const esperarEnlace = !!urlEnlace && !enlace && !enlacesQuitados.current.has(urlEnlace);
    let payload: MessagePayload = {
      v: 1,
      ...(textToSend ? { text: textToSend } : {}),
      ...(especial ?? {}),
      ...(enlace ? { enlace } : {}),
      sentAt,
      ...(replyPreview ? { replyPreview } : {}),
    };

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
    setReplyTo(null);
    if (!especial) {
      setInputText('');
      setVistaEnlace(null);
      setPanel(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
    scrollToBottom();

    // Los mensajes salen en orden aunque uno espere su vista previa
    const turno = colaEnvio.current;
    let soltar: () => void = () => {};
    colaEnvio.current = new Promise<void>((r) => (soltar = r));
    try {
      if (esperarEnlace && urlEnlace) {
        const datos = await Promise.race([
          pedirVistaPrevia(urlEnlace),
          new Promise<null>((r) => setTimeout(() => r(null), 7000)),
        ]);
        if (datos) {
          payload = { ...payload, enlace: datos };
          const conEnlace = payload;
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, payload: conEnlace } : m)));
        }
      }
      await turno;
      const encrypted = await encryptJSON(chatKey, payload);
      const fila = {
        id: messageId,
        chat_id: chatId,
        sender_id: user.id,
        kind: 'text',
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        view_once: false,
        reply_to: replying ? replying.id : null,
      };
      // Queda guardado en el celular hasta que el servidor lo reciba
      await ponerEnBandeja({ id: messageId, chatId, creado: sentAt, fila });

      const { error } = await supabase.from('messages').upsert(fila, { onConflict: 'id', ignoreDuplicates: true });

      if (error) {
        console.error('[ChatDos] error al enviar mensaje:', error);
        throw error;
      }
      quitarDeBandeja(messageId);

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPending: false } : m))
      );
      notifyPartner(messageId);
      soltar();
      return messageId;
    } catch (err) {
      soltar();
      console.error('[ChatDos] Error en handleSendMessage:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPending: true } : m))
      );
    }
    return null;
  };

  // Limpiar el campo de texto
  const resetInput = () => {
    setInputText('');
    setPanel(null);
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
    borrarMensajeLocal(msg.id);
    quitarDeBandeja(msg.id);
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
      olvidarArchivoGuardado(msg.media_path);
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
  // Revisa y prepara un archivo (comprime fotos, revisa duración de videos y audios)
  const prepararArchivo = async (file: File, forceAudio = false): Promise<PendingMedia> => {
    if (!forceAudio && file.type.startsWith('image/')) {
      const img = await compressImage(file);
      return { kind: 'image', blob: img.blob, mime: img.mime, width: img.width, height: img.height, thumb: img.thumb, original: file };
    }
    if (!forceAudio && file.type.startsWith('video/')) {
      if (file.size > MAX_FILE_BYTES) throw new Error('Un video pesa más de 25 MB. Recórtalo o grábalo más corto.');
      const info = await inspectVideo(file);
      // Videos grabados en la cámara de ChatDos: algunos navegadores no guardan la duración en el archivo
      const grabada = duracionGrabada.get(file);
      if (grabada !== undefined && (!Number.isFinite(info.duration) || !info.duration)) info.duration = grabada;
      if (info.duration > MAX_VIDEO_SECONDS + 0.5) throw new Error('Un video dura más de 2 minutos. Recórtalo antes de enviarlo.');
      return { kind: 'video', blob: file, mime: file.type || 'video/mp4', ...info };
    }
    if (file.type.startsWith('audio/') || forceAudio) {
      if (file.size > MAX_FILE_BYTES) throw new Error('El audio pesa más de 25 MB.');
      const duration = await audioDuration(file);
      return { kind: 'audio', blob: file, mime: file.type || 'audio/mpeg', duration, name: file.name, music: true };
    }
    throw new Error('Ese tipo de archivo no se puede enviar.');
  };

  const MAX_A_LA_VEZ = 10;
  // "+" del editor: elegir más fotos o videos y sumarlos a los que ya están
  const sumarRef = useRef(false);
  const agregarAlEditor = () => {
    sumarRef.current = true;
    galleryInputRef.current?.click();
  };
  const handleFilePicked = async (files: FileList | File[] | null | undefined, forceAudio = false) => {
    setAttachOpen(false);
    const lista = Array.from(files ?? []);
    if (!lista.length) return;
    setPreparing(true);
    const listos: PendingMedia[] = [];
    let aviso: string | null = lista.length > MAX_A_LA_VEZ ? `Se tomaron las primeras ${MAX_A_LA_VEZ}` : null;
    for (const f of lista.slice(0, MAX_A_LA_VEZ)) {
      try {
        listos.push(await prepararArchivo(f, forceAudio));
      } catch (err) {
        aviso = err instanceof Error ? err.message : 'No se pudo preparar un archivo';
      }
    }
    setPreparing(false);
    if (aviso) setToast(aviso);
    if (listos.length) {
      if (sumarRef.current) setPendingMedia((l) => [...(l ?? []), ...listos].slice(0, MAX_A_LA_VEZ));
      else setPendingMedia(listos);
    }
    sumarRef.current = false;
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
    if (subiendoRef.current.has(messageId)) return; // ya se está subiendo
    subiendoRef.current.add(messageId);
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
      quitarDeBandeja(messageId);
      notifyPartner(messageId);
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
    } finally {
      subiendoRef.current.delete(messageId);
    }
  };

  const sendMedia = (
    media: PendingMedia,
    caption: string,
    viewOnce: boolean,
    opts: {
      sinRespuesta?: boolean;
      orden?: number;
      diferir?: boolean;
      album?: MessagePayload['album'];
      reenviado?: boolean;
    } = {}
  ): (() => Promise<void>) | null => {
    if (!user || !chatId || !chatKey) return null;
    const messageId = crypto.randomUUID();
    const sentAt = Date.now() + (opts.orden ?? 0); // varias fotos: cada una 1 ms después, para que queden en orden
    const replying = opts.sinRespuesta ? null : replyTo;
    const payload: MessagePayload = {
      v: 1,
      sentAt,
      ...(caption && !viewOnce ? { text: caption } : {}),
      ...(replying
        ? { replyPreview: { senderId: replying.sender_id, text: shortText(replying), kind: replying.kind } }
        : {}),
      ...(opts.album ? { album: opts.album } : {}),
      ...(opts.reenviado ? { reenviado: true } : {}),
      media: {
        key: '',
        mime: media.mime,
        size: media.blob.size,
        width: media.width,
        height: media.height,
        duration: media.duration,
        // En "ver una vez" no va miniatura (se vería la foto sin abrirla)
        thumb: viewOnce || media.sticker ? undefined : media.thumb,
        name: media.name,
        music: media.music,
        ...(media.sticker ? { sticker: true } : {}),
        ...(media.hd ? { hd: true } : {}),
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
    const { blob, ...info } = media;
    // La subida: ya, o después (cuando se mandan varias, en fila para que lleguen en orden)
    // Se guarda ya en la bandeja de salida (si se cierra la app, se envía después)
    const enBandeja = ponerEnBandeja({
      id: messageId,
      chatId,
      creado: sentAt,
      media: { blob, info, payload, viewOnce, replyId: replying ? replying.id : null },
    }).catch(() => {});
    const subir = () => enBandeja.then(() => uploadAndSave(messageId, media, payload, viewOnce, replying ? replying.id : null));
    if (opts.diferir) return subir;
    void subir();
    return null;
  };

  // Varias fotos/videos a la vez: aparecen todas al instante y se suben una tras otra (en orden).
  // Si son 2 o más fotos o videos, van marcados como álbum y se ven juntos (como WhatsApp).
  const sendMedias = async (lista: PendingMedia[], caption: string, viewOnce: boolean, extra: { reenviado?: boolean } = {}) => {
    const esAlbum = lista.length >= 2 && !viewOnce && lista.every((m) => (m.kind === 'image' || m.kind === 'video') && !m.sticker);
    const albumId = esAlbum ? crypto.randomUUID() : '';
    const subidas = lista
      .map((m, i) =>
        sendMedia(m, i === 0 ? caption : '', viewOnce, {
          sinRespuesta: i > 0,
          orden: i,
          diferir: true,
          album: esAlbum ? { id: albumId, n: lista.length, i } : undefined,
          reenviado: extra.reenviado,
        })
      )
      .filter((x): x is () => Promise<void> => !!x);
    setPendingMedia(null);
    for (const subir of subidas) await subir();
  };

  /** Envía lo del editor; en HD las fotos se vuelven a preparar desde el original con más calidad */
  const enviarDelEditor = async (lista: PendingMedia[], caption: string, viewOnce: boolean, hd: boolean) => {
    if (!hd) return sendMedias(lista, caption, viewOnce);
    setPreparing(true);
    try {
      const listas = await Promise.all(
        lista.map(async (m) => {
          if (m.kind !== 'image' || m.sticker || !m.original) return m;
          try {
            const img = await compressImage(new File([m.original], 'foto.jpg', { type: m.original.type || 'image/jpeg' }), true);
            if (img.blob.size > MAX_FILE_BYTES) return m; // muy pesada: va en calidad normal
            return { ...m, blob: img.blob, mime: img.mime, width: img.width, height: img.height, hd: true };
          } catch {
            return m;
          }
        })
      );
      setPreparing(false);
      await sendMedias(listas, caption, viewOnce);
    } finally {
      setPreparing(false);
    }
  };

  // ----- Stickers -----
  const enviarSticker = async (st: Sticker) => {
    if (!user) return;
    try {
      const blob = await blobSticker(st);
      sendMedia({ kind: 'image', blob, mime: st.meta.mime, width: st.meta.w, height: st.meta.h, sticker: true }, '', false);
      marcarUsado(user.id, st);
    } catch {
      setToast('No se pudo enviar el sticker');
    }
  };

  // Guardar en mi colección un sticker o una foto que está en el chat
  const guardarComoSticker = async (msg: DecryptedMessage) => {
    setActionMsg(null);
    const media = msg.payload?.media;
    if (!user || !media || !msg.media_path) return;
    try {
      const url = getCachedUrl(msg.id) || (await downloadDecrypted(msg.id, msg.media_path, media.key, media.mime));
      const blob = await (await fetch(url)).blob();
      // Una foto normal se abre en el editor (borde, forma y textos); un sticker se guarda tal cual
      if (!media.sticker) {
        setEditorSticker({ imagen: blob, enviar: false });
        return;
      }
      const r = await agregarSticker(user.id, myProfile?.public_key, blob);
      setToast(r.nuevo ? 'Guardado en tus stickers' : 'Ya estaba en tus stickers');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo guardar el sticker');
    }
  };

  // Pegar una imagen en el campo de texto (por ejemplo, copiada desde Fotos en iPhone)
  const alPegar = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return; // texto normal: se pega como siempre
    e.preventDefault();
    setPegada(file);
  };

  const enviarPegadaComoSticker = async (guardar: boolean) => {
    const blob = pegada;
    setPegada(null);
    if (!blob || !user) return;
    try {
      if (guardar) {
        const { sticker } = await agregarSticker(user.id, myProfile?.public_key, blob);
        await enviarSticker(sticker);
      } else {
        const { prepararSticker } = await import('../lib/stickers');
        const p = await prepararSticker(blob);
        sendMedia({ kind: 'image', blob: p.blob, mime: p.meta.mime, width: p.meta.w, height: p.meta.h, sticker: true }, '', false);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'No se pudo enviar');
    }
  };

  const retryUpload = (messageId: string) => {
    const saved = retryRef.current.get(messageId);
    if (saved) uploadAndSave(messageId, saved.media, saved.payload, saved.viewOnce, saved.replyId);
  };

  // ----- Botón atrás del celular -----
  // Cierra el panel o la ventana que esté abierta (la de arriba) en vez de salir del chat.
  useAtras(panel !== null, () => setPanel(null));
  useAtras(attachOpen, () => setAttachOpen(false));
  useAtras(headerMenuOpen, () => setHeaderMenuOpen(false));
  useAtras(busqueda !== null, () => setBusqueda(null));
  useAtras(!!actionMsg, () => setActionMsg(null));
  useAtras(!!reactionPickerFor, () => setReactionPickerFor(null));
  useAtras(!!viewer, () => closeViewer());
  useAtras(!!pendingMedia, () => setPendingMedia(null));
  useAtras(!!infoMsg, () => setInfoMsg(null));
  useAtras(temporalesOpen, () => setTemporalesOpen(false));
  useAtras(fondoOpen, () => setFondoOpen(false));
  useAtras(vaciarOpen, () => !vaciando && setVaciarOpen(false));
  useAtras(silencioOpen, () => setSilencioOpen(false));
  useAtras(showSecurityModal, () => setShowSecurityModal(false));
  useAtras(enviarExtra !== null, () => setEnviarExtra(null));
  useAtras(!!editorSticker, () => setEditorSticker(null));
  useAtras(!!pegada, () => setPegada(null));
  useAtras(!!confirmDeleteAll, () => setConfirmDeleteAll(null));

  // ----- Ver fotos y videos en carrusel, y descargarlos -----
  /** Fotos y videos del chat que se pueden pasar en el carrusel (no "ver una vez" ni stickers) */
  const mediosDelChat = () =>
    visibles.filter(
      (m) =>
        (m.kind === 'image' || m.kind === 'video') &&
        !m.view_once &&
        !m.deleted_for_all &&
        !m.decryptionError &&
        !!m.payload?.media &&
        !m.payload.media.sticker
    );

  const abrirGaleria = (m: DecryptedMessage, url: string, kind: 'image' | 'video') => {
    const items = mediosDelChat();
    const inicio = items.findIndex((x) => x.id === m.id);
    if (inicio < 0) {
      setViewer({ url, kind });
      return;
    }
    setGaleria({ items, inicio });
  };

  /** El archivo descifrado de un mensaje (lo baja si todavía no está) */
  const urlDeMensaje = useCallback(async (m: DecryptedMessage) => {
    const media = m.payload?.media;
    const guardada = getCachedUrl(m.id);
    if (guardada) return guardada;
    if (!media?.key || !m.media_path) return undefined;
    return downloadDecrypted(m.id, m.media_path, media.key, media.mime);
  }, []);

  /** ¿Este mensaje tiene un archivo que se pueda descargar? */
  const sePuedeDescargar = (m: DecryptedMessage) =>
    m.kind !== 'text' && !m.view_once && !m.deleted_for_all && !m.decryptionError && !!m.payload?.media;

  const descargarMensaje = async (m: DecryptedMessage) => {
    setActionMsg(null);
    const media = m.payload?.media;
    if (!media) return;
    try {
      const url = await urlDeMensaje(m);
      if (!url) throw new Error('sin archivo');
      const ok = await descargarArchivo(url, media.mime, nombreDescarga(media.mime, m.payload?.sentAt || m.created_at, media.name));
      if (ok) setToast(m.kind === 'video' ? 'Video descargado' : m.kind === 'audio' ? 'Audio descargado' : 'Foto descargada');
    } catch (err) {
      console.error('[ChatDos] descargar', err);
      setToast('No se pudo descargar. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  // ----- Reenviar -----
  const [reenviar, setReenviar] = useState<DecryptedMessage[] | null>(null);
  const [preparandoReenvio, setPreparandoReenvio] = useState(false);

  /** ¿Este mensaje se puede reenviar? (no: borrados, "ver una vez", llamadas, ni lo que aún se envía) */
  const sePuedeReenviar = (m: DecryptedMessage) => {
    const p = m.payload;
    if (!p || m.deleted_for_all || m.decryptionError || m.view_once || m.isPending || p.llamada) return false;
    return !!(p.media || p.text || p.contacto || p.ubicacion);
  };

  /** Abre "Reenviar a…" (si es un álbum, se reenvía completo) */
  const abrirReenviar = (m: DecryptedMessage) => {
    setActionMsg(null);
    setReenviar(albumes.get(m.id) ?? [m]);
  };

  /** Arma lo que se va a reenviar: el texto, o el archivo ya descifrado */
  const prepararReenvio = async (lista: DecryptedMessage[]): Promise<ItemReenvio[]> => {
    const items: ItemReenvio[] = [];
    for (const m of lista) {
      const p = m.payload;
      if (!p || m.deleted_for_all || m.decryptionError || m.view_once) continue;
      if (p.media) {
        if (!m.media_path && !getCachedUrl(m.id)) continue;
        const url = getCachedUrl(m.id) ?? (await downloadDecrypted(m.id, m.media_path!, p.media.key, p.media.mime));
        const blob = await (await fetch(url)).blob();
        items.push({
          media: {
            kind: m.kind as 'image' | 'video' | 'audio',
            blob,
            mime: p.media.mime,
            width: p.media.width,
            height: p.media.height,
            duration: p.media.duration,
            thumb: p.media.thumb,
            name: p.media.name,
            music: p.media.music,
            sticker: p.media.sticker,
            hd: p.media.hd,
          },
          comentario: p.text,
        });
      } else if (p.text || p.contacto || p.ubicacion) {
        items.push({
          especial: {
            ...(p.text ? { text: p.text } : {}),
            ...(p.enlace ? { enlace: p.enlace } : {}),
            ...(p.contacto ? { contacto: p.contacto } : {}),
            // La ubicación en tiempo real se reenvía como un punto fijo
            ...(p.ubicacion ? { ubicacion: { lat: p.ubicacion.lat, lng: p.ubicacion.lng, precision: p.ubicacion.precision } } : {}),
          },
        });
      }
    }
    return items;
  };

  /** Envía en ESTE chat lo que llegó para reenviar */
  const enviarReenvio = async (items: ItemReenvio[]) => {
    const medias = items.filter((i) => i.media);
    for (const i of items) if (i.especial) await handleSendMessage({ ...i.especial, reenviado: true });
    if (medias.length === 1) {
      sendMedia(medias[0].media!, medias[0].comentario ?? '', false, { sinRespuesta: true, reenviado: true });
    } else if (medias.length > 1) {
      await sendMedias(medias.map((i) => i.media!), medias[0].comentario ?? '', false, { reenviado: true });
    }
  };

  const reenviarA = async (destinos: DestinoReenvio[]) => {
    const lista = reenviar;
    setReenviar(null);
    if (!lista || !destinos.length || !user) return;
    setPreparandoReenvio(true);
    try {
      const items = await prepararReenvio(lista);
      if (!items.length) {
        setToast('Ese mensaje no se puede reenviar');
        return;
      }
      // Un solo chat distinto a este: se abre ese chat y se envía ahí (como WhatsApp)
      if (destinos.length === 1 && destinos[0].chat_id !== chatId) {
        dejarReenvio(destinos[0].chat_id, items);
        navigate(`/chat/${destinos[0].chat_id}`);
        return;
      }
      // Varios: se envía a todos sin salir de este chat (a este, como un envío normal)
      const otros = destinos.filter((d) => d.chat_id !== chatId);
      if (destinos.some((d) => d.chat_id === chatId)) await enviarReenvio(items);
      const fallidos: string[] = [];
      for (const d of otros) {
        try {
          await enviarAChat(user.id, d.chat_id, d.partner, items);
        } catch (err) {
          console.error('[ChatDos] reenviar a', d.chat_id, err);
          fallidos.push(d.partner.display_name || d.partner.username);
        }
      }
      setToast(
        fallidos.length
          ? `No se pudo reenviar a ${fallidos.join(', ')}. Inténtalo de nuevo.`
          : `Reenviado a ${destinos.length === 1 ? '1 chat' : `${destinos.length} chats`}`
      );
    } catch (err) {
      console.error('[ChatDos] reenviar', err);
      setToast('No se pudo reenviar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setPreparandoReenvio(false);
    }
  };

  // Al abrir este chat desde "Reenviar a…": se envía lo que llegó, con la llave de este chat
  const reenvioHecho = useRef(false);
  useEffect(() => {
    if (!chatKey || !user || !chatId || reenvioHecho.current) return;
    const items = tomarReenvio(chatId);
    if (!items) return;
    reenvioHecho.current = true;
    void enviarReenvio(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey, user, chatId]);

  // ----- Notas de voz -----
  const startRecording = async (): Promise<boolean> => {
    if (recording || recorderRef.current) return false;
    const rec = new VoiceRecorder();
    try {
      await rec.start();
    } catch (err) {
      console.error('[ChatDos] micrófono', err);
      setToast('No se pudo usar el micrófono. Revisa el permiso en los ajustes del navegador.');
      return false;
    }
    recorderRef.current = rec;
    setRecordViewOnce(false);
    setPausado(false);
    setPrevia(null);
    setRecording(true);
    return true;
  };

  const nivelMicrofono = useCallback(() => recorderRef.current?.nivel() ?? 0, []);
  const segundosGrabados = useCallback(() => recorderRef.current?.elapsed() ?? 0, []);

  // Pausar y continuar la grabación con candado (sigue siendo el mismo audio)
  const alternarPausa = () => {
    const r = recorderRef.current;
    if (!r) return;
    navigator.vibrate?.(10);
    if (r.enPausa) {
      setPrevia(null);
      r.resume();
      setPausado(false);
      return;
    }
    r.pause();
    setPausado(true);
    // Se arma lo grabado hasta ahora para poder escucharlo antes de enviar
    const duracion = r.elapsed();
    r.vistaPrevia().then((v) => {
      if (v && recorderRef.current === r && r.enPausa) setPrevia({ blob: v.blob, duracion });
    });
  };

  const cancelRecording = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
    setPausado(false);
    setPrevia(null);
    setGesto('no');
    pulsacion.current = null;
  };

  // ----- Mantener presionado el micrófono -----
  const alPresionarMic = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (recording || pulsacion.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), soltado: false, cancelado: false };
    pulsacion.current = p;
    moverArrastre(0, 0);
    // La vista de "grabando" sale de una vez; el micrófono termina de encender por detrás
    setGesto('mantener');
    navigator.vibrate?.(25);
    const ok = await startRecording();
    if (!ok) {
      setGesto('no');
      if (pulsacion.current === p) pulsacion.current = null;
      return;
    }
    // Se deslizó para cancelar mientras el micrófono encendía
    if (p.cancelado) {
      cancelRecording();
      return;
    }
    // Se soltó mientras el micrófono encendía (por ejemplo, salió el aviso de permiso)
    if (p.soltado) {
      cancelRecording();
      setToast('Mantén presionado el micrófono para grabar y suelta para enviar.');
    }
  };

  // El dedo que bloqueó o canceló la grabación sigue en la pantalla: su "soltar" no debe
  // enviar nada, pero después hay que volver a aceptar toques. Se escucha en toda la
  // ventana porque al bloquear el botón del micrófono cambia por el panel de grabación.
  const esperarSoltar = (id: number) => {
    ignorarClick.current = true;
    const fin = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointerup', fin, true);
      window.removeEventListener('pointercancel', fin, true);
      setTimeout(() => (ignorarClick.current = false), 400);
    };
    window.addEventListener('pointerup', fin, true);
    window.addEventListener('pointercancel', fin, true);
  };

  const alMoverMic = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pulsacion.current;
    if (!p || p.id !== e.pointerId || gesto !== 'mantener') return;
    const dx = Math.min(0, e.clientX - p.x);
    const dy = Math.min(0, e.clientY - p.y);
    if (dx < -110) {
      p.cancelado = true;
      esperarSoltar(p.id);
      cancelRecording();
      navigator.vibrate?.(15);
      return;
    }
    if (dy < -80) {
      setGesto('bloqueado');
      moverArrastre(0, 0);
      pulsacion.current = null;
      esperarSoltar(p.id);
      navigator.vibrate?.(15);
      return;
    }
    moverArrastre(dx, dy);
  };

  const alSoltarMic = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pulsacion.current;
    if (!p || p.id !== e.pointerId) return;
    ignorarClick.current = true;
    setTimeout(() => (ignorarClick.current = false), 400);
    if (!recorderRef.current) {
      p.soltado = true; // aún encendiendo el micrófono
      return;
    }
    pulsacion.current = null;
    setGesto('no');
    if (Date.now() - p.t < 500) {
      cancelRecording();
      setToast('Mantén presionado el micrófono para grabar y suelta para enviar.');
      return;
    }
    finishRecording();
  };

  const finishRecording = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    setRecording(false);
    setPausado(false);
    setPrevia(null);
    setGesto('no');
    pulsacion.current = null;
    const { blob, mime, duration } = await rec.stop();
    if (duration < 1 || blob.size < 1000) {
      setToast('El audio es muy corto');
      return;
    }
    sendMedia({ kind: 'audio', blob, mime, duration, music: false }, '', recordViewOnce);
  };

  // Corte automático a los 5 minutos. El reloj en pantalla lo lleva <TiempoGrabacion>,
  // así el chat no se vuelve a dibujar cada cuarto de segundo mientras se graba.
  const finishRef = useRef(finishRecording);
  finishRef.current = finishRecording;
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      if ((recorderRef.current?.elapsed() || 0) >= MAX_AUDIO_SECONDS) finishRef.current();
    }, 500);
    return () => clearInterval(t);
  }, [recording]);

  // Si se sale del chat grabando, se apaga el micrófono
  useEffect(() => () => recorderRef.current?.cancel(), []);

  // ----- Ver una vez -----
  // Se marca como visto y se borra del servidor EN CUANTO se abre (como WhatsApp):
  // aunque se salga de la app sin cerrar la foto, ya no se puede volver a abrir.
  const quemarVerUnaVez = async (msg: DecryptedMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, viewed_at: new Date().toISOString() } : m)));
    {
      // En el celular se guarda solo lo cifrado (sin el contenido descifrado)
      const { payload: _p, decryptionError: _d, isPending: _i, ...fila } = msg as DecryptedMessage & Record<string, unknown>;
      void _p; void _d; void _i;
      guardarMensajes([{ ...(fila as unknown as DbMessage), viewed_at: new Date().toISOString() }]);
    }
    const { data: path, error } = await supabase.rpc('mark_viewed_once', { p_message: msg.id });
    if (error) console.error('[ChatDos] mark_viewed_once', error);
    const toRemove = (path as string | null) || msg.media_path;
    if (toRemove) {
      olvidarArchivoGuardado(toRemove);
      const { error: rmErr } = await supabase.storage.from('media').remove([toRemove]);
      if (rmErr) console.error('[ChatDos] borrar ver una vez', rmErr);
    }
  };

  const openViewOnce = async (msg: DecryptedMessage) => {
    const media = msg.payload?.media;
    if (!media?.key || !msg.media_path || msg.viewed_at) return;
    setViewer({ kind: msg.kind as 'image' | 'video' | 'audio', viewOnceMsg: msg, loading: true });
    try {
      const url = await downloadDecrypted(msg.id, msg.media_path, media.key, media.mime, false);
      setViewer({ url, kind: msg.kind as 'image' | 'video' | 'audio', viewOnceMsg: msg });
    } catch {
      setViewer(null);
      setToast('Este archivo ya no está disponible');
    }
    // Abierto (o ya no existía): queda gastado para siempre
    await quemarVerUnaVez(msg);
  };

  const closeViewer = () => {
    const v = viewer;
    setViewer(null);
    if (v?.viewOnceMsg && v.url) URL.revokeObjectURL(v.url);
  };

  // ----- Vaciar chat -----
  const limpiarPantallaDelChat = () => {
    if (!chatId) return;
    messagesRef.current.forEach((m) => {
      forgetUrl(m.id);
      if (m.media_path) olvidarArchivoGuardado(m.media_path);
    });
    setMessages((prev) => prev.filter((m) => m.chat_id !== chatId || m.isPending));
    memoria.mensajes.delete(chatId);
    borrarMensajesLocalesExcepto(chatId, new Set());
    setHasMoreOlder(false);
    setReplyTo(null);
  };

  const vaciarChat = async (paraLosDos: boolean) => {
    if (!chatId || !partner) return;
    setVaciando(true);
    try {
      if (paraLosDos) {
        const { data, error } = await supabase.functions.invoke('admin-invitados', {
          body: { accion: 'vaciar_chat', invitado_id: partner.id },
        });
        if (error || data?.error) throw new Error(data?.error || 'No se pudo vaciar el chat');
        // Avisar a la otra persona para que su pantalla también quede vacía
        activeChannelRef.current?.send({ type: 'broadcast', event: 'chat_vaciado', payload: {} });
      } else {
        const { error } = await supabase.rpc('vaciar_chat_para_mi', { p_chat: chatId });
        if (error) throw new Error('No se pudo vaciar el chat');
      }
      limpiarPantallaDelChat();
      setVaciarOpen(false);
      setToast(paraLosDos ? 'Chat vaciado para los dos' : 'Chat vaciado');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo vaciar el chat');
    } finally {
      setVaciando(false);
    }
  };

  limpiarPantallaRef.current = limpiarPantallaDelChat;

  // Ir al mensaje original de una cita
  const goToMessage = (idOriginal: string) => {
    // Una foto dentro de un álbum: se va al álbum
    let id = idOriginal;
    if (enAlbum.has(id)) {
      for (const [primero, lista] of albumes) {
        if (lista.some((x) => x.id === id)) {
          id = primero;
          break;
        }
      }
    }
    const el = document.getElementById(`msg-${id}`);
    if (!el) {
      setToast('El mensaje original no está cargado. Sube y toca "Cargar mensajes anteriores".');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1600);
  };

  // ----- Fijar, temporales, llamadas y doble toque -----
  const difundirAjustes = () => {
    activeChannelRef.current?.send({ type: 'broadcast', event: 'ajustes', payload: {} }).catch(() => {});
  };

  const alternarFijado = async (msg: DecryptedMessage) => {
    if (!chatId) return;
    const nuevo = ajustes.fijado === msg.id ? null : msg.id;
    setActionMsg(null);
    setAjustes((a) => ({ ...a, fijado: nuevo }));
    try {
      await fijarMensaje(chatId, nuevo);
      difundirAjustes();
      setToast(nuevo ? 'Mensaje fijado arriba' : 'Se quitó el mensaje fijado');
    } catch (e) {
      recargarAjustes();
      setToast(e instanceof Error ? e.message : 'No se pudo fijar');
    }
  };

  const elegirTemporales = async (segundos: number) => {
    if (!chatId) return;
    await ponerTemporales(chatId, segundos);
    setAjustes((a) => ({ ...a, temporales: segundos }));
    difundirAjustes();
    setToast(segundos ? `Mensajes temporales: ${nombreDuracion(segundos)}` : 'Mensajes temporales desactivados');
  };

  const llamar = async (tipo: TipoLlamada) => {
    if (!chatId) return;
    try {
      await iniciarLlamada(chatId, tipo);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo llamar');
    }
  };

  const corazonDobleToque = (msg: DecryptedMessage) => {
    if (myReactionFor(msg.id) !== '❤️') void toggleReaction(msg, '❤️');
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
    if (partnerEnLinea) {
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
    // Solo la primera vez en un celular nuevo: la forma del chat, sin ruedita
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-[#F2F4F7] dark:bg-[#1F2933]" aria-label="Abriendo el chat">
        <div
          className="bg-[#003A73] px-3 flex items-center gap-2.5 shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <div className="w-[38px] h-[38px] rounded-full bg-white/15 animate-pulse" />
          <div className="h-3 w-28 rounded bg-white/15 animate-pulse" />
        </div>
        <BurbujasDeRelleno />
      </div>
    );
  }

  if (errorMsg || !partner) {
    return (
      <div className="p-4 bg-white dark:bg-[#253240] rounded-[5px] text-center border border-[#E3E7EC] dark:border-[#003A73] m-4">
        <p className="text-sm font-['Inter'] text-[#B03030]">
          {errorMsg || 'No se pudo cargar esta conversación.'}
        </p>
        {(
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

  // Los mensajes temporales vencidos no se muestran (el servidor los borra al abrir)
  const visibles = messages.filter((m) => !estaVencido(m));

  // Álbumes: fotos y videos enviados juntos y seguidos se dibujan en una sola burbuja.
  // El primero lleva el álbum completo y los demás no se dibujan aparte.
  const albumes = new Map<string, DecryptedMessage[]>();
  const enAlbum = new Set<string>();
  {
    let grupo: DecryptedMessage[] | null = null;
    const cerrar = () => {
      if (grupo && grupo.length > 1) {
        albumes.set(grupo[0].id, grupo);
        grupo.slice(1).forEach((x) => enAlbum.add(x.id));
      }
    };
    for (const m of visibles) {
      const a = m.payload?.album;
      const sirve =
        !!a && !m.deleted_for_all && !m.decryptionError && !m.view_once && (m.kind === 'image' || m.kind === 'video');
      if (sirve && grupo && grupo[0].payload?.album?.id === a!.id && grupo[0].sender_id === m.sender_id) {
        grupo.push(m);
        continue;
      }
      cerrar();
      grupo = sirve ? [m] : null;
    }
    cerrar();
  }

  // Selección de varios mensajes (para reenviar, copiar o borrar juntos)
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  /** Un álbum se marca y desmarca completo */
  const alternarSeleccion = (m: DecryptedMessage) => {
    const ids = (albumes.get(m.id) ?? [m]).map((x) => x.id);
    setSeleccion((prev) => {
      const s = new Set(prev ?? []);
      const quitar = s.has(ids[0]);
      ids.forEach((id) => (quitar ? s.delete(id) : s.add(id)));
      return s.size ? s : null;
    });
  };

  // Lo seleccionado, en el orden del chat
  const seleccionados = seleccion ? visibles.filter((m) => seleccion.has(m.id)) : [];
  const [confirmarBorrarSel, setConfirmarBorrarSel] = useState(false);
  useAtras(!!seleccion, () => setSeleccion(null));
  useAtras(confirmarBorrarSel, () => setConfirmarBorrarSel(false));

  const copiarSeleccion = async () => {
    const textos = seleccionados.map((m) => m.payload?.text).filter((t): t is string => !!t);
    if (!textos.length) return;
    try {
      await navigator.clipboard.writeText(textos.join('\n'));
      setToast(textos.length === 1 ? 'Texto copiado' : `${textos.length} mensajes copiados`);
      setSeleccion(null);
    } catch {
      setToast('No se pudo copiar');
    }
  };

  const reenviarSeleccion = () => {
    const lista = seleccionados.filter(sePuedeReenviar);
    if (!lista.length) return;
    setSeleccion(null);
    setReenviar(lista);
  };

  /** Eliminar para mí varios mensajes a la vez */
  const borrarSeleccion = async () => {
    setConfirmarBorrarSel(false);
    if (!user) return;
    const lista = seleccionados;
    const ids = new Set(lista.map((m) => m.id));
    setSeleccion(null);
    setMessages((prev) => prev.filter((m) => !ids.has(m.id)));
    lista.forEach((m) => {
      borrarMensajeLocal(m.id);
      quitarDeBandeja(m.id);
    });
    const { error } = await supabase
      .from('message_hidden')
      .upsert(
        lista.map((m) => ({ user_id: user.id, message_id: m.id })),
        { onConflict: 'user_id,message_id', ignoreDuplicates: true }
      );
    if (error) {
      console.error('[ChatDos] eliminar varios para mí', error);
      // Vuelven a aparecer (en su lugar)
      setMessages((prev) =>
        [...prev.filter((m) => !ids.has(m.id)), ...lista].sort((a, b) => a.created_at.localeCompare(b.created_at))
      );
      setToast('No se pudieron eliminar. Revisa tu conexión.');
    } else {
      setToast(lista.length === 1 ? 'Mensaje eliminado' : `${lista.length} mensajes eliminados`);
    }
  };

  // Funciones para las burbujas: siempre las mismas (así una burbuja no se vuelve a dibujar
  // por nada), pero cada una llama a la versión más reciente de la pantalla.
  const vivas = useRef<Record<string, (...a: never[]) => unknown>>({});
  vivas.current = {
    setActionMsg,
    startReply,
    goToMessage,
    toggleReaction,
    corazonDobleToque,
    llamar,
    dejarUbicacion: (id: string) => dejarDeCompartir(id, avisarUbicacion),
    abrirReenviar,
    abrirGaleria,
    retryUpload,
    openViewOnce,
    setAlbumAbierto,
    alternarSeleccion,
  } as unknown as Record<string, (...a: never[]) => unknown>;
  const estables = useMemo(() => {
    const llamarA =
      <A extends unknown[]>(nombre: string) =>
      (...a: A) =>
        (vivas.current[nombre] as unknown as (...x: A) => unknown)(...a);
    return {
      onOpenActions: llamarA<[DecryptedMessage]>('setActionMsg'),
      onSwipeReply: llamarA<[DecryptedMessage]>('startReply'),
      onQuoteClick: llamarA<[string]>('goToMessage'),
      onReactionClick: llamarA<[DecryptedMessage, string]>('toggleReaction'),
      onDobleToque: llamarA<[DecryptedMessage]>('corazonDobleToque'),
      onLlamar: llamarA<[TipoLlamada]>('llamar') as (t: TipoLlamada) => void,
      onDejarUbicacion: llamarA<[string]>('dejarUbicacion') as (id: string) => void,
      onReenviar: llamarA<[DecryptedMessage]>('abrirReenviar') as (m: DecryptedMessage) => void,
      onAlternarSeleccion: llamarA<[DecryptedMessage]>('alternarSeleccion') as (m: DecryptedMessage) => void,
      abrirGaleria: llamarA<[DecryptedMessage, string, 'image' | 'video']>('abrirGaleria') as (
        m: DecryptedMessage,
        url: string,
        kind: 'image' | 'video'
      ) => void,
      onRetry: llamarA<[string]>('retryUpload') as (id: string) => void,
      onOpenViewOnce: llamarA<[DecryptedMessage]>('openViewOnce') as (m: DecryptedMessage) => void,
      abrirAlbum: llamarA<[string]>('setAlbumAbierto') as (id: string) => void,
    };
  }, []);


  return (
    <div
      className="flex-1 flex flex-col h-full min-h-0 w-full relative overflow-hidden bg-[#F2F4F7] dark:bg-[#1F2933]"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >
      {/* Fondo del chat (tema o foto propia) */}
      {imagenFondo && (
        <CapaFondo fondo={fondoChat} extraOscuro={resolvedTheme === 'dark' ? 0.45 : 0} modoOscuro={resolvedTheme === 'dark'} />
      )}
      {/* 4. UNA SOLA CABECERA EN EL CHAT (fondo #003A73 con foto, nombre, estado, llave y menú) */}
      <header
        className="relative bg-[#003A73] text-white px-3 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.12)] shrink-0 z-30"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        {seleccion && (
          /* Modo selección: cuántos, y reenviar, copiar o eliminar juntos */
          <div className="absolute inset-x-0 bottom-0 h-14 z-20 bg-[#003A73] flex items-center gap-1 px-1">
            <button
              type="button"
              onClick={() => setSeleccion(null)}
              className="w-11 h-11 flex items-center justify-center"
              aria-label="Salir de la selección"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
            <span className="flex-1 text-[17px] font-['Poppins'] font-semibold">{seleccionados.length}</span>
            {seleccionados.some((m) => m.payload?.text) && (
              <button type="button" onClick={() => void copiarSeleccion()} className="w-11 h-11 flex items-center justify-center" aria-label="Copiar" title="Copiar">
                <Copy className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
            {seleccionados.some(sePuedeReenviar) && (
              <button type="button" onClick={reenviarSeleccion} className="w-11 h-11 flex items-center justify-center" aria-label="Reenviar" title="Reenviar">
                <Forward className="w-5 h-5" strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmarBorrarSel(true)}
              className="w-11 h-11 flex items-center justify-center"
              aria-label="Eliminar para mí"
              title="Eliminar para mí"
            >
              <Trash2 className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        )}
        {busqueda !== null && (
          <div className="absolute inset-x-0 bottom-0 h-14">
            <BuscarEnChat
              mensajes={messages}
              texto={busqueda}
              onTexto={setBusqueda}
              onIr={goToMessage}
              onCerrar={() => setBusqueda(null)}
              hayAnteriores={hasMoreOlder}
              onCargarAnteriores={loadOlderMessages}
            />
          </div>
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Flecha para volver a la lista de chats */}
          {(
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVerFotoPerfil(true);
              }}
              className="relative shrink-0"
              aria-label={`Ver foto de ${partnerName}`}
            >
              <AvatarImage avatarPath={partner.avatar_path} name={partnerName} size={38} />
              {partnerEnLinea && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#003A73]" aria-hidden="true" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="font-['Poppins'] font-semibold text-sm text-white truncate leading-tight flex items-center gap-1.5">
                <span>{partnerName}</span>
                {hasPartnerKey && (
                  <ShieldCheck className="w-3.5 h-3.5 text-white/90 shrink-0" strokeWidth={2} />
                )}
                {silencio && (
                  <BellOff className="w-3.5 h-3.5 text-white/75 shrink-0" strokeWidth={2} aria-label="Chat silenciado" />
                )}
              </h1>
              <div className="h-4 flex items-center">
                {renderHeaderStatus()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Llamadas */}
          {hasPartnerKey && (
            <>
              <button
                onClick={() => void llamar('video')}
                className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-[5px] transition-colors"
                title="Videollamada"
                aria-label="Videollamada"
              >
                <Video className="w-5 h-5" strokeWidth={2} />
              </button>
              <button
                onClick={() => void llamar('voz')}
                className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-[5px] transition-colors"
                title="Llamada de voz"
                aria-label="Llamada de voz"
              >
                <Phone className="w-5 h-5" strokeWidth={2} />
              </button>
            </>
          )}
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
                    setMultimediaOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  <Images className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  <span>Multimedia y enlaces</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    if (silencio) cambiarSilencio(null);
                    else setSilencioOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  {silencio ? (
                    <Bell className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  ) : (
                    <BellOff className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  )}
                  <span>{silencio ? 'Activar notificaciones' : 'Silenciar notificaciones'}</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setFondoOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  <Wallpaper className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  <span>Fondo del chat</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setBusqueda('');
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  <Search className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  <span>Buscar</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setTemporalesOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#1F2933] dark:text-[#E3E7EC] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  <Timer className="w-4 h-4 text-[#005198] dark:text-[#E3E7EC]" strokeWidth={2} />
                  <span>Mensajes temporales</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setVaciarOpen(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-xs font-['Inter'] text-[#B03030] dark:text-[#FDEBD3] hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] flex items-center gap-2.5 transition-colors"
                >
                  <Eraser className="w-4 h-4" strokeWidth={2} />
                  <span>Vaciar chat</span>
                </button>

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

      {/* Nota de la otra persona: burbujita bajo su foto (como WhatsApp) */}
      {notaPartner && (
        <div
          className={`absolute z-20 left-[52px] max-w-[70%] transition-all duration-300 ${
            alFinal ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
          }`}
          style={{ top: 'calc(3.5rem + env(safe-area-inset-top) + 6px)' }}
          aria-label={`Nota de ${partnerName}: ${notaPartner.texto}`}
        >
          <span className="absolute -top-1.5 left-4 w-3 h-3 rotate-45 bg-white dark:bg-[#253240] border-l border-t border-[#E3E7EC] dark:border-[#003A73]" aria-hidden="true" />
          <div className="relative px-3 py-1.5 rounded-[16px] bg-white dark:bg-[#253240] border border-[#E3E7EC] dark:border-[#003A73] shadow-[0_2px_8px_rgba(0,0,0,0.12)] text-[13px] font-['Inter'] text-[#1F2933] dark:text-white truncate">
            {notaPartner.texto}
          </div>
        </div>
      )}

      {/* Alerta si la llave de la otra persona cambió */}
      {keyChangedAlert && (
        <div className="p-2.5 bg-[#FDEBD3] text-[#8A4B00] text-xs font-['Inter'] flex items-center gap-2 leading-relaxed shrink-0 relative z-20">
          <ShieldAlert className="w-4 h-4 text-[#8A4B00] shrink-0" strokeWidth={2} />
          <div className="flex-1">
            {partnerName} entró desde otro dispositivo o cambió su contraseña. El chat sigue cifrado.
          </div>
          <button
            type="button"
            onClick={() => {
              setKeyChangedAlert(false);
              if (partner?.public_key) void aceptarLlaveNueva(partner.id, partner.public_key as JsonWebKey);
            }}
            className="px-2 py-1 rounded-[5px] font-['Poppins'] font-semibold text-[11px] bg-[#8A4B00]/10 hover:bg-[#8A4B00]/20 shrink-0"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Mensaje fijado */}
      {ajustes.fijado && (
        <MensajeFijado
          mensaje={messages.find((m) => m.id === ajustes.fijado)}
          onIr={() => goToMessage(ajustes.fijado!)}
          onQuitar={() => {
            const m = messages.find((x) => x.id === ajustes.fijado);
            if (m) void alternarFijado(m);
            else if (chatId) {
              setAjustes((a) => ({ ...a, fijado: null }));
              fijarMensaje(chatId, null).then(difundirAjustes).catch(recargarAjustes);
            }
          }}
        />
      )}

      {/* Compartiendo la ubicación en tiempo real desde este celular */}
      {compartiendo && (
        <div className="shrink-0 relative z-20 flex items-center justify-center gap-2 py-1.5 px-3 text-[12px] font-['Inter'] text-white bg-[#1E9E5A]">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>Compartiendo tu ubicación en tiempo real (deja ChatDos abierto)</span>
          <button
            type="button"
            onClick={() => void dejarDeCompartir(compartiendo.messageId, avisarUbicacion)}
            className="ml-1 underline font-semibold"
          >
            Detener
          </button>
        </div>
      )}

      {/* Mensajes temporales activos */}
      {ajustes.temporales > 0 && (
        <button
          type="button"
          onClick={() => setTemporalesOpen(true)}
          className="shrink-0 relative z-20 flex items-center justify-center gap-1.5 py-1 text-[11px] font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] bg-[#F2F4F7]/90 dark:bg-[#1F2933]/90"
        >
          <Timer className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Mensajes temporales: se borran después de {nombreDuracion(ajustes.temporales)}</span>
        </button>
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
          onScroll={(e) => {
            const el = e.currentTarget;
            const abajo = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
            if (abajo !== alFinal) setAlFinal(abajo);
          }}
          className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-1 pb-3 flex flex-col"
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
            <BurbujasDeRelleno />
          ) : visibles.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-[#5B6670] dark:text-[#E3E7EC]">
              <p className="text-xs font-['Inter'] bg-white dark:bg-[#253240] px-4 py-2 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] shadow-xs">
                No hay mensajes aún. ¡Envía el primer mensaje cifrado a {partnerName}!
              </p>
            </div>
          ) : (
            visibles.map((msg, index) => {
              if (enAlbum.has(msg.id)) return null; // va dentro del álbum de arriba
              const isMine = msg.sender_id === user?.id;
              const album = albumes.get(msg.id);
              const casilla = (m: DecryptedMessage) => (
                <MessageMedia
                  message={m}
                  isMine={isMine}
                  upload={uploads[m.id]}
                  onRetry={estables.onRetry}
                  onOpenMedia={(url, kind) => estables.abrirGaleria(m, url, kind)}
                  onOpenViewOnce={estables.onOpenViewOnce}
                  mosaico
                />
              );
              // Lo que cambia el adjunto: si no cambia esto ni el mensaje, la burbuja no se redibuja
              const avatarAutor = isMine ? myProfile?.avatar_path : partner?.avatar_path;
              const firma =
                (album ?? [msg])
                  .map((m) => {
                    const u = uploads[m.id];
                    return `${numeroDe(m)}:${u ? `${u.pct}${u.failed ? 'x' : ''}` : ''}`;
                  })
                  .join(',') + `|${avatarAutor ?? ''}|${isMine ? myProfile?.display_name : partnerName}`;

              const currentMsgDate = formatMessageDateSeparator(
                msg.payload?.sentAt || msg.created_at
              );
              const prevMsgDate =
                index > 0
                  ? formatMessageDateSeparator(
                      visibles[index - 1].payload?.sentAt || visibles[index - 1].created_at
                    )
                  : null;

              const showDateSeparator = currentMsgDate !== prevMsgDate;
              // Mensajes seguidos de la misma persona van juntos (sin colita y con poco espacio)
              const isFirstInGroup =
                index === 0 || showDateSeparator || visibles[index - 1].sender_id !== msg.sender_id;

              return (
                <React.Fragment key={msg.id}>
                  {primerNoLeido?.id === msg.id && (
                    <div id="linea-nuevos" className="flex justify-center my-2 select-none scroll-mt-16">
                      <span className="px-3 py-1 rounded-full bg-[#F28C1B] text-[11px] font-['Poppins'] font-semibold text-[#1F2933] shadow-xs">
                        {primerNoLeido.n === 1 ? '1 mensaje nuevo' : `${primerNoLeido.n} mensajes nuevos`}
                      </span>
                    </div>
                  )}
                  {showDateSeparator && (
                    <div className="flex justify-center my-2 select-none">
                      <span className="px-3 py-1 rounded-[5px] bg-[#E3E7EC] dark:bg-[#253240] text-[11px] font-['Poppins'] font-medium text-[#5B6670] dark:text-[#E3E7EC] shadow-xs">
                        {currentMsgDate}
                      </span>
                    </div>
                  )}

                  <MessageItemMemo
                    message={msg}
                    isMine={isMine}
                    myId={user?.id || ''}
                    partnerName={partnerName}
                    reactions={reactions[msg.id] || SIN_REACCIONES}
                    highlighted={highlightId === msg.id}
                    isFirstInGroup={isFirstInGroup}
                    onOpenActions={estables.onOpenActions}
                    onSwipeReply={estables.onSwipeReply}
                    firma={firma}
                    media={
                      album ? (
                        <AlbumMosaico mensajes={album} casilla={casilla} onVerTodo={() => estables.abrirAlbum(msg.id)} />
                      ) : msg.kind !== 'text' && !msg.deleted_for_all && !msg.decryptionError ? (
                        <MessageMedia
                          message={msg}
                          isMine={isMine}
                          upload={uploads[msg.id]}
                          onRetry={estables.onRetry}
                          onOpenMedia={(url, kind) => estables.abrirGaleria(msg, url, kind)}
                          onOpenViewOnce={estables.onOpenViewOnce}
                          autorAvatar={avatarAutor}
                          autorNombre={isMine ? myProfile?.display_name || myProfile?.username : partnerName}
                        />
                      ) : undefined
                    }
                    onQuoteClick={estables.onQuoteClick}
                    onReactionClick={estables.onReactionClick}
                    busqueda={busqueda ?? ''}
                    fijado={ajustes.fijado === msg.id}
                    onDobleToque={estables.onDobleToque}
                    onLlamar={estables.onLlamar}
                    onDejarUbicacion={estables.onDejarUbicacion}
                    onReenviar={estables.onReenviar}
                    reenviable={
                      !!(album || ((msg.kind === 'image' || msg.kind === 'video') && !msg.payload?.media?.sticker)) &&
                      sePuedeReenviar(msg)
                    }
                    seleccionando={!!seleccion}
                    seleccionado={!!seleccion?.has(msg.id)}
                    onAlternarSeleccion={estables.onAlternarSeleccion}
                  />
                </React.Fragment>
              );
            })
          )}

          {/* Botón para bajar al último mensaje */}
          {!alFinal && !loadingMessages && visibles.length > 0 && (
            <div className="sticky bottom-1 h-0 self-end z-10">
              <button
                type="button"
                onClick={() => {
                  setNuevosAbajo(0);
                  scrollToBottom();
                }}
                className="relative -translate-y-full w-10 h-10 rounded-full bg-white dark:bg-[#253240] text-[#5B6670] dark:text-[#E3E7EC] shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-[#E3E7EC] dark:border-[#003A73] flex items-center justify-center"
                aria-label="Ir al último mensaje"
              >
                <ChevronDown className="w-6 h-6" strokeWidth={2} />
                {nuevosAbajo > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 rounded-full bg-[#F28C1B] text-[#1F2933] text-[11px] font-['Poppins'] font-bold flex items-center justify-center">
                    {nuevosAbajo > 99 ? '99+' : nuevosAbajo}
                  </span>
                )}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 5. Barra inferior de entrada de texto */}
      <div
        ref={barraAbajoRef}
        className={`relative px-2 pt-2 shrink-0 ${imagenFondo ? 'bg-transparent' : 'bg-[#F2F4F7] dark:bg-[#1F2933] border-t border-[#E3E7EC] dark:border-[#003A73]'}`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {vistaEnlace && !editingMsg && (
          <VistaPreviaEscribiendo
            cargando={vistaEnlace.cargando}
            e={vistaEnlace.datos}
            onQuitar={() => {
              enlacesQuitados.current.add(vistaEnlace.url);
              setVistaEnlace(null);
            }}
          />
        )}
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
        {gesto === 'bloqueado' || (recording && gesto !== 'mantener') ? (
          /* Grabación con candado (como WhatsApp): arriba tiempo, sonido y "ver una vez"; abajo borrar y enviar */
          <div className="bg-white dark:bg-[#253240] rounded-[22px] border border-[#E3E7EC] dark:border-[#003A73] shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-3 pt-2.5 pb-3">
            <div className="flex items-center gap-3 h-11">
              {pausado && previa ? (
                /* En pausa: escuchar lo grabado */
                <VistaPreviaGrabacion key={previa.duracion} blob={previa.blob} duracion={previa.duracion} />
              ) : (
                <>
                  <span className="shrink-0 flex items-center gap-1.5 text-[17px] font-['Inter'] tabular-nums text-[#1F2933] dark:text-white">
                    {/* Punto rojo mientras graba; quieto y gris en pausa */}
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${pausado ? 'bg-[#5B6670]/50' : 'bg-[#D64545] animate-pulse'}`}
                      aria-hidden="true"
                    />
                    <TiempoGrabacion segundos={segundosGrabados} />
                  </span>
                  <OndaEnVivo nivel={nivelMicrofono} detenida={pausado} className="flex-1 min-w-0 text-[#5B6670] dark:text-[#C9CFD6]" />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  const v = !recordViewOnce;
                  setRecordViewOnce(v);
                  if (v) setToast('La nota de voz se podrá escuchar una sola vez');
                }}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-[#1F2933] dark:text-white"
                aria-pressed={recordViewOnce}
                aria-label="Escuchar una sola vez"
                title="Escuchar una sola vez"
              >
                {recordViewOnce ? <IconoVerUnaVezActivo className="w-7 h-7" /> : <IconoVerUnaVez className="w-7 h-7" />}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-[#FDECEC] text-[#B03030] dark:bg-[#B03030]/25 dark:text-[#FDEBD3]"
                title="Descartar audio"
                aria-label="Descartar audio"
              >
                <Trash2 className="w-[22px] h-[22px]" strokeWidth={2} />
              </button>
              {/* Pausar / continuar (como WhatsApp) */}
              <button
                type="button"
                onClick={alternarPausa}
                disabled={!recording}
                className={`flex-1 min-w-0 h-12 rounded-full flex items-center justify-center gap-2 text-[15px] font-['Inter'] font-medium transition-colors disabled:opacity-60 ${
                  pausado
                    ? 'bg-[#FDEBD3] text-[#1F2933] dark:bg-[#F28C1B]/25 dark:text-white'
                    : 'bg-[#F2F4F7] text-[#1F2933] dark:bg-[#1F2933] dark:text-white'
                }`}
                aria-label={pausado ? 'Continuar grabando' : 'Pausar la grabación'}
              >
                {pausado ? (
                  <>
                    <Mic className="w-5 h-5 shrink-0" strokeWidth={2} /> Continuar
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 shrink-0" fill="currentColor" strokeWidth={0} /> Pausar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (ignorarClick.current) return;
                  finishRecording();
                }}
                className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-[#F28C1B] text-[#1F2933] shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:brightness-105 active:scale-95 transition-transform"
                title="Enviar audio"
                aria-label="Enviar audio"
              >
                <Send className="w-[22px] h-[22px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        ) : (
        <div className="flex items-end gap-1.5">
          {/* Cápsula: expresiones · texto · adjuntar · cámara (como WhatsApp) */}
          <div className="flex-1 min-w-0 flex items-end bg-white dark:bg-[#253240] rounded-[22px] border border-[#E3E7EC] dark:border-[#003A73] shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-1 min-h-11 overflow-hidden">
            {gesto === 'mantener' ? (
              <>
                {/* Grabando con el dedo presionado: deslizar a la izquierda cancela */}
                <div className="flex-1 flex items-center gap-2 pl-3 h-11 text-sm font-['Inter'] text-[#1F2933] dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D64545] animate-pulse shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">
                    <TiempoGrabacion segundos={segundosGrabados} />
                  </span>
                  <OndaEnVivo
                    nivel={nivelMicrofono}
                    className="flex-1 min-w-0 text-[#5B6670] dark:text-[#C9CFD6]"
                    style={{ opacity: 'max(0, calc(1 + var(--dx, 0) / 80))' }}
                  />
                  <span
                    className="mr-2 shrink-0 flex items-center gap-0.5 text-xs text-[#5B6670] dark:text-[#E3E7EC] whitespace-nowrap"
                    style={{ transform: 'translateX(calc(var(--dx, 0) * 0.6px))', opacity: 'max(0.25, calc(1 + var(--dx, 0) / 140))' }}
                  >
                    <FlechaIzq className="w-4 h-4" strokeWidth={2} /> Desliza para cancelar
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Emojis y stickers (cambia a teclado cuando el panel está abierto) */}
                <button
                  type="button"
                  onClick={() => {
                    if (panel) {
                      setPanel(null);
                      textareaRef.current?.focus();
                    } else {
                      textareaRef.current?.blur();
                      setPanel(ultimaPestana.current);
                      setTimeout(scrollToBottom, 50);
                    }
                  }}
                  disabled={!hasPartnerKey}
                  className="w-10 h-11 shrink-0 flex items-center justify-center text-[#5B6670] hover:text-[#005198] dark:text-[#E3E7EC] dark:hover:text-white transition-colors disabled:opacity-40"
                  title={panel ? 'Teclado' : 'Stickers y emojis'}
                  aria-label={panel ? 'Mostrar teclado' : 'Stickers y emojis'}
                >
                  {panel ? <Keyboard className="w-[22px] h-[22px]" strokeWidth={2} /> : <IconoStickerCara className="w-[23px] h-[23px]" />}
                </button>

                {/* Campo de texto que crece hasta 5 líneas */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    setPanel(null);
                    if (isNearBottom()) setTimeout(scrollToBottom, 300);
                  }}
                  placeholder={hasPartnerKey ? 'Mensaje' : 'Esperando a que la otra persona active su llave...'}
                  disabled={!hasPartnerKey}
                  onPaste={alPegar}
                  className="flex-1 min-w-0 max-h-28 py-[10px] px-1 bg-transparent text-[16px] md:text-sm leading-[22px] font-['Inter'] text-[#1F2933] dark:text-white placeholder-[#5B6670] dark:placeholder-[#C9CFD6] resize-none focus:outline-none"
                />

                {/* Adjuntar: galería, cámara, video, audio */}
                {!editingMsg && (
                  <button
                    type="button"
                    onClick={() => setAttachOpen(true)}
                    disabled={!hasPartnerKey || preparing}
                    className="w-10 h-11 shrink-0 flex items-center justify-center text-[#5B6670] hover:text-[#005198] dark:text-[#E3E7EC] dark:hover:text-white transition-colors disabled:opacity-50"
                    title="Adjuntar"
                    aria-label="Adjuntar foto, video o audio"
                  >
                    {preparing ? <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={2} /> : <IconoClip className="w-[23px] h-[23px] rotate-45" />}
                  </button>
                )}

                {/* Cámara directa (se oculta al escribir, como en WhatsApp) */}
                {!editingMsg && !inputText.trim() && (
                  <button
                    type="button"
                    onClick={() => setCamara('foto')}
                    disabled={!hasPartnerKey || preparing}
                    className="w-10 h-11 shrink-0 flex items-center justify-center text-[#5B6670] hover:text-[#005198] dark:text-[#E3E7EC] dark:hover:text-white transition-colors disabled:opacity-50"
                    title="Cámara"
                    aria-label="Abrir la cámara"
                  >
                    <IconoCamara className="w-[22px] h-[22px]" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Botón redondo (el único naranja): con texto = enviar; sin texto = mantener para grabar; candado = enviar audio */}
          {(() => {
            const canUse = hasPartnerKey;
            const mode = gesto === 'mantener' ? 'holding' : recording ? 'sendAudio' : hasInputText || editingMsg ? 'send' : 'mic';
            const label =
              mode === 'sendAudio'
                ? 'Enviar audio'
                : mode === 'mic' || mode === 'holding'
                  ? 'Mantén presionado para grabar'
                  : editingMsg
                    ? 'Guardar cambios'
                    : 'Enviar mensaje';
            const activo = canUse && (mode !== 'send' || hasInputText);
            const esMic = mode === 'mic' || mode === 'holding';
            return (
              <div className="relative shrink-0">
                {/* Candado: deslizar hacia arriba para seguir grabando sin el dedo */}
                {gesto === 'mantener' && (
                  <div
                    className="absolute bottom-[60px] left-1/2 -translate-x-1/2 w-10 py-2 rounded-full bg-white dark:bg-[#253240] border border-[#E3E7EC] dark:border-[#003A73] shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex flex-col items-center gap-1 text-[#5B6670] dark:text-[#E3E7EC] pointer-events-none"
                    style={{ transform: 'translate(-50%, calc(var(--dy, 0) * 0.5px))' }}
                    aria-hidden="true"
                  >
                    <Lock className="w-4 h-4" strokeWidth={2} />
                    <ChevronUp className="w-4 h-4 animate-bounce" strokeWidth={2} />
                  </div>
                )}
                <button
                  type="button"
                  onPointerDown={esMic && canUse ? alPresionarMic : undefined}
                  onPointerMove={esMic ? alMoverMic : undefined}
                  onPointerUp={alSoltarMic}
                  onPointerCancel={alSoltarMic}
                  onContextMenu={(e) => esMic && e.preventDefault()}
                  onClick={(e) => {
                    if (ignorarClick.current) return;
                    if (mode === 'sendAudio') finishRecording();
                    else if (mode === 'send') handleSendMessage();
                    else if (mode === 'mic' && e.detail === 0) {
                      // Teclado (Enter/Espacio): graba con candado
                      startRecording().then((ok) => ok && setGesto('bloqueado'));
                    }
                  }}
                  disabled={!canUse || (mode === 'send' && !hasInputText)}
                  className={`w-11 h-11 rounded-full flex items-center justify-center select-none transition-transform duration-150 ${
                    activo
                      ? 'bg-[#F28C1B] text-[#1F2933] shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:brightness-105 cursor-pointer'
                      : 'bg-[#E3E7EC] dark:bg-[#1F2933] text-[#5B6670] cursor-not-allowed'
                  } ${mode === 'holding' ? 'scale-[1.45] ring-4 ring-[#F28C1B]/30' : 'active:scale-95'}`}
                  style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                  title={label}
                  aria-label={label}
                >
                  {esMic ? <Mic className="w-5 h-5" strokeWidth={2} /> : <Send className="w-5 h-5" strokeWidth={2} />}
                </button>
              </div>
            );
          })()}
        </div>
        )}

        {/* Emojis y stickers en el lugar del teclado */}
        {panel && user && !recording && (
          <PanelExpresiones
            pestana={panel}
            onPestana={(p) => {
              ultimaPestana.current = p;
              try {
                localStorage.setItem('chatdos:pestanaExpresiones', p);
              } catch {
                /* sin almacenamiento: no pasa nada */
              }
              setPanel(p);
            }}
            onEmoji={(emoji) =>
              setInputText((prev) => (prev.length + emoji.length <= 4000 ? prev + emoji : prev))
            }
            userId={user.id}
            miLlavePublica={myProfile?.public_key}
            onSticker={enviarSticker}
            onCerrar={() => setPanel(null)}
            onAviso={setToast}
          />
        )}

        {/* Selectores de archivos (escondidos) */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files);
            e.target.value = '';
          }}
        />
        {/* Botón cámara de la barra: foto o video (el iPhone deja cambiar entre los dos) */}
        <input
          ref={fotoVideoInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files);
            e.target.value = '';
          }}
        />
        {/* Cámara: uno para foto y otro para video (así el iPhone abre directo el modo correcto) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={videoCameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files, true);
            e.target.value = '';
          }}
        />
      </div>

      {attachOpen && (
        <AttachSheet
          onClose={() => setAttachOpen(false)}
          onGallery={() => {
            avisarSelectorArchivo();
            galleryInputRef.current?.click();
          }}
          onCamera={() => {
            setAttachOpen(false);
            setCamara('foto');
          }}
          onVideoCamera={() => {
            setAttachOpen(false);
            setCamara('video');
          }}
          onUbicacion={() => {
            setAttachOpen(false);
            setEnviarExtra('ubicacion');
          }}
          onContacto={() => {
            setAttachOpen(false);
            setEnviarExtra('contacto');
          }}
          onAudioFile={() => {
            avisarSelectorArchivo();
            audioInputRef.current?.click();
          }}
        />
      )}

      {fondoOpen && <FondoChat onCerrar={() => setFondoOpen(false)} />}

      {vaciarOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => !vaciando && setVaciarOpen(false)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white mb-1">¿Vaciar este chat?</h3>
            <p className="text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-4 leading-relaxed">
              Se quitan todos los mensajes, fotos, videos y audios.{' '}
              {isAdmin
                ? `«Solo para mí» los quita de tu pantalla y ${partnerName} los sigue viendo. «Para los dos» los borra para siempre.`
                : `${partnerName} los seguirá viendo.`}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={vaciando}
                onClick={() => vaciarChat(false)}
                className="w-full h-11 rounded-[5px] bg-[#B03030] text-white font-['Poppins'] font-semibold text-sm disabled:opacity-60"
              >
                {vaciando ? 'Vaciando…' : isAdmin ? 'Vaciar solo para mí' : 'Vaciar chat'}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  disabled={vaciando}
                  onClick={() => vaciarChat(true)}
                  className="w-full h-11 rounded-[5px] border border-[#B03030] text-[#B03030] dark:text-[#FDEBD3] dark:border-[#FDEBD3] font-['Poppins'] font-semibold text-sm disabled:opacity-60"
                >
                  Vaciar para los dos (no se puede deshacer)
                </button>
              )}
              <button
                type="button"
                disabled={vaciando}
                onClick={() => setVaciarOpen(false)}
                className="w-full h-11 rounded-[5px] text-[#5B6670] dark:text-[#E3E7EC] font-['Poppins'] font-semibold text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {verFotoPerfil && partner && (
        <FotoPerfilVisor avatarPath={partner.avatar_path} nombre={partner.display_name || partner.username} onCerrar={cerrarFoto} />
      )}

      {editorSticker && user && (
        <StickerEditor
          imagen={editorSticker.imagen}
          onCancelar={() => setEditorSticker(null)}
          onListo={async (png) => {
            const { enviar } = editorSticker;
            setEditorSticker(null);
            try {
              const r = await agregarSticker(user.id, myProfile?.public_key, png);
              if (enviar) await enviarSticker(r.sticker);
              else setToast('Guardado en tus stickers');
            } catch (e) {
              setToast(e instanceof Error ? e.message : 'No se pudo guardar el sticker');
            }
          }}
        />
      )}

      {pegada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPegada(null)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white mb-3">Imagen pegada</h3>
            <div className="h-36 flex items-center justify-center mb-4 rounded-[5px] bg-[#F2F4F7] dark:bg-[#1F2933]">
              <img src={URL.createObjectURL(pegada)} alt="" className="max-h-32 max-w-full object-contain" />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => enviarPegadaComoSticker(true)}
                className="h-11 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm"
              >
                Enviar sticker y guardarlo
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = pegada;
                  setPegada(null);
                  if (b) setEditorSticker({ imagen: b, enviar: true });
                }}
                className="h-11 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#005198] dark:text-white font-['Poppins'] font-semibold text-sm"
              >
                Editar: borde y texto
              </button>
              <button
                type="button"
                onClick={() => enviarPegadaComoSticker(false)}
                className="h-11 rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-[#005198] dark:text-white font-['Poppins'] font-semibold text-sm"
              >
                Enviar sticker sin guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = pegada;
                  setPegada(null);
                  if (b) handleFilePicked([new File([b], 'pegada.png', { type: b.type || 'image/png' })]);
                }}
                className="h-10 text-sm font-['Poppins'] font-semibold text-[#5B6670] dark:text-[#E3E7EC]"
              >
                Enviar como foto
              </button>
            </div>
          </div>
        </div>
      )}

      {enviarExtra === 'ubicacion' && (
        <EnviarUbicacion
          onCerrar={() => setEnviarExtra(null)}
          onEnviar={async (ubicacion, vivoSegundos) => {
            setEnviarExtra(null);
            if (!vivoSegundos) {
              void handleSendMessage({ ubicacion });
              return;
            }
            const hasta = Date.now() + vivoSegundos * 1000;
            const id = await handleSendMessage({ ubicacion: { ...ubicacion, vivo: { hasta } } });
            if (id && chatId && chatKey) compartir({ chatId, messageId: id, hasta }, chatKey, avisarUbicacion, ubicacion);
            else setToast('Sin conexión: no se pudo empezar a compartir en tiempo real');
          }}
        />
      )}
      {enviarExtra === 'contacto' && (
        <EnviarContacto
          onCerrar={() => setEnviarExtra(null)}
          onEnviar={(contacto) => {
            setEnviarExtra(null);
            void handleSendMessage({ contacto });
          }}
        />
      )}

      {camara && (
        <CamaraChat
          modoInicial={camara}
          onCerrar={() => setCamara(null)}
          onListo={(archivos) => {
            setCamara(null);
            void handleFilePicked(archivos);
          }}
          onGaleria={() => {
            setCamara(null);
            avisarSelectorArchivo();
            galleryInputRef.current?.click();
          }}
          onSinCamara={() => {
            // El navegador no deja usar la cámara aquí: se abre la del celular
            setToast('No se pudo abrir la cámara aquí. Revisa el permiso de cámara del navegador.');
            const modo = camara;
            setCamara(null);
            avisarSelectorArchivo();
            (modo === 'video' ? videoCameraInputRef : fotoVideoInputRef).current?.click();
          }}
        />
      )}

      {pendingMedia && (
        <MediaComposer
          medias={pendingMedia}
          onCancel={() => setPendingMedia(null)}
          onRemove={(i) => setPendingMedia((l) => (l && l.length > 1 ? l.filter((_, j) => j !== i) : null))}
          onCambiar={(i, m) => setPendingMedia((l) => (l ? l.map((x, j) => (j === i ? m : x)) : l))}
          onReordenar={(desde, hasta) =>
            setPendingMedia((l) => {
              if (!l) return l;
              const n = l.slice();
              const [m] = n.splice(desde, 1);
              n.splice(hasta, 0, m);
              return n;
            })
          }
          onAgregar={pendingMedia.every((m) => m.kind !== 'audio') ? () => agregarAlEditor() : undefined}
          userId={user?.id}
          miLlavePublica={myProfile?.public_key}
          onSend={({ caption, viewOnce, hd }) => void enviarDelEditor(pendingMedia, caption, viewOnce, hd)}
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
          onSaveSticker={
            actionMsg.kind === 'image' && !actionMsg.view_once && !actionMsg.deleted_for_all && !actionMsg.decryptionError
              ? () => guardarComoSticker(actionMsg)
              : undefined
          }
          onDeleteForAll={() => {
            setConfirmDeleteAll(actionMsg);
            setActionMsg(null);
          }}
          fijado={ajustes.fijado === actionMsg.id}
          onFijar={() => void alternarFijado(actionMsg)}
          onReenviar={sePuedeReenviar(actionMsg) ? () => abrirReenviar(actionMsg) : undefined}
          onDescargar={sePuedeDescargar(actionMsg) ? () => void descargarMensaje(actionMsg) : undefined}
          onSeleccionar={() => {
            const m = actionMsg;
            setActionMsg(null);
            setSeleccion(new Set((albumes.get(m.id) ?? [m]).map((x) => x.id)));
          }}
          onInfo={() => {
            setInfoMsg(actionMsg);
            setActionMsg(null);
          }}
        />
      )}

      {multimediaOpen && (
        <MultimediaChat
          mensajes={visibles}
          nombre={partnerName}
          casilla={(m) => (
            <MessageMedia
              message={m}
              isMine={m.sender_id === user?.id}
              upload={uploads[m.id]}
              onRetry={estables.onRetry}
              onOpenMedia={(url, kind) => estables.abrirGaleria(m, url, kind)}
              onOpenViewOnce={estables.onOpenViewOnce}
              mosaico
            />
          )}
          audio={(m) => (
            <MessageMedia
              message={m}
              isMine={false}
              upload={uploads[m.id]}
              onRetry={estables.onRetry}
              onOpenMedia={() => {}}
              onOpenViewOnce={estables.onOpenViewOnce}
              autorAvatar={m.sender_id === user?.id ? myProfile?.avatar_path : partner?.avatar_path}
              autorNombre={m.sender_id === user?.id ? myProfile?.display_name || myProfile?.username : partnerName}
            />
          )}
          autor={(m) => (m.sender_id === user?.id ? 'Tú' : partnerName)}
          hayAnteriores={hasMoreOlder}
          onCargarAnteriores={loadOlderMessages}
          onCerrar={() => setMultimediaOpen(false)}
        />
      )}
      {confirmarBorrarSel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={() => setConfirmarBorrarSel(false)}>
          <div className="w-full max-w-xs bg-white dark:bg-[#253240] rounded-[8px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.25)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-['Inter'] text-[#1F2933] dark:text-white">
              {seleccionados.length === 1 ? '¿Eliminar este mensaje para ti?' : `¿Eliminar ${seleccionados.length} mensajes para ti?`}
            </p>
            <p className="mt-1 text-xs font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC]">{partnerName} los seguirá viendo.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmarBorrarSel(false)} className="h-10 px-4 rounded-[5px] text-sm font-['Inter'] font-medium text-[#005198] dark:text-white">
                Cancelar
              </button>
              <button type="button" onClick={() => void borrarSeleccion()} className="h-10 px-4 rounded-[5px] bg-[#B03030] text-white text-sm font-['Inter'] font-medium">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {galeria && (
        <Galeria
          items={galeria.items}
          inicio={galeria.inicio}
          autor={(m) => (m.sender_id === user?.id ? 'Tú' : partnerName)}
          obtenerUrl={urlDeMensaje}
          onDescargar={(m) => void descargarMensaje(m)}
          onReenviar={(m) => {
            setGaleria(null);
            abrirReenviar(m);
          }}
          onResponder={(m) => {
            setGaleria(null);
            setAlbumAbierto(null);
            setMultimediaOpen(false);
            startReply(m);
          }}
          onCerrar={() => setGaleria(null)}
        />
      )}
      {reenviar && user && (
        <ReenviarA
          userId={user.id}
          chatActual={chatId || ''}
          cuantos={reenviar.length}
          onEnviar={(destinos) => void reenviarA(destinos)}
          onCerrar={() => setReenviar(null)}
        />
      )}
      {preparandoReenvio && (
        <div className="fixed inset-x-0 top-20 z-[56] flex justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-full bg-[#1F2933]/90 text-white text-sm font-['Inter'] shadow">Reenviando…</span>
        </div>
      )}
      {albumAbierto && albumes.get(albumAbierto) && (
        <AlbumCompleto
          mensajes={albumes.get(albumAbierto)!}
          titulo={albumes.get(albumAbierto)![0].sender_id === user?.id ? 'Tú' : partnerName}
          casilla={(m) => (
            <MessageMedia
              message={m}
              isMine={m.sender_id === user?.id}
              upload={uploads[m.id]}
              onRetry={retryUpload}
              onOpenMedia={(url, kind) => abrirGaleria(m, url, kind)}
              onOpenViewOnce={openViewOnce}
              mosaico
            />
          )}
          onOpciones={setActionMsg}
          onCerrar={() => setAlbumAbierto(null)}
        />
      )}
      {infoMsg && <InfoMensaje mensaje={infoMsg} nombre={partnerName} onCerrar={() => setInfoMsg(null)} />}
      {temporalesOpen && (
        <TemporalesModal actual={ajustes.temporales} onElegir={elegirTemporales} onCerrar={() => setTemporalesOpen(false)} />
      )}

      {/* Todos los emojis para reaccionar */}
      {reactionPickerFor && (
        <EmojiPickerPopover
          onSelectEmoji={(emoji) => toggleReaction(reactionPickerFor, emoji)}
          onClose={() => setReactionPickerFor(null)}
        />
      )}

      {/* Confirmar "Eliminar para todos" */}
      {silencioOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setSilencioOpen(false)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-['Poppins'] font-semibold text-base text-[#003A73] dark:text-white mb-1">
              Silenciar notificaciones
            </h3>
            <p className="text-sm font-['Inter'] text-[#5B6670] dark:text-[#E3E7EC] mb-4">
              Los mensajes seguirán llegando, pero sin avisos ni sonido. {partnerName} no se enterará.
            </p>
            <div className="flex flex-col gap-2">
              {OPCIONES_SILENCIO.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => cambiarSilencio(o.id)}
                  className="h-11 w-full rounded-[5px] border border-[#E3E7EC] dark:border-[#003A73] text-left px-4 font-['Inter'] text-sm text-[#1F2933] dark:text-white hover:bg-[#F2F4F7] dark:hover:bg-[#1F2933] transition-colors"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setSilencioOpen(false)}
                className="h-10 px-4 rounded-[5px] font-['Poppins'] font-semibold text-sm text-[#005198] dark:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
