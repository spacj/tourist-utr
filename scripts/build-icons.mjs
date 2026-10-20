// Renders the PWA / Apple / Android icons from the SVG sources in public/.
// Run after changing the logo: `npm run icons`.
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const out = [
  { src: 'public/icon.svg', file: 'public/icon-192.png', size: 192 },
  { src: 'public/icon.svg', file: 'public/icon-512.png', size: 512 },
  { src: 'public/icon-mask.svg', file: 'public/icon-maskable-512.png', size: 512 },
  { src: 'public/icon-mask.svg', file: 'public/apple-touch-icon.png', size: 180 },
]

for (const { src, file, size } of out) {
  const svg = await readFile(src)
  await sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
  console.log('wrote', file)
}
