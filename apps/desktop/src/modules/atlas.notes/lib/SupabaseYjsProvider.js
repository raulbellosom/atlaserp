// apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'

// btoa(String.fromCharCode(...bytes)) blows the call stack once a Y.js update or
// full-document state grows past ~100 KB. Encode in fixed-size chunks instead.
const B64_CHUNK = 0x8000

export function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + B64_CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export class SupabaseYjsProvider {
  constructor(ydoc, { noteId, supabase, atlas, token, onSynced, onStatus }) {
    this.ydoc = ydoc
    this.noteId = noteId
    this.synced = false
    // Whether the realtime channel has actually joined. Until it has, send()
    // silently falls back to the REST broadcast endpoint (Supabase logs a
    // deprecation warning for that), so we hold local broadcasts until join.
    this.connected = false
    // Whether the server already had persisted Y.js state for this note. When
    // false, the note's content still lives only in the legacy `notes.content`
    // HTML column and the editor must seed the empty ydoc from it once.
    this.hadServerState = false
    this.awareness = new awarenessProtocol.Awareness(ydoc)
    this._supabase = supabase
    this._channel = null
    this._updateHandler = null
    this._awarenessHandler = null
    this._onSynced = onSynced
    this._onStatus = onStatus
    // Set by destroy(). _init is async and can still be mid-flight (or not
    // started) when the owning component unmounts — switching notes tears a
    // provider down within the same tick it was created. Every step of _init
    // bails if this is set, so a torn-down provider never subscribes a channel
    // or attaches doc listeners that would then leak.
    this._destroyed = false

    this._init(atlas, token)
  }

  get _topic() {
    return `note:ydoc:${this.noteId}`
  }

  async _init(atlas, token) {
    // 1. Load persisted server state
    try {
      const res = await atlas.notes.getYDoc(this.noteId, token)
      if (res?.state) {
        Y.applyUpdate(this.ydoc, base64ToBytes(res.state), 'server-load')
        this.hadServerState = true
      }
    } catch (_) {
      // New note — no state yet, that's fine
    }

    if (this._destroyed) return

    this.synced = true
    this._onSynced?.()

    // 2. Reuse of a channel topic that is still registered on the client returns
    //    the STALE object — calling .on()/.subscribe() on it is a no-op and
    //    realtime silently never connects. This happens on every note switch and
    //    under React strict-mode double-mount. Drop any stale channel first.
    const stale = this._supabase
      .getChannels()
      .find((ch) => ch.topic === `realtime:${this._topic}`)
    if (stale) {
      try {
        this._supabase.removeChannel(stale)
      } catch (_) {
        /* already gone */
      }
    }

    // 3. Subscribe to the realtime broadcast channel
    this._channel = this._supabase.channel(this._topic, {
      config: { broadcast: { self: false, ack: false } },
    })

    this._channel
      .on('broadcast', { event: 'ydoc.update' }, ({ payload }) => {
        try {
          Y.applyUpdate(this.ydoc, base64ToBytes(payload.update), 'broadcast')
        } catch (err) {
          console.warn('[notes/yjs] bad ydoc.update payload:', err?.message ?? err)
        }
      })
      .on('broadcast', { event: 'awareness.update' }, ({ payload }) => {
        try {
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            base64ToBytes(payload.update),
            'broadcast',
          )
        } catch (err) {
          console.warn('[notes/yjs] bad awareness.update payload:', err?.message ?? err)
        }
      })
      .subscribe((status, err) => {
        if (this._destroyed) return
        this._onStatus?.(status)
        if (status === 'SUBSCRIBED') {
          this.connected = true
          console.info(`[notes/yjs] realtime connected: ${this._topic}`)
          // Catch every peer up with our full doc + awareness state. Y.js
          // updates are commutative/idempotent, so a full-state broadcast on
          // (re)connect is how late joiners and post-dropout clients converge.
          this._broadcastFullState()
          this._broadcastAwareness([...this.awareness.getStates().keys()])
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          this.connected = false
          if (err) {
            console.warn(`[notes/yjs] channel ${status}:`, err?.message ?? err)
          }
        }
      })

    // 4. Broadcast local doc updates to peers
    this._updateHandler = (update, origin) => {
      if (origin === 'server-load' || origin === 'broadcast') return
      this._send('ydoc.update', bytesToBase64(update))
    }
    this.ydoc.on('update', this._updateHandler)

    // 5. Broadcast awareness (cursor) changes to peers. Skip changes that came
    //    in FROM a peer — applyAwarenessUpdate re-fires 'update' with
    //    origin 'broadcast' and echoing those would loop.
    this._awarenessHandler = ({ added, updated, removed }, origin) => {
      if (origin === 'broadcast') return
      this._broadcastAwareness([...added, ...updated, ...removed])
    }
    this.awareness.on('update', this._awarenessHandler)
  }

  _send(event, encoded) {
    // Before the socket has joined, channel.send() falls back to a REST POST
    // (deprecated + unreliable for fan-out). Skip it — _broadcastFullState on
    // SUBSCRIBED replays whatever was missed.
    if (!this._channel || this._channel.state !== 'joined') return
    this._channel.send({ type: 'broadcast', event, payload: { update: encoded } })
  }

  _broadcastFullState() {
    this._send('ydoc.update', bytesToBase64(Y.encodeStateAsUpdate(this.ydoc)))
  }

  _broadcastAwareness(clientIds) {
    if (!clientIds || clientIds.length === 0) return
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds)
    this._send('awareness.update', bytesToBase64(update))
  }

  setAwarenessField(field, value) {
    this.awareness.setLocalStateField(field, value)
  }

  destroy() {
    this._destroyed = true
    this.connected = false
    // Broadcast local-state removal first (while _awarenessHandler is still
    // attached) so peers see this user's presence disappear immediately,
    // instead of lingering until their own connection times out.
    this.awareness.setLocalState(null)
    if (this._updateHandler) this.ydoc.off('update', this._updateHandler)
    if (this._awarenessHandler) this.awareness.off('update', this._awarenessHandler)
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.ydoc.clientID],
      'provider-destroy',
    )
    this.awareness.destroy()
    // removeChannel (not just unsubscribe) so channel() does not hand back this
    // dead object on the next mount for the same note.
    if (this._channel) {
      try {
        this._supabase.removeChannel(this._channel)
      } catch (_) {
        /* already gone */
      }
      this._channel = null
    }
  }
}
