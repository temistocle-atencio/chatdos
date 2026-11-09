import React from 'react';
import { Reply, Copy, Pencil, Trash2, EyeOff, Plus, X } from 'lucide-react';
import type { DecryptedMessage } from '../types/chat';

// Reacciones rápidas, como en WhatsApp
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

// Se puede editar un texto propio durante 15 minutos (la base de datos también lo revisa)
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

interface MessageActionsSheetProps {
  message: DecryptedMessage;
  isMine: boolean;
  myReaction: string | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onMoreReactions: () => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForAll: () => void;
}

export const MessageActionsSheet: React.FC<MessageActionsSheetProps> = ({
  message,
  isMine,
  myReaction,
  onClose,
  onReact,
  onMoreReactions,
  onReply,
  onCopy,
  onEdit,
  onDeleteForMe,
  onDeleteForAll,
}) => {
  const isDeleted = message.deleted_for_all;
  const hasText = !!message.payload?.text && !message.decryptionError;
  const canEdit =
    isMine &&
    !isDeleted &&
    message.kind === 'text' &&
    hasText &&
    Date.now() - new Date(message.created_at).getTime() < EDIT_WINDOW_MS;

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    danger = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full h-12 px-4 flex items-center gap-3 text-sm font-['Inter'] text-left hover:bg-[#F2F4F7] dark:hover:bg-white/5 transition-colors ${
        danger ? 'text-[#B03030] dark:text-[#FDEBD3]' : 'text-[#1F2933] dark:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[#253240] rounded-t-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-['Poppins'] font-medium uppercase tracking-[0.06em] text-[#5B6670] dark:text-[#E3E7EC]">
            Mensaje
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[#5B6670] dark:text-[#E3E7EC]"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Barra de reacciones */}
        {!isDeleted && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#E3E7EC] dark:border-[#003A73]">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className={`w-11 h-11 flex items-center justify-center text-2xl rounded-[5px] transition-transform active:scale-90 ${
                  myReaction === emoji ? 'bg-[#F2F4F7] dark:bg-white/10' : ''
                }`}
                aria-label={`Reaccionar con ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={onMoreReactions}
              className="w-11 h-11 flex items-center justify-center text-[#5B6670] dark:text-[#E3E7EC]"
              aria-label="Más emojis"
              title="Más emojis"
            >
              <Plus className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        )}

        <div className="py-1">
          {!isDeleted && item(<Reply className="w-5 h-5" strokeWidth={2} />, 'Responder', onReply)}
          {hasText && !isDeleted && item(<Copy className="w-5 h-5" strokeWidth={2} />, 'Copiar texto', onCopy)}
          {canEdit && item(<Pencil className="w-5 h-5" strokeWidth={2} />, 'Editar', onEdit)}
          {item(<EyeOff className="w-5 h-5" strokeWidth={2} />, 'Eliminar para mí', onDeleteForMe)}
          {isMine && !isDeleted && !message.isPending &&
            item(<Trash2 className="w-5 h-5" strokeWidth={2} />, 'Eliminar para todos', onDeleteForAll, true)}
        </div>
      </div>
    </div>
  );
};
