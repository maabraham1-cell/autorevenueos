import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const svgPath = resolve('public/brand/app-icon-1024.svg');
const pngPath = resolve('public/brand/app-icon-1024.png');

async function main() {
  const svgBuffer = await readFile(svgPath);

  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(pngPath);

  console.log('Wrote', pngPath);
}

main().catch((err) => {
  console.error('Failed to export app icon:', err);
  process.exit(1);
});

