import { supabase } from './supabase';
import {
  loadLocalPrivateKey,
  saveLocalPrivateKey,
  getKnownPartnerKey,
  loadOwnOldKeys,
  addOwnOldKey,
  saveKnownPartnerKey,
} from './idb';

// Conversión binaria <-> Base64
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Caché en memoria de la llave privada del usuario actual para agilizar operaciones
let inMemoryPrivateKey: CryptoKey | null = null;
let inMemoryUserId: string | null = null;

// Caché en memoria de las llaves derivadas de cada chat (por llave privada -> chat|pública del otro)
const chatKeyMemoryCache = new WeakMap<CryptoKey, Map<string, CryptoKey>>();

/**
 * Comprueba si la llave privada del usuario ya está disponible en este dispositivo.
 */
export async function hasLocalPrivateKey(userId: string): Promise<boolean> {
  if (inMemoryPrivateKey && inMemoryUserId === userId) return true;
  const key = await loadLocalPrivateKey(userId);
  if (key) {
    inMemoryPrivateKey = key;
    inMemoryUserId = userId;
    return true;
  }
  return false;
}

/**
 * Obtiene la llave privada del usuario actual desde memoria o IndexedDB.
 */
export async function getLocalPrivateKey(userId: string): Promise<CryptoKey | null> {
  if (inMemoryPrivateKey && inMemoryUserId === userId) return inMemoryPrivateKey;
  const key = await loadLocalPrivateKey(userId);
  if (key) {
    inMemoryPrivateKey = key;
    inMemoryUserId = userId;
  }
  return key;
}

export const YA_TIENE_LLAVE = 'Esta cuenta ya tiene una llave de cifrado.';

/** ¿La cuenta ya tiene llave en el servidor? (null = no se pudo saber, por ejemplo sin internet) */
export async function tieneLlaveEnServidor(userId: string): Promise<boolean | null> {
  try {
    const [{ data: perfil, error: e1 }, { data: respaldo, error: e2 }] = await Promise.all([
      supabase.from('profiles').select('public_key').eq('id', userId).maybeSingle(),
      supabase.from('key_backups').select('user_id').eq('user_id', userId).maybeSingle(),
    ]);
    if (e1 || e2 || !perfil) return null;
    return !!perfil.public_key || !!respaldo;
  } catch {
    return null;
  }
}

/**
 * Genera el par ECDH P-256 en el primer inicio de sesión:
 * 1. Sube la llave pública (JWK) a profiles.public_key.
 * 2. Cifra la llave privada (pkcs8) con PBKDF2 (600.000 iteraciones) + contraseña de respaldo.
 * 3. Guarda el respaldo en key_backups.
 * 4. Guarda la llave privada en IndexedDB como no extraíble (extractable: false).
 */
