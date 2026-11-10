import React, { useEffect, useRef } from 'react';
import 'emoji-picker-element';
import es from 'emoji-picker-element/i18n/es';
import { Smile, Sticker as IconoSticker } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { StickerPanel } from './StickerPanel';
import type { Sticker } from '../lib/stickers';

export type PestanaExpresiones = 'emojis' | 'stickers';

// Emojis dentro del panel (sin ventana flotante)
const Emojis: React.FC<{ onEmoji: (e: string) => void }> = ({ onEmoji }) => {
  const caja = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const alEmoji = useRef(onEmoji);
  alEmoji.current = onEmoji;

  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const picker = document.createElement('emoji-picker') as HTMLElement & { i18n: unknown; locale: string; dataSource: string };
    picker.i18n = es;
    picker.locale = 'es';
    picker.dataSource = 'https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1/es/cldr/data.json';
    picker.classList.add(resolvedTheme === 'dark' ? 'dark' : 'light');
    picker.style.width = '100%';
    picker.style.height = '100%';
    picker.style.border = 'none';
    picker.style.setProperty('--border-size', '0');
    picker.style.setProperty('--background', 'transparent');
    const clic = (ev: Event) => {
      const d = (ev as CustomEvent<{ unicode?: string; emoji?: { unicode?: string } }>).detail;
      const e = d?.unicode || d?.emoji?.unicode || '';
      if (e) alEmoji.current(e);
    };
    picker.addEventListener('emoji-click', clic);
    c.appendChild(picker);
    return () => {
      picker.removeEventListener('emoji-click', clic);
      picker.remove();
    };
  }, [resolvedTheme]);

  return <div ref={caja} className="w-full h-full" />;
};

/** Panel debajo de la barra de escribir, en el lugar del teclado: emojis y stickers. */
export const PanelExpresiones: React.FC<{
  pestana: PestanaExpresiones;
  onPestana: (p: PestanaExpresiones) => void;
  onEmoji: (e: string) => void;
  userId: string;
  miLlavePublica: unknown;
  onSticker: (s: Sticker) => void;
  onCerrar: () => void;
  onAviso: (t: string) => void;
}> = ({ pestana, onPestana, onEmoji, userId, miLlavePublica, onSticker, onCerrar, onAviso }) => {
  const boton = (p: PestanaExpresiones, Icono: typeof Smile, texto: string) => (
    <button
      type="button"
      onClick={() => onPestana(p)}
      className={`flex-1 h-9 rounded-full flex items-center justify-center gap-1.5 text-xs font-['Poppins'] font-semibold transition-colors ${
        pestana === p
          ? 'bg-[#005198] text-white dark:bg-white dark:text-[#003A73]'
          : 'text-[#5B6670] dark:text-[#E3E7EC]'
      }`}
      aria-pressed={pestana === p}
    >
      <Icono className="w-4 h-4" strokeWidth={2} />
      {texto}
    </button>
  );

  return (
    <div className="mt-2 -mx-2 bg-white dark:bg-[#253240] border-t border-[#E3E7EC] dark:border-[#003A73] flex flex-col" style={{ height: 'min(42dvh, 340px)' }}>
      <div className="mx-auto mt-2 mb-1 flex gap-1 p-1 w-56 rounded-full border border-[#E3E7EC] dark:border-[#003A73] shrink-0">
        {boton('emojis', Smile, 'Emojis')}
        {boton('stickers', IconoSticker, 'Stickers')}
      </div>
      <div className="flex-1 min-h-0">
        {pestana === 'emojis' ? (
          <Emojis onEmoji={onEmoji} />
        ) : (
          <StickerPanel
            incrustado
            userId={userId}
            miLlavePublica={miLlavePublica}
            onEnviar={onSticker}
            onCerrar={onCerrar}
            onAviso={onAviso}
          />
        )}
      </div>
    </div>
  );
};
