// Reenviar a otros chats sin abrirlos: cada mensaje se cifra con la llave de SU chat
// (la que sale de mi llave privada y la llave pública de la otra persona) y se guarda
// directo en el servidor, igual que si se enviara desde ese chat.
import { supabase } from './supabase';
import { encryptJSON, getChatKey, getLocalPrivateKey } from './crypto';
import { mediaPath, uploadEncrypted } from './media';
import { memoria, claveLlave } from './memoria';
import { notifyPartner } from './push';
import type { ItemReenvio } from './reenvio';
import type { MessagePayload } from '../types/chat';
import type { Profile } from '../types/database';

async function llaveDelChat(userId: string, chatId: string, otra: Profile): Promise<CryptoKey> {
  if (!otra.public_key) throw new Error('Esa persona aún no puede recibir mensajes');
  const k = claveLlave(chatId, otra.public_key);
  const guardada = memoria.llaves.get(k);
  if (guardada) return guardada;
  const privada = await getLocalPrivateKey(userId);
  if (!privada) throw new Error('No está tu llave en este celular');
  const llave = await getChatKey(chatId, privada, otra.public_key as JsonWebKey);
  memoria.llaves.set(k, llave);
  return llave;
}

/** Envía a un chat (que no está abierto) lo que se reenvía. */
export async function enviarAChat(userId: string, chatId: string, otra: Profile, items: ItemReenvio[]): Promise<void> {
  const llave = await llaveDelChat(userId, chatId, otra);
  const guardar = async (fila: Record<string, unknown>) => {
    const { error } = await supabase.from('messages').upsert(fila, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    notifyPartner(fila.id as string);
  };

  // Textos, enlaces, contactos y ubicaciones
  let orden = 0;
  for (const i of items) {
    if (!i.especial) continue;
    const id = crypto.randomUUID();
    const payload: MessagePayload = { v: 1, sentAt: Date.now() + orden++, ...i.especial, reenviado: true };
    const cifrado = await encryptJSON(llave, payload);
    await guardar({ id, chat_id: chatId, sender_id: userId, kind: 'text', ciphertext: cifrado.ciphertext, iv: cifrado.iv, view_once: false, reply_to: null });
  }

  // Fotos, videos y audios (2 o más fotos o videos van como álbum)
  const medias = items.filter((i) => i.media);
  const esAlbum = medias.length >= 2 && medias.every((i) => (i.media!.kind === 'image' || i.media!.kind === 'video') && !i.media!.sticker);
  const albumId = crypto.randomUUID();
  for (let n = 0; n < medias.length; n++) {
    const { media: m, comentario } = medias[n];
    if (!m) continue;
    const id = crypto.randomUUID();
    const ruta = mediaPath(chatId, userId, id);
    const { fileKey } = await uploadEncrypted(ruta, m.blob, () => {});
    const payload: MessagePayload = {
      v: 1,
      sentAt: Date.now() + orden++,
      ...(n === 0 && comentario ? { text: comentario } : {}),
      ...(esAlbum ? { album: { id: albumId, n: medias.length, i: n } } : {}),
      reenviado: true,
      media: {
        key: fileKey,
        mime: m.mime,
        size: m.blob.size,
        width: m.width,
        height: m.height,
        duration: m.duration,
        thumb: m.sticker ? undefined : m.thumb,
        name: m.name,
        music: m.music,
        ...(m.sticker ? { sticker: true } : {}),
        ...(m.hd ? { hd: true } : {}),
      },
    };
    const cifrado = await encryptJSON(llave, payload);
    await guardar({
      id,
      chat_id: chatId,
      sender_id: userId,
      kind: m.kind,
      ciphertext: cifrado.ciphertext,
      iv: cifrado.iv,
      media_path: ruta,
      view_once: false,
      reply_to: null,
    });
  }
}
