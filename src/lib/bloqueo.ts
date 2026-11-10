// Bloqueo de la app con PIN y con Face ID / Touch ID / huella (WebAuthn del propio celular).
// Todo queda SOLO en este celular. El PIN nunca se guarda: solo una huella (hash) de él.

const CLAVE = (userId: string) => `chatdos-bloqueo-${userId}`;
const INTENTOS = (userId: string) => `chatdos-bloqueo-intentos-${userId}`;
const PIN_LARGO = 4;
const ITERACIONES = 150000;

export interface ConfigBloqueo {
  pinHash: string;
  sal: string;
  iter: number;
  /** id de la llave de Face ID / huella (base64url), si se activó */
  credId?: string;
  /** minutos fuera de la app antes de pedir el desbloqueo (0 = siempre) */
  minutos: number;
}

export const LARGO_PIN = PIN_LARGO;

export const OPCIONES_TIEMPO = [
  { minutos: 0, label: 'Al salir de la app' },
  { minutos: 1, label: 'Después de 1 minuto' },
  { minutos: 5, label: 'Después de 5 minutos' },
  { minutos: 15, label: 'Después de 15 minutos' },
] as const;

const b64 = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deB64 = (t: string) =>
  Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));

async function hashPin(pin: string, sal: Uint8Array, iter: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iter }, base, 256);
  return b64(new Uint8Array(bits));
}

// ---------- Configuración ----------
export function leerBloqueo(userId: string): ConfigBloqueo | null {
  try {
    const t = localStorage.getItem(CLAVE(userId));
    return t ? (JSON.parse(t) as ConfigBloqueo) : null;
  } catch {
    return null;
  }
}

function guardar(userId: string, c: ConfigBloqueo) {
  localStorage.setItem(CLAVE(userId), JSON.stringify(c));
  window.dispatchEvent(new Event('chatdos-bloqueo'));
}

export async function activarBloqueo(userId: string, pin: string, minutos = 1): Promise<void> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  guardar(userId, { pinHash: await hashPin(pin, sal, ITERACIONES), sal: b64(sal), iter: ITERACIONES, minutos });
  reiniciarIntentos(userId);
}

export async function cambiarPin(userId: string, pin: string): Promise<void> {
  const c = leerBloqueo(userId);
  if (!c) return;
  const sal = crypto.getRandomValues(new Uint8Array(16));
  guardar(userId, { ...c, pinHash: await hashPin(pin, sal, ITERACIONES), sal: b64(sal), iter: ITERACIONES });
}

export function cambiarTiempo(userId: string, minutos: number) {
  const c = leerBloqueo(userId);
  if (c) guardar(userId, { ...c, minutos });
}

export function desactivarBloqueo(userId: string) {
  localStorage.removeItem(CLAVE(userId));
  reiniciarIntentos(userId);
  window.dispatchEvent(new Event('chatdos-bloqueo'));
}

// ---------- PIN con límite de intentos ----------
interface Intentos {
  fallos: number;
  hasta: number; // bloqueado hasta (ms)
}

function leerIntentos(userId: string): Intentos {
  try {
    return JSON.parse(localStorage.getItem(INTENTOS(userId)) || '') as Intentos;
  } catch {
    return { fallos: 0, hasta: 0 };
  }
}

function reiniciarIntentos(userId: string) {
  try {
    localStorage.removeItem(INTENTOS(userId));
  } catch {
    /* nada */
  }
}

/** Milisegundos que faltan para poder volver a intentar (0 = puede intentar). */
export const esperaRestante = (userId: string) => Math.max(0, leerIntentos(userId).hasta - Date.now());

