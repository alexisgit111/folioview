// Copies PDF.js runtime assets (CMaps, standard fonts, wasm image decoders,
// ICC profiles) into public/pdfjs so they are served from the app's own
// origin. Runs automatically before `dev`, `build` and `preview`.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pdfjs-dist')
const dest = join(root, 'public', 'pdfjs')

if (!existsSync(src)) {
  console.error('pdfjs-dist is not installed. Run npm install first.')
  process.exit(1)
}
mkdirSync(dest, { recursive: true })
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const from = join(src, dir)
  if (existsSync(from)) cpSync(from, join(dest, dir), { recursive: true })
}
console.log('PDF.js assets copied to public/pdfjs')
