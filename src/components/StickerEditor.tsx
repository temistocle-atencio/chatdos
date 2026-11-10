import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Type, Trash2, Pencil } from 'lucide-react';

// Editor para crear un sticker: forma, borde blanco (siguiendo la figura), textos y encuadre.
// Todo se dibuja en el celular; el resultado es una imagen PNG con fondo transparente.

const LADO = 512;

type Forma = 'original' | 'circulo' | 'redondeado';
type Borde = 'no' | 'fino' | 'grueso';

interface Texto {
  id: string;
  texto: string;
  x: number; // centro, en px del lienzo de 512
  y: number;
  tam: number; // tamaño de letra en px
  color: string;
}

const COLORES = ['#FFFFFF', '#1F2933', '#F28C1B', '#005198', '#FFD60A', '#E5484D', '#1E7A44', '#C084FC'];
const GROSOR_BORDE: Record<Borde, number> = { no: 0, fino: 6, grueso: 11 };
const FUENTE = (tam: number) => `700 ${tam}px Poppins, "Arial Rounded MT Bold", system-ui, sans-serif`;

// Contorno que contrasta con el color del texto (para que se lea sobre cualquier fondo)
const contraste = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1F2933' : '#FFFFFF';
};

const lineas = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);

function medirTexto(ctx: CanvasRenderingContext2D, t: Texto) {
  ctx.font = FUENTE(t.tam);
  const ls = lineas(t.texto);
  const ancho = Math.max(...ls.map((l) => ctx.measureText(l).width), 10);
  const alto = ls.length * t.tam * 1.12;
  return { ls, ancho, alto };
}

function caminoForma(ctx: CanvasRenderingContext2D, forma: Forma, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  if (forma === 'circulo') {
    const r = Math.min(w, h) / 2;
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  } else {
    const r = forma === 'redondeado' ? Math.min(w, h) * 0.18 : 0;
    ctx.roundRect(x, y, w, h, r);
  }
}

