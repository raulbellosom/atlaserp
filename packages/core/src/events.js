export class AtlasEventBus {
  constructor() {
    this.listeners = new Map()
  }

  on(eventName, handler) {
    const handlers = this.listeners.get(eventName) ?? []
    handlers.push(handler)
    this.listeners.set(eventName, handlers)
    return () => this.off(eventName, handler)
  }

  off(eventName, handler) {
    const handlers = this.listeners.get(eventName) ?? []
    this.listeners.set(eventName, handlers.filter((item) => item !== handler))
  }

  async emit(eventName, payload) {
    const handlers = this.listeners.get(eventName) ?? []
    for (const handler of handlers) {
      await handler(payload)
    }
  }
}