export async function generateAndBackupKeys(
  userId: string,
  backupPassword: string,
  opciones: { reemplazar?: boolean } = {}
): Promise<void> {
  if (!backupPassword || backupPassword.length < 8) {
    throw new Error('La contraseña de respaldo debe tener al menos 8 caracteres.');
  }
  // Protección: nunca crear una llave nueva encima de una que ya existe (se perderían los mensajes).
  // Solo "empezar de nuevo" puede reemplazarla, y guarda la anterior.
  if (!opciones.reemplazar) {
    const yaTiene = await tieneLlaveEnServidor(userId);
    if (yaTiene === null) throw new Error('Sin conexión. Revisa tu internet e intenta de nuevo.');
    if (yaTiene) throw new Error(YA_TIENE_LLAVE);
  }

  // 1. Generar par de llaves ECDH P-256
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // Temporalmente extraíble solo para preparar el respaldo
    ['deriveKey', 'deriveBits']
  );

  // 2. Exportar llave pública como JWK y privada como PKCS8
  const publicJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privatePkcs8 = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  // 3. Preparar derivación de llave de respaldo con PBKDF2 (600.000 iteraciones, sal 16 bytes)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const passKey = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(backupPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesBackupKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // 4. Cifrar la llave privada con AES-GCM (IV aleatorio de 12 bytes)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesBackupKey,
    privatePkcs8
  );

  const wrappedBase64 = bytesToBase64(new Uint8Array(ciphertextBuffer));
  const saltBase64 = bytesToBase64(salt);
  const ivBase64 = bytesToBase64(iv);

  // 5. Guardar la pública en profiles
  const { error: profError } = await supabase
    .from('profiles')
    .update({
      public_key: publicJwk,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profError) {
    throw new Error(`Error al guardar llave pública: ${profError.message}`);
  }

  // 6. Guardar respaldo en key_backups
  const { error: backupError } = await supabase
    .from('key_backups')
    .upsert(
      {
        user_id: userId,
        wrapped_private_key: wrappedBase64,
        salt: saltBase64,
        iv: ivBase64,
        iterations: 600000,
      },
      { onConflict: 'user_id' }
    );

  if (backupError) {
    throw new Error(`Error al guardar respaldo de llave: ${backupError.message}`);
  }

  // 7. Reimportar la llave privada con extractable: false (no extraíble)
  const nonExtractablePrivateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    privatePkcs8,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // ¡No extraíble!
    ['deriveKey', 'deriveBits']
  );

  // 8. Guardar en IndexedDB y memoria
  await saveLocalPrivateKey(userId, nonExtractablePrivateKey);
  inMemoryPrivateKey = nonExtractablePrivateKey;
  inMemoryUserId = userId;
}

/**
 * Recupera la llave privada en un dispositivo nuevo usando la contraseña de respaldo:
 * 1. Lee el respaldo desde key_backups.
 * 2. Deriva la llave AES-GCM con PBKDF2 (salt e iteraciones del respaldo).
 * 3. Descifra la llave privada PKCS8.
 * 4. La importa como no extraíble y la guarda en IndexedDB.
 */
export async function restoreKeysFromBackup(userId: string, backupPassword: string): Promise<void> {
  if (!backupPassword) {
    throw new Error('Escribe tu contraseña de respaldo.');
  }

  // 1. Obtener respaldo desde la base de datos
  const { data: backup, error } = await supabase
    .from('key_backups')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !backup) {
    throw new Error('No se encontró respaldo de llaves para esta cuenta.');
  }

  const salt = base64ToBytes(backup.salt);
  const iv = base64ToBytes(backup.iv);
  const ciphertext = base64ToBytes(backup.wrapped_private_key);
  const iterations = backup.iterations || 600000;

  // 2. Derivar la llave de respaldo con PBKDF2
  const passKey = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(backupPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesBackupKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Descifrar el bloque PKCS8
  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      aesBackupKey,
      ciphertext as BufferSource
    );
  } catch {
    throw new Error('Contraseña de respaldo incorrecta. Verifica e inténtalo de nuevo.');
  }

  // 4. Importar como no extraíble (extractable: false)
  const nonExtractablePrivateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    decryptedBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // 5. Guardar en IndexedDB y memoria
  await saveLocalPrivateKey(userId, nonExtractablePrivateKey);
  inMemoryPrivateKey = nonExtractablePrivateKey;
  inMemoryUserId = userId;
}

/**
 * Deriva la llave simétrica AES-GCM 256 de un chat:
 * ECDH(mi privada, pública de la otra persona) -> HKDF-SHA256 (salt = bytes del chat_id, info "chatdos-v1") -> AES-GCM 256
 */
export async function getChatKey(
  chatId: string,
  myPrivateKey: CryptoKey,
  partnerPublicJwk: JsonWebKey
): Promise<CryptoKey> {
  // La llave depende del chat y de la llave pública de la otra persona (puede cambiar)
  const cacheId = `${chatId}|${JSON.stringify(partnerPublicJwk)}`;
  let cache = chatKeyMemoryCache.get(myPrivateKey);
  if (!cache) {
    cache = new Map();
    chatKeyMemoryCache.set(myPrivateKey, cache);
  }
  const enCache = cache.get(cacheId);
  if (enCache) return enCache;

  // 1. Importar la llave pública del compañero
  const partnerPublicKey = await window.crypto.subtle.importKey(
    'jwk',
    partnerPublicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 2. Derivar 256 bits compartidos con ECDH
  const sharedBits = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: partnerPublicKey },
    myPrivateKey,
    256
  );

  // 3. Importar como llave HKDF
  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  // 4. Derivar llave AES-GCM con salt = bytes del chat_id e info "chatdos-v1"
  const chatKey = await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(chatId),
      info: new TextEncoder().encode('chatdos-v1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cache.set(cacheId, chatKey);
  return chatKey;
}

