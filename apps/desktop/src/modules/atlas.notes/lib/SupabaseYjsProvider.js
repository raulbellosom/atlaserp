// apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'

export class SupabaseYjsProvider {
  constructor(ydoc, { noteId, supabase, atlas, token, onSynced }) {
    this.ydoc = ydoc
    this.noteId = noteId
    this.synced = false
    // Whether the server already had persisted Y.js state for this note. When
    // false, the note's content still lives only in the legacy `notes.content`
    // HTML column and the editor must seed the empty ydoc from it once.
    this.hadServerState = false
    this.awareness = new awarenessProtocol.Awareness(ydoc)
    this._channel = null
    this._updateHandler = null
    this._awarenessHandler = null
    this._onSynced = onSynced
    // Set by destroy(). _init is async and can still be mid-flight (or not
    // started) when the owning component unmounts — switching notes tears a
    // provider down within the same tick it was created. Every step of _init
    // bails if this is set, so a torn-down provider never subscribes a channel
    // or attaches doc listeners that would then leak.
    this._destroyed = false

    this._init(supabase, atlas, token)
  }

  async _init(supabase, atlas, token) {
    // 1. Load persisted server state
    try {
      const res = await atlas.notes.getYDoc(this.noteId, token)
      if (res?.state) {
        const buf = Uint8Array.from(atob(res.state), c => c.charCodeAt(0))
        Y.applyUpdate(this.ydoc, buf, 'server-load')
        this.hadServerState = true
      }
    } catch (_) {
      // New note — no state yet, that's fine
    }

    if (this._destroyed) return

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
    this._destroyed = true
    // Broadcast local-state removal first (while _awarenessHandler is still
    // attached) so peers see this user's presence disappear immediately,
    // instead of lingering until their own connection times out.
    this.awareness.setLocalState(null)
    if (this._updateHandler) this.ydoc.off('update', this._updateHandler)
    if (this._awarenessHandler) this.awareness.off('update', this._awarenessHandler)
    this.awareness.destroy()
    if (this._channel) this._channel.unsubscribe()
  }
}
