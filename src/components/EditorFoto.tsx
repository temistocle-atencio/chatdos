import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Undo2, RotateCcw, Trash2, Crop, Pencil, Type, Smile } from 'lucide-react';
import { IconoSticker } from './Iconos';
import { SelectorStickers } from './SelectorStickers';

// Editor de fotos antes de enviar (como WhatsApp): recortar y girar, dibujar, escribir y poner emojis.
// Todo se hace en el celular y el resultado es una foto nueva.

export type HerramientaFoto = 'recortar' | 'dibujar' | 'texto' | 'emoji' | 'sticker';

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
}
interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FUENTE = (tam: number) => `700 ${tam}px Poppins, system-ui, sans-serif`;
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
    ctx.font = FUENTE(p.tam);
    const ls = p.valor.split('\n');
    const alto = p.tam * 1.15;
    ls.forEach((l, i) => {
      const y = p.y + (i - (ls.length - 1) / 2) * alto;
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

function pintarTrazo(ctx: CanvasRenderingContext2D, t: Trazo) {
  if (!t.puntos.length) return;
  ctx.save();
  ctx.strokeStyle = t.color;
  ctx.fillStyle = t.color;
  ctx.lineWidth = t.grosor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
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

function medirPegado(ctx: CanvasRenderingContext2D, p: Pegado) {
  if (p.tipo === 'sticker' && p.img) return { w: p.tam, h: (p.tam * p.img.naturalHeight) / Math.max(1, p.img.naturalWidth) };
  if (p.tipo === 'emoji') return { w: p.tam * 1.1, h: p.tam * 1.1 };
  ctx.font = FUENTE(p.tam);
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
  const [escribiendo, setEscribiendo] = useState<{ id: string | null; texto: string; color: string } | null>(
    herramienta === 'texto' ? { id: null, texto: '', color: '#FFFFFF' } : null
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
    } else setRecorte(null);
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
      dibujando.current = { color, grosor: grosor / escala, puntos: [pt] };
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
      setPegados((l) => (texto ? l.map((p) => (p.id === e.id ? { ...p, valor: texto, color: e.color } : p)) : l.filter((p) => p.id !== e.id)));
      return;
    }
    if (!texto) return;
    const id = crypto.randomUUID();
    setPegados((l) => [...l, { id, tipo: 'texto', valor: texto, color: e.color, x: tam.w / 2, y: tam.h / 2, tam: Math.max(24, Math.min(tam.w, tam.h) / 10) }]);
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
      if (!capa) ctx.drawImage(b, 0, 0);
      trazos.forEach((t) => pintarTrazo(ctx, t));
      pegados.forEach((p) => pintarPegado(ctx, p));
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
          setEscribiendo({ id: null, texto: '', color: '#FFFFFF' });
        } else if (h === 'emoji') {
          setModo('ver');
          setEmojis(true);
        } else if (h === 'sticker') {
          setModo('ver');
          setStickers(true);
        } else setModo(modo === h ? 'ver' : h);
      }}
      className={`w-11 h-11 rounded-full flex items-center justify-center ${modo === h ? 'bg-white text-[#1F2933]' : 'bg-black/45 text-white'}`}
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Icono className="w-5 h-5" strokeWidth={2} />
    </button>
  );

  const W = tam.w * escala;
  const H = tam.h * escala;

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white flex flex-col select-none" style={{ touchAction: 'none' }}>
      {/* Arriba */}
      <div className="shrink-0 flex items-center gap-2 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)', paddingBottom: 10 }}>
        <button type="button" onClick={onCancelar} className="w-11 h-11 rounded-full bg-black/45 flex items-center justify-center" aria-label="Cancelar">
          <X className="w-6 h-6" strokeWidth={2} />
        </button>
        <div className="flex-1" />
        {(trazos.length > 0 || dibujando.current) && modo === 'dibujar' && (
          <button
            type="button"
            onClick={() => setTrazos((l) => l.slice(0, -1))}
            className="w-11 h-11 rounded-full bg-black/45 flex items-center justify-center"
            aria-label="Deshacer"
          >
            <Undo2 className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
        {!capa && herramientaBtn('recortar', Crop, 'Recortar y girar')}
        {userId && herramientaBtn('sticker', IconoSticker, 'Stickers')}
        {herramientaBtn('emoji', Smile, 'Emojis')}
        {herramientaBtn('texto', Type, 'Texto')}
        {herramientaBtn('dibujar', Pencil, 'Dibujar')}
      </div>

      {/* Colores (dibujar) */}
      {modo === 'dibujar' && (
        <div className="shrink-0 flex items-center justify-center gap-2 pb-2">
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
          <canvas
            ref={vistaRef}
            style={{ width: W, height: H, touchAction: 'none' }}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSubir}
            onPointerCancel={alSubir}
            onDoubleClick={(e) => {
              const p = pegadoEn(aFoto(e));
              if (p?.tipo === 'texto') setEscribiendo({ id: p.id, texto: p.valor, color: p.color });
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
        {modo === 'recortar' ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={girar} className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0" aria-label="Girar">
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
                  onClick={() => setEscribiendo({ id: sel.id, texto: sel.valor, color: sel.color })}
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
        <div className="absolute inset-0 z-10 bg-black/70 flex flex-col">
          <div className="flex items-center justify-between px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
            <button type="button" onClick={() => setEscribiendo(null)} className="w-11 h-11 flex items-center justify-center" aria-label="Cancelar">
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
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
              className="w-full bg-transparent text-center text-3xl font-['Poppins'] font-bold resize-none focus:outline-none placeholder-white/40"
              style={{ color: escribiendo.color, textShadow: `0 0 3px ${contraste(escribiendo.color)}` }}
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
