// Abrir la base de datos del celular (IndexedDB) sin quedarse colgado.
// En algunos iPhone y Android la primera apertura a veces nunca responde y la app se queda
// en la pantalla de carga hasta salir y volver a entrar. Aquí se "despierta" primero y,
// si no contesta, se vuelve a intentar.

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

let despierta: Promise<void> | null = null;
function despertar(): Promise<void> {
  if (despierta) return despierta;
  const idb = indexedDB as IDBFactory & { databases?: () => Promise<unknown> };
  if (typeof idb.databases !== 'function') return (despierta = Promise.resolve());
  despierta = (async () => {
    for (let i = 0; i < 10; i++) {
      const listo = await Promise.race([idb.databases!().then(() => true, () => true), esperar(100).then(() => false)]);
      if (listo) return;
    }
  })();
  return despierta;
}

export async function abrirIDB(nombre: string, version: number, crear: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  await despertar();
  return new Promise<IDBDatabase>((resolve, reject) => {
    let listo = false;
    const intentar = () => {
      const req = indexedDB.open(nombre, version);
      req.onupgradeneeded = () => crear(req.result);
      req.onsuccess = () => {
        if (listo) return req.result.close(); // ya respondió otro intento
        listo = true;
        const db = req.result;
        // Si otra pestaña necesita actualizarla, se suelta para no bloquearla
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => {
        if (!listo) {
          listo = true;
          reject(req.error);
        }
      };
    };
    intentar();
    // Si no contesta, se intenta otra vez (es lo que lo destraba)
    setTimeout(() => !listo && intentar(), 1500);
    setTimeout(() => !listo && intentar(), 4000);
    setTimeout(() => {
      if (!listo) {
        listo = true;
        reject(new Error('La base de datos del celular no respondió'));
      }
    }, 12000);
  });
}
