import { useEffect, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// El navegador avisa UNA sola vez que se puede instalar. Antes ese aviso se guardaba en el botón,
// y al entrar a un chat (donde no hay barra de arriba) el botón se borraba y se perdía el aviso.
// Ahora se guarda para toda la sesión: el botón vuelve a aparecer al regresar a las conversaciones.
const CLAVE = 'chatdos:instalada';
let aviso: BeforeInstallPromptEvent | null = null;
const enModoApp = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;
const leerGuardado = () => {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
};
const marcarInstalada = (si: boolean) => {
  try {
    if (si) localStorage.setItem(CLAVE, '1');
    else localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
};
let instalada = typeof window !== 'undefined' && (enModoApp() || leerGuardado());
if (typeof window !== 'undefined' && enModoApp()) marcarInstalada(true);

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
let version = 0;
const cambio = () => {
  version++;
  avisar();
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    aviso = e as BeforeInstallPromptEvent;
    // Si el navegador ofrece instalar, es que NO está instalada (la desinstalaron)
    if (instalada && !enModoApp()) {
      instalada = false;
      marcarInstalada(false);
    }
    cambio();
  });
  window.addEventListener('appinstalled', () => {
    instalada = true;
    aviso = null;
    marcarInstalada(true);
    cambio();
  });
  // Chrome en Android: preguntar si la app ya está instalada en el celular
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  nav.getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.length && !instalada) {
        instalada = true;
        marcarInstalada(true);
        cambio();
      }
    })
    .catch(() => {});
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

export function usePWAInstall() {
  useSyncExternalStore(suscribir, () => version);
  useEffect(() => {
    // Si se instala desde el menú del navegador, al abrirla como app queda marcada
    const mq = window.matchMedia('(display-mode: standalone)');
    const f = () => {
      if (mq.matches) {
        instalada = true;
        marcarInstalada(true);
        cambio();
      }
    };
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  const install = async () => {
    if (!aviso) return false;
    const a = aviso;
    await a.prompt();
    const { outcome } = await a.userChoice;
    if (outcome === 'accepted') {
      instalada = true;
      aviso = null;
      marcarInstalada(true);
      cambio();
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!aviso,
    isInstalled: instalada,
    isIOS,
    install,
  };
}
