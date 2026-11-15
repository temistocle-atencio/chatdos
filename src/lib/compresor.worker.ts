// Prepara las fotos en segundo plano para que la app no se trabe mientras tanto
// (abrir una foto de 50 o 200 megapíxeles y achicarla toma tiempo).
/// <reference lib="webworker" />

interface Pedido {
  id: number;
  blob: Blob;
  lado: number;
  calidad: number;
}

const aBlob = async (c: OffscreenCanvas, calidad: number): Promise<Blob> => {
  const webp = await c.convertToBlob({ type: 'image/webp', quality: calidad }).catch(() => null);
  if (webp && webp.type === 'image/webp') return webp;
  return c.convertToBlob({ type: 'image/jpeg', quality: calidad });
};

const aTexto = (b: Blob): Promise<string> =>
  new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(r.error);
    r.readAsDataURL(b);
  });

self.onmessage = async (e: MessageEvent<Pedido>) => {
  const { id, blob, lado, calidad } = e.data;
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const width = Math.max(1, Math.round(bmp.width * escala));
    const height = Math.max(1, Math.round(bmp.height * escala));
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('sin 2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, width, height);
    const salida = await aBlob(c, calidad);
    // Miniatura borrosa (va cifrada dentro del mensaje)
    const k = 32 / Math.max(width, height);
    const m = new OffscreenCanvas(Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k)));
    m.getContext('2d')?.drawImage(c, 0, 0, m.width, m.height);
    const thumb = await aTexto(await m.convertToBlob({ type: 'image/jpeg', quality: 0.5 }));
    bmp.close();
    c.width = c.height = 0;
    (self as unknown as Worker).postMessage({ id, ok: true, blob: salida, mime: salida.type, width, height, thumb });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
