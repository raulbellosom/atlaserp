export function compareVersions(left, right) {
  const parse = (value) => {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z.-]+))?(?:\+[\da-zA-Z.-]+)?$/.exec(value)
    if (!match) throw new Error('INVALID_VERSION')
    if (match[4]?.split('.').some((part) => !part || /^0\d+$/.test(part))) throw new Error('INVALID_VERSION')
    if (value.split('+')[1]?.split('.').some((part) => !part)) throw new Error('INVALID_VERSION')
    return { numbers: match.slice(1, 4).map(BigInt), pre: match[4]?.split('.') }
  }
  const a = parse(left), b = parse(right)
  for (let i = 0; i < 3; i++) if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i] ? 1 : -1
  if (!a.pre && !b.pre) return 0
  if (!a.pre) return 1
  if (!b.pre) return -1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i]
    if (x === y) continue
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y)
    if (xn && yn) return BigInt(x) > BigInt(y) ? 1 : -1
    if (xn !== yn) return xn ? -1 : 1
    return x > y ? 1 : -1
  }
  return 0
}

export function supportsCapability(info, capability, minimumVersion = '0.0.0') {
  try {
    return info?.bridgeVersion === 1 && info.capabilities?.includes(capability) === true
      && compareVersions(info.nativeHostVersion, minimumVersion) >= 0
  } catch { return false }
}

export function parseDeepLink(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'atlas:' || !['chat', 'call'].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash) return null
    const targetId = url.pathname.slice(1)
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(targetId)) return null
    return { kind: url.hostname, targetId }
  } catch { return null }
}

// Serial delivery, ACK only after success; retries survive handlers mounting late.
export function createEventPump({ read, acknowledge }) {
  let running = false
  return async function pump(handler) {
    if (running) return
    running = true
    try {
      for (const event of await read()) {
        const valid = parseDeepLink(`atlas://${event.kind}/${event.targetId}`)
        if (!valid || !Number.isSafeInteger(event.id) || event.id < 1) continue
        if (await handler(event) !== false) await acknowledge([event.id])
      }
    } finally { running = false }
  }
}
