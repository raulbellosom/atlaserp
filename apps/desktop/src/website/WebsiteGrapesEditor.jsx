import { useEffect, useRef } from 'react'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import { buildGrapesConfig } from './atlasGrapesConfig.js'
import { getApiUrl } from '../lib/runtimeConfig.js'

// Fetches image assets from atlas.files and loads them into GrapesJS's AssetManager.
// Uses POST /files/batch-signed-urls to get all URLs in a single request.
async function loadAtlasImages(editor, token) {
  const apiUrl = getApiUrl()
  try {
    const listRes = await fetch(`${apiUrl}/files?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!listRes.ok) return
    const listData = await listRes.json()
    const imageFiles = (listData.data ?? []).filter((f) => f.mimeType?.startsWith('image/'))
    if (!imageFiles.length) return

    const urlsRes = await fetch(`${apiUrl}/files/batch-signed-urls`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: imageFiles.map((f) => f.id) }),
    })
    if (!urlsRes.ok) return
    const urlsData = await urlsRes.json()
    const urlMap = urlsData.data ?? {}

    const assets = imageFiles
      .filter((f) => urlMap[f.id])
      .map((f) => ({
        src: urlMap[f.id],
        name: f.originalName ?? f.id,
        type: 'image',
      }))

    if (assets.length) editor.AssetManager.add(assets)
  } catch (err) {
    console.warn('[atlas-files] could not load images into editor:', err.message)
  }
}

export function WebsiteGrapesEditor({ initialData, onDataChange, height, token }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const onChangeRef = useRef(onDataChange)

  useEffect(() => {
    onChangeRef.current = onDataChange
  }, [onDataChange])

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const apiUrl = getApiUrl()
    const editor = grapesjs.init(buildGrapesConfig(containerRef.current, { token, apiUrl }))

    if (initialData?.gjsProjectData) {
      editor.loadProjectData(initialData.gjsProjectData)
    }

    const emitChange = () => {
      onChangeRef.current?.({
        gjsProjectData: editor.getProjectData(),
        html: editor.getHtml(),
        css: editor.getCss(),
      })
    }

    editor.on('update', emitChange)
    editorRef.current = editor

    const initEmitTimer = setTimeout(emitChange, 250)

    // Load images from atlas.files into the GrapesJS asset manager
    if (token) loadAtlasImages(editor, token)

    return () => {
      clearTimeout(initEmitTimer)
      editor.off('update', emitChange)
      editor.destroy()
      editorRef.current = null
    }
  }, []) // intentionally empty — editor mounts once, never re-initialized

  return (
    <div
      ref={containerRef}
      style={{ height: height || '100%', width: '100%' }}
    />
  )
}
