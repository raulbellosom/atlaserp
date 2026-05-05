#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const desktopDir = path.join(root, 'apps', 'desktop')
const publicDir = path.join(desktopDir, 'public')
const brandDir = path.join(publicDir, 'brand')
const identityDir = path.join(root, 'identity')
const tauriIconsDir = path.join(desktopDir, 'src-tauri', 'icons')

const requiredSources = {
  appIcon: path.join(identityDir, 'atlas-erp_app_icon.png'),
  primary: path.join(identityDir, 'atlas-erp_primary_logo.png'),
  horizontal: path.join(identityDir, 'atlas-erp_horizontal_logo.png'),
  vertical: path.join(identityDir, 'atlas-erp_vertical_logo.png'),
  isotype: path.join(identityDir, 'atlas-erp_isotype_only.png'),
  monoLight: path.join(identityDir, 'atlas-erp_monochrome_light.png'),
  monoDark: path.join(identityDir, 'atlas-erp_monochrome_dark.png'),
}

for (const [name, filePath] of Object.entries(requiredSources)) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required branding source (${name}): ${filePath}`)
  }
}

mkdirSync(publicDir, { recursive: true })
mkdirSync(brandDir, { recursive: true })

console.log('Generating desktop app icons with tauri icon...')
execSync(`pnpm tauri icon \"${requiredSources.appIcon}\"`, {
  cwd: desktopDir,
  stdio: 'inherit',
})

console.log('Generating transparent brand PNG assets...')
execSync('python scripts/generate-transparent-brand-assets.py', {
  cwd: root,
  stdio: 'inherit',
})

const copyPairs = [
  [path.join(tauriIconsDir, 'icon.ico'), path.join(publicDir, 'favicon.ico')],
  [path.join(tauriIconsDir, '32x32.png'), path.join(publicDir, 'favicon-32x32.png')],
  [path.join(tauriIconsDir, 'icon.png'), path.join(publicDir, 'apple-touch-icon.png')],
  [path.join(tauriIconsDir, 'icon.png'), path.join(publicDir, 'icon-512.png')],
  [path.join(tauriIconsDir, 'android', 'mipmap-xxxhdpi', 'ic_launcher.png'), path.join(publicDir, 'icon-192.png')],
  [requiredSources.horizontal, path.join(publicDir, 'og-image.png')],
]

for (const [from, to] of copyPairs) {
  if (!existsSync(from)) {
    throw new Error(`Missing generated file: ${from}`)
  }
  copyFileSync(from, to)
}

const webManifest = {
  name: 'Atlas ERP',
  short_name: 'Atlas',
  description: 'CONNECT. MANAGE. GROW.',
  start_url: '/',
  display: 'standalone',
  background_color: '#0A1D44',
  theme_color: '#102A5E',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}

writeFileSync(
  path.join(publicDir, 'site.webmanifest'),
  `${JSON.stringify(webManifest, null, 2)}\n`,
)

console.log('Brand assets generated in apps/desktop/public and apps/desktop/src-tauri/icons')
