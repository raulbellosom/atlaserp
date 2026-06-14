import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import vm from 'node:vm'

class FakeEventTarget {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    const entries = this.listeners.get(type) ?? new Set()
    entries.add(listener)
    this.listeners.set(type, entries)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

class FakeElement extends FakeEventTarget {
  constructor(tagName) {
    super()
    this.tagName = tagName.toUpperCase()
    this.children = []
    this.parentNode = null
    this.attributes = {}
    this.dataset = {}
    this.style = {}
    this.className = ''
    this.textContent = ''
    this.value = ''
    this.checked = false
    this.disabled = false
  }

  appendChild(child) {
    child.parentNode = this
    this.children.push(child)
    return child
  }

  removeChild(child) {
    this.children = this.children.filter((entry) => entry !== child)
    child.parentNode = null
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value)
    if (name === 'class') this.className = String(value)
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      this.dataset[key] = String(value)
    }
  }

  getAttribute(name) {
    return this.attributes[name] ?? null
  }

  closest(selector) {
    let current = this
    while (current) {
      if (
        selector === 'form[data-atlas-form-id]' &&
        current.tagName === 'FORM' &&
        current.dataset.atlasFormId
      ) {
        return current
      }
      if (selector === '[data-atlas-event]' && current.dataset.atlasEvent) {
        return current
      }
      current = current.parentNode
    }
    return null
  }

  querySelector(selector) {
    return findElement(this, selector)
  }

  set innerHTML(_value) {
    this.children = []
  }
}

function findElement(root, selector) {
  const matches = (element) => {
    if (selector.startsWith('.')) {
      return element.className.split(/\s+/).includes(selector.slice(1))
    }
    const nameMatch = selector.match(/^\[name="([^"]+)"\]$/)
    if (nameMatch) return element.name === nameMatch[1]
    return element.tagName === selector.toUpperCase()
  }
  for (const child of root.children) {
    if (matches(child)) return child
    const nested = findElement(child, selector)
    if (nested) return nested
  }
  return null
}

function createDocument() {
  const document = new FakeEventTarget()
  document.head = new FakeElement('head')
  document.body = new FakeElement('body')
  document.visibilityState = 'visible'
  document.referrer = ''
  document.createElement = (tagName) => new FakeElement(tagName)
  document.querySelector = (selector) =>
    findElement(document.body, selector) ?? findElement(document.head, selector)
  document.getElementById = (id) => {
    const findById = (root) => {
      for (const child of root.children) {
        if (child.id === id) return child
        const nested = findById(child)
        if (nested) return nested
      }
      return null
    }
    return findById(document.head) ?? findById(document.body)
  }
  return document
}

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

async function loadSdk() {
  const source = await readFile(
    new URL('../atlas-sdk.js', import.meta.url),
    'utf8',
  )
  const calls = []
  const document = createDocument()
  const window = new FakeEventTarget()
  const storage = createStorage()
  window.window = window
  window.document = document
  window.localStorage = storage
  window.location = {
    pathname: '/contacto',
    href: 'https://shop.example.com/contacto',
  }
  window.navigator = {
    doNotTrack: '0',
    sendBeacon: () => true,
  }
  window.matchMedia = () => ({ matches: false })
  window.ATLAS_CONFIG = {
    apiUrl: 'https://erp.example.com',
    company: 'acme',
    siteId: '01900000-0000-7000-8000-000000000002',
    analyticsMode: 'consent_required',
    turnstileSiteKey: '',
  }

  const fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/public/storefront/v1/config')) {
      return response(200, {
        data: {
          siteId: window.ATLAS_CONFIG.siteId,
          analyticsMode: 'consent_required',
          respectDoNotTrack: true,
          capabilities: { analytics: true, forms: true },
        },
      })
    }
    if (url.includes('/events/batch')) {
      const body = JSON.parse(options.body)
      return response(202, {
        data: { accepted: body.events.length, rejected: [] },
      })
    }
    if (url.endsWith('/forms/form-1')) {
      return response(200, {
        data: {
          id: 'form-1',
          name: 'Contacto',
          description: 'Escribenos',
          submitLabel: 'Enviar',
          successMessage: 'Gracias',
          turnstileRequired: false,
          fields: [
            {
              id: 'field-1',
              name: 'email',
              label: 'Correo',
              fieldType: 'email',
              required: true,
              placeholder: 'tu@correo.com',
              options: null,
            },
          ],
        },
      })
    }
    if (url.endsWith('/forms/form-1/submissions')) {
      return response(201, {
        data: {
          submissionId: '01900000-0000-7000-8000-000000000004',
          leadId: '01900000-0000-7000-8000-000000000005',
          message: 'Gracias',
        },
      })
    }
    throw new Error(`Unexpected fetch ${url}`)
  }
  window.fetch = fetch
  window.URLSearchParams = URLSearchParams
  window.setInterval = () => 1
  window.clearInterval = () => {}
  window.setTimeout = (callback) => {
    callback()
    return 1
  }
  window.clearTimeout = () => {}

  const context = vm.createContext({
    window,
    document,
    localStorage: storage,
    navigator: window.navigator,
    fetch,
    URLSearchParams,
    Promise,
    JSON,
    Date,
    Math,
    Error,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (callback) => {
      callback()
      return 1
    },
    clearTimeout: () => {},
  })
  vm.runInContext(source, context)
  await Promise.resolve()
  return { window, document, calls }
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve))
  await Promise.resolve()
}

