import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { refreshPushSubscription, unlockSound, updateBadge } from './lib/push';

// Registro automático del service worker para capacidades PWA y caché offline
registerSW({ immediate: true });
unlockSound();
setTimeout(() => {
  refreshPushSubscription();
  updateBadge();
}, 3000);

// Mantener presionado no abre el menú del navegador (salvo donde se escribe)
document.addEventListener('contextmenu', (e) => {
  const t = e.target as HTMLElement | null;
  if (t?.closest('input, textarea, [contenteditable="true"], .se-puede-seleccionar')) return;
  e.preventDefault();
});
// Sin arrastrar imágenes ni enlaces como en una página web
document.addEventListener('dragstart', (e) => {
  const t = e.target as HTMLElement | null;
  if (t?.closest('img, a, video')) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(<App />);
