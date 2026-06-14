import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const scriptPath = new URL('../../../public/pwa-bootstrap.js', import.meta.url)
const indexPath = new URL('../../../index.html', import.meta.url)

async function runBootstrap(pathname, search = '') {
  const source = await readFile(scriptPath, 'utf8')
  const appended = []
  const touchIcon = { href: '/apple-touch-icon.png' }
  const document = {
    head: {
      appendChild(node) {
        appended.push(node)
      },
    },
    createElement(tagName) {
      return { tagName }
    },
    querySelector(selector) {
      return selector === 'link[rel="apple-touch-icon"]' ? touchIcon : null
    },
  }
  const window = {
    location: { pathname, search },
  }

  vm.runInNewContext(source, { document, window, URLSearchParams })
  return { manifest: appended[0], touchIcon, window }
}

test('selects a module manifest before React for deep module URLs', async () => {
  const { manifest: link, touchIcon } = await runBootstrap(
    '/app/m/atlas.inventory/inventory/123',
  )

  assert.equal(link.rel, 'manifest')
  assert.equal(link.href, '/pwa/manifest/atlas.inventory.webmanifest')
  assert.equal(link.dataset.moduleKey, 'atlas.inventory')
  assert.equal(touchIcon.href, '/pwa/icon/atlas.inventory/192.png')
})

test('uses the base Atlas manifest outside module routes', async () => {
  const { manifest: link, touchIcon } = await runBootstrap('/app/home')

  assert.equal(link.rel, 'manifest')
  assert.equal(link.href, '/site.webmanifest')
  assert.equal(link.dataset.moduleKey, '')
  assert.equal(touchIcon.href, '/apple-touch-icon.png')
})

test('exposes the immutable module identity selected before React', async () => {
  const { window } = await runBootstrap(
    '/app/m/atlas.calendar/calendar',
    '?view=month&pwa-install=1',
  )

  assert.equal(window.__ATLAS_PWA_BOOTSTRAP__.moduleKey, 'atlas.calendar')
  assert.equal(window.__ATLAS_PWA_BOOTSTRAP__.installRequested, true)
})

test('loads the manifest bootstrap before the React entry point', async () => {
  const html = await readFile(indexPath, 'utf8')

  assert.ok(html.indexOf('/pwa-bootstrap.js') < html.indexOf('/src/main.jsx'))
  assert.equal(/<link[^>]+rel=["']manifest["']/i.test(html), false)
})
