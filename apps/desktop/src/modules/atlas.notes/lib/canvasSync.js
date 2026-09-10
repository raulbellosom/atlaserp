// Pure helpers for SupabaseCanvasSync. Excalidraw stamps every element with a
// monotonically increasing integer `version` on each change; we broadcast only
// the elements whose version rose since the last broadcast.

export function versionMap(elements) {
  const m = new Map()
  for (const el of elements) {
    if (el && el.id != null) m.set(el.id, el.version ?? 0)
  }
  return m
}

// prevMap: Map<id, version> from the previous broadcast (or empty on first).
// Returns { changed: Element[], nextMap: Map }.
export function diffElements(prevMap, nextElements) {
  const changed = []
  const nextMap = new Map(prevMap)
  for (const el of nextElements) {
    if (!el || el.id == null) continue
    const prevV = prevMap.get(el.id)
    const v = el.version ?? 0
    if (prevV === undefined || v > prevV) {
      changed.push(el)
      nextMap.set(el.id, v)
    }
  }
  return { changed, nextMap }
}

// Trailing throttle. The wrapped fn runs at most once per `ms`, always with the
// latest args, with a trailing call for the last burst.
export function throttle(fn, ms) {
  let last = 0
  let timer = null
  let lastArgs = null
  return (...args) => {
    lastArgs = args
    const now = Date.now()
    const wait = ms - (now - last)
    if (wait <= 0) {
      last = now
      fn(...lastArgs)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...lastArgs)
      }, wait)
    }
  }
}
