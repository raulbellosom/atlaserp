;(function (global) {
  'use strict'

  // ── Config (injected by Atlas into window.ATLAS_CONFIG) ──────────────────────
  var cfg             = global.ATLAS_CONFIG || {}
  var SUPABASE_URL    = (cfg.supabaseUrl    || '').replace(/\/$/, '')
  var SUPABASE_KEY    = cfg.supabaseAnonKey || ''
  var API_URL         = (cfg.apiUrl         || '/').replace(/\/$/, '')
  var STORAGE_KEY     = cfg.storageKey      || ''

  // ── Session helpers ───────────────────────────────────────────────────────────
  function readSession() {
    if (!STORAGE_KEY) return null
    try {
      var raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  }

  function writeSession(session) {
    if (!STORAGE_KEY) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)) } catch (e) {}
  }

  function deleteSession() {
    if (!STORAGE_KEY) return
    try { localStorage.removeItem(STORAGE_KEY) } catch (e) {}
  }

  function isExpired(session) {
    if (!session || !session.expires_at) return true
    return (session.expires_at - 10) < Math.floor(Date.now() / 1000)
  }

  // ── Supabase Auth REST helper ─────────────────────────────────────────────────
  function supabaseFetch(path, options) {
    var headers = Object.assign(
      { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      options.headers || {}
    )
    return fetch(SUPABASE_URL + path, Object.assign({}, options, { headers: headers }))
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d } })
      })
  }

  // ── Auth state observers ──────────────────────────────────────────────────────
  var _listeners = []

  function notify(event, session) {
    _listeners.forEach(function (cb) { try { cb(event, session) } catch (e) {} })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) notify('TOKEN_REFRESHED', readSession())
    })
  }

  // ── Auth API ──────────────────────────────────────────────────────────────────
  var auth = {
    getSession: function () {
      return new Promise(function (resolve) {
        var session = readSession()
        if (!session) return resolve(null)
        if (!isExpired(session)) return resolve(session)
        if (!session.refresh_token) { deleteSession(); return resolve(null) }

        supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        }).then(function (res) {
          if (res.ok && res.data.access_token) {
            writeSession(res.data)
            notify('TOKEN_REFRESHED', res.data)
            resolve(res.data)
          } else {
            deleteSession()
            notify('SIGNED_OUT', null)
            resolve(null)
          }
        }).catch(function () { resolve(null) })
      })
    },

    getToken: function () {
      var session = readSession()
      if (!session || isExpired(session)) return null
      return session.access_token || null
    },

    signIn: function (credentials) {
      return supabaseFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      }).then(function (res) {
        if (res.ok && res.data.access_token) {
          writeSession(res.data)
          notify('SIGNED_IN', res.data)
          return { session: res.data, error: null }
        }
        var msg = res.data.error_description || res.data.msg || 'Login fallido'
        return { session: null, error: new Error(msg) }
      }).catch(function (err) {
        return { session: null, error: err }
      })
    },

    signOut: function () {
      var token = auth.getToken()
      deleteSession()
      notify('SIGNED_OUT', null)
      if (!token) return Promise.resolve()
      return supabaseFetch('/auth/v1/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      }).then(function () {}).catch(function () {})
    },

    onAuthStateChange: function (callback) {
      _listeners.push(callback)
      return function () {
        _listeners = _listeners.filter(function (c) { return c !== callback })
      }
    },
  }

  // ── renderLogin ───────────────────────────────────────────────────────────────
  function renderLogin(selector, options) {
    var opts   = options || {}
    var target = typeof selector === 'string' ? document.querySelector(selector) : selector
    if (!target) return

    var labels   = opts.labels || {}
    var title    = labels.title    || 'Iniciar sesion'
    var subtitle = labels.subtitle || 'Accede a tu cuenta para continuar.'
    var btnLabel = labels.button   || 'Entrar'
    var theme    = opts.theme      || 'auto'

    // CSS variables
    var lightVars = [
      '--ae-bg:#ffffff', '--ae-fg:#111827', '--ae-muted:#6b7280',
      '--ae-border:#e5e7eb', '--ae-input-bg:#f9fafb',
      '--ae-primary:#4f46e5', '--ae-primary-fg:#ffffff',
      '--ae-error-bg:#fef2f2', '--ae-error-border:#fecaca', '--ae-error-fg:#dc2626',
    ].join(';')
    var darkVars = [
      '--ae-bg:#111827', '--ae-fg:#f9fafb', '--ae-muted:#9ca3af',
      '--ae-border:#374151', '--ae-input-bg:#1f2937',
      '--ae-primary:#6366f1', '--ae-primary-fg:#ffffff',
      '--ae-error-bg:#1f0a0a', '--ae-error-border:#7f1d1d', '--ae-error-fg:#f87171',
    ].join(';')

    var styleId = '_ae_login_style'
    if (!document.getElementById(styleId)) {
      var styleEl = document.createElement('style')
      styleEl.id  = styleId
      styleEl.textContent = [
        '._ae-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box;width:100%;max-width:360px}',
        '._ae-wrap *{box-sizing:border-box}',
        '._ae-title{font-size:1.25rem;font-weight:700;color:var(--ae-fg);margin:0 0 4px}',
        '._ae-subtitle{font-size:.875rem;color:var(--ae-muted);margin:0 0 24px}',
        '._ae-label{display:block;font-size:.875rem;font-weight:500;color:var(--ae-fg);margin-bottom:4px}',
        '._ae-input{width:100%;padding:10px 14px;border:1px solid var(--ae-border);border-radius:8px;background:var(--ae-input-bg);color:var(--ae-fg);font-size:.875rem;outline:none;transition:border-color .15s}',
        '._ae-input:focus{border-color:var(--ae-primary)}',
        '._ae-field{margin-bottom:16px}',
        '._ae-btn{width:100%;padding:10px;border:none;border-radius:8px;background:var(--ae-primary);color:var(--ae-primary-fg);font-size:.875rem;font-weight:600;cursor:pointer;opacity:1;transition:opacity .15s}',
        '._ae-btn:hover:not(:disabled){opacity:.88}',
        '._ae-btn:disabled{opacity:.5;cursor:not-allowed}',
        '._ae-error{padding:10px 14px;border-radius:8px;font-size:.875rem;background:var(--ae-error-bg);border:1px solid var(--ae-error-border);color:var(--ae-error-fg);margin-bottom:16px}',
      ].join('\n')
      document.head.appendChild(styleEl)
    }

    var resolvedDark = (
      theme === 'dark' ||
      (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches)
    )

    target.innerHTML = ''

    var wrap = document.createElement('div')
    wrap.className = '_ae-wrap'
    wrap.setAttribute('style', resolvedDark ? darkVars : lightVars)

    var h2 = document.createElement('h2')
    h2.className   = '_ae-title'
    h2.textContent = title

    var p = document.createElement('p')
    p.className   = '_ae-subtitle'
    p.textContent = subtitle

    var form = document.createElement('form')
    form.setAttribute('autocomplete', 'on')

    function makeField(id, type, labelText, autoComplete) {
      var div = document.createElement('div')
      div.className = '_ae-field'
      var lbl = document.createElement('label')
      lbl.className    = '_ae-label'
      lbl.htmlFor      = id
      lbl.textContent  = labelText
      var inp = document.createElement('input')
      inp.type         = type
      inp.id           = id
      inp.name         = id
      inp.className    = '_ae-input'
      inp.autocomplete = autoComplete
      inp.required     = true
      div.appendChild(lbl)
      div.appendChild(inp)
      return { div: div, input: inp }
    }

    var emailF    = makeField('_ae_email',    'email',    'Correo electronico', 'email')
    var passwordF = makeField('_ae_password', 'password', 'Contrasena',         'current-password')

    var errorDiv = document.createElement('div')
    errorDiv.className     = '_ae-error'
    errorDiv.style.display = 'none'

    var btn = document.createElement('button')
    btn.type        = 'submit'
    btn.className   = '_ae-btn'
    btn.textContent = btnLabel

    form.appendChild(emailF.div)
    form.appendChild(passwordF.div)
    form.appendChild(errorDiv)
    form.appendChild(btn)

    wrap.appendChild(h2)
    wrap.appendChild(p)
    wrap.appendChild(form)
    target.appendChild(wrap)

    form.addEventListener('submit', function (e) {
      e.preventDefault()
      errorDiv.style.display = 'none'
      btn.disabled    = true
      btn.textContent = 'Ingresando...'

      auth.signIn({ email: emailF.input.value.trim(), password: passwordF.input.value })
        .then(function (result) {
          if (result.error || !result.session) {
            var msg = result.error ? result.error.message : 'Credenciales invalidas'
            if (/invalid/i.test(msg)) msg = 'Correo o contrasena incorrectos.'
            errorDiv.textContent   = msg
            errorDiv.style.display = 'block'
            btn.disabled           = false
            btn.textContent        = btnLabel
            if (opts.onError) opts.onError(result.error || new Error(msg))
            return
          }
          if (opts.onSuccess) opts.onSuccess(result.session)
          if (opts.redirectTo) window.location.href = opts.redirectTo
        })
        .catch(function (err) {
          errorDiv.textContent   = 'Error inesperado. Intenta de nuevo.'
          errorDiv.style.display = 'block'
          btn.disabled           = false
          btn.textContent        = btnLabel
          if (opts.onError) opts.onError(err)
        })
    })
  }

  // ── Expose ────────────────────────────────────────────────────────────────────
  global.AtlasERP = {
    config: {
      supabaseUrl: SUPABASE_URL,
      apiUrl:      API_URL,
      storageKey:  STORAGE_KEY,
    },
    auth:        auth,
    renderLogin: renderLogin,
  }

})(window)