describe('atlas-sdk.js public surface', () => {
  it('exposes consent-aware analytics without leaking tagged values', async () => {
    const harness = await loadSdk()
    const { analytics } = harness.window.AtlasERP
    assert.equal(typeof analytics.start, 'function')
    assert.equal(typeof analytics.track, 'function')

    analytics.setConsent('granted')
    await analytics.start()
    analytics.track('cta_click', {
      placement: 'hero',
      email: 'private@example.com',
    })
    await analytics.flush()

    const eventCall = harness.calls.find((call) =>
      call.url.includes('/events/batch'),
    )
    const payload = JSON.parse(eventCall.options.body)
    assert.equal(payload.consent, 'granted')
    assert.equal(JSON.stringify(payload).includes('private@example.com'), false)
  })

  it('renders and submits an accessible public form through v1', async () => {
    const harness = await loadSdk()
    const target = new FakeElement('div')
    harness.document.body.appendChild(target)
    const successes = []
    harness.window.AtlasERP.analytics.setConsent('granted')
    await harness.window.AtlasERP.analytics.start()

    const controller = await harness.window.AtlasERP.renderForm(target, {
      formId: 'form-1',
      onSuccess: (result) => successes.push(result),
      labels: { title: 'Hablemos' },
    })

    const form = target.querySelector('form')
    const label = target.querySelector('label')
    const input = target.querySelector('[name="email"]')
    assert.equal(form.dataset.atlasFormId, 'form-1')
    assert.equal(label.htmlFor, input.id)
    assert.ok(target.querySelector('._ae-form-wrap'))

    input.value = 'ana@example.com'
    input.dispatch('input', { target: input })
    form.dispatch('submit', { preventDefault() {} })
    await settle()
    await harness.window.AtlasERP.analytics.flush()

    const submissionCall = harness.calls.find((call) =>
      call.url.endsWith('/forms/form-1/submissions'),
    )
    assert.equal(
      JSON.parse(submissionCall.options.body).values.email,
      'ana@example.com',
    )
    assert.equal(successes.length, 1)
    assert.equal(typeof controller.destroy, 'function')

    const analyticsBodies = harness.calls
      .filter((call) => call.url.includes('/events/batch'))
      .map((call) => call.options.body)
      .join('')
    const eventNames = harness.calls
      .filter((call) => call.url.includes('/events/batch'))
      .flatMap((call) => JSON.parse(call.options.body).events)
      .map((event) => event.name)
    assert.ok(eventNames.includes('form_view'))
    assert.ok(eventNames.includes('form_start'))
    assert.ok(eventNames.includes('form_submit'))
    assert.equal(analyticsBodies.includes('ana@example.com'), false)
  })
})
