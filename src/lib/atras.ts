import { useEffect, useRef } from 'react';

// Botón "atrás" del celular (Android y gesto de iPhone) para paneles y ventanas.
//
// Cada capa abierta (emojis, adjuntar, un menú, la cámara…) agrega un paso al historial.
// Al ir atrás se cierra solo la capa de arriba, en vez de salir del chat.
// Si la capa se cierra con un botón de la pantalla, se quita su paso del historial.
//
// Todo pasa por una sola lista para que dos capas abiertas no se cierren a la vez.

type Capa = { id: number; cerrar: () => void };

const pila: Capa[] = [];
const porAgregar: Capa[] = []; // esperan a que termine un "atrás" que mandamos nosotros
let enCamino = 0; // "atrás" pedidos por el código que aún no llegan
let siguiente = Date.now(); // ids crecientes, también después de recargar la página
let escuchando = false;

function agregarPaso(capa: Capa) {
  history.pushState({ ...(history.state ?? {}), capa: capa.id }, '');
}

function alVolver(e: PopStateEvent) {
  if (enCamino > 0) {
    // Es el "atrás" que mandamos al cerrar una capa desde la pantalla: no se cierra nada más
    enCamino--;
    if (enCamino === 0) porAgregar.splice(0).forEach(agregarPaso);
    return;
  }
  const actual = typeof e.state?.capa === 'number' ? (e.state.capa as number) : 0;
  // Se cierran las capas que quedaron "adelante" del paso actual (normalmente, solo la de arriba)
  while (pila.length && pila[pila.length - 1].id > actual) pila.pop()!.cerrar();
}

/** Abre una capa y devuelve la función para quitarla cuando se cierra desde la pantalla. */
export function abrirCapa(cerrar: () => void): () => void {
  if (!escuchando) {
    window.addEventListener('popstate', alVolver);
    escuchando = true;
  }
  const capa: Capa = { id: ++siguiente, cerrar };
  pila.push(capa);
  if (enCamino > 0) porAgregar.push(capa);
  else agregarPaso(capa);

  return () => {
    const i = pila.indexOf(capa);
    if (i === -1) return; // ya se cerró con el botón atrás
    pila.splice(i, 1);
    const j = porAgregar.indexOf(capa);
    if (j !== -1) {
      porAgregar.splice(j, 1); // nunca llegó a entrar al historial
      return;
    }
    if (history.state?.capa === capa.id) {
      enCamino++;
      history.back();
    }
  };
}

/** Mientras `abierta` sea verdadero, el botón atrás llama a `cerrar` en vez de salir de la pantalla. */
export function useAtras(abierta: boolean, cerrar: () => void) {
  const ref = useRef(cerrar);
  ref.current = cerrar;
  useEffect(() => {
    if (!abierta) return;
    return abrirCapa(() => ref.current());
  }, [abierta]);
}
