import React, { useRef, useState } from 'react';

/**
 * Foto con zoom (como en la galería del celular):
 * - pellizcar con dos dedos para acercar o alejar
 * - doble toque para acercar / volver
 * - arrastrar con un dedo para moverse cuando está acercada
 */
export const FotoConZoom: React.FC<{ src: string; alt?: string }> = ({ src, alt = 'Foto' }) => {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const [animar, setAnimar] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const gesto = useRef<{
    tipo: 'pinza' | 'mover' | null;
    d0: number;
    s0: number;
    cx: number;
    cy: number;
    x0: number;
    y0: number;
    px: number;
    py: number;
  }>({ tipo: null, d0: 0, s0: 1, cx: 0, cy: 0, x0: 0, y0: 0, px: 0, py: 0 });
  const ultimoToque = useRef(0);
  const usaTactil = useRef(0); // momento del último toque (para ignorar el "doble clic" que el celular inventa)

  const limitar = (s: number, x: number, y: number) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r || s <= 1) return { s: Math.max(1, s), x: 0, y: 0 };
    const mx = ((s - 1) * r.width) / 2;
    const my = ((s - 1) * r.height) / 2;
    return { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };

  const centro = (a: React.Touch, b: React.Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
  const dist = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    usaTactil.current = Date.now();
    setAnimar(false);
    const g = gesto.current;
    if (e.touches.length === 2) {
      ultimoToque.current = 0; // un pellizco no cuenta como toque
      const c = centro(e.touches[0], e.touches[1]);
      Object.assign(g, { tipo: 'pinza', d0: dist(e.touches[0], e.touches[1]), s0: t.s, cx: c.x, cy: c.y, x0: t.x, y0: t.y });
    } else if (e.touches.length === 1) {
      const ahora = Date.now();
      if (ahora - ultimoToque.current < 300) {
        // Doble toque: acercar donde se tocó, o volver al tamaño normal
        ultimoToque.current = 0;
        setAnimar(true);
        if (t.s > 1) setT({ s: 1, x: 0, y: 0 });
        else {
          const r = caja.current!.getBoundingClientRect();
          const dx = e.touches[0].clientX - (r.left + r.width / 2);
          const dy = e.touches[0].clientY - (r.top + r.height / 2);
          setT(limitar(2.5, -dx * 1.5, -dy * 1.5));
        }
        g.tipo = null;
        return;
      }
      ultimoToque.current = ahora;
      Object.assign(g, { tipo: t.s > 1 ? 'mover' : null, px: e.touches[0].clientX, py: e.touches[0].clientY, x0: t.x, y0: t.y });
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesto.current;
    if (g.tipo === 'pinza' && e.touches.length === 2) {
      const s = Math.min(5, Math.max(1, (g.s0 * dist(e.touches[0], e.touches[1])) / g.d0));
      const c = centro(e.touches[0], e.touches[1]);
      setT(limitar(s, g.x0 + (c.x - g.cx), g.y0 + (c.y - g.cy)));
    } else if (e.touches.length === 1 && Math.hypot(e.touches[0].clientX - g.px, e.touches[0].clientY - g.py) > 10) {
      ultimoToque.current = 0; // arrastrar no cuenta como toque
    }
    if (g.tipo === 'mover' && e.touches.length === 1) {
      setT(limitar(t.s, g.x0 + (e.touches[0].clientX - g.px), g.y0 + (e.touches[0].clientY - g.py)));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    usaTactil.current = Date.now();
    if (e.touches.length === 0) gesto.current.tipo = null;
    else if (e.touches.length === 1 && t.s > 1) {
      Object.assign(gesto.current, { tipo: 'mover', px: e.touches[0].clientX, py: e.touches[0].clientY, x0: t.x, y0: t.y });
    }
  };

  // Computadora: rueda del ratón y doble clic
  const onWheel = (e: React.WheelEvent) => setT((v) => limitar(Math.min(5, Math.max(1, v.s * (e.deltaY < 0 ? 1.15 : 0.87))), v.x, v.y));
  const onDoubleClick = () => {
    if (Date.now() - usaTactil.current < 1000) return; // en celular lo maneja el doble toque
    setAnimar(true);
    setT((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
  };

  return (
    <div
      ref={caja}
      className="w-full h-full flex items-center justify-center overflow-hidden"
      style={{ touchAction: 'none' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-full object-contain will-change-transform"
        style={{
          transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.s})`,
          transition: animar ? 'transform 0.2s ease-out' : 'none',
        }}
      />
    </div>
  );
};
