import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Undo2, RotateCcw, Trash2, Crop, Pencil, Type, Smile, SlidersHorizontal, EyeOff } from 'lucide-react';
import { FILTROS, SIN_AJUSTES, combinar, valoresSvg, aplicarAjustes, esNeutro, type Ajustes } from '../lib/filtrosFoto';
import { IconoSticker } from './Iconos';
import { SelectorStickers } from './SelectorStickers';

// Editor de fotos antes de enviar (como WhatsApp): recortar y girar, filtros y ajustes, dibujar,
// ocultar (pixelar), escribir y poner emojis o stickers.
// Todo se hace en el celular y el resultado es una foto nueva.

export type HerramientaFoto = 'recortar' | 'dibujar' | 'texto' | 'emoji' | 'sticker' | 'ajustes' | 'ocultar';

type Pincel = 'marcador' | 'neon' | 'resaltador';
const PINCELES: { id: Pincel; nombre: string }[] = [
  { id: 'marcador', nombre: 'Marcador' },
  { id: 'neon', nombre: 'Neón' },
  { id: 'resaltador', nombre: 'Resaltador' },
];
// Fuentes del texto
const FUENTES = [
  { nombre: 'Clásica', css: (t: number) => `700 ${t}px Poppins, system-ui, sans-serif` },
  { nombre: 'Elegante', css: (t: number) => `italic 700 ${t}px Georgia, "Times New Roman", serif` },
  { nombre: 'Máquina', css: (t: number) => `700 ${t}px "Courier New", ui-monospace, monospace` },
];

const COLORES = ['#FFFFFF', '#1F2933', '#E5484D', '#F28C1B', '#FFD60A', '#1E9E5A', '#005198', '#C084FC'];
const EMOJIS = ['😂', '❤️', '😍', '🥰', '😘', '😊', '😎', '🤩', '😜', '🤔', '😢', '😭', '😡', '🥳', '😴', '🤗', '👍', '👏', '🙌', '🙏', '💪', '🔥', '✨', '⭐', '🎉', '🎂', '🌹', '🌸', '☀️', '🌙', '💯', '💋', '👀', '😱', '🤣', '😇', '🐶', '🐱', '🍕', '☕'];
const PROPORCIONES: { nombre: string; r: number | null }[] = [
  { nombre: 'Libre', r: null },
  { nombre: '1:1', r: 1 },
  { nombre: '4:3', r: 4 / 3 },
  { nombre: '3:4', r: 3 / 4 },
  { nombre: '16:9', r: 16 / 9 },
];

interface Trazo {
  color: string;
  grosor: number; // px de la foto
  puntos: { x: number; y: number }[];
  pincel?: Pincel;
  /** Pixela lo que hay debajo (para ocultar caras, placas o datos) */
  ocultar?: boolean;
}
interface Pegado {
  id: string;
  tipo: 'texto' | 'emoji' | 'sticker';
  img?: HTMLImageElement; // stickers
  valor: string;
  color: string;
  x: number; // centro, px de la foto
  y: number;
  tam: number; // px de la foto
  fuente?: number; // índice en FUENTES
  fondo?: boolean; // texto sobre un recuadro de color
}
interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FUENTE = (tam: number, fuente = 0) => (FUENTES[fuente] ?? FUENTES[0]).css(tam);
const contraste = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1F2933' : '#FFFFFF';
};

