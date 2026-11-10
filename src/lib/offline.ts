// Modo sin conexión: copia local (en el celular) de lo necesario para abrir la app sin internet.
// - Los mensajes se guardan TAL CUAL vienen del servidor: cifrados.
// - La "bandeja de salida" guarda los mensajes escritos sin señal para enviarlos al volver.
import type { DbMessage } from '../types/chat';
import type { Profile } from '../types/database';

const DB_NAME = 'chatdos_offline';
const DB_VERSION = 1;
const MAX_POR_CHAT = 300;

let dbPromise: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('chats')) db.createObjectStore('chats', { keyPath: 'chatId' });
      if (!db.objectStoreNames.contains('messages')) {
        const s = db.createObjectStore('messages', { keyPath: 'id' });
        s.createIndex('chat', 'chat_id');
      }
      if (!db.objectStoreNames.contains('outbox')) {
        const s = db.createObjectStore('outbox', { keyPath: 'id' });
        s.createIndex('chat', 'chatId');
      }
      if (!db.objectStoreNames.contains('misc')) db.createObjectStore('misc');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

const pedir = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

async function tienda(nombre: string, modo: IDBTransactionMode = 'readonly') {
  const db = await abrir();
  return db.transaction(nombre, modo).objectStore(nombre);
}

/** Cualquier error de la copia local se ignora: nunca debe romper la app. */
async function seguro<T>(fn: () => Promise<T>, porDefecto: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn('[offline]', e);
    return porDefecto;
  }
}

// ---------- Datos del chat (la otra persona) ----------
export interface ChatGuardado {
  chatId: string;
  partner: Profile;
}

export const guardarChat = (chatId: string, partner: Profile) =>
  seguro(async () => void (await pedir((await tienda('chats', 'readwrite')).put({ chatId, partner }))), undefined);

export const leerChat = (chatId: string) =>
  seguro(async () => ((await pedir((await tienda('chats')).get(chatId))) as ChatGuardado | undefined) ?? null, null);

// ---------- Mensajes (cifrados) ----------
export const guardarMensajes = (rows: DbMessage[]) =>
  seguro(async () => {
    if (!rows.length) return;
    const s = await tienda('messages', 'readwrite');
    rows.forEach((r) => s.put(r));
    await new Promise((res, rej) => {
      s.transaction.oncomplete = res;
      s.transaction.onerror = () => rej(s.transaction.error);
    });
  }, undefined);

export const borrarMensajeLocal = (id: string) =>
  seguro(async () => void (await pedir((await tienda('messages', 'readwrite')).delete(id))), undefined);

/** Borra del celular los mensajes de un chat que ya no existen en el servidor (vaciados o borrados). */
export const borrarMensajesLocalesExcepto = (chatId: string, conservar: Set<string>, desde?: string) =>
  seguro(async () => {
    const s = await tienda('messages', 'readwrite');
    const todos = (await pedir(s.index('chat').getAll(chatId))) as DbMessage[];
    todos.forEach((m) => {
      if (!conservar.has(m.id) && (!desde || m.created_at >= desde)) s.delete(m.id);
    });
  }, undefined);

/** Últimos mensajes guardados de un chat (del más viejo al más nuevo). Recorta los muy viejos. */
export const leerMensajes = (chatId: string, limite = 50) =>
  seguro(async () => {
    const s = await tienda('messages', 'readwrite');
    const todos = (await pedir(s.index('chat').getAll(chatId))) as DbMessage[];
    todos.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (todos.length > MAX_POR_CHAT) todos.slice(0, todos.length - MAX_POR_CHAT).forEach((m) => s.delete(m.id));
    return todos.slice(-limite);
  }, [] as DbMessage[]);

// ---------- Bandeja de salida ----------
export interface Pendiente {
  id: string; // = id del mensaje
  chatId: string;
  creado: number;
  /** Fila lista para guardar en "messages" (texto ya cifrado) */
  fila?: Record<string, unknown>;
  /** Para fotos, videos y audios: el archivo original y lo necesario para subirlo */
  media?: {
    blob: Blob;
    info: Record<string, unknown>;
    payload: unknown;
    viewOnce: boolean;
    replyId: string | null;
  };
}

export const ponerEnBandeja = (p: Pendiente) =>
  seguro(async () => void (await pedir((await tienda('outbox', 'readwrite')).put(p))), undefined);

export const quitarDeBandeja = (id: string) =>
  seguro(async () => void (await pedir((await tienda('outbox', 'readwrite')).delete(id))), undefined);

export const leerBandeja = (chatId: string) =>
  seguro(async () => {
    const lista = (await pedir((await tienda('outbox')).index('chat').getAll(chatId))) as Pendiente[];
    return lista.sort((a, b) => a.creado - b.creado);
  }, [] as Pendiente[]);

// ---------- Datos varios (lista de chats, perfil) ----------
export const guardarDato = (clave: string, valor: unknown) =>
  seguro(async () => void (await pedir((await tienda('misc', 'readwrite')).put(valor, clave))), undefined);

export const leerDato = <T,>(clave: string) =>
  seguro(async () => ((await pedir((await tienda('misc')).get(clave))) as T | undefined) ?? null, null as T | null);

/** Al cerrar sesión se borra toda la copia local. */
export async function borrarTodoLocal() {
  try {
    const db = await abrir();
    db.close();
  } catch {
    /* nada */
  }
  dbPromise = null;
  await new Promise((r) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => r(null);
  });
}

// ---------- Sesión sin internet ----------
// Datos mínimos para que la app no mande a "Iniciar sesión" cuando no hay señal.
const SESION_KEY = 'chatdos-sesion-local';

export interface SesionLocal {
  userId: string;
  profile: Profile | null;
  isAdmin: boolean;
  chatId: string | null;
}

export function guardarSesionLocal(s: Partial<SesionLocal> & { userId: string }) {
  try {
    const prev = leerSesionLocal();
    const nueva = { ...(prev?.userId === s.userId ? prev : {}), ...s };
    localStorage.setItem(SESION_KEY, JSON.stringify(nueva));
  } catch {
    /* nada */
  }
}

export function leerSesionLocal(): SesionLocal | null {
  try {
    const t = localStorage.getItem(SESION_KEY);
    return t ? (JSON.parse(t) as SesionLocal) : null;
  } catch {
    return null;
  }
}

export function borrarSesionLocal() {
  try {
    localStorage.removeItem(SESION_KEY);
  } catch {
    /* nada */
  }
}

export const sinInternet = () => typeof navigator !== 'undefined' && navigator.onLine === false;
