import React, { useRef, useState } from 'react';
import { Clock, AlertTriangle, Ban, ChevronDown, Check, CheckCheck, Reply } from 'lucide-react';
import type { DecryptedMessage, Reaction } from '../types/chat';
import { formatMessageTime, parseTextWithLinks } from '../lib/formatters';

interface MessageItemProps {
  message: DecryptedMessage;
  isMine: boolean;
  myId: string;
  partnerName: string;
  reactions: Reaction[];
  highlighted?: boolean;
  // Primer mensaje de un grupo seguido de la misma persona: lleva la "colita" y más espacio arriba
  isFirstInGroup?: boolean;
  onOpenActions: (message: DecryptedMessage) => void;
  onSwipeReply?: (message: DecryptedMessage) => void;
  // Foto, video o audio del mensaje (lo arma la pantalla del chat)
  media?: React.ReactNode;
  onQuoteClick: (messageId: string) => void;
  onReactionClick: (message: DecryptedMessage, emoji: string) => void;
}

// Tiempo que hay que dejar presionado el mensaje en el celular para abrir el menú
const LONG_PRESS_MS = 450;

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isMine,
  myId,
  partnerName,
  reactions,
  highlighted = false,
  isFirstInGroup = true,
  onOpenActions,
  onSwipeReply,
  media,
  onQuoteClick,
  onReactionClick,
}) => {
  const timeStr = formatMessageTime(message.payload?.sentAt || message.created_at || Date.now());
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDeleted = message.deleted_for_all;

  // ----- Gestos en el celular -----
  // Mantener presionado = abrir menú. Deslizar a la derecha = responder.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  const [swipeX, setSwipeX] = useState(0);
  const SWIPE_REPLY_PX = 60;
  const canInteract = !(isDeleted && !isMine) && !message.isPending;

  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canInteract) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiping.current = false;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      touchStart.current = null;
      navigator.vibrate?.(15);
      onOpenActions(message);
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // El dedo siempre tiembla un poco: solo cancelamos si se mueve más de 10 px
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearPress();
    // Deslizar horizontal hacia la derecha (y no hacer scroll vertical)
    if (onSwipeReply && !isDeleted && (swiping.current || (dx > 12 && Math.abs(dx) > Math.abs(dy) * 1.5))) {
      swiping.current = true;
      setSwipeX(Math.max(0, Math.min(dx, 90)));
    }
  };

  const handleTouchEnd = () => {
    clearPress();
    if (swiping.current && swipeX >= SWIPE_REPLY_PX && onSwipeReply) {
      navigator.vibrate?.(10);
      onSwipeReply(message);
    }
    swiping.current = false;
    touchStart.current = null;
    setSwipeX(0);
  };

  // Clic derecho (computador)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenActions(message);
  };

  // Checks dentro de la burbuja (solo mis mensajes)
  const renderStatus = () => {
    if (!isMine || isDeleted) return null;

    if (message.isPending) {
      return (
        <span title="Guardando mensaje..." className="inline-flex">
          <Clock className="w-3 h-3 text-white/85 animate-pulse" strokeWidth={2} />
        </span>
      );
    }
    if (message.read_at) {
      // Leído: doble check blanco opaco y más grueso
      return (
        <span title={`Leído a las ${formatMessageTime(message.read_at)}`} className="inline-flex">
          <CheckCheck className="w-4 h-4 text-white" strokeWidth={2.75} />
        </span>
      );
    }
    if (message.delivered_at) {
      return (
        <span title={`Entregado a las ${formatMessageTime(message.delivered_at)}`} className="inline-flex">
          <CheckCheck className="w-4 h-4 text-white/70" strokeWidth={2} />
        </span>
      );
    }
    return (
      <span title="Guardado en servidor" className="inline-flex">
        <Check className="w-4 h-4 text-white/70" strokeWidth={2} />
      </span>
    );
  };

  // Hora y checks: flotan a la derecha en la misma línea del texto (como WhatsApp)
  const metadata = (
    <span
      className={`float-right relative top-[5px] ml-2 -mr-0.5 inline-flex items-center gap-1 h-4 text-[11px] leading-none font-['Inter'] select-none ${
        isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'
      }`}
    >
      {message.edited_at && !isDeleted && <span className="italic">editado</span>}
      <span>{timeStr}</span>
      {renderStatus()}
    </span>
  );

  // Cita del mensaje que se está respondiendo
  const renderQuote = () => {
    const preview = message.payload?.replyPreview;
    if (!preview || isDeleted) return null;
    const author = preview.senderId === myId ? 'Tú' : partnerName;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (message.reply_to) onQuoteClick(message.reply_to);
        }}
        className={`block w-full text-left mb-1.5 px-2.5 py-1.5 rounded-[2px] border-l-[3px] ${
          isMine
            ? 'bg-white/15 border-white/70'
            : 'bg-[#F2F4F7] dark:bg-white/10 border-[#005198] dark:border-[#E3E7EC]'
        }`}
      >
        <span
          className={`block text-[11px] font-['Poppins'] font-semibold ${
            isMine ? 'text-white' : 'text-[#005198] dark:text-white'
          }`}
        >
          {author}
        </span>
        <span
          className={`block text-xs font-['Inter'] truncate ${
            isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'
          }`}
        >
          {preview.text || 'Mensaje'}
        </span>
      </button>
    );
  };

  const renderBody = () => {
    if (isDeleted) {
      return (
        <div
          className={`flex items-center gap-1.5 text-xs italic py-0.5 font-['Inter'] ${
            isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'
          }`}
        >
          <Ban className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          <span>{isMine ? 'Eliminaste este mensaje' : 'Se eliminó este mensaje'}</span>
          <span className="flex-1">{metadata}</span>
        </div>
      );
    }

    if (message.decryptionError) {
      return (
        <div className="flex items-center gap-1.5 text-xs italic py-1 text-[#B03030] dark:text-[#FDEBD3]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          <span>No se pudo leer este mensaje</span>
          <span className="flex-1">{metadata}</span>
        </div>
      );
    }

    const text = message.payload?.text || '';

    // Sticker: la imagen sola y la hora en una etiquetita
    if (media && esSticker) {
      return (
        <>
          {media}
          <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mt-0.5`}>
            <span className="inline-flex items-center px-1.5 pb-[5px] rounded-[8px] bg-[#1F2933]/55 [&_*]:!text-white">{metadata}</span>
          </div>
        </>
      );
    }

    // Foto, video o audio: el archivo y debajo el texto (si tiene) con la hora
    if (media) {
      return (
        <>
          {media}
          {text ? (
            <div className="mt-1 text-[14px] leading-[19px] font-['Inter'] break-words whitespace-pre-wrap max-w-[240px]">
              {text}
              {metadata}
            </div>
          ) : (
            <div className="flow-root">{metadata}</div>
          )}
        </>
      );
    }

    const segments = parseTextWithLinks(text);
    return (
      <div className="text-[14px] leading-[19px] font-['Inter'] break-words whitespace-pre-wrap">
        {segments.map((seg, idx) => {
          if (seg.type === 'link') {
            return (
              <span key={idx} className="inline-block my-0.5">
                <a
                  href={seg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline font-medium hover:opacity-80 transition-opacity ${
                    isMine ? 'text-white' : 'text-[#005198] dark:text-[#FFFFFF]'
                  }`}
                >
                  {seg.content}
                </a>
                {seg.domain && (
                  <span
                    className={`block text-[10px] font-mono mt-0.5 ${
                      isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'
                    }`}
                  >
                    {seg.domain} ↗
                  </span>
                )}
              </span>
            );
          }
          return <span key={idx}>{seg.content}</span>;
        })}
        {metadata}
      </div>
    );
  };

  // Agrupar reacciones iguales: { '❤️': ['id1', 'id2'] }
  const grouped = reactions.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] = acc[r.emoji] || []).push(r.user_id);
    return acc;
  }, {});
  const groupedEntries = Object.entries(grouped);

  // Los stickers van sin burbuja, como en WhatsApp
  const esSticker = !isDeleted && !message.decryptionError && !!message.payload?.media?.sticker && !message.view_once;

  // Colores de la burbuja (también los usa la colita)
  const bubbleColor = esSticker
    ? 'bg-transparent text-[#1F2933] dark:text-white'
    : isMine
    ? 'bg-[#005198] text-[#FFFFFF]'
    : 'bg-white dark:bg-[#003A73] text-[#1F2933] dark:text-[#FFFFFF]';
  const tailColor = isMine ? 'text-[#005198]' : 'text-white dark:text-[#003A73]';

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex flex-col w-full ${isMine ? 'items-end' : 'items-start'} ${isFirstInGroup ? 'mt-2' : 'mt-0.5'}`}
    >
      <div
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: swipeX ? `translateX(${swipeX}px)` : undefined,
          transition: swipeX ? 'none' : 'transform 150ms ease-out',
          WebkitTouchCallout: 'none',
        }}
        className={`group relative max-w-[min(85%,34rem)] ${esSticker ? 'p-0' : 'px-2 pt-1.5 pb-2 rounded-[5px] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'} select-none md:select-text ${bubbleColor} ${
          isFirstInGroup ? (isMine ? 'rounded-tr-none' : 'rounded-tl-none') : ''
        } ${highlighted ? 'outline outline-2 outline-[#005198] dark:outline-white' : ''}`}
      >
        {/* Ícono que aparece al deslizar para responder */}
        {swipeX > 0 && (
          <span
            className="absolute top-1/2 -translate-y-1/2 -left-9 w-7 h-7 flex items-center justify-center text-[#5B6670] dark:text-[#E3E7EC]"
            style={{ opacity: Math.min(swipeX / SWIPE_REPLY_PX, 1) }}
            aria-hidden="true"
          >
            <Reply className="w-5 h-5" strokeWidth={2} />
          </span>
        )}

        {/* Colita de la burbuja (solo el primer mensaje del grupo) */}
        {isFirstInGroup && !esSticker && (
          <svg
            viewBox="0 0 8 13"
            width="8"
            height="13"
            aria-hidden="true"
            className={`absolute top-0 ${isMine ? '-right-2' : '-left-2'} ${tailColor}`}
          >
            <path
              fill="currentColor"
              d={isMine ? 'M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z' : 'M2.812 0H8v11.193L1.533 2.568C.474 1.156 1.042 0 2.812 0z'}
            />
          </svg>
        )}

        {/* Botón de opciones al pasar el mouse (computador) */}
        {!(isDeleted && !isMine) && !message.isPending && (
          <button
            type="button"
            onClick={() => onOpenActions(message)}
            className={`hidden md:group-hover:flex absolute top-1 right-1 w-6 h-6 items-center justify-center rounded-[2px] ${
              isMine ? 'bg-[#005198] text-white' : 'bg-white dark:bg-[#003A73] text-[#5B6670] dark:text-[#E3E7EC]'
            } ${isFirstInGroup ? 'top-0.5' : ''
            }`}
            title="Opciones del mensaje"
            aria-label="Opciones del mensaje"
          >
            <ChevronDown className="w-4 h-4" strokeWidth={2} />
          </button>
        )}

        {renderQuote()}
        {renderBody()}

      </div>

      {/* Reacciones debajo de la burbuja */}
      {groupedEntries.length > 0 && !isDeleted && (
        <div className={`flex gap-1 -mt-1 mb-1 ${isMine ? 'mr-2' : 'ml-2'} relative z-[1]`}>
          {groupedEntries.map(([emoji, users]) => {
            const mineReacted = users.includes(myId);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onReactionClick(message, emoji)}
                title={mineReacted ? 'Quitar tu reacción' : 'Reaccionar igual'}
                className={`h-6 px-1.5 flex items-center gap-0.5 rounded-[5px] bg-white dark:bg-[#253240] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border text-xs ${
                  mineReacted ? 'border-[#005198] dark:border-white' : 'border-[#E3E7EC] dark:border-[#003A73]'
                }`}
              >
                <span>{emoji}</span>
                {users.length > 1 && (
                  <span className="text-[10px] font-['Inter'] font-semibold text-[#5B6670] dark:text-[#E3E7EC]">
                    {users.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
