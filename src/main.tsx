import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registro automático del service worker para capacidades PWA y caché offline
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
