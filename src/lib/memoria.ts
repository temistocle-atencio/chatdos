// Memoria rápida mientras la app está abierta: lo que ya se cargó se muestra al instante
// al volver a una pantalla (sin "Cargando..."), y luego se actualiza en silencio.
import type { DecryptedMessage } from '../types/chat';
import type { Profile } from '../types/database';

export const memoria = {
  /** Lista de conversaciones por usuario */
  listas: new Map<string, unknown[]>(),
  /** Mensajes ya descifrados por chat */
  mensajes: new Map<string, DecryptedMessage[]>(),
  /** Datos de la otra persona por chat */
  companeros: new Map<string, Profile>(),
  /** Llaves de chat ya calculadas: `${chatId}|${llavePública}` */
  llaves: new Map<string, CryptoKey>(),
  /** Usuarios cuya llave privada ya se comprobó en este celular */
  llaveLista: new Set<string>(),
};

export const claveLlave = (chatId: string, pub: unknown) => `${chatId}|${JSON.stringify(pub)}`;

/** Se borra todo al cerrar sesión. */
export function vaciarMemoria() {
  memoria.listas.clear();
  memoria.mensajes.clear();
  memoria.companeros.clear();
  memoria.llaves.clear();
  memoria.llaveLista.clear();
}
