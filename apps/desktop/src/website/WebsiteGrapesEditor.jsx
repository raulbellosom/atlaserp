import { useEffect, useRef } from 'react'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import { buildGrapesConfig } from './atlasGrapesConfig.js'

export function WebsiteGrapesEditor({ initialData, onDataChange, height }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const onChangeRef = useRef(onDataChange)

  useEffect(() => {
    onChangeRef.current = onDataChange
  }, [onDataChange])

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return

    const editor = grapesjs.init(buildGrapesConfig(containerRef.current))

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

    return () => {
      editor.off('update', emitChange)
      editor.destroy()
      editorRef.current = null
    }
  }, []) // intentionally empty — editor mounts once, never re-initialized

  return (
    <div
      ref={containerRef}
      style={{ height: height || 'calc(100vh - 48px)', width: '100%' }}
    />
  )
}
