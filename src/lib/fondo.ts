// Fondo del chat: temas incluidos o una imagen propia. Se guarda solo en este celular (como WhatsApp).
import { useEffect, useState } from 'react';
import { guardarDato, leerDato } from './offline';

export interface Tema {
  id: string;
  nombre: string;
  fondo?: string; // color de fondo
  lineas?: string; // color del dibujo
}

// Todos los temas usan el mismo dibujo de líneas (un solo archivo liviano), cada uno con sus colores
export const DIBUJO = `${import.meta.env.BASE_URL}temas/lineas.png`;
export const TEMAS: Tema[] = [
  { id: 'ninguno', nombre: 'Sin fondo' },
  { id: 'lavanda', nombre: 'Lavanda', fondo: '#BCB0C9', lineas: '#F8E1F9' },
  { id: 'arena', nombre: 'Arena', fondo: '#CCB8B5', lineas: '#F8E0E7' },
  { id: 'rosa', nombre: 'Rosa', fondo: '#FDC9CF', lineas: '#E196A2' },
  { id: 'menta', nombre: 'Menta', fondo: '#77E0DD', lineas: '#B9FAFA' },
  { id: 'vainilla', nombre: 'Vainilla', fondo: '#FEE9BA', lineas: '#E8C286' },
];

export interface Fondo {
  tema: string; // id de TEMAS o 'propio'
  propio?: string; // imagen propia (data URL JPEG)
  oscuro: number; // 0-60: cuánto se oscurece (para que se lean los mensajes)
}

const CLAVE = 'fondo-chat';
let actual: Fondo = { tema: 'ninguno', oscuro: 0 };
let cargado = false;
const avisos = new Set<(f: Fondo) => void>();

async function cargar() {
  if (cargado) return;
  cargado = true;
  const g = await leerDato<Fondo>(CLAVE);
  if (g) {
    actual = g;
    avisos.forEach((f) => f(g));
  }
}

export async function guardarFondo(f: Fondo) {
  actual = f;
  avisos.forEach((x) => x(f));
  await guardarDato(CLAVE, f);
}

export function useFondo(): Fondo {
  const [f, setF] = useState(actual);
  useEffect(() => {
    avisos.add(setF);
    setF(actual);
    cargar();
    return () => {
      avisos.delete(setF);
    };
  }, []);
  return f;
}

/** ¿Hay algún fondo puesto? */
export function hayFondo(f: Fondo): boolean {
  if (f.tema === 'propio') return !!f.propio;
  return !!TEMAS.find((t) => t.id === f.tema)?.fondo;
}

/** Reduce la foto elegida a un tamaño liviano para fondo (máx. 1080 px de ancho). */
export async function prepararFondoPropio(archivo: Blob): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo abrir esa imagen.'));
      i.src = url;
    });
    const escala = Math.min(1, 1080 / img.naturalWidth, 1920 / img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