/**
 * Cifra un objeto JSON con la llave del chat usando AES-GCM (IV aleatorio de 12 bytes).
 * Devuelve { ciphertext (base64), iv (base64) }.
 */
export async function encryptJSON<T>(
  chatKey: CryptoKey,
  data: T
): Promise<{ ciphertext: string; iv: string }> {
  const jsonStr = JSON.stringify(data);
  const plainBytes = new TextEncoder().encode(jsonStr);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    chatKey,
    plainBytes
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
    iv: bytesToBase64(iv),
  };
}

/**
 * Descifra un objeto JSON cifrado con AES-GCM desde base64.
 */
export async function decryptJSON<T>(
  chatKey: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string
): Promise<T> {
  const cipherBytes = base64ToBytes(ciphertextBase64);
  const iv = base64ToBytes(ivBase64);

  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    chatKey,
    cipherBytes as BufferSource
  );

  const decodedStr = new TextDecoder().decode(plainBuffer);
  return JSON.parse(decodedStr) as T;
}

/**
 * Cifra un archivo con su propia llave AES-GCM aleatoria.
 * El archivo resultante lleva el IV de 12 bytes al inicio.
 * Devuelve el Blob cifrado y la llave del archivo en base64 para incluirla en el mensaje.
 */
export async function encryptFile(
  fileBlob: Blob
): Promise<{ encryptedBlob: Blob; fileKeyBase64: string; size: number }> {
  // Generar llave AES-GCM 256 aleatoria para este archivo
  const fileKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const rawKeyBuffer = await window.crypto.subtle.exportKey('raw', fileKey);
  const fileKeyBase64 = bytesToBase64(new Uint8Array(rawKeyBuffer));

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const fileBytes = await fileBlob.arrayBuffer();

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    fileKey,
    fileBytes
  );

  // Concatena IV (12 bytes) al inicio del archivo cifrado
  const combined = new Uint8Array(12 + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), 12);

  const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });
  return {
    encryptedBlob,
    fileKeyBase64,
    size: encryptedBlob.size,
  };
}

/**
 * Descifra un archivo: extrae los 12 bytes iniciales de IV,
 * importa la llave del archivo en base64 y descifra el contenido restante.
 */
export async function decryptFile(
  encryptedBlob: Blob,
  fileKeyBase64: string,
  mimeType = 'application/octet-stream'
): Promise<Blob> {
  const fileBytes = await encryptedBlob.arrayBuffer();
  if (fileBytes.byteLength < 12) {
    throw new Error('El archivo cifrado está dañado (longitud menor a 12 bytes).');
  }

  const iv = new Uint8Array(fileBytes, 0, 12);
  const ciphertext = new Uint8Array(fileBytes, 12);

  const rawKey = base64ToBytes(fileKeyBase64);
  const fileKey = await window.crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    fileKey,
    ciphertext as BufferSource
  );

  return new Blob([plainBuffer], { type: mimeType });
}

/**
 * Calcula el "Número de Seguridad":
 * Huella SHA-256 de ambas llaves públicas (ordenadas canónicamente),
 * formateada en 12 grupos de 5 dígitos para comparar en persona.
 */
