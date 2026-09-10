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

// Raster PDF: render the scene to a PNG, then drop it onto a single PDF page
// sized to the image's aspect ratio. jsPDF is loaded on demand (rare path).
export async function exportCanvasPdf({ elements, appState, files, title }) {
  if (!elements?.length) throw new Error('El lienzo esta vacio')
  const blob = await exportToBlob({
    elements,
    appState: { ...appState, exportBackground: true },
    files: files ?? {},
    mimeType: 'image/png',
    exportPadding: 16,
  })
  const dataURL = await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = dataURL
  })

  const { jsPDF } = await import('jspdf')
  const w = img.naturalWidth || 1
  const h = img.naturalHeight || 1
  const pdf = new jsPDF({
    orientation: w >= h ? 'landscape' : 'portrait',
    unit: 'px',
    format: [w, h],
    compress: true,
  })
  pdf.addImage(dataURL, 'PNG', 0, 0, w, h)
  pdf.save(`${safeName(title)}.pdf`)
}
