/**
 * Export all brand PNGs from SVG masters.
 * Run: node scripts/brand-export-pngs.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const brand = join(root, 'brand');

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

async function svgToPng(svgPath, outPath, width, height) {
  const svg = readFileSync(svgPath);
  await sharp(svg)
    .resize(width, height)
    .png()
    .toFile(outPath);
  console.log('OK', outPath);
}

async function main() {
  ensureDir(join(brand, 'logo'));
  ensureDir(join(brand, 'icons'));
  ensureDir(join(brand, 'app-icons'));
  ensureDir(join(brand, 'favicon'));
  ensureDir(join(brand, 'social'));

  const logoW = 920, logoH = 200;
  await svgToPng(join(brand, 'logo', 'logo-primary.svg'), join(brand, 'logo', 'logo-primary.png'), logoW, logoH);
  await svgToPng(join(brand, 'logo', 'logo-primary-dark.svg'), join(brand, 'logo', 'logo-primary-dark.png'), logoW, logoH);
  await svgToPng(join(brand, 'logo', 'logo-primary-light.svg'), join(brand, 'logo', 'logo-primary-light.png'), logoW, logoH);

  await svgToPng(join(brand, 'icons', 'icon.svg'), join(brand, 'icons', 'icon-512.png'), 512, 512);
  await svgToPng(join(brand, 'icons', 'icon.svg'), join(brand, 'icons', 'icon-1024.png'), 1024, 1024);

  const appSvg = readFileSync(join(brand, 'app-icons', 'app-icon.svg'));
  for (const size of [128, 256, 512, 1024]) {
    await sharp(appSvg).resize(size, size).png().toFile(join(brand, 'app-icons', `app-icon-${size}.png`));
    console.log('OK', `app-icons/app-icon-${size}.png`);
  }

  const faviconSvg = readFileSync(join(brand, 'favicon', 'favicon-a.svg'));
  for (const size of [16, 32, 48, 180, 512]) {
    await sharp(faviconSvg).resize(size, size).png().toFile(join(brand, 'favicon', `favicon-${size}.png`));
    console.log('OK', `favicon/favicon-${size}.png`);
  }
  await sharp(faviconSvg).resize(180, 180).png().toFile(join(brand, 'favicon', 'apple-touch-icon.png'));
  console.log('OK', 'favicon/apple-touch-icon.png');

  const iconSvg = readFileSync(join(brand, 'icons', 'icon.svg'));
  const iconBuf = await sharp(iconSvg).resize(360, 360).png().toBuffer();
  const whiteBg = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).png().toBuffer();
  const socialIcon = await sharp(whiteBg)
    .composite([{ input: iconBuf, top: 20, left: 20 }])
    .png()
    .toBuffer();
  for (const name of ['linkedin-profile', 'twitter-profile', 'facebook-profile', 'instagram-profile']) {
    await sharp(socialIcon).toFile(join(brand, 'social', `${name}.png`));
    console.log('OK', `social/${name}.png`);
  }

  const logoPng = readFileSync(join(brand, 'logo', 'logo-primary.png'));
  await sharp({
    create: { width: 1584, height: 396, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).png().composite([{ input: logoPng, top: 98, left: 80 }]).toFile(join(brand, 'social', 'linkedin-banner.png'));
  console.log('OK', 'social/linkedin-banner.png');
  await sharp({
    create: { width: 1500, height: 500, channels: 3, background: { r: 244, g: 247, b: 251 } }
  }).png().composite([{ input: logoPng, top: 150, left: 80 }]).toFile(join(brand, 'social', 'twitter-banner.png'));
  console.log('OK', 'social/twitter-banner.png');

  console.log('Done. Note: favicon.ico must be generated manually or with a dedicated ICO tool.');
}

main().catch((e) => { console.error(e); process.exit(1); });
