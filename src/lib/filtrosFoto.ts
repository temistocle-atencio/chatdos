// Filtros y ajustes de color para el editor de fotos.
//
// Todo se reduce a UNA matriz de color (como feColorMatrix de SVG). La misma matriz se usa:
//   - en pantalla, como filtro SVG sobre la vista previa (rápido, en vivo), y
//   - al guardar, aplicada píxel por píxel.
// Así lo que se ve es exactamente lo que se envía, en cualquier navegador.

export interface Ajustes {
  brillo: number; // 1 = igual
  contraste: number; // 1 = igual
  saturacion: number; // 1 = igual, 0 = blanco y negro
  calidez: number; // 0 = igual, + cálido, − frío (−1 a 1)
  desvanecer: number; // 0 = igual, 1 = muy lavado (efecto retro)
}

export const SIN_AJUSTES: Ajustes = { brillo: 1, contraste: 1, saturacion: 1, calidez: 0, desvanecer: 0 };

export const FILTROS: { id: string; nombre: string; a: Ajustes }[] = [
  { id: 'original', nombre: 'Original', a: SIN_AJUSTES },
  { id: 'vivido', nombre: 'Vívido', a: { ...SIN_AJUSTES, saturacion: 1.35, contraste: 1.08 } },
  { id: 'calido', nombre: 'Cálido', a: { ...SIN_AJUSTES, calidez: 0.6, saturacion: 1.1 } },
  { id: 'frio', nombre: 'Frío', a: { ...SIN_AJUSTES, calidez: -0.6, brillo: 1.02 } },
  { id: 'dramatico', nombre: 'Dramático', a: { ...SIN_AJUSTES, contraste: 1.3, saturacion: 0.9, brillo: 0.95 } },
  { id: 'retro', nombre: 'Retro', a: { ...SIN_AJUSTES, calidez: 0.45, saturacion: 0.8, desvanecer: 0.8, contraste: 0.95 } },
  { id: 'byn', nombre: 'B y N', a: { ...SIN_AJUSTES, saturacion: 0, contraste: 1.15 } },
];

/** Filtro elegido + barras de ajuste encima */
export function combinar(base: Ajustes, extra: Ajustes): Ajustes {
  return {
    brillo: base.brillo * extra.brillo,
    contraste: base.contraste * extra.contraste,
    saturacion: base.saturacion * extra.saturacion,
    calidez: Math.max(-1, Math.min(1, base.calidez + extra.calidez)),
    desvanecer: Math.max(0, Math.min(1, base.desvanecer + extra.desvanecer)),
  };
}

export const esNeutro = (a: Ajustes) =>
  a.brillo === 1 && a.contraste === 1 && a.saturacion === 1 && a.calidez === 0 && a.desvanecer === 0;

// Matrices 4x5 (filas R, G, B, A; columnas r, g, b, a, desplazamiento en 0..1)
type M = number[]; // 20 números
const I: M = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** a ∘ b : primero b, después a */
function mult(a: M, b: M): M {
  const r: M = new Array(20).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      let v = j === 4 ? a[i * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[i * 5 + k] * b[k * 5 + j];
      r[i * 5 + j] = v;
    }
  }
  return r;
}

export function matriz(a: Ajustes): M {
  const b = a.brillo;
  const brillo: M = [b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
  const c = a.contraste;
  const o = (1 - c) / 2;
  const contraste: M = [c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0];
  const s = a.saturacion;
  const saturacion: M = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
  const t = a.calidez;
  const calidez: M = [1 + 0.12 * t, 0, 0, 0, 0, 0, 1 + 0.02 * t, 0, 0, 0, 0, 0, 1 - 0.12 * t, 0, 0, 0, 0, 0, 1, 0];
  const f = a.desvanecer;
  const k = 1 - 0.12 * f;
  const d = 0.09 * f;
  const desvanecer: M = [k, 0, 0, 0, d, 0, k, 0, 0, d, 0, 0, k, 0, d, 0, 0, 0, 1, 0];
  return [desvanecer, calidez, saturacion, contraste, brillo].reduce((acc, m) => mult(acc, m), I);
}

/** Valores para <feColorMatrix values="..."> */
export const valoresSvg = (a: Ajustes) => matriz(a).map((v) => +v.toFixed(5)).join(' ');

/** Aplica los ajustes a un canvas (píxel por píxel) */
export function aplicarAjustes(canvas: HTMLCanvasElement, a: Ajustes) {
  if (esNeutro(a)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const m = matriz(a);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = img.data;
  const o0 = m[4] * 255;
  const o1 = m[9] * 255;
  const o2 = m[14] * 255;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i];
    const g = p[i + 1];
    const b = p[i + 2];
    p[i] = m[0] * r + m[1] * g + m[2] * b + o0;
    p[i + 1] = m[5] * r + m[6] * g + m[7] * b + o1;
    p[i + 2] = m[10] * r + m[11] * g + m[12] * b + o2;
  }
  ctx.putImageData(img, 0, 0);
}
