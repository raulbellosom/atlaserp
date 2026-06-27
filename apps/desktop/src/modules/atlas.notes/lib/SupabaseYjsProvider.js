// apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'

export class SupabaseYjsProvider {
  constructor(ydoc, { noteId, supabase, atlas, token, onSynced }) {
    this.ydoc = ydoc
    this.noteId = noteId
    this.synced = false
    this.awareness = new awarenessProtocol.Awareness(ydoc)
    this._channel = null
    this._updateHandler = null
    this._awarenessHandler = null
    this._onSynced = onSynced

    this._init(supabase, atlas, token)
  }

  async _init(supabase, atlas, token) {
    // 1. Load persisted server state
    try {
      const res = await atlas.notes.getYDoc(this.noteId, token)
      if (res?.state) {
        const buf = Uint8Array.from(atob(res.state), c => c.charCodeAt(0))
        Y.applyUpdate(this.ydoc, buf, 'server-load')
      }
    } catch (_) {
      // New note — no state yet, that's fine
    }

    this.synced = true
    this._onSynced?.()

    // 2. Subscribe to realtime broadcast channel
    this._channel = supabase.channel(`note:ydoc:${this.noteId}`, {
      config: { broadcast: { self: false, ack: false } },
    })

    this._channel
      .on('broadcast', { event: 'ydoc.update' }, ({ payload }) => {
        const update = Uint8Array.from(atob(payload.update), c => c.charCodeAt(0))
        Y.applyUpdate(this.ydoc, update, 'broadcast')
      })
      .on('broadcast', { event: 'awareness.update' }, ({ payload }) => {
        const update = Uint8Array.from(atob(payload.update), c => c.charCodeAt(0))
        awarenessProtocol.applyAwarenessUpdate(this.awareness, update, 'broadcast')
      })
      .subscribe()

    // 3. Broadcast local doc updates to peers
    this._updateHandler = (update, origin) => {
      if (origin === 'server-load' || origin === 'broadcast') return
      const encoded = btoa(String.fromCharCode(...update))
      this._channel.send({
        type: 'broadcast',
        event: 'ydoc.update',
        payload: { update: encoded },
      })
    }
    this.ydoc.on('update', this._updateHandler)

    // 4. Broadcast awareness (cursor) changes to peers
    this._awarenessHandler = ({ updated }) => {
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...updated])
      const encoded = btoa(String.fromCharCode(...update))
      this._channel.send({
        type: 'broadcast',
        event: 'awareness.update',
        payload: { update: encoded },
      })
    }
    this.awareness.on('update', this._awarenessHandler)
  }

  setAwarenessField(field, value) {
    this.awareness.setLocalStateField(field, value)
  }

  destroy() {
    if (this._updateHandler) this.ydoc.off('update', this._updateHandler)
    if (this._awarenessHandler) this.awareness.off('update', this._awarenessHandler)
    this.awareness.destroy()
    if (this._channel) this._channel.unsubscribe()
  }
}
