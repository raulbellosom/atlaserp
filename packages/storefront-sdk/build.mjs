import { build } from 'esbuild'
import { readdirSync, statSync, mkdirSync } from 'fs'
import { join, relative, extname } from 'path'

function collectEntries(dir, base = dir, entries = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      collectEntries(full, base, entries)
    } else if (/\.(js|jsx)$/.test(name) && !name.endsWith('.test.js')) {
      entries.push(full)
    }
  }
  return entries
}

const srcDir = new URL('./src', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const entryPoints = collectEntries(srcDir)

mkdirSync('dist', { recursive: true })

await build({
  entryPoints,
  outdir: 'dist',
  outbase: 'src',
  format: 'esm',
  jsx: 'automatic',
  bundle: false,   // transpile only — imports stay as-is
  logLevel: 'info',
})

console.log('Build complete.')
