import React, { useRef } from 'react';
import { Clock, AlertTriangle, Ban, ChevronDown } from 'lucide-react';
import type { DecryptedMessage, Reaction } from '../types/chat';
import { formatMessageTime, parseTextWithLinks } from '../lib/formatters';

interface MessageItemProps {
  message: DecryptedMessage;
  isMine: boolean;
  myId: string;
  partnerName: string;
  reactions: Reaction[];
  highlighted?: boolean;
  onOpenActions: (message: DecryptedMessage) => void;
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
  onOpenActions,
  onQuoteClick,
  onReactionClick,
}) => {
  const timeStr = formatMessageTime(message.payload?.sentAt || message.created_at || Date.now());
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDeleted = message.deleted_for_all;

  // Mantener presionado (celular)
  const startPress = () => {
    if (isDeleted && !isMine) return;
    pressTimer.current = setTimeout(() => onOpenActions(message), LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
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
        <span title="Guardando mensaje...">
          <Clock className="w-3 h-3 text-white/90 animate-pulse ml-1 inline-block" strokeWidth={2} />
        </span>
      );
    }
    if (message.read_at) {
      return (
        <span
          className="text-white font-black tracking-tighter text-[11px] ml-1 select-none"
          title={`Leído a las ${formatMessageTime(message.read_at)}`}
        >
          ✓✓
        </span>
      );
    }
    if (message.delivered_at) {
      return (
        <span
          className="text-white/85 font-semibold tracking-tighter text-[11px] ml-1 select-none"
          title={`Entregado a las ${formatMessageTime(message.delivered_at)}`}
        >
          ✓✓
        </span>
      );
    }
    return (
      <span className="text-white/85 font-semibold text-[11px] ml-1 select-none" title="Guardado en servidor">
        ✓
      </span>
    );
  };

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
        </div>
      );
    }

    if (message.decryptionError) {
      return (
        <div className="flex items-center gap-1.5 text-xs italic py-1 text-[#B03030] dark:text-[#FDEBD3]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          <span>No se pudo leer este mensaje</span>
        </div>
      );
    }

    const segments = parseTextWithLinks(message.payload?.text || '');
    return (
      <div className="text-sm font-['Inter'] break-words whitespace-pre-wrap">
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
      </div>
    );
  };

  // Agrupar reacciones iguales: { '❤️': ['id1', 'id2'] }
  const grouped = reactions.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] = acc[r.emoji] || []).push(r.user_id);
    return acc;
  }, {});
  const groupedEntries = Object.entries(grouped);

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex flex-col w-full ${isMine ? 'items-end' : 'items-start'} my-1`}
    >
      <div
        onContextMenu={handleContextMenu}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        className={`group relative max-w-[82%] px-3.5 py-2 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] leading-relaxed select-text transition-[outline] ${
          highlighted ? 'outline outline-2 outline-[#005198] dark:outline-white' : ''
        } ${
          isMine
            ? 'bg-[#005198] text-[#FFFFFF] rounded-br-[2px]'
            : 'bg-white dark:bg-[#003A73] text-[#1F2933] dark:text-[#FFFFFF] border border-[#E3E7EC] dark:border-[#003A73] rounded-bl-[2px]'
        }`}
      >
        {/* Botón de opciones al pasar el mouse (computador) */}
        {!(isDeleted && !isMine) && !message.isPending && (
          <button
            type="button"
            onClick={() => onOpenActions(message)}
            className={`hidden md:group-hover:flex absolute top-1 right-1 w-6 h-6 items-center justify-center rounded-[2px] ${
              isMine ? 'bg-[#005198] text-white' : 'bg-white dark:bg-[#003A73] text-[#5B6670] dark:text-[#E3E7EC]'
            }`}
            title="Opciones del mensaje"
            aria-label="Opciones del mensaje"
          >
            <ChevronDown className="w-4 h-4" strokeWidth={2} />
          </button>
        )}

        {renderQuote()}
        {renderBody()}

        {/* Hora, "editado" y checks */}
        <div
          className={`text-[10px] flex items-center justify-end gap-1 mt-1 font-['Inter'] select-none ${
            isMine ? 'text-white/85' : 'text-[#5B6670] dark:text-[#E3E7EC]'
          }`}
        >
          {message.edited_at && !isDeleted && <span className="italic">editado</span>}
          <span className="font-medium">{timeStr}</span>
          {renderStatus()}
        </div>
      </div>

      {/* Reacciones debajo de la burbuja */}
      {groupedEntries.length > 0 && !isDeleted && (
        <div className={`flex gap-1 -mt-1.5 ${isMine ? 'mr-2' : 'ml-2'} relative z-[1]`}>
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
