import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import type { DecryptedMessage } from '../types/chat';
import { formatMessageTime, parseTextWithLinks } from '../lib/formatters';

interface MessageItemProps {
  message: DecryptedMessage;
  isMine: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isMine }) => {
  const timeStr = formatMessageTime(message.payload?.sentAt || message.created_at || Date.now());

  // Renderizar estado de envío / checks dentro de la burbuja (solo para mis mensajes)
  const renderStatus = () => {
    if (!isMine) return null;

    if (message.isPending) {
      return (
        <span title="Guardando mensaje...">
          <Clock
            className="w-3 h-3 text-white/90 animate-pulse ml-1 inline-block"
            strokeWidth={2}
          />
        </span>
      );
    }

    if (message.read_at) {
      // 2 checks blancos, opacos y más gruesos = leído (visibles con máximo contraste sobre #005198)
      return (
        <span
          className="text-white font-black tracking-tighter text-[11px] ml-1 select-none drop-shadow-xs"
          title={`Leído a las ${formatMessageTime(message.read_at)}`}
        >
          ✓✓
        </span>
      );
    }

    if (message.delivered_at) {
      // 2 checks entregado: blancos nítidos
      return (
        <span
          className="text-white/85 font-semibold tracking-tighter text-[11px] ml-1 select-none"
          title={`Entregado a las ${formatMessageTime(message.delivered_at)}`}
        >
          ✓✓
        </span>
      );
    }

    // 1 check = guardado en servidor
    return (
      <span
        className="text-white/85 font-semibold text-[11px] ml-1 select-none"
        title="Guardado en servidor"
      >
        ✓
      </span>
    );
  };

  const textContent = message.payload?.text || '';
  const segments = parseTextWithLinks(textContent);

  return (
    <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} my-1`}>
      <div
        className={`relative max-w-[82%] px-3.5 py-2 rounded-[5px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] leading-relaxed select-text ${
          isMine
            ? 'bg-[#005198] text-[#FFFFFF] rounded-br-[2px]'
            : 'bg-white dark:bg-[#003A73] text-[#1F2933] dark:text-[#FFFFFF] border border-[#E3E7EC] dark:border-[#003A73] rounded-bl-[2px]'
        }`}
      >
        {message.decryptionError ? (
          <div className="flex items-center gap-1.5 text-xs italic py-1 text-[#B03030] dark:text-[#FDEBD3]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            <span>No se pudo leer este mensaje</span>
          </div>
        ) : (
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
                        isMine
                          ? 'text-white'
                          : 'text-[#005198] dark:text-[#FFFFFF]'
                      }`}
                    >
                      {seg.content}
                    </a>
                    {seg.domain && (
                      <span
                        className={`block text-[10px] font-mono mt-0.5 ${
                          isMine
                            ? 'text-white/85'
                            : 'text-[#5B6670] dark:text-[#E3E7EC]'
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
        )}

        {/* Hora y checks dentro de la burbuja */}
        <div
          className={`text-[10px] flex items-center justify-end gap-1 mt-1 font-['Inter'] select-none ${
            isMine
              ? 'text-white/85'
              : 'text-[#5B6670] dark:text-[#E3E7EC]'
          }`}
        >
          <span className="font-medium">{timeStr}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
};
