import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { refreshPushSubscription, unlockSound, updateBadge } from './lib/push';

// Si una versión vieja de la app se abrió en lugar de la página de fotos compartidas,
// se actualiza y se vuelve a cargar esa página (una sola vez)
const enPaginaCompartida = location.pathname.endsWith('/compartir.html');
if (enPaginaCompartida) {
  const intento = Number(sessionStorage.getItem('chatdos:recargaCompartir') || '0');
  sessionStorage.setItem('chatdos:recargaCompartir', String(intento + 1));
  if (intento === 0) {
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).finally(() => setTimeout(() => location.reload(), 800));
  } else if (intento === 1) {
    // Si sigue la versión vieja, se quita el servicio de la app vieja (se vuelve a instalar solo al abrir ChatDos)
    navigator.serviceWorker
      ?.getRegistrations()
      .then((rs) => Promise.all(rs.map((r) => r.unregister())))
      .finally(() => location.reload());
  }
}

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

if (!enPaginaCompartida) createRoot(document.getElementById('root')!).render(<App />);
