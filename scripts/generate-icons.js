import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// SVG del icono según el Manual de Marca:
// Cubo blanco sobre cuadrado #005198 con esquinas redondeadas 22% (radio = size * 0.22)
// Cubo blanco: cara superior opacidad 1, izquierda 0.8, derecha 0.6
function generateAppIconSvg(size, isMaskable = false) {
  const rx = isMaskable ? 0 : size * 0.22; // En maskable el fondo sangra al 100%
  // El cubo tiene ratio 259.8 ancho x 300 alto (proporción 0.866 : 1)
  // En versión regular o maskable, centramos el cubo respetando la zona segura (safe-zone)
  const cubeHeight = isMaskable ? size * 0.50 : size * 0.58;
  const cubeWidth = cubeHeight * (259.8 / 300);
  const cubeX = (size - cubeWidth) / 2;
  const cubeY = (size - cubeHeight) / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#005198" />
  <g transform="translate(${cubeX}, ${cubeY}) scale(${cubeHeight / 300})">
    <polygon fill="#FFFFFF" opacity="1" points="0,75 129.9,0 259.8,75 129.9,150" />
    <polygon fill="#FFFFFF" opacity="0.8" points="0,75 129.9,150 129.9,300 0,225" />
    <polygon fill="#FFFFFF" opacity="0.6" points="129.9,150 259.8,75 259.8,225 129.9,300" />
  </g>
</svg>`;
}

async function run() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Icono SVG base
  const svg512 = generateAppIconSvg(512, false);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg512);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svg512);

  // 2. PNGs usando Sharp
  const sizes = [
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'pwa-192x192.png', size: 192, maskable: false },
    { name: 'pwa-512x512.png', size: 512, maskable: false },
    { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  ];

  for (const item of sizes) {
    const svgStr = generateAppIconSvg(item.size, item.maskable);
    const buf = Buffer.from(svgStr);
    await sharp(buf)
      .resize(item.size, item.size)
      .png()
      .toFile(path.join(publicDir, item.name));
    console.log(`Generated ${item.name}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
