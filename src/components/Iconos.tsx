import React from 'react';

// Íconos propios de ChatDos. Los de línea usan "currentColor" para tomar el color del texto
// (así se ven bien en modo claro y oscuro). Los del menú de adjuntar van a color.

type P = { className?: string };

/** Cara de sticker: botón de la izquierda de "Mensaje" */
export const IconoStickerCara: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M9 16C9.85 16.63 10.88 17 12 17C13.12 17 14.15 16.63 15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <ellipse cx="15" cy="10.5" rx="1" ry="1.5" fill="currentColor" />
    <ellipse cx="9" cy="10.5" rx="1" ry="1.5" fill="currentColor" />
    <path
      d="M15 22H12C7.29 22 4.93 22 3.46 20.54C2 19.07 2 16.71 2 12C2 7.29 2 4.93 3.46 3.46C4.93 2 7.29 2 12 2C16.71 2 19.07 2 20.54 3.46C21.51 4.44 21.84 5.81 21.94 8M15 22C18.87 22 22 18.87 22 15M15 22C15 20.14 15 19.21 15.24 18.45C15.74 16.93 16.93 15.74 18.45 15.24C19.21 15 20.14 15 22 15M22 12V15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/** Sticker sin cara: pestaña de stickers */
export const IconoSticker: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M15 22H12C7.29 22 4.93 22 3.46 20.54C2 19.07 2 16.71 2 12C2 7.29 2 4.93 3.46 3.46C4.93 2 7.29 2 12 2C16.71 2 19.07 2 20.54 3.46C21.51 4.44 21.84 5.81 21.94 8M15 22C18.87 22 22 18.87 22 15M15 22C15 20.14 15 19.21 15.24 18.45C15.74 16.93 16.93 15.74 18.45 15.24C19.21 15 20.14 15 22 15M22 12V15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/** Cara feliz: pestaña de emojis */
export const IconoEmoji: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 128 128" className={className} fill="currentColor" aria-hidden="true">
    <path d="M64,3A61,61,0,1,1,3,64,61.06,61.06,0,0,1,64,3m0-3a64,64,0,1,0,64,64A64,64,0,0,0,64,0Z" stroke="currentColor" strokeWidth="4" />
    <path d="M64,94.81c-.93,0-1.87,0-2.84-.1a40.4,40.4,0,0,1-20.23-7.22A1.5,1.5,0,1,1,42.6,85a37.39,37.39,0,0,0,18.72,6.69A37.93,37.93,0,0,0,85.41,85a1.5,1.5,0,0,1,2.08.38,1.48,1.48,0,0,1-.38,2.08A41.09,41.09,0,0,1,64,94.81Z" stroke="currentColor" strokeWidth="4" />
    <path d="M36.87,60.63a1.53,1.53,0,0,1-.71-.18,1.5,1.5,0,0,1-.61-2,9.39,9.39,0,0,1,16.56,0,1.5,1.5,0,0,1-2.65,1.42,6.39,6.39,0,0,0-11.27,0A1.51,1.51,0,0,1,36.87,60.63Z" stroke="currentColor" strokeWidth="4" />
    <path d="M92.52,60.63a1.51,1.51,0,0,1-1.32-.79,6.39,6.39,0,0,0-11.27,0,1.5,1.5,0,1,1-2.64-1.42,9.38,9.38,0,0,1,16.55,0,1.5,1.5,0,0,1-.61,2A1.53,1.53,0,0,1,92.52,60.63Z" stroke="currentColor" strokeWidth="4" />
  </svg>
);