function pintarPegado(ctx: CanvasRenderingContext2D, p: Pegado) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (p.tipo === 'sticker' && p.img) {
    const h = (p.tam * p.img.naturalHeight) / Math.max(1, p.img.naturalWidth);
    ctx.drawImage(p.img, p.x - p.tam / 2, p.y - h / 2, p.tam, h);
  } else if (p.tipo === 'emoji') {
    ctx.font = `${p.tam}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(p.valor, p.x, p.y);
  } else {
    ctx.font = FUENTE(p.tam, p.fuente);
    const ls = p.valor.split('\n');
    const alto = p.tam * 1.15;
    if (p.fondo) {
      // Recuadro de color detrás del texto (el texto va en el color que contrasta)
      const { w, h } = medirPegado(ctx, p);
      ctx.fillStyle = p.color;
      const r = p.tam * 0.3;
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, p.y - h / 2 - p.tam * 0.08, w, h + p.tam * 0.16, r);
      ctx.fill();
    }
    ls.forEach((l, i) => {
      const y = p.y + (i - (ls.length - 1) / 2) * alto;
      if (p.fondo) {
        ctx.fillStyle = contraste(p.color);
        ctx.fillText(l, p.x, y);
        return;
      }
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, p.tam / 7);
      ctx.strokeStyle = contraste(p.color);
      ctx.strokeText(l, p.x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(l, p.x, y);
    });
  }
  ctx.restore();
}

function caminoTrazo(ctx: CanvasRenderingContext2D, t: Trazo) {
  ctx.beginPath();
  ctx.moveTo(t.puntos[0].x, t.puntos[0].y);
  if (t.puntos.length === 1) ctx.lineTo(t.puntos[0].x + 0.01, t.puntos[0].y);
  else for (const p of t.puntos.slice(1)) ctx.lineTo(p.x, p.y);
}

function pintarTrazo(ctx: CanvasRenderingContext2D, t: Trazo) {
  if (!t.puntos.length || t.ocultar) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (t.pincel === 'neon') {
    // Neón: halo del color y centro blanco
    ctx.shadowColor = t.color;
    ctx.shadowBlur = t.grosor * 1.6;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = t.grosor;
    caminoTrazo(ctx, t);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = t.grosor * 0.4;
    caminoTrazo(ctx, t);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (t.pincel === 'resaltador') {
    ctx.globalAlpha = 0.4;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = t.color;
    ctx.lineWidth = t.grosor * 2.2;
    caminoTrazo(ctx, t);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.strokeStyle = t.color;
  ctx.fillStyle = t.color;
  ctx.lineWidth = t.grosor;
  ctx.beginPath();
  ctx.moveTo(t.puntos[0].x, t.puntos[0].y);
  if (t.puntos.length === 1) {
    ctx.arc(t.puntos[0].x, t.puntos[0].y, t.grosor / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const p of t.puntos.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Pixela las zonas pintadas con "ocultar": se hace una versión de la foto en cuadritos
 * grandes y se deja ver solo donde se pasó el dedo.
 */
function pintarOcultos(ctx: CanvasRenderingContext2D, fuente: HTMLCanvasElement, trazos: Trazo[]) {
  const ocultos = trazos.filter((t) => t.ocultar && t.puntos.length);
  if (!ocultos.length) return;
  const w = fuente.width;
  const h = fuente.height;
  const cuadro = Math.max(8, Math.round(Math.min(w, h) / 45));
  const chico = document.createElement('canvas');
  chico.width = Math.max(1, Math.ceil(w / cuadro));
  chico.height = Math.max(1, Math.ceil(h / cuadro));
  chico.getContext('2d')!.drawImage(fuente, 0, 0, chico.width, chico.height);
  const capa = document.createElement('canvas');
  capa.width = w;
  capa.height = h;
  const c = capa.getContext('2d')!;
  // Dónde se pasó el dedo
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = '#000';
  for (const t of ocultos) {
    c.lineWidth = t.grosor;
    caminoTrazo(c, t);
    c.stroke();
  }
  // Ahí, la foto en cuadritos
  c.globalCompositeOperation = 'source-in';
  c.imageSmoothingEnabled = false;
  c.drawImage(chico, 0, 0, chico.width * cuadro, chico.height * cuadro);
  ctx.drawImage(capa, 0, 0);
}

function medirPegado(ctx: CanvasRenderingContext2D, p: Pegado) {
  if (p.tipo === 'sticker' && p.img) return { w: p.tam, h: (p.tam * p.img.naturalHeight) / Math.max(1, p.img.naturalWidth) };
  if (p.tipo === 'emoji') return { w: p.tam * 1.1, h: p.tam * 1.1 };
  ctx.font = FUENTE(p.tam, p.fuente);
  const ls = p.valor.split('\n');
  return { w: Math.max(...ls.map((l) => ctx.measureText(l).width)) + p.tam * 0.3, h: ls.length * p.tam * 1.15 };
}

const cargar = (b: Blob) =>
  new Promise<HTMLImageElement>((ok, mal) => {
    const u = URL.createObjectURL(b);
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error('No se pudo abrir la foto'));
    i.src = u;
  });

export const EditorFoto: React.FC<{
  imagen: Blob;
  herramienta: HerramientaFoto;
  onCancelar: () => void;
  onListo: (b: Blob) => void;
  /** Para stickers propios */
  userId?: string;
  miLlavePublica?: unknown;
  /** Modo capa (videos): la imagen es solo de guía y el resultado es un PNG transparente con lo agregado */
  capa?: boolean;
}> = ({ imagen, herramienta, onCancelar, onListo, userId, miLlavePublica, capa = false }) => {
  const [stickers, setStickers] = useState(herramienta === 'sticker');
  // Filtro y ajustes de color (se aplican al guardar; en pantalla con un filtro SVG idéntico)
  const [filtro, setFiltro] = useState('original');
  const [extra, setExtra] = useState<Ajustes>(SIN_AJUSTES);
  const [pestanaAjustes, setPestanaAjustes] = useState<'filtros' | 'ajustes'>('filtros');
  const [pincel, setPincel] = useState<Pincel>('marcador');
  const [miniatura, setMiniatura] = useState('');
  const [modo, setModo] = useState<HerramientaFoto | 'ver'>(
    herramienta === 'texto' || herramienta === 'emoji' || herramienta === 'sticker' ? 'ver' : herramienta
  );
  const baseRef = useRef<HTMLCanvasElement | null>(null); // la foto (ya recortada/girada)
  const vistaRef = useRef<HTMLCanvasElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 }); // tamaño de la foto
  const [escala, setEscala] = useState(1); // px de pantalla por px de foto
  const [trazos, setTrazos] = useState<Trazo[]>([]);
  const [pegados, setPegados] = useState<Pegado[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [color, setColor] = useState('#E5484D');
  const [grosor, setGrosor] = useState(8); // px de pantalla
  const [recorte, setRecorte] = useState<Caja | null>(null);
  const [proporcion, setProporcion] = useState<number | null>(null);
  const [escribiendo, setEscribiendo] = useState<{ id: string | null; texto: string; color: string; fuente: number; fondo: boolean } | null>(
    herramienta === 'texto' ? { id: null, texto: '', color: '#FFFFFF', fuente: 0, fondo: false } : null
  );
  const [emojis, setEmojis] = useState(herramienta === 'emoji');
  const [version, setVersion] = useState(0);
  const dibujando = useRef<Trazo | null>(null);
  const arrastre = useRef<{ id: string; dx: number; dy: number; pinza?: { d: number; tam: number } } | null>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const recorteMov = useRef<{ tipo: string; x0: number; y0: number; c: Caja } | null>(null);

  // Cargar la foto
  useEffect(() => {
    let vivo = true;
    cargar(imagen).then((img) => {
      if (!vivo) return;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
      baseRef.current = c;
      setTam({ w: c.width, h: c.height });
    });
    return () => {
      vivo = false;
    };
  }, [imagen]);

  // Miniatura de la foto para la tira de filtros
  useEffect(() => {
    const base = baseRef.current;
    if (!base || !tam.w) return;
    const lado = 120;
    const k = lado / Math.min(tam.w, tam.h);
    const c = document.createElement('canvas');
    c.width = lado;
    c.height = lado;
    c.getContext('2d')!.drawImage(base, (lado - tam.w * k) / 2, (lado - tam.h * k) / 2, tam.w * k, tam.h * k);
    setMiniatura(c.toDataURL('image/jpeg', 0.7));
  }, [tam]);

  const ajustesFinales = combinar(FILTROS.find((f) => f.id === filtro)?.a ?? SIN_AJUSTES, extra);
  const conColor = !capa && !esNeutro(ajustesFinales);

  // Ajustar a la pantalla
  const ajustar = useCallback(() => {
    const caja = cajaRef.current;
    if (!caja || !tam.w) return;
    const r = caja.getBoundingClientRect();
    const margen = modo === 'recortar' ? 32 : 0;
    setEscala(Math.min((r.width - margen) / tam.w, (r.height - margen) / tam.h));
  }, [tam, modo]);
  useEffect(() => {
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [ajustar]);

  // Dibujar la vista
  useEffect(() => {
    const v = vistaRef.current;
    const base = baseRef.current;
    if (!v || !base || !tam.w) return;
    v.width = tam.w;
    v.height = tam.h;
    const ctx = v.getContext('2d')!;
    ctx.drawImage(base, 0, 0);
    pintarOcultos(ctx, base, dibujando.current ? [...trazos, dibujando.current] : trazos);
    trazos.forEach((t) => pintarTrazo(ctx, t));
    if (dibujando.current) pintarTrazo(ctx, dibujando.current);
    pegados.forEach((p) => {
      if (escribiendo?.id === p.id) return;
      pintarPegado(ctx, p);
      if (p.id === elegido) {
        const { w, h } = medirPegado(ctx, p);
        ctx.save();
        ctx.setLineDash([10 / escala, 8 / escala]);
        ctx.lineWidth = 2 / escala;
        ctx.strokeStyle = '#FFFFFF';
        ctx.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
        ctx.restore();
      }
    });
  }, [tam, trazos, pegados, elegido, escala, version, escribiendo]);

  // Al entrar a recortar, lo dibujado se pega a la foto (así se recorta junto)
  const aplanar = useCallback(() => {
    const base = baseRef.current;
    if (!base || (!trazos.length && !pegados.length)) return;
    const ctx = base.getContext('2d')!;
    pintarOcultos(ctx, base, trazos);
    trazos.forEach((t) => pintarTrazo(ctx, t));
    pegados.forEach((p) => pintarPegado(ctx, p));
    setTrazos([]);
    setPegados([]);
    setElegido(null);
  }, [trazos, pegados]);

  useEffect(() => {
    if (modo === 'recortar' && tam.w) {
      aplanar();
      setRecorte({ x: 0, y: 0, w: tam.w, h: tam.h });
    } else {
      setRecorte(null);
      baseAntesRef.current = null;
      setGrados(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, tam.w]);

  const aFoto = (e: { clientX: number; clientY: number }) => {
    const r = vistaRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * tam.w, y: ((e.clientY - r.top) / r.height) * tam.h };
  };

  const pegadoEn = (pt: { x: number; y: number }) => {
    const ctx = vistaRef.current?.getContext('2d');
    if (!ctx) return null;
    for (let i = pegados.length - 1; i >= 0; i--) {
      const p = pegados[i];
      const { w, h } = medirPegado(ctx, p);
      const holgura = 14 / escala;
      if (Math.abs(pt.x - p.x) <= w / 2 + holgura && Math.abs(pt.y - p.y) <= h / 2 + holgura) return p;
    }
    return null;
  };

  // ---------- Toques sobre la foto ----------
  const alBajar = (e: React.PointerEvent) => {
    if (modo === 'recortar') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pt = aFoto(e);
    // Dos dedos sobre un texto o emoji: agrandar o achicar
    if (toques.current.size === 2 && arrastre.current) {
      const [a, b] = [...toques.current.values()];
      const p = pegados.find((x) => x.id === arrastre.current!.id);
      if (p) arrastre.current.pinza = { d: Math.hypot(a.x - b.x, a.y - b.y), tam: p.tam };
      return;
    }
    const p = pegadoEn(pt);
    if (p) {
      setElegido(p.id);
      arrastre.current = { id: p.id, dx: pt.x - p.x, dy: pt.y - p.y };
      return;
    }
    setElegido(null);
    if (modo === 'dibujar') {
      dibujando.current = { color, grosor: grosor / escala, puntos: [pt], pincel };
      setVersion((v) => v + 1);
    } else if (modo === 'ocultar') {
      dibujando.current = { color: '#000', grosor: (grosor * 4) / escala, puntos: [pt], ocultar: true };
      setVersion((v) => v + 1);
    }
  };

  const alMover = (e: React.PointerEvent) => {
    if (!toques.current.has(e.pointerId)) return;
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = arrastre.current;
    if (a?.pinza && toques.current.size >= 2) {
      const [p1, p2] = [...toques.current.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const nuevo = Math.max(12 / escala, Math.min(tam.w * 0.9, (a.pinza.tam * d) / a.pinza.d));
      setPegados((l) => l.map((p) => (p.id === a.id ? { ...p, tam: nuevo } : p)));
      return;
    }
    const pt = aFoto(e);
    if (a) {
      setPegados((l) => l.map((p) => (p.id === a.id ? { ...p, x: pt.x - a.dx, y: pt.y - a.dy } : p)));
      return;
    }
    if (dibujando.current) {
      dibujando.current.puntos.push(pt);
      setVersion((v) => v + 1);
    }
  };

  const alSubir = (e: React.PointerEvent) => {
    toques.current.delete(e.pointerId);
    if (toques.current.size > 0) return;
    if (arrastre.current) {
      arrastre.current = null;
      return;
    }
    const t = dibujando.current;
    dibujando.current = null;
    if (t) setTrazos((l) => [...l, t]);
  };

  // ---------- Recortar ----------
  const ponerProporcion = (r: number | null) => {
    setProporcion(r);
    if (!r || !tam.w) return;
    let w = tam.w;
    let h = w / r;
    if (h > tam.h) {
      h = tam.h;
      w = h * r;
    }
    setRecorte({ x: (tam.w - w) / 2, y: (tam.h - h) / 2, w, h });
  };

  const bajarRecorte = (tipo: string) => (e: React.PointerEvent) => {
    if (!recorte) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = aFoto(e);
    recorteMov.current = { tipo, x0: pt.x, y0: pt.y, c: recorte };
  };
  const moverRecorte = (e: React.PointerEvent) => {
    const m = recorteMov.current;
    if (!m) return;
    const pt = aFoto(e);
    const dx = pt.x - m.x0;
    const dy = pt.y - m.y0;
    const min = 40 / escala;
    let { x, y, w, h } = m.c;
    if (m.tipo === 'mover') {
      x = Math.max(0, Math.min(tam.w - w, x + dx));
      y = Math.max(0, Math.min(tam.h - h, y + dy));
    } else {
      if (m.tipo.includes('i')) {
        const nx = Math.max(0, Math.min(x + w - min, x + dx));
        w += x - nx;
        x = nx;
      }
      if (m.tipo.includes('d')) w = Math.max(min, Math.min(tam.w - x, w + dx));
      if (m.tipo.includes('a')) {
        const ny = Math.max(0, Math.min(y + h - min, y + dy));
        h += y - ny;
        y = ny;
      }
      if (m.tipo.includes('b')) h = Math.max(min, Math.min(tam.h - y, h + dy));
      if (proporcion) {
        // Mantener la proporción elegida
        const nh = w / proporcion;
        if (y + nh <= tam.h) h = nh;
        else {
          h = tam.h - y;
          w = h * proporcion;
        }
      }
    }
    setRecorte({ x, y, w, h });
  };

  const aplicarRecorte = () => {
    const base = baseRef.current;
    if (!base || !recorte) return;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(recorte.w));
    c.height = Math.max(1, Math.round(recorte.h));
    c.getContext('2d')!.drawImage(base, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, c.width, c.height);
    baseRef.current = c;
    setTam({ w: c.width, h: c.height });
  };

  // Enderezar: girar unos grados (−15 a 15) y recortar los bordes vacíos.
  // Se parte siempre de la foto de antes de enderezar, para no degradarla al mover la barra.
  const [grados, setGrados] = useState(0);
  const baseAntesRef = useRef<HTMLCanvasElement | null>(null);
  const enderezar = (g: number) => {
    if (!baseAntesRef.current) baseAntesRef.current = baseRef.current;
    const base = baseAntesRef.current;
    if (!base) return;
    setGrados(g);
    if (!g) {
      baseRef.current = base;
      setTam({ w: base.width, h: base.height });
      setRecorte({ x: 0, y: 0, w: base.width, h: base.height });
      return;
    }
    const rad = (Math.abs(g) * Math.PI) / 180;
    const w = base.width;
    const h = base.height;
    // El rectángulo más grande con la misma proporción que cabe dentro de la foto girada
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const k = Math.min(w / (w * cos + h * sin), h / (w * sin + h * cos));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((g * Math.PI) / 180);
    ctx.drawImage(base, -w / 2, -h / 2);
    baseRef.current = c;
    setTam({ w: c.width, h: c.height });
    setRecorte({ x: 0, y: 0, w: c.width, h: c.height });
    setProporcion(null);
  };

  const girar = () => {
    const base = baseRef.current;
    if (!base) return;
    if (recorte && (recorte.x || recorte.y || recorte.w !== tam.w || recorte.h !== tam.h)) aplicarRecorte();
    const b = baseRef.current!;
    const c = document.createElement('canvas');
    c.width = b.height;
    c.height = b.width;
    const ctx = c.getContext('2d')!;
    ctx.translate(0, c.height);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(b, 0, 0);
    baseRef.current = c;
    baseAntesRef.current = null;
    setGrados(0);
    setTam({ w: c.width, h: c.height });
    setRecorte({ x: 0, y: 0, w: c.width, h: c.height });
    setProporcion(null);
  };

  // ---------- Texto y emojis ----------
  const guardarTexto = () => {
    const e = escribiendo;
    setEscribiendo(null);
    if (!e) return;
    const texto = e.texto.trim();
    if (e.id) {
      setPegados((l) =>
        texto ? l.map((p) => (p.id === e.id ? { ...p, valor: texto, color: e.color, fuente: e.fuente, fondo: e.fondo } : p)) : l.filter((p) => p.id !== e.id)
      );
      return;
    }
    if (!texto) return;
    const id = crypto.randomUUID();
    setPegados((l) => [
      ...l,
      { id, tipo: 'texto', valor: texto, color: e.color, fuente: e.fuente, fondo: e.fondo, x: tam.w / 2, y: tam.h / 2, tam: Math.max(24, Math.min(tam.w, tam.h) / 10) },
    ]);
    setElegido(id);
  };

  const ponerEmoji = (em: string) => {
    setEmojis(false);
    const id = crypto.randomUUID();
    setPegados((l) => [...l, { id, tipo: 'emoji', valor: em, color: '#000000', x: tam.w / 2, y: tam.h / 2, tam: Math.min(tam.w, tam.h) / 5 }]);
    setElegido(id);
  };

  const ponerSticker = (url: string) => {
    setStickers(false);
    const img = new Image();
    img.onload = () => {
      const id = crypto.randomUUID();
      setPegados((l) => [...l, { id, tipo: 'sticker', valor: '', img, color: '#000000', x: tam.w / 2, y: tam.h / 2, tam: Math.min(tam.w, tam.h) / 2.5 }]);
      setElegido(id);
    };
    img.src = url;
  };

  const sel = pegados.find((p) => p.id === elegido);

  // ---------- Terminar ----------
  const terminar = () => {
    if (recorte && modo === 'recortar') aplicarRecorte();
    const base = baseRef.current;
    if (!base) return;
    // Se espera un momento para que el recorte quede aplicado
    setTimeout(() => {
      const b = baseRef.current!;
      const c = document.createElement('canvas');
      c.width = b.width;
      c.height = b.height;
      const ctx = c.getContext('2d')!;
      if (!capa) {
        ctx.drawImage(b, 0, 0);
        pintarOcultos(ctx, b, trazos);
      }
      trazos.forEach((t) => pintarTrazo(ctx, t));
      pegados.forEach((p) => pintarPegado(ctx, p));
      if (!capa) aplicarAjustes(c, ajustesFinales);
      if (capa) c.toBlob((bl) => bl && onListo(bl), 'image/png');
      else c.toBlob((bl) => bl && onListo(bl), 'image/jpeg', 0.92);
    }, 30);
  };

  const herramientaBtn = (h: HerramientaFoto, Icono: React.FC<{ className?: string; strokeWidth?: number }>, etiqueta: string) => (
    <button
      type="button"
      onClick={() => {
        if (h === 'texto') {
          setModo('ver');
          setEscribiendo({ id: null, texto: '', color: '#FFFFFF', fuente: 0, fondo: false });
        } else if (h === 'emoji') {
          setModo('ver');
          setEmojis(true);
        } else if (h === 'sticker') {
          setModo('ver');
          setStickers(true);
        } else setModo(modo === h ? 'ver' : h);
      }}
      className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors ${modo === h ? 'bg-white text-[#1F2933]' : 'bg-black/45 text-white'}`}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Icono className="w-5 h-5" strokeWidth={2} />
    </button>
  );

  const W = tam.w * escala;
  const H = tam.h * escala;

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white flex flex-col select-none animate-[aparecer_0.2s_ease-out]" style={{ touchAction: 'none' }}>
      {/* Arriba */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 overflow-x-auto [scrollbar-width:none]" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)', paddingBottom: 10 }}>
        <button type="button" onClick={onCancelar} className="w-11 h-11 shrink-0 rounded-full bg-black/45 flex items-center justify-center" aria-label="Cancelar">
          <X className="w-6 h-6" strokeWidth={2} />
        </button>
        <div className="flex-1" />
        {(trazos.length > 0 || dibujando.current) && (modo === 'dibujar' || modo === 'ocultar') && (
          <button
            type="button"
            onClick={() => setTrazos((l) => l.slice(0, -1))}
            className="w-11 h-11 rounded-full bg-black/45 flex items-center justify-center"
            aria-label="Deshacer"
          >
            <Undo2 className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
        {!capa && herramientaBtn('ajustes', SlidersHorizontal, 'Filtros y ajustes')}
        {!capa && herramientaBtn('recortar', Crop, 'Recortar y girar')}
        {!capa && herramientaBtn('ocultar', EyeOff, 'Ocultar (pixelar)')}
        {userId && herramientaBtn('sticker', IconoSticker, 'Stickers')}
        {herramientaBtn('emoji', Smile, 'Emojis')}
        {herramientaBtn('texto', Type, 'Texto')}
        {herramientaBtn('dibujar', Pencil, 'Dibujar')}
      </div>

      {/* Ocultar: grosor del pincel */}
      {modo === 'ocultar' && (
        <div className="shrink-0 flex items-center justify-center gap-3 pb-2 text-xs font-['Inter'] text-white/80">
          Pasa el dedo por lo que quieras ocultar
          <input
            type="range"
            min={3}
            max={24}
            value={grosor}
            onChange={(e) => setGrosor(Number(e.target.value))}
            className="w-24 accent-white"
            aria-label="Tamaño del pincel"
          />
        </div>
      )}

      {/* Colores (dibujar) */}
      {modo === 'dibujar' && (
        <div className="shrink-0 flex justify-center gap-1.5 pb-2">
          {PINCELES.map((pc) => (
            <button
              key={pc.id}
              type="button"
              onClick={() => setPincel(pc.id)}
              className={`h-8 px-3 rounded-full text-xs font-['Inter'] ${pincel === pc.id ? 'bg-white text-[#1F2933]' : 'bg-white/15 text-white'}`}
              aria-pressed={pincel === pc.id}
            >
              {pc.nombre}
            </button>
          ))}
        </div>
      )}
      {modo === 'dibujar' && (
        <div className="shrink-0 flex items-center justify-center gap-2 pb-2 px-2 flex-wrap">
          {/* Cualquier color: tocar o arrastrar sobre el arcoíris */}
          <input
            type="range"
            min={0}
            max={360}
            onChange={(e) => setColor(`hsl(${e.target.value} 90% 55%)`)}
            className="w-24 h-3 rounded-full appearance-none cursor-pointer"
            style={{ background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
            aria-label="Elegir cualquier color"
          />
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-white/30'}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <input
            type="range"
            min={3}
            max={24}
            value={grosor}
            onChange={(e) => setGrosor(Number(e.target.value))}
            className="w-20 ml-2 accent-white"
            aria-label="Grosor"
          />
        </div>
      )}

      {/* La foto */}
      <div ref={cajaRef} className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {!tam.w && <span className="text-sm text-white/70">Abriendo la foto…</span>}
        <div className="relative" style={{ width: W, height: H }}>
          {/* El mismo filtro que se aplica al guardar, en vivo */}
          <svg width="0" height="0" className="absolute" aria-hidden="true">
            <filter id="editor-color" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={valoresSvg(ajustesFinales)} />
            </filter>
            {FILTROS.map((f) => (
              <filter key={f.id} id={`editor-filtro-${f.id}`} colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values={valoresSvg(f.a)} />
              </filter>
            ))}
          </svg>
          <canvas
            ref={vistaRef}
            style={{ width: W, height: H, touchAction: 'none', filter: conColor ? 'url(#editor-color)' : undefined }}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSubir}
            onPointerCancel={alSubir}
            onDoubleClick={(e) => {
              const p = pegadoEn(aFoto(e));
              if (p?.tipo === 'texto') setEscribiendo({ id: p.id, texto: p.valor, color: p.color, fuente: p.fuente ?? 0, fondo: !!p.fondo });
            }}
          />
          {/* Marco de recorte */}
          {modo === 'recortar' && recorte && (
            <div className="absolute inset-0" onPointerMove={moverRecorte} onPointerUp={() => (recorteMov.current = null)}>
              <div
                className="absolute border-2 border-white cursor-move"
                style={{
                  left: recorte.x * escala,
                  top: recorte.y * escala,
                  width: recorte.w * escala,
                  height: recorte.h * escala,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                }}
                onPointerDown={bajarRecorte('mover')}
              >
                {/* Líneas de tercios */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/25" />
                  ))}
                </div>
                {['ai', 'ad', 'bi', 'bd'].map((t) => (
                  <span
                    key={t}
                    onPointerDown={bajarRecorte(t)}
                    className="absolute w-8 h-8"
                    style={{
                      [t.includes('a') ? 'top' : 'bottom']: -6,
                      [t.includes('i') ? 'left' : 'right']: -6,
                      borderColor: 'white',
                      borderStyle: 'solid',
                      borderWidth: 0,
                      [t.includes('a') ? 'borderTopWidth' : 'borderBottomWidth']: 4,
                      [t.includes('i') ? 'borderLeftWidth' : 'borderRightWidth']: 4,
                    }}
                  />
                ))}
                {['a', 'b', 'i', 'd'].map((t) => (
                  <span
                    key={t}
                    onPointerDown={bajarRecorte(t)}
                    className="absolute"
                    style={
                      t === 'a' || t === 'b'
                        ? { left: '25%', width: '50%', height: 24, [t === 'a' ? 'top' : 'bottom']: -12 }
                        : { top: '25%', height: '50%', width: 24, [t === 'i' ? 'left' : 'right']: -12 }
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Abajo: opciones de la herramienta */}
      <div className="shrink-0 px-3 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        {modo === 'ajustes' ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-center gap-1.5">
              {(['filtros', 'ajustes'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPestanaAjustes(t)}
                  className={`h-8 px-4 rounded-full text-xs font-['Inter'] ${pestanaAjustes === t ? 'bg-white text-[#1F2933]' : 'bg-white/15'}`}
                >
                  {t === 'filtros' ? 'Filtros' : 'Ajustes'}
                </button>
              ))}
            </div>
            {pestanaAjustes === 'filtros' ? (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltro(f.id)}
                    className="shrink-0 flex flex-col items-center gap-1"
                    aria-pressed={filtro === f.id}
                  >
                    <span className={`block w-16 h-16 rounded-[8px] overflow-hidden border-2 ${filtro === f.id ? 'border-[#F28C1B]' : 'border-transparent'}`}>
                      {miniatura && (
                        <img src={miniatura} alt="" className="w-full h-full object-cover" style={{ filter: `url(#editor-filtro-${f.id})` }} />
                      )}
                    </span>
                    <span className={`text-[11px] font-['Inter'] ${filtro === f.id ? 'text-[#F28C1B]' : 'text-white/85'}`}>{f.nombre}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-xs font-['Inter']">
                {(
                  [
                    ['brillo', 'Brillo', 0.6, 1.4],
                    ['contraste', 'Contraste', 0.6, 1.5],
                    ['saturacion', 'Saturación', 0, 2],
                    ['calidez', 'Calidez', -1, 1],
                  ] as const
                ).map(([k, nombre, min, max]) => {
                  const v = extra[k];
                  const neutro = k === 'calidez' ? 0 : 1;
                  const pct = Math.round(((v - neutro) / (v >= neutro ? max - neutro : neutro - min)) * 100);
                  return (
                    <React.Fragment key={k}>
                      <span className="text-white/85 w-[70px]">{nombre}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.01}
                        value={v}
                        onChange={(e) => setExtra((a) => ({ ...a, [k]: Number(e.target.value) }))}
                        onDoubleClick={() => setExtra((a) => ({ ...a, [k]: neutro }))}
                        className="w-full accent-[#F28C1B]"
                        aria-label={nombre}
                      />
                      <span className="w-9 text-right tabular-nums text-white/70">{pct > 0 ? `+${pct}` : pct}</span>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setFiltro('original');
                  setExtra(SIN_AJUSTES);
                }}
                className="h-10 px-4 rounded-full bg-white/15 text-xs font-['Inter']"
              >
                Quitar todo
              </button>
              <button
                type="button"
                onClick={() => setModo('ver')}
                className="h-10 px-5 rounded-full bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm"
              >
                Aplicar
              </button>
            </div>
          </div>
        ) : modo === 'recortar' ? (
          <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-1 text-xs font-['Inter'] text-white/85">
            <span className="w-[70px]">Enderezar</span>
            <input
              type="range"
              min={-15}
              max={15}
              step={0.5}
              value={grados}
              onChange={(e) => enderezar(Number(e.target.value))}
              onDoubleClick={() => enderezar(0)}
              className="flex-1 accent-[#F28C1B]"
              aria-label="Enderezar"
            />
            <span className="w-10 text-right tabular-nums text-white/70">{grados > 0 ? `+${grados}°` : `${grados}°`}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={girar} className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0" aria-label="Girar 90 grados">
              <RotateCcw className="w-5 h-5" strokeWidth={2} />
            </button>
            <div className="flex-1 flex gap-1.5 overflow-x-auto">
              {PROPORCIONES.map((p) => (
                <button
                  key={p.nombre}
                  type="button"
                  onClick={() => ponerProporcion(p.r)}
                  className={`h-9 px-3 rounded-full text-xs font-['Inter'] shrink-0 ${proporcion === p.r ? 'bg-white text-[#1F2933]' : 'bg-white/15'}`}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                aplicarRecorte();
                setModo('ver');
              }}
              className="h-11 px-4 rounded-full bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm shrink-0"
            >
              Recortar
            </button>
          </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto">
              {sel?.tipo === 'texto' &&
                COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPegados((l) => l.map((p) => (p.id === sel.id ? { ...p, color: c } : p)))}
                    className={`w-7 h-7 shrink-0 rounded-full border-2 ${sel.color === c ? 'border-white' : 'border-white/30'}`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              {sel?.tipo === 'texto' && (
                <button
                  type="button"
                  onClick={() => setEscribiendo({ id: sel.id, texto: sel.valor, color: sel.color, fuente: sel.fuente ?? 0, fondo: !!sel.fondo })}
                  className="h-9 px-3 shrink-0 rounded-full bg-white/15 text-xs"
                >
                  Editar
                </button>
              )}
              {sel && (
                <button
                  type="button"
                  onClick={() => {
                    setPegados((l) => l.filter((p) => p.id !== sel.id));
                    setElegido(null);
                  }}
                  className="w-9 h-9 shrink-0 rounded-full bg-[#E5484D] flex items-center justify-center"
                  aria-label="Quitar"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
              {sel && sel.tipo !== 'texto' && <span className="text-[11px] text-white/70">Arrastra · dos dedos para el tamaño</span>}
            </div>
            <button
              type="button"
              onClick={terminar}
              disabled={!tam.w}
              className="h-12 px-5 shrink-0 rounded-full bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center gap-2"
            >
              <Check className="w-5 h-5" strokeWidth={2.5} /> Listo
            </button>
          </div>
        )}
      </div>

      {/* Escribir un texto */}
      {escribiendo && (
        <div className="absolute inset-0 z-10 bg-black/90 flex flex-col animate-[aparecer_0.15s_ease-out]">
          <div className="flex items-center justify-between px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
            <button type="button" onClick={() => setEscribiendo(null)} className="w-11 h-11 flex items-center justify-center" aria-label="Cancelar">
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEscribiendo({ ...escribiendo, fuente: (escribiendo.fuente + 1) % FUENTES.length })}
                className="h-10 px-3 rounded-full bg-white/15 text-sm"
                style={{ font: FUENTE(15, escribiendo.fuente) }}
                aria-label={`Fuente: ${FUENTES[escribiendo.fuente].nombre}. Toca para cambiarla`}
              >
                {FUENTES[escribiendo.fuente].nombre}
              </button>
              <button
                type="button"
                onClick={() => setEscribiendo({ ...escribiendo, fondo: !escribiendo.fondo })}
                className={`h-10 w-10 rounded-[8px] text-base font-bold ${escribiendo.fondo ? 'bg-white text-[#1F2933]' : 'border-2 border-white/70'}`}
                aria-pressed={escribiendo.fondo}
                aria-label="Fondo detrás del texto"
              >
                A
              </button>
            </div>
            <button type="button" onClick={guardarTexto} className="h-10 px-4 rounded-full bg-white text-[#1F2933] font-['Poppins'] font-semibold text-sm">
              Listo
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-6">
            <textarea
              autoFocus
              value={escribiendo.texto}
              onChange={(e) => setEscribiendo({ ...escribiendo, texto: e.target.value.slice(0, 200) })}
              rows={3}
              placeholder="Escribe aquí"
              className="w-full text-center text-3xl resize-none focus:outline-none placeholder-white/40 rounded-[12px] px-2"
              style={{
                font: FUENTE(30, escribiendo.fuente),
                ...(escribiendo.fondo
                  ? { background: escribiendo.color, color: contraste(escribiendo.color) }
                  : { background: 'transparent', color: escribiendo.color, textShadow: `0 0 3px ${contraste(escribiendo.color)}` }),
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-2 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEscribiendo({ ...escribiendo, color: c })}
                className={`w-8 h-8 rounded-full border-2 ${escribiendo.color === c ? 'border-white scale-110' : 'border-white/30'}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Elegir sticker */}
      {stickers && userId && (
        <SelectorStickers userId={userId} miLlavePublica={miLlavePublica} onElegir={ponerSticker} onCerrar={() => setStickers(false)} />
      )}

      {/* Elegir emoji */}
      {emojis && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/50" onClick={() => setEmojis(false)}>
          <div className="w-full bg-[#1F2933] rounded-t-[16px] p-3 max-h-[50dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            <div className="mx-auto mb-3 w-10 h-1 rounded-full bg-white/30" />
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((em) => (
                <button key={em} type="button" onClick={() => ponerEmoji(em)} className="h-11 text-3xl flex items-center justify-center rounded-[8px] active:bg-white/10">
                  {em}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