export const StickerEditor: React.FC<{
  imagen: Blob;
  onCancelar: () => void;
  onListo: (png: Blob) => void;
}> = ({ imagen, onCancelar, onListo }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forma, setForma] = useState<Forma>('original');
  const [borde, setBorde] = useState<Borde>('fino');
  const [zoom, setZoom] = useState(1);
  const [desplaz, setDesplaz] = useState({ x: 0, y: 0 });
  const [textos, setTextos] = useState<Texto[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [escribiendo, setEscribiendo] = useState<{ id: string | null; valor: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const arrastre = useRef<{ tipo: 'texto' | 'imagen'; id?: string; x0: number; y0: number; ox: number; oy: number } | null>(null);

  // Cargar la imagen y la letra
  useEffect(() => {
    const url = URL.createObjectURL(imagen);
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setError('No se pudo abrir esa imagen.');
    i.src = url;
    document.fonts?.load(FUENTE(64)).catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [imagen]);

  // Dibuja el sticker en un lienzo de 512 x 512
  const dibujar = useCallback(
    (ctx: CanvasRenderingContext2D, guias: boolean) => {
      if (!img) return;
      ctx.clearRect(0, 0, LADO, LADO);
      const grosor = GROSOR_BORDE[borde];
      const margen = grosor + 6;
      const disp = LADO - margen * 2;

      // 1) La imagen (con su forma) en una capa aparte
      const capa = document.createElement('canvas');
      capa.width = capa.height = LADO;
      const c = capa.getContext('2d')!;
      const base = forma === 'original'
        ? Math.min(disp / img.naturalWidth, disp / img.naturalHeight)
        : Math.max(disp / img.naturalWidth, disp / img.naturalHeight); // círculo/redondeado: llena la forma
      const esc = base * zoom;
      const w = img.naturalWidth * esc;
      const h = img.naturalHeight * esc;
      const x = (LADO - w) / 2 + desplaz.x;
      const y = (LADO - h) / 2 + desplaz.y;
      c.save();
      caminoForma(c, forma, margen, margen, disp, disp);
      c.clip();
      c.drawImage(img, x, y, w, h);
      c.restore();

      // 2) Borde blanco que sigue la figura (se "engorda" la silueta en todas direcciones)
      if (grosor > 0) {
        const sil = document.createElement('canvas');
        sil.width = sil.height = LADO;
        const s = sil.getContext('2d')!;
        const pasos = 36;
        for (let k = 0; k < pasos; k++) {
          const a = (k / pasos) * Math.PI * 2;
          s.drawImage(capa, Math.cos(a) * grosor, Math.sin(a) * grosor);
        }
        s.drawImage(capa, 0, 0);
        s.globalCompositeOperation = 'source-in';
        s.fillStyle = '#FFFFFF';
        s.fillRect(0, 0, LADO, LADO);
        // sombra suave para que el borde se note sobre fondos claros
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 6;
        ctx.drawImage(sil, 0, 0);
        ctx.restore();
      }
      ctx.drawImage(capa, 0, 0);

      // 3) Textos
      for (const t of textos) {
        const { ls, ancho, alto } = medirTexto(ctx, t);
        ctx.font = FUENTE(t.tam);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ls.forEach((l, i) => {
          const ly = t.y - alto / 2 + t.tam * 1.12 * (i + 0.5);
          ctx.lineWidth = Math.max(4, t.tam * 0.2);
          ctx.strokeStyle = contraste(t.color);
          ctx.strokeText(l, t.x, ly);
          ctx.fillStyle = t.color;
          ctx.fillText(l, t.x, ly);
        });
        if (guias && t.id === sel) {
          ctx.save();
          ctx.setLineDash([10, 8]);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#F28C1B';
          ctx.strokeRect(t.x - ancho / 2 - 12, t.y - alto / 2 - 8, ancho + 24, alto + 16);
          ctx.restore();
        }
      }
    },
    [img, forma, borde, zoom, desplaz, textos, sel]
  );

  useEffect(() => {
    const ctx = lienzo.current?.getContext('2d');
    if (ctx) dibujar(ctx, true);
  }, [dibujar]);

  // ----- Tocar y arrastrar -----
  const aLienzo = (e: React.PointerEvent) => {
    const r = lienzo.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * LADO, y: ((e.clientY - r.top) / r.height) * LADO };
  };

  const textoEn = (px: number, py: number) => {
    const ctx = lienzo.current!.getContext('2d')!;
    for (let i = textos.length - 1; i >= 0; i--) {
      const t = textos[i];
      const { ancho, alto } = medirTexto(ctx, t);
      if (Math.abs(px - t.x) <= ancho / 2 + 16 && Math.abs(py - t.y) <= alto / 2 + 12) return t;
    }
    return null;
  };

  const alBajar = (e: React.PointerEvent) => {
    const p = aLienzo(e);
    const t = textoEn(p.x, p.y);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (t) {
      setSel(t.id);
      arrastre.current = { tipo: 'texto', id: t.id, x0: p.x, y0: p.y, ox: t.x, oy: t.y };
    } else {
      setSel(null);
      arrastre.current = { tipo: 'imagen', x0: p.x, y0: p.y, ox: desplaz.x, oy: desplaz.y };
    }
  };

  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    const p = aLienzo(e);
    const dx = p.x - a.x0;
    const dy = p.y - a.y0;
    if (a.tipo === 'texto') {
      setTextos((ts) =>
        ts.map((t) =>
          t.id === a.id ? { ...t, x: Math.min(LADO, Math.max(0, a.ox + dx)), y: Math.min(LADO, Math.max(0, a.oy + dy)) } : t
        )
      );
    } else {
      setDesplaz({ x: a.ox + dx, y: a.oy + dy });
    }
  };

  const alSoltar = () => {
    arrastre.current = null;
  };

  // ----- Textos -----
  const guardarTexto = () => {
    if (!escribiendo) return;
    const valor = escribiendo.valor.trim();
    if (escribiendo.id) {
      setTextos((ts) => (valor ? ts.map((t) => (t.id === escribiendo.id ? { ...t, texto: valor } : t)) : ts.filter((t) => t.id !== escribiendo.id)));
    } else if (valor) {
      const id = crypto.randomUUID();
      const y = textos.length === 0 ? LADO * 0.82 : textos.length === 1 ? LADO * 0.16 : LADO / 2;
      // Tamaño inicial: que la frase quepa a lo ancho
      let tam = 64;
      const ctx = lienzo.current?.getContext('2d');
      if (ctx) {
        const { ancho } = medirTexto(ctx, { id, texto: valor, x: 0, y: 0, tam, color: '#FFFFFF' });
        if (ancho > LADO - 60) tam = Math.max(28, Math.floor((tam * (LADO - 60)) / ancho));
      }
      setTextos((ts) => [...ts, { id, texto: valor, x: LADO / 2, y, tam, color: '#FFFFFF' }]);
      setSel(id);
    }
    setEscribiendo(null);
  };

  const textoSel = textos.find((t) => t.id === sel) || null;
  const cambiarSel = (cambio: Partial<Texto>) => setTextos((ts) => ts.map((t) => (t.id === sel ? { ...t, ...cambio } : t)));

  // ----- Terminar -----
  const terminar = async () => {
    if (!img) return;
    setGuardando(true);
    const c = document.createElement('canvas');
    c.width = c.height = LADO;
    dibujar(c.getContext('2d')!, false);
    c.toBlob((b) => {
      setGuardando(false);
      if (b) onListo(b);
      else setError('No se pudo crear el sticker.');
    }, 'image/png');
  };

  const chip = (activo: boolean) =>
    `h-8 px-3 rounded-full text-xs font-['Inter'] font-medium shrink-0 transition-colors ${
      activo ? 'bg-white text-[#003A73]' : 'bg-white/10 text-white'
    }`;

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#1F2933] flex flex-col select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center gap-2 px-2 h-14 shrink-0 bg-[#003A73] text-white">
        <button type="button" onClick={onCancelar} className="w-12 h-12 flex items-center justify-center" aria-label="Cancelar">
          <X className="w-6 h-6" strokeWidth={2} />
        </button>
        <span className="flex-1 font-['Poppins'] font-semibold text-base">Crear sticker</span>
        <button
          type="button"
          onClick={terminar}
          disabled={!img || guardando}
          className="h-10 px-4 mr-1 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check className="w-4 h-4" strokeWidth={2.5} /> Listo
        </button>
      </div>

      {/* Lienzo (cuadros grises = transparente) */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        {error ? (
          <p className="text-sm text-white/80 font-['Inter']">{error}</p>
        ) : (
          <canvas
            ref={lienzo}
            width={LADO}
            height={LADO}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onDoubleClick={() => textoSel && setEscribiendo({ id: textoSel.id, valor: textoSel.texto })}
            className="w-full max-w-[min(100%,52dvh)] aspect-square rounded-[5px]"
            style={{
              touchAction: 'none',
              backgroundColor: '#3a4652',
              backgroundImage:
                'linear-gradient(45deg,#4a5663 25%,transparent 25%),linear-gradient(-45deg,#4a5663 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#4a5663 75%),linear-gradient(-45deg,transparent 75%,#4a5663 75%)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0,0 12px,12px -12px,-12px 0',
            }}
            aria-label="Vista previa del sticker. Arrastra para mover."
          />
        )}
      </div>

      {/* Herramientas */}
      <div className="shrink-0 px-3 pb-3 space-y-3 text-white">
        {textoSel ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-['Inter'] text-white/70 w-12">Tamaño</span>
              <input
                type="range"
                min={28}
                max={140}
                value={textoSel.tam}
                onChange={(e) => cambiarSel({ tam: Number(e.target.value) })}
                className="flex-1 accent-[#F28C1B]"
                aria-label="Tamaño del texto"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => cambiarSel({ color: c })}
                  className={`w-8 h-8 rounded-full shrink-0 border-2 ${textoSel.color === c ? 'border-[#F28C1B] scale-110' : 'border-white/40'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEscribiendo({ id: textoSel.id, valor: textoSel.texto })}
                className="flex-1 h-10 rounded-[5px] bg-white/10 text-sm font-['Poppins'] font-semibold flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-4 h-4" strokeWidth={2} /> Cambiar texto
              </button>
              <button
                type="button"
                onClick={() => {
                  setTextos((ts) => ts.filter((t) => t.id !== sel));
                  setSel(null);
                }}
                className="h-10 px-4 rounded-[5px] bg-white/10 text-sm font-['Poppins'] font-semibold flex items-center gap-1.5 text-[#FDEBD3]"
              >
                <Trash2 className="w-4 h-4" strokeWidth={2} /> Quitar
              </button>
              <button type="button" onClick={() => setSel(null)} className="h-10 px-4 rounded-[5px] bg-white text-[#003A73] text-sm font-['Poppins'] font-semibold">
                Ok
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-['Inter'] text-white/70 w-12 shrink-0">Forma</span>
              {(
                [
                  ['original', 'Original'],
                  ['circulo', 'Círculo'],
                  ['redondeado', 'Redondeado'],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" className={chip(forma === v)} onClick={() => setForma(v)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-['Inter'] text-white/70 w-12 shrink-0">Borde</span>
              {(
                [
                  ['no', 'Sin borde'],
                  ['fino', 'Fino'],
                  ['grueso', 'Grueso'],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" className={chip(borde === v)} onClick={() => setBorde(v)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-['Inter'] text-white/70 w-12">Zoom</span>
              <input
                type="range"
                min={0.4}
                max={3}
                step={0.02}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#F28C1B]"
                aria-label="Acercar o alejar la imagen"
              />
            </div>
            <button
              type="button"
              onClick={() => setEscribiendo({ id: null, valor: '' })}
              className="w-full h-11 rounded-[5px] bg-white text-[#003A73] font-['Poppins'] font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Type className="w-4 h-4" strokeWidth={2.5} /> Agregar texto o frase
            </button>
            <p className="text-[11px] text-center font-['Inter'] text-white/60">
              Arrastra la imagen para encuadrarla. Toca un texto para moverlo o cambiarlo.
            </p>
          </>
        )}
      </div>

      {/* Escribir el texto */}
      {escribiendo && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={guardarTexto}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <textarea
              autoFocus
              value={escribiendo.valor}
              onChange={(e) => setEscribiendo({ ...escribiendo, valor: e.target.value.slice(0, 80) })}
              rows={2}
              placeholder="Escribe tu frase…"
              className="w-full p-3 rounded-[5px] bg-transparent border-2 border-white/60 text-white text-center text-[22px] font-['Poppins'] font-bold placeholder-white/50 focus:outline-none focus:border-[#F28C1B] resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setEscribiendo(null)}
                className="flex-1 h-11 rounded-[5px] bg-white/10 text-white font-['Poppins'] font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarTexto}
                className="flex-1 h-11 rounded-[5px] bg-[#F28C1B] text-[#1F2933] font-['Poppins'] font-semibold text-sm"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