/** Sticker con +: crear sticker */
export const IconoCrearSticker: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.5 12a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 2-.09.01a.5.5 0 0 0-.4.4L17 14.5V17h-2.5l-.09.01a.5.5 0 0 0-.4.4l-.01.09.01.09a.5.5 0 0 0 .4.4l.09.01H17v2.5l.01.09a.5.5 0 0 0 .4.4l.09.01.09-.01a.5.5 0 0 0 .4-.4l.01-.09V18h2.5l.09-.01a.5.5 0 0 0 .4-.4l.01-.09-.01-.09a.5.5 0 0 0-.4-.4L20.5 17H18v-2.5l-.01-.09a.5.5 0 0 0-.4-.4L17.5 14ZM17.75 3A3.25 3.25 0 0 1 21 6.25v5.77a6.45 6.45 0 0 0-1.5-.71V6.25c0-.97-.78-1.75-1.75-1.75H6.25c-.97 0-1.75.78-1.75 1.75v11.5c0 .97.78 1.75 1.75 1.75h5.06c.17.53.41 1.04.71 1.5H6.25A3.25 3.25 0 0 1 3 17.75V6.25A3.25 3.25 0 0 1 6.25 3h11.5ZM9.18 14.14c.7.49 1.48.77 2.32.85-.19.46-.33.95-.42 1.46a5.95 5.95 0 0 1-2.76-1.08.75.75 0 0 1 .86-1.23ZM9 7.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm6 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
  </svg>
);

/** GIF */
export const IconoGif: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" aria-hidden="true">
    <path d="M944 299H692c-4.4 0-8 3.6-8 8v406c0 4.4 3.6 8 8 8h59.2c4.4 0 8-3.6 8-8V549.9h168.2c4.4 0 8-3.6 8-8V495c0-4.4-3.6-8-8-8H759.2V364.2H944c4.4 0 8-3.6 8-8V307c0-4.4-3.6-8-8-8zM588 300h-56c-4.4 0-8 3.6-8 8v406c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V308c0-4.4-3.6-8-8-8zM452 500.9H290.5c-4.4 0-8 3.6-8 8v43.7c0 4.4 3.6 8 8 8h94.9l-.3 8.9c-1.2 58.8-45.6 98.5-110.9 98.5-76.2 0-123.9-59.7-123.9-156.7 0-95.8 46.8-155.2 121.5-155.2 54.8 0 93.1 26.9 108.5 75.4h76.2c-13.6-87.2-86-143.4-184.7-143.4C150 288 72 375.2 72 511.9 72 650.2 149.1 736 273 736c114.1 0 187-70.7 187-181.6v-45.5c0-4.4-3.6-8-8-8z" />
  </svg>
);

/** Cámara (barra de escribir) */
export const IconoCamara: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" aria-hidden="true">
    <path d="M864 248H728l-32.4-90.8a32.07 32.07 0 0 0-30.2-21.2H358.6c-13.5 0-25.6 8.5-30.1 21.2L296 248H160c-44.2 0-80 35.8-80 80v456c0 44.2 35.8 80 80 80h704c44.2 0 80-35.8 80-80V328c0-44.2-35.8-80-80-80zm8 536c0 4.4-3.6 8-8 8H160c-4.4 0-8-3.6-8-8V328c0-4.4 3.6-8 8-8h186.7l17.1-47.8 22.9-64.2h250.5l22.9 64.2 17.1 47.8H864c4.4 0 8 3.6 8 8v456zM512 384c-88.4 0-160 71.6-160 160s71.6 160 160 160 160-71.6 160-160-71.6-160-160-160zm0 256c-53 0-96-43-96-96s43-96 96-96 96 43 96 96-43 96-96 96z" />
  </svg>
);

/** Clip (adjuntar) */
export const IconoClip: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16,7l0,10.399c0,1.67-1.129,3.19-2.765,3.525C10.986,21.385,9,19.67,9,17.5L9,5.113c0-0.996,0.678-1.922,1.661-2.085 C11.913,2.821,13,3.786,13,5v10.5c0,0.276-0.225,0.5-0.5,0.5S12,15.776,12,15.5V7c0-0.552-0.448-1-1-1h0c-0.552,0-1,0.448-1,1 l0,8.353c0,1.308,0.939,2.502,2.24,2.634C13.735,18.139,15,16.964,15,15.5l0-10.322c0-2.088-1.523-3.956-3.601-4.158 C9.014,0.788,7,2.663,7,5l0,12.255c0,2.871,2.093,5.439,4.949,5.718C15.228,23.294,18,20.714,18,17.5V7c0-0.552-0.448-1-1-1h0 C16.448,6,16,6.448,16,7z" />
  </svg>
);

