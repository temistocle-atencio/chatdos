// Gestión de IndexedDB nativo para almacenar llaves criptográficas no extraíbles
const DB_NAME = 'chatdos_keystore';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openCryptoDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Almacén de llave privada del usuario actual (indexado por user_id)
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'user_id' });
      }

      // Almacén de llaves públicas conocidas de compañeros (para detectar cambios de llave)
      if (!db.objectStoreNames.contains('partner_keys')) {
        db.createObjectStore('partner_keys', { keyPath: 'partner_id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

export async function loadLocalPrivateKey(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openCryptoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readonly');
      const store = tx.objectStore('keys');
      const request = store.get(userId);

      request.onsuccess = () => {
        if (request.result && request.result.privateKey) {
          resolve(request.result.privateKey as CryptoKey);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IDB] Error al leer llave privada:', err);
    return null;
  }
}

export async function saveLocalPrivateKey(userId: string, privateKey: CryptoKey): Promise<void> {
  const db = await openCryptoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    const store = tx.objectStore('keys');
    const request = store.put({
      user_id: userId,
      privateKey,
      updated_at: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearLocalPrivateKey(userId: string): Promise<void> {
  try {
    const db = await openCryptoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite');
      const store = tx.objectStore('keys');
      const request = store.delete(userId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IDB] Error al eliminar llave privada:', err);
  }
}

export async function getKnownPartnerKey(partnerId: string): Promise<string | null> {
  try {
    const db = await openCryptoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('partner_keys', 'readonly');
      const store = tx.objectStore('partner_keys');
      const request = store.get(partnerId);

      request.onsuccess = () => {
        resolve(request.result?.thumbprint || null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IDB] Error al leer llave pública conocida:', err);
    return null;
  }
}

export async function saveKnownPartnerKey(partnerId: string, thumbprint: string): Promise<void> {
  const db = await openCryptoDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('partner_keys', 'readwrite');
    const store = tx.objectStore('partner_keys');
    const request = store.put({
      partner_id: partnerId,
      thumbprint,
      updated_at: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
