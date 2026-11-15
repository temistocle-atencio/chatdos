// Ayudas para que las fotos lleguen con toda su calidad.

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

/** iPhone o iPad (también el iPad que se presenta como Mac) */
export const esIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);

/**
 * Qué archivos pedir al elegir fotos.
 * En iPhone, si solo se pide "image/*", Safari puede convertir las fotos HEIC a JPG (pierden calidad y el HDR).
 * Al pedir también HEIC/HEIF, el iPhone entrega el archivo tal cual.
 */
export const ACEPTA_FOTOS = esIOS ? 'image/heic,image/heif,image/*' : 'image/*';
export const ACEPTA_FOTOS_Y_VIDEOS = esIOS ? 'image/heic,image/heif,image/*,video/*' : 'image/*,video/*';

/** ¿Este navegador puede mostrar fotos HEIC? (Safari sí; Chrome y otros en Android no) */
export const veHeic =
  esIOS || (/Safari/.test(ua) && !/Chrome|CriOS|Chromium|Android|Edg|Firefox/.test(ua));

export const esHeic = (mime: string, nombre = '') => /heic|heif/i.test(mime) || /\.(heic|heif)$/i.test(nombre);