// ---------- A color (menú de adjuntar) ----------

export const IconoGaleriaColor: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <g fill="#0066FF" fillRule="evenodd">
      <path d="M4 3H15A2 2 0 0 1 17 5V15A2 2 0 0 1 15 17H4A2 2 0 0 1 2 15V5A2 2 0 0 1 4 3ZM4 14.5L6.5 10.8L9 13L12.2 8.5L15 14.5Z" />
      <path d="M19 7A1 1 0 0 1 21 7V19A2 2 0 0 1 19 21H6A1 1 0 0 1 6 19H19Z" />
    </g>
  </svg>
);

export const IconoCamaraColor: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#F52E71"
      fillRule="evenodd"
      d="M8.8 3H15.2C15.7 3 16.1 3.3 16.4 3.8L17.1 5H20A2 2 0 0 1 22 7V18A2 2 0 0 1 20 20H4A2 2 0 0 1 2 18V7A2 2 0 0 1 4 5H6.9L7.6 3.8C7.9 3.3 8.3 3 8.8 3ZM12 7.7A4.8 4.8 0 1 0 12 17.3A4.8 4.8 0 1 0 12 7.7ZM12 9.7A2.8 2.8 0 1 0 12 15.3A2.8 2.8 0 1 0 12 9.7Z"
    />
  </svg>
);

export const IconoContactoColor: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="cdContA" x1="14.85" x2="33.47" y1="26.47" y2="45.08" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#55adfd" />
        <stop offset="1" stopColor="#438ffd" />
      </linearGradient>
      <linearGradient id="cdContB" x1="14.71" x2="30.63" y1="26.32" y2="42.24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#427fdb" />
        <stop offset="1" stopColor="#0c52bb" />
      </linearGradient>
      <linearGradient id="cdContC" x1="18.34" x2="29.05" y1="6.34" y2="17.05" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#427fdb" />
        <stop offset="1" stopColor="#0c52bb" />
      </linearGradient>
    </defs>
    <path
      fill="url(#cdContA)"
      d="M7 41.5c0-.64 0-4.16 0-5.5 0-6.62 5.38-12 12-12 .52 0 1.21 0 2.01 0 .82 0 2.01 2 2.99 2 1.06 0 1.92-2 3-2 2.52 0 4.88 0 6 0 4.42 0 8 3.58 8 8 0 .69 0 3.31 0 4 0 4.42-3.58 8-8 8-.79 0-3.11 0-5.99 0-1.63 0-3.19-3-5.01-3-2.18 0-4.63 3-6.55 3-3.19 0-5.62 0-5.95 0C8.12 44 7 42.88 7 41.5z"
    />
    <path fill="url(#cdContB)" d="M13 41.5V32c0-4.42 3.58-8 8-8 1.06 0 4.94 0 6 0 4.42 0 8 3.58 8 8 0 .69 0 3.31 0 4 0 4.42-3.58 8-8 8H15.5C14.12 44 13 42.88 13 41.5z" />
    <circle fill="url(#cdContC)" cx="24" cy="12" r="8" />
  </svg>
);

export const IconoUbicacionColor: React.FC<P> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <clipPath id="cdPin">
        <path d="M24 4C15.72 4 9 10.72 9 19C9 23.85 11.25 28.15 14.85 31.85L22.9 43.15C23.45 43.92 24.55 43.92 25.1 43.15L33.15 31.85C36.75 28.15 39 23.85 39 19C39 10.72 32.28 4 24 4Z" />
      </clipPath>
    </defs>
    <g clipPath="url(#cdPin)">
      <rect width="48" height="48" fill="#1E8E3E" />
      <path d="M11.5 33.2Q24 25.2 36.5 33.2L36.5 36.5Q24 28.5 11.5 36.5Z" fill="#115926" opacity="0.55" />
      <path d="M12 34.4Q24 27 36 34.4L24 45Z" fill="#2AB34F" />
    </g>
    <circle cx="24" cy="19" r="6.8" fill="#F8F9FA" />
  </svg>
);