/** Comprueba el PIN. Tras 5 fallos hay que esperar (30 s, luego 1 min, 5 min...). */
export async function comprobarPin(userId: string, pin: string): Promise<'ok' | 'mal' | 'espera'> {
  const c = leerBloqueo(userId);
  if (!c) return 'ok';
  if (esperaRestante(userId) > 0) return 'espera';
  const ok = (await hashPin(pin, deB64(c.sal), c.iter)) === c.pinHash;
  if (ok) {
    reiniciarIntentos(userId);
    return 'ok';
  }
  const i = leerIntentos(userId);
  const fallos = i.fallos + 1;
  let hasta = 0;
  if (fallos >= 5) {
    const escalones = [30, 60, 300, 900, 3600];
    hasta = Date.now() + escalones[Math.min(fallos - 5, escalones.length - 1)] * 1000;
  }
  localStorage.setItem(INTENTOS(userId), JSON.stringify({ fallos, hasta }));
  return 'mal';
}

// ---------- Face ID / Touch ID / huella ----------
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const esApple = /iPhone|iPad|iPod|Macintosh/.test(ua);

/** Nombre a mostrar según el celular. */
export const nombreBiometria = () => (esApple ? 'Face ID / Touch ID' : /Android/.test(ua) ? 'huella' : 'huella o rostro');

export async function biometriaDisponible(): Promise<boolean> {
  try {
    return (
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Crear la llave de Face ID / huella en este celular. Debe llamarse desde un toque. */
export async function activarBiometria(userId: string, nombre: string): Promise<void> {
  const c = leerBloqueo(userId);
  if (!c) throw new Error('Primero crea un PIN.');
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'ChatDos', id: location.hostname },
      user: {
        id: new TextEncoder().encode(userId).slice(0, 64),
        name: `${nombre || 'ChatDos'} · ChatDos`,
        displayName: nombre || 'ChatDos',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('No se pudo activar.');
  guardar(userId, { ...c, credId: b64(new Uint8Array(cred.rawId)) });
}

export function quitarBiometria(userId: string) {
  const c = leerBloqueo(userId);
  if (c) {
    delete c.credId;
    guardar(userId, c);
  }
}

/** Pedir Face ID / huella. Devuelve true si la persona se verificó. */
export async function desbloquearConBiometria(userId: string): Promise<boolean> {
  const c = leerBloqueo(userId);
  if (!c?.credId) return false;
  try {
    const r = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: deB64(c.credId) as BufferSource, transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!r) return false;
    // El celular confirma que verificó a la persona (bandera "UV" de la respuesta)
    const datos = new Uint8Array((r.response as AuthenticatorAssertionResponse).authenticatorData);
    const ok = datos.length > 32 && (datos[32] & 0x04) !== 0;
    if (ok) reiniciarIntentos(userId);
    return ok;
  } catch {
    return false;
  }
}

// ---------- ¿Cuándo bloquear? ----------
const SALIDA = 'chatdos-salio';

/** Se llama al salir de la app. */
export function marcarSalida() {
  try {
    sessionStorage.setItem(SALIDA, String(Date.now()));
  } catch {
    /* nada */
  }
}

/** Al volver: ¿pasó el tiempo elegido? */
export function debeBloquearAlVolver(c: ConfigBloqueo): boolean {
  try {
    const t = Number(sessionStorage.getItem(SALIDA) || 0);
    if (!t) return false;
    return Date.now() - t >= c.minutos * 60000;
  } catch {
    return true;
  }
}

// Al abrir la cámara o la galería el celular "sale" de la app un momento: eso no debe bloquearla.
const ELIGIENDO = 'chatdos-eligiendo-archivo';
export function avisarSelectorArchivo() {
  try {
    sessionStorage.setItem(ELIGIENDO, String(Date.now()));
  } catch {
    /* nada */
  }
}
export function veniaDeElegirArchivo(): boolean {
  try {
    const t = Number(sessionStorage.getItem(ELIGIENDO) || 0);
    sessionStorage.removeItem(ELIGIENDO);
    return !!t && Date.now() - t < 5 * 60000;
  } catch {
    return false;
  }
}
