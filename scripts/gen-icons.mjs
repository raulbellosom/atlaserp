#!/usr/bin/env node
// Generates a 1024x1024 source PNG and runs `pnpm tauri icon` to produce all
// required Tauri icon files. Uses only Node built-ins — no extra dependencies.
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// CRC32 (PNG spec)
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length)
  const crcVal = crc32(Buffer.concat([t, data]))
  const crcBuf = Buffer.allocUnsafe(4)
  crcBuf.writeUInt32BE(crcVal)
  return Buffer.concat([len, t, data, crcBuf])
}

function makePNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const row = Buffer.allocUnsafe(1 + size * 3)
  row[0] = 0 // filter: None
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r; row[1 + x * 3 + 1] = g; row[1 + x * 3 + 2] = b
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// Atlas blue: #1D4ED8
const src = path.join(ROOT, 'tmp-atlas-icon.png')
writeFileSync(src, makePNG(1024, 29, 78, 216))
console.log('Source icon written to', src)

try {
  execSync(`pnpm tauri icon ${src}`, {
    cwd: path.join(ROOT, 'apps', 'desktop'),
    stdio: 'inherit',
  })
} finally {
  import('fs').then(fs => fs.unlinkSync(src))
}

console.log('Tauri icons generated in apps/desktop/src-tauri/icons/')
