import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const TEST_DIR = path.join(process.cwd(), 'test-gallery');
const SUB_DIR = path.join(TEST_DIR, 'vacation-subfolder');

if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}
if (!fs.existsSync(SUB_DIR)) {
  fs.mkdirSync(SUB_DIR, { recursive: true });
}

async function createColorImage(
  filePath: string,
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
  format: 'jpeg' | 'png' | 'webp'
) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  });

  if (format === 'jpeg') {
    await image.jpeg().toFile(filePath);
  } else if (format === 'png') {
    await image.png().toFile(filePath);
  } else if (format === 'webp') {
    await image.webp().toFile(filePath);
  }
}

function createSVGImage(filePath: string, width: number, height: number, title: string) {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#3b82f6"/>
    <text x="50%" y="50%" font-size="24" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${title}</text>
  </svg>`;
  fs.writeFileSync(filePath, svg, 'utf-8');
}

async function main() {
  console.log('Generating test images in:', TEST_DIR);

  // 1. Landscape JPG
  await createColorImage(
    path.join(TEST_DIR, 'mountain_sunset.jpg'),
    1920,
    1080,
    { r: 234, g: 88, b: 12 },
    'jpeg'
  );

  // 2. Portrait PNG
  await createColorImage(
    path.join(TEST_DIR, 'portrait_studio.png'),
    1080,
    1920,
    { r: 99, g: 102, b: 241 },
    'png'
  );

  // 3. Square WebP
  await createColorImage(
    path.join(TEST_DIR, 'square_art.webp'),
    800,
    800,
    { r: 16, g: 185, b: 129 },
    'webp'
  );

  // 4. SVG Vector Graphic
  createSVGImage(
    path.join(TEST_DIR, 'vector_banner.svg'),
    1200,
    400,
    'Vector Banner Sample'
  );

  // 5. Subdirectory Images
  await createColorImage(
    path.join(SUB_DIR, 'beach_sand.jpg'),
    2560,
    1440,
    { r: 245, g: 158, b: 11 },
    'jpeg'
  );

  await createColorImage(
    path.join(SUB_DIR, 'ocean_wave.png'),
    1200,
    1200,
    { r: 14, g: 165, b: 233 },
    'png'
  );

  console.log('Test images generated successfully!');
}

main().catch(console.error);
