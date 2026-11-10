// Nombre de la aplicación (lo cambia el administrador). Se muestra al instante con la última
// copia guardada en el celular y se actualiza por detrás.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const NOMBRE_POR_DEFECTO = 'ChatDos';
const CLAVE = 'chatdos-nombre-app';

let actual = (() => {
  try {
    return localStorage.getItem(CLAVE) || NOMBRE_POR_DEFECTO;
  } catch {
    return NOMBRE_POR_DEFECTO;
  }
})();
const avisos = new Set<(n: string) => void>();

function fijar(n: string) {
  const limpio = n.trim() || NOMBRE_POR_DEFECTO;
  if (limpio === actual) return;
  actual = limpio;
  try {
    localStorage.setItem(CLAVE, limpio);
  } catch {
    /* nada */
  }
  document.title = limpio;
  avisos.forEach((f) => f(limpio));
}

let pedido = false;
export async function refrescarNombre() {
  try {
    const { data } = await supabase.from('app_config').select('nombre').eq('id', 1).maybeSingle();
    if (data?.nombre) fijar(data.nombre);
  } catch {
    /* sin internet: se queda el guardado */
  }
}

export function useNombreApp(): string {
  const [n, setN] = useState(actual);
  useEffect(() => {
    avisos.add(setN);
    if (!pedido) {
      pedido = true;
      document.title = actual;
      refrescarNombre();
    }
    return () => {
      avisos.delete(setN);
    };
  }, []);
  return n;
}

export async function guardarNombreApp(nuevo: string): Promise<void> {
  const limpio = nuevo.trim().replace(/\s+/g, ' ');
  if (limpio.length < 1 || limpio.length > 24) throw new Error('El nombre debe tener de 1 a 24 letras.');
  const { error } = await supabase.from('app_config').update({ nombre: limpio, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw new Error('No se pudo cambiar el nombre.');
  fijar(limpio);
}

/**
 * Parte el nombre en dos para los colores de la marca (primera parte azul, segunda naranja),
 * como "Chat" + "Dos". Se parte en el espacio o en la última mayúscula ("MiChat" -> "Mi" + "Chat").
 */
export function partirNombre(n: string): [string, string] {
  const espacio = n.indexOf(' ');
  if (espacio > 0) return [n.slice(0, espacio), n.slice(espacio)];
  for (let i = n.length - 1; i > 0; i--) {
    const c = n[i];
    if (c >= 'A' && c <= 'Z' && n[i - 1] !== n[i - 1].toUpperCase()) return [n.slice(0, i), n.slice(i)];
  }
  return [n, ''];
}
