import React, { useEffect, useRef } from 'react';
import 'emoji-picker-element';
import { useTheme } from '../context/ThemeContext';

interface EmojiPickerPopoverProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  onSelectEmoji,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Crear el elemento web component
    const picker = document.createElement('emoji-picker');
    picker.classList.add(resolvedTheme === 'dark' ? 'dark' : 'light');
    picker.style.width = '100%';
    picker.style.height = '320px';
    picker.style.borderRadius = '5px';
    picker.style.border = '1px solid #E3E7EC';

    const handleEmojiClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ unicode?: string; emoji?: { unicode?: string } }>;
      const emoji =
        customEvent.detail?.unicode || customEvent.detail?.emoji?.unicode || '';
      if (emoji) {
        onSelectEmoji(emoji);
      }
    };

    picker.addEventListener('emoji-click', handleEmojiClick);
    container.appendChild(picker);

    // Cierre al hacer clic fuera
    const handleOutsideClick = (e: MouseEvent) => {
      if (container && !container.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      picker.removeEventListener('emoji-click', handleEmojiClick);
      document.removeEventListener('mousedown', handleOutsideClick);
      if (container.contains(picker)) {
        container.removeChild(picker);
      }
    };
  }, [resolvedTheme, onSelectEmoji, onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-16 left-2 right-2 max-w-sm mx-auto z-50 bg-white dark:bg-[#253240] rounded-[5px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] border border-[#E3E7EC] dark:border-[#003A73] overflow-hidden"
    />
  );
};