export async function computeSecurityNumber(
  jwkA: JsonWebKey,
  jwkB: JsonWebKey
): Promise<string> {
  const coordA = `${jwkA.x || ''}:${jwkA.y || ''}`;
  const coordB = `${jwkB.x || ''}:${jwkB.y || ''}`;

  // Ordenar para garantizar simetría (ambas personas ven idéntico número)
  const first = coordA < coordB ? coordA : coordB;
  const second = coordA < coordB ? coordB : coordA;

  const rawInput = new TextEncoder().encode(`${first}|${second}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', rawInput);

  // Derivamos 48 bytes con HKDF a partir del hash para generar 12 grupos de 4 bytes
  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    hashBuffer,
    'HKDF',
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('chatdos-security-number'),
      info: new TextEncoder().encode('safety-digits'),
    },
    hkdfKey,
    384 // 48 bytes * 8 bits = 384 bits
  );

  const view = new DataView(derivedBits);
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    // 32-bit uint modulo 100000 -> 5 dígitos fijos (ej. 04291)
    const val = view.getUint32(i * 4) % 100000;
    groups.push(val.toString().padStart(5, '0'));
  }

  return groups.join(' ');
}

/**
 * Genera una huella hexadecimal de una llave pública para detectar cambios.
 */
export async function computeKeyThumbprint(jwk: JsonWebKey): Promise<string> {
  const coord = `${jwk.x || ''}:${jwk.y || ''}`;
  const hashBuffer = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(coord)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Comprueba si la llave pública de la otra persona ha cambiado respecto a la guardada en IndexedDB.
 * Devuelve true si la llave es conocida y cambió. Si es la primera vez que se ve, la guarda y devuelve false.
 */
export async function checkPartnerKeyChange(
  partnerId: string,
  currentPublicJwk: JsonWebKey
): Promise<boolean> {
  const currentThumbprint = await computeKeyThumbprint(currentPublicJwk);
  const savedThumbprint = await getKnownPartnerKey(partnerId);

  if (!savedThumbprint) {
    // Primera vez que se detecta la llave: guardamos
    await saveKnownPartnerKey(partnerId, currentThumbprint);
    return false;
  }

  if (savedThumbprint !== currentThumbprint) {
    return true; // La llave pública cambió
  }

  return false;
}

/**
 * Cambia la contraseña de respaldo: descifra la llave privada con la actual y la vuelve a
 * cifrar con la nueva (nueva sal y nuevo IV). La llave no cambia, así que no se pierde ningún mensaje.
 */
export async function changeBackupPassword(userId: string, actual: string, nueva: string): Promise<void> {
  if (!nueva || nueva.length < 8) throw new Error('La nueva contraseña de respaldo debe tener al menos 8 caracteres.');
  const { data: backup, error } = await supabase.from('key_backups').select('*').eq('user_id', userId).single();
  if (error || !backup) throw new Error('No se encontró el respaldo de tu llave.');

  const derivar = async (clave: string, salt: Uint8Array, iteraciones: number, usos: KeyUsage[]) => {
    const base = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations: iteraciones, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      usos
    );
  };

  let pkcs8: ArrayBuffer;
  try {
    const vieja = await derivar(actual, base64ToBytes(backup.salt), backup.iterations || 600000, ['decrypt']);
    pkcs8 = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(backup.iv) as BufferSource },
      vieja,
      base64ToBytes(backup.wrapped_private_key) as BufferSource
    );
  } catch {
    throw new Error('La contraseña de respaldo actual no es correcta.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const nuevaLlave = await derivar(nueva, salt, 600000, ['encrypt']);
  const cifrado = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, nuevaLlave, pkcs8);

  const { error: errGuardar } = await supabase
    .from('key_backups')
    .update({
      wrapped_private_key: bytesToBase64(new Uint8Array(cifrado)),
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      iterations: 600000,
    })
    .eq('user_id', userId);
  if (errGuardar) throw new Error('No se pudo guardar la nueva contraseña de respaldo.');
}

/**
 * Llaves de chat calculadas con las llaves públicas ANTERIORES de la otra persona.
 * Sirven para seguir leyendo los mensajes viejos si ella empezó de nuevo con otra llave.
 */
export async function llavesAnterioresDelChat(
  chatId: string,
  myPrivateKey: CryptoKey,
  anteriores: unknown,
  userId?: string,
  publicaActualDelOtro?: unknown
): Promise<CryptoKey[]> {
  const llaves: CryptoKey[] = [];
  const delOtro = Array.isArray(anteriores) ? (anteriores.slice(-5).reverse() as JsonWebKey[]) : [];
  // Llaves viejas de la otra persona con mi llave de ahora
  for (const pub of delOtro) {
    try {
      llaves.push(await getChatKey(chatId, myPrivateKey, pub));
    } catch {
      /* llave dañada: se ignora */
    }
  }
  // Mis llaves viejas en este celular (si yo renové la mía), con la llave de ahora y las viejas del otro
  if (userId) {
    const mias = await loadOwnOldKeys(userId);
    const publicas = [publicaActualDelOtro as JsonWebKey | undefined, ...delOtro].filter(Boolean) as JsonWebKey[];
    for (const vieja of mias.slice(-5).reverse()) {
      for (const pub of publicas) {
        try {
          llaves.push(await getChatKey(chatId, vieja.privateKey, pub));
        } catch {
          /* se ignora */
        }
      }
    }
  }
  return llaves;
}

/** Intenta descifrar con la llave actual y, si no se puede, con las anteriores. */
export async function decryptJSONConRespaldo<T>(
  llave: CryptoKey,
  anteriores: CryptoKey[],
  ciphertextBase64: string,
  ivBase64: string
): Promise<T> {
  try {
    return await decryptJSON<T>(llave, ciphertextBase64, ivBase64);
  } catch (e) {
    for (const vieja of anteriores) {
      try {
        return await decryptJSON<T>(vieja, ciphertextBase64, ivBase64);
      } catch {
        /* probar la siguiente */
      }
    }
    throw e;
  }
}

/**
 * Empezar de nuevo cuando se olvidó la contraseña de respaldo en un celular nuevo:
 * la llave pública de ahora se guarda en "llaves anteriores" (para que la otra persona
 * siga leyendo los mensajes viejos) y se crea una llave nueva con una contraseña de respaldo nueva.
 * Los mensajes viejos no se pueden abrir en este celular: nadie tiene cómo recuperarlos.
 */
export async function empezarDeNuevo(userId: string, nuevaContrasenaRespaldo: string): Promise<void> {
  // Si este celular tiene la llave de ahora, se guarda aquí como "anterior" para seguir leyendo lo de antes
  const actualLocal = await getLocalPrivateKey(userId);
  if (!nuevaContrasenaRespaldo || nuevaContrasenaRespaldo.length < 8) {
    throw new Error('La contraseña de respaldo debe tener al menos 8 caracteres.');
  }
  const { data: perfil, error } = await supabase
    .from('profiles')
    .select('public_key, llaves_anteriores')
    .eq('id', userId)
    .single();
  if (error || !perfil) throw new Error('No se pudo leer tu perfil. Revisa tu conexión.');
  if (actualLocal && perfil.public_key) {
    await addOwnOldKey(userId, { privateKey: actualLocal, publicJwk: perfil.public_key as JsonWebKey });
  }
  if (perfil.public_key) {
    const lista = Array.isArray(perfil.llaves_anteriores) ? perfil.llaves_anteriores : [];
    const { error: errGuardar } = await supabase
      .from('profiles')
      .update({ llaves_anteriores: [...lista, perfil.public_key] })
      .eq('id', userId);
    if (errGuardar) throw new Error('No se pudo guardar tu llave anterior. Intenta de nuevo.');
  }
  await generateAndBackupKeys(userId, nuevaContrasenaRespaldo, { reemplazar: true });
}

/** Llaves viejas de MI colección de stickers (si renové mi llave en este celular). */
export async function llavesAnterioresPropias(idLlave: string, userId: string): Promise<CryptoKey[]> {
  const mias = await loadOwnOldKeys(userId);
  const llaves: CryptoKey[] = [];
  for (const vieja of mias.slice(-5).reverse()) {
    try {
      llaves.push(await getChatKey(idLlave, vieja.privateKey, vieja.publicJwk));
    } catch {
      /* se ignora */
    }
  }
  return llaves;
}
