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

createRoot(document.getElementById('root')!).render(<App />);
