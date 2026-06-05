// apps/desktop/src/modules/atlas.website/lib/colorExtract.js

export function extractColorsFromImageEl(img, count = 8) {
  try {
    const canvas = document.createElement('canvas')
    const SIZE = 64
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, SIZE, SIZE)
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
    const freq = {}
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const brightness = (r + g + b) / 3
      if (brightness > 238 || brightness < 18) continue
      const qr = Math.round(r / 28) * 28
      const qg = Math.round(g / 28) * 28
      const qb = Math.round(b / 28) * 28
      const key = `${qr},${qg},${qb}`
      freq[key] = (freq[key] || 0) + 1
    }
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
    const picked = []
    for (const [key] of sorted) {
      const [r, g, b] = key.split(',').map(Number)
      const hex = '#' + [r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('')
      const tooClose = picked.some((p) => {
        const pr = parseInt(p.slice(1, 3), 16)
        const pg = parseInt(p.slice(3, 5), 16)
        const pb = parseInt(p.slice(5, 7), 16)
        return Math.abs(pr - r) + Math.abs(pg - g) + Math.abs(pb - b) < 55
      })
      if (!tooClose) {
        picked.push(hex)
        if (picked.length >= count) break
      }
    }
    return picked
  } catch { return [] }
}

export function extractColorsFromFile(file, count = 8) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { resolve(extractColorsFromImageEl(img, count)); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve([]); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export async function extractColorsFromBlobUrl(url, count = 8) {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const blob = await res.blob()
    return extractColorsFromFile(blob, count)
  } catch { return [] }
}

export const PRESET_COLORS = [
  '#4F46E5', '#0A7BFF', '#6C3BFF', '#A80070',
  '#E8330A', '#F59E0B', '#10B981', '#0EA5E9',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
]
