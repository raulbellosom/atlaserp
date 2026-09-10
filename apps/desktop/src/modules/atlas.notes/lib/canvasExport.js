import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const safeName = (title) => (title?.trim() || 'lienzo').replace(/[^\w\-. ]+/g, '_')

export async function exportCanvasPng({ elements, appState, files, title }) {
  const blob = await exportToBlob({
    elements,
    appState: { ...appState, exportBackground: true },
    files: files ?? {},
    mimeType: 'image/png',
  })
  triggerDownload(blob, `${safeName(title)}.png`)
}

export async function exportCanvasSvg({ elements, appState, files, title }) {
  const svg = await exportToSvg({ elements, appState: appState ?? {}, files: files ?? {} })
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
  triggerDownload(blob, `${safeName(title)}.svg`)
}
