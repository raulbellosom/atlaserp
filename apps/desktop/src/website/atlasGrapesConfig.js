import { allBlocks } from './atlasBlocks/index.js'

export function buildGrapesConfig(container, { token = null, apiUrl = 'http://localhost:4010' } = {}) {
  return {
    container,
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,

    canvas: {},

    deviceManager: {
      devices: [
        { name: 'Desktop', width: '' },
        { name: 'Tablet', width: '768px', widthMedia: '768px' },
        { name: 'Mobile', width: '375px', widthMedia: '375px' },
      ],
    },

    // ── Asset Manager (atlas.files integration) ─────────────────────────────
    assetManager: {
      assets: [],
      uploadText: 'Arrastra imagenes aqui o haz clic para subir desde tu dispositivo',
      addBtnText: 'Agregar URL de imagen',
      inputPlaceholder: 'https://...',

      uploadFile: token
        ? async (ev, clb) => {
            const files = ev.dataTransfer ? ev.dataTransfer.files : ev.target?.files
            if (!files?.length) return
            try {
              const fd = new FormData()
              fd.append('file', files[0])
              fd.append('moduleKey', 'atlas.website')
              fd.append('entityType', 'media')

              const uploadRes = await fetch(`${apiUrl}/files`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
              })
              if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`)
              const uploadData = await uploadRes.json()
              const fileId = uploadData.data?.id ?? uploadData.id

              const urlRes = await fetch(`${apiUrl}/files/${fileId}/signed-url`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!urlRes.ok) throw new Error('Could not get signed URL')
              const urlData = await urlRes.json()
              const src = urlData.data?.signedUrl ?? urlData.signedUrl
              if (src) clb([src])
            } catch (err) {
              console.error('[atlas-files] upload error:', err.message)
            }
          }
        : undefined,
    },

    styleManager: {
      sectors: [
        {
          name: 'Dimension',
          open: false,
          properties: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding'],
        },
        {
          name: 'Tipografia',
          open: false,
          properties: [
            'font-family',
            'font-size',
            'font-weight',
            'color',
            'line-height',
            'text-align',
            'letter-spacing',
            'text-decoration',
            'text-transform',
          ],
        },
        {
          name: 'Fondo',
          open: false,
          properties: [
            'background-color',
            'opacity',
            {
              property: 'background-image',
              type: 'base64',
              label: 'Imagen de fondo',
            },
            {
              property: 'background-size',
              type: 'select',
              label: 'Tamano',
              options: [
                { id: 'auto', label: 'Auto' },
                { id: 'cover', label: 'Cubrir' },
                { id: 'contain', label: 'Contener' },
              ],
            },
            {
              property: 'background-position',
              type: 'select',
              label: 'Posicion',
              options: [
                { id: 'center center', label: 'Centro' },
                { id: 'top center', label: 'Arriba' },
                { id: 'bottom center', label: 'Abajo' },
                { id: 'left center', label: 'Izquierda' },
                { id: 'right center', label: 'Derecha' },
              ],
            },
            {
              property: 'background-repeat',
              type: 'select',
              label: 'Repeticion',
              options: [
                { id: 'no-repeat', label: 'Sin repeticion' },
                { id: 'repeat', label: 'Repetir' },
                { id: 'repeat-x', label: 'Repetir horizontal' },
                { id: 'repeat-y', label: 'Repetir vertical' },
              ],
            },
          ],
        },
        {
          name: 'Bordes',
          open: false,
          properties: [
            'border-radius',
            'border',
            'border-width',
            'border-style',
            'border-color',
            'box-shadow',
            'outline',
          ],
        },
        {
          name: 'Posicion',
          open: false,
          properties: [
            {
              property: 'position',
              type: 'select',
              label: 'Posicion',
              options: [
                { id: 'static', label: 'Estatico' },
                { id: 'relative', label: 'Relativo' },
                { id: 'absolute', label: 'Absoluto' },
                { id: 'fixed', label: 'Fijo' },
                { id: 'sticky', label: 'Adhesivo' },
              ],
            },
            'top',
            'left',
            'right',
            'bottom',
            'z-index',
            {
              property: 'overflow',
              type: 'select',
              label: 'Desbordamiento',
              options: [
                { id: 'visible', label: 'Visible' },
                { id: 'hidden', label: 'Oculto' },
                { id: 'auto', label: 'Auto' },
                { id: 'scroll', label: 'Scroll' },
              ],
            },
          ],
        },
        {
          name: 'Flex / Grid',
          open: false,
          properties: [
            {
              property: 'display',
              type: 'select',
              label: 'Display',
              options: [
                { id: 'block', label: 'Block' },
                { id: 'flex', label: 'Flex' },
                { id: 'grid', label: 'Grid' },
                { id: 'inline-block', label: 'Inline block' },
                { id: 'none', label: 'Oculto' },
              ],
            },
            {
              property: 'flex-direction',
              type: 'select',
              label: 'Direccion',
              options: [
                { id: 'row', label: 'Fila' },
                { id: 'column', label: 'Columna' },
                { id: 'row-reverse', label: 'Fila inversa' },
                { id: 'column-reverse', label: 'Columna inversa' },
              ],
            },
            {
              property: 'justify-content',
              type: 'select',
              label: 'Justificar',
              options: [
                { id: 'flex-start', label: 'Inicio' },
                { id: 'center', label: 'Centro' },
                { id: 'flex-end', label: 'Fin' },
                { id: 'space-between', label: 'Espacio entre' },
                { id: 'space-around', label: 'Espacio alrededor' },
              ],
            },
            {
              property: 'align-items',
              type: 'select',
              label: 'Alinear',
              options: [
                { id: 'flex-start', label: 'Inicio' },
                { id: 'center', label: 'Centro' },
                { id: 'flex-end', label: 'Fin' },
                { id: 'stretch', label: 'Estirar' },
              ],
            },
            'gap',
            'flex-wrap',
          ],
        },
        {
          name: 'Efectos',
          open: false,
          properties: [
            'transform',
            'transition',
            {
              property: 'cursor',
              type: 'select',
              label: 'Cursor',
              options: [
                { id: 'default', label: 'Default' },
                { id: 'pointer', label: 'Puntero' },
                { id: 'not-allowed', label: 'No permitido' },
                { id: 'grab', label: 'Mano' },
              ],
            },
            {
              property: 'filter',
              type: 'base64',
              label: 'Filtros CSS',
            },
          ],
        },
      ],
    },

    blockManager: {
      blocks: allBlocks,
    },
  }
}
