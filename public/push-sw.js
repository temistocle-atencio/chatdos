// Parte del service worker de ChatDos: recibe las notificaciones push.
// La notificación solo dice quién escribió y el tipo de mensaje (el texto está cifrado).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || 'ChatDos';
  const opciones = {
    body: data.body || 'Tienes un mensaje nuevo',
    icon: '/chatdos/pwa-192x192.png',
    badge: '/chatdos/pwa-192x192.png',
    tag: data.tag || 'chatdos',
    renotify: true,
    data: { url: data.url || '/chatdos/' },
  };

  event.waitUntil(
    (async () => {
      // Si la app está abierta y a la vista, el sonido lo pone la propia app;
      // aun así iPhone exige mostrar una notificación por cada aviso.
      await self.registration.showNotification(title, opciones);
      if (typeof data.badge === 'number' && self.navigator && self.navigator.setAppBadge) {
        try {
          await self.navigator.setAppBadge(data.badge);
        } catch (e) {
          /* nada */
        }
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/chatdos/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of ventanas) {
        if (c.url.startsWith(self.location.origin + '/chatdos/')) {
          await c.focus();
          if ('navigate' in c) {
            try {
              await c.navigate(url);
            } catch (e) {
              /* nada */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
