// Génère les icônes PWA à partir de public/logo.png
// Run : node scripts/gen-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(root, 'public', 'logo.png')

const BG = { r: 0xFA, g: 0xF5, b: 0xEC, alpha: 1 } // crème #FAF5EC (pour contraste logo teal)
const sizes = [48, 72, 96, 144, 192, 512]
const PADDING_RATIO = 0.14 // 14 % de padding → safe-zone pour maskable

const logoBuf = readFileSync(src)

for (const size of sizes) {
  const inner = Math.round(size * (1 - PADDING_RATIO * 2))
  const resizedLogo = await sharp(logoBuf)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toFile(join(root, 'public', `icon-${size}.png`))

  console.log(`✓ icon-${size}.png`)
}
