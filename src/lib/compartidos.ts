// Enlaces para compartir fotos en calidad ORIGINAL con cualquier persona (no necesita cuenta).
// Cada foto va cifrada con su propia llave; esas llaves van en un índice que también va cifrado.
// La llave del índice viaja SOLO dentro del enlace (después del #): ni Supabase ni Cloudflare pueden ver las fotos.
import { supabase } from './supabase';
import { encryptFile } from './crypto';
import { compressImage } from './media';

export interface FotoNueva {
  blob: Blob;
  nombre: string;
}
export interface FotoDelChat {
  ruta: string; // original ya guardado en R2
  key: string;
  mime: string;
  size: number;
  nombre: string;
  previa?: Blob; // la versión que se ve en el chat (para mostrarla rápido en la página)
}

interface Archivo {
  ruta: string;
  key: string;
  mime: string;
}
export interface IndiceCompartido {
  v: 1;
  creado: number;
  fotos: { nombre: string; mime: string; size: number; original: Archivo; previa?: Archivo }[];
}

const base64url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function subir(url: string, cuerpo: Blob, alAvanzar: (bytes: number) => void): Promise<void> {
  return new Promise((ok, mal) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = (e) => alAvanzar(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : mal(new Error(`No se pudo subir (${x.status})`)));
    x.onerror = () => mal(new Error('Sin conexión: no se pudo subir'));
    x.send(cuerpo);
  });
}

/** Crea el enlace. Devuelve la dirección para compartir y cuándo vence. */
export async function crearEnlace(
  nuevas: FotoNueva[],
  delChat: FotoDelChat[],
  alAvanzar: (texto: string, pct: number) => void
): Promise<{ url: string; vence: string; id: string }> {
  // 1. Preparar y cifrar todo en el celular
  const piezas: { blob: Blob; key: string; mime: string }[] = [];
  const fotos: IndiceCompartido['fotos'] = [];
  let n = 0;
  for (const f of nuevas) {
    n++;
    alAvanzar(`Preparando foto ${n} de ${nuevas.length + delChat.length}…`, 0);
    const original = await encryptFile(f.blob);
    piezas.push({ blob: original.encryptedBlob, key: original.fileKeyBase64, mime: f.blob.type || 'image/jpeg' });
    const indiceOriginal = piezas.length - 1;
    let indicePrevia = -1;
    try {
      const prev = await compressImage(new File([f.blob], f.nombre, { type: f.blob.type || 'image/jpeg' }));
      const p = await encryptFile(prev.blob);
      piezas.push({ blob: p.encryptedBlob, key: p.fileKeyBase64, mime: prev.mime });
      indicePrevia = piezas.length - 1;
    } catch {
      /* si el navegador no puede abrir la foto (por ejemplo HEIC en Android) se comparte sin vista previa */
    }
    fotos.push({
      nombre: f.nombre,
      mime: f.blob.type || 'image/jpeg',
      size: f.blob.size,
      original: { ruta: String(indiceOriginal), key: '', mime: '' },
      ...(indicePrevia >= 0 ? { previa: { ruta: String(indicePrevia), key: '', mime: '' } } : {}),
    });
  }
  for (const f of delChat) {
    let previa: Archivo | undefined;
    if (f.previa) {
      const p = await encryptFile(f.previa);
      piezas.push({ blob: p.encryptedBlob, key: p.fileKeyBase64, mime: f.previa.type || 'image/jpeg' });
      previa = { ruta: String(piezas.length - 1), key: '', mime: '' };
    }
    fotos.push({ nombre: f.nombre, mime: f.mime, size: f.size, original: { ruta: f.ruta, key: f.key, mime: f.mime }, ...(previa ? { previa } : {}) });
  }

  // 2. Pedir dónde subir
  const { data, error } = await supabase.functions.invoke('notificar', {
    body: { accion: 'compartido_crear', tams: piezas.map((p) => p.blob.size), existentes: delChat.map((f) => f.ruta) },
  });
  const d = data as { id?: string; rutas?: string[]; subir?: string[]; manifiesto?: string; vence?: string; error?: string } | null;
  if (error || !d?.id || !d.rutas || !d.subir || !d.manifiesto) throw new Error(d?.error || 'No se pudo crear el enlace. Revisa tu conexión.');

  // 3. Subir los archivos cifrados
  const total = piezas.reduce((t, p) => t + p.blob.size, 0) || 1;
  let hechos = 0;
  for (let i = 0; i < piezas.length; i++) {
    await subir(d.subir[i], piezas[i].blob, (b) =>
      alAvanzar('Subiendo las fotos…', Math.min(99, Math.round(((hechos + b) / total) * 100)))
    );
    hechos += piezas[i].blob.size;
  }

  // 4. El índice (con las llaves de cada foto), cifrado con la llave que va en el enlace
  const conRuta = (a: Archivo): Archivo => {
    if (a.key) return a; // foto del chat: ya tiene su ruta y llave
    const p = piezas[Number(a.ruta)];
    return { ruta: d.rutas![Number(a.ruta)], key: p.key, mime: p.mime };
  };
  const indice: IndiceCompartido = {
    v: 1,
    creado: Date.now(),
    fotos: fotos.map((f) => ({ ...f, original: conRuta(f.original), ...(f.previa ? { previa: conRuta(f.previa) } : {}) })),
  };
  const cif = await encryptFile(new Blob([JSON.stringify(indice)], { type: 'application/json' }));
  await subir(d.manifiesto, cif.encryptedBlob, () => {});
  alAvanzar('Listo', 100);

  const base = `${location.origin}${import.meta.env.BASE_URL}compartir.html`;
  return { url: `${base}#${d.id}.${base64url(cif.fileKeyBase64)}`, vence: d.vence ?? '', id: d.id };
}
