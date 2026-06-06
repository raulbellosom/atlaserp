const HEALTH_PROBE_INTERVAL_MS = 30_000

export class OnlineDetector {
  constructor({ getNavigatorOnline = () => navigator.onLine, probeUrl = null } = {}) {
    this._getNavigatorOnline = getNavigatorOnline
    this._probeUrl = probeUrl
    this._callbacks = []
    this._currentState = getNavigatorOnline()
    this._probeTimer = null

    this._handleOnline = this._handleOnline.bind(this)
    this._handleOffline = this._handleOffline.bind(this)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleOnline)
      window.addEventListener('offline', this._handleOffline)
    }

    if (probeUrl) {
      this._probeTimer = setInterval(() => this._probe(), HEALTH_PROBE_INTERVAL_MS)
    }
  }

  isOnline() {
    return this._currentState
  }

  onChange(callback) {
    this._callbacks.push(callback)
  }

  destroy() {
    this._callbacks = []
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._handleOnline)
      window.removeEventListener('offline', this._handleOffline)
    }
    if (this._probeTimer) {
      clearInterval(this._probeTimer)
      this._probeTimer = null
    }
  }

  _handleOnline() {
    if (this._currentState === true) return
    this._currentState = true
    this._notify(true)
  }

  _handleOffline() {
    if (this._currentState === false) return
    this._currentState = false
    this._notify(false)
  }

  _notify(isOnline) {
    for (const cb of this._callbacks) {
      try { cb(isOnline) } catch {}
    }
  }

  async _probe() {
    if (!this._probeUrl) return
    try {
      await fetch(this._probeUrl, { method: 'HEAD', cache: 'no-store' })
      this._handleOnline()
    } catch {
      this._handleOffline()
    }
  }
}
