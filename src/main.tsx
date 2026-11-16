import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './hooks/usePWAInstall'; // escucha desde el inicio el aviso de "se puede instalar"
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

// Service worker (app sin internet y avisos).
// Las versiones nuevas se descargan por detrás y SOLO se aplican en un momento seguro:
// apenas se abre la app (antes de tocar nada) o al volver después de un buen rato fuera.
// Antes se recargaba sola en cualquier momento, y eso dejaba la pantalla en blanco o negra.
const inicio = Date.now();
let ocultaDesde = 0;
let hayVersionNueva = false;
let tocoAlgo = false;
const aplicar = registerSW({
  immediate: true,
  onNeedRefresh() {
    hayVersionNueva = true;
    if (Date.now() - inicio < 4000 && !tocoAlgo) void aplicar(true);
  },
  onRegisteredSW(_url, r) {
    // Revisar si hay versión nueva cada 30 minutos con la app abierta
    if (r) setInterval(() => !document.hidden && r.update().catch(() => {}), 30 * 60 * 1000);
  },
});
addEventListener('pointerdown', () => (tocoAlgo = true), { once: true, capture: true });
addEventListener('keydown', () => (tocoAlgo = true), { once: true, capture: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    ocultaDesde = Date.now();
    return;
  }
  if (hayVersionNueva && ocultaDesde && Date.now() - ocultaDesde > 10 * 60 * 1000) void aplicar(true);
});
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
