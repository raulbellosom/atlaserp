export function createRealtimeBroadcaster({ supabaseUrl, serviceRoleKey }) {
  const endpoint = `${supabaseUrl}/realtime/v1/api/broadcast`

  async function _send(messages) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ messages }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(`[realtime-broadcaster] broadcast failed status=${res.status}`, text.slice(0, 200))
    }
  }

  async function broadcastToUser(profileId, event, payload) {
    if (!profileId) return
    await _send([{
      topic: `realtime:user:${profileId}:events`,
      event,
      payload: payload ?? {},
    }]).catch((err) => {
      console.warn('[realtime-broadcaster] broadcastToUser error:', err?.message)
    })
  }

  async function broadcastToUsers(profileIds, event, payload) {
    const ids = (profileIds ?? []).filter(Boolean)
    if (!ids.length) return
    await _send(
      ids.map((id) => ({
        topic: `realtime:user:${id}:events`,
        event,
        payload: payload ?? {},
      })),
    ).catch((err) => {
      console.warn('[realtime-broadcaster] broadcastToUsers error:', err?.message)
    })
  }

  return { broadcastToUser, broadcastToUsers }
}

export function createNoopBroadcaster() {
  return {
    broadcastToUser: async () => {},
    broadcastToUsers: async () => {},
  }
}
