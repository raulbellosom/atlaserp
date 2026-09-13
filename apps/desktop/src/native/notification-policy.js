export function notificationId(tag) {
  let hash = 2166136261
  for (const char of String(tag)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 1) || 1
}

export function notificationTarget(data) {
  if (/^[a-zA-Z0-9-]{1,128}$/.test(data?.callId ?? '')) return { kind: 'call', targetId: data.callId }
  const match = /^\/(?:app\/)?m\/atlas\.chat\/chat\/inbox\/([a-zA-Z0-9-]{1,128})$/.exec(data?.link ?? '')
  return match ? { kind: 'chat', targetId: match[1] } : null
}

export function nativeNotificationOptions({ title, body = '', tag, data, requireInteraction = false }) {
  const target = notificationTarget(data)
  return {
    id: notificationId(tag || `${title}:${body}`), title, body,
    channelId: requireInteraction ? 'atlas-calls-v1' : 'atlas-alerts-v1',
    autoCancel: true,
    extra: target ? { target } : {},
  }
}

export async function prepareAndroidNotificationChannels(plugin) {
  for (const [id, name] of [['atlas-calls-v1', 'Llamadas entrantes'], ['atlas-alerts-v1', 'Avisos de Atlas']]) {
    await plugin.createChannel({ id, name, importance: 4, visibility: 0, vibration: true, lights: true })
  }
}
