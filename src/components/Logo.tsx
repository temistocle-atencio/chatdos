import React from 'react';

export interface LogoProps {
  /**
   * 'color': Cubo tricolor + "Chat" (#005198) "Dos" (#F28C1B) sobre fondos claros
   * 'white': Cubo blanco (opacidades 1, 0.8, 0.6) + "ChatDos" blanco sobre fondos oscuros o azules
   */
  variant?: 'color' | 'white';
  /**
   * 'horizontal': Cubo a la izquierda, texto a la derecha
   * 'vertical': Cubo arriba centrado, texto abajo centrado
   * 'cube': Solo el cubo isométrico
   */
  layout?: 'horizontal' | 'vertical' | 'cube';
  /**
   * Altura del cubo en píxeles (por defecto 36px)
   */
  cubeHeight?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'color',
  layout = 'horizontal',
  cubeHeight = 36,
  className = '',
}) => {
  // Dimensiones del cubo según manual: ancho 259.8, alto 300 (ratio 0.866)
  const cubeWidth = cubeHeight * (259.8 / 300);

  // Colores de las 3 caras del cubo isométrico
  const topFace = variant === 'white' ? '#FFFFFF' : '#F28C1B';
  const leftFace = variant === 'white' ? '#FFFFFF' : '#005198';
  const rightFace = variant === 'white' ? '#FFFFFF' : '#003A73';
  const topOpacity = 1;
  const leftOpacity = variant === 'white' ? 0.8 : 1;
  const rightOpacity = variant === 'white' ? 0.6 : 1;

  const cubeSvg = (
    <svg
      width={cubeWidth}
      height={cubeHeight}
      viewBox="0 0 259.8 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="Isotipo Cubo ChatDos"
    >
      {/* Cara superior */}
      <polygon
        fill={topFace}
        opacity={topOpacity}
        points="0,75 129.9,0 259.8,75 129.9,150"
      />
      {/* Cara izquierda */}
      <polygon
        fill={leftFace}
        opacity={leftOpacity}
        points="0,75 129.9,150 129.9,300 0,225"
      />
      {/* Cara derecha */}
      <polygon
        fill={rightFace}
        opacity={rightOpacity}
        points="129.9,150 259.8,75 259.8,225 129.9,300"
      />
    </svg>
  );

  if (layout === 'cube') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {cubeSvg}
      </div>
    );
  }

  // Proporción oficial del manual:
  // Horizontal: tamaño de letra = 0.54 * H; separación = 0.20 * H
  // Vertical: tamaño de letra = 0.375 * H; separación = 0.28 * H
  const isHorizontal = layout === 'horizontal';
  const fontSize = isHorizontal ? cubeHeight * 0.54 : cubeHeight * 0.375;
  const gap = isHorizontal ? cubeHeight * 0.2 : cubeHeight * 0.28;

  const textNode = (
    <span
      style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}
      className="select-none tracking-[-0.02em]"
    >
      <span style={{ color: variant === 'white' ? '#FFFFFF' : '#005198' }}>Chat</span>
      <span style={{ color: variant === 'white' ? '#FFFFFF' : '#F28C1B' }}>Dos</span>
    </span>
  );

  if (layout === 'vertical') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center ${className}`}
        style={{ gap: `${gap}px` }}
      >
        {cubeSvg}
        {textNode}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={{ gap: `${gap}px` }}
    >
      {cubeSvg}
      {textNode}
    </div>
  );
};
