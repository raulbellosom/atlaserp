import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const desktop = resolve(root, 'apps/desktop')

export function buildNativeBrandAssets() {
  const output = resolve(root, '.tmp/native-brand')
  mkdirSync(output, { recursive: true })
  const original = readFileSync(resolve(root, 'identity/atlas-erp_isotype.svg'), 'utf8')
  // This master contains a gray background group. Keep all logo paths and colors,
  // but separate the background for Android's adaptive icon mask.
  const background = /<g fill="#ebebeb">[\s\S]*?<\/g>/
  if (!background.test(original)) throw new Error('Review the updated Atlas SVG background before generating icons')
  const foreground = original.replace(background, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/[ \t]+(?=\r?$)/gm, '')
  const surface = '<rect width="1254" height="1254" fill="#E6EAF0"/>'
  const icon = foreground.replace(/(<svg[^>]*>)/, `$1${surface}`)
  // Fit the outer corners inside the circular adaptive/splash safe area.
  const safeForeground = foreground.replace('viewBox="0 0 1254 1254"', 'viewBox="-220 -220 1694 1694"')
  writeFileSync(resolve(output, 'foreground.svg'), safeForeground)
  writeFileSync(resolve(output, 'icon.svg'), icon)
  writeFileSync(resolve(output, 'background.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254">${surface}</svg>`)
  const monochrome = safeForeground.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/fill="[^"]*"/g, 'fill="#000000"')
  writeFileSync(resolve(output, 'monochrome.svg'), monochrome)
  const manifest = resolve(output, 'icons.json')
  writeFileSync(manifest, JSON.stringify({ default: 'icon.svg', bg_color: '#E6EAF0', android_bg: 'background.svg', android_fg: 'foreground.svg', android_fg_scale: 85, android_monochrome: 'monochrome.svg' }))
  const result = spawnSync(process.execPath, [resolve(desktop, 'node_modules/@tauri-apps/cli/tauri.js'), 'icon', manifest, '--output', resolve(output, 'icons')], { cwd: desktop, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Native icon generation failed')
  // Tauri writes directly to an initialized mobile project, or exports here if absent.
  const android = resolve(desktop, 'src-tauri/gen/android/app/src/main/res')
  if (existsSync(android) && existsSync(resolve(output, 'icons/android'))) cpSync(resolve(output, 'icons/android'), android, { recursive: true })
  if (existsSync(resolve(android, 'mipmap-anydpi-v26/ic_launcher.xml'))) cpSync(resolve(android, 'mipmap-anydpi-v26/ic_launcher.xml'), resolve(android, 'mipmap-anydpi-v26/ic_launcher_round.xml'))
  writeFileSync(resolve(desktop, 'native-host/shell/atlas-mark.svg'), icon)
  console.log('Atlas native branding generated from identity/atlas-erp_isotype.svg')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildNativeBrandAssets()
